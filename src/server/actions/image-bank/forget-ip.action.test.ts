// Correctif P0 audit UX 2026-08 — la page RGPD exigeait un ipHash SHA-256
// qu'un dirigeant non-technicien ne peut jamais produire. `forgetIpAction`
// accepte désormais une adresse IP en clair et hache côté serveur avant de
// déléguer à la même suppression transactionnelle que `forgetIpHashAction`
// (couverte par `forget-ip-hash.action.test.ts`, non modifié).

import { describe, expect, it, vi, beforeEach } from "vitest";

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

// t3-env refuse la lecture d'une variable serveur sous jsdom (« client ») —
// on fixe un sel de test, comme les autres suites qui mockent "@/env".
vi.mock("@/env", () => ({ env: { IP_HASH_SALT: "test-salt" } }));

import { forgetIpAction } from "./forget-ip-hash.action";

const ADMIN_SESSION = { user: { id: "user-uuid-1", role: "admin" } };

function buildFormData(ip: string | null): FormData {
  const fd = new FormData();
  if (ip !== null) fd.set("ip", ip);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authMock.mockResolvedValue(ADMIN_SESSION);
  mocks.deleteUsageMany.mockResolvedValue({ count: 2 });
  mocks.deleteDownloadMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (ops: Promise<{ count: number }>[]) => {
    return Promise.all(ops);
  });
  mocks.activityLogCreate.mockResolvedValue({ id: "log-uuid" });
});

describe("forgetIpAction — P0 RGPD, adresse IP en clair (audit UX 2026-08)", () => {
  it("happy path : IPv4 valide → hash calculé côté serveur, transaction + audit trail", async () => {
    const result = await forgetIpAction(buildFormData("203.0.113.42"));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.deleted.usageLogs).toBe(2);
      expect(result.deleted.downloadLogs).toBe(1);
    }
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "user-uuid-1",
        action: "rgpd.image_bank.forget_ip_hash",
        targetType: "ipHash",
        changes: expect.objectContaining({
          // Le hash n'est jamais l'IP en clair — juste vérifier le format (64 hex).
          ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          deleted: { usageLogs: 2, downloadLogs: 1 },
          art: "17",
        }),
      }),
    });
  });

  it("happy path : IPv6 valide acceptée", async () => {
    const result = await forgetIpAction(buildFormData("2001:db8::1"));
    expect(result.success).toBe(true);
  });

  it("refuse une IP invalide (Zod .ip())", async () => {
    const result = await forgetIpAction(buildFormData("pas-une-ip"));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/IP invalide/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse IP absente (Zod validation)", async () => {
    const result = await forgetIpAction(buildFormData(null));

    expect(result.success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse session non-authentifiée (forbidden)", async () => {
    mocks.authMock.mockResolvedValueOnce(null);
    const result = await forgetIpAction(buildFormData("203.0.113.42"));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("forbidden");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse session role non-admin (forbidden)", async () => {
    mocks.authMock.mockResolvedValueOnce({ user: { id: "u2", role: "editor" } });
    const result = await forgetIpAction(buildFormData("203.0.113.42"));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("forbidden");
  });

  it("même IP → même hash à chaque appel (déterministe, retombe sur les mêmes logs stockés)", async () => {
    await forgetIpAction(buildFormData("198.51.100.7"));
    const firstHash = mocks.deleteUsageMany.mock.calls[0]?.[0]?.where?.ipHash;

    vi.clearAllMocks();
    mocks.authMock.mockResolvedValue(ADMIN_SESSION);
    mocks.deleteUsageMany.mockResolvedValue({ count: 2 });
    mocks.deleteDownloadMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (ops: Promise<{ count: number }>[]) =>
      Promise.all(ops),
    );

    await forgetIpAction(buildFormData("198.51.100.7"));
    const secondHash = mocks.deleteUsageMany.mock.calls[0]?.[0]?.where?.ipHash;

    expect(firstHash).toBe(secondHash);
  });
});
