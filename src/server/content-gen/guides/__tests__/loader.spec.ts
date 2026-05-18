import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock prisma BEFORE importing the loader. The loader does `import { prisma }`
// at module init, so we must hoist the mock.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findMany: vi.fn(),
    },
    articleTranslation: {
      findFirst: vi.fn(),
    },
  },
}));

import { loadGuidesIndexForView, loadGuideForView } from "../loader";
import { prisma } from "@/lib/prisma";

const mockArticleFindMany = vi.mocked(prisma.article.findMany);
const mockTranslationFindFirst = vi.mocked(prisma.articleTranslation.findFirst);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadGuidesIndexForView", () => {
  it("returns empty array for non-FR locale (doctrine v1.2 FR-only)", async () => {
    const result = await loadGuidesIndexForView("en");
    expect(result).toEqual([]);
    expect(mockArticleFindMany).not.toHaveBeenCalled();
  });

  it("maps DB rows to GuideSummaryView filtered by templateVariant guide-pilier", async () => {
    mockArticleFindMany.mockResolvedValue([
      {
        id: "a1",
        templateVariant: "guide-pilier",
        publishedAt: new Date("2026-05-10"),
        createdAt: new Date("2026-05-09"),
        updatedAt: new Date("2026-05-11"),
        translations: [
          {
            slug: "guide-rag-vs-finetuning",
            title: "RAG vs Fine-tuning : quel choix en 2026 ?",
            metaDescription: "Repères opérationnels RAG vs fine-tuning.",
            updatedAt: new Date("2026-05-11"),
            body: "Step 1: Cadrer. ".repeat(20),
            bodyText: null,
          },
        ],
      },
      // Row sans translation FR → exclus.
      {
        id: "a2",
        templateVariant: "guide-pilier",
        publishedAt: new Date("2026-05-08"),
        createdAt: new Date("2026-05-07"),
        updatedAt: new Date("2026-05-08"),
        translations: [],
      },
      // Row dont templateVariant n'est PAS guide ET slug ne commence pas par guide- → exclus.
      {
        id: "a3",
        templateVariant: "blog-article",
        publishedAt: new Date("2026-05-05"),
        createdAt: new Date("2026-05-04"),
        updatedAt: new Date("2026-05-05"),
        translations: [
          {
            slug: "article-classique",
            title: "Article classique",
            metaDescription: null,
            updatedAt: new Date("2026-05-05"),
            body: "Lorem ipsum",
            bodyText: null,
          },
        ],
      },
    ] as never);

    const result = await loadGuidesIndexForView("fr", { limit: 10 });

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("guide-rag-vs-finetuning");
    expect(result[0]?.title).toBe("RAG vs Fine-tuning : quel choix en 2026 ?");
    expect(result[0]?.excerpt).toBe("Repères opérationnels RAG vs fine-tuning.");
    expect(result[0]?.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it("includes rows whose slug starts with `guide-` even if templateVariant is null", async () => {
    mockArticleFindMany.mockResolvedValue([
      {
        id: "a1",
        templateVariant: null,
        publishedAt: new Date("2026-05-10"),
        createdAt: new Date("2026-05-09"),
        updatedAt: new Date("2026-05-11"),
        translations: [
          {
            slug: "guide-prompt-engineering-pme",
            title: "Guide prompt engineering PME",
            metaDescription: "Guide pratique.",
            updatedAt: new Date("2026-05-11"),
            body: "Contenu",
            bodyText: null,
          },
        ],
      },
    ] as never);

    const result = await loadGuidesIndexForView("fr");
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("guide-prompt-engineering-pme");
  });

  it("returns [] when Prisma throws (build SSG sans DB / stub.invalid)", async () => {
    mockArticleFindMany.mockRejectedValue(new Error("DB down / stub.invalid"));
    const result = await loadGuidesIndexForView("fr");
    expect(result).toEqual([]);
  });

  it("clamps the limit option to 200", async () => {
    mockArticleFindMany.mockResolvedValue([] as never);
    await loadGuidesIndexForView("fr", { limit: 9999 });
    const call = mockArticleFindMany.mock.calls[0]?.[0] as { take?: number } | undefined;
    expect(call?.take).toBe(200);
  });
});

describe("loadGuideForView", () => {
  it("returns null for non-FR locale (doctrine v1.2)", async () => {
    const result = await loadGuideForView("guide-x", "en");
    expect(result).toBeNull();
    expect(mockTranslationFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when translation not found", async () => {
    mockTranslationFindFirst.mockResolvedValue(null);
    const result = await loadGuideForView("guide-x", "fr");
    expect(result).toBeNull();
  });

  it("returns null when article is not a guide (templateVariant + slug mismatch)", async () => {
    mockTranslationFindFirst.mockResolvedValue({
      slug: "article-classique",
      title: "Article",
      metaDescription: null,
      body: "Body",
      bodyText: null,
      updatedAt: new Date("2026-05-10"),
      locale: "fr",
      article: {
        status: "published",
        templateVariant: "blog-article",
        publishedAt: new Date("2026-05-10"),
        createdAt: new Date("2026-05-09"),
        indexationTier: "tier_1_indexable",
      },
    } as never);

    const result = await loadGuideForView("article-classique", "fr");
    expect(result).toBeNull();
  });
});
