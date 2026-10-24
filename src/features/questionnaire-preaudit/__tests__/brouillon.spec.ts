// @vitest-environment node
/**
 * Brouillon du questionnaire de pré-audit (2026-10-24) — le VRAI `brouillon.ts`, `serveur.ts` et
 * les deux routes (brouillon + réponses), sur une base en mémoire (seuls Prisma et le limiteur
 * sont remplacés). Couvre : relu octet pour octet, consentement exigé, code personnel du dirigeant
 * (un salarié avec le lien de base ne lit rien), vieil onglet refusé, 400 000 octets, 30 brouillons
 * au plus, jeton faux, suppression à l'envoi (horloges décalées), aucune purge automatique,
 * chiffrement, débit, CORS, essai.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const base = vi.hoisted(() => ({
  q: [] as Ligne[],
  e: [] as Ligne[],
  b: [] as Ligne[],
  seq: 0,
  limite: vi.fn(),
}));

function vaut(l: Ligne, k: string, v: unknown): boolean {
  if (v !== null && typeof v === "object" && !(v instanceof Date)) {
    const op = v as { lt?: Date; gte?: Date; in?: unknown[] };
    if (op.lt !== undefined) return (l[k] as Date) < op.lt;
    if (op.gte !== undefined) return (l[k] as Date) >= op.gte;
    if (op.in !== undefined) return op.in.includes(l[k]);
    return false;
  }
  return l[k] === v;
}
const correspond = (l: Ligne, w: Ligne) => Object.entries(w).every(([k, v]) => vaut(l, k, v));
const cleB = (w: Ligne) => w["questionnaireId_mode_membre"] as Ligne;

vi.mock("@/lib/prisma", () => {
  const client = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    $queryRaw: async (_s: unknown, id: string) => base.q.filter((x) => x["id"] === id),
    questionnaireAvantAudit: {
      findUnique: async ({ where }: { where: Ligne }) => {
        const l = base.q.find((x) => correspond(x, where));
        return l === undefined ? null : { ...l };
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = base.q.find((x) => correspond(x, where)) as Ligne;
        Object.assign(l, data);
        return l;
      },
    },
    questionnaireAvantAuditEnvoi: {
      count: async ({ where }: { where: Ligne }) =>
        base.e.filter((x) => correspond(x, where)).length,
      findMany: async ({ where }: { where: Ligne }) =>
        base.e.filter((x) => correspond(x, where)).map((x) => ({ ...x })),
      create: async ({ data }: { data: Ligne }) => {
        base.e.push({ id: String(++base.seq), recuLe: new Date(), ...data });
      },
    },
    questionnaireAvantAuditBrouillon: {
      findUnique: async ({ where }: { where: Ligne }) => {
        const l = base.b.find((x) => correspond(x, cleB(where)));
        return l === undefined ? null : { ...l };
      },
      count: async ({ where }: { where: Ligne }) =>
        base.b.filter((x) => correspond(x, where)).length,
      upsert: async ({ where, create, update }: { where: Ligne; create: Ligne; update: Ligne }) => {
        const l = base.b.find((x) => correspond(x, cleB(where)));
        if (l === undefined) base.b.push({ id: String(++base.seq), ...create });
        else Object.assign(l, update);
      },
      deleteMany: async ({ where }: { where: Ligne }) => {
        const avant = base.b.length;
        base.b = base.b.filter((x) => !correspond(x, where));
        return { count: avant - base.b.length };
      },
    },
  };
  return { prisma: client };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: base.limite }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class MessagePourWill extends Error {},
}));
/** Le réel est refusé tant que la purge des RÉPONSES n'est pas planifiée : on simule la PR qui la planifie. */
vi.mock("../config", async (orig) => {
  const m = await orig<typeof import("../config")>();
  return {
    ...m,
    refusReel: (env?: Record<string, string | undefined>) => m.refusReel(env, true),
  };
});

import * as routeBrouillon from "@/app/api/questionnaire-preaudit/[id]/[jeton]/brouillon/route";
import { POST as postReponse } from "@/app/api/questionnaire-preaudit/[id]/[jeton]/route";
import { codeDirigeantPreaudit, jetonPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";
import {
  BROUILLON_INACTIF_JOURS,
  BROUILLONS_MAX_PAR_QUESTIONNAIRE,
  purgerBrouillonsInactifs,
  validerBrouillon,
} from "../brouillon";
import { CHARGE_MAX_OCTETS } from "../donnees";
import { urlPreaudit } from "../serveur";

const ENV0 = { ...process.env };
const REEL = {
  QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
  QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT: "contact@axion-ia.com",
  QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION: "3 ans",
};
const SECRET = "SECRET-DU-BROUILLON é € 🙂";
/** Code d'un lien de collaborateur (la page en tire 12 hexadécimaux). */
const CODE = "a1b2c3d4e5f6";
const JOUR = 86_400_000;

function questionnaire(extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `00000000-0000-4000-8000-${String(++base.seq).padStart(12, "0")}`,
    rencontreId: "11111111-1111-4111-8111-111111111111",
    ref: "refpreaudit1",
    envoyeLe: new Date(),
    luLe: null,
    closLe: null,
    expireLe: new Date(Date.now() + JOUR),
    ...extra,
  };
  base.q.push(l);
  return l;
}
const dir = (q: Ligne) => codeDirigeantPreaudit(q["id"] as string) as string;
const ctx = (q: Ligne, jeton?: string) => ({
  params: Promise.resolve({
    id: q["id"] as string,
    jeton: jeton ?? jetonPreaudit(q["id"] as string) ?? "",
  }),
});
/** Corps d'un enregistrement du DIRIGEANT (son code), sauf surcharge. */
const corps = (q: Ligne, extra: Ligne = {}) =>
  JSON.stringify({
    consent: true,
    horodatage: Date.now(),
    mode: "main",
    membre: dir(q),
    brouillon: JSON.stringify({ data: { ent_nom: SECRET }, view: 3 }),
    ...extra,
  });
const enregistrer = (q: Ligne, c: string, qs = "", jeton?: string) =>
  routeBrouillon.POST(
    new Request(`http://localhost/api/b${qs}`, { method: "POST", body: c }),
    ctx(q, jeton),
  );
const relire = (q: Ligne, qs?: string, jeton?: string) =>
  routeBrouillon.GET(
    new Request(`http://localhost/api/b${qs ?? `?mode=main&m=${dir(q)}`}`),
    ctx(q, jeton),
  );
const supprimer = (q: Ligne, qs: string, jeton?: string) =>
  routeBrouillon.DELETE(new Request(`http://localhost/api/b${qs}`), ctx(q, jeton));
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;

beforeEach(() => {
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64), ...REEL };
  base.q = [];
  base.e = [];
  base.b = [];
  vi.clearAllMocks();
  base.limite.mockResolvedValue({ allowed: true });
});

describe("le brouillon est gardé et rendu", () => {
  it("enregistré puis relu IDENTIQUE, octet pour octet (accents, emoji)", async () => {
    const q = questionnaire();
    const brouillon = JSON.stringify({ data: { ent_nom: SECRET, x: 'a\u0000\n"b' } });
    expect((await enregistrer(q, corps(q, { brouillon }))).status).toBe(200);
    const lu = await json(await relire(q));
    expect(lu["brouillon"]).toBe(brouillon);
    expect(
      Buffer.from(lu["brouillon"] as string, "utf8").equals(Buffer.from(brouillon, "utf8")),
    ).toBe(true);
  });

  it("CHIFFRÉ : la valeur stockée ne contient pas le texte clair", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q));
    expect(base.b).toHaveLength(1);
    const stocke = base.b[0]?.["donnees"] as string;
    expect(stocke.startsWith("enc:v1:")).toBe(true);
    expect(stocke).not.toContain("SECRET-DU-BROUILLON");
    expect(stocke).not.toContain("ent_nom");
  });

  it("sans brouillon : 200 avec `brouillon: null`", async () => {
    const q = questionnaire();
    expect(await json(await relire(q))).toEqual({ ok: true, brouillon: null, horodatage: null });
  });

  it("le lien envoyé au dirigeant porte SON code ; le lien de base n'en porte pas", () => {
    const q = questionnaire();
    const url = urlPreaudit(q["id"] as string) as string;
    expect(new URL(url).searchParams.get("m")).toBe(dir(q));
    expect(dir(q)).toHaveLength(24);
    // Le code ne se déduit ni de l'identifiant ni du jeton.
    expect(dir(q)).not.toBe(jetonPreaudit(q["id"] as string)?.slice(0, 24));
  });
});

describe("⛔ fuite : un collaborateur ne lit pas le brouillon du dirigeant", () => {
  it("lien de base (sans `m`) : 400 code_personnel_requis, rien de rendu ni d'écrit", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q, { brouillon: "brouillon-du-dirigeant" }));
    const g = await relire(q, "?mode=main");
    expect(g.status).toBe(400);
    expect(await json(g)).toEqual({ ok: false, motif: "code_personnel_requis" });
    const e = await enregistrer(q, corps(q, { membre: undefined, brouillon: "ecrase" }));
    expect(e.status).toBe(400);
    expect((await json(e))["motif"]).toBe("code_personnel_requis");
    expect((await supprimer(q, "?mode=main")).status).toBe(400);
    expect(base.b).toHaveLength(1);
  });

  it("parcours dirigeant avec un AUTRE code (le sien de collaborateur, ou inventé) : 400", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q, { brouillon: "brouillon-du-dirigeant" }));
    for (const m of [CODE, "dirigeant", "x".repeat(24), dir(questionnaire())]) {
      const g = await relire(q, `?mode=main&m=${m}`);
      expect(g.status).toBe(400);
      expect(JSON.stringify(await json(g))).not.toContain("brouillon-du-dirigeant");
    }
  });

  it("un collaborateur ne voit que le sien ; deux collaborateurs ne se voient pas", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q, { brouillon: "du-dirigeant" }));
    await enregistrer(q, corps(q, { mode: "emp", membre: CODE, brouillon: "du-salarie" }));
    expect((await json(await relire(q)))["brouillon"]).toBe("du-dirigeant");
    expect((await json(await relire(q, `?mode=emp&m=${CODE}`)))["brouillon"]).toBe("du-salarie");
    expect((await json(await relire(q, "?mode=emp&m=autrecode123")))["brouillon"]).toBeNull();
  });

  it("collaborateur sans code, ou code devinable : refusé (400)", async () => {
    const q = questionnaire();
    const r = await enregistrer(q, corps(q, { mode: "emp", membre: undefined }));
    expect(r.status).toBe(400);
    expect((await json(r))["motif"]).toBe("code_personnel_requis");
    expect((await relire(q, "?mode=emp")).status).toBe(400);
    expect((await relire(q, "?mode=emp&m=dirigeant")).status).toBe(400);
    expect(base.b).toHaveLength(0);
  });
});

describe("rien sans accord, rien d'un vieil onglet", () => {
  it("sans `consent: true` : 400 et rien d'écrit", async () => {
    const q = questionnaire();
    for (const consent of [undefined, false, "true", 1]) {
      const r = await enregistrer(q, corps(q, { consent }));
      expect(r.status).toBe(400);
      expect((await json(r))["motif"]).toBe("consentement_requis");
    }
    expect(base.b).toHaveLength(0);
  });

  it("un enregistrement PLUS ANCIEN que celui gardé est refusé (409), le récent reste", async () => {
    const q = questionnaire();
    const t = Date.now();
    await enregistrer(q, corps(q, { horodatage: t, brouillon: "recent" }));
    const r = await enregistrer(q, corps(q, { horodatage: t - 5_000, brouillon: "vieil-onglet" }));
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ ok: false, motif: "plus_ancien", horodatage: t });
    expect((await json(await relire(q)))["brouillon"]).toBe("recent");
    const plus = await enregistrer(q, corps(q, { horodatage: t + 1, brouillon: "plus-recent" }));
    expect(plus.status).toBe(200);
    expect((await json(await relire(q)))["brouillon"]).toBe("plus-recent");
    expect(base.b).toHaveLength(1);
  });

  it("horodatage absent, négatif, non entier ou loin dans le futur : 400", async () => {
    const q = questionnaire();
    for (const horodatage of [undefined, -1, 1.5, "1", Date.now() + 3 * JOUR]) {
      expect((await enregistrer(q, corps(q, { horodatage }))).status).toBe(400);
    }
  });
});

describe("plafonds, jeton, débit", () => {
  it("au-delà de 400 000 octets : 413 (en-tête ET flux), rien d'écrit", async () => {
    const q = questionnaire();
    const gros = corps(q, { brouillon: "a".repeat(CHARGE_MAX_OCTETS) });
    expect((await enregistrer(q, gros)).status).toBe(413);
    const flux = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(gros));
        c.close();
      },
    });
    const r = await routeBrouillon.POST(
      new Request("http://localhost/api/b", {
        method: "POST",
        body: flux,
        // @ts-expect-error -- `duplex` exigé par Node pour un corps en flux
        duplex: "half",
      }),
      ctx(q),
    );
    expect(r.status).toBe(413);
    expect(base.b).toHaveLength(0);
  });

  it("juste sous le plafond : accepté", async () => {
    const q = questionnaire();
    const vide = corps(q, { brouillon: "" }).length;
    const r = await enregistrer(
      q,
      corps(q, { brouillon: "a".repeat(CHARGE_MAX_OCTETS - vide - 10) }),
    );
    expect(r.status).toBe(200);
  });

  it(`au plus ${BROUILLONS_MAX_PAR_QUESTIONNAIRE} brouillons par questionnaire : 413 trop_de_brouillons`, async () => {
    const q = questionnaire();
    for (let i = 0; i < BROUILLONS_MAX_PAR_QUESTIONNAIRE; i += 1) {
      const m = `membre${String(i).padStart(6, "0")}`;
      expect((await enregistrer(q, corps(q, { mode: "emp", membre: m }))).status).toBe(200);
    }
    const r = await enregistrer(q, corps(q, { mode: "emp", membre: "membredetrop1" }));
    expect(r.status).toBe(413);
    expect(await json(r)).toEqual({ ok: false, motif: "trop_de_brouillons" });
    expect(base.b).toHaveLength(BROUILLONS_MAX_PAR_QUESTIONNAIRE);
    // Une personne qui a déjà le sien continue d'enregistrer.
    const maj = await enregistrer(
      q,
      corps(q, { mode: "emp", membre: "membre000003", brouillon: "v2" }),
    );
    expect(maj.status).toBe(200);
    // Un autre questionnaire n'est pas concerné.
    const autre = questionnaire();
    expect((await enregistrer(autre, corps(autre))).status).toBe(200);
  });

  it("jeton faux : 404 neutre en lecture, écriture et suppression", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q));
    const faux = "x".repeat(43);
    const e = await enregistrer(q, corps(q, { brouillon: "pirate" }), "", faux);
    expect(e.status).toBe(404);
    expect(await json(e)).toEqual({ ok: false });
    const g = await relire(q, undefined, faux);
    expect(g.status).toBe(404);
    expect(await json(g)).toEqual({ ok: false });
    expect((await supprimer(q, `?mode=main&m=${dir(q)}`, faux)).status).toBe(404);
    expect(base.b).toHaveLength(1);
  });

  it("débit : trois compteurs propres au brouillon (IP, lien, PERSONNE à 120/h), 429", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q));
    const cles = base.limite.mock.calls.map((c) => c[0] as string);
    expect(cles).toEqual([
      expect.stringMatching(/^questionnaire-preaudit-brouillon:ip:/),
      `questionnaire-preaudit-brouillon:lien:${q["id"] as string}`,
      `questionnaire-preaudit-brouillon:personne:${q["id"] as string}:main:${dir(q)}`,
    ]);
    const confs = base.limite.mock.calls.map((c) => (c[1] as { limit: number }).limit);
    expect(confs[2]).toBe(120);
    expect(confs[0]).toBeGreaterThan(120);
    expect(confs[1]).toBeGreaterThanOrEqual(120 * BROUILLONS_MAX_PAR_QUESTIONNAIRE);
    // Chaque compteur bloque à son tour.
    for (const rang of [0, 1, 2]) {
      base.limite.mockReset();
      base.limite.mockResolvedValue({ allowed: true });
      base.limite.mockImplementationOnce(async () => ({ allowed: rang !== 0 }));
      if (rang >= 1) base.limite.mockImplementationOnce(async () => ({ allowed: rang !== 1 }));
      if (rang >= 2) base.limite.mockImplementationOnce(async () => ({ allowed: false }));
      expect((await enregistrer(q, corps(q, { brouillon: `r${rang}` }))).status).toBe(429);
    }
    expect((await json(await relire(q)))["brouillon"]).not.toMatch(/^r\d$/);
  });

  it("éteint, brouillon de Will (non envoyé), clos ou expiré : 404, rien d'écrit", async () => {
    const eteint = questionnaire();
    delete process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"];
    expect((await enregistrer(eteint, corps(eteint))).status).toBe(404);
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    for (const extra of [
      { envoyeLe: null },
      { closLe: new Date() },
      { expireLe: new Date(Date.now() - 1000) },
    ]) {
      const q = questionnaire(extra);
      expect((await enregistrer(q, corps(q))).status).toBe(404);
      expect((await relire(q)).status).toBe(404);
    }
    expect(base.b).toHaveLength(0);
  });

  it("essai (`?essai=1`) : POST et DELETE rendent 200 sans rien écrire ni supprimer", async () => {
    const q = questionnaire();
    const r = await enregistrer(q, corps(q), "?essai=1");
    expect(await json(r)).toEqual({ ok: true, essai: true });
    expect(base.b).toHaveLength(0);
    await enregistrer(q, corps(q));
    const d = await supprimer(q, `?mode=main&m=${dir(q)}&essai=1`);
    expect(d.status).toBe(200);
    expect(await json(d)).toEqual({ ok: true, essai: true });
    expect(base.b).toHaveLength(1);
  });

  it("CORS : origine opaque `null`, GET POST DELETE", async () => {
    const r = routeBrouillon.OPTIONS();
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("null");
    expect(r.headers.get("access-control-allow-methods")).toBe("GET, POST, DELETE, OPTIONS");
    const q = questionnaire();
    const g = await relire(q);
    expect(g.headers.get("access-control-allow-origin")).toBe("null");
    expect(g.headers.get("cache-control")).toBe("no-store");
  });
});

describe("suppression", () => {
  const reponse = (mode: string, membre: string, envoyeLe: number) =>
    JSON.stringify({
      schema: 3,
      mode,
      membre,
      envoyeLe: new Date(envoyeLe).toISOString(),
      consentements: { traitement: true },
      donnees: { ent_nom: "x" },
    });
  const envoyer = (q: Ligne, c: string) =>
    postReponse(new Request("http://localhost/api/q", { method: "POST", body: c }), ctx(q));

  it("après l'envoi RÉUSSI de la réponse, le brouillon de cette personne est supprimé (et lui seul)", async () => {
    const q = questionnaire();
    const t = Date.now();
    await enregistrer(q, corps(q, { horodatage: t, brouillon: "dirigeant" }));
    await enregistrer(q, corps(q, { mode: "emp", membre: CODE, horodatage: t, brouillon: "s" }));
    expect((await envoyer(q, reponse("emp", CODE, t + 1000))).status).toBe(200);
    expect(base.b.map((b) => b["mode"])).toEqual(["main"]);
    expect((await json(await relire(q, `?mode=emp&m=${CODE}`)))["brouillon"]).toBeNull();
    // Un enregistrement automatique EN RETARD (état antérieur à l'envoi) ne le ressuscite pas.
    const tard = await enregistrer(q, corps(q, { mode: "emp", membre: CODE, horodatage: t + 500 }));
    expect(tard.status).toBe(409);
    expect((await json(tard))["motif"]).toBe("deja_envoye");
    // Une modification POSTÉRIEURE à l'envoi est un nouveau brouillon.
    const apres = await enregistrer(
      q,
      corps(q, { mode: "emp", membre: CODE, horodatage: t + 5000 }),
    );
    expect(apres.status).toBe(200);
  });

  it("horloge du navigateur décalée de 2 h : comparaison navigateur contre navigateur", async () => {
    const q = questionnaire();
    const avance = Date.now() + 2 * 3_600_000; // navigateur en AVANCE de 2 h sur le serveur
    await enregistrer(q, corps(q, { horodatage: avance }));
    expect((await envoyer(q, reponse("main", dir(q), avance + 5_000))).status).toBe(200);
    expect(base.b).toHaveLength(0);
    // L'état capturé AVANT l'envoi (horloge du navigateur) arrive en retard : refusé, alors que
    // l'heure de réception du serveur (2 h plus tôt) l'aurait laissé passer.
    const tard = await enregistrer(q, corps(q, { horodatage: avance + 1_000 }));
    expect(tard.status).toBe(409);
    expect((await json(tard))["motif"]).toBe("deja_envoye");
    expect(base.b).toHaveLength(0);

    // Navigateur en RETARD de 2 h : un nouvel état après l'envoi passe, même si son horodatage
    // est antérieur à l'heure de réception du serveur.
    const q2 = questionnaire();
    const retard = Date.now() - 2 * 3_600_000;
    expect((await envoyer(q2, reponse("main", dir(q2), retard))).status).toBe(200);
    expect((await enregistrer(q2, corps(q2, { horodatage: retard + 60_000 }))).status).toBe(200);
  });

  it("un envoi REFUSÉ (lien clos) ne supprime pas le brouillon", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q));
    q["closLe"] = new Date();
    expect((await envoyer(q, reponse("main", dir(q), Date.now()))).status).toBe(404);
    expect(base.b).toHaveLength(1);
  });

  it("DELETE (retrait de l'accord) : supprimé, même lien clos", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q));
    q["closLe"] = new Date();
    const d = await supprimer(q, `?mode=main&m=${dir(q)}`);
    expect(d.status).toBe(200);
    expect(base.b).toHaveLength(0);
  });

  it("30 jours d'inactivité : plus JAMAIS rendu, mais AUCUNE suppression automatique", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q, { brouillon: "ancien" }));
    await enregistrer(q, corps(q, { mode: "emp", membre: CODE, brouillon: "frais" }));
    const ancien = base.b.find((b) => b["mode"] === "main") as Ligne;
    ancien["majLe"] = new Date(Date.now() - (BROUILLON_INACTIF_JOURS * JOUR + 60_000));
    expect((await json(await relire(q)))["brouillon"]).toBeNull();
    expect((await json(await relire(q, `?mode=emp&m=${CODE}`)))["brouillon"]).toBe("frais");
    // Aucune requête ne supprime : la suppression définitive attend la purge planifiée.
    expect(base.b).toHaveLength(2);
  });

  it("purgerBrouillonsInactifs (non branchée) : supprime à 30 jours, garde à 29", async () => {
    const q = questionnaire();
    await enregistrer(q, corps(q));
    await enregistrer(q, corps(q, { mode: "emp", membre: CODE }));
    (base.b[0] as Ligne)["majLe"] = new Date(Date.now() - 31 * JOUR);
    (base.b[1] as Ligne)["majLe"] = new Date(Date.now() - 29 * JOUR);
    expect(await purgerBrouillonsInactifs()).toBe(1);
    expect(base.b.map((b) => b["mode"])).toEqual(["emp"]);
  });

  it("un brouillon inactif depuis 30 jours n'écrase pas un nouveau, même plus ancien", async () => {
    const q = questionnaire();
    const t = Date.now();
    await enregistrer(q, corps(q, { horodatage: t, brouillon: "oublie" }));
    (base.b[0] as Ligne)["majLe"] = new Date(t - 31 * JOUR);
    const neuf = await enregistrer(q, corps(q, { horodatage: t - 1000, brouillon: "neuf" }));
    expect(neuf.status).toBe(200);
    expect((await json(await relire(q)))["brouillon"]).toBe("neuf");
  });
});

describe("validerBrouillon (pur)", () => {
  it("refuse un corps illisible, un parcours inconnu, un brouillon vide, un code invalide", () => {
    const q = questionnaire();
    const id = q["id"] as string;
    expect(validerBrouillon("{", id).ok).toBe(false);
    expect(validerBrouillon(corps(q, { mode: "x" }), id)).toEqual({
      ok: false,
      motif: "parcours_inconnu",
    });
    expect(validerBrouillon(corps(q, { brouillon: "" }), id)).toEqual({
      ok: false,
      motif: "brouillon_vide",
    });
    expect(validerBrouillon(corps(q, { mode: "emp", membre: "a b c d e f g h" }), id)).toEqual({
      ok: false,
      motif: "code_personnel_invalide",
    });
  });
});
