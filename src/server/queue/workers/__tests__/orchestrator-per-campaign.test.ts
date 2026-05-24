/**
 * Sprint v7 Phase 4 — orchestrator per-campaign dailyArticles budget.
 * 5 scénarios :
 *  P1. dailyArticles=96 → 1 job/tick (ceil(96/96)=1)
 *  P2. dailyArticles=192 → 2 jobs/tick (ceil(192/96)=2)
 *  P3. custom_subset avec slugs → utilise customVilleSlugs
 *  P4. custom_subset vide → fallback anchorVilleSlugs
 *  P5. global_queue sans anchors → query CityGenerationOrder
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const campaignFindManyMock = vi.fn();
const campaignUpdateMock = vi.fn();
const contentGenJobCreateMock = vi.fn();
const contentGenJobCountMock = vi.fn();
const contentGenJobGroupByMock = vi.fn();
const contentGenJobAggregateMock = vi.fn();
const cityGenerationOrderFindManyMock = vi.fn();
const readConfigMock = vi.fn();
const captureWorkerErrorMock = vi.fn();
const alertCampaignDoneMock = vi.fn();

const capturedProcessor: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: {
      findMany: () => campaignFindManyMock(),
      update: (args: unknown) => campaignUpdateMock(args),
    },
    contentGenJob: {
      create: (args: unknown) => contentGenJobCreateMock(args),
      count: (args: unknown) => contentGenJobCountMock(args),
      groupBy: () => contentGenJobGroupByMock(),
      aggregate: () => contentGenJobAggregateMock(),
    },
    cityGenerationOrder: {
      findMany: () => cityGenerationOrderFindManyMock(),
    },
  },
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: (key: string) => readConfigMock(key),
}));

vi.mock("@/server/content-gen/scheduler/anti-burst", () => ({
  computeAntiBurstSchedule: vi.fn(() => []),
  msSinceStartOfDay: vi.fn(() => 0),
}));

vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertCampaignDone: (...args: unknown[]) => alertCampaignDoneMock(...args),
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: (...args: unknown[]) => captureWorkerErrorMock(...args),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "bull-job-1" }),
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Worker: vi.fn().mockImplementation((_name: string, fn: any) => {
    capturedProcessor.fn = fn;
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

import { startOrchestratorWorker } from "../content-orchestrator-worker";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_JOB = { id: "job-1", data: { trigger: "cron-15min" } } as Job;

function makeCampaign(
  overrides: Partial<{
    id: string;
    name: string;
    status: string;
    scope: string;
    serviceSector: null;
    anchorVilleSlugs: string[];
    anchorDepartementCodes: string[];
    anchorRegionSlugs: string[];
    totalTargetCount: number;
    generatedCount: number;
    typeDistribution: Record<string, number>;
    contentTypeWeights: null;
    audienceMix: Record<string, number>;
    searchIntentMix: null;
    cityProcessingMode: string;
    currentCityIndex: number | null;
    endDate: Date | null;
    dailyArticles: number;
    villeScopeMode: string;
    customVilleSlugs: string[];
    qualityImprovedCount: number;
    publishedCount: number;
    failedCount: number;
    startedAt: null;
    completedAt: null;
    pausedAt: null;
    createdAt: Date;
    createdBy: null;
    estimatedCostUsd: null;
    estimatedDurationMinutes: null;
    startDate: null;
    recurringSchedule: null;
    completedReason: null;
  }> = {},
) {
  return {
    id: "campaign-1",
    name: "Test Campaign",
    status: "running",
    scope: "ville",
    serviceSector: null,
    anchorVilleSlugs: ["paris", "lyon"],
    anchorDepartementCodes: [],
    anchorRegionSlugs: [],
    totalTargetCount: 500,
    generatedCount: 0,
    typeDistribution: { landing_ville: 100 },
    contentTypeWeights: null,
    audienceMix: { "PME:entreprise_privee": 100 },
    searchIntentMix: null,
    cityProcessingMode: "parallel",
    currentCityIndex: null,
    endDate: null,
    dailyArticles: 30,
    villeScopeMode: "custom_subset",
    customVilleSlugs: [],
    qualityImprovedCount: 0,
    publishedCount: 0,
    failedCount: 0,
    startedAt: null,
    completedAt: null,
    pausedAt: null,
    createdAt: new Date(),
    createdBy: null,
    estimatedCostUsd: null,
    estimatedDurationMinutes: null,
    startDate: null,
    recurringSchedule: null,
    completedReason: null,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://test.invalid:6379";
  readConfigMock.mockImplementation(async (key: string) => {
    if (key === "kill_switch") return { active: false };
    if (key === "batches") return { workersConcurrency: 3 };
    return {};
  });
  campaignUpdateMock.mockResolvedValue({ id: "campaign-1" });
  contentGenJobCreateMock.mockResolvedValue({
    id: "job-new",
    contentType: "landing_ville",
    targetSearchIntent: "local",
    inputPayload: {},
  });
  contentGenJobCountMock.mockResolvedValue(0);
  contentGenJobGroupByMock.mockResolvedValue([]);
  contentGenJobAggregateMock.mockResolvedValue({ _sum: { costUsd: 0 }, _avg: { qualityScore: 0 } });
  cityGenerationOrderFindManyMock.mockResolvedValue([]);
  alertCampaignDoneMock.mockResolvedValue(undefined);
});

function getProcessor() {
  startOrchestratorWorker();
  return capturedProcessor.fn!;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Orchestrator — per-campaign dailyArticles budget (Phase 4)", () => {
  it("P1: dailyArticles=96 → ceil(96/96)=1 job enqueued per tick", async () => {
    const campaign = makeCampaign({
      dailyArticles: 96,
      villeScopeMode: "custom_subset",
      customVilleSlugs: ["paris"],
    });
    campaignFindManyMock.mockResolvedValue([campaign]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(contentGenJobCreateMock).toHaveBeenCalledTimes(1);
  });

  it("P2: dailyArticles=192 → ceil(192/96)=2 jobs enqueued per tick", async () => {
    const campaign = makeCampaign({
      dailyArticles: 192,
      villeScopeMode: "custom_subset",
      customVilleSlugs: ["paris"],
    });
    campaignFindManyMock.mockResolvedValue([campaign]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(contentGenJobCreateMock).toHaveBeenCalledTimes(2);
  });

  it("P3: villeScopeMode=custom_subset avec slugs → utilise customVilleSlugs", async () => {
    const campaign = makeCampaign({
      villeScopeMode: "custom_subset",
      customVilleSlugs: ["bordeaux", "nantes"],
      anchorVilleSlugs: ["paris"],
      dailyArticles: 96,
    });
    campaignFindManyMock.mockResolvedValue([campaign]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createArg: any = contentGenJobCreateMock.mock.calls[0]?.[0];
    expect(["bordeaux", "nantes"]).toContain(createArg?.data?.anchorVilleSlug);
    expect(cityGenerationOrderFindManyMock).not.toHaveBeenCalled();
  });

  it("P4: villeScopeMode=custom_subset vide → fallback anchorVilleSlugs", async () => {
    const campaign = makeCampaign({
      villeScopeMode: "custom_subset",
      customVilleSlugs: [],
      anchorVilleSlugs: ["lyon"],
      dailyArticles: 96,
    });
    campaignFindManyMock.mockResolvedValue([campaign]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createArg: any = contentGenJobCreateMock.mock.calls[0]?.[0];
    expect(createArg?.data?.anchorVilleSlug).toBe("lyon");
    expect(cityGenerationOrderFindManyMock).not.toHaveBeenCalled();
  });

  it("P5: villeScopeMode=global_queue sans anchors → query CityGenerationOrder", async () => {
    const campaign = makeCampaign({
      villeScopeMode: "global_queue",
      customVilleSlugs: [],
      anchorVilleSlugs: [],
      scope: "ville",
      dailyArticles: 96,
    });
    campaignFindManyMock.mockResolvedValue([campaign]);
    cityGenerationOrderFindManyMock.mockResolvedValue([
      { villeSlug: "marseille" },
      { villeSlug: "toulouse" },
    ]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(cityGenerationOrderFindManyMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createArg: any = contentGenJobCreateMock.mock.calls[0]?.[0];
    expect(["marseille", "toulouse"]).toContain(createArg?.data?.anchorVilleSlug);
  });
});
