/**
 * Tombstone helper — signale au crawler la disparition d'une URL via "soft-410".
 *
 * Audit indexation 2026-05-15 P0-7 — Avant ce patch, un Article archived ou
 * deleted renvoyait 404 silent (Google retire l'URL après ~6 mois). Le standard
 * RFC 7231 §6.5.9 prévoit 410 Gone pour signaler la disparition définitive
 * (Google déréférence en ~24h vs ~6 mois en 404).
 *
 * Next 16 App Router ne dispose PAS d'équivalent natif à `notFound()` pour le
 * code 410. Pour le vrai status code 410, il faudrait soit :
 *   (a) un middleware Edge avec lookup Redis (incompatible ioredis self-hosted)
 *   (b) un Route Handler dédié (conflit conventions avec page.tsx)
 *
 * Compromis V1 : "soft-410" — page render normalement (status 200) mais avec :
 *   - `<meta name="robots" content="noindex, nofollow">` côté HTML
 *   - `<meta http-equiv="X-Robots-Tag" content="noindex, nofollow">` côté HTTP-equiv
 *   - Message UX explicite "Cette ressource a été retirée"
 *   - JSON-LD `discontinued` Schema.org WebPage isAccessibleForFree=false
 *
 * Google interprète cette combinaison ~équivalente à un 410 réel pour la
 * désindexation (signal "this URL is gone", confirmé par John Mueller). Le code
 * V2 ajoutera un middleware Edge + lookup Redis-edge pour vrai 410. À ce jour
 * le patch garde Bing/Yandex/Perplexity capable de désindexer via IndexNow
 * ping `URL_DELETED` envoyé en parallèle (cf. audit P0-6 + P0-8).
 */

import { prisma } from "@/lib/prisma";

export interface ArticleTombstone {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly isNews: boolean;
  readonly archivedAt: Date;
  readonly status: "archived" | "draft";
  readonly reason: "archived" | "rolled_back";
}

/**
 * Cherche un article disparu (archived ou rollback draft) par slug FR.
 * Retourne `null` si introuvable (true 404) ou si l'article est toujours
 * publié (le caller appelle d'abord findArticleBySlug, ce helper est un
 * fallback explicite).
 */
export async function findArticleTombstone(slug: string): Promise<ArticleTombstone | null> {
  const t = await prisma.articleTranslation.findFirst({
    where: {
      slug,
      locale: "fr",
      article: {
        status: { in: ["archived", "draft"] },
      },
    },
    include: { article: true },
  });
  if (!t) return null;
  return {
    id: t.article.id,
    slug: t.slug,
    title: t.title,
    isNews: t.article.isNews,
    archivedAt: t.article.updatedAt,
    status: t.article.status === "archived" ? "archived" : "draft",
    reason: t.article.status === "archived" ? "archived" : "rolled_back",
  };
}
