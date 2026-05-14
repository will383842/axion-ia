/**
 * Generator — blog from RSS NewsArticle (Sprint 2 + 5 AGT-C).
 *
 * V1 = squelette. Sub-prompt complet : prompts/blog-article.md variant rss.
 * Particularités :
 *  - Schema NewsArticle (pas Article) — § 28 master prompt v1.7
 *  - Citation source obligatoire (sourceUrl + sourceName injectés depuis input)
 *  - tier_2_noindex_follow auto-publish si score ≥ 60 (default policy)
 *
 * Sprint 5 — wire NewsArticle JSON-LD : la factory `buildNewsArticleJsonLd`
 * (src/lib/seo-content-gen-factories.ts) est désormais appelable par le worker
 * de publication via le helper exporté `enrichOutputWithNewsArticleJsonLd`.
 * Le worker publie le JSON-LD dans le <head> de la page tier-1/2 indexable.
 */

import {
  buildNewsArticleJsonLd,
  type NewsArticleJsonLdInput,
} from "@/lib/seo-content-gen-factories";
import { landingVilleGenerator } from "./landing-ville";
import type { Generator, GeneratorBaseInput, GeneratorOutput } from "./types";

export const blogFromRssGenerator: Generator = {
  contentType: "blog_from_rss",
  async generate(input: GeneratorBaseInput): Promise<GeneratorOutput> {
    // V1 deleg landing-ville pipeline (KB retrieve + LLM + quality checks).
    // V2 (Sprint 6 si dataset suffisant) = sub-prompt RSS dédié avec citation
    // source + ton actualité (vs ton intervention pour landing-ville).
    const result = await landingVilleGenerator.generate({
      ...input,
      contentType: "blog_from_rss",
    });
    return result;
  },
};

/**
 * Helper appelé par `content-publish-worker` (Sprint 5) après publication
 * tier-1 d'un job `blog_from_rss` : construit le bloc JSON-LD NewsArticle à
 * injecter dans `<head>` de la page publiée. Le worker stocke ce JSON dans
 * `Article.jsonLd` pour rendu par `generateMetadata()` de la route.
 */
export function enrichOutputWithNewsArticleJsonLd(input: {
  readonly title: string;
  readonly metaDescription: string;
  readonly slug: string;
  readonly heroImageUrl?: string;
  readonly publishedAt: Date | string;
  readonly modifiedAt?: Date | string;
  readonly rssSourceUrl: string;
  readonly rssSourceName: string;
  readonly dateline?: string;
  readonly printSection?: string;
  readonly wordCount?: number;
  readonly readingTimeMinutes?: number;
}): Record<string, unknown> {
  const newsInput: NewsArticleJsonLdInput = {
    title: input.title,
    description: input.metaDescription,
    slug: input.slug,
    locale: "fr",
    publishedAt: input.publishedAt,
    updatedAt: input.modifiedAt ?? input.publishedAt,
    sourceUrl: input.rssSourceUrl,
    sourceName: input.rssSourceName,
    ...(input.heroImageUrl ? { imageUrl: input.heroImageUrl } : {}),
    ...(input.dateline ? { dateline: input.dateline } : {}),
    ...(input.printSection ? { printSection: input.printSection } : {}),
    ...(input.wordCount !== undefined ? { wordCount: input.wordCount } : {}),
    ...(input.readingTimeMinutes !== undefined
      ? { readingTimeMinutes: input.readingTimeMinutes }
      : {}),
  };
  return buildNewsArticleJsonLd(newsInput);
}
