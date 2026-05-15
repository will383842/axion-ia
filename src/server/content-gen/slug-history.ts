/**
 * Article slug history — lookup helper pour redirect 301.
 *
 * Audit indexation 2026-05-15 P0-5. Cf. table `ArticleSlugHistory` Prisma.
 *
 * Doctrine : à chaque rename slug Article (blog/actualites), une ligne est
 * créée ici par `updateArticle()`/`upsertArticleAction()`. Les pages
 * `/fr/blog/[slug]` et `/fr/actualites/[slug]` consultent cette table en
 * fallback `notFound()` avant Tombstone et redirigent en 301 vers le slug
 * courant. Sans ce mécanisme, un rename slug = perte SEO accumulée totale
 * (audit avant patch : `findRedirectFromHistory` KB existait mais code mort
 * côté Article — pas de consumer dans les routes publiques).
 *
 * Le ping IndexNow ANCIEN URL en `URL_DELETED` + NOUVEAU URL en `URL_UPDATED`
 * est géré par le caller (cf. `updateArticle` dans article.ts).
 */

import { prisma } from "@/lib/prisma";

export interface ArticleSlugRedirect {
  readonly newSlug: string;
  readonly isNews: boolean;
}

/**
 * Cherche un slug historique (FR-only V1) et renvoie le slug actuel pour
 * redirect 301. Retourne `null` si aucune entrée d'historique.
 */
export async function findArticleSlugRedirect(
  oldSlug: string,
  locale: "fr" | "en",
): Promise<ArticleSlugRedirect | null> {
  const history = await prisma.articleSlugHistory.findFirst({
    where: { oldSlug, oldLocale: locale },
    include: {
      article: {
        include: {
          translations: { where: { locale }, take: 1, select: { slug: true } },
        },
      },
    },
  });
  if (!history) return null;
  const currentTranslation = history.article.translations[0];
  if (!currentTranslation) return null;
  // Ne redirige que si l'article est encore publié (sinon Tombstone le rendra).
  if (history.article.status !== "published") return null;
  return {
    newSlug: currentTranslation.slug,
    isNews: history.article.isNews,
  };
}

/**
 * Crée une ligne d'historique slug. À appeler dans la transaction de rename
 * (avant l'update du slug pour preserver l'ancien). Le caller doit aussi
 * pinger IndexNow ANCIEN URL en `URL_DELETED` + NOUVEAU en `URL_UPDATED`.
 */
export async function recordArticleSlugChange(
  articleId: string,
  oldSlug: string,
  oldLocale: "fr" | "en",
  reason?: string,
): Promise<void> {
  await prisma.articleSlugHistory.create({
    data: {
      articleId,
      oldSlug,
      oldLocale,
      ...(reason ? { reason } : {}),
    },
  });
}
