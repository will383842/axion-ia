import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/knowledge/readers", () => ({
  findArticleBySlug: vi.fn(),
  listPublishedArticles: vi.fn(),
}));

vi.mock("@/content/transversal", () => ({
  BLOG_POSTS: [
    {
      slug: "fixture-fs-post",
      publishedAt: "2026-04-01",
      updatedAt: "2026-04-02",
      readingTime: "5 min",
      author: "Will",
      category: "Cas d'usage",
      tags: ["fixture"],
      format: "article",
      qualityScore: 80,
      fr: {
        title: "Article FS de test",
        excerpt: "Excerpt FS",
        body: "Body FS.",
      },
      en: {
        title: "FS test article",
        excerpt: "FS excerpt",
        body: "FS body.",
      },
    },
  ],
  getBlogPost: vi.fn((slug: string) =>
    slug === "fixture-fs-post"
      ? {
          slug: "fixture-fs-post",
          publishedAt: "2026-04-01",
          updatedAt: "2026-04-02",
          readingTime: "5 min",
          author: "Will",
          category: "Cas d'usage",
          tags: ["fixture"],
          format: "article",
          qualityScore: 80,
          fr: { title: "Article FS de test", excerpt: "Excerpt FS", body: "Body FS." },
          en: { title: "FS test article", excerpt: "FS excerpt", body: "FS body." },
        }
      : null,
  ),
}));

vi.mock("@/content/blog", () => ({
  resolveTier: vi.fn(() => "tier-2-noindex-follow"),
}));

import { loadBlogArticleForView, loadBlogIndexForView } from "../loader";
import { findArticleBySlug, listPublishedArticles } from "@/lib/knowledge/readers";

const mockFindArticleBySlug = vi.mocked(findArticleBySlug);
const mockListPublishedArticles = vi.mocked(listPublishedArticles);

describe("loadBlogArticleForView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns DB article when present (DB-first)", async () => {
    mockFindArticleBySlug.mockResolvedValue({
      id: "article-uuid-1",
      type: "article",
      slug: "db-article",
      title: "DB Article",
      excerpt: "DB excerpt",
      body: "DB body content here.",
      bodyText: "DB body content here.",
      metaTitle: null,
      metaDescription: null,
      locale: "fr",
      publishedAt: new Date("2026-05-10"),
      updatedAt: new Date("2026-05-11"),
    });

    const view = await loadBlogArticleForView("db-article", "fr");

    expect(view).not.toBeNull();
    expect(view?.source).toBe("db");
    expect(view?.title).toBe("DB Article");
    expect(view?.body).toBe("DB body content here.");
    expect(view?.publishedAt).toBe("2026-05-10");
    expect(view?.updatedAt).toBe("2026-05-11");
    expect(view?.fsPost).toBeNull();
  });

  // VIS-02/03/08 (audit visibilité 2026-06-05) — le loader doit refléter le tier
  // RÉEL de l'Article (avant : hardcodé tier-2) + exposer directAnswer + alt hero.
  const dbBase = {
    id: "a1",
    type: "article" as const,
    slug: "vis-test",
    title: "VIS",
    excerpt: "ex",
    body: "<h2>Titre</h2><p>Corps.</p>",
    bodyText: "Titre Corps.",
    metaTitle: null,
    metaDescription: null,
    locale: "fr" as const,
    publishedAt: new Date("2026-05-10"),
    updatedAt: new Date("2026-05-10"),
  };

  it("VIS-02 maps tier_1_indexable → tier-1-indexable (article promu indexable)", async () => {
    mockFindArticleBySlug.mockResolvedValue({ ...dbBase, indexationTier: "tier_1_indexable" });
    const view = await loadBlogArticleForView("vis-test", "fr");
    expect(view?.tier).toBe("tier-1-indexable");
  });

  it("VIS-02 maps tier_3_noindex_nofollow → tier-3-noindex-nofollow", async () => {
    mockFindArticleBySlug.mockResolvedValue({
      ...dbBase,
      indexationTier: "tier_3_noindex_nofollow",
    });
    const view = await loadBlogArticleForView("vis-test", "fr");
    expect(view?.tier).toBe("tier-3-noindex-nofollow");
  });

  it("VIS-02 defaults to tier-2 when tier absent (KnowledgeEntry path)", async () => {
    mockFindArticleBySlug.mockResolvedValue({ ...dbBase });
    const view = await loadBlogArticleForView("vis-test", "fr");
    expect(view?.tier).toBe("tier-2-noindex-follow");
  });

  it("VIS-03/08 exposes directAnswer + featuredImageAlt from DB", async () => {
    mockFindArticleBySlug.mockResolvedValue({
      ...dbBase,
      indexationTier: "tier_1_indexable",
      directAnswer: "Réponse directe optimisée snippet 0.",
      featuredImageAlt: "Alt sémantique image-bank",
    });
    const view = await loadBlogArticleForView("vis-test", "fr");
    expect(view?.directAnswer).toBe("Réponse directe optimisée snippet 0.");
    expect(view?.featuredImageAlt).toBe("Alt sémantique image-bank");
  });

  it("VIS-03/08 directAnswer + featuredImageAlt are null for FS articles", async () => {
    mockFindArticleBySlug.mockResolvedValue(null);
    const view = await loadBlogArticleForView("fixture-fs-post", "fr");
    expect(view?.source).toBe("fs");
    expect(view?.directAnswer).toBeNull();
    expect(view?.featuredImageAlt).toBeNull();
  });

  it("falls back to FS when DB returns null", async () => {
    mockFindArticleBySlug.mockResolvedValue(null);

    const view = await loadBlogArticleForView("fixture-fs-post", "fr");

    expect(view).not.toBeNull();
    expect(view?.source).toBe("fs");
    expect(view?.title).toBe("Article FS de test");
    expect(view?.body).toBe("Body FS.");
    expect(view?.fsPost).not.toBeNull();
  });

  it("returns null when neither DB nor FS has the slug", async () => {
    mockFindArticleBySlug.mockResolvedValue(null);

    const view = await loadBlogArticleForView("non-existent-slug", "fr");

    expect(view).toBeNull();
  });

  it("falls back to FS when DB throws", async () => {
    mockFindArticleBySlug.mockRejectedValue(new Error("DB down"));

    const view = await loadBlogArticleForView("fixture-fs-post", "fr");

    expect(view?.source).toBe("fs");
    expect(view?.title).toBe("Article FS de test");
  });

  it("estimates reading time from body when DB has none", async () => {
    const body = "Word ".repeat(600).trim(); // 600 words → ~3 min
    mockFindArticleBySlug.mockResolvedValue({
      id: "1",
      type: "article",
      slug: "rt-test",
      title: "Reading time test",
      excerpt: null,
      body,
      bodyText: body,
      metaTitle: null,
      metaDescription: null,
      locale: "fr",
      publishedAt: new Date("2026-05-10"),
      updatedAt: new Date("2026-05-10"),
    });

    const view = await loadBlogArticleForView("rt-test", "fr");
    expect(view?.readingTime).toBe("3 min");
  });
});

describe("loadBlogIndexForView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges DB and FS articles, DB taking priority on slug conflict", async () => {
    mockListPublishedArticles.mockResolvedValue([
      {
        id: "uuid-1",
        slug: "db-only-post",
        title: "DB only",
        excerpt: "DB excerpt",
        publishedAt: new Date("2026-05-01"),
        readingTime: 8,
        author: { slug: "manon", name: "Manon" },
        category: null,
        indexationTier: "tier_1_indexable",
        featuredImage: "https://images.unsplash.com/photo-db-only",
        featuredImageAlt: "Illustration DB only",
      },
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list).toHaveLength(2);
    expect(list[0]?.source).toBe("db");
    expect(list[0]?.slug).toBe("db-only-post");
    // Miniatures (audit 2026-06-24) — la hero remonte jusqu'à la vue liste.
    expect(list[0]?.featuredImage).toBe("https://images.unsplash.com/photo-db-only");
    expect(list[0]?.featuredImageAlt).toBe("Illustration DB only");
    expect(list[1]?.source).toBe("fs");
    expect(list[1]?.slug).toBe("fixture-fs-post");
  });

  it("dedups when DB has same slug as FS (DB wins)", async () => {
    mockListPublishedArticles.mockResolvedValue([
      {
        id: "uuid-1",
        slug: "fixture-fs-post",
        title: "DB version",
        excerpt: "DB excerpt overriding FS",
        publishedAt: new Date("2026-05-10"),
        readingTime: 8,
        author: { slug: "manon", name: "Manon" },
        category: null,
        indexationTier: "tier_1_indexable",
        featuredImage: null,
        featuredImageAlt: null,
      },
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("db");
    expect(list[0]?.title).toBe("DB version");
  });

  it("orders same-day articles newest-first (fix 2026-07-17)", async () => {
    // Régression : `view.publishedAt` est tronqué au jour (isoDate) → les
    // articles d'un même jour étaient à égalité, et l'ancien comparateur
    // (jamais 0) laissait V8 INVERSER le groupe → le plus ancien du jour
    // s'affichait en tête du hub toute la journée (Trappes 08h01 devant
    // Neuilly-Plaisance 21h46 en prod). Le tri utilise désormais le
    // timestamp complet côté DB.
    const mkRow = (slug: string, iso: string) => ({
      id: `uuid-${slug}`,
      slug,
      title: slug,
      excerpt: "",
      publishedAt: new Date(iso),
      readingTime: 5,
      author: { slug: "manon", name: "Manon" },
      category: null,
      indexationTier: "tier_1_indexable" as const,
      featuredImage: null,
      featuredImageAlt: null,
    });
    // listPublishedArticles renvoie déjà DESC (Prisma orderBy publishedAt desc).
    mockListPublishedArticles.mockResolvedValue([
      mkRow("soir-21h46", "2026-07-17T19:46:33Z"),
      mkRow("midi-14h46", "2026-07-17T12:46:28Z"),
      mkRow("matin-08h01", "2026-07-17T06:01:30Z"),
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list.map((a) => a.slug)).toEqual([
      "soir-21h46",
      "midi-14h46",
      "matin-08h01",
      "fixture-fs-post", // FS plus ancien (2026-04-01) → dernier
    ]);
  });

  it("returns FS-only when DB is empty", async () => {
    mockListPublishedArticles.mockResolvedValue([]);

    const list = await loadBlogIndexForView("fr");

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("fs");
  });

  it("falls back to FS-only when DB throws", async () => {
    mockListPublishedArticles.mockRejectedValue(new Error("DB error"));

    const list = await loadBlogIndexForView("fr");

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("fs");
  });

  it("sorts results by publishedAt DESC", async () => {
    mockListPublishedArticles.mockResolvedValue([
      {
        id: "u1",
        slug: "older-db",
        title: "Older",
        excerpt: null,
        publishedAt: new Date("2026-03-01"),
        readingTime: null,
        author: null,
        category: null,
        indexationTier: "tier_1_indexable",
        featuredImage: null,
        featuredImageAlt: null,
      },
      {
        id: "u2",
        slug: "newer-db",
        title: "Newer",
        excerpt: null,
        publishedAt: new Date("2026-06-01"),
        readingTime: null,
        author: null,
        category: null,
        indexationTier: "tier_1_indexable",
        featuredImage: null,
        featuredImageAlt: null,
      },
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list[0]?.slug).toBe("newer-db");
    expect(list[1]?.slug).toBe("fixture-fs-post");
    expect(list[2]?.slug).toBe("older-db");
  });
});
