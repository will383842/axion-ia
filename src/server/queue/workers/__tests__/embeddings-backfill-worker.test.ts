/**
 * Phase F Sprint Perfection 2026 — Tests embeddings-backfill-worker.ts
 *
 * 6 scénarios :
 *  1. OPENAI_EMBEDDINGS_ENABLED=false → skip (aucun appel DB ni OpenAI)
 *  2. Aucun article sans embedding → log "nothing to do"
 *  3. Run normal 3 articles → appelle OpenAI embedder 1 fois (batch)
 *  4. Rate limit journalier dépassé → s'arrête proprement
 *  5. Erreur OpenAI sur un article → continue avec le reste (partial success)
 *  6. Nom de worker enregistré correctement
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const queryRawUnsafeMock = vi.fn();
const executeRawMock = vi.fn();
const configUpsertMock = vi.fn();
const openaiEmbeddingsCreateMock = vi.fn();
const captureWorkerErrorMock = vi.fn();

// Capture le processor injecté dans le Worker BullMQ.
const capturedProcessor: { fn: ((job: Job) => Promise<unknown>) | null } = { fn: null };
let capturedWorkerName: string | null = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => queryRawUnsafeMock(...args),
    $executeRaw: (...args: unknown[]) => executeRawMock(...args),
    contentGenConfig: {
      upsert: (args: unknown) => configUpsertMock(args),
    },
  },
}));

vi.mock("openai", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: vi.fn().mockImplementation((_opts: any) => ({
    embeddings: {
      create: (...args: unknown[]) => openaiEmbeddingsCreateMock(...args),
    },
  })),
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: (...args: unknown[]) => captureWorkerErrorMock(...args),
}));

vi.mock("bullmq", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Worker: vi.fn().mockImplementation((name: string, fn: any) => {
    capturedWorkerName = name;
    capturedProcessor.fn = fn;
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

// Import AFTER mocks.
import { startEmbeddingsBackfillWorker, EMBEDDINGS_BACKFILL_QUEUE } from "../embeddings-backfill-worker";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_JOB = { id: "job-1", data: {} } as Job;

function makeEmbeddingResponse(count: number) {
  return {
    data: Array.from({ length: count }, (_, i) => ({
      embedding: Array.from({ length: 1536 }, () => i * 0.001),
    })),
    usage: { total_tokens: count * 695 },
  };
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeAll(() => {
  // Set REDIS_URL before module-level singleton is booted.
  process.env.REDIS_URL = "redis://test.invalid:6379";
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.OPENAI_EMBEDDINGS_ENABLED = "true";
  process.env.OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY = "1000000";
  // Boot the worker singleton once so the processor is captured.
  startEmbeddingsBackfillWorker();
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://test.invalid:6379";
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.OPENAI_EMBEDDINGS_ENABLED = "true";
  process.env.OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY = "1000000";

  configUpsertMock.mockResolvedValue({ key: "embeddings_last_run", value: {} });
  executeRawMock.mockResolvedValue(1);
});

afterEach(() => {
  delete process.env.OPENAI_EMBEDDINGS_ENABLED;
  delete process.env.OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("embeddings-backfill-worker", () => {
  it("T1: OPENAI_EMBEDDINGS_ENABLED=false → skip sans appel DB ni OpenAI", async () => {
    process.env.OPENAI_EMBEDDINGS_ENABLED = "false";

    const fn = capturedProcessor.fn!;
    await fn(MOCK_JOB);

    // Aucun appel à $queryRawUnsafe (articles query), ni à OpenAI
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
    expect(openaiEmbeddingsCreateMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();

    // ContentGenConfig upsert doit toujours être appelé (log du skip)
    expect(configUpsertMock).toHaveBeenCalledTimes(1);
    const upsertCall = configUpsertMock.mock.calls[0]?.[0] as {
      where: { key: string };
      create: { value: { skippedReason: string } };
    };
    expect(upsertCall?.where?.key).toBe("embeddings_last_run");
    expect(upsertCall?.create?.value?.skippedReason).toContain("OPENAI_EMBEDDINGS_ENABLED=false");
  });

  it("T2: aucun article sans embedding → log nothingToDo, aucun appel OpenAI", async () => {
    // $queryRawUnsafe retourne [] pour la requête articles
    queryRawUnsafeMock.mockResolvedValueOnce([]);

    const fn = capturedProcessor.fn!;
    await fn(MOCK_JOB);

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    expect(openaiEmbeddingsCreateMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();

    expect(configUpsertMock).toHaveBeenCalledTimes(1);
    const upsertCall = configUpsertMock.mock.calls[0]?.[0] as {
      create: { value: { nothingToDo: boolean } };
    };
    expect(upsertCall?.create?.value?.nothingToDo).toBe(true);
  });

  it("T3: run normal 3 articles → appelle OpenAI 1 fois (batch), écrit 3 embeddings en DB", async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([
      { id: "article-1", title: "Formation IA Paris", content: "Contenu article 1" },
      { id: "article-2", title: "Audit IA Lyon", content: "Contenu article 2" },
      { id: "article-3", title: "Implémentation IA Bordeaux", content: "Contenu article 3" },
    ]);

    openaiEmbeddingsCreateMock.mockResolvedValueOnce(makeEmbeddingResponse(3));

    const fn = capturedProcessor.fn!;
    await fn(MOCK_JOB);

    // 1 appel OpenAI pour le batch de 3
    expect(openaiEmbeddingsCreateMock).toHaveBeenCalledTimes(1);
    const openaiCall = openaiEmbeddingsCreateMock.mock.calls[0]?.[0] as {
      model: string;
      input: string[];
      dimensions: number;
    };
    expect(openaiCall?.model).toBe("text-embedding-3-large");
    expect(openaiCall?.dimensions).toBe(1536);
    expect(openaiCall?.input).toHaveLength(3);

    // 3 écritures DB executeRaw
    expect(executeRawMock).toHaveBeenCalledTimes(3);

    // 2 upserts ContentGenConfig (cost + last_run)
    expect(configUpsertMock).toHaveBeenCalledTimes(2);
    const keys = configUpsertMock.mock.calls.map(
      (c) => (c[0] as { where: { key: string } }).where.key,
    );
    expect(keys).toContain("embeddings_daily_cost_usd");
    expect(keys).toContain("embeddings_last_run");
  });

  it("T4: rate limit journalier dépassé → s'arrête proprement (aucun appel OpenAI)", async () => {
    // Cap à 0 tokens/day → doit stopper avant le premier batch
    process.env.OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY = "0";

    queryRawUnsafeMock.mockResolvedValueOnce([
      { id: "article-1", title: "Formation IA Paris", content: "Contenu article 1" },
      { id: "article-2", title: "Audit IA Lyon", content: "Contenu article 2" },
    ]);

    const fn = capturedProcessor.fn!;
    await fn(MOCK_JOB);

    // Aucun appel OpenAI car cap immédiatement dépassé
    expect(openaiEmbeddingsCreateMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();

    // Les upserts ContentGenConfig doivent quand même être appelés
    expect(configUpsertMock).toHaveBeenCalled();
  });

  it("T5: erreur OpenAI sur un batch → continue avec les batches suivants (partial success)", async () => {
    // 23 articles → 2 batches (20 + 3). Batch 1 → erreur, Batch 2 → succès
    const batch1 = Array.from({ length: 20 }, (_, i) => ({
      id: `article-${i + 1}`,
      title: `Article ${i + 1}`,
      content: `Contenu ${i + 1}`,
    }));
    const batch2 = Array.from({ length: 3 }, (_, i) => ({
      id: `article-${i + 21}`,
      title: `Article ${i + 21}`,
      content: `Contenu ${i + 21}`,
    }));

    queryRawUnsafeMock.mockResolvedValueOnce([...batch1, ...batch2]);

    // Batch 1 → erreur OpenAI
    openaiEmbeddingsCreateMock.mockRejectedValueOnce(
      new Error("OpenAI rate limit exceeded"),
    );
    // Batch 2 → succès
    openaiEmbeddingsCreateMock.mockResolvedValueOnce(makeEmbeddingResponse(3));

    const fn = capturedProcessor.fn!;
    // Ne doit PAS throw — partial success
    await expect(fn(MOCK_JOB)).resolves.not.toThrow();

    // OpenAI appelé 2 fois (1 erreur + 1 succès)
    expect(openaiEmbeddingsCreateMock).toHaveBeenCalledTimes(2);

    // Seulement les 3 articles du batch 2 ont été écrits
    expect(executeRawMock).toHaveBeenCalledTimes(3);

    // Le run s'est terminé avec des stats (processed=3, errors=20)
    const lastRunUpsert = configUpsertMock.mock.calls.find(
      (c) => (c[0] as { where: { key: string } }).where.key === "embeddings_last_run",
    );
    expect(lastRunUpsert).toBeDefined();
    const lastRunValue = (
      lastRunUpsert?.[0] as { create: { value: { processed: number; errors: number } } }
    )?.create?.value;
    expect(lastRunValue?.processed).toBe(3);
    expect(lastRunValue?.errors).toBe(20);
  });

  it("T6: nom de worker enregistré correctement via EMBEDDINGS_BACKFILL_QUEUE", () => {
    expect(capturedWorkerName).toBe(EMBEDDINGS_BACKFILL_QUEUE);
    expect(capturedWorkerName).toBe("embeddings-backfill");
  });
});
