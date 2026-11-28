/** P6a — le worker `site-route-gsc` s'efface devant le recalcul du robot, sinon rien ne change. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, topKeywordsMock, historiqueMock, proc } = vi.hoisted(() => ({
  findManyMock: vi.fn().mockResolvedValue([]),
  topKeywordsMock: vi.fn(),
  historiqueMock: vi.fn(),
  proc: { current: null as null | ((job: unknown) => Promise<void>) },
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_n: string, p: (job: unknown) => Promise<void>) => {
    proc.current = p;
    return { on: vi.fn(), close: vi.fn() };
  }),
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { siteRoute: { findMany: findManyMock, update: vi.fn().mockResolvedValue({}) } },
}));
vi.mock("@/server/content-gen/seo/gsc-client", () => ({ gscTopKeywordsForUrl: topKeywordsMock }));
vi.mock("@/server/seo-pilotage/recalcul", () => ({ historiqueDisponible: historiqueMock }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

const { startSiteRouteGscWorker } = await import("../site-route-gsc-worker");

describe("site-route-gsc-worker (P6a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://u:p@db:5432/x";
    process.env.GSC_PROPERTY_URL = "sc-domain:axion-ia.com";
    process.env.GSC_OAUTH_CLIENT_ID = "a";
    process.env.GSC_OAUTH_CLIENT_SECRET = "b";
    process.env.GSC_OAUTH_REFRESH_TOKEN = "c";
    findManyMock.mockResolvedValue([]);
    startSiteRouteGscWorker();
  });

  it("historique suffisant : aucun appel Google, aucune lecture de route", async () => {
    historiqueMock.mockResolvedValue(true);
    await proc.current!({});
    expect(findManyMock).not.toHaveBeenCalled();
    expect(topKeywordsMock).not.toHaveBeenCalled();
  });

  it("historique insuffisant ou robot éteint : comportement d'avant (lecture des routes)", async () => {
    historiqueMock.mockResolvedValue(false);
    await proc.current!({});
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});
