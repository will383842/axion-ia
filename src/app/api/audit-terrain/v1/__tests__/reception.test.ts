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
const requetesSql: string[] = [];
const bornesSerie: number[] = [];
const p2002 = () => Object.assign(new Error("Unique constraint"), { code: "P2002" });

const evenementModele = {
  create: async ({ data }: { data: Ligne }) => {
    if (
      base.evenements.some(
        (e) => e["sessionId"] === data["sessionId"] && e["eventId"] === data["eventId"],
      )
    )
      throw p2002();
    base.evenements.push({ ...data });
    return data;
  },
  findUnique: async ({
    where,
  }: {
    where: { sessionId_eventId: { sessionId: string; eventId: string } };
  }) =>
    base.evenements.find(
      (e) =>
        e["sessionId"] === where.sessionId_eventId.sessionId &&
        e["eventId"] === where.sessionId_eventId.eventId,
    ) ?? null,
  count: async ({ where }: { where: { sessionId: string } }) =>
    base.evenements.filter((e) => e["sessionId"] === where.sessionId).length,
};
const rapportModele = {
  aggregate: async ({ where }: { where: { sessionId: string } }) => {
    const versions = base.rapports
      .filter((r) => r["sessionId"] === where.sessionId)
      .map((r) => r["version"] as number);
    return { _max: { version: versions.length ? Math.max(...versions) : null } };
  },
  create: async ({ data }: { data: Ligne }) => {
    if (
      base.rapports.some(
        (r) =>
          r["eventId"] === data["eventId"] ||
          (r["sessionId"] === data["sessionId"] && r["version"] === data["version"]),
      )
    )
      throw p2002();
    base.rapports.push({ ...data });
    return data;
  },
};
const prismaFaux = {
  auditTerrainSession: {
    findUnique: async ({ where }: { where: { jetonEmpreinte?: string; id?: string } }) =>
      base.sessions.find((s) =>
        where.id !== undefined
          ? s["id"] === where.id
          : s["jetonEmpreinte"] === where.jetonEmpreinte,
      ) ?? null,
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; jetonEmpreinte: string };
      data: Ligne;
    }) => {
      const s = base.sessions.find(
        (x) => x["id"] === where.id && x["jetonEmpreinte"] === where.jetonEmpreinte,
      );
      if (s) Object.assign(s, data);
      return { count: s ? 1 : 0 };
    },
  },
  $executeRaw: async (strings: TemplateStringsArray, ...v: unknown[]) => {
    requetesSql.push(strings.join("?") + "|" + v.join(","));
    return 1;
  },
  auditTerrainEvenement: evenementModele,
  auditTerrainRapport: rapportModele,
  // Le faux lit le TEXTE de la requête : sans GREATEST dans le SQL, la valeur recule (la mutation rougit).
  $queryRaw: async (strings: TemplateStringsArray, ...v: unknown[]) => {
    const texte = strings.join("?");
    requetesSql.push(texte);
    if (texte.includes("UPDATE audit_terrain_sessions")) {
      const [seq, etape, id] = v as [number, number, string];
      const s = base.sessions.find((x) => x["id"] === id)!;
      const garde = texte.includes("GREATEST(dernier_seq");
      s["dernierSeq"] = garde ? Math.max(s["dernierSeq"] as number, seq) : seq;
      s["derniereEtapeIndex"] = texte.includes("GREATEST(derniere_etape_index")
        ? Math.max(s["derniereEtapeIndex"] as number, etape)
        : etape;
      return [{ dernier_seq: s["dernierSeq"] }];
    }
    if (texte.includes("MAX(seq)")) {
      const l = base.evenements
        .filter((e) => e["sessionId"] === v[0])
        .map((e) => e["seq"] as number);
      return [{ dernier: l.length ? Math.max(...l) : 0, nombre: l.length }];
    }
    if (texte.includes("generate_series")) {
      const [dernier, sid, limite] = v as [number, string, number];
      bornesSerie.push(dernier);
      const vus = new Set(
        base.evenements.filter((e) => e["sessionId"] === sid).map((e) => e["seq"] as number),
      );
      const trous: { seq: number }[] = [];
      for (let g = 1; g <= dernier && trous.length < limite; g++)
        if (!vus.has(g)) trous.push({ seq: g });
      return trous;
    }
    throw new Error("requête SQL inattendue");
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
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaFaux;
  },
}));

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimitMock(...a),
}));
const journalMock = vi.fn();
vi.mock("@/server/content-gen/shared/activity-log-writer", () => ({
  ecrireJournalActivite: (...a: unknown[]) => journalMock(...a),
}));
const sentryMock = vi.fn();
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => sentryMock(...a) }));

import { POST } from "@/app/api/audit-terrain/v1/evenements/route";
import { GET } from "@/app/api/audit-terrain/v1/etat/route";
import { empreinteJeton } from "@/server/audit-terrain/jeton";
import { regenererJetonAudit } from "@/features/admin-audit-terrain/actions";

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
    id,
    clientId: randomUUID(),
    statut: "ouverte",
    jetonEmpreinte: empreinteJeton(secret),
    jetonExpireLe: dans(86_400_000),
    jetonRevoqueLe: null,
    dernierSeq: 0,
    derniereEtapeIndex: 0,
    ...o,
  });
}
function evenement(seq: number, o: Ligne = {}) {
  const donnees = (o["donnees"] as Ligne | undefined) ?? { pid: "p1", note: "n" + seq };
  return {
    eventId: randomUUID(),
    seq,
    type: "etape_validee",
    etape: "A" + seq,
    etapeIndex: seq % 8,
    etapesTotal: 7,
    heurePC: new Date().toISOString(),
    donnees,
    empreinte: sha(JSON.stringify(donnees)),
    ...o,
  };
}
function lot(evs: Ligne[], o: Ligne = {}) {
  return {
    schema: "audit-terrain.evenements/1",
    sessionId: SID,
    outilVersion: "p1-0.1",
    mode: "reel",
    lot: evs,
    ...o,
  };
}
function post(corps: unknown, jeton: string | null = JETON, h: Record<string, string> = {}) {
  const texte = typeof corps === "string" ? corps : JSON.stringify(corps);
  return POST(
    new Request("http://x/api/audit-terrain/v1/evenements", {
      method: "POST",
      body: texte,
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(texte)),
        "x-real-ip": "203.0.113.5",
        ...(jeton ? { authorization: "Bearer " + jeton } : {}),
        ...h,
      },
    }) as never,
  );
}
const etat = (jeton: string | null = JETON, q = "") =>
  GET(
    new Request("http://x/api/audit-terrain/v1/etat" + q, {
      headers: {
        "x-real-ip": "203.0.113.5",
        ...(jeton ? { authorization: "Bearer " + jeton } : {}),
      },
    }) as never,
  );

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ user: { id: randomUUID(), role: "super_admin" } });
  base.sessions = [];
  base.evenements = [];
  base.rapports = [];
  requetesSql.length = 0;
  bornesSerie.length = 0;
  checkRateLimitMock.mockReset().mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60000,
    panne: false,
  });
  journalMock.mockReset();
  sentryMock.mockReset();
  ajouterSession(SID, SECRET);
  ajouterSession(SID_AUTRE, SECRET_AUTRE);
});

describe("réception : cas nominal et ordre", () => {
  it("accepte un lot, le chiffre en base et renvoie des listes d'eventId", async () => {
    const e1 = evenement(1, { donnees: { pid: "p1", texte: "TEXTE-SENSIBLE" } });
    const r = await post(lot([e1]));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({
      acceptes: [e1.eventId],
      dejaRecus: [],
      conflits: [],
      dernierSeqRecu: 1,
      trous: [],
    });
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

describe("dernierSeq ne recule jamais (UPDATE avec GREATEST)", () => {
  it("la requête contient GREATEST et un lot plus ancien ne fait pas reculer la session", async () => {
    await post(lot([evenement(5)]));
    expect(base.sessions[0]!["dernierSeq"]).toBe(5);
    await post(lot([evenement(3), evenement(2)]));
    expect(base.sessions[0]!["dernierSeq"]).toBe(5);
    expect(requetesSql.some((t) => t.includes("GREATEST(dernier_seq"))).toBe(true);
    expect(requetesSql.some((t) => t.includes("GREATEST(derniere_etape_index"))).toBe(true);
  });
});

describe("seq bornée : aucune série géante côté base", () => {
  it("un seq démesuré est refusé en 422 et rien n'est écrit", async () => {
    expect((await post(lot([evenement(1, { seq: 2_000_000_000 })]))).status).toBe(422);
    expect((await post(lot([evenement(1, { seq: 10_001 })]))).status).toBe(422);
    expect(base.evenements).toHaveLength(0);
    expect((await post(lot([evenement(1, { seq: 10_000 })]))).status).toBe(200);
  });
  it("même avec une ligne existante à seq énorme, la série générée reste bornée à nombre + 200", async () => {
    base.evenements.push({ sessionId: SID, eventId: randomUUID(), seq: 2_000_000_000 });
    const r = await etat();
    expect(r.status).toBe(200);
    expect(bornesSerie.length).toBeGreaterThan(0);
    for (const b of bornesSerie) expect(b).toBeLessThanOrEqual(1 + 200);
    expect((await r.json()).trous).toHaveLength(200);
  });
});

describe("plafond de session sous verrou", () => {
  it("le verrou consultatif de la session est pris et le plafond recompté dans la transaction", async () => {
    // Pré-contrôle à 4 999, puis 5 000 dans la transaction (un autre lot est passé entre les deux).
    const c = vi
      .spyOn(prismaFaux.auditTerrainEvenement, "count")
      .mockResolvedValueOnce(4999)
      .mockResolvedValue(5000);
    const e = evenement(1);
    const j = await (await post(lot([e]))).json();
    c.mockRestore();
    expect(requetesSql.some((t) => t.includes("pg_advisory_xact_lock") && t.includes(SID))).toBe(
      true,
    );
    expect(j.rejetes).toEqual([{ eventId: e.eventId, motif: "limite_session" }]);
    expect(base.evenements).toHaveLength(0);
  });
});

describe("rotation du jeton (régénérer)", () => {
  it("nouveau jeton : l'ancien est refusé, les données restent, le nouveau passe", async () => {
    const e1 = evenement(1);
    await post(lot([e1]));
    const r = await regenererJetonAudit({ sessionId: SID });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sessionId).toBe(SID);
    expect((await post(lot([evenement(2)]))).status).toBe(401); // ancien jeton
    expect(base.evenements).toHaveLength(1);
    const j = await (await post(lot([evenement(2)]), r.jeton)).json();
    expect(j.acceptes).toHaveLength(1);
    expect(base.evenements).toHaveLength(2);
  });
  it("le PC renvoie tout depuis le début avec le nouveau jeton : déjà reçu, aucun doublon", async () => {
    const evs = [evenement(1), evenement(2), evenement(3)];
    await post(lot(evs));
    const r = await regenererJetonAudit({ sessionId: SID, joursValidite: 5 });
    if (!r.ok) throw new Error("rotation");
    const j = await (await post(lot(evs), r.jeton)).json();
    expect(j.dejaRecus).toEqual(evs.map((x) => x.eventId));
    expect(j.acceptes).toEqual([]);
    expect(base.evenements).toHaveLength(3);
    const jours = (new Date(r.expireLe).getTime() - Date.now()) / 86_400_000;
    expect(jours).toBeGreaterThan(4.99);
  });
  it("rouvre une session révoquée (jeton perdu puis révoqué) ; une session close n'est pas rouverte", async () => {
    base.sessions[0]!["statut"] = "revoquee";
    base.sessions[0]!["jetonRevoqueLe"] = new Date();
    const r = await regenererJetonAudit({ sessionId: SID });
    expect(r.ok).toBe(true);
    expect(base.sessions[0]).toMatchObject({ statut: "ouverte", jetonRevoqueLe: null });
    base.sessions[0]!["statut"] = "close";
    expect(await regenererJetonAudit({ sessionId: SID })).toEqual({
      ok: false,
      erreur: "invalide",
    });
  });
  it("le nouveau jeton d'une session ne passe pas sur une autre session", async () => {
    const r = await regenererJetonAudit({ sessionId: SID });
    if (!r.ok) throw new Error("rotation");
    const j = await post(lot([evenement(1)], { sessionId: SID_AUTRE }), r.jeton);
    expect(j.status).toBe(401);
    expect(base.evenements).toHaveLength(0);
  });
  it("réservée au super_admin", async () => {
    authMock.mockResolvedValue({ user: { id: randomUUID(), role: "admin" } });
    expect(await regenererJetonAudit({ sessionId: SID })).toEqual({
      ok: false,
      erreur: "interdit",
    });
  });
});

describe("rapport_brouillon", () => {
  it("crée une version chiffrée, une seule fois même en cas de rejeu", async () => {
    const e = evenement(5, {
      type: "rapport_brouillon",
      donnees: { pid: "x", source: "gabarit", contenu: "RAPPORT-CLAIR" },
    });
    await post(lot([e]));
    await post(lot([e]));
    expect(base.rapports).toHaveLength(1);
    expect(base.rapports[0]).toMatchObject({ version: 1, source: "gabarit", statut: "a_relire" });
    expect(String(base.rapports[0]!["contenuChiffre"])).toMatch(/^enc:v1:/);
    expect(JSON.stringify(base.rapports)).not.toContain("RAPPORT-CLAIR");
  });
  it("une source inconnue rejette cet événement seul (rejetes), les autres passent", async () => {
    const e = evenement(5, { type: "rapport_brouillon", donnees: { source: "autre" } });
    const ok = evenement(6);
    const r = await post(lot([e, ok]));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.rejetes).toEqual([{ eventId: e.eventId, motif: "source_inconnue" }]);
    expect(j.acceptes).toEqual([ok.eventId]);
    expect(base.rapports).toHaveLength(0);
  });
  it("même eventId de rapport dans une autre session : conflit propre, rien d'écrit (event_id unique pour toute la table)", async () => {
    const e = evenement(5, {
      type: "rapport_brouillon",
      donnees: { source: "gabarit", contenu: "x" },
    });
    await post(lot([e]));
    const r = await post(lot([e], { sessionId: SID_AUTRE }), `axa_${SID_AUTRE}_${SECRET_AUTRE}`);
    expect(r.status).toBe(200);
    expect((await r.json()).conflits).toEqual([e.eventId]);
    expect(base.rapports).toHaveLength(1);
    expect(base.evenements.filter((x) => x["sessionId"] === SID_AUTRE)).toHaveLength(0);
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
    base.sessions[0]!["jetonRevoqueLe"] = new Date();
    base.sessions[0]!["statut"] = "revoquee";
    await refus(await post(lot([evenement(1)])));
  });
  it("révoqué par la date seule (statut resté ouverte) : 401 grâce au contrôle de révocation", async () => {
    base.sessions[0]!["jetonRevoqueLe"] = new Date();
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
  it("lot de 50 événements valides : accepté ; 51 événements valides : 422", async () => {
    const valides = (n: number) => Array.from({ length: n }, (_, i) => evenement(i + 1));
    expect((await post(lot(valides(50)))).status).toBe(200);
    base.evenements = [];
    const r = await post(lot(valides(51)));
    expect(r.status).toBe(422);
    expect(base.evenements).toHaveLength(0);
  });
  it("donnees > 64 Ko : cet événement seul est rejeté (trop_gros), les autres du lot sont acceptés", async () => {
    const gros = evenement(1, { donnees: { pid: "p", gros: "x".repeat(65 * 1024) } });
    const ok = evenement(2);
    const r = await post(lot([gros, ok]));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.rejetes).toEqual([{ eventId: gros.eventId, motif: "trop_gros" }]);
    expect(j.acceptes).toEqual([ok.eventId]);
  });
  it("64 Ko comptés en OCTETS : 40 000 caractères accentués ou emoji (moins de 64 000 caractères) sont rejetés", async () => {
    const accents = evenement(1, { donnees: { pid: "p", t: "\u00e9".repeat(40_000) } }); // 80 000 octets, 40 000 caractères
    const emoji = evenement(2, { donnees: { pid: "p", t: "\u{1F600}".repeat(20_000) } }); // 80 000 octets, 40 000 unités
    const j = await (await post(lot([accents, emoji]))).json();
    expect(j.rejetes.map((r: { eventId: string }) => r.eventId)).toEqual([
      accents.eventId,
      emoji.eventId,
    ]);
    expect(j.acceptes).toEqual([]);
  });
  it("plafond de 5 000 événements par session : 409 sans détail", async () => {
    for (let i = 0; i < 5000; i++)
      base.evenements.push({ sessionId: SID, eventId: randomUUID(), seq: i + 1 });
    const r = await post(lot([evenement(5001)]));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erreur: "limite_session" });
  });
  it("sans IP exploitable : refus explicite 403", async () => {
    const texte = JSON.stringify(lot([evenement(1)]));
    const r = await POST(
      new Request("http://x/api/audit-terrain/v1/evenements", {
        method: "POST",
        body: texte,
        headers: { authorization: "Bearer " + JETON },
      }) as never,
    );
    expect(r.status).toBe(403);
    expect(base.evenements).toHaveLength(0);
  });
  it("corps de plus de 512 Ko déclaré : 413", async () => {
    const r = await post(lot([evenement(1)]), JETON, { "content-length": String(513 * 1024) });
    expect(r.status).toBe(413);
  });
  it("corps de plus de 512 Ko réel, sans Content-Length : 413", async () => {
    const gros = JSON.stringify(lot([evenement(1)])) + " ".repeat(513 * 1024);
    const r = await POST(
      new Request("http://x/api/audit-terrain/v1/evenements", {
        method: "POST",
        body: gros,
        headers: { authorization: "Bearer " + JETON, "x-real-ip": "203.0.113.5" },
      }) as never,
    );
    expect(r.status).toBe(413);
  });
  it("JSON invalide : 422", async () => {
    expect((await post("{pas du json")).status).toBe(422);
  });
});

describe("limitation de débit", () => {
  it("429 avec Retry-After quand la limite est atteinte", async () => {
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      count: 61,
      remaining: 0,
      resetAt: Date.now() + 30000,
      panne: false,
    });
    const r = await post(lot([evenement(1)]));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(base.evenements).toHaveLength(0);
  });
  it("Redis en panne : on refuse (503), le PC réessaiera", async () => {
    checkRateLimitMock.mockResolvedValue({
      allowed: false,
      count: 0,
      remaining: 0,
      resetAt: Date.now() + 60000,
      panne: true,
    });
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
  it("un 401 n'est journalisé qu'au premier refus de la fenêtre", async () => {
    const vus = new Set<string>();
    checkRateLimitMock.mockImplementation(async (cle: string) => {
      const premier = !vus.has(cle);
      vus.add(cle);
      return {
        allowed: cle.startsWith("audit-terrain:refus:") ? premier : true,
        count: 1,
        remaining: 1,
        resetAt: Date.now() + 60000,
        panne: false,
      };
    });
    for (let i = 0; i < 3; i++) await post(lot([evenement(1)]), `axa_${SID}_${"Z".repeat(43)}`);
    expect(journalMock).toHaveBeenCalledTimes(1);
  });
  it("le journal d'accès ne contient ni contenu, ni jeton", async () => {
    await post(lot([evenement(1, { donnees: { pid: "p", texte: "TEXTE-SENSIBLE" } })]));
    const tout = JSON.stringify(journalMock.mock.calls);
    expect(journalMock).toHaveBeenCalled();
    expect(tout).not.toContain("TEXTE-SENSIBLE");
    expect(tout).not.toContain(SECRET);
  });
  it("une erreur interne renvoie 500 sans détail et n'envoie à Sentry ni corps ni jeton", async () => {
    const c = vi
      .spyOn(prismaFaux.auditTerrainEvenement, "create")
      .mockRejectedValue(new Error("boom TEXTE-SENSIBLE " + SECRET));
    const r = await post(lot([evenement(1)]));
    c.mockRestore();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ erreur: "interne" });
    expect(JSON.stringify(sentryMock.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(sentryMock.mock.calls)).not.toContain("TEXTE-SENSIBLE");
  });
});
