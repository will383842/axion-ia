// Chargement DB des articles par catégorie de blog (catégorisation 2026-06-16).
// Les pages /blog/categorie/[slug] fusionnent ces articles content-gen (DB) avec
// les articles file-system existants (transversal.ts) — sans régression FS.
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/routing";
import { BLOG_CATEGORY_SLUGS } from "@/server/content-gen/lib/category-mapper";
import {
  resolveArticleRoute,
  type ArticleRouteSegment,
} from "@/server/content-gen/blog/resolve-article-route";

export interface BlogCategoryArticle {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly publishedAt: string;
  readonly readingTime: string;
  readonly route: ArticleRouteSegment;
}

/** Slugs des 5 catégories de blog content-gen (mappées aux ServiceSector). */
export const DB_BLOG_CATEGORY_SLUGS: ReadonlyArray<string> = BLOG_CATEGORY_SLUGS;

/** Label (nameFr/nameEn) d'une catégorie DB, ou null si inconnue. */
export async function getDbCategoryLabel(slug: string, locale: Locale): Promise<string | null> {
  const cat = await prisma.category
    .findUnique({ where: { slug }, select: { nameFr: true, nameEn: true } })
    .catch(() => null);
  if (!cat) return null;
  return locale === "fr" ? cat.nameFr : cat.nameEn;
}

/** Articles content-gen publiés (non-news) d'une catégorie, traduits dans `locale`. */
export async function getDbArticlesByCategorySlug(
  slug: string,
  locale: Locale,
): Promise<BlogCategoryArticle[]> {
  const cat = await prisma.category
    .findUnique({ where: { slug }, select: { id: true } })
    .catch(() => null);
  if (!cat) return [];
  const rows = await prisma.article
    .findMany({
      where: { categoryId: cat.id, status: "published", isNews: false },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        readingTime: true,
        publishedAt: true,
        isNews: true,
        templateVariant: true,
        translations: {
          where: { locale },
          select: { slug: true, title: true, excerpt: true },
          take: 1,
        },
      },
    })
    .catch(() => []);
  return rows.flatMap((a) => {
    const t = a.translations[0];
    if (!t) return [];
    return [
      {
        slug: t.slug,
        title: t.title,
        excerpt: t.excerpt ?? "",
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : "",
        readingTime: a.readingTime ? `${a.readingTime} min` : "6 min",
        route: resolveArticleRoute({ isNews: a.isNews, templateVariant: a.templateVariant }),
      },
    ];
  });
}
