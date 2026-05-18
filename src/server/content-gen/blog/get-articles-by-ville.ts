/**
 * getBlogArticlesByVille — Articles DB filter par ville mentionnée.
 *
 * Sprint S+2 City Domination — Phase C strat ville (cohérence pages ville
 * perfection 2026). Helper server-only utilisé par le hub ville
 * `/implantations/[region]/[ville]` pour afficher la section "Articles blog
 * mentionnant {ville}".
 *
 * Différence vs `getRelatedBlogPosts(ville)` (lib/geo.ts) :
 *   - `getRelatedBlogPosts` : filesystem-based, scan BLOG_POSTS const array
 *     (legacy V1 blog FS). Tags + relatedCities matching.
 *   - `getBlogArticlesByVille` : DB-based, query Article model via le nouveau
 *     champ `mentionedCities[]` (peuplé au publish). Couvre les articles
 *     factory content-gen (~10K cible 12 mois).
 *
 * Cohabitation : le hub ville charge les 2 et merge dedup par titre/slug.
 *
 * Performance : index GIN `articles_mentioned_cities_idx` rend la query
 * `WHERE 'paris' = ANY(mentioned_cities)` O(log n) (~5 ms sur 10K rows).
 */

import { prisma } from "@/lib/prisma";

export interface BlogArticleByVilleResult {
  readonly id: string;
  readonly slug: string;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly title: string;
  readonly excerpt: string | null;
}

/**
 * Retourne les articles publiés tier-1 indexable qui mentionnent la ville.
 *
 * @param villeSlug - slug ville (ex: "paris", "boulogne-billancourt")
 * @param locale - "fr" | "en" (canonical FR, EN miroir)
 * @param limit - max articles (default 3 pour hub ville)
 * @returns Articles triés par publishedAt DESC (les plus récents en premier)
 */
export async function getBlogArticlesByVille(
  villeSlug: string,
  locale: "fr" | "en",
  limit = 3,
): Promise<ReadonlyArray<BlogArticleByVilleResult>> {
  try {
    const rows = await prisma.article.findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        // Postgres `text[] @> ARRAY['paris']` via Prisma `has` (array containment).
        mentionedCities: { has: villeSlug },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        publishedAt: true,
        updatedAt: true,
        translations: {
          where: { locale },
          select: { slug: true, title: true, excerpt: true },
          take: 1,
        },
      },
    });

    return rows
      .map((row) => {
        const t = row.translations[0];
        if (!t || !t.slug) return null;
        return {
          id: row.id,
          slug: t.slug,
          publishedAt: row.publishedAt,
          updatedAt: row.updatedAt,
          title: t.title,
          excerpt: t.excerpt,
        };
      })
      .filter((x): x is BlogArticleByVilleResult => x !== null);
  } catch {
    // Fail-soft : P2021 (table absente bootstrap), DB down, etc.
    // Le hub ville ne doit jamais crasher faute d'articles DB.
    return [];
  }
}
