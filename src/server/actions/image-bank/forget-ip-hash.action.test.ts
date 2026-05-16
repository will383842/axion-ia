// P0-1 RGPD art. 17 — tests unit Server Action forgetIpHashAction.
//
// Audit V1 verification 2026-05-16 — couverture minimale du P0 bloquant
// merge. Pas de persistance Prisma réelle (mocks), intégration runtime
// validée séparément.

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks — rester en tests purs (auth + zod + revalidateTag + activityLog).
// `vi.hoisted` requis : `vi.mock` est hoisted au top, donc les fn() doivent
// être déclarées via hoisted() pour être accessibles dans le factory mock.
const mocks = vi.hoisted(() => ({
  deleteUsageMany: vi.fn(),
  deleteDownloadMany: vi.fn(),
  activityLogCreate: vi.fn(),
  transaction: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    imageUsageLog: { deleteMany: mocks.deleteUsageMany },
    imageDownloadLog: { deleteMany: mocks.deleteDownloadMany },
    activityLog: { create: mocks.activityLogCreate },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/auth", () => ({
  auth: () => mocks.authMock(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { forgetIpHashAction } from "./forget-ip-hash.action";

const SAMPLE_HASH = "a".repeat(64); // 64 hex chars
const ADMIN_SESSION = { user: { id: "user-uuid-1", role: "admin" } };

function buildFormData(ipHash: string | null): FormData {
  const fd = new FormData();
  if (ipHash !== null) fd.set("ipHash", ipHash);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authMock.mockResolvedValue(ADMIN_SESSION);
  mocks.deleteUsageMany.mockResolvedValue({ count: 3 });
  mocks.deleteDownloadMany.mockResolvedValue({ count: 5 });
  mocks.transaction.mockImplementation(async (ops: Promise<{ count: number }>[]) => {
    // Reproduit la signature $transaction([op1, op2]) → array de résultats.
    return Promise.all(ops);
  });
  mocks.activityLogCreate.mockResolvedValue({ id: "log-uuid" });
});

describe("forgetIpHashAction — P0 RGPD art. 17", () => {
  it("happy path : retourne success + counts deletedLogs", async () => {
    const result = await forgetIpHashAction(buildFormData(SAMPLE_HASH));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deleted.usageLogs).toBe(3);
      expect(result.deleted.downloadLogs).toBe(5);
    }
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "user-uuid-1",
        action: "rgpd.image_bank.forget_ip_hash",
        targetType: "ipHash",
        changes: expect.objectContaining({
          ipHash: SAMPLE_HASH,
          deleted: { usageLogs: 3, downloadLogs: 5 },
          art: "17",
        }),
      }),
    });
  });

  it("refuse session non-authentifiée (forbidden)", async () => {
    mocks.authMock.mockResolvedValueOnce(null);
    const result = await forgetIpHashAction(buildFormData(SAMPLE_HASH));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("forbidden");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.activityLogCreate).not.toHaveBeenCalled();
  });

  it("refuse session role non-admin (forbidden)", async () => {
    mocks.authMock.mockResolvedValueOnce({ user: { id: "u2", role: "editor" } });
    const result = await forgetIpHashAction(buildFormData(SAMPLE_HASH));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("forbidden");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse ipHash absent (Zod validation)", async () => {
    const result = await forgetIpHashAction(buildFormData(null));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/required|SHA-256|input|expected/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse ipHash trop court (Zod regex 64 hex)", async () => {
    const result = await forgetIpHashAction(buildFormData("abc123"));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/SHA-256/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse ipHash non-hex (Zod regex)", async () => {
    const result = await forgetIpHashAction(buildFormData("z".repeat(64)));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/SHA-256/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("accepte ipHash uppercase hex (regex case-insensitive)", async () => {
    const upperHash = "F".repeat(64);
    const result = await forgetIpHashAction(buildFormData(upperHash));

    expect(result.success).toBe(true);
  });

  it("retourne error si Prisma transaction throw", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("DB connection lost"));
    const result = await forgetIpHashAction(buildFormData(SAMPLE_HASH));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("DB connection lost");
    expect(mocks.activityLogCreate).not.toHaveBeenCalled(); // pas appelé après throw transaction
  });

  it("happy path : 0 logs trouvés → success avec counts à 0", async () => {
    mocks.deleteUsageMany.mockResolvedValueOnce({ count: 0 });
    mocks.deleteDownloadMany.mockResolvedValueOnce({ count: 0 });
    const result = await forgetIpHashAction(buildFormData(SAMPLE_HASH));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deleted.usageLogs).toBe(0);
      expect(result.deleted.downloadLogs).toBe(0);
    }
    // Audit trail créé même si 0 logs (preuve de la requête utilisateur).
    expect(mocks.activityLogCreate).toHaveBeenCalled();
  });
});
