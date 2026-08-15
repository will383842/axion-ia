/**
 * P1.5 QW-2 — Tests throttle publish-worker : drip window + daily cap.
 *
 * Scénarios couverts :
 *  1. heure 3h CET (out_of_window) → job.moveToDelayed + throw DelayedError
 *     (Fix 2026-08-15 D3 — contrat BullMQ v5 après moveToDelayed manuel)
 *  2. 30 articles publiés aujourd'hui (max_daily) → moveToDelayed + DelayedError
 *  3. 10h CET + 10 articles publiés → publish passe le gate (processJob continue)
 *     + le slot journalier est RENDU quand le pipeline sort sans publier
 *     (Fix 2026-08-15 D4 — le cap n'est plus mangé à vide par les rejeux)
 *  4. review non approuvée → early-return sans publication → slot rendu (D4)
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
  redisIncrMock,
  redisDecrMock,
  redisExpireMock,
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
    redisIncrMock: vi.fn().mockResolvedValue(1),
    redisDecrMock: vi.fn().mockResolvedValue(0),
    redisExpireMock: vi.fn().mockResolvedValue(1),
  };
});

// Fix 2026-08-15 (D3) — le worker importe désormais DelayedError de bullmq :
// le mock doit l'exposer (classe fidèle : name + message par défaut, comme
// bullmq/dist/esm/classes/errors/delayed-error.js). Déclarée via vi.hoisted
// pour être visible depuis la factory vi.mock (hoistée en tête de fichier).
const { MockDelayedError } = vi.hoisted(() => {
  class MockDelayedErrorInner extends Error {
    constructor(message = "bullmq:movedToDelayed") {
      super(message);
      this.name = "DelayedError";
    }
  }
  return { MockDelayedError: MockDelayedErrorInner };
});

vi.mock("bullmq", () => ({
  Worker: workerCtorMock,
  Queue: queueCtorMock,
  DelayedError: MockDelayedError,
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

// Fix 2026-08-15 (D6) — le worker lit désormais les booléens du résultat.
vi.mock("@/server/content-gen/indexing/enqueue", () => ({
  enqueueIndexingForTier1: vi
    .fn()
    .mockResolvedValue({ url: "x", indexnowEnqueued: true, googleEnqueued: false }),
}));

// Fix 2026-08-15 (D1) — revalidateContent retourne désormais { ok, reason }.
vi.mock("@/server/content-gen/shared/revalidate-content", () => ({
  revalidateContent: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/server/content-gen/generators/blog-from-rss", () => ({
  enrichOutputWithNewsArticleJsonLd: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    incr: redisIncrMock,
    decr: redisDecrMock,
    expire: redisExpireMock,
  },
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
    redisIncrMock.mockReset();
    redisDecrMock.mockReset();
    redisExpireMock.mockReset();
    redisIncrMock.mockResolvedValue(1);
    redisDecrMock.mockResolvedValue(0);
    redisExpireMock.mockResolvedValue(1);
    // Forcer cap fixe via env pour éviter d'appeler prisma.article.count dans getEffectivePublishCap
    process.env.MAX_PUBLISH_PER_DAY = "30";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("out_of_window : 3h CET → moveToDelayed + DelayedError, article non créé", async () => {
    // En mai (CEST = UTC+2) : 3h Paris = 1h UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T01:00:00.000Z"));

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);
    // Fix 2026-08-15 (D3) — contrat BullMQ v5 : après moveToDelayed manuel, le
    // processor DOIT lever DelayedError (sinon « job not in active state »).
    await expect(processor(job)).rejects.toThrow("bullmq:movedToDelayed");

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

  it("max_daily : cap atteint (10h CET) → moveToDelayed + DelayedError", async () => {
    // 10h Paris en mai = 8h UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T08:00:00.000Z"));
    // Redis INCR retourne 31 → cap (30) dépassé → moveToDelayed
    redisIncrMock.mockResolvedValue(31);

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);
    // Fix 2026-08-15 (D3) — même contrat que out_of_window.
    await expect(processor(job)).rejects.toThrow("bullmq:movedToDelayed");

    expect(redisIncrMock).toHaveBeenCalledOnce();
    // UN SEUL decr (annulation inline du cap) — pas de double-restitution D4.
    expect(redisDecrMock).toHaveBeenCalledOnce();
    expect(job.moveToDelayed).toHaveBeenCalledOnce();
    const [delayTs] = (job.moveToDelayed as ReturnType<typeof vi.fn>).mock.calls[0] as [number];
    expect(delayTs).toBeGreaterThan(new Date("2026-05-21T08:00:00.000Z").getTime());
  });

  it("gate passé : 10h CET + 10 articles publiés → prisma.reviewQueue.findUnique appelé", async () => {
    // 10h Paris = 8h UTC — dans la fenêtre + cap non atteint
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T08:00:00.000Z"));
    // Redis INCR retourne 10 → sous le cap (30) → passe le gate
    redisIncrMock.mockResolvedValue(10);
    // Simule ReviewQueue not found (throw) pour arrêter processJob après le gate
    reviewFindMock.mockResolvedValue(null);

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);

    await expect(processor(job)).rejects.toThrow("ReviewQueue rq-abc not found");

    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(redisIncrMock).toHaveBeenCalledOnce();
    // Fix 2026-08-15 (D4) — le pipeline a throw APRÈS l'acquisition du slot
    // sans publier : le finally rend le slot (avant ce fix, chaque échec/rejeu
    // consommait un slot du cap journalier à vide).
    expect(redisDecrMock).toHaveBeenCalledOnce();
    expect(reviewFindMock).toHaveBeenCalledOnce();
  });

  it("D4 : review non approuvée → early-return sans publication → slot rendu", async () => {
    // 10h Paris = 8h UTC — gates passés, slot acquis (INCR → 10)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T08:00:00.000Z"));
    redisIncrMock.mockResolvedValue(10);
    // Review existante mais PAS approuvée → early-return métier (skip)
    reviewFindMock.mockResolvedValue({
      id: "rq-abc",
      status: "pending",
      job: { id: "cg-1" },
    });

    const processor = await getProcessor();
    const job = fakeJob(JOB_DATA);
    await processor(job); // resolve sans throw (skip propre)

    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(redisIncrMock).toHaveBeenCalledOnce();
    // Fix 2026-08-15 (D4) — le slot acquis est rendu : rien n'a été publié.
    expect(redisDecrMock).toHaveBeenCalledOnce();
  });
});
