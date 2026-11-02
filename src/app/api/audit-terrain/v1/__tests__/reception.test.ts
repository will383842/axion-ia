// Audit présentiel PR2 : route de réception /api/audit-terrain/v1 (evenements + etat).
// Prisma est remplacé par un faux en mémoire qui imite les contraintes uniques de PR1.

import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env["PII_ENCRYPTION_KEY"] = "ab".repeat(32);
process.env["IP_HASH_SALT"] = "s".repeat(40);

/* ---------- faux Prisma ---------- */
type Ligne = Record<string, unknown>;
const base = {
  sessions: [] as Ligne[],
  evenements: [] as Ligne[],
  rapports: [] as Ligne[],
};
const p2002 = () => Object.assign(new Error("Unique constraint"), { code: "P2002" });

const evenementModele = {
  create: async ({ data }: { data: Ligne }) => {
    if (base.evenements.some((e) => e["sessionId"] === data["sessionId"] && e["eventId"] === data["eventId"])) throw p2002();
    base.evenements.push({ ...data });
    return data;
  },
  findUnique: async ({ where }: { where: { sessionId_eventId: { sessionId: string; eventId: string } } }) =>
    base.evenements.find((e) => e["sessionId"] === where.sessionId_eventId.sessionId && e["eventId"] === where.sessionId_eventId.eventId) ?? null,
  findMany: async ({ where }: { where: { sessionId: string } }) =>
    base.evenements.filter((e) => e["sessionId"] === where.sessionId).sort((a, b) => (a["seq"] as number) - (b["seq"] as number)),
};
const rapportModele = {
  aggregate: async ({ where }: { where: { sessionId: string } }) => {
    const versions = base.rapports.filter((r) => r["sessionId"] === where.sessionId).map((r) => r["version"] as number);
    return { _max: { version: versions.length ? Math.max(...versions) : null } };
  },
  create: async ({ data }: { data: Ligne }) => {
    if (base.rapports.some((r) => r["eventId"] === data["eventId"] || (r["sessionId"] === data["sessionId"] && r["version"] === data["version"]))) throw p2002();
    base.rapports.push({ ...data });
    return data;
  },
};
const prismaFaux = {
  auditTerrainSession: {
    findUnique: async ({ where }: { where: { jetonEmpreinte: string } }) =>
      base.sessions.find((s) => s["jetonEmpreinte"] === where.jetonEmpreinte) ?? null,
  },
  auditTerrainEvenement: evenementModele,
  auditTerrainRapport: rapportModele,
  $queryRaw: async (_s: TemplateStringsArray, seq: number, etape: number, id: string) => {
    const s = base.sessions.find((x) => x["id"] === id)!;
    s["dernierSeq"] = Math.max(s["dernierSeq"] as number, seq);
    s["derniereEtapeIndex"] = Math.max(s["derniereEtapeIndex"] as number, etape);
    return [{ dernier_seq: s["dernierSeq"] }];
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const copie = { e: [...base.evenements], r: [...base.rapports] };
    try {
      return await fn(prismaFaux);
    } catch (err) {
      base.evenements = copie.e;
      base.rapports = copie.r;
      throw err;
    }
  },
};
vi.mock("@/lib/prisma", () => ({ get prisma() { return prismaFaux; } }));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a) }));
const journalMock = vi.fn();
vi.mock("@/server/content-gen/shared/activity-log-writer", () => ({ ecrireJournalActivite: (...a: unknown[]) => journalMock(...a) }));
const sentryMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => sentryMock(...a) }));

import { POST } from "@/app/api/audit-terrain/v1/evenements/route";
import { GET } from "@/app/api/audit-terrain/v1/etat/route";
import { empreinteJeton } from "@/server/audit-terrain/jeton";

/* ---------- aides ---------- */
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const SECRET = "S".repeat(43);
const SID = randomUUID();
const SID_AUTRE = randomUUID();
const SECRET_AUTRE = "T".repeat(43);
const JETON = `axa_${SID}_${SECRET}`;
const dans = (ms: number) => new Date(Date.now() + ms);

function ajouterSession(id: string, secret: string, o: Ligne = {}) {
  base.sessions.push({
    id, clientId: randomUUID(), statut: "ouverte", jetonEmpreinte: empreinteJeton(secret),
    jetonExpireLe: dans(86_400_000), jetonRevoqueLe: null, dernierSeq: 0, derniereEtapeIndex: 0, ...o,
  });
}
function evenement(seq: number, o: Ligne = {}) {
  const donnees = (o["donnees"] as Ligne | undefined) ?? { pid: "p1", note: "n" + seq };
  return {
    eventId: randomUUID(), seq, type: "etape_validee", etape: "A" + seq, etapeIndex: seq, etapesTotal: 7,
    heurePC: new Date().toISOString(), donnees, empreinte: sha(JSON.stringify(donnees)), ...o,
  };
}
function lot(evs: Ligne[], o: Ligne = {}) {
  return { schema: "audit-terrain.evenements/1", sessionId: SID, outilVersion: "p1-0.1", mode: "reel", lot: evs, ...o };
}
function post(corps: unknown, jeton: string | null = JETON, h: Record<string, string> = {}) {
  const texte = typeof corps === "string" ? corps : JSON.stringify(corps);
  return POST(new Request("http://x/api/audit-terrain/v1/evenements", {
    method: "POST", body: texte,
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(texte)), ...(jeton ? { authorization: "Bearer " + jeton } : {}), ...h },
  }) as never);
}
const etat = (jeton: string | null = JETON, q = "") =>
  GET(new Request("http://x/api/audit-terrain/v1/etat" + q, { headers: jeton ? { authorization: "Bearer " + jeton } : {} }) as never);

beforeEach(() => {
  base.sessions = []; base.evenements = []; base.rapports = [];
  checkRateLimitMock.mockReset().mockResolvedValue({ allowed: true, count: 1, remaining: 59, resetAt: Date.now() + 60000, panne: false });
  journalMock.mockReset(); sentryMock.mockReset();
  ajouterSession(SID, SECRET);
  ajouterSession(SID_AUTRE, SECRET_AUTRE);
});

describe("réception : cas nominal et ordre", () => {
  it("accepte un lot, le chiffre en base et renvoie des listes d'eventId", async () => {
    const e1 = evenement(1, { donnees: { pid: "p1", texte: "TEXTE-SENSIBLE" } });
    const r = await post(lot([e1]));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ acceptes: [e1.eventId], dejaRecus: [], conflits: [], dernierSeqRecu: 1, trous: [] });
    const ligne = base.evenements[0]!;
    expect(String(ligne["donneesChiffrees"])).toMatch(/^enc:v1:/);
    expect(JSON.stringify(ligne)).not.toContain("TEXTE-SENSIBLE");
    expect(ligne["empreinte"]).not.toBe(e1.empreinte); // HMAC serveur, pas le SHA brut
  });

  it("désordre : un lot 3,1,2 est écrit dans l'ordre de seq", async () => {
    const [a, b, c] = [evenement(3), evenement(1), evenement(2)];
    const r = await post(lot([a!, b!, c!]));
    expect(r.status).toBe(200);
    expect(base.evenements.map((e) => e["seq"])).toEqual([1, 2, 3]);
    expect((await r.json()).acceptes).toEqual([b!.eventId, c!.eventId, a!.eventId]);
  });

  it("trou : seq 1 puis 4 signale 2 et 3, et /etat les redonne", async () => {
    await post(lot([evenement(1)]));
    const r = await post(lot([evenement(4)]));
    expect((await r.json()).trous).toEqual([2, 3]);
    const e = await (await etat(JETON, "?sessionId=" + SID)).json();
    expect(e).toEqual({ dernierSeqRecu: 4, nombre: 2, trous: [2, 3] });
  });
});

describe("idempotence : create seulement, jamais d'écrasement", () => {
  it("doublon : même eventId, même contenu => dejaRecus, une seule ligne", async () => {
    const e = evenement(1);
    await post(lot([e]));
    const j = await (await post(lot([e]))).json();
    expect(j.dejaRecus).toEqual([e.eventId]);
    expect(j.acceptes).toEqual([]);
    expect(base.evenements).toHaveLength(1);
  });

  it("rejeu différent : même eventId, autre contenu => conflits, valeur d'origine inchangée", async () => {
    const e = evenement(1, { donnees: { pid: "p1", v: "ORIGINE" } });
    await post(lot([e]));
    const avant = JSON.stringify(base.evenements[0]);
    const autre = { ...e, donnees: { pid: "p1", v: "MODIFIE" } };
    autre.empreinte = sha(JSON.stringify(autre.donnees));
    const j = await (await post(lot([autre]))).json();
    expect(j.conflits).toEqual([e.eventId]);
    expect(base.evenements).toHaveLength(1);
    expect(JSON.stringify(base.evenements[0])).toBe(avant);
    expect(journalMock.mock.calls.some((c) => JSON.stringify(c).includes("conflit"))).toBe(true);
  });

  it("deux fois le même eventId dans un seul lot : un accepté, un déjà reçu", async () => {
    const e = evenement(1);
    const j = await (await post(lot([e, { ...e }]))).json();
    expect(j.acceptes).toEqual([e.eventId]);
    expect(j.dejaRecus).toEqual([e.eventId]);
  });
});

describe("rapport_brouillon", () => {
  it("crée une version chiffrée, une seule fois même en cas de rejeu", async () => {
    const e = evenement(5, { type: "rapport_brouillon", donnees: { pid: "x", source: "gabarit", contenu: "RAPPORT-CLAIR" } });
    await post(lot([e]));
    await post(lot([e]));
    expect(base.rapports).toHaveLength(1);
    expect(base.rapports[0]).toMatchObject({ version: 1, source: "gabarit", statut: "a_relire" });
    expect(String(base.rapports[0]!["contenuChiffre"])).toMatch(/^enc:v1:/);
    expect(JSON.stringify(base.rapports)).not.toContain("RAPPORT-CLAIR");
  });
  it("une source inconnue est refusée (422)", async () => {
    const e = evenement(5, { type: "rapport_brouillon", donnees: { source: "autre" } });
    expect((await post(lot([e]))).status).toBe(422);
  });
});

describe("jeton", () => {
  const refus = async (r: Response) => {
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erreur: "non_autorise" });
    expect(base.evenements).toHaveLength(0);
  };
  it("absent, mal formé ou faux : 401 identique", async () => {
    await refus(await post(lot([evenement(1)]), null));
    await refus(await post(lot([evenement(1)]), "n importe quoi"));
    await refus(await post(lot([evenement(1)]), `axa_${SID}_${"Z".repeat(43)}`));
  });
  it("jeton d'un autre client/audit : 401, rien d'écrit", async () => {
    await refus(await post(lot([evenement(1)]), `axa_${SID_AUTRE}_${SECRET_AUTRE}`)); // sessionId du corps = SID
  });
  it("secret valide mais préfixe d'une autre session : 401", async () => {
    await refus(await post(lot([evenement(1)]), `axa_${SID_AUTRE}_${SECRET}`));
  });
  it("sessionId du corps différent de la ligne : 401", async () => {
    await refus(await post(lot([evenement(1)], { sessionId: SID_AUTRE })));
  });
  it("révoqué : 401", async () => {
    base.sessions[0]!["jetonRevoqueLe"] = new Date(); base.sessions[0]!["statut"] = "revoquee";
    await refus(await post(lot([evenement(1)])));
  });
  it("expiré : 401", async () => {
    base.sessions[0]!["jetonExpireLe"] = dans(-1000);
    await refus(await post(lot([evenement(1)])));
  });
  it("statut non ouverte : 401", async () => {
    base.sessions[0]!["statut"] = "close";
    await refus(await post(lot([evenement(1)])));
  });
  it("/etat : mêmes refus", async () => {
    expect((await etat(`axa_${SID_AUTRE}_${SECRET}`)).status).toBe(401);
    expect((await etat(JETON, "?sessionId=" + SID_AUTRE)).status).toBe(401);
    expect((await etat(null)).status).toBe(401);
  });
});

describe("validation et limites", () => {
  it("mode test : 403 explicite, rien d'écrit", async () => {
    const r = await post(lot([evenement(1)], { mode: "test" }));
    expect(r.status).toBe(403);
    expect(base.evenements).toHaveLength(0);
  });
  it("champ inconnu (zod strict) : 422", async () => {
    expect((await post(lot([{ ...evenement(1), surprise: 1 }]))).status).toBe(422);
    expect((await post({ ...lot([evenement(1)]), extra: 1 })).status).toBe(422);
  });
  it("empreinte fausse : 422, aucun message de validation renvoyé", async () => {
    const e = { ...evenement(1), empreinte: "0".repeat(64) };
    const r = await post(lot([e]));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erreur: "schema" });
    expect(base.evenements).toHaveLength(0);
  });
  it("lot de 51 événements : 422", async () => {
    expect((await post(lot(Array.from({ length: 51 }, (_, i) => evenement(i + 1))))).status).toBe(422);
  });
  it("donnees de plus de 64 Ko : 422", async () => {
    const e = evenement(1, { donnees: { pid: "p", gros: "x".repeat(65 * 1024) } });
    expect((await post(lot([e]))).status).toBe(422);
  });
  it("corps de plus de 512 Ko déclaré : 413", async () => {
    const r = await post(lot([evenement(1)]), JETON, { "content-length": String(513 * 1024) });
    expect(r.status).toBe(413);
  });
  it("corps de plus de 512 Ko réel, sans Content-Length : 413", async () => {
    const gros = JSON.stringify(lot([evenement(1)])) + " ".repeat(513 * 1024);
    const r = await POST(new Request("http://x/api/audit-terrain/v1/evenements", {
      method: "POST", body: gros, headers: { authorization: "Bearer " + JETON },
    }) as never);
    expect(r.status).toBe(413);
  });
  it("JSON invalide : 422", async () => {
    expect((await post("{pas du json")).status).toBe(422);
  });
});

describe("limitation de débit", () => {
  it("429 avec Retry-After quand la limite est atteinte", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, count: 61, remaining: 0, resetAt: Date.now() + 30000, panne: false });
    const r = await post(lot([evenement(1)]));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(base.evenements).toHaveLength(0);
  });
  it("Redis en panne : on refuse (503), le PC réessaiera", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, count: 0, remaining: 0, resetAt: Date.now() + 60000, panne: true });
    const r = await post(lot([evenement(1)]));
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toBeTruthy();
  });
  it("les deux clés sont en mode refus et ne contiennent ni le jeton ni l'IP en clair", async () => {
    await post(lot([evenement(1)]), JETON, { "x-real-ip": "203.0.113.9" });
    const appels = checkRateLimitMock.mock.calls;
    expect(appels.length).toBeGreaterThanOrEqual(2);
    for (const [cle, cfg] of appels) {
      expect(cfg).toMatchObject({ limit: 60, windowSec: 60, surPanne: "refuser" });
      expect(String(cle)).not.toContain(SECRET);
      expect(String(cle)).not.toContain("203.0.113.9");
    }
  });
});

describe("journal et fuites", () => {
  it("le journal d'accès ne contient ni contenu, ni jeton", async () => {
    await post(lot([evenement(1, { donnees: { pid: "p", texte: "TEXTE-SENSIBLE" } })]));
    const tout = JSON.stringify(journalMock.mock.calls);
    expect(journalMock).toHaveBeenCalled();
    expect(tout).not.toContain("TEXTE-SENSIBLE");
    expect(tout).not.toContain(SECRET);
  });
  it("une erreur interne renvoie 500 sans détail et n'envoie à Sentry ni corps ni jeton", async () => {
    const c = vi.spyOn(prismaFaux.auditTerrainEvenement, "create").mockRejectedValue(new Error("boom TEXTE-SENSIBLE " + SECRET));
    const r = await post(lot([evenement(1)]));
    c.mockRestore();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ erreur: "interne" });
    expect(JSON.stringify(sentryMock.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(sentryMock.mock.calls)).not.toContain("TEXTE-SENSIBLE");
  });
});
