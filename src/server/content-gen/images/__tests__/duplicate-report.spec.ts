import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true, count: 1 }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const scan = vi.fn();
vi.mock("@/server/content-gen/images/duplicate-report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../duplicate-report")>()),
  scanDuplicateImages: () => scan(),
}));
const backfill = vi.fn();
vi.mock("@/server/content-gen/images/backfill-hero", () => ({
  backfillHeroImages: (o: unknown) => backfill(o),
  countHeroBackfillTargets: vi.fn(),
}));

import { computeDuplicates } from "../duplicate-report";
import {
  reportDuplicateImages,
  replaceDuplicateHero,
} from "@/server/actions/content-gen/hero-backfill";

describe("computeDuplicates", () => {
  it("repère une photo partagée (hero/corps) et une répétition dans un article", () => {
    const res = computeDuplicates([
      { articleId: "1", slug: "a", title: "A", heroKey: "photo-1-x", bodyKeys: [] },
      { articleId: "2", slug: "b", title: "B", heroKey: "photo-2-x", bodyKeys: ["photo-1-x"] },
      {
        articleId: "3",
        slug: "c",
        title: "C",
        heroKey: null,
        bodyKeys: ["photo-9-x", "photo-9-x"],
      },
      { articleId: "4", slug: "d", title: "D", heroKey: "photo-4-x", bodyKeys: [] },
    ]);
    expect(res.map((r) => r.slug).sort()).toEqual(["a", "b", "c"]);
    expect(res.find((r) => r.slug === "a")?.heroDuplicate).toBe(true);
    expect(res.find((r) => r.slug === "b")?.heroDuplicate).toBe(false);
    expect(res.find((r) => r.slug === "c")?.duplicates[0]?.repeatedInArticle).toBe(true);
  });
});

describe("backfill ciblé", () => {
  it("articleIds cible exactement ces articles publiés", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: { article: { findMany } } }));
    vi.doUnmock("@/server/content-gen/images/backfill-hero");
    const { backfillHeroImages } = await import("../backfill-hero");
    await backfillHeroImages({ articleIds: ["x"], limit: 1 });
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ status: "published", id: { in: ["x"] } });
  });
});

describe("actions du rapport : admin seulement", () => {
  beforeEach(() => {
    auth.mockReset();
    scan.mockReset();
    backfill.mockReset();
    process.env.UNSPLASH_ACCESS_KEY = "k";
  });
  it("sans session ou lecteur → refus, aucune lecture", async () => {
    auth.mockResolvedValue(null);
    expect(await reportDuplicateImages()).toEqual({ error: "unauthorized" });
    auth.mockResolvedValue({ user: { id: "u", email: "e@x.fr", role: "reader" } });
    expect(await reportDuplicateImages()).toEqual({ error: "forbidden" });
    expect(
      await replaceDuplicateHero({ articleId: "3f1c2a52-6a3e-4c55-9d52-2d6f1b9c1a11" }),
    ).toEqual({
      error: "forbidden",
    });
    expect(scan).not.toHaveBeenCalled();
    expect(backfill).not.toHaveBeenCalled();
  });
  it("admin → rapport ; remplacement UNITAIRE d'un seul article", async () => {
    auth.mockResolvedValue({ user: { id: "u", email: "e@x.fr", role: "admin" } });
    scan.mockResolvedValue([]);
    expect(await reportDuplicateImages()).toEqual({ duplicates: [] });
    backfill.mockResolvedValue({ updated: 1, items: [] });
    const id = "3f1c2a52-6a3e-4c55-9d52-2d6f1b9c1a11";
    expect(await replaceDuplicateHero({ articleId: id })).toEqual({ replaced: true });
    expect(backfill).toHaveBeenCalledWith({ articleIds: [id], limit: 1 });
  });
});
