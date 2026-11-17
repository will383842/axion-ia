// B2a — la révocation ciblée ne touche qu'un jeton, vivant, et aucun code de signature.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ updateMany: vi.fn(), codes: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSignatureToken: { updateMany: (...a: unknown[]) => h.updateMany(...a) },
    documentSignatureCode: { updateMany: (...a: unknown[]) => h.codes(...a) },
  },
}));

import { revoquerJetonPrecis } from "@/server/qualiopi/documents/signature/token-document";

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("revoquerJetonPrecis", () => {
  it("cible l'id, exige non révoqué et non expiré, ne touche pas aux codes", async () => {
    const maintenant = new Date("2026-11-17T10:00:00Z");
    const n = await revoquerJetonPrecis({ tokenId: "t1", motif: "m", parAdminId: "a", maintenant });
    expect(n).toBe(1);
    const arg = h.updateMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ id: "t1", revokedAt: null, expiresAt: { gt: maintenant } });
    expect(h.codes).not.toHaveBeenCalled();
  });

  it("jeton déjà révoqué ou expiré : le filtre ne trouve rien, 0 rendu", async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    expect(await revoquerJetonPrecis({ tokenId: "t1", motif: "m" })).toBe(0);
  });
});
