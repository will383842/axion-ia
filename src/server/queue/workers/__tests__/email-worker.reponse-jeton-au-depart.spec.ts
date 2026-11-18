// I2-0 (tests 6 à 8) : le worker pose le jeton d'opposition de CHAQUE destinataire au départ.
// Le corps substitué n'est jamais écrit en base. Doublures calquées sur
// `email-worker.reponse-manuelle-un-seul-envoi.spec.ts`.
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
  multi: {} as Record<string, Record<string, Record<string, unknown>>>,
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
      const l = d.multi[nom]?.[where.id] ?? d.lignes[nom];
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
      const l = d.multi[nom]?.[where["id"] as string] ?? d.lignes[nom];
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
      if (Array.isArray(where["OR"])) {
        const em = l["errorMsg"] as string | null;
        const ok = (where["OR"] as Record<string, unknown>[]).some((c) => {
          if ("errorMsg" in c && c["errorMsg"] === null) return em === null;
          const n = c["NOT"] as { errorMsg: { startsWith: string } } | undefined;
          // Comme PostgreSQL : `NOT (NULL LIKE …)` vaut NULL, donc faux.
          if (n) return em !== null && !em.startsWith(n.errorMsg.startsWith);
          throw new Error("clause OR non évaluée par la doublure");
        });
        if (!ok) return { count: 0 };
      }
      const st = where["deliveryStatus"] as string | { in: string[] } | undefined;
      if (typeof st === "string" && l["deliveryStatus"] !== st) return { count: 0 };
      if (st && typeof st === "object" && !st.in.includes(l["deliveryStatus"] as string))
        return { count: 0 };
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

import { jetonOpposition, lireJetonOpposition } from "@/server/email/opposition-jeton";
import { startEmailWorker } from "../email-worker";
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
/** Refus du relais (4xx/5xx) : il n'a pas pris le message, un nouvel essai est permis. */
const refusSmtp = (msg: string, responseCode: number) =>
  Object.assign(new Error(msg), { code: "EENVELOPE", responseCode, command: "RCPT TO" });
const erreurDe = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as Error,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  d.lignes = {};
  d.multi = {};
  d.echecsEcritureSent.n = 0;
  d.echecsEcritureFailed.n = 0;
  d.redisGetErreur.filtre = null;
  d.redisEvalErreur.v = null;
  d.redisMap.clear();
  d.redisSetErreur.v = null;
  d.redisSetErreurMarqueur.n = 0;
  d.handlers = {};
  d.submissionUpdate.mockResolvedValue({});
  d.sendEmail.mockImplementation(
    () =>
      new Promise((r) =>
        setTimeout(() => {
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

const REPERE = "AXIONREPEREOPPOSITIONAUDEPART";
const corpsRepere = {
  html: `<p><a href="https://axion-ia.com/api/unsubscribe?token=${REPERE}">stop</a></p>`,
  text: `stop : https://axion-ia.com/api/unsubscribe?token=${REPERE}`,
};
const appels = () =>
  d.sendEmail.mock.calls.map(
    (c) => c[0] as Record<string, unknown> & { html: string; text: string },
  );

describe.each(GABARITS)("$template : jeton posé au départ", (g) => {
  it("6 : sendEmail reçoit le jeton du destinataire (HTML, texte, en-tête) et plus le repère", async () => {
    poser(g, { bodyHtml: corpsRepere.html, bodyText: corpsRepere.text });
    await processeur()(job(g));
    const [a] = appels();
    const jeton = jetonOpposition("nadia@exemple.fr");
    expect(a!.html).toContain(`token=${encodeURIComponent(jeton)}`);
    expect(a!.text).toContain(`token=${encodeURIComponent(jeton)}`);
    expect(a!.html).not.toContain(REPERE);
    expect(a!.text).not.toContain(REPERE);
    expect(a!["unsubscribeToken"]).toBe(jeton);
    expect(lireJetonOpposition(jeton)).toBe("nadia@exemple.fr");
  });

  it("8a : ligne ancienne sans repère : corps envoyé strictement égal", async () => {
    poser(g, { bodyHtml: "<p>ancien</p>", bodyText: "ancien" });
    await processeur()(job(g));
    const [a] = appels();
    expect(a!.html).toBe("<p>ancien</p>");
    expect(a!.text).toBe("ancien");
  });

  it("8b : rejeu après échec SMTP non ambigu : un seul jeton, jamais doublé", async () => {
    poser(g, { bodyHtml: corpsRepere.html, bodyText: corpsRepere.text });
    d.sendEmail.mockRejectedValueOnce(refusSmtp("smtp 421", 421));
    await erreurDe(processeur()(job(g)));
    await processeur()(job(g, { attemptsMade: 1, attemptsStarted: 2 }));
    expect(appels()).toHaveLength(2);
    const jeton = encodeURIComponent(jetonOpposition("nadia@exemple.fr"));
    const second = appels()[1]!;
    expect(second.html.split("token=")).toHaveLength(2);
    expect(second.html.split(jeton)).toHaveLength(2);
    expect(second.text.split("token=")).toHaveLength(2);
  });

  it("8c : le corps substitué n'est jamais écrit en base", async () => {
    const l = poser(g, { bodyHtml: corpsRepere.html, bodyText: corpsRepere.text });
    await processeur()(job(g));
    expect(l.bodyHtml).toBe(corpsRepere.html);
    expect(l.bodyText).toBe(corpsRepere.text);
    expect(l.deliveryStatus).toBe("sent");
  });
});

describe.each(GABARITS)("$template : envoi groupé A/B", (g) => {
  it("7 : chaque courriel porte le jeton de son destinataire, jamais celui de l'autre", async () => {
    const baseA = poser(g, {
      id: "r-A",
      toEmail: "chiffre(a@exemple.fr)",
      bodyHtml: corpsRepere.html,
      bodyText: corpsRepere.text,
    });
    const baseB = { ...baseA, id: "r-B", toEmail: "chiffre(b@exemple.fr)" };
    d.multi[g.nom] = { "r-A": baseA, "r-B": baseB };
    const jA = job(g, {
      id: "jA",
      data: { template: g.template, to: "", locale: "fr", payload: { replyId: "r-A" } },
    });
    const jB = job(g, {
      id: "jB",
      data: { template: g.template, to: "", locale: "fr", payload: { replyId: "r-B" } },
    });
    await Promise.all([processeur()(jA), processeur()(jB)]);
    const parDest = new Map(appels().map((c) => [c["to"] as string, c]));
    const tA = encodeURIComponent(jetonOpposition("a@exemple.fr"));
    const tB = encodeURIComponent(jetonOpposition("b@exemple.fr"));
    expect(parDest.get("a@exemple.fr")!.html).toContain(tA);
    expect(parDest.get("a@exemple.fr")!.html).not.toContain(tB);
    expect(parDest.get("b@exemple.fr")!.html).toContain(tB);
    expect(parDest.get("b@exemple.fr")!.html).not.toContain(tA);
    expect(parDest.get("a@exemple.fr")!["unsubscribeToken"]).toBe(jetonOpposition("a@exemple.fr"));
    expect(parDest.get("b@exemple.fr")!["unsubscribeToken"]).toBe(jetonOpposition("b@exemple.fr"));
  });
});
