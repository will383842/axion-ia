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
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  redisMap: new Map<string, string>(),
  redisSetErreur: { v: null as Error | null },
  submissionUpdate: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({
  captureWorkerError: (...a: unknown[]) => d.capture(...a),
}));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
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
vi.mock("@/lib/redis", () => ({
  redis: {
    set: async (k: string, v: string, _ex: string, _ttl: number, nx: string) => {
      if (d.redisSetErreur.v) throw d.redisSetErreur.v;
      if (nx === "NX" && d.redisMap.has(k)) return null;
      d.redisMap.set(k, v);
      return "OK";
    },
    get: async (k: string) => d.redisMap.get(k) ?? null,
    del: async (k: string) => (d.redisMap.delete(k) ? 1 : 0),
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

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;
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

let livres = 0;
beforeEach(() => {
  vi.clearAllMocks();
  d.lignes = {};
  d.echecsEcritureSent.n = 0;
  d.redisMap.clear();
  d.redisSetErreur.v = null;
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

describe.each(GABARITS)("$template : un seul envoi", (g) => {
  it("W1 : erreur au 1er essai → reste pending, « nouvel essai automatique », erreur relevée", async () => {
    const l = poser(g);
    d.sendEmail.mockRejectedValueOnce(new Error("smtp 421"));
    await expect(processeur()(job(g))).rejects.toThrow("smtp 421");
    expect(l.deliveryStatus).toBe("pending");
    expect(l.failedAt).toBeNull();
    expect(l.errorMsg).toContain("nouvel essai automatique");
    expect(l.errorMsg).toContain("Essai 1/5");
    expect(l.retryCount).toBe(1);
    expect(d.redisMap.size).toBe(0);
  });

  it("W2 : erreur au dernier essai → failed + failedAt, erreur relevée", async () => {
    const l = poser(g);
    d.sendEmail.mockRejectedValueOnce(new Error("smtp 550"));
    await expect(processeur()(job(g, { attemptsMade: 4 }))).rejects.toThrow("smtp 550");
    expect(l.deliveryStatus).toBe("failed");
    expect(l.failedAt).toBeInstanceOf(Date);
    expect(l.errorMsg).toBe("smtp 550");
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

  it("W4 : verrou déjà pris → aucun envoi, ligne intacte, rien levé", async () => {
    const l = poser(g);
    d.redisMap.set(`verrou:envoi-reponse:${g.template}:r-1`, "autre-jeton");
    const avant = { ...l };
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(l).toEqual(avant);
    expect(d.redisMap.get(`verrou:envoi-reponse:${g.template}:r-1`)).toBe("autre-jeton");
  });

  it("W5 : deux jobs ensemble → sendEmail exactement une fois, ligne sent", async () => {
    const l = poser(g);
    const p = processeur();
    await Promise.all([p(job(g, { id: "job-1" })), p(job(g, { id: "job-2" }))]);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(livres).toBe(1);
    expect(l.deliveryStatus).toBe("sent");
    expect(l.sentAt).toBeInstanceOf(Date);
  });

  it("W6 : essai 1 en échec (pending) puis essai 2 qui réussit → un seul envoi abouti", async () => {
    const l = poser(g);
    const p = processeur();
    d.sendEmail.mockRejectedValueOnce(new Error("smtp 421"));
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
      await Promise.all([p(job(g, { id: "job-1", attemptsMade: 1 })), p(job(g, { id: "job-2" }))]);
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

  it("W8 : écriture sent en échec ×3 → un seul envoi, rien levé, Sentry, verrou libéré", async () => {
    const l = poser(g);
    d.echecsEcritureSent.n = 3;
    await expect(processeur()(job(g))).resolves.toBeUndefined();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.capture).toHaveBeenCalledTimes(1);
    expect(l.deliveryStatus).toBe("pending");
    expect(d.redisMap.size).toBe(0);
  });

  it("W8bis : l'écriture sent réussit au 2e essai → ligne sent, pas de Sentry", async () => {
    const l = poser(g);
    d.echecsEcritureSent.n = 1;
    await processeur()(job(g));
    expect(l.deliveryStatus).toBe("sent");
    expect(d.capture).not.toHaveBeenCalled();
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
      expect(d.redisMap.get(cle)).toBe("job-1-1"); // jeton = <job.id>-<essai>
      d.redisMap.set(cle, "jeton-d-un-autre"); // le TTL a expiré, un autre a repris le verrou
      return { messageId: "<m>" };
    });
    await processeur()(job(g));
    expect(d.redisMap.get(cle)).toBe("jeton-d-un-autre");
  });

  it("W10bis : le verrou est libéré quand le jeton est le nôtre", async () => {
    poser(g);
    await processeur()(job(g));
    expect(d.redisMap.size).toBe(0);
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
});
