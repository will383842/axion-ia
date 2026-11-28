// Journal « sent: » exact (W1-S3, 3a) : la ligne ne doit paraître que si un e-mail est réellement
// parti. Avant, elle était écrite à chaque `completed`, même quand le processeur sortait sans envoyer.
//   J1  réponse déjà `sent` (rien à envoyer)         → pas de « sent: »
//   J2  envoi réel (chemin général et réponse)       → « sent: » une fois
//   J3  chemin général retenu (mise à l'écart)       → pas de « sent: »
import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  ecarte: vi.fn(),
  replyFind: vi.fn(),
  handlers: {} as Record<string, (...a: unknown[]) => unknown>,
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
  DelayedError: class DelayedError extends Error {},
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v === null ? null : String(v).replace(/^chiffre\(|\)$/g, "")),
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    emailLog: { findFirst: async () => null },
    emailOpposition: {
      findFirst: (...a: unknown[]) => d.ecarte(...a),
      findUnique: async () => null,
    },
    newsletterSubscriber: { findUnique: async () => null },
    submissionReply: {
      findUnique: (...a: unknown[]) => d.replyFind(...a),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobApplicationReply: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/redis", () => {
  const m = new Map<string, string>();
  return {
    redis: {
      set: async (k: string, v: string) => (m.has(k) ? null : (m.set(k, v), "OK")),
      get: async (k: string) => m.get(k) ?? null,
      del: async (k: string) => (m.delete(k) ? 1 : 0),
      pttl: async (k: string) => (m.has(k) ? 86_400_000 : -2),
      eval: async (_s: string, _n: number, k: string, arg: string) =>
        m.get(k) === arg ? (m.delete(k), 1) : 0,
    },
  };
});
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: vi.fn().mockResolvedValue(undefined),
  noterTentativeEchouee: vi.fn(),
  marquerAnnule: vi.fn().mockResolvedValue(1),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>, token?: string) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}
function job(template: string, to: string) {
  return {
    id: "job-1",
    name: template,
    data: { template, to, locale: "fr", payload: { replyId: "r-1" } },
    attemptsMade: 0,
    attemptsStarted: 1,
    opts: { attempts: 5 },
  };
}
/** Joue le processeur puis l'événement `completed` de BullMQ, avec la MÊME instance de job. */
async function jouerEtCompleter(j: Record<string, unknown>) {
  await processeur()(j);
  d.handlers["completed"]?.(j);
}
const lignesSent = (log: ReturnType<typeof vi.spyOn>) =>
  log.mock.calls.filter((c) => String(c[0]).includes("sent:"));

beforeEach(() => {
  vi.clearAllMocks();
  d.handlers = {};
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["PII_ENCRYPTION_KEY"] ??=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "A" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.ecarte.mockResolvedValue(null);
  d.replyFind.mockResolvedValue({
    id: "r-1",
    submissionId: "s-1",
    toEmail: "chiffre(nadia@exemple.fr)",
    subject: "Re",
    bodyHtml: "<p>x</p>",
    bodyText: "x",
    deliveryStatus: "pending",
    sentAt: null,
    providerMessageId: null,
    submission: { id: "s-1", firstRepliedAt: null },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("journal « sent: » exact", () => {
  it("J1 : réponse déjà envoyée, rien n'est renvoyé → jamais « sent: »", async () => {
    d.replyFind.mockResolvedValue({
      id: "r-1",
      submissionId: "s-1",
      toEmail: "chiffre(nadia@exemple.fr)",
      subject: "Re",
      bodyHtml: "<p>x</p>",
      bodyText: "x",
      deliveryStatus: "sent",
      sentAt: new Date("2026-11-17T09:00:00Z"),
      providerMessageId: "<m0>",
      submission: { id: "s-1", firstRepliedAt: new Date() },
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await jouerEtCompleter(job("submission-reply", ""));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(lignesSent(log)).toHaveLength(0);
    expect(log.mock.calls.some((c) => String(c[0]).includes("terminé sans envoi"))).toBe(true);
  });

  it("J2 : envoi réel (chemin général) → « sent: » une fois", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await jouerEtCompleter(job("session-convocation", "nadia@exemple.fr"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(lignesSent(log)).toHaveLength(1);
  });

  it("J2 : envoi réel (réponse écrite à la main) → « sent: » une fois", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await jouerEtCompleter(job("submission-reply", ""));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(lignesSent(log)).toHaveLength(1);
  });

  it("J3 : chemin général retenu (mise à l'écart) → jamais « sent: »", async () => {
    d.ecarte.mockResolvedValue({ effacementDemandeLe: new Date("2026-11-11T10:00:00Z") });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await jouerEtCompleter(job("session-convocation", "nadia@exemple.fr"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(lignesSent(log)).toHaveLength(0);
  });
});
