/**
 * Lot L6 (audit blog/RAG 2026-10-24) — embeddings-backfill-worker :
 *  - la requête des articles lit `body_text` (la colonne `content` n'existe pas) ;
 *  - les vecteurs périmés de la base de connaissances sont recalculés par UPDATE (jamais DELETE).
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";

const queryRawUnsafeMock = vi.fn();
const executeRawMock = vi.fn();
const executeRawUnsafeMock = vi.fn();
const configUpsertMock = vi.fn();
const openaiEmbeddingsCreateMock = vi.fn();
const generateEmbeddingMock = vi.fn();
const readKillSwitchMock = vi.fn();

const capturedProcessor: { fn: ((job: Job) => Promise<unknown>) | null } = { fn: null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => queryRawUnsafeMock(...args),
    $executeRaw: (...args: unknown[]) => executeRawMock(...args),
    $executeRawUnsafe: (...args: unknown[]) => executeRawUnsafeMock(...args),
    contentGenConfig: { upsert: (args: unknown) => configUpsertMock(args) },
  },
}));

vi.mock("openai", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: vi.fn().mockImplementation((_opts: any) => ({
    embeddings: { create: (...args: unknown[]) => openaiEmbeddingsCreateMock(...args) },
  })),
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: (...args: unknown[]) => readKillSwitchMock(...args),
}));

vi.mock("@/lib/knowledge/embeddings", () => ({
  EMBEDDING_DIMENSION: 1024,
  EMBEDDING_MODEL_NAME: "voyage-3",
  buildEmbeddingInput: (i: { title: string; excerpt?: string | null; bodyText?: string | null }) =>
    [i.title, i.excerpt, i.bodyText].filter(Boolean).join("\n\n"),
  generateEmbedding: (...args: unknown[]) => generateEmbeddingMock(...args),
}));

vi.mock("bullmq", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Worker: vi.fn().mockImplementation((_name: string, fn: any) => {
    capturedProcessor.fn = fn;
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

import {
  rafraichirVecteursKbPerimes,
  startEmbeddingsBackfillWorker,
} from "../embeddings-backfill-worker";

const MOCK_JOB = { id: "job-1", data: {} } as Job;
const savedVoyage = process.env.VOYAGE_API_KEY;

beforeAll(() => {
  process.env.REDIS_URL = "redis://test.invalid:6379";
  startEmbeddingsBackfillWorker();
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "sk-test-key";
  process.env.OPENAI_EMBEDDINGS_ENABLED = "true";
  delete process.env.VOYAGE_API_KEY;
  configUpsertMock.mockResolvedValue({});
  executeRawMock.mockResolvedValue(1);
  executeRawUnsafeMock.mockResolvedValue(1);
  readKillSwitchMock.mockResolvedValue({ active: false });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.OPENAI_EMBEDDINGS_ENABLED;
  if (savedVoyage === undefined) delete process.env.VOYAGE_API_KEY;
  else process.env.VOYAGE_API_KEY = savedVoyage;
});

describe("articles : requête SQL du worker", () => {
  it("lit body_text (pas la colonne inexistante content)", async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await capturedProcessor.fn!(MOCK_JOB);
    const sql = String(queryRawUnsafeMock.mock.calls[0]?.[0]);
    expect(sql).toContain("t.body_text");
    expect(sql).not.toContain("t.content");
    expect(sql).toContain("article_translations");
  });
});

describe("base de connaissances : vecteurs périmés", () => {
  const ligne = {
    translation_id: "11111111-1111-1111-1111-111111111111",
    title: "Fiche corrigée",
    excerpt: "Résumé",
    body_text: "Texte corrigé",
    body: "<p>Texte corrigé</p>",
  };

  it("sans clé Voyage : ne touche à rien", async () => {
    const r = await rafraichirVecteursKbPerimes();
    expect(r.skippedReason).toBe("VOYAGE_API_KEY absente");
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it("kill switch actif : ne touche à rien", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    readKillSwitchMock.mockResolvedValue({ active: true, reason: "test" });
    const r = await rafraichirVecteursKbPerimes();
    expect(r.skippedReason).toBe("kill switch actif");
    expect(generateEmbeddingMock).not.toHaveBeenCalled();
  });

  it("recalcule par UPDATE les fiches modifiées après leur vecteur, sans DELETE", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    queryRawUnsafeMock.mockResolvedValueOnce([ligne]);
    generateEmbeddingMock.mockResolvedValueOnce({
      embedding: [0.1, 0.2],
      modelVersion: "2026-06",
    });

    const r = await rafraichirVecteursKbPerimes();

    const select = String(queryRawUnsafeMock.mock.calls[0]?.[0]);
    expect(select).toContain("kt.updated_at > kemb.embedded_at");
    expect(select).toContain("ke.confidentiality = 'public'");
    expect(r).toMatchObject({ refreshed: 1, errors: 0, candidates: 1 });

    expect(executeRawUnsafeMock).toHaveBeenCalledTimes(1);
    const [sql, vecteur, , version, , id] = executeRawUnsafeMock.mock.calls[0] as unknown[];
    expect(String(sql)).toMatch(/^\s*UPDATE knowledge_embeddings/);
    expect(String(sql)).not.toMatch(/DELETE|INSERT/i);
    expect(vecteur).toBe("[0.1,0.2]");
    expect(version).toBe("2026-06");
    expect(id).toBe(ligne.translation_id);
  });

  it("vecteur stub : n'écrit rien", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    queryRawUnsafeMock.mockResolvedValueOnce([ligne]);
    generateEmbeddingMock.mockResolvedValueOnce({
      embedding: [0.1],
      modelVersion: "2026-06-stub",
    });
    const r = await rafraichirVecteursKbPerimes();
    expect(r.skippedReason).toBe("vecteur stub");
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it("une fiche en échec n'arrête pas les suivantes", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    queryRawUnsafeMock.mockResolvedValueOnce([
      ligne,
      { ...ligne, translation_id: "22222222-2222-2222-2222-222222222222" },
    ]);
    generateEmbeddingMock.mockRejectedValueOnce(new Error("Voyage 429"));
    generateEmbeddingMock.mockResolvedValueOnce({ embedding: [0.3], modelVersion: "2026-06" });
    const r = await rafraichirVecteursKbPerimes();
    expect(r).toMatchObject({ refreshed: 1, errors: 1, candidates: 2 });
  });

  it("le passage de nuit recalcule aussi la base, même sans articles à traiter", async () => {
    process.env.VOYAGE_API_KEY = "test-key";
    queryRawUnsafeMock.mockResolvedValueOnce([]); // articles
    queryRawUnsafeMock.mockResolvedValueOnce([ligne]); // fiches périmées
    generateEmbeddingMock.mockResolvedValueOnce({ embedding: [0.5], modelVersion: "2026-06" });
    await capturedProcessor.fn!(MOCK_JOB);
    expect(executeRawUnsafeMock).toHaveBeenCalledTimes(1);
    const cles = configUpsertMock.mock.calls.map(
      (c) => (c[0] as { where: { key: string } }).where.key,
    );
    expect(cles).toContain("embeddings_kb_last_run");
  });
});
