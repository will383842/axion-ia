/**
 * KB-2 — Mapping pure entre modèles legacy et `KnowledgeEntry`.
 *
 * Sépare la logique pure (testable sans DB) du runtime CLI
 * (`scripts/import-knowledge-from-legacy.ts`).
 *
 * V1 (Sprint KB-2) : `Article` → `KnowledgeEntry type='article'`.
 * V2 (Sprint KB-5) : ajoutera `CaseStudy`, `FAQ`, `HelpArticle`, `glossaire`, `guide-ia`.
 */

import type {
  Article,
  ArticleTranslation,
  KbStatus,
  KnowledgeEntry,
  Locale,
  PublishStatus,
} from "../../../prisma/generated/client";

export interface ArticleWithRelations extends Article {
  translations: ArticleTranslation[];
  tags: { tagId: string; tag: { slug: string; nameFr: string; nameEn: string } }[];
}

/**
 * Mappe l'enum legacy `PublishStatus` (3 valeurs) vers `KbStatus` (7 valeurs).
 * Compatibilité directe pour les 3 valeurs legacy (draft/published/archived).
 */
export function mapLegacyStatusToKb(legacy: PublishStatus): KbStatus {
  switch (legacy) {
    case "draft":
      return "draft";
    case "published":
      return "published";
    case "archived":
      return "archived";
    default: {
      // Garde-fou exhaustivité (si PublishStatus est étendu sans MAJ ici).
      const _exhaustive: never = legacy;
      void _exhaustive;
      return "draft";
    }
  }
}

/**
 * Maps Prisma `Article` legacy → `KnowledgeEntry`-shape (input pre-insert).
 *
 * Convention V1 :
 * - `type = 'article'`
 * - `domain = 'editorial'` (par défaut, Sprint KB-5 affinage via tags)
 * - `audience = 'public'` (les Article legacy étaient publics)
 * - `confidentiality = 'public'`
 * - `status` mapping via `mapLegacyStatusToKb`
 * - `pipelineStage` synchrone avec status
 * - `slug` racine = slug FR (fallback EN, fallback id)
 */
export function mapArticleToEntryInput(
  article: ArticleWithRelations,
): Pick<
  KnowledgeEntry,
  | "type"
  | "domain"
  | "audience"
  | "confidentiality"
  | "status"
  | "pipelineStage"
  | "slug"
  | "publishedAt"
  | "createdAt"
  | "updatedAt"
  | "assignedAuthorId"
  | "viewsCount"
> {
  const frTranslation = article.translations.find((t) => t.locale === "fr");
  const enTranslation = article.translations.find((t) => t.locale === "en");
  const rootSlug =
    frTranslation?.slug ?? enTranslation?.slug ?? `legacy-article-${article.id.slice(0, 8)}`;

  return {
    type: "article",
    domain: "editorial",
    audience: "public",
    confidentiality: "public",
    status: mapLegacyStatusToKb(article.status),
    pipelineStage:
      article.status === "published"
        ? "published"
        : article.status === "archived"
          ? "archived"
          : "draft",
    slug: rootSlug,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    assignedAuthorId: article.authorId,
    viewsCount: article.viewsCount,
  };
}

/**
 * Maps Prisma `ArticleTranslation` legacy → `KnowledgeTranslation`-shape.
 * Triple-source body conservée (html + json + text) — Sprint 24 C4 pattern.
 */
export function mapTranslationToKnowledgeTranslationInput(translation: ArticleTranslation) {
  return {
    locale: translation.locale as Locale,
    title: translation.title,
    slug: translation.slug,
    excerpt: translation.excerpt,
    body: translation.body,
    bodyJson: translation.bodyJson,
    bodyText: translation.bodyText,
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    createdAt: translation.createdAt,
    updatedAt: translation.updatedAt,
  };
}
