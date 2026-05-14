/**
 * Content Generator — Blog loader unifié (Sprint 8 V2).
 *
 * Source de vérité pour les pages `/blog/[slug]` et `/blog` :
 *   1. DB first : `findArticleBySlug` / `listPublishedArticles` (table Article
 *      ou KnowledgeEntry selon feature flag KB_BACKEND_UNIFIED_ARTICLE).
 *   2. Fallback FS : `getBlogPost` / `BLOG_POSTS` (legacy, 3 articles hardcodés).
 *
 * Retourne une vue unifiée `BlogArticleView` que la page consomme sans avoir
 * à brancher elle-même DB vs FS. Permet aussi la migration progressive : on
 * peut indexer un article en DB qui était en FS, sans casser le routing.
 */

import type { Locale } from "@/i18n/routing";
import { BLOG_POSTS, getBlogPost } from "@/content/transversal";
import type { BlogPost } from "@/content/blog";
import { resolveTier } from "@/content/blog";
import { findArticleBySlug, listPublishedArticles } from "@/lib/knowledge/readers";

/** Vue unifiée d'un article — shape consommée par la route /blog/[slug]. */
export interface BlogArticleView {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly body: string;
  readonly publishedAt: string;
  readonly updatedAt: string | null;
  readonly readingTime: string;
  readonly author: string;
  readonly category: string;
  readonly tags: ReadonlyArray<string>;
  readonly tier: "tier-1-indexable" | "tier-2-noindex-follow" | "tier-3-noindex-nofollow";
  readonly source: "db" | "fs";
  /** Référence brute FS — utilisée pour les `related` qui restent FS V1. */
  readonly fsPost: BlogPost | null;
}

function adaptFsPostToView(post: BlogPost, locale: Locale): BlogArticleView {
  const copy = post[locale];
  return {
    slug: post.slug,
    title: copy.title,
    excerpt: copy.excerpt,
    body: copy.body,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt ?? null,
    readingTime: post.readingTime,
    author: post.author,
    category: post.category,
    tags: post.tags,
    tier: resolveTier(post),
    source: "fs",
    fsPost: post,
  };
}

function isoDate(d: Date | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Charge un article par slug, DB-first avec fallback FS.
 * Retourne `null` si introuvable dans les deux sources.
 */
export async function loadBlogArticleForView(
  slug: string,
  locale: Locale,
): Promise<BlogArticleView | null> {
  const dbArticle = await findArticleBySlug(slug, locale).catch(() => null);
  if (dbArticle) {
    return {
      slug: dbArticle.slug,
      title: dbArticle.title,
      excerpt: dbArticle.excerpt ?? "",
      body: dbArticle.body ?? dbArticle.bodyText ?? "",
      publishedAt: isoDate(dbArticle.publishedAt),
      updatedAt: dbArticle.updatedAt ? isoDate(dbArticle.updatedAt) : null,
      readingTime: estimateReadingTimeFromBody(dbArticle.body ?? dbArticle.bodyText ?? ""),
      author: "Manon",
      category: "Cas d'usage",
      tags: [],
      tier: "tier-2-noindex-follow",
      source: "db",
      fsPost: null,
    };
  }

  const fsPost = getBlogPost(slug);
  if (fsPost) return adaptFsPostToView(fsPost, locale);

  return null;
}

/**
 * Liste les articles publiés, fusion DB + FS, dédupliqués par slug
 * (DB prioritaire si conflit). Tri par publishedAt DESC.
 */
export async function loadBlogIndexForView(
  locale: Locale,
): Promise<ReadonlyArray<BlogArticleView>> {
  const dbList = await listPublishedArticles(locale).catch(() => []);
  const fsList = BLOG_POSTS.map((p) => adaptFsPostToView(p, locale));

  const dbSlugs = new Set(dbList.map((a) => a.slug));
  const fsKept = fsList.filter((v) => !dbSlugs.has(v.slug));

  const dbAsView: BlogArticleView[] = dbList.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt ?? "",
    body: "",
    publishedAt: isoDate(a.publishedAt),
    updatedAt: null,
    readingTime: a.readingTime ? `${a.readingTime} min` : "5 min",
    author: a.author?.name ?? "Manon",
    category: a.category?.name ?? "Cas d'usage",
    tags: [],
    tier: "tier-2-noindex-follow",
    source: "db",
    fsPost: null,
  }));

  const merged = [...dbAsView, ...fsKept];
  return merged.sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1));
}

/** Estimation lecture (200 mots/min, retour string « N min »). */
function estimateReadingTimeFromBody(body: string): string {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min`;
}
