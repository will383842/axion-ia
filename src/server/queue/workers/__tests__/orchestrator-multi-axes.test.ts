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

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
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
vi.mock("@/server/content-gen/scheduler/anti-burst", async () => {
  const actual = await vi.importActual<typeof import("@/server/content-gen/scheduler/anti-burst")>(
    "@/server/content-gen/scheduler/anti-burst",
  );
  return {
    ...actual,
    computeAntiBurstSchedule: vi.fn(() => []),
    // Milieu de journée (2026-08-15) : le rythme quotidien n'est pas le sujet de
    // ce fichier, on veut simplement un budget de tick non nul.
    msSinceStartOfDay: vi.fn(() => 43_200_000),
  };
});

// Reprise du retard (2026-08-15) — hors sujet ici : neutralisée.
vi.mock("@/server/content-gen/recovery/backlog-recovery", async (importOriginal) => ({
  // La clause de comptage `requeuedTodayWhere` est PURE : on garde la vraie,
  // sinon le mock ferait passer l'orchestrateur sur une fonction absente
  // (fantôme du 2026-09-02).
  ...(await importOriginal<typeof import("@/server/content-gen/recovery/backlog-recovery")>()),
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
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

// ─── Dataset villes réduit (perf + pouvoir de détection) ─────────────────────
//
// `expandVilleAnchors` importe `@/content/villes/core` — le point d'entrée
// structurel introduit par le découplage du 2026-08-16 (~578 ms, contre ~41 s
// pour le barrel `@/content/villes` et ses 2 118 imports de contenu éditorial).
//
// Le mock ci-dessous n'est donc PLUS là pour la vitesse : il est là pour le
// POUVOIR DE DÉTECTION. Sur les 2 157 communes réelles, « rayon 50 km autour de
// Paris » renvoie des dizaines de résultats et on ne peut affirmer qu'un vague
// `toContain` — c'est précisément ce que faisait l'ancien test, qui passait même
// quand le filtre par département était cassé. Avec 8 communes choisies, chaque
// mode a un contre-exemple à écarter et l'assertion devient une égalité exacte.
//
// On substitue 8 communes RÉELLES (coordonnées INSEE copiées de `data/`).
// `@/lib/geo` n'est PAS mocké : haversine, le tri par distance et le filtre
// `maxKm` restent le vrai code. Le jeu est choisi pour que chaque mode ait un
// contre-exemple à écarter — sans quoi l'assertion ne prouve rien :
//   - rayon 50 km depuis Paris : 3 communes dedans, Lyon/Saint-Étienne/Marseille dehors
//   - même département depuis Lyon : Villeurbanne (69) dedans, Saint-Étienne
//     (42) dehors ALORS QU'ELLE EST À ~52 km — c'est le département qui tranche,
//     pas la distance.
// `vi.hoisted` : la factory de `vi.mock` est remontée en tête de fichier, elle ne
// peut donc pas fermer sur un `const` de module ordinaire.
const { VILLES_FIXTURE, VILLES_FIXTURE_BY_SLUG } = vi.hoisted(() => {
  const villes = [
    {
      slug: "paris",
      region: "ile-de-france",
      departement: "75",
      geo: { lat: 48.8589, lon: 2.347 },
    },
    {
      slug: "saint-denis",
      region: "ile-de-france",
      departement: "93",
      geo: { lat: 48.9378, lon: 2.3657 },
    },
    {
      slug: "boulogne-billancourt",
      region: "ile-de-france",
      departement: "92",
      geo: { lat: 48.8375, lon: 2.2429 },
    },
    {
      slug: "versailles",
      region: "ile-de-france",
      departement: "78",
      geo: { lat: 48.8039, lon: 2.1191 },
    },
    {
      slug: "lyon",
      region: "auvergne-rhone-alpes",
      departement: "69",
      geo: { lat: 45.758, lon: 4.8351 },
    },
    {
      slug: "villeurbanne",
      region: "auvergne-rhone-alpes",
      departement: "69",
      geo: { lat: 45.7719, lon: 4.8898 },
    },
    {
      slug: "saint-etienne",
      region: "auvergne-rhone-alpes",
      departement: "42",
      geo: { lat: 45.4241, lon: 4.3665 },
    },
    {
      slug: "marseille",
      region: "provence-alpes-cote-d-azur",
      departement: "13",
      geo: { lat: 43.2803, lon: 5.3806 },
    },
  ];
  return {
    VILLES_FIXTURE: villes,
    VILLES_FIXTURE_BY_SLUG: new Map(villes.map((v) => [v.slug, v] as const)),
  };
});

vi.mock("@/content/villes/core", () => ({
  VILLES_CORE: VILLES_FIXTURE,
  getVilleCore: (slug: string) => VILLES_FIXTURE_BY_SLUG.get(slug),
  getVilleCoreByInsee: () => undefined,
  getAllVilleSlugs: () => VILLES_FIXTURE.map((v) => v.slug),
  getVillesCoreByRegion: (region: string) => VILLES_FIXTURE.filter((v) => v.region === region),
  getVillesCoreByDepartement: (code: string) =>
    VILLES_FIXTURE.filter((v) => v.departement === code),
  getVillesCoreIndexableNow: () => VILLES_FIXTURE,
  getIndexableVillesCore: () => VILLES_FIXTURE,
  hasVilleCopy: () => true,
  isPremiumVilleCore: () => true,
  isVilleIndexable: () => true,
  cohortSize: () => VILLES_FIXTURE.length,
  getRegionByDepartement: () => undefined,
}));

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

  // `expandVilleAnchors` importe `@/lib/geo` dynamiquement (import paresseux
  // volontaire, pour alléger le boot du worker). Le premier appel paie donc la
  // transformation vitest de geo + case-studies + transversal. On l'isole ici :
  // les tests qui suivent mesurent la logique, pas le chargement du module, et
  // si ce coût dérive un jour c'est CE hook qui échoue — pas un test au hasard.
  // `expandVilleAnchors` fait `Promise.all([import("@/lib/geo"), import(".../core")])`.
  // Lancées EN CONCURRENCE à froid, vitest transformait le vrai module avant de
  // lui substituer le mock ; charger geo seul d'abord sérialise la résolution.
  // Coût désormais marginal, mais on garde le préchauffage : il isole l'import
  // du module sous test, donc une dérive future échoue ICI et pas au hasard.
  beforeAll(async () => {
    await import("@/lib/geo");
  }, 30000);

  it("expandVilleAnchors : none = no-op", async () => {
    expect(await expandVilleAnchors(["paris"], "none", null)).toEqual(["paris"]);
    expect(await expandVilleAnchors(["paris"], "none", 50)).toEqual(["paris"]);
    // Ancres vides : sortie immédiate, quel que soit le mode.
    expect(await expandVilleAnchors([], "radius", 50)).toEqual([]);
  });

  it("expandVilleAnchors : radius étend jusqu'au rayon et s'arrête là", async () => {
    const expanded = await expandVilleAnchors(["paris"], "radius", 50);
    // Les 3 communes franciliennes du jeu sont à moins de 50 km de Paris…
    expect(new Set(expanded)).toEqual(
      new Set(["paris", "saint-denis", "boulogne-billancourt", "versailles"]),
    );
    // …et rien au-delà n'entre : c'est le filtre `maxKm` qu'on vérifie ici.
    expect(expanded).not.toContain("lyon");
    expect(expanded).not.toContain("marseille");
  });

  it("expandVilleAnchors : same_departement tranche par département, pas par distance", async () => {
    const dept = await expandVilleAnchors(["lyon"], "same_departement", null);
    expect(new Set(dept)).toEqual(new Set(["lyon", "villeurbanne"]));
    // Saint-Étienne est à ~52 km de Lyon — plus proche que bien des communes du
    // 69 — mais elle est dans le 42. Si ce filtre sautait, l'assertion tomberait.
    expect(dept).not.toContain("saint-etienne");
  });

  it("expandVilleAnchors : l'ancre est préservée même sans voisine éligible", async () => {
    // Marseille est seule dans le 13 : le mode ne doit rien perdre.
    expect(await expandVilleAnchors(["marseille"], "same_departement", null)).toEqual([
      "marseille",
    ]);
    // Ancre inconnue du dataset : ignorée pour l'expansion, jamais supprimée.
    expect(await expandVilleAnchors(["ville-inexistante"], "radius", 50)).toEqual([
      "ville-inexistante",
    ]);
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
