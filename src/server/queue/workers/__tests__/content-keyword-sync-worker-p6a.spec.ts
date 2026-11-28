/** P6a — `content-keyword-sync` ne rappelle pas l'API quand le robot recalcule depuis l'historique. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { articleFindManyMock, gscMock, historiqueMock, proc } = vi.hoisted(() => ({
  articleFindManyMock: vi.fn().mockResolvedValue([]),
  gscMock: vi.fn(),
  historiqueMock: vi.fn(),
  proc: { current: null as null | ((job: unknown) => Promise<void>) },
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_n: string, p: (job: unknown) => Promise<void>) => {
    proc.current = p;
    return { on: vi.fn(), close: vi.fn() };
  }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { article: { findMany: articleFindManyMock } } }));
vi.mock("@/server/content-gen/indexing/url-builder", () => ({ buildArticleUrl: () => "u" }));
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn().mockResolvedValue({ active: false }),
}));
vi.mock("@/server/content-gen/seo/gsc-client", () => ({ gscTopKeywordsForUrl: gscMock }));
vi.mock("@/server/content-gen/strategie/carte-requetes-source", () => ({
  chargerCarteRequetes: vi.fn(),
  equipeEditorialeActive: () => false,
}));
vi.mock("@/server/seo-pilotage/recalcul", () => ({ historiqueDisponible: historiqueMock }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

const { startKeywordSyncWorker, stopKeywordSyncWorker } =
  await import("../content-keyword-sync-worker");

describe("content-keyword-sync-worker (P6a)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.REDIS_URL = "redis://localhost:6379";
    await stopKeywordSyncWorker();
    startKeywordSyncWorker();
  });

  it("historique suffisant : ni lecture d'articles ni appel Google", async () => {
    historiqueMock.mockResolvedValue(true);
    await proc.current!({ data: {} });
    expect(articleFindManyMock).not.toHaveBeenCalled();
    expect(gscMock).not.toHaveBeenCalled();
  });

  it("sinon : comportement d'avant (lecture des articles)", async () => {
    historiqueMock.mockResolvedValue(false);
    await proc.current!({ data: {} });
    expect(articleFindManyMock).toHaveBeenCalledTimes(1);
  });
});
