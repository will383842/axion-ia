// @vitest-environment node
/**
 * Brouillon du questionnaire de pré-audit (2026-10-24) — le VRAI `brouillon.ts`, `serveur.ts` et
 * les deux routes (brouillon + réponses), sur une base en mémoire (seuls Prisma et le limiteur
 * sont remplacés). Couvre : relu octet pour octet, consentement exigé, vieil onglet refusé,
 * 400 000 octets, jeton faux, suppression à l'envoi, purge à 30 jours, chiffrement, débit, CORS.
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
      create: async ({ data }: { data: Ligne }) => {
        base.e.push({ id: String(++base.seq), recuLe: new Date(), ...data });
      },
    },
    questionnaireAvantAuditBrouillon: {
      findUnique: async ({ where }: { where: Ligne }) => {
        const l = base.b.find((x) => correspond(x, cleB(where)));
        return l === undefined ? null : { ...l };
      },
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
import { jetonPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";
import { BROUILLON_INACTIF_JOURS, purgerBrouillonsInactifs, validerBrouillon } from "../brouillon";
import { CHARGE_MAX_OCTETS } from "../donnees";

const ENV0 = { ...process.env };
const REEL = {
  QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
  QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT: "contact@axion-ia.com",
  QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION: "3 ans",
};
const SECRET = "SECRET-DU-BROUILLON é € 🙂";
const CODE = "a1b2c3d4e5f6";

function questionnaire(extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `00000000-0000-4000-8000-${String(++base.seq).padStart(12, "0")}`,
    rencontreId: "11111111-1111-4111-8111-111111111111",
    ref: "refpreaudit1",
    envoyeLe: new Date(),
    luLe: null,
    closLe: null,
    expireLe: new Date(Date.now() + 86_400_000),
    ...extra,
  };
  base.q.push(l);
  return l;
}
const ctx = (q: Ligne, jeton?: string) => ({
  params: Promise.resolve({
    id: q["id"] as string,
    jeton: jeton ?? jetonPreaudit(q["id"] as string) ?? "",
  }),
});
const corps = (extra: Ligne = {}) =>
  JSON.stringify({
    consent: true,
    horodatage: Date.now(),
    mode: "main",
    brouillon: JSON.stringify({ data: { ent_nom: SECRET }, view: 3 }),
    ...extra,
  });
const enregistrer = (q: Ligne, c: string, qs = "", jeton?: string) =>
  routeBrouillon.POST(
    new Request(`http://localhost/api/b${qs}`, { method: "POST", body: c }),
    ctx(q, jeton),
  );
const relire = (q: Ligne, qs = "?mode=main", jeton?: string) =>
  routeBrouillon.GET(new Request(`http://localhost/api/b${qs}`), ctx(q, jeton));
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
    const r = await enregistrer(q, corps({ brouillon }));
    expect(r.status).toBe(200);
    const lu = await json(await relire(q));
    expect(lu["brouillon"]).toBe(brouillon);
    expect(
      Buffer.from(lu["brouillon"] as string, "utf8").equals(Buffer.from(brouillon, "utf8")),
    ).toBe(true);
  });

  it("CHIFFRÉ : la valeur stockée ne contient pas le texte clair", async () => {
    const q = questionnaire();
    await enregistrer(q, corps());
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

  it("un brouillon par personne : le dirigeant et un collaborateur ne se voient pas", async () => {
    const q = questionnaire();
    await enregistrer(q, corps({ brouillon: "du-dirigeant" }));
    await enregistrer(q, corps({ mode: "emp", membre: CODE, brouillon: "du-salarie" }));
    expect((await json(await relire(q)))["brouillon"]).toBe("du-dirigeant");
    expect((await json(await relire(q, `?mode=emp&m=${CODE}`)))["brouillon"]).toBe("du-salarie");
    expect((await json(await relire(q, "?mode=emp&m=autrecode1")))["brouillon"]).toBeNull();
  });

  it("collaborateur sans code de lien personnel : refusé (400)", async () => {
    const q = questionnaire();
    const r = await enregistrer(q, corps({ mode: "emp" }));
    expect(r.status).toBe(400);
    expect((await json(r))["motif"]).toBe("code_personnel_requis");
    expect((await relire(q, "?mode=emp")).status).toBe(400);
    expect(base.b).toHaveLength(0);
  });
});

describe("rien sans accord, rien d'un vieil onglet", () => {
  it("sans `consent: true` : 400 et rien d'écrit", async () => {
    const q = questionnaire();
    for (const consent of [undefined, false, "true", 1]) {
      const r = await enregistrer(q, corps({ consent }));
      expect(r.status).toBe(400);
      expect((await json(r))["motif"]).toBe("consentement_requis");
    }
    expect(base.b).toHaveLength(0);
  });

  it("un enregistrement PLUS ANCIEN que celui gardé est refusé (409), le récent reste", async () => {
    const q = questionnaire();
    const t = Date.now();
    await enregistrer(q, corps({ horodatage: t, brouillon: "recent" }));
    const r = await enregistrer(q, corps({ horodatage: t - 5_000, brouillon: "vieil-onglet" }));
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ ok: false, motif: "plus_ancien", horodatage: t });
    expect((await json(await relire(q)))["brouillon"]).toBe("recent");
    // Le plus récent écrase le précédent.
    expect(
      (await enregistrer(q, corps({ horodatage: t + 1, brouillon: "plus-recent" }))).status,
    ).toBe(200);
    expect((await json(await relire(q)))["brouillon"]).toBe("plus-recent");
    expect(base.b).toHaveLength(1);
  });

  it("horodatage absent, négatif ou loin dans le futur : 400", async () => {
    const q = questionnaire();
    for (const horodatage of [undefined, -1, 1.5, "1", Date.now() + 3 * 86_400_000]) {
      expect((await enregistrer(q, corps({ horodatage }))).status).toBe(400);
    }
  });
});

describe("plafonds, jeton, débit", () => {
  it("au-delà de 400 000 octets : 413 (en-tête ET flux), rien d'écrit", async () => {
    const q = questionnaire();
    const gros = corps({ brouillon: "a".repeat(CHARGE_MAX_OCTETS) });
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
    const vide = corps({ brouillon: "" }).length;
    const r = await enregistrer(q, corps({ brouillon: "a".repeat(CHARGE_MAX_OCTETS - vide - 10) }));
    expect(r.status).toBe(200);
  });

  it("jeton faux : 404 neutre en lecture, écriture et suppression", async () => {
    const q = questionnaire();
    await enregistrer(q, corps());
    const faux = "x".repeat(43);
    const e = await enregistrer(q, corps({ brouillon: "pirate" }), "", faux);
    expect(e.status).toBe(404);
    expect(await json(e)).toEqual({ ok: false });
    const g = await relire(q, "?mode=main", faux);
    expect(g.status).toBe(404);
    expect(await json(g)).toEqual({ ok: false });
    const d = await routeBrouillon.DELETE(
      new Request("http://localhost/api/b?mode=main"),
      ctx(q, faux),
    );
    expect(d.status).toBe(404);
    expect(base.b).toHaveLength(1);
  });

  it("débit dépassé (IP puis lien) : 429 ; compteurs distincts de ceux de l'envoi", async () => {
    const q = questionnaire();
    base.limite.mockResolvedValueOnce({ allowed: false });
    expect((await enregistrer(q, corps())).status).toBe(429);
    base.limite.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    expect((await relire(q)).status).toBe(429);
    const cles = base.limite.mock.calls.map((c) => c[0] as string);
    expect(cles.every((k) => k.startsWith("questionnaire-preaudit-brouillon:"))).toBe(true);
    expect(base.b).toHaveLength(0);
  });

  it("éteint, brouillon de Will (non envoyé), clos ou expiré : 404, rien d'écrit", async () => {
    const eteint = questionnaire();
    delete process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"];
    expect((await enregistrer(eteint, corps())).status).toBe(404);
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    for (const extra of [
      { envoyeLe: null },
      { closLe: new Date() },
      { expireLe: new Date(Date.now() - 1000) },
    ]) {
      const q = questionnaire(extra);
      expect((await enregistrer(q, corps())).status).toBe(404);
      expect((await relire(q)).status).toBe(404);
    }
    expect(base.b).toHaveLength(0);
  });

  it("essai (`?essai=1`) : 200 sans rien écrire", async () => {
    const q = questionnaire({ envoyeLe: null });
    const r = await enregistrer(q, corps(), "?essai=1");
    expect(await json(r)).toEqual({ ok: true, essai: true });
    expect(base.b).toHaveLength(0);
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
  const reponse = (mode = "main", membre?: string) =>
    JSON.stringify({
      schema: 3,
      mode,
      ...(membre ? { membre } : {}),
      consentements: { traitement: true },
      donnees: { ent_nom: "x" },
    });

  it("après l'envoi RÉUSSI de la réponse, le brouillon de cette personne est supprimé (et lui seul)", async () => {
    const q = questionnaire();
    await enregistrer(q, corps({ brouillon: "dirigeant" }));
    await enregistrer(q, corps({ mode: "emp", membre: CODE, brouillon: "salarie" }));
    const r = await postReponse(
      new Request("http://localhost/api/q", { method: "POST", body: reponse("emp", CODE) }),
      ctx(q),
    );
    expect(r.status).toBe(200);
    expect(base.b.map((b) => b["membre"])).toEqual([""]);
    expect((await json(await relire(q, `?mode=emp&m=${CODE}`)))["brouillon"]).toBeNull();
    // Un enregistrement automatique EN RETARD (horodaté avant l'envoi) ne le ressuscite pas.
    const tard = await enregistrer(
      q,
      corps({ mode: "emp", membre: CODE, horodatage: Date.now() - 60_000 }),
    );
    expect(tard.status).toBe(409);
    expect((await json(tard))["motif"]).toBe("deja_envoye");
    expect(base.b).toHaveLength(1);
  });

  it("un envoi REFUSÉ (lien clos) ne supprime pas le brouillon", async () => {
    const q = questionnaire();
    await enregistrer(q, corps());
    q["closLe"] = new Date();
    const r = await postReponse(
      new Request("http://localhost/api/q", { method: "POST", body: reponse() }),
      ctx(q),
    );
    expect(r.status).toBe(404);
    expect(base.b).toHaveLength(1);
  });

  it("DELETE (retrait de l'accord) : supprimé, même lien clos", async () => {
    const q = questionnaire();
    await enregistrer(q, corps());
    q["closLe"] = new Date();
    const d = await routeBrouillon.DELETE(new Request("http://localhost/api/b?mode=main"), ctx(q));
    expect(d.status).toBe(200);
    expect(base.b).toHaveLength(0);
  });

  it("purge à 30 jours d'inactivité : supprimé, jamais rendu même avant la purge", async () => {
    const q = questionnaire();
    await enregistrer(q, corps({ brouillon: "ancien" }));
    await enregistrer(q, corps({ mode: "emp", membre: CODE, brouillon: "frais" }));
    const ancien = base.b.find((b) => b["mode"] === "main") as Ligne;
    ancien["majLe"] = new Date(Date.now() - (BROUILLON_INACTIF_JOURS * 86_400_000 + 60_000));
    // Lu par une autre requête : la purge à l'accès passe, tous questionnaires confondus.
    expect((await json(await relire(q, `?mode=emp&m=${CODE}`)))["brouillon"]).toBe("frais");
    expect(base.b.map((b) => b["mode"])).toEqual(["emp"]);
    // 29 jours : gardé.
    const frais = base.b[0] as Ligne;
    frais["majLe"] = new Date(Date.now() - 29 * 86_400_000);
    expect(await purgerBrouillonsInactifs()).toBe(0);
    expect(base.b).toHaveLength(1);
  });

  it("un brouillon inactif depuis 30 jours n'écrase pas un nouveau, même plus ancien", async () => {
    const q = questionnaire();
    const t = Date.now();
    await enregistrer(q, corps({ horodatage: t, brouillon: "oublie" }));
    (base.b[0] as Ligne)["majLe"] = new Date(t - 31 * 86_400_000);
    expect((await enregistrer(q, corps({ horodatage: t - 1000, brouillon: "neuf" }))).status).toBe(
      200,
    );
    expect((await json(await relire(q)))["brouillon"]).toBe("neuf");
  });
});

describe("validerBrouillon (pur)", () => {
  it("refuse un corps illisible, un parcours inconnu, un brouillon vide", () => {
    expect(validerBrouillon("{").ok).toBe(false);
    expect(validerBrouillon(corps({ mode: "x" }))).toEqual({
      ok: false,
      motif: "parcours_inconnu",
    });
    expect(validerBrouillon(corps({ brouillon: "" }))).toEqual({
      ok: false,
      motif: "brouillon_vide",
    });
    expect(validerBrouillon(corps({ membre: "a b" }))).toEqual({
      ok: false,
      motif: "code_personnel_invalide",
    });
  });
});
