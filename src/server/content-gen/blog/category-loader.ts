// Chargement DB des articles par catégorie de blog (catégorisation 2026-06-16).
// Les pages /blog/categorie/[slug] fusionnent ces articles content-gen (DB) avec
// les articles file-system existants (transversal.ts) — sans régression FS.
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/routing";
import { BLOG_CATEGORY_SLUGS } from "@/server/content-gen/lib/category-mapper";
import { getAllBlogCategorySlugs } from "@/content/transversal";
import {
  resolveArticleRoute,
  isRoutableArticleSlug,
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

/**
 * SOURCE UNIQUE DE VÉRITÉ des slugs de catégorie réellement RENDABLES par la route
 * /blog/categorie/[slug] : slugs FS legacy + les 5 slugs DB content-gen. C'est
 * exactement l'ensemble pré-généré par `generateStaticParams` (dynamicParams=false).
 *
 * ⚠️ Tout consommateur qui construit un lien `/blog/categorie/<slug>` (hub /blog,
 * fil d'Ariane de /blog/[slug], etc.) DOIT filtrer sur cet ensemble, sinon un slug
 * hors-ensemble (ex. catégorie seed `blog-strategie`/`blog-cas-usage`/`blog-roi`
 * attachée à un article publié) produit un lien 404. Cf. incident 2026-07-11.
 *
 * Pur / stub-safe (ADR 0026) : aucune requête DB, dérivé de constantes.
 */
export function getRenderableBlogCategorySlugs(): ReadonlySet<string> {
  return new Set<string>([...getAllBlogCategorySlugs(), ...DB_BLOG_CATEGORY_SLUGS]);
}

/** Un slug de catégorie de blog a-t-il une page rendable (sinon → 404) ? */
export function isRenderableBlogCategorySlug(slug: string): boolean {
  return getRenderableBlogCategorySlugs().has(slug);
}

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
    .findMany({
      where: { slug: { in: [...BLOG_CATEGORY_SLUGS] } },
      select: { id: true, slug: true },
    })
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

/**
 * Date ISO (YYYY-MM-DD) du dernier article de blog mis à jour, toutes catégories
 * confondues — signal de fraîcheur `dateModified` pour le hub `/blog/categorie`
 * (audit SEO/AEO 2026-06-25). Stub-safe (ADR 0026) : DB vide / build stub → null
 * (le hub n'émet alors pas de `dateModified`). Préfère `updatedAt` (dernière
 * révision) ; ne considère que les articles publiés non-news.
 */
export async function getBlogLatestArticleDate(): Promise<string | null> {
  const cats = await prisma.category
    .findMany({
      where: { slug: { in: [...BLOG_CATEGORY_SLUGS] } },
      select: { id: true },
    })
    .catch(() => []);
  if (cats.length === 0) return null;
  const agg = await prisma.article
    .aggregate({
      where: {
        categoryId: { in: cats.map((c) => c.id) },
        status: "published",
        isNews: false,
      },
      _max: { updatedAt: true },
    })
    .catch(() => null);
  const max = agg?._max.updatedAt;
  return max ? max.toISOString().slice(0, 10) : null;
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
    // Garde-fou 2026-07-11 : un slug à slash 404 (route à segment unique) → ne pas
    // le lister ici (sinon la tuile catégorie pointe vers un 404). Cf.
    // isRoutableArticleSlug. Correctif racine = slug plat en DB.
    if (!isRoutableArticleSlug(t.slug)) return [];
    return [
      {
        slug: t.slug,
        title: t.title,
        excerpt: t.excerpt ?? "",
        // Date seule (YYYY-MM-DD) : affichée telle quelle dans <time> par
        // ArticleCard (audit SEO 2026-06-24 — évite l'ISO brut « …T07:00:00.000Z »
        // visible à l'écran) ; reste un datePublished valide en JSON-LD.
        publishedAt: a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "",
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
