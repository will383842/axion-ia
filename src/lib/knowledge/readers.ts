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
import { ALL_GLOSSARY_TERMS_EXTENDED } from "@/content/glossary-extension";
import { serviceTagSlug, type ServiceSlug } from "@/content/knowledge/services";
import { buildKbPublicUrl } from "@/content/knowledge/routes";
import type { KbType, Locale } from "../../../prisma/generated/client";

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
  /**
   * P2-3 — URL de l'image hero (Article.featuredImage DB String?).
   * Optionnel : absent pour KnowledgeEntry et les autres types de contenu.
   * La page /blog/[slug] l'utilise pour le rendu <Image priority> LCP.
   */
  readonly featuredImage?: string | null;
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
 * - sinon depuis le SSOT enrichi `ALL_GLOSSARY_TERMS_EXTENDED` (60 termes).
 *
 * Sprint S+4-A 2026-05-18 (audit P1-19) : la source par défaut est désormais
 * la version étendue (60 termes IA opérationnel : foundational + agents + rag
 * + models + infra + security + evaluation). Le SSOT historique de 12 termes
 * (`GLOSSARY_TERMS_HARDCODE`) reste intouché — sert encore aux tests legacy
 * et au mapping `KnowledgeEntry` (seeders). `ALL_GLOSSARY_TERMS_EXTENDED` le
 * réutilise puis y ajoute 48 entrées + catégories/aliases/related/examples.
 *
 * La structure renvoyée (`GlossaryTerm`) reste minimale (slug/term/fr/en)
 * pour rétro-compat — les consumers riches (`/glossaire/[slug]`) utilisent
 * directement `getGlossaryTermBySlug()` du module `glossary-extension`.
 */
export async function getGlossaryTerms(): Promise<readonly GlossaryTerm[]> {
  if (!isKbBackendUnifiedFor("glossary_term")) {
    // Audit P1-19 — passage 12 → 60 termes via vue enrichie SSOT.
    // Shape minimale identique → zéro breaking change pour `/glossaire/page.tsx`.
    return ALL_GLOSSARY_TERMS_EXTENDED.map((t) => ({
      slug: t.slug,
      term: t.term,
      fr: t.fr,
      en: t.en,
    }));
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

  // Fallback fail-soft : si DB vide (pas encore seedé) ou query échoue
  // côté backend unifié, on retombe sur la vue étendue pour ne pas servir
  // un /glossaire vide à Will. Cohérent avec doctrine `help-articles/reader.ts`.
  const mapped = entries
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

  if (mapped.length === 0) {
    return ALL_GLOSSARY_TERMS_EXTENDED.map((t) => ({
      slug: t.slug,
      term: t.term,
      fr: t.fr,
      en: t.en,
    }));
  }
  return mapped;
}

/**
 * Liste les slugs de termes glossaire publiés (pour `generateStaticParams`).
 * Sprint S+4-A 2026-05-18 — anti soft-404 SSG (`dynamicParams = false`).
 */
export async function listGlossaryTermSlugs(): Promise<readonly string[]> {
  const terms = await getGlossaryTerms();
  return terms.map((t) => t.slug);
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
 *   qui est la source historique de `/faq/page.tsx`.
 *
 * Fix P0-3 audit opérationnel 2026-05-14 : on fusionne aussi la table `faqs`
 * Prisma (Q/R auto-générées par `content-qa-extract-worker` § 29 master prompt).
 * Sans ce merge, les Q/R post-process insérées en DB étaient invisibles sur
 * `/fr/faq/[slug]` (la page lisait uniquement FAQ_GLOBAL ou KnowledgeEntry).
 *
 * Filtre : `status="published"` + `slug` non null. tier-1 et tier-2 sont
 * exposés au lecteur (tier-2 = noindex côté HTML mais accessible via lien
 * direct). tier-3 noindex_nofollow exclu.
 */
export async function listFaqs(): Promise<readonly FaqItem[]> {
  const dbFaqs = await loadAutoGeneratedFaqs();

  if (!isKbBackendUnifiedFor("faq")) {
    const { FAQ_GLOBAL } = await import("@/content/transversal");
    const legacy: FaqItem[] = FAQ_GLOBAL.map((f) => ({
      id: f.id,
      slug: f.id,
      questionFr: f.fr.question,
      questionEn: f.en.question,
      answerFr: f.fr.answer,
      answerEn: f.en.answer,
      viewCount: 0,
      helpfulCount: 0,
    }));
    return mergeFaqs(legacy, dbFaqs);
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

  const kbItems = entries
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

  return mergeFaqs(kbItems, dbFaqs);
}

/**
 * Charge les Q/R publiées depuis la table `faqs` Prisma (P0-3 fix).
 *
 * Filtre : `status='published'`, slug non-null, indexationTier ∈ {tier-1, tier-2}.
 * Les Q/R legacy sans slug (FAQ admin manuel sans content-gen) sont ignorées.
 * Erreur DB → return [] (anti-crash si table absente en migration).
 */
async function loadAutoGeneratedFaqs(): Promise<ReadonlyArray<FaqItem>> {
  try {
    const rows = await prisma.fAQ.findMany({
      where: {
        status: "published",
        indexationTier: { in: ["tier_1_indexable", "tier_2_noindex_follow"] },
      },
      orderBy: { publishedAt: "desc" },
      take: 5000, // cap raisonnable Q/R DB-generated tier-1+tier-2
    });
    return rows
      .map((r): FaqItem | null => {
        if (!r.slug) return null;
        return {
          id: r.id,
          slug: r.slug,
          questionFr: r.questionFr,
          questionEn: r.questionEn,
          answerFr: r.answerFr,
          answerEn: r.answerEn,
          viewCount: r.viewCount,
          helpfulCount: r.helpfulCount,
        };
      })
      .filter((f): f is FaqItem => f !== null);
  } catch (err) {
    // Table absente (migration pas appliquée) ou DB down → return [] silencieux
    if (process.env.NODE_ENV !== "production") {
      console.warn("[readers.loadAutoGeneratedFaqs] FAQ DB read failed:", err);
    }
    return [];
  }
}

/**
 * Fusionne 2 sources FAQ en dédoublonnant par slug (priorité à la source A).
 * Utilisé pour merger {FAQ_GLOBAL | KnowledgeEntry} avec table `faqs` DB.
 */
function mergeFaqs(a: ReadonlyArray<FaqItem>, b: ReadonlyArray<FaqItem>): FaqItem[] {
  const map = new Map<string, FaqItem>();
  for (const it of a) map.set(it.slug, it);
  for (const it of b) if (!map.has(it.slug)) map.set(it.slug, it);
  return Array.from(map.values());
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
      // P2-3 — Image hero article (Article.featuredImage DB String?).
      featuredImage: translation.article.featuredImage ?? null,
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
// SERVICE BINDING (KB V4.1) — connaissances liées à un service
// ============================================================

/** Carte publique minimale d'une entrée KB liée à un service. */
export interface ServiceKnowledgeCard {
  readonly entryId: string;
  readonly type: KbType;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly href: string | null;
  readonly publishedAt: Date | null;
}

/**
 * Liste les entrées KB publiées rattachées à un service (tag `service:<slug>`).
 *
 * Triple filtre public strict (status+audience+confidentiality+deletedAt+
 * publishedAt<=now+embargo) — aligné sur `public-fetch.ts`. Aucune fuite
 * draft/team/internal/futur/embargo possible.
 *
 * Build-time : si DATABASE_URL = stub `stub.invalid`, le Proxy Prisma renvoie
 * `[]` → le bloc « connaissances liées » est masqué, repeuplé par l'ISR de la
 * page service sous son `revalidate`.
 */
export async function listEntriesByService(
  serviceSlug: ServiceSlug,
  opts?: { readonly locale?: Locale; readonly limit?: number; readonly types?: readonly KbType[] },
): Promise<readonly ServiceKnowledgeCard[]> {
  const locale: Locale = opts?.locale ?? "fr";
  const limit = opts?.limit ?? 6;
  const now = new Date();
  try {
    const rows = await prisma.knowledgeEntry.findMany({
      where: {
        status: "published",
        audience: "public",
        confidentiality: "public",
        deletedAt: null,
        publishedAt: { lte: now },
        OR: [{ embargoUntil: null }, { embargoUntil: { lte: now } }],
        tags: { some: { tag: { slug: serviceTagSlug(serviceSlug) } } },
        ...(opts?.types && opts.types.length > 0 ? { type: { in: [...opts.types] } } : {}),
      },
      orderBy: [{ pinned: "desc" }, { featured: "desc" }, { publishedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        type: true,
        publishedAt: true,
        translations: {
          where: { locale },
          select: { slug: true, title: true, excerpt: true },
          take: 1,
        },
      },
    });
    return rows
      .map((row): ServiceKnowledgeCard | null => {
        const t = row.translations[0];
        if (!t || !t.slug) return null;
        return {
          entryId: row.id,
          type: row.type,
          slug: t.slug,
          title: t.title,
          excerpt: t.excerpt,
          href: buildKbPublicUrl(row.type, locale, t.slug),
          publishedAt: row.publishedAt,
        };
      })
      .filter((c): c is ServiceKnowledgeCard => c !== null);
  } catch {
    // Table absente bootstrap / DB down → bloc masqué (fail-soft).
    return [];
  }
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
