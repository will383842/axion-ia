/**
 * KB-12 — Lookup slug history pour 301 redirects.
 *
 * Usage côté page publique :
 *   const oldSlug = await findRedirectFromHistory({ oldSlug: slug, oldLocale: 'fr', oldType: 'article' });
 *   if (oldSlug) redirect(`/fr/blog/${oldSlug.currentSlug}`, RedirectType.permanent);
 *
 * Pattern strangler : pas de middleware Next pour V1 (overhead sur chaque
 * request). Intégration page-par-page selon besoin. Sprint KB-12 v2 envisagera
 * un middleware si volume justifie.
 */

import { prisma } from "@/lib/prisma";
import type { KbType, Locale } from "../../../prisma/generated/client";

export interface SlugHistoryHit {
  readonly entryId: string;
  readonly currentSlug: string;
  readonly currentType: KbType;
  readonly currentLocale: Locale;
  /** Path URL public (sprint UX 2026-05-22) — null si type non-public. */
  readonly currentPath: string | null;
}

/**
 * Mappe un KbType vers son segment URL public ou null si type non-routé.
 * V-10 wire 2026-05-22 — réplique la convention pathnames `i18n/routing.ts`.
 */
export function kbTypeToPublicPath(type: KbType, locale: Locale, slug: string): string | null {
  switch (type) {
    case "article":
      return `/${locale}/blog/${slug}`;
    case "guide":
      return `/${locale}/guides/${slug}`;
    case "glossary_term":
      return locale === "fr" ? `/${locale}/glossaire/${slug}` : `/${locale}/glossary/${slug}`;
    case "case_study":
      return locale === "fr"
        ? `/${locale}/cas-concrets/${slug}`
        : `/${locale}/case-studies/${slug}`;
    case "help_article":
      return locale === "fr" ? `/${locale}/centre-aide/${slug}` : `/${locale}/help-center/${slug}`;
    case "faq":
      return `/${locale}/faq/${slug}`;
    case "methodology":
      return locale === "fr" ? `/${locale}/methodologie/${slug}` : `/${locale}/methodology/${slug}`;
    default:
      return null; // doctrine/adr/prompt_template/sop/etc. → admin-only
  }
}

/**
 * Lookup un ancien slug. Si trouvé, retourne l'entry cible (current state).
 * Si l'entry a été soft-deleted, retourne null (404 plutôt que redirect mort).
 */
export async function findRedirectFromHistory(params: {
  oldSlug: string;
  oldLocale: Locale;
  oldType: KbType;
}): Promise<SlugHistoryHit | null> {
  const hit = await prisma.knowledgeSlugHistory.findUnique({
    where: {
      oldLocale_oldType_oldSlug: {
        oldLocale: params.oldLocale,
        oldType: params.oldType,
        oldSlug: params.oldSlug,
      },
    },
    include: {
      entry: {
        include: { translations: { where: { locale: params.oldLocale } } },
      },
    },
  });
  if (!hit || hit.entry.deletedAt) return null;
  const translation = hit.entry.translations[0];
  if (!translation) return null;
  return {
    entryId: hit.entry.id,
    currentSlug: translation.slug,
    currentType: hit.entry.type,
    currentLocale: params.oldLocale,
    currentPath: kbTypeToPublicPath(hit.entry.type, params.oldLocale, translation.slug),
  };
}
