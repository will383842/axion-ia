/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.1
 *
 * Tests orchestrator sequential city processing.
 * 6 scénarios :
 *  1. mode parallel → ignore currentCityIndex, traite toutes villes simultanément
 *  2. mode sequential, ville 0 pending → skip enqueue
 *  3. mode sequential, ville 0 terminée → enqueue ville 0 + incrément currentCityIndex
 *  4. mode sequential, currentCityIndex = villes.length → skip (fin)
 *  5. mode sequential, currentCityIndex null → démarre à 0
 *  6. mode parallel avec campaign sans villes → comportement inchangé
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
const contentGenJobCountPublishedMock = vi.fn();
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
      // count is called multiple times — first call is for pending in sequential, others for complete/failed
      count: (args: unknown) => contentGenJobCountMock(args),
      groupBy: () => contentGenJobGroupByMock(),
      aggregate: () => contentGenJobAggregateMock(),
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

// ─── Import worker after mocks ────────────────────────────────────────────────

import { startOrchestratorWorker } from "../content-orchestrator-worker";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_JOB = { id: "job-1", data: { trigger: "cron-15min" } } as Job;

function makeCampaign(overrides: Partial<{
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
  audienceMix: Record<string, number>;
  searchIntentMix: null;
  cityProcessingMode: string;
  currentCityIndex: number | null;
  endDate: Date | null;
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
}> = {}) {
  return {
    id: "campaign-1",
    name: "Test Campaign",
    status: "running",
    scope: "ville",
    serviceSector: null,
    anchorVilleSlugs: ["paris", "lyon", "marseille"],
    anchorDepartementCodes: [],
    anchorRegionSlugs: [],
    totalTargetCount: 30,
    generatedCount: 0,
    typeDistribution: { landing_ville: 100 },
    audienceMix: { "PME:entreprise_privee": 100 },
    searchIntentMix: null,
    cityProcessingMode: "sequential",
    currentCityIndex: null,
    endDate: null,
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
    if (key === "batches") return { dailyBatchSize: 10, workersConcurrency: 3 };
    return {};
  });
  campaignUpdateMock.mockResolvedValue({ id: "campaign-1" });
  contentGenJobCreateMock.mockResolvedValue({ id: "job-new", contentType: "landing_ville", targetSearchIntent: "local", inputPayload: {} });
  contentGenJobCountMock.mockResolvedValue(0);
  contentGenJobGroupByMock.mockResolvedValue([]);
  contentGenJobAggregateMock.mockResolvedValue({ _sum: { costUsd: 0 }, _avg: { qualityScore: 0 } });
  alertCampaignDoneMock.mockResolvedValue(undefined);
});

function getProcessor() {
  startOrchestratorWorker();
  return capturedProcessor.fn!;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Orchestrator — sequential city processing", () => {
  it("C1: mode parallel — traite toutes les villes simultanément (ignore currentCityIndex)", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "parallel", currentCityIndex: 1 });
    campaignFindManyMock.mockResolvedValue([campaign]);
    contentGenJobCountMock.mockResolvedValue(0); // no pending

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // En mode parallel, contentGenJob.count pour sequential n'est pas appelé avec anchorVilleSlug
    // On vérifie que create est appelé (jobs créés)
    expect(contentGenJobCreateMock).toHaveBeenCalled();
  });

  it("C2: mode sequential, ville 0 pending → skip enqueue (count > 0)", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "sequential", currentCityIndex: 0 });
    campaignFindManyMock.mockResolvedValue([campaign]);
    // Première ville (paris) a des jobs pending
    contentGenJobCountMock.mockResolvedValue(3);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // Aucun job créé
    expect(contentGenJobCreateMock).not.toHaveBeenCalled();
  });

  it("C3: mode sequential, ville 0 terminée → enqueue jobs + incrément currentCityIndex", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "sequential", currentCityIndex: 0 });
    campaignFindManyMock.mockResolvedValue([campaign]);
    // Ville courante (index 0 = paris) : 0 jobs pending
    contentGenJobCountMock.mockResolvedValue(0);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // Des jobs ont été créés
    expect(contentGenJobCreateMock).toHaveBeenCalled();
    // currentCityIndex incrémenté
    const updateCalls = campaignUpdateMock.mock.calls as unknown[][];
    const cityIndexUpdate = updateCalls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (call) => (call[0] as any)?.data?.currentCityIndex !== undefined,
    );
    expect(cityIndexUpdate).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((cityIndexUpdate?.[0] as any)?.data?.currentCityIndex).toBe(1);
  });

  it("C4: mode sequential, currentCityIndex = villes.length → skip (toutes villes terminées)", async () => {
    const campaign = makeCampaign({
      cityProcessingMode: "sequential",
      currentCityIndex: 3, // = anchorVilleSlugs.length (3 villes)
    });
    campaignFindManyMock.mockResolvedValue([campaign]);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(contentGenJobCreateMock).not.toHaveBeenCalled();
  });

  it("C5: mode sequential, currentCityIndex null → démarre à index 0 (paris)", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "sequential", currentCityIndex: null });
    campaignFindManyMock.mockResolvedValue([campaign]);
    contentGenJobCountMock.mockResolvedValue(0);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // Jobs créés avec anchorVilleSlug = "paris" (index 0)
    expect(contentGenJobCreateMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createArg: any = contentGenJobCreateMock.mock.calls[0]?.[0];
    expect(createArg?.data?.anchorVilleSlug).toBe("paris");
  });

  it("C6: mode parallel sans villes → comportement inchangé (anchorVilleSlug non forcé)", async () => {
    const campaign = makeCampaign({
      cityProcessingMode: "parallel",
      anchorVilleSlugs: [], // pas de villes
      scope: "multi",
      currentCityIndex: null,
    });
    campaignFindManyMock.mockResolvedValue([campaign]);
    contentGenJobCountMock.mockResolvedValue(0);

    const fn = getProcessor();
    await fn(MOCK_JOB);

    // Doit créer des jobs même sans villes (scope multi)
    expect(contentGenJobCreateMock).toHaveBeenCalled();
  });
});
