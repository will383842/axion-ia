// Réponses manuelles (submission-reply, candidature-reponse) : UN SEUL ENVOI (PR-W).
//
// Chaque cas passe pour LES DEUX gabarits. Doublures : Prisma à état partagé en mémoire,
// Redis en mémoire (set NX/EX, get, del), `sendEmail` qui se résout au tick suivant.
//   W1  erreur au 1er essai          → ligne `pending`, « nouvel essai automatique », erreur relevée
//   W2  erreur au dernier essai      → `failed` + `failedAt`, erreur relevée
//   W3  déjà parti                   → aucun envoi, rien levé (+ réparation `sent`)
//   W4  verrou déjà pris             → aucun envoi, ligne intacte, rien levé
//   W5  deux jobs ensemble           → un seul `sendEmail`, ligne `sent`
//   W6  essai 1 en échec puis essai 2 → un seul envoi abouti
//   W7  ancien worker (failed, sentAt vide) → un seul envoi dans les deux ordres, et en parallèle
//   W8  écriture `sent` en échec ×3  → un seul envoi, rien levé, Sentry, verrou libéré
//   W9  Redis en erreur              → aucun envoi, erreur relevée
//   W10 verrou libéré seulement si le jeton est le nôtre
//   W11 ancien payload accepté tel quel
//   W12-W22 addendum W1 : verrou orphelin, marqueur, issue inconnue, DelayedError, defa
//   W23-W42 addendum 2 W1 : motif figé, classement des erreurs, sonde du détenteur, contre-vérification,
//           clôture à l'échec final, reports croissants, épingles sur bullmq / nodemailer
import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Ligne = {
  id: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  deliveryStatus: string;
  sentAt: Date | null;
  providerMessageId: string | null;
  failedAt: Date | null;
  errorMsg: string | null;
  retryCount: number;
};

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  capture: vi.fn(),
  lignes: {} as Record<string, Record<string, unknown>>,
  echecsEcritureSent: { n: 0 },
  echecsEcritureFailed: { n: 0 },
  redisGetErreur: { filtre: null as null | ((k: string) => boolean) },
  redisEvalErreur: { v: null as Error | null },
  redisMap: new Map<string, { v: string; expireAt: number | null }>(),
  redisSetErreur: { v: null as Error | null },
  redisSetErreurMarqueur: { n: 0 },
  handlers: {} as Record<string, (...a: unknown[]) => unknown>,
  submissionUpdate: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(evt: string, fn: (...a: unknown[]) => unknown): this {
      d.handlers[evt] = fn;
      return this;
    }
  },
  DelayedError: class DelayedError extends Error {
    constructor() {
      super("DelayedError");
      this.name = "DelayedError";
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({
  captureWorkerError: (...a: unknown[]) => d.capture(...a),
}));
vi.mock("../../lib/sanitize-job-data", async (orig) => ({
  ...(await orig<typeof import("../../lib/sanitize-job-data")>()),
  redactEmailValue: (v: string) => v,
}));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v === null ? null : String(v).replace(/^chiffre\(|\)$/g, "")),
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/server/email/verdict-envoi", () => ({
  dateDeMiseAEcart: vi.fn().mockResolvedValue(null),
  estSollicitationSoumiseAOpposition: vi.fn().mockReturnValue(false),
  verdictAvantEnvoi: vi.fn(),
}));
/** Doublure Redis : expiration paresseuse selon `Date.now()` (les tests utilisent `vi.setSystemTime`). */
function vivante(k: string): { v: string; expireAt: number | null } | undefined {
  const e = d.redisMap.get(k);
  if (e && e.expireAt !== null && e.expireAt <= Date.now()) {
    d.redisMap.delete(k);
    return undefined;
  }
  return e;
}
vi.mock("@/lib/redis", () => ({
  redis: {
    set: async (k: string, v: string, _ex: string, ttl: number, nx?: string) => {
      if (d.redisSetErreur.v) throw d.redisSetErreur.v;
      if (k.startsWith("envoye:") && d.redisSetErreurMarqueur.n > 0) {
        d.redisSetErreurMarqueur.n--;
        throw new Error("redis marqueur indisponible");
      }
      if (nx === "NX" && vivante(k)) return null;
      d.redisMap.set(k, { v, expireAt: Date.now() + ttl * 1000 });
      return "OK";
    },
    get: async (k: string) => {
      if (d.redisGetErreur.filtre?.(k)) throw new Error("redis lecture");
      return vivante(k)?.v ?? null;
    },
    del: async (k: string) => (d.redisMap.delete(k) ? 1 : 0),
    pttl: async (k: string) => {
      if (d.redisGetErreur.filtre?.(k)) throw new Error("redis lecture");
      const e = vivante(k);
      if (!e) return -2;
      return e.expireAt === null ? -1 : e.expireAt - Date.now();
    },
    eval: async (_script: string, _n: number, k: string, arg: string) => {
      if (d.redisEvalErreur.v) throw d.redisEvalErreur.v;
      return vivante(k)?.v === arg ? (d.redisMap.delete(k), 1) : 0;
    },
  },
}));

/** updateMany à état partagé : applique `where` (id, sentAt null / not null, statut in) puis `data`. */
function table(nom: string) {
  return {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const l = d.lignes[nom];
      if (!l || l["id"] !== where.id) return null;
      return { ...l, submission: { id: "s-1", firstRepliedAt: null } };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const l = d.lignes[nom];
      if (!l || l["id"] !== where["id"]) return { count: 0 };
      if (data["deliveryStatus"] === "failed" && d.echecsEcritureFailed.n > 0) {
        d.echecsEcritureFailed.n--;
        throw new Error("base indisponible");
      }
      if (data["deliveryStatus"] === "sent" && data["sentAt"] && d.echecsEcritureSent.n > 0) {
        d.echecsEcritureSent.n--;
        throw new Error("base indisponible");
      }
      if ("sentAt" in where) {
        const c = where["sentAt"];
        if (c === null && l["sentAt"] !== null) return { count: 0 };
        if (c !== null && typeof c === "object" && l["sentAt"] === null) return { count: 0 };
      }
      const st = where["deliveryStatus"] as { in: string[] } | undefined;
      if (st && !st.in.includes(l["deliveryStatus"] as string)) return { count: 0 };
      for (const [k, v] of Object.entries(data)) {
        l[k] =
          v && typeof v === "object" && "increment" in (v as object)
            ? (l[k] as number) + (v as { increment: number }).increment
            : v;
      }
      return { count: 1 };
    },
  };
}
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionReply: table("submissionReply"),
    jobApplicationReply: table("jobApplicationReply"),
    submission: { update: (...a: unknown[]) => d.submissionUpdate(...a) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: vi.fn(),
  noterTentativeEchouee: vi.fn(),
  marquerAnnule: vi.fn(),
}));

import { dateDeMiseAEcart } from "@/server/email/verdict-envoi";
import {
  startEmailWorker,
  classerEchecEnvoi,
  MOTIF_ISSUE_INCONNUE as MOTIF,
  MOTIF_REDIS_INDISPONIBLE,
  MOTIF_ECHEC_SANS_ENVOI,
  PREFIXE_ISSUE_INCONNUE,
} from "../email-worker";

type Processeur = (job: Record<string, unknown>, token?: string) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

const GABARITS = [
  { template: "submission-reply", nom: "submissionReply", payload: { replyId: "r-1" } },
  { template: "candidature-reponse", nom: "jobApplicationReply", payload: { replyId: "r-1" } },
] as const;

function job(g: (typeof GABARITS)[number], over: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    name: g.template,
    data: { template: g.template, to: "", locale: "fr", payload: g.payload },
    attemptsMade: 0,
    attemptsStarted: 1,
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
    opts: { attempts: 5 },
    ...over,
  };
}

function poser(g: (typeof GABARITS)[number], over: Partial<Ligne> = {}) {
  d.lignes[g.nom] = {
    id: "r-1",
    toEmail: "chiffre(nadia@exemple.fr)",
    subject: "Re",
    bodyHtml: "<p>x</p>",
    bodyText: "x",
    deliveryStatus: "pending",
    sentAt: null,
    providerMessageId: null,
    failedAt: null,
    errorMsg: null,
    retryCount: 0,
    ...over,
  };
  return d.lignes[g.nom] as Ligne;
}

const MAINTENANT = new Date("2026-11-17T10:00:00Z");
const MIN = 60_000;
const cleVerrou = (g: (typeof GABARITS)[number]) => `verrou:envoi-reponse:${g.template}:r-1`;
const cleMarqueur = (g: (typeof GABARITS)[number]) => `envoye:envoi-reponse:${g.template}:r-1`;
/** Refus du relais (4xx/5xx) : il n'a pas pris le message, un nouvel essai est permis. */
const refusSmtp = (msg: string, responseCode: number) =>
  Object.assign(new Error(msg), { code: "EENVELOPE", responseCode, command: "RCPT TO" });
/** Pose un verrou tenu par un autre démarrage, âgé de `ageMs` (TTL 24 h, comme le worker). */
function poserVerrou(g: (typeof GABARITS)[number], jeton: string, ageMs: number) {
  d.redisMap.set(cleVerrou(g), { v: jeton, expireAt: Date.now() + 86_400_000 - ageMs });
}
const erreurDe = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as Error,
  );

let livres = 0;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  d.lignes = {};
  d.echecsEcritureSent.n = 0;
  d.echecsEcritureFailed.n = 0;
  d.redisGetErreur.filtre = null;
  d.redisEvalErreur.v = null;
  d.redisMap.clear();
  d.redisSetErreur.v = null;
  d.redisSetErreurMarqueur.n = 0;
  d.handlers = {};
  d.submissionUpdate.mockResolvedValue({});
  livres = 0;
  d.sendEmail.mockImplementation(
    () =>
      new Promise((r) =>
        setTimeout(() => {
          livres++;
          r({ messageId: "<m1>" });
        }, 0),
      ),
  );
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
});

describe.each(GABARITS)("$template : un seul envoi", (g) => {
  it("W1 : erreur au 1er essai → reste pending, « nouvel essai automatique », erreur relevée", async () => {
    const l = poser(g);
    d.sendEmail.mockRejectedValueOnce(refusSmtp("smtp 421", 421));
    await expect(processeur()(job(g))).rejects.toThrow("smtp 421");
    expect(l.deliveryStatus).toBe("pending");
    expect(l.failedAt).toBeNull();
    expect(l.errorMsg).toContain("nouvel essai automatique");
    expect(l.errorMsg).toContain("Essai 1/5");
    expect(l.retryCount).toBe(1);
    expect(l.errorMsg).not.toContain("nadia@exemple.fr");
    expect(d.redisMap.has(cleVerrou(g))).toBe(false);
  });

  it("W2 : erreur au dernier essai → failed + failedAt, erreur relevée", async () => {
    const l = poser(g);
    d.sendEmail.mockRejectedValueOnce(refusSmtp("smtp 550", 550));
    await expect(processeur()(job(g, { attemptsMade: 4 }))).rejects.toThrow("smtp 550");
    expect(l.deliveryStatus).toBe("failed");
    expect(l.failedAt).toBeInstanceOf(Date);
    expect(l.errorMsg).toBe("smtp 550");
    expect(l.errorMsg).not.toContain("@");
  });

  it.each([
    ["sent", { deliveryStatus: "sent", sentAt: new Date() }],
    ["bounced", { deliveryStatus: "bounced" }],
    ["pending avec sentAt", { sentAt: new Date("2026-11-01T10:00:00Z") }],
    ["pending avec providerMessageId", { providerMessageId: "<deja>" }],
  ] as const)("W3 : ligne %s → aucun envoi, rien levé", async (_nom, over) => {
    const l = poser(g, over as Partial<Ligne>);
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    if (_nom === "pending avec sentAt") expect(l.deliveryStatus).toBe("sent");
    if (_nom === "bounced") expect(l.deliveryStatus).toBe("bounced");
  });

  it("W4 : verrou de 1 min tenu par un autre → aucun envoi, ligne intacte, report sans essai", async () => {
    const l = poser(g);
    poserVerrou(g, "autre-jeton", 1 * MIN);
    const avant = { ...l };
    const j = job(g);
    const e = await erreurDe(processeur()(j, "tok"));
    expect(e?.name).toBe("DelayedError");
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(l).toEqual(avant);
    const mv = j.moveToDelayed as ReturnType<typeof vi.fn>;
    expect(mv).toHaveBeenCalledTimes(1);
    const [ts, token] = mv.mock.calls[0] as [number, string];
    expect(ts).toBeGreaterThanOrEqual(Date.now() + 15_000);
    expect(ts).toBeLessThanOrEqual(Date.now() + 300_000);
    expect(token).toBe("tok");
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("autre-jeton");
    expect(d.capture).not.toHaveBeenCalled();
  });

  it("W5 : deux jobs ensemble → le second est reporté, relancé il ne renvoie rien, un seul sendEmail", async () => {
    const l = poser(g);
    const p = processeur();
    const j2 = job(g, { id: "job-2" });
    const [r1, r2] = await Promise.all([erreurDe(p(job(g, { id: "job-1" }))), erreurDe(p(j2))]);
    expect(r1).toBeNull();
    expect(r2?.name).toBe("DelayedError");
    await p(j2); // le second job est relancé
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(livres).toBe(1);
    expect(l.deliveryStatus).toBe("sent");
    expect(l.sentAt).toBeInstanceOf(Date);
  });

  it("W6 : essai 1 en échec (pending) puis essai 2 qui réussit → un seul envoi abouti", async () => {
    const l = poser(g);
    const p = processeur();
    d.sendEmail.mockRejectedValueOnce(refusSmtp("smtp 421", 421));
    await expect(p(job(g))).rejects.toThrow();
    expect(l.deliveryStatus).toBe("pending"); // pas `failed` : aucun rejeu ne l'accepte
    await p(job(g, { attemptsMade: 1 }));
    expect(livres).toBe(1);
    expect(l.deliveryStatus).toBe("sent");
  });

  describe("W7 : ancien worker (failed, sentAt vide) puis l'application repasse pending", () => {
    it.each([
      ["job 1 puis job 2", ["job-1", "job-2"]],
      ["job 2 puis job 1", ["job-2", "job-1"]],
    ])("l'un après l'autre (%s) → un seul envoi", async (_n, ordre) => {
      const l = poser(g, { deliveryStatus: "failed", failedAt: new Date(), errorMsg: "ancien" });
      l.deliveryStatus = "pending"; // geste de l'application
      const p = processeur();
      for (const id of ordre) await p(job(g, { id, attemptsMade: 1 }));
      expect(livres).toBe(1);
      expect(l.deliveryStatus).toBe("sent");
    });
    it("en même temps → un seul envoi", async () => {
      const l = poser(g, { deliveryStatus: "failed", failedAt: new Date() });
      l.deliveryStatus = "pending";
      const p = processeur();
      const j2 = job(g, { id: "job-2" });
      const [r1, r2] = await Promise.all([
        erreurDe(p(job(g, { id: "job-1", attemptsMade: 1 }))),
        erreurDe(p(j2)),
      ]);
      expect(r1).toBeNull();
      expect(r2?.name).toBe("DelayedError");
      await p(j2);
      expect(livres).toBe(1);
      expect(l.deliveryStatus).toBe("sent");
    });
    it("ligne encore `failed` (l'ancienne application met en file avant de repasser pending) → part", async () => {
      const l = poser(g, { deliveryStatus: "failed", failedAt: new Date() });
      await processeur()(job(g));
      expect(livres).toBe(1);
      expect(l.deliveryStatus).toBe("sent");
    });
  });

  it("W8 : écriture sent en échec ×3 → un seul envoi, verrou GARDÉ, report, Sentry avec le job", async () => {
    const l = poser(g);
    d.echecsEcritureSent.n = 3;
    const j = job(g);
    const e = await erreurDe(processeur()(j));
    expect(e?.name).toBe("DelayedError");
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(j.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(d.capture).toHaveBeenCalledTimes(1);
    expect(d.capture.mock.calls[0]?.[2]).toBe(j);
    expect(l.deliveryStatus).toBe("pending");
    expect(d.redisMap.has(cleVerrou(g))).toBe(true);
  });

  it("W8bis : l'écriture sent réussit au 2e essai → ligne sent, pas de Sentry", async () => {
    const l = poser(g);
    d.echecsEcritureSent.n = 1;
    await processeur()(job(g));
    expect(l.deliveryStatus).toBe("sent");
    expect(d.capture).not.toHaveBeenCalled();
    expect(d.redisMap.has(cleVerrou(g))).toBe(false);
  });

  it("W9 : Redis en erreur à la prise du verrou → aucun envoi, erreur relevée", async () => {
    poser(g);
    d.redisSetErreur.v = new Error("redis down");
    await expect(processeur()(job(g))).rejects.toThrow("redis down");
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W10 : le verrou n'est libéré que si le jeton correspond", async () => {
    poser(g);
    const cle = `verrou:envoi-reponse:${g.template}:r-1`;
    d.sendEmail.mockImplementationOnce(async () => {
      expect(d.redisMap.get(cle)?.v).toBe("job-1-1-1"); // jeton = <job.id>-<essai>-<démarrage>
      d.redisMap.set(cle, { v: "jeton-d-un-autre", expireAt: null }); // le TTL a expiré, un autre a repris le verrou
      return { messageId: "<m>" };
    });
    await processeur()(job(g));
    expect(d.redisMap.get(cle)?.v).toBe("jeton-d-un-autre");
  });

  it("W10bis : le verrou est libéré quand le jeton est le nôtre", async () => {
    poser(g);
    await processeur()(job(g));
    expect(d.redisMap.has(cleVerrou(g))).toBe(false);
  });

  it("W11 : l'ancien payload { replyId, subject, submissionId | applicationId } est accepté", async () => {
    const l = poser(g);
    const ancien =
      g.template === "submission-reply"
        ? { replyId: "r-1", subject: "Re", submissionId: "s-1" }
        : { replyId: "r-1", subject: "Re", applicationId: "a-1" };
    await processeur()({
      ...job(g),
      data: { template: g.template, to: "", locale: "fr", payload: ancien },
    });
    expect(livres).toBe(1);
    expect(l.deliveryStatus).toBe("sent");
  });

  it("W12 : verrou orphelin (31 min), pas de marqueur → failed + motif, verrou supprimé, Sentry, rien levé", async () => {
    const l = poser(g);
    poserVerrou(g, "job-0-1-1", 31 * MIN);
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg?.startsWith(MOTIF)).toBe(true);
    expect(l.failedAt).toBeInstanceOf(Date);
    expect(d.redisMap.has(cleVerrou(g))).toBe(false);
    expect(d.capture).toHaveBeenCalledTimes(1);
  });

  it("W13 : verrou orphelin et marqueur présent → sent avec le messageId du marqueur, rien levé", async () => {
    const l = poser(g);
    poserVerrou(g, "job-0-1-1", 31 * MIN);
    d.redisMap.set(cleMarqueur(g), { v: "<du-marqueur>", expireAt: null });
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(l.deliveryStatus).toBe("sent");
    expect(l.providerMessageId).toBe("<du-marqueur>");
  });

  it("W14 : failed « issue inconnue » sans verrou → aucun envoi ; après « Réessayer » → un seul envoi", async () => {
    const l = poser(g, { deliveryStatus: "failed", failedAt: new Date(), errorMsg: MOTIF });
    const p = processeur();
    await expect(p(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    l.deliveryStatus = "pending"; // « Réessayer » simulé
    l.errorMsg = null;
    await p(job(g, { id: "job-2" }));
    expect(livres).toBe(1);
    expect(l.deliveryStatus).toBe("sent");
  });

  it("W15 : relance après blocage → report ; 31 min plus tard issue inconnue, un seul sendEmail", async () => {
    const l = poser(g);
    const p = processeur();
    // 1er démarrage : envoi lancé, le conteneur meurt (verrou laissé, jeton ...-1) → on le simule.
    poserVerrou(g, "job-1-1-1", 2 * MIN);
    d.sendEmail.mockClear();
    livres = 1; // le 1er démarrage a bien appelé sendEmail une fois
    const j2 = job(g, { attemptsStarted: 2 });
    const e = await erreurDe(p(j2));
    expect(e?.name).toBe("DelayedError");
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(l.deliveryStatus).toBe("pending");
    vi.setSystemTime(new Date(MAINTENANT.getTime() + 31 * MIN));
    await expect(p(job(g, { attemptsStarted: 3 }))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(livres).toBe(1);
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg?.startsWith(MOTIF)).toBe(true);
  });

  it("W16 : envoi réussi, écriture sent en échec ×3, marqueur posé → report, verrou gardé ; relance → sent par le marqueur", async () => {
    const l = poser(g);
    d.echecsEcritureSent.n = 3;
    const p = processeur();
    const e = await erreurDe(p(job(g)));
    expect(e?.name).toBe("DelayedError");
    expect(d.redisMap.has(cleVerrou(g))).toBe(true);
    expect(d.redisMap.get(cleMarqueur(g))?.v).toBe("<m1>");
    expect(l.deliveryStatus).toBe("pending");
    await p(job(g, { attemptsStarted: 2 }));
    expect(l.deliveryStatus).toBe("sent");
    expect(l.providerMessageId).toBe("<m1>");
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("W17 : comme W16 mais le marqueur échoue aussi → relance à 31 min : failed + motif, un seul envoi", async () => {
    const l = poser(g);
    d.echecsEcritureSent.n = 3;
    d.redisSetErreurMarqueur.n = 3;
    const p = processeur();
    const e = await erreurDe(p(job(g)));
    expect(e?.name).toBe("DelayedError");
    expect(d.redisMap.has(cleMarqueur(g))).toBe(false);
    vi.setSystemTime(new Date(MAINTENANT.getTime() + 31 * MIN));
    await expect(p(job(g, { attemptsStarted: 2 }))).resolves.toBeUndefined();
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg?.startsWith(MOTIF)).toBe(true);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("W18 : Redis en erreur à la prise du verrou (D4) → dernier essai failed, sinon pending, aucun envoi", async () => {
    const l = poser(g);
    d.redisSetErreur.v = new Error("redis down");
    await expect(processeur()(job(g, { attemptsMade: 4 }))).rejects.toThrow("redis down");
    expect(l.deliveryStatus).toBe("failed");
    expect(l.failedAt).toBeInstanceOf(Date);
    expect(l.errorMsg).toBe(MOTIF_REDIS_INDISPONIBLE);
    const l2 = poser(g);
    await expect(processeur()(job(g, { attemptsMade: 0 }))).rejects.toThrow("redis down");
    expect(l2.deliveryStatus).toBe("pending");
    expect(l2.errorMsg).toBe("Essai 1/5 : verrou d'envoi indisponible, nouvel essai automatique");
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W19 : ligne failed (sans motif), erreur au 1er essai → la ligne passe pending (D5)", async () => {
    const l = poser(g, { deliveryStatus: "failed", failedAt: new Date(), errorMsg: "ancien" });
    d.sendEmail.mockRejectedValueOnce(refusSmtp("smtp 421", 421));
    await expect(processeur()(job(g))).rejects.toThrow("smtp 421");
    expect(l.deliveryStatus).toBe("pending");
  });

  it("W20 : erreur SMTP citant une adresse → errorMsg sans l'adresse (D7), au 1er et au dernier essai", async () => {
    const l = poser(g);
    d.sendEmail.mockRejectedValueOnce(refusSmtp("550 refus pour x@y.fr", 550));
    await expect(processeur()(job(g))).rejects.toThrow();
    expect(l.errorMsg).not.toContain("x@y.fr");
    const l2 = poser(g);
    d.sendEmail.mockRejectedValueOnce(refusSmtp("550 refus pour x@y.fr", 550));
    await expect(processeur()(job(g, { attemptsMade: 4 }))).rejects.toThrow();
    expect(l2.errorMsg).not.toContain("x@y.fr");
  });

  it("W21 : job tué deux fois (defa) → failed + motif, verrou job-1-… supprimé, verrou d'un autre laissé", async () => {
    const l = poser(g);
    processeur();
    const surEchec = d.handlers["failed"] as (j: unknown, e: Error) => void;
    const defa = new Error("job stalled more than allowable limit");
    const j = job(g);
    // verrou d'un autre job : laissé
    poserVerrou(g, "job-9-1-1", 40 * MIN);
    surEchec(j, defa);
    await vi.waitFor(() => expect(l.deliveryStatus).toBe("failed"));
    expect(l.errorMsg?.startsWith(MOTIF)).toBe(true);
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("job-9-1-1");
    // verrou de CE job : supprimé
    poser(g);
    poserVerrou(g, "job-1-1-1", 40 * MIN);
    surEchec(j, defa);
    await vi.waitFor(() => expect(d.redisMap.has(cleVerrou(g))).toBe(false));
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W22 : un sent tardif après « issue inconnue » efface errorMsg et failedAt", async () => {
    const l = poser(g, { deliveryStatus: "failed", failedAt: new Date(), errorMsg: MOTIF });
    d.redisMap.set(cleMarqueur(g), { v: "<tardif>", expireAt: null }); // l'envoi vivait encore
    await processeur()(job(g));
    expect(l.deliveryStatus).toBe("sent");
    expect(l.providerMessageId).toBe("<tardif>");
    expect(l.errorMsg).toBeNull();
    expect(l.failedAt).toBeNull();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W23 : ligne failed dont errorMsg commence par le préfixe → aucun envoi, rien levé", async () => {
    poser(g, {
      deliveryStatus: "failed",
      failedAt: new Date(),
      errorMsg: PREFIXE_ISSUE_INCONNUE + "autre texte",
    });
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W25 : erreur d'envoi ambiguë au 1er essai → issue inconnue tout de suite, aucun nouvel essai", async () => {
    const l = poser(g);
    const p = processeur();
    const j = job(g);
    d.sendEmail.mockRejectedValueOnce(
      Object.assign(new Error("Timeout"), { code: "ETIMEDOUT", command: "CONN" }),
    );
    await expect(p(j)).resolves.toBeUndefined();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg).toBe(MOTIF);
    expect(l.failedAt).toBeInstanceOf(Date);
    expect(l.retryCount).toBe(0);
    expect(d.redisMap.has(cleVerrou(g))).toBe(false);
    expect(d.capture).toHaveBeenCalledTimes(2);
    expect(j.moveToDelayed).not.toHaveBeenCalled();
    await p(job(g, { id: "job-2" }));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("W26 : comme W25, écriture failed en échec → report 60 s, verrou gardé, ligne pending", async () => {
    const l = poser(g);
    d.echecsEcritureFailed.n = 1;
    d.sendEmail.mockRejectedValueOnce(
      Object.assign(new Error("Timeout"), { code: "ETIMEDOUT", command: "CONN" }),
    );
    const j = job(g);
    const e = await erreurDe(processeur()(j));
    expect(e?.name).toBe("DelayedError");
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("job-1-1-1");
    expect(l.deliveryStatus).toBe("pending");
    expect((j.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      Date.now() + 60_000,
    );
  });

  it("W27 : verrou de 31 min mais verrou BullMQ tenu par un autre passage → report 5 min ; clé disparue → issue inconnue", async () => {
    const l = poser(g);
    poserVerrou(g, "job-7-1-1", 31 * MIN);
    const cleBull = "bull:emails:job-7:lock";
    d.redisMap.set(cleBull, { v: "autre-token", expireAt: null });
    const p = processeur();
    const j = job(g, { id: "job-7" });
    const e = await erreurDe(p(j, "tok"));
    expect(e?.name).toBe("DelayedError");
    expect((j.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      Date.now() + 300_000,
    );
    expect(l.deliveryStatus).toBe("pending");
    expect(l.errorMsg).toBeNull();
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("job-7-1-1");
    expect(d.sendEmail).not.toHaveBeenCalled();
    d.redisMap.delete(cleBull);
    await expect(p(job(g, { id: "job-7", attemptsStarted: 2 }), "tok")).resolves.toBeUndefined();
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg).toBe(MOTIF);
    expect(d.redisMap.has(cleVerrou(g))).toBe(false);
  });

  it("W28 : le verrou BullMQ porte NOTRE jeton (relance après blocage) → mort : failed, sans report", async () => {
    const l = poser(g);
    poserVerrou(g, "job-1-1-1", 31 * MIN);
    d.redisMap.set("bull:emails:job-1:lock", { v: "tok", expireAt: null });
    const j = job(g, { attemptsStarted: 2 });
    await expect(processeur()(j, "tok")).resolves.toBeUndefined();
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg).toBe(MOTIF);
    expect(j.moveToDelayed).not.toHaveBeenCalled();
  });

  it("W29 : jobId avec tirets (email-<uuid>) → la sonde le lit, détenteur vivant, report", async () => {
    poser(g);
    poserVerrou(g, "email-3f2a-9c1d-1-2", 31 * MIN);
    d.redisMap.set("bull:emails:email-3f2a-9c1d:lock", { v: "x", expireAt: null });
    const e = await erreurDe(processeur()(job(g), "tok"));
    expect(e?.name).toBe("DelayedError");
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W30 : la sonde échoue (Redis) → rien n'est envoyé ni supprimé, ligne pending avec la note, erreur relevée", async () => {
    const l = poser(g);
    poserVerrou(g, "job-7-1-1", 31 * MIN);
    d.redisGetErreur.filtre = (k) => k.startsWith("bull:");
    await expect(processeur()(job(g), "tok")).rejects.toThrow("redis lecture");
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("job-7-1-1");
    expect(l.deliveryStatus).toBe("pending");
    expect(l.errorMsg).toBe("Essai 1/5 : verrou d'envoi indisponible, nouvel essai automatique");
  });

  it("W31 : le verrou est perdu entre la prise et l'envoi (contre-vérification) → aucun envoi, Sentry, ligne pending", async () => {
    const l = poser(g);
    vi.mocked(dateDeMiseAEcart).mockImplementationOnce(async () => {
      d.redisMap.set(cleVerrou(g), { v: "voleur", expireAt: null });
      return null;
    });
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("voleur");
    expect(d.capture).toHaveBeenCalledTimes(1);
    expect(l.deliveryStatus).toBe("pending");
  });

  it("W32 : échec final (finishedOn), ligne pending, ni verrou ni marqueur → failed avec le motif « rien n'est parti »", async () => {
    const l = poser(g);
    processeur();
    const surEchec = d.handlers["failed"] as (j: unknown, e: Error) => void;
    surEchec(job(g, { finishedOn: Date.now(), attemptsMade: 5 }), new Error("lecture"));
    await vi.waitFor(() => expect(l.deliveryStatus).toBe("failed"));
    expect(l.errorMsg).toBe(MOTIF_ECHEC_SANS_ENVOI);
  });

  it("W33 : échec final avec un verrou jeune → issue inconnue, verrou gardé ; verrou de 31 min → supprimé", async () => {
    const l = poser(g);
    processeur();
    const surEchec = d.handlers["failed"] as (j: unknown, e: Error) => void;
    const j = job(g, { finishedOn: Date.now(), attemptsMade: 5 });
    poserVerrou(g, "job-1-1-1", 5 * MIN);
    surEchec(j, new Error("lecture"));
    await vi.waitFor(() => expect(l.deliveryStatus).toBe("failed"));
    expect(l.errorMsg).toBe(MOTIF);
    expect(d.redisMap.has(cleVerrou(g))).toBe(true);
    poser(g);
    poserVerrou(g, "job-1-1-1", 31 * MIN);
    surEchec(j, new Error("lecture"));
    await vi.waitFor(() => expect(d.redisMap.has(cleVerrou(g))).toBe(false));
  });

  it("W34 : échec final avec marqueur présent → sent avec le messageId du marqueur", async () => {
    const l = poser(g);
    d.redisMap.set(cleMarqueur(g), { v: "<du-marqueur>", expireAt: null });
    processeur();
    (d.handlers["failed"] as (j: unknown, e: Error) => void)(
      job(g, { finishedOn: Date.now() }),
      new Error("lecture"),
    );
    await vi.waitFor(() => expect(l.deliveryStatus).toBe("sent"));
    expect(l.providerMessageId).toBe("<du-marqueur>");
  });

  it("W35 : échec final, ligne déjà failed avec le vrai message SMTP → inchangée", async () => {
    const l = poser(g, { deliveryStatus: "failed", failedAt: new Date(), errorMsg: "smtp 550" });
    processeur();
    (d.handlers["failed"] as (j: unknown, e: Error) => void)(
      job(g, { finishedOn: Date.now() }),
      new Error("smtp 550"),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg).toBe("smtp 550");
  });

  it("W36 : échec non final (pas de finishedOn) → ligne pending inchangée", async () => {
    const l = poser(g);
    processeur();
    (d.handlers["failed"] as (j: unknown, e: Error) => void)(job(g), new Error("smtp"));
    await new Promise((r) => setTimeout(r, 20));
    expect(l.deliveryStatus).toBe("pending");
    expect(l.errorMsg).toBeNull();
  });

  it("W37 : échec final, lectures Redis en erreur → failed avec le motif issue inconnue", async () => {
    const l = poser(g);
    d.redisGetErreur.filtre = () => true;
    processeur();
    (d.handlers["failed"] as (j: unknown, e: Error) => void)(
      job(g, { finishedOn: Date.now() }),
      new Error("lecture"),
    );
    await vi.waitFor(() => expect(l.deliveryStatus).toBe("failed"));
    expect(l.errorMsg).toBe(MOTIF);
  });

  it("W38 : lecture du marqueur en erreur → 1er essai pending avec la note, dernier essai failed avec le motif Redis", async () => {
    const l = poser(g);
    d.redisGetErreur.filtre = (k) => k.startsWith("envoye:");
    await expect(processeur()(job(g))).rejects.toThrow("redis lecture");
    expect(l.deliveryStatus).toBe("pending");
    expect(l.errorMsg).toContain("verrou d'envoi indisponible");
    await expect(processeur()(job(g, { attemptsMade: 4 }))).rejects.toThrow("redis lecture");
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg).toBe(MOTIF_REDIS_INDISPONIBLE);
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("W39 : suppression du verrou impossible → ligne failed avec le motif, verrou présent, Sentry ×2, rien levé", async () => {
    const l = poser(g);
    poserVerrou(g, "job-0-1-1", 31 * MIN);
    d.redisEvalErreur.v = new Error("eval impossible");
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(l.deliveryStatus).toBe("failed");
    expect(l.errorMsg).toBe(MOTIF);
    expect(d.redisMap.has(cleVerrou(g))).toBe(true);
    expect(d.capture).toHaveBeenCalledTimes(2);
  });

  it("W40 : relance après blocage (jeton job-1-1-2 pris pendant l'envoi) → verrou du relanceur gardé, ligne sent", async () => {
    const l = poser(g);
    d.sendEmail.mockImplementationOnce(async () => {
      d.redisMap.set(cleVerrou(g), { v: "job-1-1-2", expireAt: null });
      return { messageId: "<m>" };
    });
    await processeur()(job(g));
    expect(d.redisMap.get(cleVerrou(g))?.v).toBe("job-1-1-2");
    expect(l.deliveryStatus).toBe("sent");
  });

  it("W41 : reports d'écriture croissants (×2 par démarrage, plafonné à 30 min)", async () => {
    poser(g);
    d.echecsEcritureSent.n = 3;
    const j1 = job(g, { attemptsStarted: 4 });
    await erreurDe(processeur()(j1));
    expect((j1.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      Date.now() + 480_000,
    );
    d.redisMap.clear();
    poser(g);
    d.echecsEcritureSent.n = 3;
    const j2 = job(g, { attemptsStarted: 20 });
    await erreurDe(processeur()(j2));
    expect((j2.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
      Date.now() + 1_800_000,
    );
  });
});

const lireFichier = (chemin: string) => readFileSync(`${process.cwd()}/${chemin}`, "utf8");

describe("addendum 2 : motifs, classement, épingles", () => {
  it("W23-texte : motifs exacts, courts, sans mot interdit", () => {
    const consigne =
      "Avant de réessayer, cherchez le destinataire dans ZeptoMail (page E-mails envoyés, bouton ZeptoMail, onglet Processed emails), pas dans la boîte Zoho. S'il y figure, ne réessayez pas.";
    expect(MOTIF).toBe(
      "[issue-inconnue] Envoi interrompu, on ne sait pas si l'e-mail est parti. " + consigne,
    );
    expect(MOTIF.startsWith("[issue-inconnue] ")).toBe(true);
    expect(MOTIF).toContain("ZeptoMail");
    expect(MOTIF).toContain("Processed emails");
    for (const m of [MOTIF, MOTIF_REDIS_INDISPONIBLE, MOTIF_ECHEC_SANS_ENVOI]) {
      expect(m.length).toBeLessThanOrEqual(300);
      expect(m).not.toMatch(/qualiopi|opco|prise en charge|financeur/i);
    }
  });

  const err = (o: Record<string, unknown>, message = "x") => Object.assign(new Error(message), o);
  it.each([
    [err({ code: "EENVELOPE", responseCode: 550, command: "RCPT TO" })],
    [err({ code: "EENVELOPE", responseCode: 421, command: "MAIL FROM" })],
    [err({ code: "EENVELOPE", responseCode: 554, command: "DATA" })],
    [err({ code: "EMESSAGE", responseCode: 552, command: "DATA" })],
    [err({ code: "ECONNECTION", responseCode: 421, command: "CONN" })],
    [err({ code: "EPROTOCOL", responseCode: 554, command: "CONN" })],
    [err({ code: "EAUTH", responseCode: 535, command: "AUTH PLAIN" })],
    [err({ code: "EAUTH" })],
    [err({ code: "EDNS" })],
    [err({ code: "ETLS" })],
    [err({ code: "EENVELOPE" })],
    [err({ code: "EMESSAGE" }, "Empty message")],
    [err({ code: "ESOCKET", syscall: "connect" })],
    [err({ code: "ETIMEDOUT" }, "Connection timeout")],
    [err({ code: "ETIMEDOUT" }, "Greeting never received")],
    [new Error("[email] configuration SMTP incomplète en production : …")],
  ])("W24 : rien_parti (%#)", (e) => {
    expect(classerEchecEnvoi(e)).toBe("rien_parti");
  });
  it.each([
    [err({ code: "ETIMEDOUT", command: "CONN" }, "Timeout")],
    [err({ code: "ECONNECTION", command: "CONN" }, "Connection closed unexpectedly")],
    [err({ code: "ESOCKET", syscall: "read" })],
    [err({ code: "ESOCKET", syscall: "write" })],
    [err({ code: "ESTREAM" })],
    [err({ code: "EPROTOCOL" }, "Unexpected Response")],
    [err({ code: "EMAXLIMIT" })],
    [new Error("smtp 421")],
    [err({ responseCode: "550" })],
    [err({ responseCode: 250 })],
    ["x"],
    [undefined],
  ])("W24 : ambigu (%#)", (e) => {
    expect(classerEchecEnvoi(e)).toBe("ambigu");
  });

  it("W42 : épingles sur les textes de bullmq et de nodemailer dont le worker dépend", () => {
    expect(
      lireFichier("node_modules/bullmq/dist/cjs/commands/moveStalledJobsToWait-9.lua"),
    ).toContain("job stalled more than allowable limit");
    expect(lireFichier("node_modules/bullmq/dist/cjs/classes/queue-base.js")).toContain(
      "prefix: 'bull'",
    );
    expect(lireFichier("node_modules/bullmq/dist/cjs/classes/scripts.js")).toContain("':lock'");
    expect(lireFichier("src/lib/email/client.ts")).toContain(
      "[email] configuration SMTP incomplète",
    );
  });
});
