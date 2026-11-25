/**
 * PR4 — rattrapage Voyage des articles (`articles.embedding_voyage`).
 * Éteint par défaut ; par lots ; plafonné ; jamais bloquant ; n'écrit que la colonne Voyage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const queryRawUnsafeMock = vi.fn();
const executeRawMock = vi.fn();
const configUpsertMock = vi.fn();
const readKillSwitchMock = vi.fn();
const embedBatchMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafeMock(...a),
    $executeRaw: (...a: unknown[]) => executeRawMock(...a),
    contentGenConfig: { upsert: (a: unknown) => configUpsertMock(a) },
  },
}));
vi.mock("openai", () => ({ default: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: (...a: unknown[]) => readKillSwitchMock(...a),
}));
vi.mock("@/lib/knowledge/embeddings", () => ({
  EMBEDDING_DIMENSION: 1024,
  EMBEDDING_MODEL_NAME: "voyage-3",
  buildEmbeddingInput: () => "",
  generateEmbedding: vi.fn(),
}));
vi.mock("@/server/content-gen/dedup/voyage-embedder", () => ({
  embedVoyageBatch: (...a: unknown[]) => embedBatchMock(...a),
}));
vi.mock("bullmq", () => ({ Worker: vi.fn() }));

import { rattraperEmbeddingsVoyage } from "../embeddings-backfill-worker";

const articles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, title: `Titre ${i}`, content: "corps" }));
const ok = (n: number) => ({
  ok: true as const,
  embeddings: Array.from({ length: n }, () => [0.1]),
  tokensUsed: 1,
  model: "voyage-3",
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VOYAGE_ARTICLES_BACKFILL_ENABLED = "true";
  process.env.VOYAGE_API_KEY = "pa-test";
  readKillSwitchMock.mockResolvedValue({ active: false });
  executeRawMock.mockResolvedValue(1);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.VOYAGE_ARTICLES_BACKFILL_ENABLED;
  delete process.env.VOYAGE_API_KEY;
  delete process.env.VOYAGE_BACKFILL_MAX_PER_RUN;
  vi.useRealTimers();
});

describe("rattrapage Voyage des articles", () => {
  it("éteint par défaut : aucune requête, aucun appel", async () => {
    delete process.env.VOYAGE_ARTICLES_BACKFILL_ENABLED;
    const r = await rattraperEmbeddingsVoyage();
    expect(r.skippedReason).toContain("VOYAGE_ARTICLES_BACKFILL_ENABLED");
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
    expect(embedBatchMock).not.toHaveBeenCalled();
  });

  it("clé absente ou kill switch : ne touche à rien", async () => {
    delete process.env.VOYAGE_API_KEY;
    expect((await rattraperEmbeddingsVoyage()).skippedReason).toBe("VOYAGE_API_KEY absente");
    process.env.VOYAGE_API_KEY = "pa-test";
    readKillSwitchMock.mockResolvedValue({ active: true });
    expect((await rattraperEmbeddingsVoyage()).skippedReason).toBe("kill switch actif");
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
  });

  it("cible les articles sans embedding_voyage, avec le plafond dans la requête", async () => {
    process.env.VOYAGE_BACKFILL_MAX_PER_RUN = "50";
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await rattraperEmbeddingsVoyage();
    const sql = String(queryRawUnsafeMock.mock.calls[0]?.[0]);
    expect(sql).toContain("a.embedding_voyage IS NULL");
    expect(sql).toContain("LIMIT 50");
    expect(sql).not.toMatch(/a\.embedding IS NULL/);
  });

  it("plafond dur à 2000 même si la variable demande plus", async () => {
    process.env.VOYAGE_BACKFILL_MAX_PER_RUN = "999999";
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await rattraperEmbeddingsVoyage();
    expect(String(queryRawUnsafeMock.mock.calls[0]?.[0])).toContain("LIMIT 2000");
  });

  it("par lots de 20 : 45 articles = 3 appels Voyage, 45 écritures sur embedding_voyage", async () => {
    vi.useFakeTimers();
    queryRawUnsafeMock.mockResolvedValueOnce(articles(45));
    embedBatchMock.mockImplementation(async (t: string[]) => ok(t.length));
    const p = rattraperEmbeddingsVoyage();
    await vi.runAllTimersAsync();
    const r = await p;
    expect(embedBatchMock).toHaveBeenCalledTimes(3);
    expect(embedBatchMock.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([20, 20, 5]);
    expect(r).toMatchObject({ processed: 45, errors: 0, candidates: 45 });
    const sql = (executeRawMock.mock.calls[0]?.[0] as TemplateStringsArray).join("?");
    expect(sql).toContain("embedding_voyage");
  });

  it("429 : s'arrête tout de suite, sans lever, rien d'écrit", async () => {
    queryRawUnsafeMock.mockResolvedValueOnce(articles(45));
    embedBatchMock.mockResolvedValue({ ok: false, reason: "rate_limited", status: 429 });
    const r = await rattraperEmbeddingsVoyage();
    expect(embedBatchMock).toHaveBeenCalledTimes(1);
    expect(r.stoppedReason).toBe("rate_limited");
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it("401 (clé refusée) : s'arrête tout de suite, sans réessai article par article", async () => {
    queryRawUnsafeMock.mockResolvedValueOnce(articles(45));
    embedBatchMock.mockResolvedValue({ ok: false, reason: "http_error", status: 401 });
    const r = await rattraperEmbeddingsVoyage();
    expect(embedBatchMock).toHaveBeenCalledTimes(1);
    expect(r.stoppedReason).toBe("auth");
  });

  it("coupure posée en cours de passage : arrêt avant le lot suivant", async () => {
    queryRawUnsafeMock.mockResolvedValueOnce(articles(45));
    readKillSwitchMock
      .mockResolvedValueOnce({ active: false })
      .mockResolvedValueOnce({ active: true });
    embedBatchMock.mockResolvedValue({
      ok: true,
      embeddings: Array.from({ length: 20 }, () => Array.from({ length: 1024 }, () => 0.1)),
    });
    const r = await rattraperEmbeddingsVoyage();
    expect(embedBatchMock).toHaveBeenCalledTimes(1);
    expect(r.stoppedReason).toBe("kill switch");
  });

  it("panne répétée : s'arrête après 3 lots consécutifs en échec", async () => {
    vi.useFakeTimers();
    queryRawUnsafeMock.mockResolvedValueOnce(articles(100));
    embedBatchMock.mockResolvedValue({ ok: false, reason: "timeout" });
    const p = rattraperEmbeddingsVoyage();
    await vi.runAllTimersAsync();
    const r = await p;
    expect(embedBatchMock).toHaveBeenCalledTimes(3);
    expect(r.errors).toBe(60);
    expect(r.stoppedReason).toContain("3 lots consécutifs");
  });
});

describe("lot refusé en 4xx : réessai article par article", () => {
  it("saute l'article fautif, écrit les autres, journalise son id, ne s'arrête pas", async () => {
    queryRawUnsafeMock.mockResolvedValue(articles(3));
    embedBatchMock
      .mockResolvedValueOnce({ ok: false, reason: "http_error", status: 400 })
      .mockResolvedValueOnce(ok(1))
      .mockResolvedValueOnce({ ok: false, reason: "http_error", status: 400 })
      .mockResolvedValueOnce(ok(1));
    const stats = await rattraperEmbeddingsVoyage();
    expect(embedBatchMock).toHaveBeenCalledTimes(4);
    expect(stats.processed).toBe(2);
    expect(stats.errors).toBe(1);
    expect(stats.stoppedReason).toBeUndefined();
    const journal = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => String(c[0]))
      .join("\n");
    expect(journal).toContain("id-1");
  });

  it("un 500 reste un échec de lot, sans réessai unitaire", async () => {
    queryRawUnsafeMock.mockResolvedValue(articles(3));
    embedBatchMock.mockResolvedValue({ ok: false, reason: "http_error", status: 500 });
    await rattraperEmbeddingsVoyage();
    expect(embedBatchMock).toHaveBeenCalledTimes(1);
  });
});
