/**
 * Rejeu d'une réponse à une demande : la reprise `failed` → `pending` est une
 * prise atomique (`updateMany` conditionnel). Aucun `update` sans condition.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const enqueue = vi.fn();
const find = vi.fn();
const updateMany = vi.fn();
const update = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueue(...a) }));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionReply: {
      findUnique: (...a: unknown[]) => find(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));

import { retryFailedReplyAction } from "../reply-actions";

function ligne(statut: string) {
  return {
    id: "r1",
    subject: "S",
    submissionId: "s1",
    deliveryStatus: statut,
    submission: { id: "s1", locale: "fr" },
  };
}

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ user: { id: "u1", role: "admin", name: "Fondateur" } });
  enqueue.mockReset().mockResolvedValue({ enqueued: true });
  find.mockReset();
  update.mockReset();
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("retryFailedReplyAction — prise atomique", () => {
  it("🔴 A1 : deux rejeux simultanés, un seul passe", async () => {
    find.mockResolvedValue(ligne("failed"));
    // État partagé : la première prise trouve `failed`, la seconde non.
    let statut = "failed";
    updateMany.mockImplementation(async (arg: { where: { deliveryStatus: string } }) => {
      if (arg.where.deliveryStatus === statut) {
        statut = "pending";
        return { count: 1 };
      }
      return { count: 0 };
    });
    const [a, b] = await Promise.all([retryFailedReplyAction("r1"), retryFailedReplyAction("r1")]);
    expect([a, b]).toContainEqual({ ok: true });
    expect([a, b]).toContainEqual({ ok: false, error: "not_retryable" });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["pending", "bounced"])(
    "A2 : ligne %s : refus, ni écriture ni mise en file",
    async (s) => {
      find.mockResolvedValue(ligne(s));
      expect(await retryFailedReplyAction("r1")).toEqual({ ok: false, error: "not_retryable" });
      expect(updateMany).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["{ enqueued: false }", () => enqueue.mockResolvedValue({ enqueued: false })],
    ["une erreur levée", () => enqueue.mockRejectedValue(new Error("redis"))],
  ])(
    "A3 : la file échoue (%s) : retour en `failed` conditionnel à `pending`",
    async (_n, regler) => {
      find.mockResolvedValue(ligne("failed"));
      regler();
      expect(await retryFailedReplyAction("r1")).toEqual({ ok: false, error: "enqueue_failed" });
      expect(updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: "r1", deliveryStatus: "pending" },
          data: expect.objectContaining({ deliveryStatus: "failed" }),
        }),
      );
      expect(update).not.toHaveBeenCalled();
    },
  );
});
