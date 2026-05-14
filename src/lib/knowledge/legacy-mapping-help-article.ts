/**
 * KB-5 — Mapping pur `HelpArticle` → `KnowledgeEntry`.
 * Pattern identique à Article (KB-2) : type='help_article', triple-source body.
 */

import type {
  HelpArticle,
  HelpArticleTranslation,
  KbStatus,
  KnowledgeEntry,
  Locale,
  PublishStatus,
} from "../../../prisma/generated/client";

export interface HelpArticleWithRelations extends HelpArticle {
  translations: HelpArticleTranslation[];
}

export function mapLegacyStatusToKb(legacy: PublishStatus): KbStatus {
  switch (legacy) {
    case "draft":
      return "draft";
    case "published":
      return "published";
    case "archived":
      return "archived";
    default: {
      const _exhaustive: never = legacy;
      void _exhaustive;
      return "draft";
    }
  }
}

export function mapHelpArticleToEntryInput(
  ha: HelpArticleWithRelations,
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
> {
  const frTranslation = ha.translations.find((t) => t.locale === "fr");
  const enTranslation = ha.translations.find((t) => t.locale === "en");
  const rootSlug = frTranslation?.slug ?? enTranslation?.slug ?? `legacy-help-${ha.id.slice(0, 8)}`;

  return {
    type: "help_article",
    domain: "editorial",
    audience: "public",
    confidentiality: "public",
    status: mapLegacyStatusToKb(ha.status),
    pipelineStage:
      ha.status === "published" ? "published" : ha.status === "archived" ? "archived" : "draft",
    slug: rootSlug,
    publishedAt: ha.publishedAt,
    createdAt: ha.createdAt,
    updatedAt: ha.updatedAt,
  };
}

export function mapHelpArticleTranslationInput(t: HelpArticleTranslation) {
  return {
    locale: t.locale as Locale,
    title: t.title,
    slug: t.slug,
    excerpt: t.excerpt,
    body: t.body,
    bodyJson: t.bodyJson,
    bodyText: t.bodyText,
    metaTitle: t.metaTitle,
    metaDescription: t.metaDescription,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
