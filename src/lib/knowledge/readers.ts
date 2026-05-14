/**
 * KB-6 — Readers unifiés pour pages publiques.
 *
 * Chaque reader exposé sait lire :
 * - depuis `KnowledgeEntry WHERE type=X` si feature flag `KB_BACKEND_UNIFIED_X=1`,
 * - sinon depuis la table legacy correspondante.
 *
 * Retourne un format **uniforme** pour le rendu (façade `KnowledgeEntryFacade`),
 * permettant aux pages publiques d'être indépendantes de la source réelle.
 *
 * Pattern adapter / strangler fig — permet bascule progressive sans casser.
 */

import { prisma } from "@/lib/prisma";
import { isKbBackendUnifiedFor, type KbBackendTarget } from "./feature-flag";
import { GLOSSARY_TERMS_HARDCODE } from "./legacy-mapping-glossary-hardcode";
import type { Locale } from "../../../prisma/generated/client";

/**
 * Façade uniforme pour le rendu public.
 * Indépendante de la source (legacy table ou KnowledgeEntry).
 */
export interface PublicEntryFacade {
  readonly id: string;
  readonly type: KbBackendTarget;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly body: string;
  readonly bodyText: string | null;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly locale: Locale;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
}

// ============================================================
// GLOSSARY
// ============================================================

export interface GlossaryTerm {
  readonly slug: string;
  readonly term: string;
  readonly fr: string;
  readonly en: string;
}

/**
 * Lit les termes glossaire :
 * - depuis KnowledgeEntry si KB_BACKEND_UNIFIED_GLOSSARY ou _GLOBAL.
 * - sinon depuis le SSOT hardcode `GLOSSARY_TERMS_HARDCODE`.
 */
export async function getGlossaryTerms(): Promise<readonly GlossaryTerm[]> {
  if (!isKbBackendUnifiedFor("glossary_term")) {
    return GLOSSARY_TERMS_HARDCODE;
  }

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      type: "glossary_term",
      audience: "public",
      status: { in: ["published", "deprecated"] },
      deletedAt: null,
    },
    include: { translations: true },
    orderBy: { slug: "asc" },
  });

  return entries
    .map((e) => {
      const fr = e.translations.find((t) => t.locale === "fr");
      const en = e.translations.find((t) => t.locale === "en");
      if (!fr || !en) return null;
      return {
        slug: e.slug,
        term: fr.title,
        fr: fr.bodyText ?? stripHtml(fr.body),
        en: en.bodyText ?? stripHtml(en.body),
      };
    })
    .filter((t): t is GlossaryTerm => t !== null);
}

// ============================================================
// FAQ
// ============================================================

export interface FaqItem {
  readonly id: string;
  readonly slug: string;
  readonly questionFr: string;
  readonly questionEn: string;
  readonly answerFr: string;
  readonly answerEn: string;
  readonly viewCount: number;
  readonly helpfulCount: number;
}

/**
 * Lit les FAQ :
 * - depuis KnowledgeEntry si KB_BACKEND_UNIFIED_FAQ ou _GLOBAL.
 * - sinon depuis `FAQ_GLOBAL` (SSOT hardcode dans `src/content/transversal.ts`)
 *   qui est la source historique de `/faq/page.tsx`. La table `faqs` legacy
 *   n'est PAS lue par le frontend public (utilisée seulement par l'admin
 *   legacy `/admin/faq` et migrée en KB pour unifier).
 */
export async function listFaqs(): Promise<readonly FaqItem[]> {
  if (!isKbBackendUnifiedFor("faq")) {
    const { FAQ_GLOBAL } = await import("@/content/transversal");
    return FAQ_GLOBAL.map((f) => ({
      id: f.id,
      slug: f.id,
      questionFr: f.fr.question,
      questionEn: f.en.question,
      answerFr: f.fr.answer,
      answerEn: f.en.answer,
      viewCount: 0,
      helpfulCount: 0,
    }));
  }

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      type: "faq",
      audience: "public",
      status: { in: ["published", "deprecated"] },
      deletedAt: null,
    },
    include: { translations: true },
    orderBy: { createdAt: "asc" },
  });

  return entries
    .map((e) => {
      const fr = e.translations.find((t) => t.locale === "fr");
      const en = e.translations.find((t) => t.locale === "en");
      if (!fr || !en) return null;
      return {
        id: e.id,
        slug: e.slug,
        questionFr: fr.title,
        questionEn: en.title,
        answerFr: fr.bodyText ?? stripHtml(fr.body),
        answerEn: en.bodyText ?? stripHtml(en.body),
        viewCount: e.viewsCount,
        helpfulCount: e.helpfulUpCount,
      };
    })
    .filter((f): f is FaqItem => f !== null);
}

// ============================================================
// ARTICLE (blog)
// ============================================================

export interface ArticleSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly publishedAt: Date | null;
  readonly readingTime: number | null;
  readonly author: { readonly slug: string; readonly name: string } | null;
  readonly category: { readonly slug: string; readonly name: string } | null;
}

/**
 * Liste les articles publiés (pour la page liste blog).
 * Pattern legacy → unifié progressif.
 */
export async function listPublishedArticles(locale: Locale): Promise<readonly ArticleSummary[]> {
  if (!isKbBackendUnifiedFor("article")) {
    const legacy = await prisma.article.findMany({
      where: { status: "published" },
      include: {
        translations: { where: { locale } },
        author: { select: { slug: true, name: true } },
        category: { select: { slug: true, nameFr: true, nameEn: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });
    return legacy.map((a) => {
      const t = a.translations[0];
      return {
        id: a.id,
        slug: t?.slug ?? a.id,
        title: t?.title ?? "(sans titre)",
        excerpt: t?.excerpt ?? null,
        publishedAt: a.publishedAt,
        readingTime: a.readingTime,
        author: a.author,
        category: a.category
          ? { slug: a.category.slug, name: locale === "fr" ? a.category.nameFr : a.category.nameEn }
          : null,
      };
    });
  }

  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      type: "article",
      audience: "public",
      status: { in: ["published", "deprecated"] },
      deletedAt: null,
    },
    include: {
      translations: { where: { locale } },
      assignedAuthor: { select: { slug: true, name: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
  });

  return entries.map((e) => {
    const t = e.translations[0];
    return {
      id: e.id,
      slug: t?.slug ?? e.slug,
      title: t?.title ?? "(sans titre)",
      excerpt: t?.excerpt ?? null,
      publishedAt: e.publishedAt,
      readingTime: null, // V1 : pas dans KnowledgeEntry direct, à enrichir KB-16 readingTime helper
      author: e.assignedAuthor,
      category: null, // V1 : tags KB → category mapping KB-7+
    };
  });
}

/**
 * Détail article par slug (pour /blog/[slug]).
 */
export async function findArticleBySlug(
  slug: string,
  locale: Locale,
): Promise<PublicEntryFacade | null> {
  if (!isKbBackendUnifiedFor("article")) {
    const translation = await prisma.articleTranslation.findFirst({
      where: { slug, locale },
      include: { article: true },
    });
    if (!translation || translation.article.status !== "published") return null;
    return {
      id: translation.article.id,
      type: "article",
      slug: translation.slug,
      title: translation.title,
      excerpt: translation.excerpt,
      body: translation.body,
      bodyText: translation.bodyText,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      locale: translation.locale,
      publishedAt: translation.article.publishedAt,
      updatedAt: translation.updatedAt,
    };
  }

  const translation = await prisma.knowledgeTranslation.findFirst({
    where: {
      slug,
      locale,
      entry: {
        type: "article",
        audience: "public",
        status: { in: ["published", "deprecated"] },
        deletedAt: null,
      },
    },
    include: { entry: true },
  });
  if (!translation) return null;
  return {
    id: translation.entry.id,
    type: "article",
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    body: translation.body,
    bodyText: translation.bodyText,
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    locale: translation.locale,
    publishedAt: translation.entry.publishedAt,
    updatedAt: translation.updatedAt,
  };
}

// ============================================================
// CASE STUDY
// ============================================================

export async function findCaseStudyBySlug(
  slug: string,
  locale: Locale,
): Promise<PublicEntryFacade | null> {
  if (!isKbBackendUnifiedFor("case_study")) {
    const translation = await prisma.caseStudyTranslation.findFirst({
      where: { slug, locale },
      include: { caseStudy: true },
    });
    if (!translation || translation.caseStudy.status !== "published") return null;
    // Body = problem + solution concat (façade uniforme).
    const body = `<h2>Problème</h2>${translation.problem}<h2>Solution</h2>${translation.solution}`;
    const bodyText = `${translation.problemText ?? translation.problem}\n\n${translation.solutionText ?? translation.solution}`;
    return {
      id: translation.caseStudy.id,
      type: "case_study",
      slug: translation.slug,
      title: translation.title,
      excerpt: null,
      body,
      bodyText,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      locale: translation.locale,
      publishedAt: translation.caseStudy.publishedAt,
      updatedAt: translation.updatedAt,
    };
  }

  const translation = await prisma.knowledgeTranslation.findFirst({
    where: {
      slug,
      locale,
      entry: {
        type: "case_study",
        audience: "public",
        status: { in: ["published", "deprecated"] },
        deletedAt: null,
      },
    },
    include: { entry: true },
  });
  if (!translation) return null;
  return {
    id: translation.entry.id,
    type: "case_study",
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    body: translation.body,
    bodyText: translation.bodyText,
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    locale: translation.locale,
    publishedAt: translation.entry.publishedAt,
    updatedAt: translation.updatedAt,
  };
}

// ============================================================
// HELP ARTICLE
// ============================================================

export async function findHelpArticleBySlug(
  slug: string,
  locale: Locale,
): Promise<PublicEntryFacade | null> {
  if (!isKbBackendUnifiedFor("help_article")) {
    const translation = await prisma.helpArticleTranslation.findFirst({
      where: { slug, locale },
      include: { helpArticle: true },
    });
    if (!translation || translation.helpArticle.status !== "published") return null;
    return {
      id: translation.helpArticle.id,
      type: "help_article",
      slug: translation.slug,
      title: translation.title,
      excerpt: translation.excerpt,
      body: translation.body,
      bodyText: translation.bodyText,
      metaTitle: translation.metaTitle,
      metaDescription: translation.metaDescription,
      locale: translation.locale,
      publishedAt: translation.helpArticle.publishedAt,
      updatedAt: translation.updatedAt,
    };
  }

  const translation = await prisma.knowledgeTranslation.findFirst({
    where: {
      slug,
      locale,
      entry: {
        type: "help_article",
        audience: "public",
        status: { in: ["published", "deprecated"] },
        deletedAt: null,
      },
    },
    include: { entry: true },
  });
  if (!translation) return null;
  return {
    id: translation.entry.id,
    type: "help_article",
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    body: translation.body,
    bodyText: translation.bodyText,
    metaTitle: translation.metaTitle,
    metaDescription: translation.metaDescription,
    locale: translation.locale,
    publishedAt: translation.entry.publishedAt,
    updatedAt: translation.updatedAt,
  };
}

// ============================================================
// Helpers
// ============================================================

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
