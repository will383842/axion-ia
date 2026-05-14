/**
 * KB-5 — Mapping pur `FAQ` → `KnowledgeEntry` shape.
 *
 * Particularité : FAQ legacy a question/answer inline FR+EN (pas de table
 * translations séparée). Donc on génère 2 KnowledgeTranslation (fr + en) à
 * partir d'un seul row FAQ.
 */

import type {
  FAQ,
  KbStatus,
  KnowledgeEntry,
  Locale,
  PublishStatus,
} from "../../../prisma/generated/client";

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

/**
 * Map `FAQ` legacy → `KnowledgeEntry`. type='faq', audience=public.
 */
export function mapFaqToEntryInput(
  faq: FAQ,
): Pick<
  KnowledgeEntry,
  | "type"
  | "domain"
  | "audience"
  | "confidentiality"
  | "status"
  | "pipelineStage"
  | "slug"
  | "createdAt"
  | "updatedAt"
  | "viewsCount"
  | "helpfulUpCount"
> {
  return {
    type: "faq",
    domain: "editorial",
    audience: "public",
    confidentiality: "public",
    status: mapLegacyStatusToKb(faq.status),
    pipelineStage:
      faq.status === "published" ? "published" : faq.status === "archived" ? "archived" : "draft",
    slug: faq.slug,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
    viewsCount: faq.viewCount,
    helpfulUpCount: faq.helpfulCount,
  };
}

/**
 * Génère 2 KnowledgeTranslation (fr + en) depuis un FAQ legacy.
 * FAQ.questionFr → title, FAQ.answerFr → body, idem EN.
 * Slug par locale : `{rootSlug}-fr` / `{rootSlug}-en` pour éviter collision.
 */
export function mapFaqTranslations(faq: FAQ): Array<{
  locale: Locale;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  bodyJson: unknown;
  bodyText: string;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  return [
    {
      locale: "fr",
      title: faq.questionFr,
      slug: faq.slug,
      excerpt: null,
      body: `<p>${escapeHtml(faq.answerFr)}</p>`,
      bodyJson: null,
      bodyText: faq.answerFr,
      metaTitle: faq.metaTitle,
      metaDescription: faq.metaDescription,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
    },
    {
      locale: "en",
      title: faq.questionEn,
      slug: `${faq.slug}-en`,
      excerpt: null,
      body: `<p>${escapeHtml(faq.answerEn)}</p>`,
      bodyJson: null,
      bodyText: faq.answerEn,
      metaTitle: faq.metaTitle,
      metaDescription: faq.metaDescription,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
    },
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
