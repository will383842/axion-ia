// @vitest-environment node
/**
 * Suivi des ouvertures (2026-10-27) — le VRAI `…/ouverture/route.ts`, la vraie page publique,
 * `suivi-ouvertures.ts` et l'action « Lire le brouillon », sur une base en mémoire (seuls Prisma,
 * le limiteur et la session sont remplacés).
 *   · drapeau éteint : rien n'est noté, la page n'a ni balise ni notice ;
 *   · robots, essai, page trop rapide : rien n'est noté ;
 *   · dédoublonnage à 30 min de bout en bout ;
 *   · contenu d'un brouillon : super-administrateur ET drapeau exigés, trace sans contenu.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const base = vi.hoisted(() => ({
  q: [] as Ligne[],
  o: [] as Ligne[],
  b: [] as Ligne[],
  traces: [] as Ligne[],
  seq: 0,
  session: null as null | { user: { id: string; role: string } },
  traceEnPanne: false,
  limite: false,
}));

const egal = (l: Ligne, where: Ligne): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v instanceof Date) return l[k] instanceof Date && (l[k] as Date).getTime() === v.getTime();
    if (v !== null && typeof v === "object" && "in" in (v as Ligne)) {
      return (v as { in: unknown[] }).in.includes(l[k]);
    }
    return l[k] === v;
  });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireAvantAudit: {
      findUnique: async ({ where }: { where: Ligne }) =>
        base.q.find((x) => x["id"] === where["id"]) ?? null,
      findMany: async ({ where }: { where: Ligne }) => base.q.filter((x) => egal(x, where)),
    },
    questionnaireAvantAuditOuverture: {
      findUnique: async ({ where }: { where: { questionnaireId_mode_membre: Ligne } }) => {
        const l = base.o.find((x) => egal(x, where.questionnaireId_mode_membre));
        return l ? { ...l } : null;
      },
      findMany: async ({ where }: { where: Ligne }) => base.o.filter((x) => egal(x, where)),
      count: async ({ where }: { where: Ligne }) => base.o.filter((x) => egal(x, where)).length,
      createMany: async ({ data }: { data: Ligne[] }) => {
        let count = 0;
        for (const d of data) {
          if (
            base.o.some((x) =>
              egal(x, {
                questionnaireId: d["questionnaireId"],
                mode: d["mode"],
                membre: d["membre"],
              }),
            )
          )
            continue;
          base.o.push({ id: `o${++base.seq}`, ...d });
          count++;
        }
        return { count };
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = base.o.filter((x) => egal(x, where));
        l.forEach((x) => Object.assign(x, data));
        return { count: l.length };
      },
    },
    questionnaireAvantAuditBrouillon: {
      findMany: async ({ where }: { where: Ligne }) => base.b.filter((x) => egal(x, where)),
      findUnique: async ({ where }: { where: Ligne }) => {
        const l = base.b.find((x) => x["id"] === where["id"]);
        if (!l) return null;
        const q = base.q.find((x) => x["id"] === l["questionnaireId"]);
        return { ...l, questionnaire: { html: q?.["html"] ?? "" } };
      },
    },
    activityLog: {
      create: async ({ data }: { data: Ligne }) => {
        if (base.traceEnPanne) throw new Error("panne");
        base.traces.push(data);
        return data;
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: !base.limite }),
}));
vi.mock("@/auth", () => ({ auth: async () => base.session }));

import { GET as getPage } from "@/app/questionnaire/preaudit/[id]/[jeton]/route";
import * as routeOuverture from "@/app/api/questionnaire-preaudit/[id]/[jeton]/ouverture/route";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { codeDirigeantPreaudit, jetonPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";

import { lireBrouillonAction } from "../actions-suivi-ouvertures";
import { PHRASE_BROUILLON, PHRASE_OUVERTURES } from "../notice-suivi";
import { lireSuiviDesQuestionnaires } from "../suivi-ouvertures";

const ENV0 = { ...process.env };
const REEL = {
  PII_ENCRYPTION_KEY: "d".repeat(64),
  QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
};
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CODE = "a1b2c3d4e5f6";
const HTML =
  '<!doctype html><html><body><script>const CONFIG = {\n  schema: 3,\n};\nF("text", "ent_nom", "Nom de l\'entreprise");\nF("text", "ent_ville", "Ville");</script></body></html>';

function questionnaire(extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `00000000-0000-4000-8000-${String(++base.seq).padStart(12, "0")}`,
    ref: "refpreaudit1",
    html: HTML,
    envoyeLe: new Date(),
    closLe: null,
    expireLe: new Date(Date.now() + 86_400_000),
    rencontre: null,
    ...extra,
  };
  base.q.push(l);
  return l;
}
const id = (q: Ligne) => q["id"] as string;
const ctx = (q: Ligne) => ({
  params: Promise.resolve({ id: id(q), jeton: jetonPreaudit(id(q)) ?? "" }),
});
const signal = (q: Ligne, corps: Ligne = {}, o: { ua?: string; qs?: string } = {}) =>
  routeOuverture.POST(
    new Request(`http://localhost/api/o${o.qs ?? ""}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "User-Agent": o.ua ?? CHROME },
      body: JSON.stringify({ m: codeDirigeantPreaudit(id(q)), s: "", etape: 1, t: 3200, ...corps }),
    }),
    ctx(q),
  );
const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const page = async (q: Ligne, qs = "") => {
  const r = await getPage(
    new Request(`http://localhost/questionnaire/preaudit/${id(q)}/x?ref=refpreaudit1${qs}`),
    ctx(q),
  );
  return r.text();
};

beforeEach(() => {
  process.env = { ...ENV0, ...REEL };
  base.q = [];
  base.o = [];
  base.b = [];
  base.traces = [];
  base.session = null;
  base.traceEnPanne = false;
  base.limite = false;
  vi.useRealTimers();
});

describe("drapeau éteint = rien enregistré ni affiché", () => {
  it("la route ne note rien", async () => {
    const q = questionnaire();
    const r = await signal(q);
    expect(r.status).toBe(404);
    expect(base.o).toEqual([]);
  });

  it("la page n'a ni balise ni notice", async () => {
    const q = questionnaire();
    const html = await page(q);
    expect(html).not.toContain("/ouverture");
    expect(html).not.toContain(PHRASE_OUVERTURES);
    expect(html).not.toContain(PHRASE_BROUILLON);
  });

  it("la console ne lit rien quand les deux drapeaux sont éteints (lecture non appelée)", async () => {
    // `lireQuestionnairesDeLaFiche` ne l'appelle que drapeau allumé ; ici, la lecture elle-même
    // ne rend que ce qui existe : aucune ouverture n'a pu être écrite.
    const q = questionnaire();
    await signal(q);
    expect((await lireSuiviDesQuestionnaires([id(q)])).get(id(q))).toEqual({
      ouvertures: [],
      brouillons: [],
    });
  });
});

describe("drapeau allumé", () => {
  beforeEach(() => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
  });

  it("suivi allumé + texte éteint : la balise est présente, AUCUN texte d'information", async () => {
    const q = questionnaire();
    const html = await page(q);
    expect(html).toContain(`/api/questionnaire-preaudit/${id(q)}/`);
    expect(html).toContain("/ouverture");
    expect(html).not.toContain("Suivi de ce questionnaire");
    expect(html).not.toContain("peut le lire avant");
    expect(html).not.toContain("note la date et le nombre");
  });

  it("suivi allumé + texte allumé : balise ET les deux phrases", async () => {
    process.env["QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE"] = "true";
    const q = questionnaire();
    const html = await page(q);
    expect(html).toContain("/ouverture");
    expect(html).toContain("Suivi de ce questionnaire");
    expect(html).toContain("peut le lire avant");
    expect(html).toContain("note la date et le nombre");
  });

  it("texte allumé seul (suivi éteint) : pas de balise", async () => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "false";
    process.env["QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE"] = "true";
    const q = questionnaire();
    expect(await page(q)).not.toContain("/ouverture");
  });

  it("limite de débit dépassée : 429 et rien n'est noté", async () => {
    const q = questionnaire();
    base.limite = true;
    expect((await signal(q)).status).toBe(429);
    expect(base.o).toEqual([]);
  });

  it("la limite par lien est de 200 par heure et refuse sur panne", () => {
    expect(routeOuverture.LIMITE_OUVERTURES_PAR_LIEN).toMatchObject({
      limit: 200,
      windowSec: 3600,
      surPanne: "refuser",
    });
  });

  it("plafond de lignes par questionnaire : la 101e personne n'est pas notée", async () => {
    const q = questionnaire();
    for (let i = 0; i < 100; i++) {
      base.o.push({
        id: `x${i}`,
        questionnaireId: id(q),
        mode: "perso",
        membre: `membre${String(i).padStart(6, "0")}ab`,
        nombre: 1,
        derniereOuverture: new Date(),
        premiereOuverture: new Date(),
        derniereEtapeAtteinte: 1,
      });
    }
    const r = await json(await signal(q, { m: "zzzzzzzzzzzz9", s: "1" }));
    expect(r).toMatchObject({ ok: true, note: false, motif: "plafond" });
    expect(base.o).toHaveLength(100);
    // Une personne déjà connue continue d'être suivie.
    const connue = await json(await signal(q, { m: "membre000001ab", s: "perso", t: 3300 }));
    expect(connue).toMatchObject({ ok: true, note: true });
  });

  it("en ESSAI, la page n'a pas de balise et la route ne note rien", async () => {
    const q = questionnaire();
    expect(await page(q, "&essai=1")).not.toContain("/ouverture");
    expect(await json(await signal(q, {}, { qs: "?essai=1" }))).toMatchObject({ note: false });
    expect(base.o).toEqual([]);
  });

  it("une ouverture du dirigeant est notée : date, nombre, étape", async () => {
    const q = questionnaire();
    expect(await json(await signal(q))).toMatchObject({ note: true, nouvelle: true });
    expect(base.o).toHaveLength(1);
    expect(base.o[0]).toMatchObject({
      mode: "main",
      membre: "",
      nombre: 1,
      derniereEtapeAtteinte: 1,
    });
  });

  it("les robots sont ignorés", async () => {
    const q = questionnaire();
    const r = await signal(
      q,
      {},
      { ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
    );
    expect(await json(r)).toMatchObject({ note: false, motif: "robot" });
    await signal(q, {}, { ua: "" });
    expect(base.o).toEqual([]);
  });

  it("une page qui se signale trop tôt (préchargement) n'est pas notée", async () => {
    const q = questionnaire();
    expect(await json(await signal(q, { t: 50 }))).toMatchObject({
      note: false,
      motif: "trop_tot",
    });
    expect(base.o).toEqual([]);
  });

  it("lien clos : rien n'est noté", async () => {
    const q = questionnaire({ closLe: new Date() });
    expect((await signal(q)).status).toBe(404);
    expect(base.o).toEqual([]);
  });

  it("dédoublonnage : rechargé dans les 30 min = une ouverture ; après = deux", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T08:00:00Z"));
    const q = questionnaire();
    await signal(q);
    vi.setSystemTime(new Date("2026-10-27T08:20:00Z"));
    await signal(q);
    await signal(q, { etape: 2 });
    expect(base.o[0]).toMatchObject({ nombre: 1, derniereEtapeAtteinte: 2 });
    vi.setSystemTime(new Date("2026-10-27T09:00:00Z"));
    expect(await json(await signal(q))).toMatchObject({ nouvelle: true });
    expect(base.o[0]).toMatchObject({ nombre: 2, derniereEtapeAtteinte: 2 });
    expect((base.o[0]!["premiereOuverture"] as Date).toISOString()).toBe(
      "2026-10-27T08:00:00.000Z",
    );
  });

  it("un collaborateur a sa propre ligne (code de son lien), le lien commun aussi", async () => {
    const q = questionnaire();
    await signal(q, { m: CODE, s: "1" });
    await signal(q, { m: "" });
    expect(base.o.map((o) => [o["mode"], o["membre"]])).toEqual([
      ["emp", CODE],
      ["lien", ""],
    ]);
  });

  it("aucune IP ni navigateur n'est gardé", async () => {
    const q = questionnaire();
    await signal(q);
    expect(Object.keys(base.o[0]!).sort()).toEqual(
      [
        "derniereEtapeAtteinte",
        "derniereOuverture",
        "id",
        "membre",
        "mode",
        "nombre",
        "premiereOuverture",
        "questionnaireId",
      ].sort(),
    );
  });

  it("la console lit l'avancée d'un brouillon (compte, jamais le contenu)", async () => {
    const q = questionnaire();
    await signal(q);
    base.b.push({
      id: "11111111-1111-4111-8111-111111111111",
      questionnaireId: id(q),
      mode: "main",
      membre: "",
      majLe: new Date(),
      donnees: chiffrerParole(JSON.stringify({ data: { ent_nom: "SECRET-X" }, view: 2 })),
    });
    const s = (await lireSuiviDesQuestionnaires([id(q)])).get(id(q))!;
    expect(s.ouvertures).toHaveLength(1);
    expect(s.brouillons[0]?.avancee).toEqual({ remplies: 1, total: 2, pourcentage: 50 });
    expect(JSON.stringify(s)).not.toContain("SECRET-X");
  });
});

describe("le contenu d'un brouillon : super-administrateur exigé", () => {
  const BID = "22222222-2222-4222-8222-222222222222";
  const fd = () => {
    const f = new FormData();
    f.set("brouillonId", BID);
    return f;
  };
  beforeEach(() => {
    const q = questionnaire();
    base.b.push({
      id: BID,
      questionnaireId: id(q),
      mode: "emp",
      membre: CODE,
      majLe: new Date("2026-10-27T10:00:00Z"),
      donnees: chiffrerParole(JSON.stringify({ data: { ent_nom: "SECRET-Y", ent_ville: "" } })),
    });
  });

  it("drapeau éteint : refusé même pour le super-administrateur", async () => {
    base.session = { user: { id: "u1", role: "super_admin" } };
    expect(await lireBrouillonAction({ etat: "initial" }, fd())).toMatchObject({ etat: "refuse" });
    expect(base.traces).toEqual([]);
  });

  it("un administrateur qui n'est pas super-administrateur est refusé, sans trace", async () => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
    base.session = { user: { id: "u2", role: "admin" } };
    const r = await lireBrouillonAction({ etat: "initial" }, fd());
    expect(r).toMatchObject({ etat: "refuse" });
    expect(JSON.stringify(r)).not.toContain("SECRET-Y");
    expect(base.traces).toEqual([]);
  });

  it("le super-administrateur lit, et la trace dit qui et quoi, jamais le contenu", async () => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
    base.session = { user: { id: "u1", role: "super_admin" } };
    const r = await lireBrouillonAction({ etat: "initial" }, fd());
    expect(r).toMatchObject({
      etat: "lu",
      personne: "Collaborateur …e5f6",
      champs: [{ cle: "ent_nom", libelle: "Nom de l'entreprise", valeur: "SECRET-Y" }],
    });
    expect(base.traces).toEqual([
      expect.objectContaining({
        adminUserId: "u1",
        action: "questionnaire-preaudit.brouillon.lu",
        targetId: BID,
      }),
    ]);
    expect(JSON.stringify(base.traces)).not.toContain("SECRET-Y");
  });

  it("sans trace écrite, rien n'est rendu", async () => {
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
    base.session = { user: { id: "u1", role: "super_admin" } };
    base.traceEnPanne = true;
    const r = await lireBrouillonAction({ etat: "initial" }, fd());
    expect(r).toMatchObject({ etat: "refuse" });
    expect(JSON.stringify(r)).not.toContain("SECRET-Y");
  });

  it("la page dit que le brouillon peut être lu, seulement texte allumé", async () => {
    const q = base.q[0]!;
    process.env["QUESTIONNAIRE_SUIVI_ENABLED"] = "true";
    expect(await page(q)).not.toContain("peut le lire avant");
    process.env["QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE"] = "true";
    expect(await page(q)).toContain("peut le lire avant");
  });
});
