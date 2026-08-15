import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fix 2026-08-15 (D5) — le mock expose aussi `getJob` : le helper
// addPingWithReenqueue lit l'état du job existant avant le add (motif
// remove-then-enqueue, cf. reenqueue-policy). Par défaut aucun job existant.
const { addMock, getJobMock, queueCtorMock } = vi.hoisted(() => {
  const addMockInner = vi.fn().mockResolvedValue({ id: "job-id" });
  const getJobMockInner = vi.fn().mockResolvedValue(undefined);
  return {
    addMock: addMockInner,
    getJobMock: getJobMockInner,
    queueCtorMock: vi.fn(() => ({ add: addMockInner, getJob: getJobMockInner })),
  };
});

vi.mock("bullmq", () => ({
  Queue: queueCtorMock,
}));

import {
  enqueueIndexingForTier1,
  enqueueGoogleIndexingForUrls,
  _resetIndexingQueuesForTest,
} from "../enqueue";

describe("enqueueIndexingForTier1", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    addMock.mockClear();
    getJobMock.mockClear();
    getJobMock.mockResolvedValue(undefined);
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
    // Audit indexation 2026-05-15 P0-6 — jobId suffixé `-${event}` (event défaut
    // = "publish") pour permettre re-ping si lifecycle change rapidement
    // (publish → delete dans la même fenêtre BullMQ).
    expect(addMock).toHaveBeenCalledWith(
      "ping",
      { urls: ["https://axion-ia.com/fr/blog/my-post"], origin: "content-gen" },
      { jobId: "indexnow-a-2-publish" },
    );
  });

  it("enqueues both indexnow + google when both flags set", async () => {
    process.env.INDEXNOW_KEY = "key123";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";
    // Articles : opt-in explicite requis en plus du master (Google ignore les
    // non-JobPosting → protège le quota 200/j réservé aux offres).
    process.env.GOOGLE_INDEXING_ARTICLES = "true";

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
      { jobId: "indexnow-a-3-publish" },
    );
    expect(addMock).toHaveBeenNthCalledWith(
      2,
      "ping",
      { url: "https://axion-ia.com/fr/actualites/news-item", type: "URL_UPDATED" },
      { jobId: "google-indexing-a-3-publish" },
    );
  });

  it("passes lifecycleEvent=delete → URL_DELETED + jobId suffix", async () => {
    process.env.INDEXNOW_KEY = "key123";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";
    process.env.GOOGLE_INDEXING_ARTICLES = "true";

    await enqueueIndexingForTier1({
      articleId: "a-7",
      slug: "archived-post",
      isNews: false,
      origin: "manual",
      lifecycleEvent: "delete",
    });

    expect(addMock).toHaveBeenNthCalledWith(
      1,
      "ping",
      expect.objectContaining({ urls: ["https://axion-ia.com/fr/blog/archived-post"] }),
      { jobId: "indexnow-a-7-delete" },
    );
    expect(addMock).toHaveBeenNthCalledWith(
      2,
      "ping",
      { url: "https://axion-ia.com/fr/blog/archived-post", type: "URL_DELETED" },
      { jobId: "google-indexing-a-7-delete" },
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

  it("skips google for ARTICLES when master ON but GOOGLE_INDEXING_ARTICLES unset", async () => {
    // Régression : le master seul (posé en prod pour Google for Jobs) ne doit
    // PAS faire pinger les articles (Google ignore + gaspille le quota).
    process.env.INDEXNOW_KEY = "key";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";
    delete process.env.GOOGLE_INDEXING_ARTICLES;

    const result = await enqueueIndexingForTier1({
      articleId: "a-8",
      slug: "post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(true);
    expect(result.googleEnqueued).toBe(false);
    // Un seul add (IndexNow), aucun add Google.
    expect(addMock).toHaveBeenCalledOnce();
  });

  // ── Fix 2026-08-15 (D5 audit e2e) — re-ping après job complété ─────────────
  // Symptôme corrigé : le jobId `indexnow-${articleId}-publish` est stable ; le
  // chemin REFRESH repassait ici avec le même articleId + event publish, or le
  // job COMPLÉTÉ précédent squattait la clé dans Redis (retention count 1000) →
  // BullMQ ignorait silencieusement le `add` → article rafraîchi jamais re-pingé.

  it("D5 : job précédent complété → remove puis add (re-ping du refresh)", async () => {
    process.env.INDEXNOW_KEY = "key";
    delete process.env.GOOGLE_INDEXING_API_ENABLED;
    const removeMock = vi.fn().mockResolvedValue(undefined);
    getJobMock.mockResolvedValue({
      getState: vi.fn().mockResolvedValue("completed"),
      remove: removeMock,
    });

    const result = await enqueueIndexingForTier1({
      articleId: "a-refresh",
      slug: "my-post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(true);
    expect(removeMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledWith("ping", expect.anything(), {
      jobId: "indexnow-a-refresh-publish",
    });
  });

  it("D5 : job précédent encore en vol (waiting) → pas de doublon, mais enqueued=true", async () => {
    process.env.INDEXNOW_KEY = "key";
    delete process.env.GOOGLE_INDEXING_API_ENABLED;
    const removeMock = vi.fn();
    getJobMock.mockResolvedValue({
      getState: vi.fn().mockResolvedValue("waiting"),
      remove: removeMock,
    });

    const result = await enqueueIndexingForTier1({
      articleId: "a-inflight",
      slug: "my-post",
      isNews: false,
      origin: "content-gen",
    });

    // Le ping en attente couvre l'occurrence : idempotence d'origine préservée.
    expect(result.indexnowEnqueued).toBe(true);
    expect(removeMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
  });

  it("D5 : getJob qui throw (Redis flaky) → fallback add nu (comportement historique)", async () => {
    process.env.INDEXNOW_KEY = "key";
    delete process.env.GOOGLE_INDEXING_API_ENABLED;
    getJobMock.mockRejectedValue(new Error("connection lost"));

    const result = await enqueueIndexingForTier1({
      articleId: "a-flaky",
      slug: "my-post",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(true);
    expect(addMock).toHaveBeenCalledOnce();
  });

  // Fix 2026-08-15 (D8) — garde isRoutableArticleSlug : un slug avec `/`
  // (donnée malformée, incident GSC 2026-07-11) produirait une URL 404 dure.
  it("D8 : slug contenant / → aucun ping (garde slug routable)", async () => {
    process.env.INDEXNOW_KEY = "key";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";
    process.env.GOOGLE_INDEXING_ARTICLES = "true";

    const result = await enqueueIndexingForTier1({
      articleId: "a-malformed",
      slug: "glossaire/formation-ia-maurepas",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.indexnowEnqueued).toBe(false);
    expect(result.googleEnqueued).toBe(false);
    expect(addMock).not.toHaveBeenCalled();
  });

  // Fix 2026-08-15 (D8) — un article guide est pingé sous sa VRAIE route.
  it("D8 : slug guide-* → URL pingée sous /fr/guides/ (pas /fr/blog/ qui 308)", async () => {
    process.env.INDEXNOW_KEY = "key";
    delete process.env.GOOGLE_INDEXING_API_ENABLED;

    const result = await enqueueIndexingForTier1({
      articleId: "a-guide",
      slug: "guide-audit-ia-pme",
      isNews: false,
      origin: "content-gen",
    });

    expect(result.url).toBe("https://axion-ia.com/fr/guides/guide-audit-ia-pme");
    expect(addMock).toHaveBeenCalledWith(
      "ping",
      expect.objectContaining({ urls: ["https://axion-ia.com/fr/guides/guide-audit-ia-pme"] }),
      expect.anything(),
    );
  });

  it("uses deterministic jobId for idempotency", async () => {
    process.env.INDEXNOW_KEY = "key";
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";
    process.env.GOOGLE_INDEXING_ARTICLES = "true";

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
      expect.objectContaining({ jobId: "indexnow-stable-id-publish" }),
    );
    expect(addMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ jobId: "google-indexing-stable-id-publish" }),
    );
  });
});

describe("enqueueGoogleIndexingForUrls (google-only, offres d'emploi)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    addMock.mockClear();
    getJobMock.mockClear();
    getJobMock.mockResolvedValue(undefined);
    queueCtorMock.mockClear();
    _resetIndexingQueuesForTest();
    process.env.REDIS_URL = "redis://test:6379";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("no-op complet quand GOOGLE_INDEXING_API_ENABLED !== 'true'", async () => {
    delete process.env.GOOGLE_INDEXING_API_ENABLED;
    process.env.INDEXNOW_KEY = "key"; // ne doit JAMAIS déclencher IndexNow ici

    const result = await enqueueGoogleIndexingForUrls({
      entityId: "joboffer-dev-ia",
      urls: ["https://axion-ia.com/fr/carrieres/dev-ia"],
      origin: "manual",
      lifecycleEvent: "publish",
    });

    expect(result.googleEnqueued).toBe(false);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("enqueue Google URL_UPDATED (et JAMAIS IndexNow) quand flag ON", async () => {
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";
    process.env.INDEXNOW_KEY = "key";

    const result = await enqueueGoogleIndexingForUrls({
      entityId: "joboffer-dev-ia",
      urls: ["https://axion-ia.com/fr/carrieres/dev-ia"],
      origin: "manual",
      lifecycleEvent: "publish",
    });

    expect(result.googleEnqueued).toBe(true);
    // Un seul add : la file Google. Aucune file IndexNow (pas de double-ping).
    expect(addMock).toHaveBeenCalledOnce();
    expect(addMock).toHaveBeenCalledWith(
      "ping",
      { url: "https://axion-ia.com/fr/carrieres/dev-ia", type: "URL_UPDATED" },
      { jobId: "google-indexing-joboffer-dev-ia-0-publish" },
    );
  });

  it("mappe lifecycleEvent=delete → URL_DELETED", async () => {
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";

    await enqueueGoogleIndexingForUrls({
      entityId: "joboffer-dev-ia",
      urls: ["https://axion-ia.com/fr/carrieres/dev-ia"],
      origin: "manual",
      lifecycleEvent: "delete",
    });

    expect(addMock).toHaveBeenCalledWith(
      "ping",
      { url: "https://axion-ia.com/fr/carrieres/dev-ia", type: "URL_DELETED" },
      { jobId: "google-indexing-joboffer-dev-ia-0-delete" },
    );
  });

  it("no-op sur liste d'URLs vide", async () => {
    process.env.GOOGLE_INDEXING_API_ENABLED = "true";

    const result = await enqueueGoogleIndexingForUrls({
      entityId: "joboffer-x",
      urls: [],
      origin: "manual",
    });

    expect(result.googleEnqueued).toBe(false);
    expect(addMock).not.toHaveBeenCalled();
  });
});
