// Le worker d'e-mails CLÔT la demande du guide après l'envoi réel (lot L2).
//
// 🔴 Relecture du 24/09 : en supprimant l'appel à `marquerGuideEnvoye`, toute
// la suite du worker restait verte. C'est pourtant le SEUL endroit qui pose
// `sent_at` et `send_count` — et le rattrapage comme la sentinelle en
// dépendent : sans lui, chaque guide parti serait « en attente » pour toujours,
// et le rattrapage le RENVERRAIT au bout d'une heure.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  marquer: vi.fn(),
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
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: vi.fn(), isDecryptedEmailUsable: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: vi.fn(),
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

function job(data: Record<string, unknown>): Record<string, unknown> {
  return { id: "job-1", name: data["template"], data, attemptsMade: 0, opts: { attempts: 5 } };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "B" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.marquer.mockResolvedValue(undefined);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("« Votre guide » : la demande est close APRÈS l'envoi réel", () => {
  it("🔴 un envoi réussi du guide appelle marquerGuideEnvoye(demande)", async () => {
    await processeur()(
      job({
        template: "guide-ia-envoi",
        to: "jeanne@example.invalid",
        locale: "fr",
        payload: { downloadToken: "a".repeat(64) },
        entityType: "GuideRequest",
        entityId: "demande-1",
      }),
    );
    expect(d.marquer).toHaveBeenCalledTimes(1);
    expect(d.marquer).toHaveBeenCalledWith("demande-1");
    // Et APRÈS la clôture du journal : la trace suit l'envoi.
    expect(d.cloturer.mock.invocationCallOrder[0]).toBeLessThan(
      d.marquer.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("un autre gabarit, ou une autre entité, ne touche pas aux demandes du guide", async () => {
    await processeur()(
      job({
        template: "devis-envoi",
        to: "jeanne@example.invalid",
        locale: "fr",
        payload: {},
        entityType: "Quote",
        entityId: "devis-1",
      }),
    );
    expect(d.marquer).not.toHaveBeenCalled();
  });

  it("un envoi ÉCHOUÉ ne clôt rien : le rattrapage doit pouvoir reprendre", async () => {
    d.sendEmail.mockRejectedValue(new Error("SMTP 421"));
    await expect(
      processeur()(
        job({
          template: "guide-ia-envoi",
          to: "jeanne@example.invalid",
          locale: "fr",
          payload: { downloadToken: "a".repeat(64) },
          entityType: "GuideRequest",
          entityId: "demande-1",
        }),
      ),
    ).rejects.toThrow("SMTP 421");
    expect(d.marquer).not.toHaveBeenCalled();
  });

  it("le jeton de la lettre du payload devient l'en-tête One-Click (RFC 8058)", async () => {
    await processeur()(
      job({
        template: "guide-ia-envoi",
        to: "jeanne@example.invalid",
        locale: "fr",
        payload: { downloadToken: "a".repeat(64), unsubscribeToken: "u".repeat(64) },
        entityType: "GuideRequest",
        entityId: "demande-1",
      }),
    );
    expect(d.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribeToken: "u".repeat(64), marketing: false }),
    );
  });
});
