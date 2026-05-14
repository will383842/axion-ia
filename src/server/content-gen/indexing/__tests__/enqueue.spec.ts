import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addMock, queueCtorMock } = vi.hoisted(() => {
  const addMockInner = vi.fn().mockResolvedValue({ id: "job-id" });
  return {
    addMock: addMockInner,
    queueCtorMock: vi.fn(() => ({ add: addMockInner })),
  };
});

vi.mock("bullmq", () => ({
  Queue: queueCtorMock,
}));

import { enqueueIndexingForTier1, _resetIndexingQueuesForTest } from "../enqueue";

describe("enqueueIndexingForTier1", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    addMock.mockClear();
    queueCtorMock.mockClear();
    _resetIndexingQueuesForTest();
    process.env.REDIS_URL = "redis://test:6379";
    process.env.NEXT_PUBLIC_SITE_URL = "https://axion-ia.com";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns indexnowEnqueued=false when INDEXNOW_KEY missing", async () => {
    delete process.env.INDEXNOW_KEY;
    delete process.env.GOOGLE_INDEXING_API_ENABLED;

    const result = await enqueueIndexingForTier1({
      articleId: "a-1",
      slug: "my-post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(false);
    expect(result.googleEnqueued).toBe(false);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("enqueues indexnow when INDEXNOW_KEY present", async () => {
    process.env.INDEXNOW_KEY = "3a5c32d22b04f1430690cc33eaec6be9";
    delete process.env.GOOGLE_INDEXING_API_ENABLED;

    const result = await enqueueIndexingForTier1({
      articleId: "a-2",
      slug: "my-post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(true);
    expect(result.googleEnqueued).toBe(false);
    expect(result.url).toBe("https://axion-ia.com/fr/blog/my-post");
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledWith(
      "ping",
      { urls: ["https://axion-ia.com/fr/blog/my-post"], origin: "content-gen" },
      { jobId: "indexnow-a-2" },
    );
  });

  it("enqueues both indexnow + google when both flags set", async () => {
    process.env.INDEXNOW_KEY = "key123";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";

    const result = await enqueueIndexingForTier1({
      articleId: "a-3",
      slug: "news-item",
      isNews: true,
      origin: "tier-promote",
    });

    expect(result.indexnowEnqueued).toBe(true);
    expect(result.googleEnqueued).toBe(true);
    expect(result.url).toBe("https://axion-ia.com/fr/actualites/news-item");
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock).toHaveBeenNthCalledWith(
      1,
      "ping",
      { urls: ["https://axion-ia.com/fr/actualites/news-item"], origin: "tier-promote" },
      { jobId: "indexnow-a-3" },
    );
    expect(addMock).toHaveBeenNthCalledWith(
      2,
      "ping",
      { url: "https://axion-ia.com/fr/actualites/news-item", type: "URL_UPDATED" },
      { jobId: "google-indexing-a-3" },
    );
  });

  it("skips google when flag !== 'true'", async () => {
    process.env.INDEXNOW_KEY = "key";
    process.env.GOOGLE_INDEXING_API_ENABLED = "false";

    const result = await enqueueIndexingForTier1({
      articleId: "a-4",
      slug: "post",
      isNews: false,
      origin: "manual",
    });

    expect(result.googleEnqueued).toBe(false);
  });

  it("tolerates queue.add failure (fire-and-forget)", async () => {
    process.env.INDEXNOW_KEY = "key";
    addMock.mockRejectedValueOnce(new Error("Redis connection lost"));

    const result = await enqueueIndexingForTier1({
      articleId: "a-5",
      slug: "post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(false);
  });

  it("does not throw when REDIS_URL missing", async () => {
    delete process.env.REDIS_URL;
    process.env.INDEXNOW_KEY = "key";

    const result = await enqueueIndexingForTier1({
      articleId: "a-6",
      slug: "post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(false);
  });

  it("uses deterministic jobId for idempotency", async () => {
    process.env.INDEXNOW_KEY = "key";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";

    await enqueueIndexingForTier1({
      articleId: "stable-id",
      slug: "post",
      isNews: false,
      origin: "cron",
    });

    expect(addMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ jobId: "indexnow-stable-id" }),
    );
    expect(addMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ jobId: "google-indexing-stable-id" }),
    );
  });
});
