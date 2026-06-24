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
  /** Miniature 16/9 (Article.featuredImage) — null si l'article n'a pas de hero. */
  readonly featuredImage: string | null;
  /** Alt sémantique de la miniature (Article.featuredImageAlt per-locale). */
  readonly featuredImageAlt: string | null;
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

/**
 * Nombre d'articles publiés (non-news) par slug de catégorie de blog content-gen.
 * Une seule requête `groupBy` (hub `/blog/categorie`). Stub-safe (ADR 0026) :
 * au build `stub.invalid` la DB renvoie [] → toutes les catégories à 0, l'ISR
 * (revalidate 3600) repeuple sous 1 h. Les catégories sans article restent
 * listées par le hub (compte 0) — la liste des 5 est stable, pas dérivée de la DB.
 */
export async function getBlogCategoryCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(
    BLOG_CATEGORY_SLUGS.map((slug) => [slug, 0]),
  );
  const cats = await prisma.category
    .findMany({ where: { slug: { in: [...BLOG_CATEGORY_SLUGS] } }, select: { id: true, slug: true } })
    .catch(() => []);
  if (cats.length === 0) return counts;
  const idToSlug = new Map(cats.map((c) => [c.id, c.slug]));
  const grouped = await prisma.article
    .groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: cats.map((c) => c.id) },
        status: "published",
        isNews: false,
      },
      _count: { _all: true },
    })
    .catch(() => [] as Array<{ categoryId: string | null; _count: { _all: number } }>);
  for (const row of grouped) {
    const slug = row.categoryId ? idToSlug.get(row.categoryId) : undefined;
    if (slug) counts[slug] = row._count._all;
  }
  return counts;
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
        featuredImage: true,
        featuredImageAltFr: true,
        featuredImageAltEn: true,
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
        route: resolveArticleRoute({
          isNews: a.isNews,
          templateVariant: a.templateVariant,
          slug: t.slug,
        }),
        featuredImage: a.featuredImage ?? null,
        featuredImageAlt: (locale === "fr" ? a.featuredImageAltFr : a.featuredImageAltEn) ?? null,
      },
    ];
  });
}
