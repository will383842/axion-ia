/**
 * Rejeu d'une réponse à un candidat : seule une ligne `failed` repart.
 * `pending` (déjà en file) et `bounced` (adresse refusée) sont refusées sans
 * mise en file ; la session et le droit sont vérifiés avant toute lecture.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const roleOk = vi.fn();
const replyFind = vi.fn();
const replyUpdateMany = vi.fn();
const enqueue = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/server/auth/habilitations", () => ({
  peutOuvrirDossierCandidat: (r: string) => roleOk(r),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { findUnique: async () => ({ locale: "fr" }) },
    jobApplicationReply: {
      findUnique: (...a: unknown[]) => replyFind(...a),
      updateMany: (...a: unknown[]) => replyUpdateMany(...a),
    },
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/admin/${p}` }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueue(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/features/admin-inbox/cache-tags", () => ({ INBOX_COUNTS_TAG: "t" }));
vi.mock("../envoyer-reponse", () => ({ ecrireEtEnfilerReponse: vi.fn() }));
vi.mock("@/features/job-application/complement", () => ({ lienComplement: vi.fn() }));
vi.mock("@/lib/careers/formateur-freelance", () => ({ estCandidatureFormateurFreelance: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: vi.fn(),
}));

import { rejouerReponseEchoueeAction } from "../reply-actions";

function ligne(statut: string) {
  return { id: "r1", applicationId: "a1", subject: "S", deliveryStatus: statut };
}

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ user: { id: "u1", name: "Fondateur", role: "admin" } });
  roleOk.mockReset().mockReturnValue(true);
  replyFind.mockReset();
  replyUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  enqueue.mockReset().mockResolvedValue({ enqueued: true });
});

describe("rejouerReponseEchoueeAction", () => {
  it.each(["pending", "bounced", "delivered", "complained"])(
    "🔴 un statut %s est refusé, rien n'est mis en file",
    async (statut) => {
      replyFind.mockResolvedValue(ligne(statut));
      const r = await rejouerReponseEchoueeAction("r1");
      expect(r).toEqual({ ok: false, error: "not_retryable" });
      expect(enqueue).not.toHaveBeenCalled();
      expect(replyUpdateMany).not.toHaveBeenCalled();
    },
  );

  it("`sent` reste refusé comme « déjà envoyée »", async () => {
    replyFind.mockResolvedValue(ligne("sent"));
    expect(await rejouerReponseEchoueeAction("r1")).toEqual({ ok: false, error: "deja_envoyee" });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("une ligne `failed` est reprise puis mise en file (une seule fois)", async () => {
    replyFind.mockResolvedValue(ligne("failed"));
    const r = await rejouerReponseEchoueeAction("r1");
    expect(r).toEqual({ ok: true, replyId: "r1" });
    expect(replyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1", deliveryStatus: "failed" } }),
    );
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("🔴 deux rejeux simultanés : le second ne trouve plus `failed` et ne met rien en file", async () => {
    replyFind.mockResolvedValue(ligne("failed"));
    replyUpdateMany.mockResolvedValue({ count: 0 });
    const r = await rejouerReponseEchoueeAction("r1");
    expect(r).toEqual({ ok: false, error: "not_retryable" });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("si la file refuse, la ligne redevient `failed` (rejouable)", async () => {
    replyFind.mockResolvedValue(ligne("failed"));
    enqueue.mockResolvedValue({ enqueued: false });
    const r = await rejouerReponseEchoueeAction("r1");
    expect(r).toMatchObject({ ok: false, error: "enqueue_failed" });
    expect(replyUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "r1", deliveryStatus: "pending" },
        data: expect.objectContaining({ deliveryStatus: "failed" }),
      }),
    );
  });

  it("🔴 sans session ou sans droit : refus avant toute lecture", async () => {
    authMock.mockResolvedValue(null);
    expect((await rejouerReponseEchoueeAction("r1")).ok).toBe(false);
    authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    roleOk.mockReturnValue(false);
    expect(await rejouerReponseEchoueeAction("r1")).toEqual({ ok: false, error: "forbidden" });
    expect(replyFind).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
