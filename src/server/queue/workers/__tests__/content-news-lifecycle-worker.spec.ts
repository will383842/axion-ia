/**
 * Sprint S+5 P2-10 sub-agent C — Tests Vitest worker News lifecycle.
 *
 * Stratégie : mock BullMQ `Worker` ctor pour capter le processor au moment de
 * `startNewsLifecycleWorker()`, puis l'invoquer directement.
 *
 * Couvre :
 *  1. Happy path : 1 article > 90j → archive Article + revalidatePath
 *     + enqueueIndexingForTier1 (lifecycleEvent='delete').
 *  2. Failure path : Article.update throw (article supprimé manuellement) →
 *     swallow + continue, indexing pas enqueué.
 *  3. Edge case : 0 article candidat archive + count > 0 candidates demote →
 *     log seulement, ni update ni indexing.
 *  4. Kill switch actif → early-return, 0 Prisma call, 0 indexing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

const {
  findManyMock,
  articleUpdateMock,
  countMock,
  readConfigMock,
  enqueueIndexingMock,
  revalidatePathMock,
  workerCtorMock,
  capturedProcessor,
} = vi.hoisted(() => {
  const captured: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };
  return {
    findManyMock: vi.fn(),
    articleUpdateMock: vi.fn(),
    countMock: vi.fn(),
    readConfigMock: vi.fn(),
    enqueueIndexingMock: vi.fn().mockResolvedValue(undefined),
    revalidatePathMock: vi.fn(),
    workerCtorMock: vi.fn((_name: string, fn: (job: Job) => Promise<void>) => {
      captured.fn = fn;
      return {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }),
    capturedProcessor: captured,
  };
});

vi.mock("bullmq", () => ({
  Worker: workerCtorMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: {
      findMany: findManyMock,
      count: countMock,
    },
    article: {
      update: articleUpdateMock,
    },
  },
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/indexing/enqueue", () => ({
  enqueueIndexingForTier1: enqueueIndexingMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

async function getProcessor(): Promise<(job: Job) => Promise<void>> {
  vi.resetModules();
  capturedProcessor.fn = null;
  process.env.REDIS_URL = "redis://test:6379";
  const mod = await import("../content-news-lifecycle-worker");
  mod.startNewsLifecycleWorker();
  if (!capturedProcessor.fn) throw new Error("processor not captured");
  return capturedProcessor.fn;
}

function fakeJob(): Job<{ readonly trigger: string }> {
  return { data: { trigger: "cron" }, id: "nlc-1" } as unknown as Job<{ readonly trigger: string }>;
}

describe("content-news-lifecycle-worker — Sprint S+5 P2-10 sub-agent C", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    articleUpdateMock.mockReset();
    countMock.mockReset();
    readConfigMock.mockReset();
    readConfigMock.mockResolvedValue({ active: false });
    enqueueIndexingMock.mockClear();
    revalidatePathMock.mockClear();
    workerCtorMock.mockClear();
  });

  it("happy path — 1 article > 90j → archive + revalidate + enqueueIndexing delete", async () => {
    // ContentGenConfig: settings default (kill_switch + news_lifecycle)
    readConfigMock.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "kill_switch") return { active: false };
      if (key === "news_lifecycle") return defaultValue;
      return defaultValue;
    });
    findManyMock.mockResolvedValue([{ id: "cg-job-old-1", outputBlogPostId: "article-old-1" }]);
    articleUpdateMock.mockResolvedValue({
      id: "article-old-1",
      translations: [{ slug: "audit-rgpd-2024" }],
    });
    countMock.mockResolvedValue(3); // 3 candidates demote tier-2

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(articleUpdateMock).toHaveBeenCalledTimes(1);
    const updateArg = articleUpdateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { status: string; indexationTier: string };
    };
    expect(updateArg.where.id).toBe("article-old-1");
    expect(updateArg.data.status).toBe("archived");
    expect(updateArg.data.indexationTier).toBe("tier_3_noindex_nofollow");

    expect(revalidatePathMock).toHaveBeenCalledWith("/fr/actualites/audit-rgpd-2024");
    expect(enqueueIndexingMock).toHaveBeenCalledTimes(1);
    const enqArg = enqueueIndexingMock.mock.calls[0]?.[0] as {
      articleId: string;
      slug: string;
      lifecycleEvent: string;
    };
    expect(enqArg.articleId).toBe("article-old-1");
    expect(enqArg.slug).toBe("audit-rgpd-2024");
    expect(enqArg.lifecycleEvent).toBe("delete");
  });

  it("failure path — Article.update throw (article supprimé) → swallow, pas d'indexing", async () => {
    readConfigMock.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "kill_switch") return { active: false };
      if (key === "news_lifecycle") return defaultValue;
      return defaultValue;
    });
    findManyMock.mockResolvedValue([{ id: "cg-job-ghost", outputBlogPostId: "article-ghost" }]);
    articleUpdateMock.mockRejectedValue(new Error("Record not found"));
    countMock.mockResolvedValue(0);

    const processor = await getProcessor();
    // Doit ne pas throw (swallow caché)
    await expect(processor(fakeJob())).resolves.toBeUndefined();

    expect(articleUpdateMock).toHaveBeenCalledTimes(1);
    expect(enqueueIndexingMock).not.toHaveBeenCalled();
  });

  it("edge case — 0 article à archiver, N candidates demote → log seulement", async () => {
    readConfigMock.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "kill_switch") return { active: false };
      if (key === "news_lifecycle") return defaultValue;
      return defaultValue;
    });
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(7);

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(articleUpdateMock).not.toHaveBeenCalled();
    expect(enqueueIndexingMock).not.toHaveBeenCalled();
    // Pas d'archives → pas de revalidate sitemap-news global
    expect(revalidatePathMock).not.toHaveBeenCalled();
    // count appelé pour demote candidates
    expect(countMock).toHaveBeenCalledTimes(1);
  });

  it("kill switch actif → early-return, 0 Prisma call, 0 indexing", async () => {
    readConfigMock.mockResolvedValue({ active: true });

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(findManyMock).not.toHaveBeenCalled();
    expect(articleUpdateMock).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();
    expect(enqueueIndexingMock).not.toHaveBeenCalled();
  });
});
