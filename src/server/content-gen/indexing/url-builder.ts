/**
 * Content Generator — Article URL builder (Sprint 9 V2).
 *
 * Centralise la construction des URLs publiques d'articles pour qu'il n'y ait
 * qu'UN seul endroit à patcher si la structure de routing change. Utilisé par :
 *   - content-publish-worker (IndexNow + Google Indexing ping + revalidate ISR)
 *   - tier-lifecycle-worker (Sprint 10 auto-promote + fetch CTR GSC)
 *   - sitemap generator (futur)
 *
 * Source de vérité = `NEXT_PUBLIC_SITE_URL`. Si absent → fallback prod
 * `https://axion-ia.com` (jamais localhost, jamais staging).
 *
 * Fix 2026-08-15 (D8 audit e2e) — le builder ignorait `resolveArticleRoute`
 * (SSOT de la route publique par type d'article) : un article GUIDE (slug
 * `guide-*` ou templateVariant contenant « guide ») était pingé (IndexNow /
 * Google) et revalidé sous `/fr/blog/guide-…`, URL qui répond 308 vers
 * `/fr/guides/…`. Conséquences observées : la vraie URL n'était JAMAIS
 * revalidée (le contenu frais n'apparaissait qu'à l'expiration ISR) et le
 * tier-lifecycle interrogeait GSC sur une URL de redirection → métriques
 * nulles à vie → décisions promote/demote toujours « no_data ». Le builder
 * passe désormais par `resolveArticleRoute` (même logique que le loader
 * /guides et les pages publiques).
 */

import { resolveArticleRoute } from "@/server/content-gen/blog/resolve-article-route";

export interface BuildArticleUrlInput {
  readonly slug: string;
  readonly isNews: boolean;
  readonly locale?: string;
  /**
   * Fix 2026-08-15 (D8) — `Article.templateVariant` (= ContentGenJob.templateId),
   * second signal de détection guide de `resolveArticleRoute`. Optionnel :
   * les callers historiques (slug seul) restent corrects pour les slugs
   * `guide-*` ; passer la valeur quand elle est disponible affine la détection.
   */
  readonly templateVariant?: string | null;
}

const DEFAULT_SITE_URL = "https://axion-ia.com";
const DEFAULT_LOCALE = "fr";

/**
 * Chemin RELATIF de l'article (ex. `/fr/guides/guide-audit-ia`). Exposé pour la
 * revalidation ISR (`revalidateContent` consomme des paths relatifs), afin que
 * ping et revalidate partagent exactement la même résolution de route (D8).
 */
export function buildArticlePath(input: BuildArticleUrlInput): string {
  const locale = input.locale ?? DEFAULT_LOCALE;
  // Fix 2026-08-15 (D8) — route dérivée du SSOT resolveArticleRoute au lieu du
  // binaire isNews ? actualites : blog qui envoyait les guides sous /blog (308).
  const segment = resolveArticleRoute({
    isNews: input.isNews,
    templateVariant: input.templateVariant ?? null,
    slug: input.slug,
  });
  return `/${locale}/${segment}/${input.slug}`;
}

export function buildArticleUrl(input: BuildArticleUrlInput): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  return `${siteUrl}${buildArticlePath(input)}`;
}
