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

import {
  CLE_DEBIT_BACKFILL,
  fenetreBackfillDepuis,
  debutDevisEmis,
  rattraperUnePage,
  repondreBackfill,
  type SourcesBackfill,
} from "../backfill";
import { signerCibleRelecture } from "../relecture";

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
