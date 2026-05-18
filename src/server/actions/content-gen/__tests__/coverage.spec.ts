/**
 * Sprint S+4-F 2026-05-18 — Tests coverage.ts bypass fix (audit 06 §8.9 P1-1).
 *
 * Avant ce sprint, `resumeCampaign` appelait `prisma.contentGenConfig.upsert(...)`
 * directement → bypass du chokepoint `writeContentGenConfig()` qui empile :
 *   - rate-limit 60 writes/min/admin/key (cf. _auth.ts requireAdminWriteRateLimited)
 *   - audit log SOC2 diff oldValue → newValue + actorUserId/email/ip/ua (P1-9)
 *
 * Couvre :
 *   1. resumeCampaign → quand campaign.pausedAt existe → writeContentGenConfig
 *      est appelée avec ("campaign_pause_history", history, session.email, description)
 *   2. resumeCampaign → appel passe par le chokepoint (audit log + rate-limit
 *      sont exécutés indirectement via writeContentGenConfig)
 *   3. resumeCampaign → quand campaign.pausedAt est null, writeContentGenConfig
 *      n'est PAS appelée (skip silent — pas d'entry historique inutile)
 *   4. resumeCampaign → fail-soft : si writeContentGenConfig throw (rate-limit
 *      ou audit log down), la campagne est tout de même resumée (priorité métier)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  authMock,
  checkRateLimitMock,
  campaignFindUniqueMock,
  campaignUpdateMock,
  contentGenConfigFindUniqueMock,
  contentGenConfigUpsertMock,
  auditLogCreateMock,
  activityLogCreateMock,
  revalidatePathMock,
  headersMock,
} = vi.hoisted(() => {
  return {
    authMock: vi.fn<
      () => Promise<{
        user: { id: string; email: string; role: string };
      } | null>
    >(async () => ({
      user: { id: "user-admin-1", email: "admin@axion-ia.com", role: "admin" },
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
    campaignFindUniqueMock: vi.fn<(args: unknown) => Promise<{ pausedAt: Date | null } | null>>(
      async () => ({ pausedAt: new Date("2026-05-17T10:00:00.000Z") }),
    ),
    campaignUpdateMock: vi.fn(async (_args: unknown) => ({ id: "campaign-1" })),
    contentGenConfigFindUniqueMock: vi.fn<(args: unknown) => Promise<{ value: unknown } | null>>(
      async () => null,
    ),
    contentGenConfigUpsertMock: vi.fn(async (_args: unknown) => ({ key: "k" })),
    auditLogCreateMock: vi.fn(async (_args: unknown) => ({ id: "audit-1" })),
    activityLogCreateMock: vi.fn(async (_args: unknown) => ({ id: "activity-1" })),
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
    coverageCampaign: {
      findUnique: (args: unknown) => campaignFindUniqueMock(args),
      update: (args: unknown) => campaignUpdateMock(args),
    },
    contentGenConfig: {
      findUnique: (args: unknown) => contentGenConfigFindUniqueMock(args),
      upsert: (args: unknown) => contentGenConfigUpsertMock(args),
    },
    contentGenAuditLog: {
      create: (args: unknown) => auditLogCreateMock(args),
    },
    activityLog: {
      create: (args: unknown) => activityLogCreateMock(args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

// Mock BullMQ Queue pour éviter init Redis au require.
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getJob: vi.fn(async () => null),
  })),
}));

// Mock activity-log helper (logActivity).
vi.mock("@/server/content-gen/shared/activity-log", () => ({
  logActivity: vi.fn(async () => undefined),
}));

import { resumeCampaign } from "../coverage";

const SESSION = {
  user: { id: "user-admin-1", email: "admin@axion-ia.com", role: "admin" },
};

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
  campaignFindUniqueMock.mockClear();
  campaignFindUniqueMock.mockImplementation(async () => ({
    pausedAt: new Date("2026-05-17T10:00:00.000Z"),
  }));
  campaignUpdateMock.mockClear();
  campaignUpdateMock.mockImplementation(async () => ({ id: "campaign-1" }));
  contentGenConfigFindUniqueMock.mockClear();
  contentGenConfigFindUniqueMock.mockImplementation(async () => null);
  contentGenConfigUpsertMock.mockClear();
  contentGenConfigUpsertMock.mockImplementation(async () => ({ key: "k" }));
  auditLogCreateMock.mockClear();
  auditLogCreateMock.mockImplementation(async () => ({ id: "audit-1" }));
  activityLogCreateMock.mockClear();
  revalidatePathMock.mockClear();
  headersMock.mockClear();
  headersMock.mockImplementation(async () => new Headers());
});

describe("resumeCampaign — S+4-F bypass fix (audit 06 §8.9 P1-1)", () => {
  it("passe par writeContentGenConfig (rate-limit + audit log activés)", async () => {
    await resumeCampaign("campaign-1");

    // 1. Rate-limit appelé via writeContentGenConfig → key incluant la setting
    //    `campaign_pause_history` (isolation par setting, cf. P1-30).
    expect(checkRateLimitMock).toHaveBeenCalled();
    const calls = checkRateLimitMock.mock.calls;
    const rlCall = calls.find(([k]) =>
      (k as string).includes("writeContentGenConfig:campaign_pause_history"),
    );
    expect(rlCall).toBeDefined();
    const [, rlConfig] = rlCall! as [string, { limit: number; windowSec: number }];
    expect(rlConfig.limit).toBe(60);
    expect(rlConfig.windowSec).toBe(60);

    // 2. ContentGenConfig upsert appelé (le chokepoint passe par upsert
    //    en interne après lecture pour audit diff).
    expect(contentGenConfigUpsertMock).toHaveBeenCalled();
    const upsertCall = contentGenConfigUpsertMock.mock.calls[0]![0] as {
      where: { key: string };
      create: { key: string; value: unknown; updatedBy: string };
    };
    expect(upsertCall.where.key).toBe("campaign_pause_history");
    expect(upsertCall.create.updatedBy).toBe(SESSION.user.email);

    // 3. Audit log SOC2 écrit (writeAuditLog interne — verify via mock).
    expect(auditLogCreateMock).toHaveBeenCalled();
    const auditCall = auditLogCreateMock.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(auditCall.data.action).toBe("writeContentGenConfig");
    expect(auditCall.data.settingKey).toBe("campaign_pause_history");
    expect(auditCall.data.actorUserId).toBe(SESSION.user.id);
    expect(auditCall.data.actorEmail).toBe(SESSION.user.email);

    // 4. Campagne resumée (update status='running', pausedAt=null).
    expect(campaignUpdateMock).toHaveBeenCalled();
    const updateCall = campaignUpdateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: { status: string; pausedAt: null };
    };
    expect(updateCall.where.id).toBe("campaign-1");
    expect(updateCall.data.status).toBe("running");
    expect(updateCall.data.pausedAt).toBeNull();
  });

  it("ne touche pas ContentGenConfig si campaign.pausedAt est null (skip silent)", async () => {
    campaignFindUniqueMock.mockImplementation(async () => ({ pausedAt: null }));

    await resumeCampaign("campaign-2");

    expect(contentGenConfigUpsertMock).not.toHaveBeenCalled();
    expect(contentGenConfigFindUniqueMock).not.toHaveBeenCalled();
    // La campagne est tout de même resumée.
    expect(campaignUpdateMock).toHaveBeenCalled();
  });

  it("fail-soft : si writeContentGenConfig throw (rate-limit), campagne resumée quand même", async () => {
    // Premier appel rate-limit (celui pour writeContentGenConfig) → bloque.
    checkRateLimitMock.mockImplementation(async () => ({
      allowed: false,
      count: 61,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    }));

    await resumeCampaign("campaign-3");

    // L'écriture historique a échoué → upsert pas appelé.
    expect(contentGenConfigUpsertMock).not.toHaveBeenCalled();
    // MAIS la campagne EST resumée (priorité métier resume > traçabilité).
    expect(campaignUpdateMock).toHaveBeenCalled();
    const updateCall = campaignUpdateMock.mock.calls[0]![0] as {
      data: { status: string };
    };
    expect(updateCall.data.status).toBe("running");
  });
});
