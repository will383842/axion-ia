// @vitest-environment node
/**
 * Comportement du questionnaire de pré-audit — le VRAI `serveur.ts`, `envoyer.ts`, `actions.ts` et
 * les deux routes, sur une base en mémoire (seuls Prisma, la file, le limiteur et la session sont
 * remplacés). Couvre : 404/413/400/429, schémas 3 et 4 gardés tels quels, limite de 60, chiffrement, `luLe`, accès aux actions,
 * remplacement d'un questionnaire envoyé, double clic, expiration, clôture, en-têtes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const base = vi.hoisted(() => ({
  q: [] as Ligne[],
  e: [] as Ligne[],
  seq: 0,
  enqueue: vi.fn(),
  limite: vi.fn(),
  acces: vi.fn(),
  outbox: [] as Ligne[],
  client: null as unknown,
  apresCount: null as null | (() => void),
}));

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => correspond(l, w));
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const op = v as { lt?: Date };
      if (op.lt !== undefined) return l[k] instanceof Date && (l[k] as Date) < op.lt;
      return false;
    }
    return l[k] === v;
  });
}
const trouver = (t: Ligne[], where: Record<string, unknown>) =>
  t.find((l) => correspond(l, where)) ?? null;
/** Un instantané, comme Prisma : modifier la ligne ensuite ne change pas ce qu'on a lu. */
const instantane = (l: Ligne | null): Ligne | null => (l === null ? null : { ...l });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Le simulacre de transaction APPELLE la fonction passée, avec le même faux client.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(base.client),
    // Verrou FOR UPDATE : rend la ligne si elle existe encore.
    $queryRaw: async (_strings: unknown, id: string) => base.q.filter((x) => x["id"] === id),
    emailOutbox: {
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const statuts = (where["statut"] as { in: string[] }).in;
        const l = base.outbox.filter(
          (x) =>
            x["entityId"] === where["entityId"] &&
            x["entityType"] === where["entityType"] &&
            statuts.includes(x["statut"] as string),
        );
        l.forEach((x) => Object.assign(x, data));
        return { count: l.length };
      },
    },
    questionnaireAvantAudit: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        instantane(trouver(base.q, where)),
      create: async ({ data }: { data: Ligne }) => {
        const l = {
          id: `00000000-0000-4000-8000-${String(++base.seq).padStart(12, "0")}`,
          envoyeLe: null,
          luLe: null,
          closLe: null,
          expireLe: null,
          rencontre: { clientId: null },
          ...data,
        };
        base.q.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = trouver(base.q, where);
        if (l === null) throw new Error("introuvable");
        Object.assign(l, data);
        return l;
      },
      deleteMany: async ({ where }: { where: { id: string; envois: unknown } }) => {
        const aDesReponses = base.e.some((x) => x["questionnaireId"] === where.id);
        if (aDesReponses) return { count: 0 };
        const avant = base.q.length;
        base.q = base.q.filter((x) => x["id"] !== where.id);
        return { count: avant - base.q.length };
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = base.q.filter((x) => correspond(x, where));
        l.forEach((x) => Object.assign(x, data));
        return { count: l.length };
      },
    },
    questionnaireAvantAuditEnvoi: {
      count: async ({ where }: { where: Ligne }) => {
        const n = base.e.filter((x) => correspond(x, where)).length;
        // Simule une réponse qui arrive APRÈS le comptage (sans verrou, ce serait la course).
        const hook = base.apresCount;
        base.apresCount = null;
        hook?.();
        return n;
      },
      create: async ({ data }: { data: Ligne }) => {
        base.e.push({ id: String(++base.seq), recuLe: new Date(), ...data });
      },
      findMany: async ({ where }: { where: Ligne }) => base.e.filter((x) => correspond(x, where)),
      deleteMany: async ({ where }: { where: { recuLe: { lt: Date } } }) => {
        const avant = base.e.length;
        base.e = base.e.filter((x) => !((x["recuLe"] as Date) < where.recuLe.lt));
        return { count: avant - base.e.length };
      },
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: base.enqueue }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: base.limite }));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: base.acces }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class MessagePourWill extends Error {},
  messageAffichable: (e: unknown) => (e instanceof Error ? e.message : "erreur"),
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/admin${p}` }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { prisma as prismaMock } from "@/lib/prisma";
import { POST, OPTIONS } from "@/app/api/questionnaire-preaudit/[id]/[jeton]/route";
import { GET } from "@/app/questionnaire/preaudit/[id]/[jeton]/route";
import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { jetonPreaudit } from "@/server/visio/questionnaire-en-ligne/jeton";
import {
  cloreQuestionnaireAction,
  deposerQuestionnaireAction,
  envoyerQuestionnaireAction,
} from "../actions";
import { CSP_PAGE_PREAUDIT } from "../entetes";
import { CHARGE_MAX_OCTETS, ENVOIS_MAX_PAR_QUESTIONNAIRE } from "../donnees";
import { envoyerQuestionnaire } from "../envoyer";
import { enregistrerReponse, lireReponses, purgerReponsesAnciennes } from "../serveur";
import { CHARGES_SCHEMA_4 } from "./charges-schema-4.fixture";

const RENCONTRE = "11111111-1111-4111-8111-111111111111";
const HTML = `<!doctype html><html><body><script>
const CONFIG = {
  endpoint: "",
  rgpd: { contact: "", conservation: "" },
};
const p = { schema: 3 };
</script></body></html>`;
const CHARGE = (mode = "main", membre?: string) =>
  JSON.stringify({
    schema: 3,
    mode,
    ...(membre ? { membre } : {}),
    consentements: { traitement: true },
    donnees: { ent_nom: "SECRET-DE-LA-REPONSE" },
  });

/** Une charge schéma 3 valide d'environ `octets` octets (une réponse libre très longue). */
const chargeDe = (octets: number) => {
  const vide = CHARGE().length;
  const c = JSON.parse(CHARGE()) as { donnees: Record<string, unknown> };
  c.donnees["journee_type"] = "a".repeat(Math.max(0, octets - vide - 20));
  return JSON.stringify(c);
};

const REEL = {
  QUESTIONNAIRE_AVANT_AUDIT_ENABLED: "true",
  QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT: "contact@axion-ia.com",
  QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION: "3 ans",
};
const ENV0 = { ...process.env };
/** Le réel est refusé tant que la purge n'est pas planifiée : on simule la PR qui la planifie. */
vi.mock("../config", async (orig) => {
  const m = await orig<typeof import("../config")>();
  return {
    ...m,
    refusReel: (env?: Record<string, string | undefined>) => m.refusReel(env, true),
    refusEnvoiReel: (env?: Record<string, string | undefined>) => m.refusReel(env, true),
  };
});

function allumer() {
  Object.assign(process.env, REEL);
}
function questionnaire(extra: Ligne = {}): Ligne {
  const l: Ligne = {
    id: `00000000-0000-4000-8000-${String(++base.seq).padStart(12, "0")}`,
    rencontreId: RENCONTRE,
    html: HTML,
    ref: "refpreaudit1",
    envoyeLe: new Date(),
    luLe: new Date("2026-01-01"),
    closLe: null,
    expireLe: new Date(Date.now() + 86_400_000),
    rencontre: { clientId: null },
    ...extra,
  };
  base.q.push(l);
  return l;
}
const ctx = (q: Ligne) => ({
  params: Promise.resolve({ id: q["id"] as string, jeton: jetonPreaudit(q["id"] as string) ?? "" }),
});
const post = (q: Ligne, corps: string, qs = "", entetes: Record<string, string> = {}) =>
  POST(
    new Request(`http://localhost/api/q${qs}`, { method: "POST", body: corps, headers: entetes }),
    ctx(q),
  );
const get = (q: Ligne, qs: string) =>
  GET(new Request(`http://localhost/questionnaire/preaudit/x/y${qs}`), ctx(q));
const formulaire = (champs: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
};
const redirige = async (f: () => Promise<unknown>): Promise<string> => {
  try {
    await f();
  } catch (e) {
    return (e as Error).message;
  }
  return "";
};

beforeEach(() => {
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64) };
  base.q = [];
  base.e = [];
  base.outbox = [];
  base.apresCount = null;
  base.client = prismaMock;
  vi.clearAllMocks();
  base.limite.mockResolvedValue({ allowed: true });
  base.enqueue.mockResolvedValue({ enqueued: true });
  base.acces.mockResolvedValue({ userId: "u1", role: "super_admin" });
});

describe("réception des réponses", () => {
  it("jeton faux : 404 et rien d'écrit", async () => {
    allumer();
    const q = questionnaire();
    const r = await POST(
      new Request("http://localhost/api/q", { method: "POST", body: CHARGE() }),
      {
        params: Promise.resolve({ id: q["id"] as string, jeton: "x".repeat(43) }),
      },
    );
    expect(r.status).toBe(404);
    expect(base.e).toHaveLength(0);
  });

  it("corps trop gros : 413 (en-tête ET flux sans en-tête), rien d'écrit", async () => {
    allumer();
    const q = questionnaire();
    // Une charge VALIDE de ~450 Ko : c'est bien la taille qui est refusée, pas la forme.
    const gros = chargeDe(450_000);
    expect(Buffer.byteLength(gros, "utf8")).toBeGreaterThan(CHARGE_MAX_OCTETS);
    const n = String(Buffer.byteLength(gros, "utf8"));
    expect((await post(q, gros, "", { "content-length": n })).status).toBe(413);
    expect((await post(q, gros)).status).toBe(413);
    expect(base.e).toHaveLength(0);
  });

  it("charge de ~300 Ko (sous le plafond de 400 Ko) : acceptée et gardée entière", async () => {
    allumer();
    const q = questionnaire();
    const moyen = chargeDe(300_000);
    const n = String(Buffer.byteLength(moyen, "utf8"));
    expect((await post(q, moyen, "", { "content-length": n })).status).toBe(200);
    expect(base.e).toHaveLength(1);
    expect(dechiffrerParole(String(base.e[0]?.["donnees"]))).toBe(moyen);
  });

  it("schéma 4 complet (3 parcours) : enregistré puis relu champ par champ, identique", async () => {
    allumer();
    const q = questionnaire();
    for (const mode of ["main", "emp", "it"] as const) {
      const texte = JSON.stringify(CHARGES_SCHEMA_4[mode]);
      expect((await post(q, texte)).status).toBe(200);
    }
    expect(base.e).toHaveLength(3);
    (["main", "emp", "it"] as const).forEach((mode, i) => {
      const ligne = base.e[i] as Ligne;
      const stocke = String(ligne["donnees"]);
      expect(stocke.startsWith("enc:v1:")).toBe(true);
      // Le texte reçu, octet pour octet : réponses, calc, prefill, service, parcours, ref.
      const relu = dechiffrerParole(stocke);
      expect(relu).toBe(JSON.stringify(CHARGES_SCHEMA_4[mode]));
      expect(JSON.parse(relu)).toStrictEqual(CHARGES_SCHEMA_4[mode]);
      expect(ligne["mode"]).toBe(mode);
    });
    expect(base.e[1]?.["membre"]).toBe("m1");
    const relu = JSON.parse(dechiffrerParole(String(base.e[0]?.["donnees"])));
    expect(relu.prefill).toEqual(CHARGES_SCHEMA_4.main["prefill"]);
    expect(Object.keys(relu.prefill)).toEqual(["confirmes", "modifies", "non_verifies", "vides"]);
    expect(JSON.parse(dechiffrerParole(String(base.e[1]?.["donnees"]))).calc).toEqual(
      CHARGES_SCHEMA_4.emp["calc"],
    );
    // La console relit toutes les réponses non vides, avec l'état du pré-remplissage.
    const reponses = await lireReponses(q["id"] as string);
    const donneesMain = CHARGES_SCHEMA_4.main["donnees"] as Record<string, unknown>;
    const lignesMain = reponses[0]?.lignes ?? [];
    for (const cle of Object.keys(donneesMain)) {
      const v = donneesMain[cle];
      const vide = v === "" || (Array.isArray(v) && v.length === 0);
      if (!vide) expect(lignesMain.some((l) => l.cle === cle)).toBe(true);
    }
    expect(lignesMain.find((l) => l.cle === "ent_nom")?.prefill).toBe("confirme");
    expect(lignesMain.find((l) => l.cle === "ent_ville")?.prefill).toBe("modifie");
    expect(lignesMain.find((l) => l.cle === "ent_siret")?.prefill).toBe("non_verifie");
    expect(lignesMain.find((l) => l.cle === "ent_site")?.prefill).toBe("vide");
  });

  it("schéma 3 toujours accepté, schéma 5 refusé (400)", async () => {
    allumer();
    const q = questionnaire();
    expect((await post(q, CHARGE())).status).toBe(200);
    expect((await post(q, CHARGE().replace('"schema":3', '"schema":5'))).status).toBe(400);
    expect(base.e).toHaveLength(1);
  });

  it("charge invalide : 400", async () => {
    allumer();
    const q = questionnaire();
    expect((await post(q, "pas du json")).status).toBe(400);
    expect((await post(q, CHARGE().replace('"main"', '"zzz"'))).status).toBe(400);
    expect(base.e).toHaveLength(0);
  });

  it("limite de débit dépassée (IP puis lien) : 429 avant toute lecture", async () => {
    allumer();
    const q = questionnaire();
    base.limite.mockResolvedValueOnce({ allowed: false });
    expect((await post(q, CHARGE())).status).toBe(429);
    base.limite.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    expect((await post(q, CHARGE())).status).toBe(429);
    const cles = base.limite.mock.calls.map((c) => String(c[0]));
    expect(cles.some((c) => c.startsWith("questionnaire-preaudit:ip:"))).toBe(true);
    expect(cles.some((c) => c.startsWith("questionnaire-preaudit:lien:"))).toBe(true);
    expect(base.e).toHaveLength(0);
  });

  it("essai : 200 sans rien écrire, même éteint", async () => {
    const q = questionnaire({ envoyeLe: null });
    const r = await post(q, CHARGE(), "?essai=1");
    expect(r.status).toBe(200);
    expect(base.e).toHaveLength(0);
    expect(base.enqueue).not.toHaveBeenCalled();
  });

  it("réel éteint, ou notice vide : refusé", async () => {
    const q = questionnaire();
    expect((await post(q, CHARGE())).status).toBe(404);
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    expect((await post(q, CHARGE())).status).toBe(404);
    expect(base.e).toHaveLength(0);
  });

  it("réel : enregistre CHIFFRÉ, repasse « à traiter », aucune notification", async () => {
    allumer();
    const q = questionnaire();
    expect((await post(q, CHARGE("emp", "m1"))).status).toBe(200);
    expect(base.e).toHaveLength(1);
    const stocke = String(base.e[0]?.["donnees"]);
    expect(stocke.startsWith("enc:v1:")).toBe(true);
    expect(stocke).not.toContain("SECRET-DE-LA-REPONSE");
    expect(dechiffrerParole(stocke)).toContain("SECRET-DE-LA-REPONSE");
    expect(base.e[0]).toMatchObject({ mode: "emp", membre: "m1" });
    expect(q["luLe"]).toBeNull();
    expect(base.enqueue).not.toHaveBeenCalled();
  });

  it("brouillon, clos ou expiré : refusé", async () => {
    allumer();
    expect((await post(questionnaire({ envoyeLe: null }), CHARGE())).status).toBe(404);
    expect((await post(questionnaire({ closLe: new Date() }), CHARGE())).status).toBe(404);
    expect(
      (await post(questionnaire({ expireLe: new Date(Date.now() - 1000) }), CHARGE())).status,
    ).toBe(404);
    expect(base.e).toHaveLength(0);
  });

  it("la limite de 60 réponses par questionnaire est tenue", async () => {
    allumer();
    const q = questionnaire();
    for (let i = 0; i < ENVOIS_MAX_PAR_QUESTIONNAIRE; i++) {
      base.e.push({ questionnaireId: q["id"], recuLe: new Date(), mode: "emp", donnees: "x" });
    }
    expect((await post(q, CHARGE())).status).toBe(429);
    expect(base.e).toHaveLength(ENVOIS_MAX_PAR_QUESTIONNAIRE);
    const r = await enregistrerReponse(q as never, { mode: "emp", membre: null, json: CHARGE() });
    expect(r).toBe("trop");
  });

  it("répond en CORS à l'origine opaque du bac à sable, et à elle seule", async () => {
    allumer();
    const q = questionnaire();
    const r = await post(q, CHARGE());
    expect(r.headers.get("access-control-allow-origin")).toBe("null");
    const o = OPTIONS();
    expect(o.status).toBe(204);
    expect(o.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });
});

describe("la page publique", () => {
  it("est servie en bac à sable, sans cookie ni référent", async () => {
    allumer();
    const r = await get(questionnaire(), "?ref=refpreaudit1");
    expect(r.status).toBe(200);
    const csp = r.headers.get("content-security-policy") ?? "";
    expect(csp).toBe(CSP_PAGE_PREAUDIT);
    expect(csp).toContain("sandbox allow-scripts allow-forms");
    expect(csp).not.toContain("allow-same-origin");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("le réel est introuvable : éteint, brouillon, clos, expiré", async () => {
    expect((await get(questionnaire(), "?ref=refpreaudit1")).status).toBe(404);
    allumer();
    expect((await get(questionnaire({ envoyeLe: null }), "?ref=refpreaudit1")).status).toBe(404);
    expect((await get(questionnaire({ closLe: new Date() }), "?ref=refpreaudit1")).status).toBe(
      404,
    );
    expect(
      (await get(questionnaire({ expireLe: new Date(Date.now() - 1) }), "?ref=refpreaudit1"))
        .status,
    ).toBe(404);
  });

  it("l'essai passe même en brouillon et éteint, avec bandeau", async () => {
    const r = await get(questionnaire({ envoyeLe: null }), "?essai=1&ref=refpreaudit1");
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("ESSAI");
  });

  it("impose la référence commune par redirection", async () => {
    allumer();
    const r = await get(questionnaire(), "?s=1");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toContain("ref=refpreaudit1");
  });
});

describe("les actions de la console", () => {
  it("le dépôt est réservé à Williams : un administrateur est refusé, rien n'est écrit", async () => {
    base.acces.mockResolvedValue({ userId: "u2", role: "admin" });
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("super-administrateur");
    expect(base.q).toHaveLength(0);
  });

  it("sans session : refusé avant toute écriture", async () => {
    base.acces.mockRejectedValue(new Error("Session expirée"));
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("Session expirée");
    expect(base.q).toHaveLength(0);
  });

  it("Williams dépose : brouillon créé ; un fichier qui n'est pas le questionnaire est refusé", async () => {
    await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML], "q.html") }),
      ),
    );
    expect(base.q).toHaveLength(1);
    expect(base.q[0]?.["envoyeLe"]).toBeNull();
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File(["<p>x</p>"], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("erreur");
  });

  it("redépôt possible après un envoi SANS réponse : nouvel identifiant, ancien lien mort", async () => {
    allumer();
    const ancien = questionnaire();
    const ancienId = ancien["id"] as string;
    base.outbox.push(
      { entityType: "QuestionnaireAvantAudit", entityId: ancienId, statut: "a_valider" },
      { entityType: "QuestionnaireAvantAudit", entityId: ancienId, statut: "envoye" },
    );
    base.enqueue.mockClear();
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    const decode = decodeURIComponent(url);
    expect(decode).toContain("l'ancien lien ne marche plus");
    // seul l'e-mail EN ATTENTE est rejeté (pas supprimé) ; celui déjà envoyé n'est pas touché
    expect(decode).toContain("1 e-mail(s) en attente");
    expect(base.outbox.map((x) => x["statut"])).toEqual(["refuse", "envoye"]);
    expect(base.outbox[0]?.["refuseMotif"]).toContain("redéposé");
    expect(base.enqueue).not.toHaveBeenCalled();
    expect(base.q).toHaveLength(1);
    expect(base.q[0]?.["id"]).not.toBe(ancienId);
    expect(base.q[0]?.["envoyeLe"]).toBeNull();
    // l'ancien lien est introuvable
    const vieux = {
      params: Promise.resolve({ id: ancienId, jeton: jetonPreaudit(ancienId) ?? "" }),
    };
    const r = await POST(
      new Request("http://localhost/api/q", { method: "POST", body: CHARGE() }),
      vieux,
    );
    expect(r.status).toBe(404);
    expect(base.e).toHaveLength(0);
  });

  it("sans e-mail en attente, aucun avertissement sur la corbeille", async () => {
    questionnaire();
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("l'ancien lien ne marche plus");
    expect(decodeURIComponent(url)).not.toContain("e-mail(s)");
  });

  it("réponse insérée entre le comptage et la suppression : dépôt refusé, réponse conservée", async () => {
    const q = questionnaire();
    base.apresCount = () =>
      base.e.push({ questionnaireId: q["id"], recuLe: new Date(), mode: "main", donnees: "x" });
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("déjà reçu des réponses");
    expect(base.q).toHaveLength(1);
    expect(base.q[0]?.["id"]).toBe(q["id"]);
    expect(base.e).toHaveLength(1);
  });

  it("une réponse tardive pour un questionnaire redéposé est REFUSÉE, jamais perdue en silence", async () => {
    allumer();
    const ancien = questionnaire();
    await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    // la ligne a disparu : le verrou ne trouve rien
    const r = await enregistrerReponse(
      { id: ancien["id"] as string },
      { mode: "emp", membre: null, json: CHARGE() },
    );
    expect(r).toBe("ferme");
    expect(base.e).toHaveLength(0);
  });

  it("redépôt refusé dès qu'une réponse existe", async () => {
    const q = questionnaire();
    base.e.push({ questionnaireId: q["id"], recuLe: new Date(), mode: "main", donnees: "x" });
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("déjà reçu des réponses");
    expect(base.q[0]?.["id"]).toBe(q["id"]);
    expect(base.q[0]?.["html"]).toBe(HTML);
    expect(base.e).toHaveLength(1);
  });

  it("envoyer et clore exigent l'accès aux échanges", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null });
    base.acces.mockRejectedValue(new Error("Accès refusé"));
    await redirige(() =>
      envoyerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, destinataire: "a@b.fr", prenom: "A" }),
      ),
    );
    await redirige(() => cloreQuestionnaireAction(formulaire({ rencontreId: RENCONTRE })));
    expect(base.enqueue).not.toHaveBeenCalled();
    expect(q["closLe"]).toBeNull();
  });

  it("clore ferme le lien", async () => {
    allumer();
    const q = questionnaire();
    await redirige(() => cloreQuestionnaireAction(formulaire({ rencontreId: RENCONTRE })));
    expect(q["closLe"]).toBeInstanceOf(Date);
    expect((await post(q, CHARGE())).status).toBe(404);
  });
});

describe("l'envoi par clic", () => {
  const args = (q: Ligne) => ({
    questionnaireId: q["id"] as string,
    destinataire: "Client@Exemple.fr",
    prenom: "Sam",
  });

  it("refusé éteint, puis notice vide : rien en file", async () => {
    const q = questionnaire({ envoyeLe: null });
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow(/éteint/);
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow(/RGPD/);
    expect(base.enqueue).not.toHaveBeenCalled();
  });

  it("une mise en file, adresse gardée CHIFFRÉE + empreinte, expiration posée", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null, expireLe: null });
    await envoyerQuestionnaire(args(q));
    expect(base.enqueue).toHaveBeenCalledOnce();
    expect(base.enqueue.mock.calls[0]?.[0]).toBe("questionnaire-avant-audit");
    expect(base.enqueue.mock.calls[0]?.[1]).toBe("client@exemple.fr");
    expect(q["envoyeLe"]).toBeInstanceOf(Date);
    expect(q["expireLe"]).toBeInstanceOf(Date);
    expect(String(q["destinataire"]).startsWith("enc:v1:")).toBe(true);
    expect(String(q["destinataire"])).not.toContain("exemple.fr");
    expect(dechiffrerParole(String(q["destinataire"]))).toBe("client@exemple.fr");
    expect(typeof q["destinataireHash"]).toBe("string");
  });

  it("double clic : un seul e-mail, et le jobId est celui de l'envoi réservé", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null });
    await envoyerQuestionnaire(args(q));
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow(/patientez/);
    expect(base.enqueue).toHaveBeenCalledOnce();
    const jobId = (base.enqueue.mock.calls[0]?.[4] as { jobId: string }).jobId;
    expect(jobId).toBe(`preaudit-${q["id"]}-${(q["envoyeLe"] as Date).getTime()}`);
  });

  it("file refusée : l'état « envoyé » est remis comme avant", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null, expireLe: null });
    base.enqueue.mockResolvedValue({ enqueued: false });
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow(/mis en file/);
    expect(q["envoyeLe"]).toBeNull();
    expect(q["expireLe"]).toBeNull();
  });
});

describe("l'envoi : corbeille de validation, rollback complet, changement d'adresse", () => {
  const args = (q: Ligne, destinataire = "client@exemple.fr") => ({
    questionnaireId: q["id"] as string,
    destinataire,
    prenom: "Sam",
  });

  it("retenu dans la corbeille : le questionnaire RESTE envoyé, sans contournement", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null, expireLe: null });
    base.enqueue.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o1" });
    await expect(envoyerQuestionnaire(args(q))).resolves.toBe("retenu_corbeille");
    expect(q["envoyeLe"]).toBeInstanceOf(Date);
    expect(q["expireLe"]).toBeInstanceOf(Date);
    expect(base.enqueue).toHaveBeenCalledOnce();
    const options = base.enqueue.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(options["bypassValidation"]).toBeUndefined();
  });

  it("envoi normal : « envoye »", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null });
    await expect(envoyerQuestionnaire(args(q))).resolves.toBe("envoye");
  });

  it("adresse retenue : le vrai motif est affiché et l'état est rétabli", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null, expireLe: null });
    base.enqueue.mockResolvedValue({ enqueued: false, retenu: "adresse_morte" });
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow(/adresse_morte/);
    expect(q["envoyeLe"]).toBeNull();
  });

  it("l'échec rétablit AUSSI la clôture et l'ancienne adresse", async () => {
    allumer();
    const clos = new Date("2026-10-01");
    const q = questionnaire({
      envoyeLe: new Date(Date.now() - 3_600_000),
      closLe: clos,
      destinataire: "enc:v1:ancienne",
      destinataireHash: "hash-ancien",
    });
    base.enqueue.mockResolvedValue({ enqueued: false });
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow();
    expect(q["closLe"]).toEqual(clos);
    expect(q["destinataire"]).toBe("enc:v1:ancienne");
    expect(q["destinataireHash"]).toBe("hash-ancien");
  });

  it("une exception de la file rétablit aussi l'état", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null, closLe: new Date("2026-10-01") });
    base.enqueue.mockRejectedValue(new Error("redis"));
    await expect(envoyerQuestionnaire(args(q))).rejects.toThrow(/redis/);
    expect(q["envoyeLe"]).toBeNull();
    expect(q["closLe"]).toBeInstanceOf(Date);
  });

  it("refuse de changer d'adresse dès qu'un envoi a abouti, même sans réponse", async () => {
    allumer();
    await envoyerQuestionnaire(args(questionnaire({ envoyeLe: null }), "premiere@exemple.fr"));
    const q = base.q[0] as Ligne;
    q["envoyeLe"] = new Date(Date.now() - 3_600_000);
    base.enqueue.mockClear();
    await expect(envoyerQuestionnaire(args(q, "autre@exemple.fr"))).rejects.toThrow(
      /déposez-le de nouveau/,
    );
    expect(base.enqueue).not.toHaveBeenCalled();
    // la même adresse, elle, peut recevoir un renvoi
    await expect(envoyerQuestionnaire(args(q, "premiere@exemple.fr"))).resolves.toBe("envoye");
  });

  it("l'effacement du dirigeant (empreinte à NULL) ne libère pas la garde", async () => {
    allumer();
    await envoyerQuestionnaire(args(questionnaire({ envoyeLe: null }), "premiere@exemple.fr"));
    const q = base.q[0] as Ligne;
    q["envoyeLe"] = new Date(Date.now() - 3_600_000);
    q["destinataire"] = null;
    q["destinataireHash"] = null;
    base.enqueue.mockClear();
    await expect(envoyerQuestionnaire(args(q, "autre@exemple.fr"))).rejects.toThrow(
      /déposez-le de nouveau/,
    );
    expect(base.enqueue).not.toHaveBeenCalled();
  });

  it("jamais envoyé : l'adresse est libre", async () => {
    allumer();
    const q = questionnaire({ envoyeLe: null });
    await expect(envoyerQuestionnaire(args(q, "n-importe@exemple.fr"))).resolves.toBe("envoye");
  });
});

describe("la purge de rétention", () => {
  it("supprime les réponses plus anciennes que la date, garde les autres", async () => {
    base.e.push(
      { id: "a", recuLe: new Date("2020-01-01") },
      { id: "b", recuLe: new Date("2026-10-01") },
    );
    expect(await purgerReponsesAnciennes(new Date("2025-01-01"))).toBe(1);
    expect(base.e.map((x) => x["id"])).toEqual(["b"]);
  });
});
