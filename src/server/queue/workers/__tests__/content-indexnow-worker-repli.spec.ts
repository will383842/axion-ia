// @vitest-environment node
/**
 * GEO V1-07 (relecture point 2) — le worker `content-indexnow` appelle
 * `signalerAuxMoteurs` en mode `repli` : l'API Bing n'est sollicitée que si
 * IndexNow échoue partout (le quota Bing est partagé avec les publications
 * manuelles). Passer en `toujours` ferait partir chaque publication tier-1
 * vers Bing aussi.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  processeur: null as null | ((job: { data: unknown }) => Promise<void>),
  signaler: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_q: string, p: (job: { data: unknown }) => Promise<void>) {
      hoisted.processeur = p;
    }
    on() {
      return this;
    }
  },
}));
vi.mock("@/lib/indexnow", () => ({ signalerAuxMoteurs: hoisted.signaler }));
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn(async () => ({ active: false })),
}));
vi.mock("@/lib/redis", () => ({
  redis: { incr: vi.fn(async () => 1), expire: vi.fn(), del: vi.fn() },
}));
vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertIndexNowFailStreak: vi.fn(),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

describe("content-indexnow-worker : mode repli", () => {
  beforeEach(() => {
    hoisted.signaler.mockReset();
    hoisted.signaler.mockResolvedValue({
      indexnow: { accepted: "https://yandex.com/indexnow", attempts: [] },
      bing: null,
    });
    process.env["REDIS_URL"] = "redis://localhost:6379";
    process.env["INDEXNOW_KEY"] = "k".repeat(32);
    process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("appelle signalerAuxMoteurs avec bing: « repli »", async () => {
    const { startIndexNowWorker } = await import("../content-indexnow-worker");
    startIndexNowWorker();
    expect(hoisted.processeur).toBeTypeOf("function");
    await hoisted.processeur!({
      data: { urls: ["https://axion-ia.com/fr/blog/x"], origin: "content-gen" },
    });
    expect(hoisted.signaler).toHaveBeenCalledTimes(1);
    expect(hoisted.signaler.mock.calls[0]![4]).toMatchObject({ bing: "repli" });
  });
});
