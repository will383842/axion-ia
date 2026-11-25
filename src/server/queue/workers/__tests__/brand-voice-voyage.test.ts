/**
 * PR4 — voix de marque : le moniteur de dérive et le recalibrage lisent la colonne
 * ET la clé de référence du fournisseur actif ; les deux référentiels sont stockés séparément.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";

const configFindUniqueMock = vi.fn();
const configUpsertMock = vi.fn();
const queryRawUnsafeMock = vi.fn();
const auditLogCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenConfig: {
      findUnique: (a: unknown) => configFindUniqueMock(a),
      upsert: (a: unknown) => configUpsertMock(a),
    },
    contentGenAuditLog: { create: (a: unknown) => auditLogCreateMock(a), findMany: vi.fn() },
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafeMock(...a),
  },
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/actions/content-gen/_auth", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "u", email: "a@b.c" })),
  requireAdminWriteRateLimited: vi.fn(async () => ({ userId: "u", email: "a@b.c" })),
}));

const captured: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };
vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_n: string, fn: never) => {
    captured.fn = fn;
    return { on: vi.fn(), close: vi.fn() };
  }),
}));

import { startBrandVoiceDriftMonitorWorker } from "../brand-voice-drift-monitor";
import { recalibrateBrandVoice } from "@/server/actions/content-gen/brand-voice";

const JOB = { id: "j", data: { trigger: "t" } } as Job;
const ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://test.invalid:6379";
  configUpsertMock.mockResolvedValue({});
  auditLogCreateMock.mockResolvedValue({});
});
afterEach(() => {
  delete process.env.CONTENT_EMBEDDING_PROVIDER;
});

describe("moniteur de dérive", () => {
  it("openai (défaut) : colonne embedding + clé historique", async () => {
    configFindUniqueMock.mockResolvedValue(null);
    startBrandVoiceDriftMonitorWorker();
    await captured.fn!(JOB);
    expect(configFindUniqueMock).toHaveBeenCalledWith({
      where: { key: "brand_voice_reference_embedding" },
    });
  });

  it("voyage : clé de référence Voyage, colonne embedding_voyage, seuils Voyage", async () => {
    process.env.CONTENT_EMBEDDING_PROVIDER = "voyage";
    process.env.BRAND_VOICE_DRIFT_WARN_THRESHOLD_VOYAGE = "0.5";
    process.env.BRAND_VOICE_DRIFT_REVIEW_THRESHOLD_VOYAGE = "0.4";
    configFindUniqueMock.mockResolvedValue({ value: [1, 0] });
    // similarité 0.6 : au-dessus du warn Voyage (0.5) → aucune alerte (elle en aurait une à 0.7/0.8).
    queryRawUnsafeMock.mockResolvedValue([{ id: "a", embedding_arr: [0.6, 0.8] }]);
    startBrandVoiceDriftMonitorWorker();
    await captured.fn!(JOB);
    expect(configFindUniqueMock).toHaveBeenCalledWith({
      where: { key: "brand_voice_reference_embedding_voyage" },
    });
    const sql = String(queryRawUnsafeMock.mock.calls[0]?.[0]);
    expect(sql).toContain("a.embedding_voyage");
    expect(sql).not.toMatch(/a\.embedding[^_]/);
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    delete process.env.BRAND_VOICE_DRIFT_WARN_THRESHOLD_VOYAGE;
    delete process.env.BRAND_VOICE_DRIFT_REVIEW_THRESHOLD_VOYAGE;
  });
});

describe("recalibrage", () => {
  it("voyage : moyenne les vecteurs de embedding_voyage et stocke sous la clé Voyage", async () => {
    process.env.CONTENT_EMBEDDING_PROVIDER = "voyage";
    queryRawUnsafeMock.mockResolvedValue([{ id: ID, embedding_arr: [3, 4] }]);
    configFindUniqueMock.mockResolvedValue(null);
    const r = await recalibrateBrandVoice([ID]);
    expect(String(queryRawUnsafeMock.mock.calls[0]?.[0])).toContain("a.embedding_voyage");
    expect(r.embeddingDimension).toBe(2);
    const arg = configUpsertMock.mock.calls[0]?.[0] as { where: { key: string } };
    expect(arg.where.key).toBe("brand_voice_reference_embedding_voyage");
  });

  it("openai : clé historique inchangée, jamais la clé Voyage", async () => {
    queryRawUnsafeMock.mockResolvedValue([{ id: ID, embedding_arr: [3, 4] }]);
    configFindUniqueMock.mockResolvedValue(null);
    await recalibrateBrandVoice([ID]);
    const arg = configUpsertMock.mock.calls[0]?.[0] as { where: { key: string } };
    expect(arg.where.key).toBe("brand_voice_reference_embedding");
    expect(String(queryRawUnsafeMock.mock.calls[0]?.[0])).not.toContain("embedding_voyage");
  });
});
