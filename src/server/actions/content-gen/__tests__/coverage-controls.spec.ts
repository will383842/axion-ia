/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22)
 *
 * 12 tests couvrant les 4 nouvelles capabilities :
 *   - cityProcessingMode
 *   - startDate / scheduled status
 *   - endDate validation
 *   - recurringSchedule validation + BullMQ repeatable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks hoisted ────────────────────────────────────────────────────────────

const authMock = vi.fn();
const campaignCreateMock = vi.fn();
const campaignFindUniqueMock = vi.fn();
const campaignUpdateMock = vi.fn();
const activityLogCreateMock = vi.fn();
const revalidatePathMock = vi.fn();
const headersMock = vi.fn();
const queueAddMock = vi.fn();
const queueRemoveRepeatableMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: (args: any) => campaignCreateMock(args),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: (args: any) => campaignFindUniqueMock(args),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: (args: any) => campaignUpdateMock(args),
    },
    contentGenConfig: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ key: "k" })),
    },
    contentGenAuditLog: {
      create: vi.fn(async () => ({ id: "audit-1" })),
    },
    activityLog: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: (args: any) => activityLogCreateMock(args),
    },
    contentGenJob: {
      findMany: vi.fn(async () => []),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getJob: vi.fn(async () => null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    add: (...args: any[]) => queueAddMock(...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeRepeatable: (...args: any[]) => queueRemoveRepeatableMock(...args),
  })),
}));

vi.mock("@/server/content-gen/shared/activity-log", () => ({
  logActivity: vi.fn(async () => undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  })),
}));

import {
  createCampaign,
  scheduleCampaign,
  extendCampaignDeadline,
  pauseCampaign,
} from "../coverage";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  name: "Test Campaign",
  scope: "ville" as const,
  totalTargetCount: 100,
  typeDistribution: { landing_ville: 50, blog_from_keywords: 50 },
  audienceMix: { "PME:entreprise_privee": 100 },
};

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // J+7
const PAST_DATE = new Date(Date.now() - 60_000); // 1 min dans le passé
const FAR_FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // J+30

// ─── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCreatedData(): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = campaignCreateMock.mock.calls[0] as [{ data: Record<string, any> }];
  return call[0].data;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Force REDIS_URL pour que getContentGenQueue() instancie la Queue mockée.
  process.env.REDIS_URL = "redis://test.invalid:6379";
  authMock.mockResolvedValue({
    user: { id: "user-admin-1", email: "admin@axion-ia.com", role: "admin" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  campaignCreateMock.mockImplementation(async (args: any) => ({
    id: "campaign-new",
    ...args.data,
  }));
  campaignFindUniqueMock.mockResolvedValue({ recurringSchedule: null });
  campaignUpdateMock.mockResolvedValue({ id: "campaign-1" });
  headersMock.mockResolvedValue(new Headers());
  queueAddMock.mockResolvedValue({ id: "bull-job-1" });
  queueRemoveRepeatableMock.mockResolvedValue(undefined);
});

describe("createCampaign — cityProcessingMode", () => {
  it("stocke cityProcessingMode=sequential en DB quand fourni", async () => {
    await createCampaign({ ...BASE_INPUT, cityProcessingMode: "sequential" });
    const data = getCreatedData();
    expect(data.cityProcessingMode).toBe("sequential");
  });

  it("utilise parallel par défaut si cityProcessingMode absent", async () => {
    await createCampaign({ ...BASE_INPUT });
    const data = getCreatedData();
    expect(data.cityProcessingMode).toBe("parallel");
  });
});

describe("createCampaign — startDate", () => {
  it("status=scheduled si startDate futur fourni", async () => {
    await createCampaign({ ...BASE_INPUT, startDate: FUTURE_DATE });
    const data = getCreatedData();
    expect(data.status).toBe("scheduled");
    expect(data.startDate).toBe(FUTURE_DATE);
  });

  it("status=draft si startDate passé (no throw — démarrage immédiat)", async () => {
    // Ne doit pas throw, doit utiliser null (immédiat)
    await expect(createCampaign({ ...BASE_INPUT, startDate: PAST_DATE })).resolves.toBeDefined();
    const data = getCreatedData();
    expect(data.status).toBe("draft");
    expect(data.startDate).toBeNull();
  });

  it("status=draft si startDate absent", async () => {
    await createCampaign({ ...BASE_INPUT });
    const data = getCreatedData();
    expect(data.status).toBe("draft");
    expect(data.startDate).toBeNull();
  });
});

describe("createCampaign — endDate", () => {
  it("throw end_date_in_past si endDate est dans le passé", async () => {
    await expect(createCampaign({ ...BASE_INPUT, endDate: PAST_DATE })).rejects.toThrow(
      "end_date_in_past",
    );
  });

  it("accepte endDate futur sans erreur", async () => {
    await expect(createCampaign({ ...BASE_INPUT, endDate: FAR_FUTURE })).resolves.toBeDefined();
    const data = getCreatedData();
    expect(data.endDate).toBe(FAR_FUTURE);
  });
});

describe("createCampaign — recurringSchedule", () => {
  it("accepte recurringSchedule cron valide", async () => {
    await expect(
      createCampaign({ ...BASE_INPUT, recurringSchedule: "0 9 * * 1" }),
    ).resolves.toBeDefined();
    const data = getCreatedData();
    expect(data.recurringSchedule).toBe("0 9 * * 1");
  });

  it("throw invalid_cron_expression si cron invalide", async () => {
    await expect(
      createCampaign({ ...BASE_INPUT, recurringSchedule: "not a cron" }),
    ).rejects.toThrow("invalid_cron_expression");
  });
});

describe("createCampaign — defaults cohérents sans nouveaux champs", () => {
  it("tous les nouveaux champs sont null/parallel si non fournis", async () => {
    await createCampaign({ ...BASE_INPUT });
    const data = getCreatedData();
    expect(data.cityProcessingMode).toBe("parallel");
    expect(data.startDate).toBeNull();
    expect(data.endDate).toBeNull();
    expect(data.recurringSchedule).toBeNull();
  });
});

describe("scheduleCampaign", () => {
  it("update status=scheduled + startDate", async () => {
    await scheduleCampaign("campaign-1", FUTURE_DATE);
    expect(campaignUpdateMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArg: any = campaignUpdateMock.mock.calls[0]?.[0];
    expect(callArg?.where?.id).toBe("campaign-1");
    expect(callArg?.data?.status).toBe("scheduled");
    expect(callArg?.data?.startDate).toBe(FUTURE_DATE);
  });

  it("throw si startDate dans le passé", async () => {
    await expect(scheduleCampaign("campaign-1", PAST_DATE)).rejects.toThrow(
      "start_date_must_be_future",
    );
  });
});

describe("extendCampaignDeadline", () => {
  it("update endDate + logActivity SOC2", async () => {
    const { logActivity } = await import("@/server/content-gen/shared/activity-log");
    await extendCampaignDeadline("campaign-1", FAR_FUTURE);
    expect(campaignUpdateMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callArg: any = campaignUpdateMock.mock.calls[0]?.[0];
    expect(callArg?.data?.endDate).toBe(FAR_FUTURE);
    expect(logActivity).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logCalls = (logActivity as any).mock.calls as any[][];
    expect(logCalls[0]?.[0]?.action).toBe("content-gen.campaign.extend-deadline");
    expect(logCalls[0]?.[0]?.changes?.soc2).toBe("CAMPAIGN_DEADLINE_EXTENDED");
  });

  it("throw end_date_in_past si date passée", async () => {
    await expect(extendCampaignDeadline("campaign-1", PAST_DATE)).rejects.toThrow(
      "end_date_in_past",
    );
  });
});

describe("pauseCampaign — recurringSchedule cleanup", () => {
  it("appelle removeRepeatable si campagne a recurringSchedule", async () => {
    campaignFindUniqueMock.mockResolvedValue({ recurringSchedule: "0 9 * * 1" });
    await pauseCampaign("campaign-1");
    expect(queueRemoveRepeatableMock).toHaveBeenCalledWith(
      "campaign-campaign-1-recurring",
      expect.objectContaining({ pattern: "0 9 * * 1" }),
    );
  });

  it("ne appelle PAS removeRepeatable si pas de recurringSchedule", async () => {
    campaignFindUniqueMock.mockResolvedValue({ recurringSchedule: null });
    await pauseCampaign("campaign-2");
    expect(queueRemoveRepeatableMock).not.toHaveBeenCalled();
  });
});
