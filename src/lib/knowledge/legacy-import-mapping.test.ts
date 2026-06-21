/**
 * Tests unitaires KB-2 — mapping Article → KnowledgeEntry.
 * AUCUNE I/O DB.
 */

import { describe, expect, it } from "vitest";
import type { Article, ArticleTranslation } from "../../../prisma/generated/client";
import {
  mapLegacyStatusToKb,
  mapArticleToEntryInput,
  mapTranslationToKnowledgeTranslationInput,
} from "./legacy-import-mapping";

// ============================================================
// Fixtures
// ============================================================

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "01234567-89ab-cdef-0123-456789abcdef",
    authorId: "author-uuid-1",
    categoryId: null,
    featuredImage: null,
    featuredImageAltFr: null,
    featuredImageAltEn: null,
    featuredImagePhotographerName: null,
    featuredImagePhotographerUrl: null,
    status: "draft",
    publishedAt: null,
    readingTime: null,
    viewsCount: 0,
    commentsEnabled: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    // Content generator extensions (Sprint 1 AGT-A 2/N — § 5.1 + § 28 v1.7)
    indexationTier: "tier_2_noindex_follow",
    qualityScore: null,
    seoScore: null,
    readabilityScore: null,
    factCheckScore: null,
    editorialScore: null,
    plagiarismScore: null,
    promotedAt: null,
    generatedByJobId: null,
    campaignId: null,
    directAnswer: null,
    faqJson: null,
    // Chantier templates 2026-06-21 — point clé + citation expert (nullable).
    keyTakeaway: null,
    expertQuoteName: null,
    expertQuoteTitle: null,
    expertQuoteText: null,
    kbChunkIds: [],
    templateVariant: null,
    searchIntent: null,
    isNews: false,
    newsSourceUrl: null,
    newsSourceName: null,
    newsCategory: null,
    publishedAtDateline: null,
    // City Domination 2026-05-18 P1-6 — topic fingerprint SimHash (nullable
    // legacy, calculé progressivement par computeTopicFingerprint).
    topicFingerprint: null,
    // Sprint S+2 Phase C — mentionedCities auto-tag villes ([] par défaut
    // pour les fixtures legacy ; les nouveaux articles peuplent via le
    // helper extractMentionedCitiesFromText au publish).
    mentionedCities: [] as string[],
    // B.7 P1.5 P0-6 — Outline SimHash (nullable legacy). `embedding` est
    // Unsupported('vector(3072)') donc absent du type Prisma genere.
    outlineSimhash: null,
    ...overrides,
  };
}

function makeTranslation(overrides: Partial<ArticleTranslation> = {}): ArticleTranslation {
  return {
    id: "trans-uuid-fr",
    articleId: "01234567-89ab-cdef-0123-456789abcdef",
    locale: "fr",
    title: "Titre exemple",
    slug: "mon-article",
    excerpt: "extrait court",
    body: "<p>contenu HTML</p>",
    bodyJson: null,
    bodyText: "contenu texte",
    metaTitle: null,
    metaDescription: null,
    ogImage: null,
    ogImageAlt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("mapLegacyStatusToKb — PublishStatus → KbStatus", () => {
  it("draft → draft", () => {
    expect(mapLegacyStatusToKb("draft")).toBe("draft");
  });

  it("published → published", () => {
    expect(mapLegacyStatusToKb("published")).toBe("published");
  });

  it("archived → archived", () => {
    expect(mapLegacyStatusToKb("archived")).toBe("archived");
  });
});

describe("mapArticleToEntryInput — Article → KnowledgeEntry shape", () => {
  it("fixe type='article' + domain='editorial' + audience='public'", () => {
    const article = makeArticle();
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation()],
      tags: [],
    });
    expect(input.type).toBe("article");
    expect(input.domain).toBe("editorial");
    expect(input.audience).toBe("public");
    expect(input.confidentiality).toBe("public");
  });

  it("préserve le slug FR comme slug racine", () => {
    const article = makeArticle();
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation({ locale: "fr", slug: "slug-fr" })],
      tags: [],
    });
    expect(input.slug).toBe("slug-fr");
  });

  it("fallback sur slug EN si FR absent", () => {
    const article = makeArticle();
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation({ locale: "en", slug: "my-article-en" })],
      tags: [],
    });
    expect(input.slug).toBe("my-article-en");
  });

  it("fallback sur 'legacy-article-<id>' si aucune translation", () => {
    const article = makeArticle({ id: "abcdef12-3456-7890-abcd-ef1234567890" });
    const input = mapArticleToEntryInput({ ...article, translations: [], tags: [] });
    expect(input.slug).toBe("legacy-article-abcdef12");
  });

  it("publishedAt préservé + status=published + pipelineStage=published", () => {
    const date = new Date("2026-03-15T10:00:00Z");
    const article = makeArticle({ status: "published", publishedAt: date });
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation()],
      tags: [],
    });
    expect(input.publishedAt).toBe(date);
    expect(input.status).toBe("published");
    expect(input.pipelineStage).toBe("published");
  });

  it("pipelineStage='archived' quand status legacy='archived'", () => {
    const article = makeArticle({ status: "archived" });
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation()],
      tags: [],
    });
    expect(input.status).toBe("archived");
    expect(input.pipelineStage).toBe("archived");
  });

  it("assignedAuthorId préservé depuis authorId legacy", () => {
    const article = makeArticle({ authorId: "manon-author-uuid" });
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation()],
      tags: [],
    });
    expect(input.assignedAuthorId).toBe("manon-author-uuid");
  });

  it("viewsCount préservé", () => {
    const article = makeArticle({ viewsCount: 1234 });
    const input = mapArticleToEntryInput({
      ...article,
      translations: [makeTranslation()],
      tags: [],
    });
    expect(input.viewsCount).toBe(1234);
  });
});

describe("mapTranslationToKnowledgeTranslationInput — triple-source body", () => {
  it("préserve body html + bodyJson + bodyText", () => {
    const t = makeTranslation({
      body: "<p>html</p>",
      bodyJson: { type: "doc", content: [] },
      bodyText: "html plain",
    });
    const input = mapTranslationToKnowledgeTranslationInput(t);
    expect(input.body).toBe("<p>html</p>");
    expect(input.bodyJson).toEqual({ type: "doc", content: [] });
    expect(input.bodyText).toBe("html plain");
  });

  it("préserve locale + slug + title", () => {
    const t = makeTranslation({ locale: "en", slug: "ai-article", title: "AI piece" });
    const input = mapTranslationToKnowledgeTranslationInput(t);
    expect(input.locale).toBe("en");
    expect(input.slug).toBe("ai-article");
    expect(input.title).toBe("AI piece");
  });

  it("préserve meta SEO", () => {
    const t = makeTranslation({ metaTitle: "Meta T", metaDescription: "Meta D" });
    const input = mapTranslationToKnowledgeTranslationInput(t);
    expect(input.metaTitle).toBe("Meta T");
    expect(input.metaDescription).toBe("Meta D");
  });
});
