/**
 * Content Generator — Generator types (Sprint 2 AGT-C).
 *
 * Contrat commun aux 9 generators. Chacun implémente `Generator<TInput, TOutput>`.
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 6.
 */

import type {
  CompanySize,
  ContentType,
  IndexationTier,
  OrganisationType,
  SearchIntent,
} from "../../../../prisma/generated/client";
import type { UnsplashSelectedPhoto } from "../providers/unsplash";

export interface GeneratorBaseInput {
  readonly jobId: string;
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly targetAudienceSize?: CompanySize;
  readonly targetAudienceOrganisation?: OrganisationType;
  readonly anchorVilleSlug?: string;
  readonly anchorDepartementCode?: string;
  readonly anchorRegionSlug?: string;
  readonly primaryKeyword?: string;
  readonly secondaryKeywords?: ReadonlyArray<string>;
  readonly templateVariant?: string;
  /** Tags sectoriels pour filtrage RAG (cf. economic-data kbSectorTags). */
  readonly kbSectorTagSlugs?: ReadonlyArray<string>;
  /** Liste d'IDs KnowledgeEntry consommés par RAG retrieve (audit trail). */
  readonly kbEntryIds?: ReadonlyArray<string>;
  /**
   * Feedback du LLM-judge (quality-improver) à injecter dans le prompt de
   * re-génération. Absent = première génération (pas de boucle improve).
   */
  readonly improvementFeedback?: string;
  /**
   * Métadonnées de l'item RSS source (blog_from_rss uniquement).
   * Injectées dans le prompt pour forcer la citation + le ton actualité.
   */
  readonly rssSourceName?: string;
  readonly rssItemTitle?: string;
  readonly rssItemSummary?: string;
  readonly rssItemLink?: string;
}

export interface GeneratedFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface GeneratorOutput {
  readonly title: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly slug: string;
  readonly directAnswer: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
  readonly faq: ReadonlyArray<GeneratedFaqItem>;
  readonly faqJson?: unknown;
  readonly heroImage?: UnsplashSelectedPhoto;
  readonly tags: ReadonlyArray<string>;
  readonly indexationTier: IndexationTier;
  readonly qualityScore: number;
  readonly seoScore: number;
  readonly readabilityScore: number;
  readonly wordCount: number;
  readonly readingTimeMinutes: number;
  /** Tokens cumulés (input + output) tous providers confondus. */
  readonly totalTokens: number;
  /** Coût total USD tous providers confondus. */
  readonly totalCostUsd: number;
  /** Citations Perplexity ou autres sources externes. */
  readonly citations: ReadonlyArray<{ url: string; title: string; publishedAt?: string }>;
  /**
   * Sprint S+2 City Domination — Phase C strat ville.
   * Slugs des villes mentionnées dans le body (extraction auto via helper
   * `extractMentionedCitiesFromText`). Le content-publish-worker lit ce
   * field et le persiste dans `Article.mentionedCities` au moment de l'insert.
   *
   * Optionnel : V1 generators peuvent l'omettre → Article.mentionedCities = []
   * (article reste indexable, n'apparaît dans aucun hub ville).
   */
  readonly mentionedCities?: ReadonlyArray<string>;
}

export interface Generator<TInput extends GeneratorBaseInput = GeneratorBaseInput> {
  readonly contentType: ContentType;
  generate(input: TInput): Promise<GeneratorOutput>;
}
