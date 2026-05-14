/**
 * Content Generator — Article URL builder (Sprint 9 V2).
 *
 * Centralise la construction des URLs publiques d'articles pour qu'il n'y ait
 * qu'UN seul endroit à patcher si la structure de routing change. Utilisé par :
 *   - content-publish-worker (IndexNow + Google Indexing ping)
 *   - tier-lifecycle-worker (Sprint 10 auto-promote)
 *   - sitemap generator (futur)
 *
 * Source de vérité = `NEXT_PUBLIC_SITE_URL`. Si absent → fallback prod
 * `https://axion-ia.com` (jamais localhost, jamais staging).
 */

export interface BuildArticleUrlInput {
  readonly slug: string;
  readonly isNews: boolean;
  readonly locale?: string;
}

const DEFAULT_SITE_URL = "https://axion-ia.com";
const DEFAULT_LOCALE = "fr";

export function buildArticleUrl(input: BuildArticleUrlInput): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  const locale = input.locale ?? DEFAULT_LOCALE;
  const segment = input.isNews ? "actualites" : "blog";
  return `${siteUrl}/${locale}/${segment}/${input.slug}`;
}
