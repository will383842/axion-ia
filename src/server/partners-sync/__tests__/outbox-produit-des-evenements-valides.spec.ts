// @vitest-environment node
/**
 * INT-T02 — la file de sortie vers Axion Partners produit des événements VALIDES, et rien
 * d'autre tant qu'elle n'est pas ouverte.
 *
 * REQ-INT-001 (dans la transaction), REQ-INT-002 / REQ-SEC-010 (signature « t.corps exact »),
 * REQ-INT-008 (inertie), REQ-INT-009 (rejeu), REQ-INT-012 (relecture), REQ-INT-031 (aucun
 * secret dans le dépôt : ceux d'ici sont fabriqués par le test, à chaque exécution).
 *
 * Ce fichier tient la LOGIQUE sur un faux client. Ce qu'un faux ne peut pas prouver — qu'un
 * retour arrière Postgres efface la ligne, que deux transactions validées dans l'ordre inverse
 * ne font sauter aucune ligne, que `text` rend l'octet exact — est prouvé contre un vrai
 * Postgres par `tests/integration/partners-sync/outbox-transactionnelle.spec.ts` (Gate D).
 *
 * Les faits émis viennent de `src/server/partners/contrat/fixtures.v1.json`, GÉNÉRÉ depuis le
 * producteur réel (RM-03, `Source:` dans le fichier) : aucun payload n'est tapé ici.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixtures from "@/server/partners/contrat/fixtures.v1.json";
import { CHAMPS_ENVELOPPE, SCHEMA_VERSION } from "@/server/partners/contrat";

import {
  CLE_VERROU_SEQUENCE,
  PARTNERS_SYNC_DELAI_MS,
  PARTNERS_SYNC_MAX_TENTATIVES,
  delaiAvantNouvelleTentativeMs,
} from "../config";
import {
  EvenementHorsContrat,
  aplatirSujet,
  ecrireEvenementPartners,
  finaliserCorps,
  type FaitPartners,
} from "../outbox";
import {
  envoyerLigne,
  numeroterEnAttente,
  rejouerEvenement,
  relayer,
  type ClientRelais,
} from "../relais";
import {
  ENTETE_HORODATAGE_RELECTURE,
  ENTETE_SIGNATURE_RELECTURE,
  repondreRelecture,
  type LecteurRelecture,
} from "../relecture";

// ── Les faits, tirés de la fixture GÉNÉRÉE ────────────────────────────────────────────────

type EvenementFixture = {
  event_type: string;
  occurred_at: string;
  subject_ref: Record<string, string>;
  payload: Record<string, unknown>;
};
const EVENEMENTS = fixtures.evenements as unknown as EvenementFixture[];

function faitDepuisFixture(i: number, cle = `fixture-${i}`): FaitPartners {
  const e = EVENEMENTS[i];
  if (!e) throw new Error(`fixture ${i} absente`);
  return {
    type: e.event_type,
    cleDeFait: cle,
    occurredAt: new Date(e.occurred_at),
    sujet: e.subject_ref,
    payload: e.payload,
  };
}

// ── Un faux client, qui interprète exactement les requêtes du module ──────────────────────

type Ligne = {
  id: string;
  eventId: string;
  eventType: string;
  subjectRef: string;
  sequence: bigint | null;
  corps: string;
  status: "pending" | "sent" | "failed" | "gave_up";
  attempts: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  sentAt: Date | null;
  responseStatus: number | null;
  createdAt: Date;
};

type Where = Record<string, unknown>;

function correspond(l: Ligne, where: Where | undefined, maintenant: Date): boolean {
  if (!where) return true;
  for (const [cle, attendu] of Object.entries(where)) {
    if (cle === "OR") {
      const branches = attendu as Where[];
      if (!branches.some((b) => correspond(l, b, maintenant))) return false;
      continue;
    }
    const valeur = (l as unknown as Record<string, unknown>)[cle];
    if (attendu === null) {
      if (valeur !== null) return false;
    } else if (typeof attendu === "object" && !(attendu instanceof Date)) {
      const op = attendu as Record<string, unknown>;
      if ("not" in op && op.not === null && valeur === null) return false;
      if ("in" in op && !(op.in as unknown[]).includes(valeur)) return false;
      if ("gt" in op && !(valeur !== null && (valeur as bigint) > (op.gt as bigint))) return false;
      if ("lte" in op && !(valeur instanceof Date && valeur <= (op.lte as Date))) return false;
    } else if (valeur !== attendu) {
      return false;
    }
  }
  return true;
}

function fauxClient(maintenant: () => Date = () => new Date()) {
  const lignes: Ligne[] = [];
  const journal: string[] = [];
  let n = 0;

  const table = {
    createMany: vi.fn(
      async (args: {
        data: Omit<Ligne, "id">[] | Record<string, unknown>[];
        skipDuplicates?: boolean;
      }) => {
        journal.push("createMany");
        let count = 0;
        for (const d of args.data as Record<string, unknown>[]) {
          if (lignes.some((l) => l.eventId === d.eventId)) {
            if (args.skipDuplicates) continue;
            throw Object.assign(new Error("P2002"), { code: "P2002" });
          }
          n += 1;
          lignes.push({
            id: `id-${n}`,
            eventId: String(d.eventId),
            eventType: String(d.eventType),
            subjectRef: String(d.subjectRef),
            sequence: null,
            corps: String(d.corps),
            status: "pending",
            attempts: 0,
            lastError: null,
            lastAttemptAt: null,
            nextAttemptAt: null,
            sentAt: null,
            responseStatus: null,
            createdAt: new Date(maintenant().getTime() + n),
          });
          count += 1;
        }
        return { count };
      },
    ),
    findMany: vi.fn(async (args: { where?: Where; orderBy?: unknown; take?: number }) => {
      journal.push("findMany");
      const trouvees = lignes.filter((l) => correspond(l, args.where, maintenant()));
      const parSequence = JSON.stringify(args.orderBy ?? "").includes("sequence");
      trouvees.sort((a, b) =>
        parSequence
          ? Number((a.sequence ?? 0n) - (b.sequence ?? 0n))
          : a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
      );
      return trouvees.slice(0, args.take ?? trouvees.length).map((l) => ({ ...l }));
    }),
    findUnique: vi.fn(async (args: { where: { id?: string; eventId?: string } }) => {
      journal.push("findUnique");
      const l = lignes.find((x) =>
        args.where.id !== undefined ? x.id === args.where.id : x.eventId === args.where.eventId,
      );
      return l ? { ...l } : null;
    }),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<Ligne> }) => {
      journal.push("update");
      const l = lignes.find((x) => x.id === args.where.id);
      if (!l) throw new Error("introuvable");
      Object.assign(l, args.data);
      return { ...l };
    }),
    aggregate: vi.fn(async () => {
      journal.push("aggregate");
      const seqs = lignes.map((l) => l.sequence).filter((s): s is bigint => s !== null);
      return { _max: { sequence: seqs.length ? seqs.reduce((a, b) => (a > b ? a : b)) : null } };
    }),
  };

  const tx = {
    partnersSyncOutbox: table,
    $executeRaw: vi.fn(async (morceaux: TemplateStringsArray) => {
      journal.push(`executeRaw:${morceaux.join("?")}`);
      return 1;
    }),
  };
  const client = {
    ...tx,
    $transaction: vi.fn(async <T>(fn: (t: typeof tx) => Promise<T>) => {
      journal.push("transaction");
      return fn(tx);
    }),
  };
  // Le faux porte les MÊMES formes que le client réel pour les trois consommateurs.
  const commeLeVrai = client as typeof client & ClientRelais & LecteurRelecture;
  return { client: commeLeVrai, tx, table, lignes, journal };
}

const URL_PARTNERS = "https://partners.exemple.test/api/webhooks/axionia";

function secretFrais(): string {
  return randomBytes(32).toString("hex");
}

function reponse(status: number): Response {
  return new Response(status >= 200 && status < 300 ? '{"ok":true}' : "non", { status });
}

let SECRET = "";
let SECRET_RELECTURE = "";

beforeEach(() => {
  SECRET = secretFrais();
  SECRET_RELECTURE = secretFrais();
  delete process.env.PARTNERS_SYNC_ENABLED;
  delete process.env.PARTNERS_SYNC_SECRET;
  delete process.env.PARTNERS_SYNC_URL;
  delete process.env.PARTNERS_RELECTURE_SECRET;
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function ouvrirLeCanal(): void {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET;
  process.env.PARTNERS_SYNC_URL = URL_PARTNERS;
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// (3)(7) INERTIE — mesurée, pas supposée. Chaque cas a sa face ouverte : sans elle, un espion
// jamais appelé serait vert pour la mauvaise raison (un espion mal branché).
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("REQ-INT-008 — sans PARTNERS_SYNC_ENABLED : zéro ligne, zéro travail, zéro appel", () => {
  it("un appel métier complet n'écrit aucune ligne… et la même avec le drapeau en écrit une", async () => {
    const f = fauxClient();
    for (const valeur of [undefined, "", "false", "TRUE", "1", "yes"]) {
      if (valeur === undefined) delete process.env.PARTNERS_SYNC_ENABLED;
      else process.env.PARTNERS_SYNC_ENABLED = valeur;
      expect(await ecrireEvenementPartners(f.tx, faitDepuisFixture(0))).toBeNull();
    }
    expect(f.journal).toEqual([]);

    ouvrirLeCanal();
    expect(await ecrireEvenementPartners(f.tx, faitDepuisFixture(0))).not.toBeNull();
    expect(f.lignes).toHaveLength(1);
  });

  it("le relais ne touche ni la base ni le réseau… et ouvert, il appelle Partners", async () => {
    const f = fauxClient();
    const fetch = vi.fn(async () => reponse(200));
    const alerter = vi.fn(async () => undefined);

    const bilan = await relayer({ prisma: f.client, fetch, alerter });
    expect(bilan).toEqual({ inerte: true, numerotees: 0, envoyees: 0, abandonnees: 0 });
    expect(f.journal).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    ouvrirLeCanal();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(0));
    const ouvert = await relayer({ prisma: f.client, fetch, alerter });
    expect(ouvert.envoyees).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("AU BUILD (DATABASE_URL stub.invalid), rien ne s'exécute — même drapeau ouvert", async () => {
    ouvrirLeCanal();
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    const f = fauxClient();
    const fetch = vi.fn(async () => reponse(200));

    expect(await ecrireEvenementPartners(f.tx, faitDepuisFixture(0))).toBeNull();
    expect((await relayer({ prisma: f.client, fetch, alerter: vi.fn() })).inerte).toBe(true);
    expect(await rejouerEvenement("00000000-0000-4000-8000-000000000000", f.client)).toBe("inerte");
    const r = await repondreRelecture(new Request("https://axion-ia.com/api/partners/evenements"), {
      prisma: f.client,
    });
    expect(r.status).toBe(404);
    expect(f.journal).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("la route de relecture n'existe pas (404) et ne lit rien tant que le canal est fermé", async () => {
    const f = fauxClient();
    const r = await repondreRelecture(
      new Request("https://axion-ia.com/api/partners/evenements?after_sequence=0"),
      { prisma: f.client },
    );
    expect(r.status).toBe(404);
    expect(f.journal).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// (1)(10) L'écriture : dans une transaction, un type du contrat, une seule ligne par fait.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("REQ-INT-001 — l'écriture dans la file de sortie", () => {
  beforeEach(ouvrirLeCanal);

  it("refuse en 422 un type hors du contrat, AVANT toute insertion", async () => {
    const f = fauxClient();
    const fait = { ...faitDepuisFixture(0), type: "facture.annulee" };
    const erreur = await ecrireEvenementPartners(f.tx, fait).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(EvenementHorsContrat);
    expect((erreur as EvenementHorsContrat).statut).toBe(422);
    expect(f.journal).toEqual([]);
  });

  it("refuse le client GLOBAL : hors transaction, un retour arrière métier ne l'effacerait pas", async () => {
    const f = fauxClient();
    await expect(ecrireEvenementPartners(f.client, faitDepuisFixture(0))).rejects.toThrow(
      /transaction/,
    );
    expect(f.journal).toEqual([]);
  });

  it("le même fait écrit deux fois laisse EXACTEMENT UNE ligne, sans lever", async () => {
    const f = fauxClient();
    const a = await ecrireEvenementPartners(f.tx, faitDepuisFixture(0, "client:1"));
    const b = await ecrireEvenementPartners(f.tx, faitDepuisFixture(0, "client:1"));
    expect(a).toBe(b);
    expect(f.lignes).toHaveLength(1);
    expect(f.table.createMany.mock.calls.every(([args]) => args.skipDuplicates === true)).toBe(
      true,
    );
  });

  it("chaque type de la fixture GÉNÉRÉE s'écrit, sujet mis à plat, séquence encore nulle", async () => {
    const f = fauxClient();
    for (let i = 0; i < EVENEMENTS.length; i += 1) {
      await ecrireEvenementPartners(f.tx, faitDepuisFixture(i));
    }
    expect(f.lignes).toHaveLength(EVENEMENTS.length);
    for (const [i, l] of f.lignes.entries()) {
      expect(l.sequence).toBeNull();
      expect(l.status).toBe("pending");
      expect(l.eventType).toBe(EVENEMENTS[i]?.event_type);
      expect(l.subjectRef).toBe(aplatirSujet(EVENEMENTS[i]?.subject_ref));
      expect(l.subjectRef).toMatch(/^[a-z_]+:.+$/);
    }
  });

  it("aplatit le sujet comme le récepteur (`client_id` → `client:<id>`) et refuse le reste", () => {
    expect(aplatirSujet({ client_id: "abc" })).toBe("client:abc");
    expect(aplatirSujet({ payment_id: "p-1" })).toBe("payment:p-1");
    for (const mauvais of [{}, { a: "1", b: "2" }, { client: "x" }, { client_id: "" }, null]) {
      expect(() => aplatirSujet(mauvais)).toThrow(EvenementHorsContrat);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// (8)(9) Numérotation au premier envoi, corps figé en texte.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("partners/ADR-0022 point 15 — la séquence est posée par le relais, sous verrou", () => {
  beforeEach(ouvrirLeCanal);

  it("prend le verrou consultatif AVANT de lire le maximum, et numérote dans l'ordre de création", async () => {
    const f = fauxClient();
    for (let i = 0; i < 3; i += 1) await ecrireEvenementPartners(f.tx, faitDepuisFixture(i));
    f.journal.length = 0;

    expect(await numeroterEnAttente(f.client, new Date("2026-09-26T12:00:00Z"))).toBe(3);

    const verrou = f.journal.findIndex((j) => j.includes("pg_advisory_xact_lock"));
    expect(f.journal[0]).toBe("transaction");
    expect(verrou).toBe(1);
    expect(f.journal.indexOf("aggregate")).toBeGreaterThan(verrou);
    expect(f.lignes.map((l) => l.sequence)).toEqual([1n, 2n, 3n]);
  });

  it("la clé du verrou est bien celle que son commentaire dit dériver", () => {
    const attendue = createHash("sha256")
      .update("partners_sync_outbox.sequence")
      .digest()
      .readBigInt64BE(0);
    expect(CLE_VERROU_SEQUENCE).toBe(attendue);
  });

  it("continue après le maximum existant, et ne renumérote jamais une ligne déjà prise", async () => {
    const f = fauxClient();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(0));
    await numeroterEnAttente(f.client, new Date());
    const corpsFige = f.lignes[0]?.corps;
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(1));
    await numeroterEnAttente(f.client, new Date());
    expect(f.lignes.map((l) => l.sequence)).toEqual([1n, 2n]);
    expect(f.lignes[0]?.corps).toBe(corpsFige);
  });

  it("le corps finalisé est une enveloppe du contrat : neuf champs, dans l'ordre, séquence posée", async () => {
    const f = fauxClient();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(5));
    await numeroterEnAttente(f.client, new Date("2026-09-26T12:00:00.000Z"));
    const corps = f.lignes[0]?.corps ?? "";
    const env = JSON.parse(corps) as Record<string, unknown>;
    expect(Object.keys(env)).toEqual([...CHAMPS_ENVELOPPE]);
    expect(env.sequence).toBe(1);
    expect(env.schema_version).toBe(SCHEMA_VERSION);
    expect(env.emitted_at).toBe("2026-09-26T12:00:00.000Z");
    expect(env.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(env.subject_ref).toEqual(EVENEMENTS[5]?.subject_ref);
    expect(env.payload).toEqual(EVENEMENTS[5]?.payload);
    // Idempotent : finaliser un corps déjà final ne change pas un octet.
    expect(finaliserCorps(corps, 1n, new Date("2026-09-26T12:00:00.000Z"))).toBe(corps);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// (2) La signature, recalculée ici INDÉPENDAMMENT, comme le récepteur de Partners le fait.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("REQ-SEC-010 — la requête sortante est signée sur « horodatage.corps exact »", () => {
  beforeEach(ouvrirLeCanal);

  it("transmet l'octet exact stocké, sous X-Axionia-Timestamp / X-Axionia-Signature", async () => {
    const f = fauxClient();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(2));
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => reponse(200));
    const maintenant = new Date("2026-09-26T12:34:56.789Z");

    await relayer({ prisma: f.client, fetch, alerter: vi.fn(), maintenant: () => maintenant });

    const [url, init] = fetch.mock.calls[0] ?? [];
    const entetes = new Headers(init?.headers);
    const horodatage = entetes.get("x-axionia-timestamp");
    expect(url).toBe(URL_PARTNERS);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(f.lignes[0]?.corps);
    expect(horodatage).toBe(String(Math.floor(maintenant.getTime() / 1000)));
    expect(entetes.get("x-axionia-signature")).toBe(
      createHmac("sha256", SECRET).update(`${horodatage}.${f.lignes[0]?.corps}`).digest("hex"),
    );
    expect(entetes.get("content-type")).toBe("application/json");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("n'envoie rien — et ne numérote rien — tant que l'URL ou le secret manque", async () => {
    const f = fauxClient();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(0));
    delete process.env.PARTNERS_SYNC_SECRET;
    const fetch = vi.fn(async () => reponse(200));
    const bilan = await relayer({ prisma: f.client, fetch, alerter: vi.fn() });
    expect(bilan.numerotees).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(f.lignes[0]?.sequence).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// (4) Le rejeu.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("REQ-INT-009 — recul exponentiel, 8 tentatives, 10 s, 422 abandonne, 503 ne compte pas", () => {
  beforeEach(ouvrirLeCanal);

  async function uneLigneNumerotee() {
    const f = fauxClient();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(0));
    await numeroterEnAttente(f.client, new Date());
    return f;
  }

  it("les constantes sont celles de l'exigence, et le recul double", () => {
    expect(PARTNERS_SYNC_MAX_TENTATIVES).toBe(8);
    expect(PARTNERS_SYNC_DELAI_MS).toBe(10_000);
    expect(delaiAvantNouvelleTentativeMs(2)).toBe(2 * delaiAvantNouvelleTentativeMs(1));
    expect(delaiAvantNouvelleTentativeMs(3)).toBe(2 * delaiAvantNouvelleTentativeMs(2));
  });

  it("2xx → `sent`, une tentative, statut de réponse gardé", async () => {
    const f = await uneLigneNumerotee();
    const r = await envoyerLigne(f.lignes[0]!.id, {
      prisma: f.client,
      fetch: vi.fn(async () => reponse(200)),
      alerter: vi.fn(),
    });
    expect(r).toBe("sent");
    expect(f.lignes[0]).toMatchObject({ status: "sent", attempts: 1, responseStatus: 200 });
    expect(f.lignes[0]?.sentAt).toBeInstanceOf(Date);
  });

  it("422 → `gave_up` IMMÉDIAT et une alerte qui nomme l'événement", async () => {
    const f = await uneLigneNumerotee();
    const alerter = vi.fn(async () => undefined);
    const r = await envoyerLigne(f.lignes[0]!.id, {
      prisma: f.client,
      fetch: vi.fn(async () => reponse(422)),
      alerter,
    });
    expect(r).toBe("gave_up");
    expect(f.lignes[0]).toMatchObject({
      status: "gave_up",
      attempts: 1,
      responseStatus: 422,
      nextAttemptAt: null,
    });
    expect(alerter).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: f.lignes[0]?.eventId, definitif: true }),
    );
  });

  it("503 → `failed` SANS compter de tentative, et une prochaine date posée", async () => {
    const f = await uneLigneNumerotee();
    for (let i = 0; i < 20; i += 1) {
      f.lignes[0]!.nextAttemptAt = null;
      await envoyerLigne(f.lignes[0]!.id, {
        prisma: f.client,
        fetch: vi.fn(async () => reponse(503)),
        alerter: vi.fn(),
      });
    }
    expect(f.lignes[0]).toMatchObject({ status: "failed", attempts: 0, responseStatus: 503 });
    expect(f.lignes[0]?.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("une panne réseau ou un 500 comptent ; la HUITIÈME abandonne avec alerte, pas la septième", async () => {
    const f = await uneLigneNumerotee();
    const alerter = vi.fn(async () => undefined);
    const panne = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    for (let i = 1; i <= 7; i += 1) {
      await envoyerLigne(f.lignes[0]!.id, {
        prisma: f.client,
        fetch: i % 2 ? panne : vi.fn(async () => reponse(500)),
        alerter,
      });
      expect(f.lignes[0]).toMatchObject({ status: "failed", attempts: i });
    }
    expect(alerter).not.toHaveBeenCalled();
    await envoyerLigne(f.lignes[0]!.id, { prisma: f.client, fetch: panne, alerter });
    expect(f.lignes[0]).toMatchObject({ status: "gave_up", attempts: 8, nextAttemptAt: null });
    expect(alerter).toHaveBeenCalledTimes(1);
  });

  it("le balayage ne reprend pas une ligne dont l'heure n'est pas venue", async () => {
    const f = await uneLigneNumerotee();
    f.lignes[0]!.status = "failed";
    f.lignes[0]!.nextAttemptAt = new Date(Date.now() + 60_000);
    const fetch = vi.fn(async () => reponse(200));
    await relayer({ prisma: f.client, fetch, alerter: vi.fn() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("après abandon, la ligne reste visible et se REJOUE à la main par event_id — même séquence, même corps", async () => {
    const f = await uneLigneNumerotee();
    await envoyerLigne(f.lignes[0]!.id, {
      prisma: f.client,
      fetch: vi.fn(async () => reponse(422)),
      alerter: vi.fn(),
    });
    const { sequence, corps, eventId } = f.lignes[0]!;

    expect(await rejouerEvenement(eventId, f.client)).toBe("rearme");
    expect(f.lignes[0]).toMatchObject({
      status: "pending",
      attempts: 0,
      nextAttemptAt: null,
      sequence,
      corps,
    });

    const fetch = vi.fn(async (_u: string, _i: RequestInit) => reponse(200));
    await relayer({ prisma: f.client, fetch, alerter: vi.fn() });
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(corps);
    expect(f.lignes[0]?.status).toBe("sent");
    expect(await rejouerEvenement(eventId, f.client)).toBe("deja_envoye");
    expect(await rejouerEvenement("00000000-0000-4000-8000-000000000000", f.client)).toBe(
      "introuvable",
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// (5) La route de relecture.
// ══════════════════════════════════════════════════════════════════════════════════════════

describe("REQ-INT-012 — GET /api/partners/evenements?after_sequence=&limit=", () => {
  beforeEach(ouvrirLeCanal);

  const BASE = "https://axion-ia.com";

  function requeteSignee(cible: string, maintenantMs: number, secret = SECRET_RELECTURE): Request {
    const t = String(Math.floor(maintenantMs / 1000));
    return new Request(`${BASE}${cible}`, {
      headers: {
        [ENTETE_HORODATAGE_RELECTURE]: t,
        [ENTETE_SIGNATURE_RELECTURE]: createHmac("sha256", secret)
          .update(`${t}.${cible}`)
          .digest("hex"),
      },
    });
  }

  async function troisLignesNumerotees() {
    const f = fauxClient();
    for (let i = 0; i < 4; i += 1) await ecrireEvenementPartners(f.tx, faitDepuisFixture(i));
    await numeroterEnAttente(f.client, new Date());
    return f;
  }

  it("rend, dans l'ordre, les corps EXACTS au-delà de la séquence — en NDJSON signé", async () => {
    const f = await troisLignesNumerotees();
    const maintenant = Date.now();
    const cible = "/api/partners/evenements?after_sequence=1&limit=2";
    const r = await repondreRelecture(requeteSignee(cible, maintenant), {
      prisma: f.client,
      maintenantMs: maintenant,
    });

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/x-ndjson");
    expect(r.headers.get("cache-control")).toContain("no-store");
    const corps = await r.text();
    expect(corps).toBe(`${f.lignes[1]?.corps}\n${f.lignes[2]?.corps}`);
    expect(r.headers.get("x-axionia-derniere-sequence")).toBe("3");
    expect(r.headers.get("x-axionia-suite")).toBe("1");
    const t = r.headers.get("x-axionia-timestamp");
    expect(r.headers.get("x-axionia-signature")).toBe(
      createHmac("sha256", SECRET).update(`${t}.${corps}`).digest("hex"),
    );
  });

  it("ne rend JAMAIS une ligne non numérotée", async () => {
    const f = await troisLignesNumerotees();
    await ecrireEvenementPartners(f.tx, faitDepuisFixture(6));
    const maintenant = Date.now();
    const r = await repondreRelecture(
      requeteSignee("/api/partners/evenements?after_sequence=0&limit=100", maintenant),
      {
        prisma: f.client,
        maintenantMs: maintenant,
      },
    );
    const lignes = (await r.text()).split("\n");
    expect(lignes).toHaveLength(4);
    expect(r.headers.get("x-axionia-suite")).toBe("0");
  });

  it("401 sans signature, signature fausse, autre secret, ou hors de la fenêtre de 300 s — sans rien lire", async () => {
    const f = await troisLignesNumerotees();
    f.journal.length = 0;
    const maintenant = Date.now();
    const cible = "/api/partners/evenements?after_sequence=0";
    const refus = [
      new Request(`${BASE}${cible}`),
      requeteSignee(cible, maintenant, secretFrais()),
      requeteSignee(cible, maintenant - 301_000),
      requeteSignee("/api/partners/evenements?after_sequence=5", maintenant),
    ];
    // La dernière est signée sur une AUTRE cible que celle demandée.
    const detournee = new Request(`${BASE}${cible}`, { headers: refus[3]!.headers });
    for (const req of [...refus.slice(0, 3), detournee]) {
      const r = await repondreRelecture(req, { prisma: f.client, maintenantMs: maintenant });
      expect(r.status).toBe(401);
    }
    expect(f.journal).toEqual([]);

    const ok = await repondreRelecture(requeteSignee(cible, maintenant - 299_000), {
      prisma: f.client,
      maintenantMs: maintenant,
    });
    expect(ok.status).toBe(200);
  });

  it("400 sur des paramètres illisibles", async () => {
    const f = await troisLignesNumerotees();
    const maintenant = Date.now();
    for (const q of [
      "after_sequence=-1",
      "after_sequence=abc",
      "limit=0",
      "limit=501",
      "after_sequence=1.5",
    ]) {
      const r = await repondreRelecture(
        requeteSignee(`/api/partners/evenements?${q}`, maintenant),
        {
          prisma: f.client,
          maintenantMs: maintenant,
        },
      );
      expect(r.status, q).toBe(400);
    }
  });

  it("404 si le secret de relecture est absent ou trop court : la porte ne s'ouvre pas par défaut", async () => {
    const f = await troisLignesNumerotees();
    f.journal.length = 0;
    for (const valeur of [undefined, "court"]) {
      if (valeur === undefined) delete process.env.PARTNERS_RELECTURE_SECRET;
      else process.env.PARTNERS_RELECTURE_SECRET = valeur;
      const r = await repondreRelecture(requeteSignee("/api/partners/evenements", Date.now()), {
        prisma: f.client,
      });
      expect(r.status).toBe(404);
    }
    expect(f.journal).toEqual([]);
  });
});
