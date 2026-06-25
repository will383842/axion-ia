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
import type { Prisma } from "../../../prisma/generated/client";

/**
 * Sous-ensemble du PrismaClient suffisant pour `recordSlugChange` : permet de
 * passer soit le client global, soit un `tx` de transaction (atomicité avec
 * l'update du slug côté caller). Typé minimalement pour rester compatible des
 * deux.
 */
type SlugHistoryClient = {
  articleSlugHistory: {
    upsert: (args: Prisma.ArticleSlugHistoryUpsertArgs) => Promise<unknown>;
  };
};

export interface RecordSlugChangeInput {
  readonly articleId: string;
  readonly oldSlug: string;
  readonly newSlug: string;
  readonly locale: "fr" | "en";
  readonly reason?: string;
}

/**
 * SSOT (2026-06-25) — enregistre un changement de slug d'article dans
 * `ArticleSlugHistory` pour que les routes publiques `/fr/blog/[slug]` et
 * `/fr/actualites/[slug]` redirigent l'ANCIEN slug en 301 (au lieu d'un 404).
 *
 * Idempotent :
 *   - no-op si `oldSlug === newSlug` (aucun rename réel) ;
 *   - upsert sur la clé naturelle `@@unique([oldLocale, oldSlug])` → réappeler
 *     avec le même ancien slug ne crée pas de doublon (re-publish / retry BullMQ).
 *
 * À appeler depuis TOUS les chemins qui mutent le slug d'un article (publish,
 * refresh/régénération, edit admin). Accepte un `client` optionnel (un `tx`
 * Prisma) pour s'exécuter dans la même transaction que l'update du slug.
 *
 * Le ping IndexNow (ancien URL `URL_DELETED` + nouveau `URL_UPDATED`) reste à la
 * charge du caller (cf. `updateArticle` dans article.ts).
 */
export async function recordSlugChange(
  input: RecordSlugChangeInput,
  client: SlugHistoryClient = prisma as unknown as SlugHistoryClient,
): Promise<void> {
  const { articleId, oldSlug, newSlug, locale, reason } = input;
  // Idempotence #1 — aucun rename réel : rien à historiser.
  if (!oldSlug || oldSlug === newSlug) return;
  // Idempotence #2 — upsert sur (oldLocale, oldSlug) : re-publish / retry ne
  // duplique pas. On rattache toujours à l'article courant (l'ancien slug peut
  // avoir migré d'un article à l'autre dans des cas limites).
  await client.articleSlugHistory.upsert({
    where: { oldLocale_oldSlug: { oldLocale: locale, oldSlug } },
    create: {
      articleId,
      oldSlug,
      oldLocale: locale,
      ...(reason ? { reason } : {}),
    },
    update: {
      articleId,
      ...(reason ? { reason } : {}),
    },
  });
}

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
