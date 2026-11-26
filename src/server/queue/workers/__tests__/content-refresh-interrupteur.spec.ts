import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { article: { findMany } } }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/site-url", () => ({ SITE_URL: "https://axion-ia.com" }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/content-gen/seo/gsc-client", () => ({
  gscInspectUrl: vi.fn(),
  gscPageMetricsForUrl: vi.fn(),
}));
vi.mock("@/server/content-gen/strategie/carte-requetes-source", () => ({
  chargerCarteRequetes: vi.fn(async () => ({ cannibalisations: [] })),
}));

describe("content-refresh : interrupteur éteint = comportement d'avant", () => {
  beforeEach(() => {
    vi.resetModules();
    findMany.mockReset().mockResolvedValue([]);
    process.env.CONTENT_REFRESH_ENABLED = "true";
    delete process.env.CONTENT_EQUIPE_EDITORIALE;
  });

  it("garde le filtre fixe de 14 jours et ignore `tache`", async () => {
    const { runContentRefreshJob } = await import("../content-refresh-worker");
    await runContentRefreshJob({
      data: { trigger: "manual", tache: "suivi-publication" },
    } as never);
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0]![0];
    expect(arg.where.updatedAt.lte).toBeInstanceOf(Date);
    expect(arg.orderBy).toEqual({ updatedAt: "asc" });
    expect(arg.take).toBe(10);
    const ecart = Date.now() - arg.where.updatedAt.lte.getTime();
    expect(Math.round(ecart / 86_400_000)).toBe(14);
  });

  it("allumé : plus de filtre fixe de 14 jours", async () => {
    process.env.CONTENT_EQUIPE_EDITORIALE = "true";
    const { runContentRefreshJob } = await import("../content-refresh-worker");
    await runContentRefreshJob({ data: { trigger: "manual" } } as never);
    expect(findMany.mock.calls[0]![0].where.updatedAt).toBeUndefined();
  });
});
