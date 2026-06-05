import { describe, expect, it, vi, beforeEach } from "vitest";

const { listPublishedArticlesMock } = vi.hoisted(() => ({
  listPublishedArticlesMock: vi.fn(),
}));

vi.mock("@/lib/knowledge/readers", () => ({
  listPublishedArticles: listPublishedArticlesMock,
}));

// Pas d'articles FS pour isoler le comportement DB (le filtre FS marchait déjà).
vi.mock("@/content/transversal", () => ({ BLOG_POSTS: [] }));
vi.mock("@/content/blog", () => ({ resolveTier: () => "tier-2-noindex-follow" }));

import { findRelatedArticles } from "../related-articles";

function dbArticle(slug: string, tier: string) {
  return {
    id: slug,
    slug,
    title: slug,
    excerpt: "x",
    publishedAt: new Date("2026-05-01"),
    readingTime: 5,
    author: null,
    category: null,
    indexationTier: tier,
  };
}

describe("findRelatedArticles — filtre tier DB (VIS-10)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exclut les articles DB tier-2 noindex par défaut (tier1Only)", async () => {
    listPublishedArticlesMock.mockResolvedValue([
      dbArticle("indexable", "tier_1_indexable"),
      dbArticle("noindex-2", "tier_2_noindex_follow"),
      dbArticle("noindex-3", "tier_3_noindex_nofollow"),
    ]);
    const out = await findRelatedArticles({ currentSlug: "x", locale: "fr" });
    const slugs = out.map((a) => a.slug);
    expect(slugs).toContain("indexable");
    expect(slugs).not.toContain("noindex-2");
    expect(slugs).not.toContain("noindex-3");
  });

  it("inclut tous les tiers quand tier1Only=false", async () => {
    listPublishedArticlesMock.mockResolvedValue([
      dbArticle("indexable", "tier_1_indexable"),
      dbArticle("noindex-2", "tier_2_noindex_follow"),
    ]);
    const out = await findRelatedArticles({ currentSlug: "x", locale: "fr", tier1Only: false });
    expect(out.map((a) => a.slug)).toEqual(expect.arrayContaining(["indexable", "noindex-2"]));
  });
});
