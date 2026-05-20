/**
 * Sub-agent D Sprint S+5 P2-10 (2026-05-20) — Tests Vitest content-keyword-sync-worker.
 *
 * Worker BullMQ cron hebdo (lundi 04:00 UTC). Pull top keywords GSC pour
 * articles tier-1+tier-2 publiés ≥ 7j, upsert KeywordTracking avec
 * positionDelta vs précédent sync.
 *
 * Pas de `runTickForTest` hook → on mocke `bullmq.Worker` pour capturer le
 * processor.
 *
 * Couvre :
 *  1. happy path : keywords upsertés depuis GSC (avec positionDelta calculé)
 *  2. failure path : GSC retourne null (credentials absents / API down) → apiSkipped++
 *  3. edge case : kill-switch actif → skip total
 *  4. edge case : article sans translation FR → skip (translations[0] undefined)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  articleFindManyMock,
  kwFindUniqueMock,
  kwUpsertMock,
  gscTopKeywordsMock,
  readConfigMock,
  capturedProcessor,
  workerOnMock,
} = vi.hoisted(() => ({
  articleFindManyMock: vi.fn(),
  kwFindUniqueMock: vi.fn(),
  kwUpsertMock: vi.fn().mockResolvedValue({}),
  gscTopKeywordsMock: vi.fn(),
  readConfigMock: vi.fn().mockResolvedValue({ active: false }),
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
    article: { findMany: articleFindManyMock },
    keywordTracking: {
      findUnique: kwFindUniqueMock,
      upsert: kwUpsertMock,
    },
  },
}));

vi.mock("@/server/content-gen/indexing/url-builder", () => ({
  buildArticleUrl: ({ slug, isNews }: { slug: string; isNews: boolean }) =>
    `https://axion-ia.com/fr/${isNews ? "actualites" : "blog"}/${slug}`,
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/seo/gsc-client", () => ({
  gscTopKeywordsForUrl: gscTopKeywordsMock,
}));

interface ArticleStub {
  id: string;
  slug: string;
  isNews?: boolean;
  indexationTier: "tier_1_indexable" | "tier_2_noindex_follow";
}

function makeArticle(a: ArticleStub) {
  return {
    id: a.id,
    isNews: a.isNews ?? false,
    indexationTier: a.indexationTier,
    translations: [{ slug: a.slug, locale: "fr" }],
  };
}

async function loadAndRun(): Promise<void> {
  const mod = await import("../content-keyword-sync-worker");
  process.env.REDIS_URL = "redis://stub.invalid:6379";
  mod.startKeywordSyncWorker();
  if (!capturedProcessor.current) {
    throw new Error("Processor not captured");
  }
  await capturedProcessor.current({ id: "test-job", data: { trigger: "test" } });
  await mod.stopKeywordSyncWorker();
}

describe("content-keyword-sync-worker — Sub-agent D Sprint S+5 P2-10", () => {
  beforeEach(() => {
    vi.resetModules();
    articleFindManyMock.mockReset();
    kwFindUniqueMock.mockReset();
    kwUpsertMock.mockReset().mockResolvedValue({});
    gscTopKeywordsMock.mockReset();
    readConfigMock.mockReset().mockResolvedValue({ active: false });
    workerOnMock.mockReset();
    capturedProcessor.current = null;
  });

  it("happy path : upsert keywords GSC avec positionDelta calculé vs existing", async () => {
    const article = makeArticle({
      id: "art-impl-001",
      slug: "automatisation-workflows-zapier-ia",
      indexationTier: "tier_1_indexable",
    });
    articleFindManyMock.mockResolvedValue([article]);

    // Pré-existing tracking (positionDelta = nouvelle - ancienne)
    kwFindUniqueMock.mockResolvedValueOnce({ position: 15 }); // ancien rank 15
    kwFindUniqueMock.mockResolvedValueOnce(null); // 2e keyword nouveau

    gscTopKeywordsMock.mockResolvedValue([
      { keyword: "automatisation ia pme", position: 8, ctr: 0.04, impressions: 200, clicks: 8 },
      { keyword: "zapier ia tutoriel", position: 5, ctr: 0.06, impressions: 150, clicks: 9 },
    ]);

    await loadAndRun();

    expect(kwUpsertMock).toHaveBeenCalledTimes(2);
    // 1er upsert : existing → positionDelta = 8 - 15 = -7 (amélioration)
    expect(kwUpsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          keyword_targetUrl: {
            keyword: "automatisation ia pme",
            targetUrl: "https://axion-ia.com/fr/blog/automatisation-workflows-zapier-ia",
          },
        },
        update: expect.objectContaining({
          position: 8,
          positionDelta: -7,
        }),
        create: expect.objectContaining({
          keyword: "automatisation ia pme",
          articleId: "art-impl-001",
          source: "gsc",
        }),
      }),
    );
    // 2e upsert : pas d'existing → positionDelta = null dans update
    const secondCall = kwUpsertMock.mock.calls[1]?.[0] as {
      update: { positionDelta: number | null };
    };
    expect(secondCall.update.positionDelta).toBeNull();
  });

  it("failure path : GSC retourne null → apiSkipped++ + 0 upsert", async () => {
    // verticale audit
    const article = makeArticle({
      id: "art-audit-001",
      slug: "audit-prompt-engineering-equipes",
      indexationTier: "tier_2_noindex_follow",
    });
    articleFindManyMock.mockResolvedValue([article]);
    gscTopKeywordsMock.mockResolvedValue(null); // credentials absents

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await loadAndRun();

    expect(kwUpsertMock).not.toHaveBeenCalled();
    expect(kwFindUniqueMock).not.toHaveBeenCalled();
    // Stats log : api_skipped=1
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("api_skipped=1"));
    logSpy.mockRestore();
  });

  it("edge case : kill-switch actif → skip total (0 prisma read, 0 GSC call)", async () => {
    readConfigMock.mockResolvedValue({ active: true });

    await loadAndRun();

    expect(articleFindManyMock).not.toHaveBeenCalled();
    expect(gscTopKeywordsMock).not.toHaveBeenCalled();
    expect(kwUpsertMock).not.toHaveBeenCalled();
  });

  it("edge case : article sans translation FR (drift slug / locale manquante) → skip silencieux", async () => {
    // verticale un-a-un (1-to-1) — article volontairement sans translation
    const articleWithoutTranslation = {
      id: "art-1to1-broken",
      isNews: false,
      indexationTier: "tier_1_indexable" as const,
      translations: [], // pas de FR translation → drift slug
    };
    articleFindManyMock.mockResolvedValue([articleWithoutTranslation]);

    await loadAndRun();

    // GSC pas appelé, upsert pas appelé — article skippé proprement
    expect(gscTopKeywordsMock).not.toHaveBeenCalled();
    expect(kwUpsertMock).not.toHaveBeenCalled();
  });
});
