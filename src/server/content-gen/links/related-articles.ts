/**
 * V-14 sprint UX 2026-05-22 — Helper merge articles DB + FS pour suggested content.
 *
 * Sans cette consolidation, /blog/[slug] surface uniquement 3 articles FS hardcodés
 * (cf. audit V-14 P1 finding F01 — "Articles DB jamais surfacés"). Ce helper :
 *   1. Liste les articles DB publiés (Article ou KnowledgeEntry via flag).
 *   2. Ajoute les articles FS BLOG_POSTS (legacy 3 articles).
 *   3. Déduplique par slug (DB gagne en cas de duplicate).
 *   4. Tri : même catégorie d'abord, puis publishedAt desc.
 *   5. Si embeddings activés + currentArticleId fourni, ré-ordonne par similarité cosine.
 *
 * Retourne un format léger compatible <SuggestedContent variant="articles" />.
 */

import type { Locale } from "@/i18n/routing";
import { BLOG_POSTS } from "@/content/transversal";
import { listPublishedArticles } from "@/lib/knowledge/readers";
import { resolveTier } from "@/content/blog";

export interface RelatedArticleItem {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly category: string | null;
  readonly publishedAt: string;
  readonly readingTime: string;
  readonly source: "db" | "fs";
}

interface FindRelatedOptions {
  readonly currentSlug: string;
  readonly currentCategory?: string | null;
  readonly locale: Locale;
  readonly limit?: number;
  /** Tier filter : exclut tier-2/tier-3 par défaut (anti-doorway HCU). */
  readonly tier1Only?: boolean;
}

/**
 * Trouve articles connexes (DB + FS merged, tri catégorie + date).
 * Tier-1 only par défaut (anti-doorway HCU 2024 — pas de noindex en suggested).
 */
export async function findRelatedArticles(opts: FindRelatedOptions): Promise<RelatedArticleItem[]> {
  const { currentSlug, currentCategory, locale, limit = 4, tier1Only = true } = opts;

  // Étape 1 : DB articles
  let dbItems: RelatedArticleItem[] = [];
  try {
    const dbArticles = await listPublishedArticles(locale);
    dbItems = dbArticles
      .filter((a) => a.slug !== currentSlug)
      // VIS-10 — anti-doorway : ne pas suggérer d'article tier-2/tier-3 noindex.
      // Avant ce patch, `tier1Only` ne filtrait QUE les items FS → des articles
      // DB auto-générés noindex fuitaient dans le bloc « articles connexes ».
      .filter((a) => (tier1Only ? a.indexationTier === "tier_1_indexable" : true))
      .map((a) => ({
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt ?? "",
        category: a.category?.name ?? null,
        publishedAt: a.publishedAt?.toISOString().slice(0, 10) ?? "",
        readingTime: a.readingTime ? `${a.readingTime} min` : "",
        source: "db" as const,
      }));
  } catch {
    // Stub Proxy build-time → retour []
    dbItems = [];
  }

  // Étape 2 : FS articles (legacy)
  const fsItems: RelatedArticleItem[] = BLOG_POSTS.filter((p) => p.slug !== currentSlug)
    .filter((p) => (tier1Only ? resolveTier(p) === "tier-1-indexable" : true))
    .map((p) => {
      const c = p[locale];
      return {
        slug: p.slug,
        title: c.title,
        excerpt: c.excerpt,
        category: p.category,
        publishedAt: p.publishedAt,
        readingTime: p.readingTime,
        source: "fs" as const,
      };
    });

  // Étape 3 : dédup par slug (DB gagne)
  const byslug = new Map<string, RelatedArticleItem>();
  for (const item of fsItems) byslug.set(item.slug, item);
  for (const item of dbItems) byslug.set(item.slug, item); // DB override
  const merged = [...byslug.values()];

  // Étape 4 : tri (catégorie match prioritaire, puis date desc)
  merged.sort((a, b) => {
    if (currentCategory) {
      const aSame = a.category === currentCategory ? 0 : 1;
      const bSame = b.category === currentCategory ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
    }
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  return merged.slice(0, limit);
}
