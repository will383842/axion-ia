/**
 * Campagnes multi-axes (2026-06-21) — orchestrateur.
 *
 * Couvre l'échantillonnage PAR SLOT des nouveaux axes :
 *  - axe 2 : serviceSectorWeights → job.serviceSector + inputPayload.vertical
 *  - axe 3 : targetSecteurWeights → inputPayload.targetSecteur (réveil pain-matrix)
 *  - axe 6 : expandVilleAnchors (ville & alentours)
 *  - axe 8 : durationMode unlimited (ne se complète pas par compteur)
 * + fallback rétro-compat (singleton serviceSector quand pas de poids).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// ─── Hoisted mocks (identiques au harnais orchestrator-per-campaign) ───────────

const campaignFindManyMock = vi.fn();
const campaignUpdateMock = vi.fn();
const contentGenJobCreateMock = vi.fn();
const contentGenJobCountMock = vi.fn();
const contentGenJobGroupByMock = vi.fn();
const contentGenJobAggregateMock = vi.fn();
const cityGenerationOrderFindManyMock = vi.fn();
const readConfigMock = vi.fn();
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
    cityGenerationOrder: { findMany: () => cityGenerationOrderFindManyMock() },
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
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn().mockResolvedValue({ id: "b1" }) })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Worker: vi.fn().mockImplementation((_n: string, fn: any) => {
    capturedProcessor.fn = fn;
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

import {
  startOrchestratorWorker,
  sampleServiceSector,
  sampleTargetSecteur,
  expandVilleAnchors,
} from "../content-orchestrator-worker";

const MOCK_JOB = { id: "job-1", data: { trigger: "cron-15min" } } as Job;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCampaign(overrides: Record<string, any> = {}) {
  return {
    id: "campaign-1",
    name: "Test Campaign",
    status: "running",
    scope: "ville",
    serviceSector: null,
    serviceSectorWeights: null,
    targetSecteurWeights: null,
    villeSurroundingMode: "none",
    villeSurroundingRadiusKm: null,
    durationMode: "fixed",
    anchorVilleSlugs: ["paris"],
    anchorDepartementCodes: [],
    anchorRegionSlugs: [],
    totalTargetCount: 500,
    generatedCount: 0,
    typeDistribution: { blog_article: 100 },
    contentTypeWeights: null,
    audienceMix: { "PME:entreprise_privee": 100 },
    searchIntentMix: null,
    cityProcessingMode: "parallel",
    currentCityIndex: null,
    endDate: null,
    dailyArticles: 96,
    villeScopeMode: "custom_subset",
    customVilleSlugs: ["paris"],
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
    contentType: "blog_article",
    targetSearchIntent: "informational",
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

// ─── Helpers purs ──────────────────────────────────────────────────────────────

describe("multi-axes — helpers purs", () => {
  it("sampleServiceSector : poids → tirage ; sinon fallback singleton", () => {
    expect(sampleServiceSector({ audits: 100 }, 0, null)).toBe("audits");
    expect(sampleServiceSector({ audits: 100 }, 7, "implementations")).toBe("audits");
    expect(sampleServiceSector(null, 3, "implementations")).toBe("implementations");
    expect(sampleServiceSector({}, 3, null)).toBeNull();
  });

  it("sampleTargetSecteur : poids → tirage ; sinon null", () => {
    expect(sampleTargetSecteur({ juridique: 100 }, 0)).toBe("juridique");
    expect(sampleTargetSecteur({ juridique: 100 }, 99)).toBe("juridique");
    expect(sampleTargetSecteur(null, 0)).toBeNull();
    expect(sampleTargetSecteur({}, 0)).toBeNull();
  });

  it("expandVilleAnchors : none = no-op ; radius étend ; ancres préservées", () => {
    expect(expandVilleAnchors(["paris"], "none", null)).toEqual(["paris"]);
    const expanded = expandVilleAnchors(["paris"], "radius", 50);
    expect(expanded).toContain("paris");
    expect(expanded.length).toBeGreaterThan(1); // Paris a des communes < 50 km
    // same_departement : toutes les communes renvoyées partagent le département.
    const dept = expandVilleAnchors(["lyon"], "same_departement", null);
    expect(dept).toContain("lyon");
  });
});

// ─── Comportement orchestrateur ──────────────────────────────────────────────

describe("multi-axes — échantillonnage par slot", () => {
  it("axe 2 : serviceSectorWeights pilote serviceSector + inputPayload.vertical", async () => {
    campaignFindManyMock.mockResolvedValue([
      makeCampaign({ serviceSector: null, serviceSectorWeights: { audits: 100 } }),
    ]);
    const fn = getProcessor();
    await fn(MOCK_JOB);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = contentGenJobCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.serviceSector).toBe("audits");
    expect(data.inputPayload.vertical).toBe("audits");
  });

  it("axe 3 : targetSecteurWeights pose inputPayload.targetSecteur", async () => {
    campaignFindManyMock.mockResolvedValue([
      makeCampaign({ targetSecteurWeights: { juridique: 100 } }),
    ]);
    const fn = getProcessor();
    await fn(MOCK_JOB);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = contentGenJobCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.inputPayload.targetSecteur).toBe("juridique");
  });

  it("fallback : sans poids, le singleton serviceSector pilote vertical", async () => {
    campaignFindManyMock.mockResolvedValue([
      makeCampaign({ serviceSector: "implementations", serviceSectorWeights: null }),
    ]);
    const fn = getProcessor();
    await fn(MOCK_JOB);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = contentGenJobCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.serviceSector).toBe("implementations");
    expect(data.inputPayload.vertical).toBe("implementations");
    expect(data.inputPayload.targetSecteur).toBeUndefined();
  });

  it("axe 8 : durationMode=unlimited n'est PAS complétée malgré compteur atteint", async () => {
    campaignFindManyMock.mockResolvedValue([
      makeCampaign({ durationMode: "unlimited", totalTargetCount: 10, generatedCount: 10 }),
    ]);
    const fn = getProcessor();
    await fn(MOCK_JOB);
    // Un job est quand même créé (pas d'arrêt par compteur).
    expect(contentGenJobCreateMock).toHaveBeenCalled();
    // Aucune update status=completed.
    const completedCall = campaignUpdateMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c?.[0]?.data?.status === "completed",
    );
    expect(completedCall).toBeUndefined();
  });

  it("rétro-compat : campagne fixed au compteur atteint → complétée", async () => {
    campaignFindManyMock.mockResolvedValue([
      makeCampaign({ durationMode: "fixed", totalTargetCount: 10, generatedCount: 10 }),
    ]);
    const fn = getProcessor();
    await fn(MOCK_JOB);
    const completedCall = campaignUpdateMock.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c?.[0]?.data?.status === "completed",
    );
    expect(completedCall).toBeDefined();
  });
});
