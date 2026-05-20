/**
 * Sprint S+5 P2-10 sub-agent C — Tests Vitest worker RSS fetch.
 *
 * Stratégie : mock BullMQ `Worker` constructor pour capter le callback
 * `processJob` au moment de `startRssFetchWorker()`, puis l'invoquer
 * directement avec un job factice. Toutes les deps externes (Prisma,
 * ssrfSafeFetch, ContentGenConfig, feed-parser, BullMQ Queue) sont mockées.
 *
 * Couvre :
 *  1. Happy path : 1 source RSS + 1 item nouveau → 1 ContentGenJob créé +
 *     1 enqueue content-gen + write seen hashes.
 *  2. Failure path : provider DB échoue à la création ContentGenJob →
 *     warn + skip item, pas d'enqueue.
 *  3. Edge case : flux RSS vide → 0 enqueue, écrit le snapshot seen vide.
 *  4. Kill switch actif → early-return, aucun fetch, aucune mutation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const {
  contentGenJobCreateMock,
  ssrfFetchMock,
  parseFeedMock,
  readConfigMock,
  writeConfigMock,
  queueAddMock,
  workerCtorMock,
  capturedProcessor,
} = vi.hoisted(() => {
  const captured: { fn: ((job: Job) => Promise<void>) | null } = { fn: null };
  return {
    contentGenJobCreateMock: vi.fn(),
    ssrfFetchMock: vi.fn(),
    parseFeedMock: vi.fn(),
    readConfigMock: vi.fn(),
    writeConfigMock: vi.fn().mockResolvedValue(undefined),
    queueAddMock: vi.fn().mockResolvedValue({ id: "queued-job" }),
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
  Queue: vi.fn(() => ({ add: queueAddMock, close: vi.fn().mockResolvedValue(undefined) })),
  Worker: workerCtorMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: { create: contentGenJobCreateMock },
    // S+5 P2-3 — primary source DB-backed (RssSource table) avec fallback
    // ContentGenConfig.rss_sources. On retourne [] ici pour forcer le fallback
    // legacy testé par les fixtures readConfigMock ci-dessous.
    rssSource: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/ssrf-safe-fetch", () => ({
  ssrfSafeFetch: ssrfFetchMock,
}));

vi.mock("@/server/queue/lib/feed-parser", () => ({
  parseFeed: parseFeedMock,
}));

vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: readConfigMock,
  writeContentGenConfig: writeConfigMock,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getProcessor(): Promise<(job: Job) => Promise<void>> {
  // Reset module cache to force re-init of the singleton worker.
  vi.resetModules();
  capturedProcessor.fn = null;
  process.env.REDIS_URL = "redis://test:6379";
  const mod = await import("../content-rss-fetch-worker");
  mod.startRssFetchWorker();
  if (!capturedProcessor.fn) throw new Error("processor not captured");
  return capturedProcessor.fn;
}

function fakeJob(): Job<{ readonly trigger: string }> {
  return { data: { trigger: "cron" }, id: "job-1" } as unknown as Job<{ readonly trigger: string }>;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("content-rss-fetch-worker — Sprint S+5 P2-10 sub-agent C", () => {
  beforeEach(() => {
    contentGenJobCreateMock.mockReset();
    ssrfFetchMock.mockReset();
    parseFeedMock.mockReset();
    readConfigMock.mockReset();
    writeConfigMock.mockClear();
    queueAddMock.mockClear();
    workerCtorMock.mockClear();
  });

  it("happy path — 1 source + 1 item nouveau → 1 ContentGenJob + 1 enqueue content-gen", async () => {
    readConfigMock.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "kill_switch") return { active: false };
      if (key === "rss_sources") {
        return [
          {
            url: "https://blog.example.com/rss",
            name: "Example Blog",
            tags: ["audit", "ia"],
            pollIntervalMin: 60,
            autoPublish: false,
            enabled: true,
          },
        ];
      }
      if (key === "rss_items_seen") return [];
      return defaultValue;
    });
    ssrfFetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "<rss>...</rss>" });
    parseFeedMock.mockReturnValue([
      {
        id: "guid-001",
        title: "Audit IA en cabinet — best practices",
        link: "https://blog.example.com/audit-ia",
        summary: "Comment auditer une intégration IA en cabinet B2B",
        published: new Date("2026-05-19T10:00:00Z"),
      },
    ]);
    contentGenJobCreateMock.mockResolvedValue({ id: "cg-job-42" });

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(contentGenJobCreateMock).toHaveBeenCalledTimes(1);
    const createArg = contentGenJobCreateMock.mock.calls[0]?.[0] as {
      data: { idempotencyKey: string; contentType: string; inputPayload: { rssTitle: string } };
    };
    expect(createArg.data.contentType).toBe("blog_from_rss");
    expect(createArg.data.idempotencyKey).toMatch(/^rss-[a-f0-9]{16}$/);
    expect(createArg.data.inputPayload.rssTitle).toBe("Audit IA en cabinet — best practices");

    expect(queueAddMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock.mock.calls[0]?.[0]).toBe("blog_from_rss");

    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    const seenWrite = writeConfigMock.mock.calls[0];
    expect(seenWrite?.[0]).toBe("rss_items_seen");
    expect((seenWrite?.[1] as readonly string[]).length).toBe(1);
  });

  it("failure path — DB insert ContentGenJob échoue → warn + skip, pas d'enqueue", async () => {
    readConfigMock.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "kill_switch") return { active: false };
      if (key === "rss_sources") {
        return [
          {
            url: "https://blog.example.com/rss",
            name: "Example Blog",
            tags: ["formation"],
            pollIntervalMin: 60,
            autoPublish: false,
            enabled: true,
          },
        ];
      }
      if (key === "rss_items_seen") return [];
      return defaultValue;
    });
    ssrfFetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "<rss/>" });
    parseFeedMock.mockReturnValue([
      {
        id: "guid-002",
        title: "Formation IA pour avocats",
        link: "https://blog.example.com/formation",
        summary: "Programme formation 2 jours",
      },
    ]);
    contentGenJobCreateMock.mockRejectedValue(new Error("DB connection lost"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(contentGenJobCreateMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("edge case — flux RSS vide → 0 enqueue, snapshot seen écrit (vide)", async () => {
    readConfigMock.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "kill_switch") return { active: false };
      if (key === "rss_sources") {
        return [
          {
            url: "https://empty.example.com/rss",
            name: "Empty Source",
            tags: ["implementations"],
            pollIntervalMin: 60,
            autoPublish: false,
            enabled: true,
          },
        ];
      }
      if (key === "rss_items_seen") return [];
      return defaultValue;
    });
    ssrfFetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "<rss/>" });
    parseFeedMock.mockReturnValue([]);

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(contentGenJobCreateMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    expect((writeConfigMock.mock.calls[0]?.[1] as readonly string[]).length).toBe(0);
  });

  it("kill switch actif → early-return, 0 fetch, 0 mutation", async () => {
    readConfigMock.mockImplementation(async (key: string) => {
      if (key === "kill_switch") return { active: true };
      return [];
    });

    const processor = await getProcessor();
    await processor(fakeJob());

    expect(ssrfFetchMock).not.toHaveBeenCalled();
    expect(contentGenJobCreateMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
    expect(writeConfigMock).not.toHaveBeenCalled();
  });
});
