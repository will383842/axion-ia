// @vitest-environment node
/**
 * Comportement du questionnaire de pré-audit — le VRAI `serveur.ts`, `envoyer.ts`, `actions.ts` et
 * les deux routes, sur une base en mémoire (seuls Prisma, la file, le limiteur et la session sont
 * remplacés). Couvre : 404/413/400/429, limite de 60, chiffrement, `luLe`, accès aux actions,
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
      delete: async ({ where }: { where: Ligne }) => {
        const l = trouver(base.q, where);
        base.q = base.q.filter((x) => x !== l);
        base.e = base.e.filter((x) => x["questionnaireId"] !== where["id"]);
        return l;
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = base.q.filter((x) => correspond(x, where));
        l.forEach((x) => Object.assign(x, data));
        return { count: l.length };
      },
    },
    questionnaireAvantAuditEnvoi: {
      count: async ({ where }: { where: Ligne }) =>
        base.e.filter((x) => correspond(x, where)).length,
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
import { ENVOIS_MAX_PAR_QUESTIONNAIRE } from "../donnees";
import { envoyerQuestionnaire } from "../envoyer";
import { enregistrerReponse, purgerReponsesAnciennes } from "../serveur";

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
    const gros = "x".repeat(250_000);
    expect((await post(q, gros, "", { "content-length": "250000" })).status).toBe(413);
    expect((await post(q, gros)).status).toBe(413);
    expect(base.e).toHaveLength(0);
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
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    const decode = decodeURIComponent(url);
    expect(decode).toContain("l'ancien lien ne marche plus");
    expect(decode).toContain("E-mails à valider");
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

  it("redépôt refusé dès qu'une réponse existe", async () => {
    const q = questionnaire();
    base.e.push({ questionnaireId: q["id"], recuLe: new Date(), mode: "main", donnees: "x" });
    const url = await redirige(() =>
      deposerQuestionnaireAction(
        formulaire({ rencontreId: RENCONTRE, fichier: new File([HTML + " "], "q.html") }),
      ),
    );
    expect(decodeURIComponent(url)).toContain("des réponses sont arrivées");
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
