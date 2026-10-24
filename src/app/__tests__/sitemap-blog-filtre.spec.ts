/**
 * Tests du sitemap blog (`buildBlogSitemap`, atteint via `sitemap({ id: "blog" })`).
 *
 * Lot 9 de l'audit blog du 24/10/2026. Verrouille :
 *   1. Le filtre RÉEL de qualité : la requête demande `qualityScore >= 70` en plus
 *      de `tier_1_indexable`, `published` et `isNews: false`. (Avant : le commentaire
 *      promettait le score, mais seul le palier tier-1 était testé.)
 *   2. Mode strict : base injoignable → `SitemapDbIndisponibleError` (la route
 *      répond alors 503), et non un plan sans articles servi en 200.
 *   3. Mode tolérant (défaut, build SSG stub.invalid) : pas d'exception.
 *
 * Seul Prisma est mocké ; le reste du graphe de `app/sitemap.ts` est réel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { articleFindMany, categoryFindMany } = vi.hoisted(() => ({
  articleFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findMany: articleFindMany, findFirst: vi.fn(async () => null) },
    category: { findMany: categoryFindMany },
    knowledgeEntry: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

import sitemap, { BLOG_SITEMAP_MIN_QUALITY_SCORE } from "../sitemap";
import { SitemapDbIndisponibleError } from "@/lib/seo/sitemap-erreur";

beforeEach(() => {
  articleFindMany.mockReset();
  categoryFindMany.mockReset();
  articleFindMany.mockResolvedValue([]);
  categoryFindMany.mockResolvedValue([]);
});

describe("sitemap blog · filtre de qualité réel", () => {
  it("le plancher vaut 70", () => {
    expect(BLOG_SITEMAP_MIN_QUALITY_SCORE).toBe(70);
  });

  it("demande tier-1 + publié + hors actualités + qualityScore >= 70", async () => {
    await sitemap({ id: Promise.resolve("blog") });
    const where = articleFindMany.mock.calls[0]?.[0]?.where;
    expect(where.status).toBe("published");
    expect(where.indexationTier).toBe("tier_1_indexable");
    expect(where.isNews).toBe(false);
    expect(where.qualityScore).toEqual({ gte: 70 });
  });

  it("émet l'article renvoyé par la base sous /blog/<slug>", async () => {
    articleFindMany.mockResolvedValue([
      {
        publishedAt: new Date("2026-10-01T00:00:00Z"),
        updatedAt: new Date("2026-10-02T00:00:00Z"),
        templateVariant: null,
        translations: [{ slug: "article-test-lot-9" }],
      },
    ]);
    const urls = (await sitemap({ id: Promise.resolve("blog") })).map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/blog/article-test-lot-9"))).toBe(true);
  });
});

describe("sitemap blog · base injoignable", () => {
  it("mode strict : lève SitemapDbIndisponibleError", async () => {
    articleFindMany.mockRejectedValue(new Error("connexion refusée"));
    await expect(sitemap({ id: Promise.resolve("blog"), strict: true })).rejects.toBeInstanceOf(
      SitemapDbIndisponibleError,
    );
  });

  it("mode tolérant (défaut) : ne lève pas, sert le reste du plan", async () => {
    articleFindMany.mockRejectedValue(new Error("connexion refusée"));
    await expect(sitemap({ id: Promise.resolve("blog") })).resolves.toBeInstanceOf(Array);
  });
});
