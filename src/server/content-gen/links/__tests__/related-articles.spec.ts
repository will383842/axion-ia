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

  it("met en tête les articles qui partagent un mot de contenu avec le titre", () => {
    const out = sortByRelevance(catalogue, "Cas d'usage", "Chatbot et RGPD en PME");
    // « pme » est un mot de sujet : le premier article partage 3 mots avec le titre
    // (chatbot, rgpd, pme), le second 2. Le score l'emporte sur la date.
    expect(out.slice(0, 2).map((a) => a.title)).toEqual([
      "Chatbot RGPD : ce que doit savoir une PME",
      "Mettre en conformité son chatbot avec le RGPD",
    ]);
  });

  it("garde tous les articles, même sans aucun rapport de sujet", () => {
    const out = sortByRelevance(catalogue, "Cas d'usage", "Sujet sans aucun rapport");
    expect(out).toHaveLength(catalogue.length);
  });

  it("un mot vide comme « votre » ne suffit pas à rendre deux titres proches", () => {
    const items = [
      item("Optimisez votre trésorerie", "Gestion", "2026-01-01"),
      item("Chatbot RGPD", "Autre", "2026-09-01"),
    ];
    const out = sortByRelevance(items, "Autre", "Réussir votre recrutement");
    // Aucun mot de contenu commun : ordre historique (même catégorie d'abord, puis date).
    expect(out.map((a) => a.title)).toEqual(["Chatbot RGPD", "Optimisez votre trésorerie"]);
  });

  it("garde formation et pme comme mots de sujet", () => {
    const items = [
      item("Recruter un comptable", "Cas d'usage", "2026-10-01"),
      item("Formation des équipes", "Cas d'usage", "2026-01-01"),
    ];
    const out = sortByRelevance(items, "Cas d'usage", "Formation en PME");
    expect(out[0]?.title).toBe("Formation des équipes");
  });

  it("complète avec la même catégorie quand elle est spécifique", () => {
    const items = [
      item("Calendrier éditorial", "Marketing", "2026-10-01"),
      item("Facturation électronique", "Gestion", "2026-05-01"),
    ];
    const out = sortByRelevance(items, "Gestion", "Sujet sans aucun rapport");
    expect(out.map((a) => a.title)).toEqual(["Facturation électronique", "Calendrier éditorial"]);
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

  it("revient toujours pleine (4 éléments) quand le catalogue en contient au moins 4", () => {
    const out = sortByRelevance(catalogue, "Cas d'usage", "Chatbot et RGPD en PME");
    expect(out.slice(0, 4)).toHaveLength(4);
    expect(new Set(out).size).toBe(catalogue.length);
  });
});
