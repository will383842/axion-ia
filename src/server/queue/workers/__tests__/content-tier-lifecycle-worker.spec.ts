/**
 * Sub-agent D Sprint S+5 P2-10 (2026-05-20) — Tests Vitest content-tier-lifecycle-worker.
 *
 * Le worker n'expose pas de `runTickForTest` hook (contrairement à
 * `content-web-vitals-monitor-worker` et `content-psi-monitor-worker`). Pattern
 * adopté : on mocke `bullmq.Worker` pour capturer le `processJob` passé au
 * constructeur, puis on l'invoque directement avec un job stub minimaliste.
 *
 * Couvre :
 *  1. happy path : promote tier-2 avec CTR > seuil
 *  2. failure path : prisma.article.update échoue → re-throw → BullMQ retry path
 *  3. edge case : kill-switch actif → skip total + 0 prisma read
 *  4. edge case bis : demote tier-1 avec CTR < seuil + alertTier3Stagnant câblée
 *
 * Note doctrine : les fixtures (slugs/titles) piochent dans les 4 verticales
 * AxionIA (interventions/audit/implementation/un-a-un) — pas uniquement formation.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────

const {
  articleFindManyMock,
  articleUpdateMock,
  enqueueIndexingMock,
  fetchCtrMock,
  readConfigMock,
  alertTier3Mock,
  workerOnMock,
  capturedProcessor,
} = vi.hoisted(() => ({
  articleFindManyMock: vi.fn(),
  articleUpdateMock: vi.fn().mockResolvedValue({}),
  enqueueIndexingMock: vi
    .fn()
    .mockResolvedValue({ url: "x", indexnowEnqueued: true, googleEnqueued: false }),
  fetchCtrMock: vi.fn(),
  readConfigMock: vi.fn().mockResolvedValue({ active: false }),
  alertTier3Mock: vi.fn().mockResolvedValue(undefined),
  workerOnMock: vi.fn(),
  capturedProcessor: { current: null as null | ((job: unknown) => Promise<void>) },
}));

vi.mock("bullmq", () => ({
  Worker: vi
    .fn()
    .mockImplementation((_name: string, processor: (job: unknown) => Promise<void>) => {
      capturedProcessor.current = processor;
      return { on: workerOnMock, close: vi.fn() };
    }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findMany: articleFindManyMock,
      update: articleUpdateMock,
    },
  },
}));

vi.mock("@/server/content-gen/lifecycle/analytics-clients", () => ({
  fetchSearchConsoleCtr: fetchCtrMock,
}));

vi.mock("@/server/content-gen/indexing/enqueue", () => ({
  enqueueIndexingForTier1: enqueueIndexingMock,
}));

vi.mock("@/server/content-gen/indexing/url-builder", () => ({
  buildArticleUrl: ({ slug, isNews }: { slug: string; isNews: boolean }) =>
    `https://axion-ia.com/fr/${isNews ? "actualites" : "blog"}/${slug}`,
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertTier3Stagnant: alertTier3Mock,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

interface ArticleFixture {
  id: string;
  slug: string;
  isNews?: boolean;
  publishedAt: Date;
  indexationTier: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow";
  promotedAt?: Date | null;
}

function makeArticle(f: ArticleFixture) {
  return {
    id: f.id,
    isNews: f.isNews ?? false,
    publishedAt: f.publishedAt,
    indexationTier: f.indexationTier,
    promotedAt: f.promotedAt ?? null,
    translations: [{ slug: f.slug, locale: "fr" }],
  };
}

async function loadAndRunProcessor(): Promise<void> {
  // Import worker module → enregistre processor au constructeur Worker
  const mod = await import("../content-tier-lifecycle-worker");
  // Démarre worker pour que processor soit capturé
  process.env.REDIS_URL = "redis://stub.invalid:6379";
  mod.startTierLifecycleWorker();
  if (!capturedProcessor.current) {
    throw new Error("Processor not captured — vi.mock bullmq not effective");
  }
  await capturedProcessor.current({ id: "test-job", data: { trigger: "test" } });
  await mod.stopTierLifecycleWorker();
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("content-tier-lifecycle-worker — Sub-agent D Sprint S+5 P2-10", () => {
  beforeEach(() => {
    vi.resetModules();
    articleFindManyMock.mockReset();
    articleUpdateMock.mockReset().mockResolvedValue({});
    enqueueIndexingMock.mockReset().mockResolvedValue({
      url: "x",
      indexnowEnqueued: true,
      googleEnqueued: false,
    });
    fetchCtrMock.mockReset();
    readConfigMock.mockReset().mockResolvedValue({ active: false });
    alertTier3Mock.mockReset().mockResolvedValue(undefined);
    workerOnMock.mockReset();
    capturedProcessor.current = null;
  });

  it("happy path : promote tier-2 → tier-1 quand CTR > seuil + impressions > min", async () => {
    // 4 verticales doctrine — fixture intervention
    const article = makeArticle({
      id: "art-interv-001",
      slug: "audit-ia-cabinet-conseil",
      publishedAt: new Date(Date.now() - 30 * 86_400_000), // 30j > seuil 14j
      indexationTier: "tier_2_noindex_follow",
    });
    articleFindManyMock
      .mockResolvedValueOnce([article]) // promote scan
      .mockResolvedValueOnce([]) // demote scan
      .mockResolvedValueOnce([]); // tier3 stagnant scan

    // CTR 4% > seuil 3% promote + 200 impressions > min 100
    fetchCtrMock.mockResolvedValue({ ctr: 0.04, impressions: 200, clicks: 8 });

    await loadAndRunProcessor();

    expect(articleUpdateMock).toHaveBeenCalledTimes(1);
    expect(articleUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-interv-001" },
        data: expect.objectContaining({
          indexationTier: "tier_1_indexable",
        }),
      }),
    );
    expect(enqueueIndexingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "art-interv-001",
        slug: "audit-ia-cabinet-conseil",
        origin: "tier-promote",
      }),
    );
  });

  it("failure path : prisma.article.update throws → propagate error (BullMQ retry path)", async () => {
    const article = makeArticle({
      id: "art-impl-fail",
      slug: "automatisation-rpa-pme",
      publishedAt: new Date(Date.now() - 30 * 86_400_000),
      indexationTier: "tier_2_noindex_follow",
    });
    articleFindManyMock
      .mockResolvedValueOnce([article])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    fetchCtrMock.mockResolvedValue({ ctr: 0.05, impressions: 500 });

    articleUpdateMock.mockRejectedValueOnce(new Error("P2002: Unique constraint failed"));

    await expect(loadAndRunProcessor()).rejects.toThrow(/Unique constraint/);
  });

  it("kill-switch actif → skip total (0 prisma read, 0 update)", async () => {
    readConfigMock.mockResolvedValue({ active: true });

    await loadAndRunProcessor();

    expect(articleFindManyMock).not.toHaveBeenCalled();
    expect(articleUpdateMock).not.toHaveBeenCalled();
    expect(enqueueIndexingMock).not.toHaveBeenCalled();
    expect(alertTier3Mock).not.toHaveBeenCalled();
  });

  it("edge case : demote tier-1 → tier-2 + alertTier3Stagnant câblée si stagnants présents", async () => {
    // Article tier-1 vieux 60j, CTR < 1% → demote
    const article = makeArticle({
      id: "art-audit-demote",
      slug: "audit-conformite-rgpd-ia",
      publishedAt: new Date(Date.now() - 60 * 86_400_000),
      indexationTier: "tier_1_indexable",
      promotedAt: null, // pas de manual promote protection
    });
    // 2 articles tier-3 stagnants > 90j → trigger alertTier3Stagnant
    const stagnant1 = { publishedAt: new Date(Date.now() - 120 * 86_400_000) };
    const stagnant2 = { publishedAt: new Date(Date.now() - 100 * 86_400_000) };

    articleFindManyMock
      .mockResolvedValueOnce([]) // promote scan vide
      .mockResolvedValueOnce([article]) // demote scan
      .mockResolvedValueOnce([stagnant1, stagnant2]); // tier3 stagnant scan

    fetchCtrMock.mockResolvedValue({ ctr: 0.005, impressions: 1500 }); // 0.5% < 1%

    await loadAndRunProcessor();

    expect(articleUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-audit-demote" },
        data: expect.objectContaining({
          indexationTier: "tier_2_noindex_follow",
          promotedAt: null,
        }),
      }),
    );
    expect(alertTier3Mock).toHaveBeenCalledTimes(1);
    // 1er arg = count, 2e = oldestAgeDays
    const [count, oldestAge] = alertTier3Mock.mock.calls[0] as [number, number];
    expect(count).toBe(2);
    expect(oldestAge).toBeGreaterThanOrEqual(119); // ~120j
  });
});
