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
import { prisma } from "@/lib/prisma";

/** Type d'article surfacé en suggestion (segment public correspondant). */
export type RelatedArticleType = "blog" | "guides" | "news";

export interface RelatedArticleItem {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly category: string | null;
  readonly publishedAt: string;
  readonly readingTime: string;
  readonly source: "db" | "fs";
  /**
   * Refonte 2026-06-22 — type d'article (pour router le href cross-type côté
   * consommateur). ADDITIF : optionnel, `undefined` = item blog legacy (les
   * appelants existants peuvent l'ignorer → comportement inchangé).
   */
  readonly type?: RelatedArticleType;
  /**
   * Refonte hubs 2026-07-04 — miniature Unsplash (Article.featuredImage) pour la
   * carte SuggestedContent variant `articles`. ADDITIF/optionnel : items FS legacy
   * ou articles sans hero → absent (spread conditionnel, jamais `undefined`).
   */
  readonly imageUrl?: string;
  readonly imageAlt?: string;
}

interface FindRelatedOptions {
  readonly currentSlug: string;
  readonly currentCategory?: string | null;
  readonly locale: Locale;
  readonly limit?: number;
  /** Tier filter : exclut tier-2/tier-3 par défaut (anti-doorway HCU). */
  readonly tier1Only?: boolean;
  /**
   * Titre de l'article courant (audit maillage 2026-07-03). Si fourni, la
   * sélection est ordonnée par PERTINENCE (recouvrement de mots-clés du titre)
   * et non plus seulement par catégorie + date — utile car beaucoup d'articles
   * partagent la catégorie fourre-tout « Cas d'usage » (tri catégorie inopérant).
   * ADDITIF : sans ce champ, comportement inchangé (catégorie puis date desc).
   */
  readonly currentTitle?: string;
  /**
   * Refonte 2026-06-22 — types d'articles à inclure (maillage cross-type).
   * ADDITIF : si absent (défaut), comportement strictement inchangé = articles
   * blog (DB via `listPublishedArticles` + FS legacy). Si fourni, on requête
   * directement la table `articleTranslation` filtrée sur les types demandés :
   *   - `news`   → Article.isNews = true        → segment `/actualites`
   *   - `guides` → slug préfixé `guide-`        → segment `/guides`
   *   - `blog`   → ni news ni guide             → segment `/blog`
   */
  readonly articleTypes?: ReadonlyArray<RelatedArticleType>;
}

/** Segment public d'un article selon son type (utilisé par les consommateurs cross-type). */
export function segmentForArticleType(type: RelatedArticleType): "blog" | "guides" | "actualites" {
  if (type === "news") return "actualites";
  if (type === "guides") return "guides";
  return "blog";
}

const RELATED_STOPWORDS = new Set([
  "les",
  "des",
  "une",
  "pour",
  "avec",
  "dans",
  "sur",
  "par",
  "aux",
  "vos",
  "nos",
  "que",
  "qui",
  "the",
  "and",
  "with",
  "for",
  "your",
  "comment",
  "pourquoi",
  "quel",
  "quelle",
  "quels",
  "quelles",
]);

/** Mots de contenu (≥4 lettres, hors stopwords) d'un titre, en minuscules. */
function titleTokens(title: string | null | undefined): Set<string> {
  if (!title) return new Set();
  const out = new Set<string>();
  for (const raw of title.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^\p{L}\p{N}-]/gu, "");
    if (w.length >= 4 && !RELATED_STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

/**
 * Trie les suggestions par pertinence (audit maillage 2026-07-03) :
 *   1. recouvrement de mots-clés du titre (si `currentTitle` fourni) — desc,
 *   2. même catégorie prioritaire,
 *   3. date de publication desc.
 * Sans `currentTitle`, dégénère en (catégorie, date) = comportement historique.
 */
function sortByRelevance<T extends { category: string | null; title: string; publishedAt: string }>(
  items: T[],
  currentCategory: string | null | undefined,
  currentTitle: string | undefined,
): T[] {
  const base = currentTitle ? titleTokens(currentTitle) : null;
  const overlap = (title: string): number => {
    if (!base || base.size === 0) return 0;
    let n = 0;
    for (const tok of titleTokens(title)) if (base.has(tok)) n++;
    return n;
  };
  return [...items].sort((a, b) => {
    const ov = overlap(b.title) - overlap(a.title);
    if (ov !== 0) return ov;
    if (currentCategory) {
      const aSame = a.category === currentCategory ? 0 : 1;
      const bSame = b.category === currentCategory ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
    }
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/**
 * Trouve articles connexes (DB + FS merged, tri catégorie + date).
 * Tier-1 only par défaut (anti-doorway HCU 2024 — pas de noindex en suggested).
 */
export async function findRelatedArticles(opts: FindRelatedOptions): Promise<RelatedArticleItem[]> {
  const {
    currentSlug,
    currentCategory,
    locale,
    limit = 4,
    tier1Only = true,
    articleTypes,
    currentTitle,
  } = opts;

  // Refonte 2026-06-22 — chemin cross-type OPT-IN. Si `articleTypes` est fourni,
  // on requête directement `articleTranslation` filtrée sur les types demandés
  // (le chemin par défaut `listPublishedArticles` ne distingue pas blog/news/
  // guides). ADDITIF : sans ce param, on tombe dans le chemin historique ci-dessous.
  if (articleTypes && articleTypes.length > 0) {
    return findRelatedCrossType({
      currentSlug,
      currentCategory: currentCategory ?? null,
      locale,
      limit,
      tier1Only,
      articleTypes,
      // exactOptionalPropertyTypes : n'inclure la clé que si définie.
      ...(currentTitle !== undefined ? { currentTitle } : {}),
    });
  }

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
        // Audit maillage 2026-07-03 — porte le `type` pour router le href côté
        // consommateur. `listPublishedArticles` exclut les news → seul le préfixe
        // `guide-` discrimine ; sans ça un guide sortait en href /blog/guide-x → 308.
        type: a.slug.startsWith("guide-") ? ("guides" as const) : ("blog" as const),
        // Refonte hubs 2026-07-04 — miniature (spread conditionnel exactOptional).
        ...(a.featuredImage ? { imageUrl: a.featuredImage } : {}),
        ...(a.featuredImageAlt ? { imageAlt: a.featuredImageAlt } : {}),
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
        type: "blog" as const,
      };
    });

  // Étape 3 : dédup par slug (DB gagne)
  const byslug = new Map<string, RelatedArticleItem>();
  for (const item of fsItems) byslug.set(item.slug, item);
  for (const item of dbItems) byslug.set(item.slug, item); // DB override
  const merged = [...byslug.values()];

  // Étape 4 : tri par pertinence (recouvrement titre → catégorie → date desc).
  return sortByRelevance(merged, currentCategory, currentTitle).slice(0, limit);
}

/**
 * Refonte 2026-06-22 — variante cross-type de `findRelatedArticles`. Surface des
 * articles de plusieurs types (blog / guides / actualites) via une seule requête
 * `articleTranslation`. Chaque item porte son `type` pour que le consommateur
 * route le href vers le bon segment (cf. `segmentForArticleType`). Renvoie []
 * sur erreur (stub Proxy build-time inclus).
 */
async function findRelatedCrossType(opts: {
  currentSlug: string;
  currentCategory: string | null;
  locale: Locale;
  limit: number;
  tier1Only: boolean;
  articleTypes: ReadonlyArray<RelatedArticleType>;
  currentTitle?: string;
}): Promise<RelatedArticleItem[]> {
  const { currentSlug, currentCategory, locale, limit, tier1Only, articleTypes, currentTitle } =
    opts;
  const wantBlog = articleTypes.includes("blog");
  const wantGuides = articleTypes.includes("guides");
  const wantNews = articleTypes.includes("news");

  try {
    const rows = await prisma.articleTranslation.findMany({
      where: {
        locale,
        slug: { not: currentSlug },
        article: {
          status: "published",
          // Anti-doorway HCU : tier-1 only par défaut (cohérent avec le chemin standard).
          ...(tier1Only ? { indexationTier: "tier_1_indexable" } : {}),
        },
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        article: {
          select: {
            isNews: true,
            readingTime: true,
            publishedAt: true,
            featuredImage: true,
            featuredImageAltFr: true,
            category: { select: { nameFr: true, nameEn: true } },
          },
        },
      },
      orderBy: { article: { publishedAt: "desc" } },
      take: 200,
    });

    const items: RelatedArticleItem[] = [];
    for (const r of rows) {
      const isNews = r.article?.isNews === true;
      const isGuide = !isNews && r.slug.startsWith("guide-");
      const type: RelatedArticleType = isNews ? "news" : isGuide ? "guides" : "blog";
      // Filtre sur les types demandés.
      if (type === "blog" && !wantBlog) continue;
      if (type === "guides" && !wantGuides) continue;
      if (type === "news" && !wantNews) continue;
      const cat = r.article?.category;
      items.push({
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt ?? "",
        category: cat ? (locale === "fr" ? cat.nameFr : cat.nameEn) : null,
        publishedAt: r.article?.publishedAt?.toISOString().slice(0, 10) ?? "",
        readingTime: r.article?.readingTime ? `${r.article.readingTime} min` : "",
        source: "db",
        type,
        ...(r.article?.featuredImage ? { imageUrl: r.article.featuredImage } : {}),
        ...(r.article?.featuredImageAltFr ? { imageAlt: r.article.featuredImageAltFr } : {}),
      });
    }

    // Tri par pertinence (recouvrement titre → catégorie → date), parité standard.
    return sortByRelevance(items, currentCategory, currentTitle).slice(0, limit);
  } catch {
    // Stub Proxy build-time / DB indispo → retour []
    return [];
  }
}
