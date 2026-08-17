/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.1
 *
 * Tests orchestrator sequential city processing.
 *
 * Mis à jour le 2026-08-15 : le scénario « la ville 0 est terminée → on enfile ET
 * on avance l'index dans la foulée » encodait en réalité le bug. Avancer l'index
 * à l'enfilement rendait l'attente inopérante (le tick suivant comptait les jobs
 * de la ville suivante, toujours vide). Les scénarios décrivent désormais le
 * comportement voulu : l'index n'avance qu'une fois la ville couverte ET drainée.
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
      // count is called multiple times — first call is for pending in sequential, others for complete/failed
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

vi.mock("@/server/content-gen/scheduler/anti-burst", async () => {
  const actual = await vi.importActual<typeof import("@/server/content-gen/scheduler/anti-burst")>(
    "@/server/content-gen/scheduler/anti-burst",
  );
  return {
    ...actual,
    computeAntiBurstSchedule: vi.fn(() => []),
    // Milieu de journée : le budget de tick n'est pas le sujet de ce fichier, on
    // veut juste qu'il soit non nul pour observer le séquencement des villes.
    msSinceStartOfDay: vi.fn(() => 43_200_000),
  };
});

// Reprise du retard (2026-08-15) — hors sujet ici : neutralisée.
vi.mock("@/server/content-gen/recovery/backlog-recovery", () => ({
  DEFAULT_RECOVERY_SETTINGS: {
    enabled: false,
    maxPerTick: 0,
    maxPerDay: 0,
    maxRetries: 3,
    stuckAfterMinutes: 60,
  },
  drainFailedJobs: vi.fn(async () => ({ requeued: 0, skipped: 0 })),
  sweepStuckJobs: vi.fn(async () => ({ requeued: 0, skipped: 0 })),
  sweepStrandedQualityJobs: vi.fn(async () => ({ requeued: 0, skipped: 0 })),
}));

vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: vi.fn(async () => ({ active: false })),
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
  }> = {},
) {
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
    contentTypeWeights: null,
    audienceMix: { "PME:entreprise_privee": 100 },
    searchIntentMix: null,
    cityProcessingMode: "sequential",
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

/**
 * Le worker appelle `contentGenJob.count` pour plusieurs questions différentes.
 * Ce routeur distingue les trois qui comptent ici, à partir du `where` :
 *  - créés aujourd'hui pour la campagne (rythme quotidien) ;
 *  - créés pour la ville courante (couverture de la ville) ;
 *  - encore en cours pour la ville courante (attente avant de passer à la suite).
 */
function routeCounts(opts: {
  createdToday?: number;
  cityCreated?: number;
  cityPending?: number;
}): void {
  contentGenJobCountMock.mockImplementation(async (args: unknown) => {
    const where = (args as { where?: Record<string, unknown> } | undefined)?.where ?? {};
    const hasVille = "anchorVilleSlug" in where;
    const status = where.status as { in?: string[] } | undefined;
    if (hasVille && status?.in) return opts.cityPending ?? 0;
    if (hasVille) return opts.cityCreated ?? 0;
    if ("createdAt" in where) return opts.createdToday ?? 0;
    return 0;
  });
}

/** Lit la valeur de `currentCityIndex` écrite par le worker, si elle l'a été. */
function readCityIndexUpdate(): number | undefined {
  const calls = campaignUpdateMock.mock.calls as unknown[][];
  const found = calls.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (call) => (call[0] as any)?.data?.currentCityIndex !== undefined,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (found?.[0] as any)?.data?.currentCityIndex as number | undefined;
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

  // Régression 2026-08-15 — l'index de ville était avancé dès l'enfilement, si
  // bien que le comptage « jobs en cours » du tick suivant portait sur la ville
  // SUIVANTE (toujours vide) : l'attente promise par le mode séquentiel ne
  // pouvait jamais se déclencher. Chaque ville ne recevait qu'un budget de tick,
  // puis la campagne cessait d'enfiler tout en restant `running`.
  it("C2: ville couverte mais jobs encore en cours → on attend, rien enfilé, index inchangé", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "sequential", currentCityIndex: 0 });
    campaignFindManyMock.mockResolvedValue([campaign]);
    // 30 articles / 3 villes = 10 par ville : couverture atteinte, 3 encore en vol.
    routeCounts({ cityCreated: 10, cityPending: 3 });

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(contentGenJobCreateMock).not.toHaveBeenCalled();
    expect(readCityIndexUpdate()).toBeUndefined();
  });

  it("C3: ville pas encore couverte → enfile pour ELLE, sans avancer l'index", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "sequential", currentCityIndex: 0 });
    campaignFindManyMock.mockResolvedValue([campaign]);
    routeCounts({ cityCreated: 0, cityPending: 0 });

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(contentGenJobCreateMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createArg: any = contentGenJobCreateMock.mock.calls[0]?.[0];
    expect(createArg?.data?.anchorVilleSlug).toBe("paris");
    // L'index n'avance PAS tant que la ville n'est pas couverte et drainée.
    expect(readCityIndexUpdate()).toBeUndefined();
  });

  it("C3bis: ville couverte ET drainée → l'index avance, sans rien enfiler ce tick", async () => {
    const campaign = makeCampaign({ cityProcessingMode: "sequential", currentCityIndex: 0 });
    campaignFindManyMock.mockResolvedValue([campaign]);
    routeCounts({ cityCreated: 10, cityPending: 0 });

    const fn = getProcessor();
    await fn(MOCK_JOB);

    expect(contentGenJobCreateMock).not.toHaveBeenCalled();
    expect(readCityIndexUpdate()).toBe(1);
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
    routeCounts({ cityCreated: 0, cityPending: 0 });

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
