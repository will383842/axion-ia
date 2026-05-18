// Sprint S+3 P0-1 (audit 2026-05-18 09-ADMIN-UI §2.7) — Tests durcissement
// updateProvider + resetProviderSpend.
//
// Couvre :
//   1. updateProvider → audit log écrit avec diff oldValue → newValue
//   2. updateProvider → rate-limit déclenche throw (rate_limited:*) sans
//      écriture Prisma ni audit log
//   3. resetProviderSpend → audit log écrit avec oldSpend → 0
//   4. resetProviderSpend → rate-limit (10/h strict) déclenche throw
//   5. Anti-régression : validation `monthly_cap_out_of_range` + `model_required`
//   6. Best-effort audit log (Prisma audit log down → update OK quand même)

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  authMock,
  checkRateLimitMock,
  providerUpdateMock,
  providerFindUniqueMock,
  auditLogCreateMock,
  revalidatePathMock,
  headersMock,
} = vi.hoisted(() => {
  return {
    authMock: vi.fn<
      () => Promise<{
        user: { id: string; email: string; role: string };
      } | null>
    >(async () => ({
      user: { id: "user-uuid-1", email: "admin@axion-ia.com", role: "admin" },
    })),
    checkRateLimitMock: vi.fn<
      (
        key: string,
        config: { limit: number; windowSec: number },
      ) => Promise<{ allowed: boolean; count: number; remaining: number; resetAt: number }>
    >(async () => ({
      allowed: true,
      count: 1,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    })),
    providerUpdateMock: vi.fn(async (_args: unknown) => ({ id: "prov-1" })),
    providerFindUniqueMock: vi.fn(async (_args: unknown) => ({
      enabled: false,
      model: "claude-3-5-sonnet-20241022",
      monthlyCapUsd: { toString: () => "200.00" },
      currentMonthSpentUsd: { toString: () => "42.50" },
      rateLimitRpm: 60,
    })),
    auditLogCreateMock: vi.fn(async (_args: unknown) => ({ id: "audit-1" })),
    revalidatePathMock: vi.fn(),
    headersMock: vi.fn<() => Promise<Headers>>(async () => new Headers()),
  };
});

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, config: { limit: number; windowSec: number }) =>
    checkRateLimitMock(key, config),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerConfig: {
      update: (args: unknown) => providerUpdateMock(args),
      findUnique: (args: unknown) => providerFindUniqueMock(args),
    },
    contentGenAuditLog: {
      create: (args: unknown) => auditLogCreateMock(args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

import { updateProvider, resetProviderSpend } from "../providers";

const SESSION = { user: { id: "user-uuid-1", email: "admin@axion-ia.com", role: "admin" } };

beforeEach(() => {
  authMock.mockClear();
  authMock.mockImplementation(async () => SESSION);
  checkRateLimitMock.mockClear();
  checkRateLimitMock.mockImplementation(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  }));
  providerUpdateMock.mockClear();
  providerUpdateMock.mockImplementation(async () => ({ id: "prov-1" }));
  providerFindUniqueMock.mockClear();
  providerFindUniqueMock.mockImplementation(async () => ({
    enabled: false,
    model: "claude-3-5-sonnet-20241022",
    monthlyCapUsd: { toString: () => "200.00" },
    currentMonthSpentUsd: { toString: () => "42.50" },
    rateLimitRpm: 60,
  }));
  auditLogCreateMock.mockClear();
  auditLogCreateMock.mockImplementation(async () => ({ id: "audit-1" }));
  revalidatePathMock.mockClear();
  headersMock.mockClear();
  headersMock.mockImplementation(async () => new Headers());
});

describe("updateProvider — P0-1 rate-limit + SOC2 audit log", () => {
  it("update OK + audit log écrit avec diff oldValue → newValue", async () => {
    await updateProvider({
      id: "prov-1",
      enabled: true,
      model: "claude-opus-4-1",
      monthlyCapUsd: 500,
      rateLimitRpm: 120,
    });

    // 1. Rate-limit appelé avec key isolation par providerId
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    const [rlKey, rlConfig] = checkRateLimitMock.mock.calls[0]! as [
      string,
      { limit: number; windowSec: number },
    ];
    expect(rlKey).toBe("admin:write:user-uuid-1:updateProvider:prov-1");
    expect(rlConfig.limit).toBe(60); // default
    expect(rlConfig.windowSec).toBe(60);

    // 2. Prisma update appelé
    expect(providerUpdateMock).toHaveBeenCalledTimes(1);
    const updateCall = providerUpdateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateCall.where.id).toBe("prov-1");
    expect(updateCall.data.enabled).toBe(true);
    expect(updateCall.data.model).toBe("claude-opus-4-1");
    expect(updateCall.data.monthlyCapUsd).toBe(500);
    expect(updateCall.data.rateLimitRpm).toBe(120);

    // 3. Audit log écrit avec diff
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const auditCall = auditLogCreateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data.action).toBe("updateProvider");
    expect(auditCall.data.settingKey).toBe("provider:prov-1");
    expect(auditCall.data.actorUserId).toBe("user-uuid-1");
    expect(auditCall.data.actorEmail).toBe("admin@axion-ia.com");
    const oldValue = auditCall.data.oldValue as Record<string, unknown>;
    expect(oldValue.enabled).toBe(false);
    expect(oldValue.model).toBe("claude-3-5-sonnet-20241022");
    expect(oldValue.monthlyCapUsd).toBe("200.00");
    expect(oldValue.rateLimitRpm).toBe(60);
    const newValue = auditCall.data.newValue as Record<string, unknown>;
    expect(newValue.enabled).toBe(true);
    expect(newValue.model).toBe("claude-opus-4-1");
    expect(newValue.monthlyCapUsd).toBe(500);
    expect(newValue.rateLimitRpm).toBe(120);

    // 4. revalidatePath appelé
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limited → throw 'rate_limited:*' sans update ni audit log", async () => {
    checkRateLimitMock.mockImplementation(async () => ({
      allowed: false,
      count: 61,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    }));

    await expect(
      updateProvider({
        id: "prov-1",
        enabled: true,
        model: "claude-opus-4-1",
        monthlyCapUsd: 500,
      }),
    ).rejects.toThrow(/^rate_limited:updateProvider:prov-1:61\/60$/);

    // Bloqué AVANT toute écriture Prisma ou audit log
    expect(providerFindUniqueMock).not.toHaveBeenCalled();
    expect(providerUpdateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("update OK même si audit log Prisma down (best-effort fail-soft)", async () => {
    auditLogCreateMock.mockImplementation(async () => {
      throw new Error("audit log table unavailable");
    });

    // L'update principal NE DOIT PAS échouer
    await expect(
      updateProvider({
        id: "prov-1",
        enabled: true,
        model: "claude-opus-4-1",
        monthlyCapUsd: 500,
      }),
    ).resolves.toBeUndefined();

    expect(providerUpdateMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
  });

  it("throw 'monthly_cap_out_of_range' si cap > 100 000 USD", async () => {
    await expect(
      updateProvider({
        id: "prov-1",
        enabled: true,
        model: "claude-opus-4-1",
        monthlyCapUsd: 200_000,
      }),
    ).rejects.toThrow("monthly_cap_out_of_range");
    expect(providerUpdateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it("throw 'model_required' si model trop court", async () => {
    await expect(
      updateProvider({
        id: "prov-1",
        enabled: true,
        model: "x",
        monthlyCapUsd: 500,
      }),
    ).rejects.toThrow("model_required");
    expect(providerUpdateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it("throw 'unauthorized' si pas de session admin", async () => {
    authMock.mockImplementation(
      async () => null as unknown as { user: { id: string; email: string; role: string } },
    );
    await expect(
      updateProvider({
        id: "prov-1",
        enabled: true,
        model: "claude-opus-4-1",
        monthlyCapUsd: 500,
      }),
    ).rejects.toThrow("unauthorized");
    expect(providerUpdateMock).not.toHaveBeenCalled();
  });
});

describe("resetProviderSpend — P0-1 rate-limit strict 10/h + audit log", () => {
  it("reset OK + audit log écrit avec oldSpend → 0", async () => {
    await resetProviderSpend("prov-1");

    // 1. Rate-limit serré 10/3600s
    expect(checkRateLimitMock).toHaveBeenCalledTimes(1);
    const [rlKey, rlConfig] = checkRateLimitMock.mock.calls[0]! as [
      string,
      { limit: number; windowSec: number },
    ];
    expect(rlKey).toBe("admin:write:user-uuid-1:resetProviderSpend:prov-1");
    expect(rlConfig.limit).toBe(10);
    expect(rlConfig.windowSec).toBe(3600);

    // 2. Prisma update reset à 0
    expect(providerUpdateMock).toHaveBeenCalledTimes(1);
    const updateCall = providerUpdateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: { currentMonthSpentUsd: number };
    };
    expect(updateCall.where.id).toBe("prov-1");
    expect(updateCall.data.currentMonthSpentUsd).toBe(0);

    // 3. Audit log avec ancien spend capturé
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const auditCall = auditLogCreateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(auditCall.data.action).toBe("resetProviderSpend");
    expect(auditCall.data.settingKey).toBe("provider:prov-1");
    expect(auditCall.data.actorUserId).toBe("user-uuid-1");
    const oldValue = auditCall.data.oldValue as Record<string, unknown>;
    expect(oldValue.currentMonthSpentUsd).toBe("42.50");
    const newValue = auditCall.data.newValue as Record<string, unknown>;
    expect(newValue.currentMonthSpentUsd).toBe("0");

    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limited (>10/h) → throw sans update ni audit log", async () => {
    checkRateLimitMock.mockImplementation(async () => ({
      allowed: false,
      count: 11,
      remaining: 0,
      resetAt: Date.now() + 1_800_000,
    }));

    await expect(resetProviderSpend("prov-1")).rejects.toThrow(
      /^rate_limited:resetProviderSpend:prov-1:11\/10$/,
    );

    expect(providerFindUniqueMock).not.toHaveBeenCalled();
    expect(providerUpdateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it("reset OK même si audit log Prisma down (best-effort fail-soft)", async () => {
    auditLogCreateMock.mockImplementation(async () => {
      throw new Error("audit log table unavailable");
    });

    await expect(resetProviderSpend("prov-1")).resolves.toBeUndefined();
    expect(providerUpdateMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledTimes(1);
  });

  it("throw 'forbidden' si rôle reader (pas admin)", async () => {
    authMock.mockImplementation(async () => ({
      user: { id: "reader-1", email: "reader@axion-ia.com", role: "reader" },
    }));
    await expect(resetProviderSpend("prov-1")).rejects.toThrow("forbidden");
    expect(providerUpdateMock).not.toHaveBeenCalled();
  });
});
