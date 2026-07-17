/**
 * Sprint S+5 P2-10 sub-agent C — Tests Vitest worker Similarity monitor.
 *
 * Stratégie : mock BullMQ `Worker` ctor pour capter le processor au moment de
 * `startSimilarityMonitorWorker()`, puis l'invoquer directement.
 *
 * Couvre :
 *  1. Happy path : 2 docs très similaires (Jaccard >= 0.5) → 1 paire détectée
 *     écrite dans similarity_pairs.
 *  2. Failure path : Prisma findMany throw → propage l'erreur (BullMQ retry).
 *  3. Edge case low similarity : 2 docs Jaccard < 0.5 → 0 paire écrite (write
 *     quand même appelé avec liste vide top-100 = []).
 *  4. Kill switch actif → early-return, 0 Prisma read, 0 write config.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

const { findManyMock, readConfigMock, writeConfigMock, workerCtorMock, capturedProcessor } =
  vi.hoisted(() => {
    const captured: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };
    return {
      findManyMock: vi.fn(),
      readConfigMock: vi.fn(),
      writeConfigMock: vi.fn().mockResolvedValue(undefined),
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
    contentGenJob: { findMany: findManyMock },
  },
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
}));

// L'écriture passe par `config-store` (module nu) et non par la Server Action
// `_settings`, dont le guard admin throw hors requête HTTP (bug `headers` 2026-07-16).
vi.mock("@/server/content-gen/config-store", () => ({
  persistContentGenConfig: writeConfigMock,
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: vi.fn(),
}));

async function getProcessor(): Promise<(job: Job) => Promise<void>> {
  vi.resetModules();
  capturedProcessor.fn = null;
  process.env.REDIS_URL = "redis://test:6379";
  const mod = await import("../content-similarity-monitor-worker");
  mod.startSimilarityMonitorWorker();
  if (!capturedProcessor.fn) throw new Error("processor not captured");
  return capturedProcessor.fn;
}

function fakeJob(): Job<{ readonly trigger: string }> {
  return { data: { trigger: "cron" }, id: "sim-1" } as unknown as Job<{ readonly trigger: string }>;
}

describe("content-similarity-monitor-worker — Sprint S+5 P2-10 sub-agent C", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    readConfigMock.mockReset();
    readConfigMock.mockResolvedValue({ active: false });
    writeConfigMock.mockClear();
    workerCtorMock.mockClear();
  });

  it("happy path — 2 docs très similaires (Jaccard >= 0.5) → 1 paire détectée", async () => {
    // 2 titres avec énormément de tokens en commun → Jaccard high
    findManyMock.mockResolvedValue([
      {
        id: "job-A",
        contentType: "blog_from_rss",
        anchorVilleSlug: null,
        outputJsonRaw: { title: "Audit IA pour cabinet B2B premium 2026" },
      },
      {
        id: "job-B",
        contentType: "blog_from_rss",
        anchorVilleSlug: null,
        outputJsonRaw: { title: "Audit IA pour cabinet B2B premium 2026 édition" },
      },
    ]);

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const args = writeConfigMock.mock.calls[0];
    expect(args?.[0]).toBe("similarity_pairs");
    const pairs = args?.[1] as ReadonlyArray<{ jobIdA: string; jobIdB: string; jaccard: number }>;
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.jobIdA).toBe("job-A");
    expect(pairs[0]?.jobIdB).toBe("job-B");
    expect(pairs[0]?.jaccard).toBeGreaterThanOrEqual(0.5);
  });

  it("failure path — Prisma findMany throw → propage erreur (retry BullMQ)", async () => {
    findManyMock.mockRejectedValue(new Error("DB connection refused"));

    const processor = await getProcessor();
    await expect(processor(fakeJob())).rejects.toThrow("DB connection refused");

    expect(writeConfigMock).not.toHaveBeenCalled();
  });

  it("edge case low similarity — 2 docs Jaccard < 0.5 → 0 paire (liste vide écrite)", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "job-X",
        contentType: "interventions_formations",
        anchorVilleSlug: "paris",
        outputJsonRaw: { title: "Formation IA générative pour avocats fiscalistes" },
      },
      {
        id: "job-Y",
        contentType: "implementations",
        anchorVilleSlug: "lyon",
        outputJsonRaw: { title: "Déploiement RAG documentaire entrepôt logistique" },
      },
    ]);

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const pairs = writeConfigMock.mock.calls[0]?.[1] as ReadonlyArray<unknown>;
    expect(pairs.length).toBe(0);
  });

  it("kill switch actif → early-return, 0 Prisma read, 0 write config", async () => {
    readConfigMock.mockResolvedValue({ active: true });

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(findManyMock).not.toHaveBeenCalled();
    expect(writeConfigMock).not.toHaveBeenCalled();
  });
});
