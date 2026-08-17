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
import { publicEntryFilter } from "./public-fetch";
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
      // GEO-082 (2026-08-17) — AVANT : `null`, avec le motif « doctrine / adr /
      // prompt_template / sop → admin-only ».
      //
      // C'est faux, et mesuré : `/[locale]/connaissances/[slug]` est la route
      // KB GÉNÉRIQUE — elle sert n'importe quelle entrée par son slug, sans
      // aucun filtre de type. Les 507 URLs de `sitemap-knowledge.xml` y
      // pointent toutes. Ce qui décide qu'une fiche est publique, ce sont
      // `audience` et `confidentiality`, JAMAIS son type.
      //
      // Conséquence de l'ancien `null` : sur 28 types, 21 n'avaient aucun
      // chemin public déclaré. Renommer l'un d'eux produisait un 404 sec au
      // lieu d'un 301 — alors que la fiche était bien servie, juste à une
      // adresse que cette fonction refusait de nommer.
      //
      // La publicité réelle de la cible est vérifiée par l'appelant (voir
      // `findRedirectFromHistory`), qui applique le prédicat anti-fuite : une
      // fiche non publique ne produit aucune redirection.
      return `/${locale}/connaissances/${slug}`;
  }
}

/**
 * Lookup un ancien slug. Si trouvé, retourne l'entry cible (current state).
 * Si l'entry a été soft-deleted, retourne null (404 plutôt que redirect mort).
 *
 * `oldType` est OPTIONNEL depuis GEO-082. La route générique
 * `/connaissances/[slug]` sert toutes les familles : elle ne peut pas deviner
 * le type de l'ancienne URL, et n'a pas à le faire — le couple (locale, slug)
 * suffit à retrouver l'entrée.
 */
export async function findRedirectFromHistory(params: {
  oldSlug: string;
  oldLocale: Locale;
  oldType?: KbType;
}): Promise<SlugHistoryHit | null> {
  const inclure = {
    entry: {
      include: { translations: { where: { locale: params.oldLocale } } },
    },
  } as const;

  const hit = params.oldType
    ? await prisma.knowledgeSlugHistory.findUnique({
        where: {
          oldLocale_oldType_oldSlug: {
            oldLocale: params.oldLocale,
            oldType: params.oldType,
            oldSlug: params.oldSlug,
          },
        },
        include: inclure,
      })
    : await prisma.knowledgeSlugHistory.findFirst({
        where: { oldLocale: params.oldLocale, oldSlug: params.oldSlug },
        include: inclure,
      });

  if (!hit || hit.entry.deletedAt) return null;

  // 🔴 GEO-082 — la cible doit être RÉELLEMENT servie au public.
  //
  // Avant, seul `deletedAt` était vérifié. Une fiche passée en `audience:
  // team`, dépubliée, ou encore sous embargo produisait donc une 301 vers une
  // page qui répond 404. **Une redirection permanente vers un 404 est pire
  // qu'un 404 direct** : le moteur enregistre le saut, purge l'ancienne URL de
  // son index, et n'obtient rien en échange.
  //
  // On réutilise le prédicat anti-fuite SSOT plutôt que d'en recopier les
  // clauses — le recopier, c'est le laisser diverger.
  const cible = await prisma.knowledgeEntry.findFirst({
    where: { id: hit.entry.id, ...publicEntryFilter(new Date()) },
    select: { id: true },
  });
  if (!cible) return null;

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
