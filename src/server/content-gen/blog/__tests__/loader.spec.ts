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
      },
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list).toHaveLength(2);
    expect(list[0]?.source).toBe("db");
    expect(list[0]?.slug).toBe("db-only-post");
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
      },
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("db");
    expect(list[0]?.title).toBe("DB version");
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
      },
    ]);

    const list = await loadBlogIndexForView("fr");

    expect(list[0]?.slug).toBe("newer-db");
    expect(list[1]?.slug).toBe("fixture-fs-post");
    expect(list[2]?.slug).toBe("older-db");
  });
});
