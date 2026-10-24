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

import { findRelatedArticles, sortByRelevance } from "../related-articles";

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

function item(title: string, category: string | null, publishedAt: string, excerpt = "") {
  return { title, category, publishedAt, excerpt };
}

describe("sortByRelevance — proximité de sujet (audit blog 24/10/2026)", () => {
  const catalogue = [
    item("Calendrier éditorial des réseaux sociaux", "Cas d'usage", "2026-10-01"),
    item("Chatbot RGPD : ce que doit savoir une PME", "Cas d'usage", "2026-05-01"),
    item("Mettre en conformité son chatbot avec le RGPD", "Cas d'usage", "2026-06-01"),
    item("Recruter un comptable", "Cas d'usage", "2026-09-01"),
  ];

  it("ne garde que les articles qui partagent un mot de contenu avec le titre", () => {
    const out = sortByRelevance(catalogue, "Cas d'usage", "Chatbot et RGPD en PME");
    expect(out.map((a) => a.title)).toEqual([
      "Mettre en conformité son chatbot avec le RGPD",
      "Chatbot RGPD : ce que doit savoir une PME",
    ]);
  });

  it("ne complète pas avec une catégorie fourre-tout", () => {
    const out = sortByRelevance(catalogue, "Cas d'usage", "Sujet sans aucun rapport");
    expect(out).toEqual([]);
  });

  it("complète avec la même catégorie quand elle est spécifique", () => {
    const items = [
      item("Facturation électronique", "Gestion", "2026-05-01"),
      item("Calendrier éditorial", "Marketing", "2026-06-01"),
    ];
    const out = sortByRelevance(items, "Gestion", "Sujet sans aucun rapport");
    expect(out.map((a) => a.title)).toEqual(["Facturation électronique"]);
  });

  it("garde le comportement historique (catégorie puis date) sans titre courant", () => {
    const items = [
      item("A", "Autre", "2026-10-01"),
      item("B", "Gestion", "2026-05-01"),
      item("C", "Gestion", "2026-06-01"),
    ];
    const out = sortByRelevance(items, "Gestion", undefined);
    expect(out.map((a) => a.title)).toEqual(["C", "B", "A"]);
  });
});
