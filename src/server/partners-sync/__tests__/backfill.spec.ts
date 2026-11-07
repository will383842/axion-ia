// @vitest-environment node
// @req REQ-INT-011
// @req REQ-INT-012
/**
 * INT-T21-A — le backfill : `POST /api/partners/backfill` rappelle les producteurs existants sur
 * l'historique de la fenêtre (depuis le 2026-08-13 ; devis émis des six derniers mois).
 *
 * CE QUE CE FICHIER GARDE : canal fermé = 404 sans rien lire ; une requête non signée, mal signée
 * ou au corps hors forme n'appelle aucune source ; une page émet par les producteurs, rend
 * `suivant` tant qu'elle est pleine, et un fait refusé n'arrête pas la page (son NOM de faute est
 * rendu, jamais son message) ; la fenêtre est celle de HYP-E1-7.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { identifiantEvenement } from "@/server/partners/enveloppe";
import type { Prisma } from "../../../../prisma/generated/client";

import {
  CLE_DEBIT_BACKFILL,
  emettreFaitHistorique,
  fenetreBackfillDepuis,
  debutDevisEmis,
  rattraperUnePage,
  repondreBackfill,
  type SourcesBackfill,
} from "../backfill";
import { finaliserCorps } from "../outbox";
import { repondreRelecture, signerCibleRelecture, type LecteurRelecture } from "../relecture";

const SECRET_RELECTURE = "r".repeat(40);
const SECRET_EMISSION = "e".repeat(40);
const MAINTENANT_MS = Date.UTC(2026, 9, 7, 12, 0, 0);
const T = String(Math.floor(MAINTENANT_MS / 1000));
const CHEMIN = "/api/partners/backfill";

const ID1 = "0a1b2c3d-0001-4000-8000-000000000001";
const ID2 = "0a1b2c3d-0002-4000-8000-000000000002";
const ID3 = "0a1b2c3d-0003-4000-8000-000000000003";

function sources(ids: string[], emission: (id: string) => string | null | Error) {
  const appels: string[] = [];
  const s: SourcesBackfill = {
    lister: async (famille, { apres, limite }) => {
      appels.push(`lister:${famille}:${apres ?? "-"}:${limite}`);
      return ids.filter((i) => apres === null || i > apres).slice(0, limite);
    },
    emettre: async (famille, id) => {
      appels.push(`emettre:${famille}:${id}`);
      const r = emission(id);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { s, appels };
}

function requete(corps: string, signature?: string) {
  const s = signature ?? signerCibleRelecture(SECRET_RELECTURE, T, `${CHEMIN}\n${corps}`);
  return new Request(`https://axion-ia.com${CHEMIN}`, {
    method: "POST",
    headers: { "x-partners-timestamp": T, "x-partners-signature": s },
    body: corps,
  });
}

const ENV_AVANT = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET_EMISSION;
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
});
afterEach(() => {
  process.env = { ...ENV_AVANT };
});

describe("la fenêtre (HYP-E1-7, INT-T46-A)", () => {
  it("commence le 2026-08-13, et les devis émis remontent à six mois", () => {
    expect(fenetreBackfillDepuis().toISOString()).toBe("2026-08-13T00:00:00.000Z");
    expect(debutDevisEmis(new Date("2026-10-07T12:00:00.000Z")).toISOString()).toBe(
      "2026-04-07T12:00:00.000Z",
    );
  });
});

describe("rattraperUnePage", () => {
  it("TÉMOIN — émet par le producteur, compte les ignorés, nomme les refusés sans leur message", async () => {
    const { s } = sources([ID1, ID2, ID3], (id) =>
      id === ID1 ? "evt-1" : id === ID2 ? null : new RangeError("valeur secrète de la fiche"),
    );
    const b = await rattraperUnePage(s, "devis_signes", null, 10, new Date(MAINTENANT_MS));
    expect(b).toEqual({
      famille: "devis_signes",
      traites: 3,
      emis: 1,
      ignores: 1,
      refuses: [{ id: ID3, motif: "RangeError" }],
      suivant: null,
    });
    expect(JSON.stringify(b)).not.toContain("secrète");
  });

  it("une page pleine rend `suivant` ; la reprise après lui rend le reste", async () => {
    const { s } = sources([ID1, ID2, ID3], () => "evt");
    const p1 = await rattraperUnePage(s, "clients", null, 2, new Date(MAINTENANT_MS));
    expect(p1.suivant).toBe(ID2);
    const p2 = await rattraperUnePage(s, "clients", p1.suivant, 2, new Date(MAINTENANT_MS));
    expect([p2.traites, p2.suivant]).toEqual([1, null]);
  });

  it("canal fermé : rien n'est lu", async () => {
    delete process.env.PARTNERS_SYNC_ENABLED;
    const { s, appels } = sources([ID1], () => "evt");
    const b = await rattraperUnePage(s, "clients", null, 10, new Date(MAINTENANT_MS));
    expect(b.traites).toBe(0);
    expect(appels).toEqual([]);
  });
});

describe("repondreBackfill", () => {
  const corps = JSON.stringify({ famille: "devis_emis", limite: 2 });
  const limiter = async () => ({ allowed: true });

  it("TÉMOIN — requête signée : 200, bilan signé avec le secret d'émission", async () => {
    const { s, appels } = sources([ID1, ID2], () => "evt");
    const r = await repondreBackfill(requete(corps), {
      sources: s,
      maintenantMs: MAINTENANT_MS,
      limiter,
      journal: () => undefined,
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      famille: "devis_emis",
      traites: 2,
      emis: 2,
      suivant: ID2,
    });
    expect(r.headers.get("x-axionia-signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(r.headers.get("x-axionia-kid")).not.toBeNull();
    expect(appels).toContain(`emettre:devis_emis:${ID1}`);
  });

  it("non signée, mal signée ou corps hors forme : aucune source n'est appelée", async () => {
    const { s, appels } = sources([ID1], () => "evt");
    const d = { sources: s, maintenantMs: MAINTENANT_MS, limiter, journal: () => undefined };
    const sansEntete = await repondreBackfill(
      new Request(`https://axion-ia.com${CHEMIN}`, { method: "POST", body: corps }),
      d,
    );
    const mauvaise = await repondreBackfill(requete(corps, "0".repeat(64)), d);
    const horsForme = await repondreBackfill(requete('{"famille":"paiements"}'), d);
    const champInconnu = await repondreBackfill(
      requete('{"famille":"clients","depuis":"2020-01-01"}'),
      d,
    );
    expect([sansEntete.status, mauvaise.status, horsForme.status, champInconnu.status]).toEqual([
      401, 401, 400, 400,
    ]);
    expect(appels).toEqual([]);
  });

  it("canal fermé ou secret absent : 404, rien n'est lu ; débit dépassé : 429", async () => {
    const { s, appels } = sources([ID1], () => "evt");
    const d = { sources: s, maintenantMs: MAINTENANT_MS, limiter, journal: () => undefined };
    delete process.env.PARTNERS_RELECTURE_SECRET;
    expect((await repondreBackfill(requete(corps), d)).status).toBe(404);
    process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
    delete process.env.PARTNERS_SYNC_ENABLED;
    expect((await repondreBackfill(requete(corps), d)).status).toBe(404);
    process.env.PARTNERS_SYNC_ENABLED = "true";
    const cles: string[] = [];
    const refuse = async (cle: string) => {
      cles.push(cle);
      return { allowed: false };
    };
    expect((await repondreBackfill(requete(corps), { ...d, limiter: refuse })).status).toBe(429);
    expect(cles).toEqual([CLE_DEBIT_BACKFILL]);
    expect(appels).toEqual([]);
  });
});

// ── Un faux monde : une base de devis et de clients, et UNE file de sortie partagée ────────────

const CLIENT_HORS_FENETRE = "7c000000-0000-4000-8000-0000000000a1";
const DEVIS_FENETRE = "7a000000-0000-4000-8000-0000000000a1";
const DEVIS_ENVOYE = "7a000000-0000-4000-8000-0000000000a2";

type LigneOutbox = { eventId: string; eventType: string; subjectRef: string; corps: string };

function monde() {
  const lignes: LigneOutbox[] = [];
  const client = {
    id: CLIENT_HORS_FENETRE,
    numero: "AXI-CLI-A1",
    type: "entreprise",
    raisonSociale: "Entreprise témoin",
    siren: "123456789",
    siret: null,
    nafCode: "6201Z",
    secteur: "Informatique",
    taille: "pme_10_49",
    // Créé AVANT la fenêtre : seul son devis y est.
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-01T10:00:00.000Z"),
  };
  const devis = (id: string, surcharge: Record<string, unknown>) => ({
    id,
    numero: `AXI-DEV-${id.slice(-2)}`,
    activite: "formation",
    clientId: CLIENT_HORS_FENETRE,
    montantTotalHtCents: 500_000,
    statut: "accepte",
    sentAt: new Date("2026-08-20T09:00:00.000Z"),
    acceptedAt: new Date("2026-08-25T09:00:00.000Z"),
    createdAt: new Date("2026-08-19T09:00:00.000Z"),
    updatedAt: new Date("2026-08-25T09:00:00.000Z"),
    lignes: [
      {
        designation: "Formation IA 2 jours",
        quantite: 2,
        prixUnitaireHtCents: 250_000,
        offreCode: "AXI-OFF-004",
      },
    ],
    ...surcharge,
  });
  const base = [
    devis(DEVIS_FENETRE, {}),
    devis(DEVIS_ENVOYE, { statut: "envoye", acceptedAt: null }),
  ];
  const tx = {
    devis: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        base.find((d) => d.id === where.id) ?? null,
    },
    client: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === CLIENT_HORS_FENETRE ? client : null,
    },
    offreSite: { findMany: async () => [] },
    partnersSyncOutbox: {
      createMany: async ({ data }: { data: LigneOutbox[] }) => {
        let count = 0;
        for (const l of data) {
          if (lignes.some((x) => x.eventId === l.eventId)) continue;
          lignes.push(l);
          count += 1;
        }
        return { count };
      },
    },
  } as unknown as Prisma.TransactionClient;
  /** Ce que le relais stocke : la séquence posée, dans l'ordre d'écriture. */
  const stockees = () =>
    lignes.map((l, i) => ({
      sequence: BigInt(i + 1),
      eventType: l.eventType,
      corps: finaliserCorps(l.corps, BigInt(i + 1), new Date("2026-10-07T12:00:00.000Z")),
    }));
  return { tx, lignes, stockees };
}

describe("REQ-INT-011 — le parent part avant l'enfant : aucun devis du backfill ne reste orphelin", () => {
  it("REQ-INT-011 : TÉMOIN — un devis de la fenêtre dont le client est hors fenêtre fait émettre ce client AVANT le devis", async () => {
    const m = monde();
    const eventId = await emettreFaitHistorique(m.tx, "devis_signes", DEVIS_FENETRE);
    expect(eventId).toBe(identifiantEvenement("devis.signe", `devis.signe:${DEVIS_FENETRE}`));
    expect(m.lignes.map((l) => l.eventType)).toEqual(["client.cree", "devis.signe"]);
    expect(m.lignes[0]?.subjectRef).toBe(`client:${CLIENT_HORS_FENETRE}`);
    const [client, devis] = m.stockees();
    expect(client!.sequence < devis!.sequence).toBe(true);
    // Le devis cite bien le client qui le précède.
    const charge = (JSON.parse(devis!.corps) as { payload: { clientId: string } }).payload;
    expect(charge.clientId).toBe(CLIENT_HORS_FENETRE);
  });

  it("REQ-INT-011 : deux devis du même client ne le réécrivent pas ; un devis émis suit la même règle", async () => {
    const m = monde();
    await emettreFaitHistorique(m.tx, "devis_signes", DEVIS_FENETRE);
    await emettreFaitHistorique(m.tx, "devis_emis", DEVIS_ENVOYE);
    await emettreFaitHistorique(m.tx, "devis_signes", DEVIS_FENETRE);
    expect(m.lignes.map((l) => l.eventType)).toEqual(["client.cree", "devis.signe", "devis.emis"]);
  });

  it("REQ-INT-011 : un devis introuvable lève, nommé, sans rien écrire", async () => {
    const m = monde();
    await expect(
      emettreFaitHistorique(m.tx, "devis_emis", "7a000000-0000-4000-8000-0000000000ff"),
    ).rejects.toThrow(/backfill/);
    expect(m.lignes).toEqual([]);
  });
});

describe("REQ-INT-012 — la route unique relit les faits du backfill, payload exact, dans l'ordre", () => {
  it("REQ-INT-012 : TÉMOIN — après un backfill, GET /api/partners/evenements rend les faits émis, octet pour octet, dans l'ordre de `sequence`", async () => {
    const m = monde();
    await emettreFaitHistorique(m.tx, "devis_signes", DEVIS_FENETRE);
    await emettreFaitHistorique(m.tx, "devis_emis", DEVIS_ENVOYE);
    const stockees = m.stockees();
    const lecteur: LecteurRelecture = {
      partnersSyncOutbox: {
        findMany: async ({ where, take }) =>
          stockees.filter((l) => l.sequence > where.sequence.gt).slice(0, take),
      },
    };
    const chemin = "/api/partners/evenements?after_sequence=0&limit=100";
    const r = await repondreRelecture(
      new Request(`https://axion-ia.com${chemin}`, {
        headers: {
          "x-partners-timestamp": T,
          "x-partners-signature": signerCibleRelecture(SECRET_RELECTURE, T, chemin),
        },
      }),
      { prisma: lecteur, maintenantMs: MAINTENANT_MS },
    );
    expect(r.status).toBe(200);
    const lues = (await r.text()).split("\n");
    // Le payload EXACT conservé : les corps stockés, sans reconstruction.
    expect(lues).toEqual(stockees.map((l) => l.corps));
    const enveloppes = lues.map(
      (l) => JSON.parse(l) as { event_type: string; sequence: number; payload: unknown },
    );
    expect(enveloppes.map((e) => e.event_type)).toEqual([
      "client.cree",
      "devis.signe",
      "devis.emis",
    ]);
    expect(enveloppes.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(r.headers.get("x-axionia-derniere-sequence")).toBe("3");
  });
});
