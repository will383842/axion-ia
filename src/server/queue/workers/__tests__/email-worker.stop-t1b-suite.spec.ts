// STOP-T1b (suite) — la garde du guide lit AUSSI le journal d'envoi : un envoi `sent` d'un autre job,
// parti après la mise en file de celui-ci, retient le job même si `guideRequest.sentAt` n'a pas été écrit.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  handlers: {} as Record<string, (...a: unknown[]) => void>,
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  annuler: vi.fn(),
  marquer: vi.fn(),
  demande: vi.fn(),
  journal: vi.fn(),
  opposition: vi.fn(),
  ecarte: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(evt: string, fn: (...a: unknown[]) => void): this {
      d.handlers[evt] = fn;
      return this;
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: { findUnique: (...a: unknown[]) => d.demande(...a) },
    emailLog: { findFirst: (...a: unknown[]) => d.journal(...a) },
    emailOpposition: {
      findUnique: (...a: unknown[]) => d.opposition(...a),
      findFirst: (...a: unknown[]) => d.ecarte(...a),
    },
    newsletterSubscriber: { findUnique: async () => null },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));
vi.mock("@/server/guide-ia/journal", () => ({
  marquerGuideEnvoye: (...a: unknown[]) => d.marquer(...a),
}));

import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;

function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls[0]?.[1] as Processeur;
}

const ADRESSE = "nadia@exemple.fr";
const CREATION_JOB = Date.parse("2026-11-10T08:00:00Z");

function jobGuide(): Record<string, unknown> {
  return {
    id: "job-J1",
    name: "guide-ia-envoi",
    timestamp: CREATION_JOB,
    data: {
      template: "guide-ia-envoi",
      to: ADRESSE,
      locale: "fr",
      payload: { downloadToken: "a".repeat(64) },
      entityType: "GuideRequest",
      entityId: "demande-1",
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "B" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.annuler.mockResolvedValue(1);
  d.marquer.mockResolvedValue(undefined);
  d.demande.mockResolvedValue({ sentAt: null });
  d.journal.mockResolvedValue(null);
  d.opposition.mockResolvedValue(null);
  d.ecarte.mockResolvedValue(null);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("garde du guide : le journal d'envoi fait foi quand `sent_at` manque", () => {
  it("doublon J1 après J2 dont `sent_at` a échoué (sentAt null, log `sent` postérieur d'un autre job) : retenu", async () => {
    d.journal.mockResolvedValue({ id: "log-J2" });
    await expect(processeur()(jobGuide())).resolves.toBeUndefined();
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledTimes(1);
    expect(d.annuler.mock.calls[0]?.[0]).toBe("job-J1");
    expect(d.noter).not.toHaveBeenCalled();
    // La requête borne bien : cette demande, statut sent, depuis la création du job, tout job.
    const arg = d.journal.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    const w = JSON.stringify(arg.where);
    expect(w).toContain("GuideRequest");
    expect(w).toContain("demande-1");
    expect(w).toContain("sent");
    expect(w).toContain(new Date(CREATION_JOB).toISOString());
  });

  it("lecture du journal en panne : rien ne part, tentative notée, erreur relancée", async () => {
    d.journal.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(processeur()(jobGuide())).rejects.toThrow("ECONNREFUSED");
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.noter).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("renvoi légitime (nouveau job, aucun log postérieur) : part", async () => {
    await processeur()(jobGuide());
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("ligne `sent` du même jobId, sentAt vide (reprise après chute) : retenu", async () => {
    d.journal.mockResolvedValue({ id: "log-J1-lui-meme" });
    await processeur()(jobGuide());
    expect(d.sendEmail).not.toHaveBeenCalled();
    const w = JSON.stringify((d.journal.mock.calls[0]?.[0] as { where: unknown }).where);
    expect(w).not.toContain("jobId");
  });
});
