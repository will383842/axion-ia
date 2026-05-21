/**
 * P1.5 QW-2 — Tests throttle publish-worker : drip window + daily cap.
 *
 * Scénarios couverts :
 *  1. heure 3h CET (out_of_window) → job.moveToDelayed + return
 *  2. 30 articles publiés aujourd'hui (max_daily) → job.moveToDelayed + return
 *  3. 10h CET + 10 articles publiés → publish passe le gate (processJob continue)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  articleCountMock,
  reviewFindMock,
  readConfigMock,
  logStepMock,
  logStepErrorMock,
  sendTelegramMock,
  captureWorkerErrorMock,
  workerCtorMock,
  queueCtorMock,
  capturedProcessor,
} = vi.hoisted(() => {
  const captured: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };
  return {
    articleCountMock: vi.fn(),
    reviewFindMock: vi.fn(),
    readConfigMock: vi.fn().mockResolvedValue({ active: false }),
    logStepMock: vi.fn().mockResolvedValue(undefined),
    logStepErrorMock: vi.fn().mockResolvedValue(undefined),
    sendTelegramMock: vi.fn().mockResolvedValue(undefined),
    captureWorkerErrorMock: vi.fn(),
    workerCtorMock: vi.fn((_name: string, fn: (job: Job) => Promise<void>) => {
      captured.fn = fn;
      return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
    }),
    queueCtorMock: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
    capturedProcessor: captured,
  };
});

vi.mock("bullmq", () => ({
  Worker: workerCtorMock,
  Queue: queueCtorMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { count: articleCountMock },
    reviewQueue: { findUnique: reviewFindMock },
    contentGenJob: { update: vi.fn().mockResolvedValue(undefined) },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

vi.mock("@/server/content-gen/shared/generation-log", () => ({
  logStep: logStepMock,
  logStepError: logStepErrorMock,
}));

vi.mock("@/lib/telegram", () => ({
  sendTelegram: sendTelegramMock,
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: captureWorkerErrorMock,
}));

vi.mock("@/server/content-gen/indexing/enqueue", () => ({
  enqueueIndexingForTier1: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/content-gen/shared/revalidate-content", () => ({
  revalidateContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/content-gen/generators/blog-from-rss", () => ({
  enrichOutputWithNewsArticleJsonLd: vi.fn().mockReturnValue({}),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PublishJobData = { reviewQueueId: string; promoteToTier1: boolean };

async function getProcessor(): Promise<(job: Job<PublishJobData>) => Promise<void>> {
  vi.resetModules();
  capturedProcessor.fn = null;
  process.env.REDIS_URL = "redis://test:6379";
  const mod = await import("../content-publish-worker");
  (mod as { startPublishWorker: () => unknown }).startPublishWorker();
  if (!capturedProcessor.fn) throw new Error("processor not captured");
  return capturedProcessor.fn as (job: Job<PublishJobData>) => Promise<void>;
}

function fakeJob(data: PublishJobData): Job<PublishJobData> {
  return {
    data,
    id: "pub-job-1",
    token: "test-token",
    moveToDelayed: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<PublishJobData>;
}

const JOB_DATA: PublishJobData = { reviewQueueId: "rq-abc", promoteToTier1: false };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("content-publish-worker — P1.5 QW-2 throttle", () => {
  beforeEach(() => {
    articleCountMock.mockReset();
    reviewFindMock.mockReset();
    readConfigMock.mockReset();
    readConfigMock.mockResolvedValue({ active: false });
    logStepMock.mockClear();
    workerCtorMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("out_of_window : 3h CET → moveToDelayed appelé, article non créé", async () => {
    // En mai (CEST = UTC+2) : 3h Paris = 1h UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T01:00:00.000Z"));

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);
    await processor(job);

    expect(job.moveToDelayed).toHaveBeenCalledOnce();
    // La cible est après le début de la fenêtre (8h CET ≥ now)
    const [delayTs] = (job.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0] as [number];
    const delayDate = new Date(delayTs);
    // Doit être dans le futur (> now mocked)
    expect(delayTs).toBeGreaterThan(new Date("2026-05-21T01:00:00.000Z").getTime());
    // Doit être ≤ +24h
    expect(delayTs).toBeLessThan(
      new Date("2026-05-21T01:00:00.000Z").getTime() + 24 * 60 * 60 * 1000,
    );
    // Aucun article créé (prisma.article.count non appelé = guard avant)
    expect(articleCountMock).not.toHaveBeenCalled();
    void delayDate;
  });

  it("max_daily : 30 articles publiés aujourd'hui (10h CET) → moveToDelayed", async () => {
    // 10h Paris en mai = 8h UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T08:00:00.000Z"));
    articleCountMock.mockResolvedValue(30); // cap atteint

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);
    await processor(job);

    expect(articleCountMock).toHaveBeenCalledOnce();
    expect(job.moveToDelayed).toHaveBeenCalledOnce();
    const [delayTs] = (job.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0] as [number];
    expect(delayTs).toBeGreaterThan(new Date("2026-05-21T08:00:00.000Z").getTime());
  });

  it("gate passé : 10h CET + 10 articles publiés → prisma.reviewQueue.findUnique appelé", async () => {
    // 10h Paris = 8h UTC — dans la fenêtre + cap non atteint
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T08:00:00.000Z"));
    articleCountMock.mockResolvedValue(10); // sous le cap (30)
    // Simule ReviewQueue not found (throw) pour arrêter processJob après le gate
    reviewFindMock.mockResolvedValue(null);

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);

    await expect(processor(job)).rejects.toThrow("ReviewQueue rq-abc not found");

    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(articleCountMock).toHaveBeenCalledOnce();
    expect(reviewFindMock).toHaveBeenCalledOnce();
  });
});
