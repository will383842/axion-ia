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
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { parseFaqItems } from "@/server/content-gen/shared/faq-items";

/** Vue unifiée d'un article — shape consommée par la route /blog/[slug]. */
export interface BlogArticleView {
  readonly slug: string;
  readonly title: string;
  /** SEO `<title>` override (V-07 sprint UX 2026-05-22). null = fallback `title`. */
  readonly metaTitle: string | null;
  /** SEO meta description override (160 chars max). null = fallback `excerpt`. */
  readonly metaDescription: string | null;
  readonly excerpt: string;
  readonly body: string;
  readonly publishedAt: string;
  readonly updatedAt: string | null;
  readonly readingTime: string;
  readonly author: string;
  readonly category: string;
  /** Slug de la catégorie pour lier le hub `/blog/categorie/{slug}` (null si aucune). */
  readonly categorySlug: string | null;
  /** Slug de la ville ancrée pour le lien retour vers `/implantations` (null si aucune). */
  readonly villeSlug: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly tier: "tier-1-indexable" | "tier-2-noindex-follow" | "tier-3-noindex-nofollow";
  readonly source: "db" | "fs";
  /**
   * P2-3 — URL de l'image hero (Article.featuredImage DB String? ou null pour FS).
   * Utilisée par /blog/[slug] pour le rendu <Image priority> (LCP critique).
   * null = pas d'image hero disponible (articles FS ou articles DB sans image).
   */
  readonly featuredImage: string | null;
  /** VIS-08 — Alt sémantique de l'image hero (image-bank). null si absent. */
  readonly featuredImageAlt: string | null;
  /** VIS-03 — Réponse directe (snippet 0 / featured snippet). null si absente. */
  readonly directAnswer: string | null;
  /** Attribution photographe (CGU Unsplash §6 — obligatoire si photo Unsplash). */
  readonly photographerName: string | null;
  readonly photographerUrl: string | null;
  /** Sources citées (ContentCitation DB) — émises en isBasedOn JSON-LD. */
  readonly citations: ReadonlyArray<{ name: string; url: string }>;
  /**
   * FAQ structurée (Article.faqJson). Écrite par les generators mais jamais
   * rendue avant le chantier templates 2026-06-21 → alimente l'accordéon FAQ
   * `<ArticleFaq>` + le schéma FAQPage. Vide pour les articles FS legacy.
   */
  readonly faqItems: ReadonlyArray<{ question: string; answer: string }>;
  /** « Point clé » (Article.keyTakeaway) — encadré distinct du directAnswer. null si vide. */
  readonly keyTakeaway: string | null;
  /** Citation d'expert nommé (Article.expertQuote*). null si non renseignée. */
  readonly expertQuote: { name: string; title: string | null; text: string } | null;
  /** Référence brute FS — utilisée pour les `related` qui restent FS V1. */
  readonly fsPost: BlogPost | null;
}

function adaptFsPostToView(post: BlogPost, locale: Locale): BlogArticleView {
  const copy = post[locale];
  return {
    slug: post.slug,
    title: copy.title,
    metaTitle: null,
    metaDescription: null,
    excerpt: copy.excerpt,
    body: copy.body,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt ?? null,
    readingTime: post.readingTime,
    author: post.author,
    category: post.category,
    categorySlug: slugify(post.category),
    villeSlug: null,
    tags: post.tags,
    tier: resolveTier(post),
    source: "fs",
    // P2-3 — Les articles FS (hardcodés) n'ont pas d'image hero.
    featuredImage: null,
    featuredImageAlt: null,
    directAnswer: null,
    photographerName: null,
    photographerUrl: null,
    citations: [],
    faqItems: [],
    keyTakeaway: null,
    expertQuote: null,
    fsPost: post,
  };
}

function isoDate(d: Date | null | undefined): string {
  // Audit fraîcheur 2026-06-08 : fallback DÉTERMINISTE (date éditoriale figée,
  // sync avec SITE_EDITORIAL_DATE de @/lib/seo) au lieu de `new Date()`, qui
  // datait un article DB sans publishedAt/updatedAt au timestamp du build.
  if (!d) return "2026-06-08";
  return d.toISOString().slice(0, 10);
}

/**
 * VIS-02 — Mappe l'enum Prisma `IndexationTier` (underscore) vers le format
 * dash consommé par `BlogArticleView.tier` / le `<meta robots>` de la page.
 * Défaut sûr : tier-2-noindex-follow (si tier absent — ex. KnowledgeEntry).
 */
function mapIndexationTier(
  tier: "tier_1_indexable" | "tier_2_noindex_follow" | "tier_3_noindex_nofollow" | undefined | null,
): BlogArticleView["tier"] {
  switch (tier) {
    case "tier_1_indexable":
      return "tier-1-indexable";
    case "tier_3_noindex_nofollow":
      return "tier-3-noindex-nofollow";
    case "tier_2_noindex_follow":
    default:
      return "tier-2-noindex-follow";
  }
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
    const [rawCitations, imageAsset, catTags] = await Promise.all([
      prisma.contentCitation
        .findMany({
          where: { articleId: dbArticle.id },
          include: { externalReference: { select: { url: true, title: true } } },
        })
        .catch(() => []),
      // CGU Unsplash §6 — lookup photographe depuis ImageAsset par filePath
      // (cas image-bank uniquement ; pour une hero Unsplash hotlinkée — URL http —
      // le crédit est porté directement par l'Article, pas par un ImageAsset).
      dbArticle.featuredImage && !dbArticle.featuredImage.startsWith("http")
        ? prisma.imageAsset
            .findFirst({
              where: { filePath: { contains: dbArticle.featuredImage.split("/").pop() ?? "" } },
              select: { photographerName: true, photographerUrl: true, sourceType: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      // Catégorisation 2026-06-16 — catégorie réelle (serviceSector→Category) + tags persistés.
      prisma.article
        .findUnique({
          where: { id: dbArticle.id },
          select: {
            category: { select: { nameFr: true, slug: true } },
            tags: { select: { tag: { select: { nameFr: true } } } },
            // Chantier templates 2026-06-21 — FAQ structurée (écrite par les
            // generators, jamais rendue jusqu'ici). Alimente <ArticleFaq>.
            faqJson: true,
            // Point clé + citation expert (champs réels, rendus si remplis).
            keyTakeaway: true,
            expertQuoteName: true,
            expertQuoteTitle: true,
            expertQuoteText: true,
          },
        })
        .catch(() => null),
    ]);
    return {
      slug: dbArticle.slug,
      title: dbArticle.title,
      metaTitle: dbArticle.metaTitle,
      metaDescription: dbArticle.metaDescription,
      excerpt: dbArticle.excerpt ?? "",
      body: dbArticle.body ?? dbArticle.bodyText ?? "",
      publishedAt: isoDate(dbArticle.publishedAt),
      updatedAt: dbArticle.updatedAt ? isoDate(dbArticle.updatedAt) : null,
      readingTime: estimateReadingTimeFromBody(dbArticle.body ?? dbArticle.bodyText ?? ""),
      author: "Manon",
      // Catégorisation 2026-06-16 — catégorie réelle (dérivée du serviceSector) + tags persistés.
      category: catTags?.category?.nameFr ?? "Cas d'usage",
      categorySlug: catTags?.category?.slug ?? null,
      villeSlug: dbArticle.mentionedCities?.[0] ?? null,
      tags: catTags?.tags.map((t) => t.tag.nameFr) ?? [],
      // VIS-02 (audit visibilité 2026-06-05) — dérive le tier RÉEL de l'Article
      // (avant : hardcodé tier-2 → un article promu tier-1 restait noindex alors
      // qu'il était au sitemap = jamais indexé). KnowledgeEntry n'expose pas le
      // tier → défaut sûr tier-2-noindex-follow.
      tier: mapIndexationTier(dbArticle.indexationTier),
      source: "db",
      // P2-3 — Image hero DB article (Article.featuredImage String?).
      featuredImage: dbArticle.featuredImage ?? null,
      // VIS-08 — Alt sémantique image-bank (fallback titre côté page si null).
      featuredImageAlt: dbArticle.featuredImageAlt ?? null,
      // VIS-03 — Snippet 0 généré (fallback excerpt côté page si null).
      directAnswer: dbArticle.directAnswer ?? null,
      // CGU Unsplash §6 — attribution photographe. Priorité au crédit porté par
      // l'Article (hero Unsplash hotlinkée, Option A 2026-06-16) ; fallback sur
      // l'ImageAsset (hero image-bank de source Unsplash). null sinon.
      photographerName:
        dbArticle.featuredImagePhotographerName ??
        (imageAsset?.sourceType === "unsplash" ? (imageAsset.photographerName ?? null) : null),
      photographerUrl:
        dbArticle.featuredImagePhotographerUrl ??
        (imageAsset?.sourceType === "unsplash" ? (imageAsset.photographerUrl ?? null) : null),
      citations: rawCitations.map((c) => ({
        name: c.externalReference.title,
        url: c.externalReference.url,
      })),
      faqItems: parseFaqItems(catTags?.faqJson),
      keyTakeaway: catTags?.keyTakeaway ?? null,
      expertQuote:
        catTags?.expertQuoteName && catTags?.expertQuoteText
          ? {
              name: catTags.expertQuoteName,
              title: catTags.expertQuoteTitle ?? null,
              text: catTags.expertQuoteText,
            }
          : null,
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
    metaTitle: null,
    metaDescription: null,
    excerpt: a.excerpt ?? "",
    body: "",
    publishedAt: isoDate(a.publishedAt),
    updatedAt: null,
    readingTime: a.readingTime ? `${a.readingTime} min` : "5 min",
    author: a.author?.name ?? "Manon",
    category: a.category?.name ?? "Cas d'usage",
    categorySlug: a.category?.slug ?? null,
    villeSlug: null,
    tags: [],
    tier: "tier-2-noindex-follow",
    source: "db",
    // P2-3 — Index n'expose pas featuredImage (non sélectionné dans listPublishedArticles).
    featuredImage: null,
    // VIS-08/03 — La vue liste n'a pas besoin de l'alt ni du directAnswer (détail page).
    featuredImageAlt: null,
    directAnswer: null,
    photographerName: null,
    photographerUrl: null,
    citations: [],
    faqItems: [],
    keyTakeaway: null,
    expertQuote: null,
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

/** Lien minimal vers un article (titre + href interne). */
export interface ArticleLink {
  readonly title: string;
  readonly href: string;
}

/**
 * Refonte templates 2026-06-22 — article précédent/suivant (maillage séquentiel,
 * `<ArticlePrevNext>`). Cherche les voisins chronologiques dans la MÊME catégorie
 * (fallback : tous les articles si la catégorie en compte moins de 2). La liste
 * `loadBlogIndexForView` est triée par date DESC : voisin plus récent = suivant,
 * plus ancien = précédent. Retourne `{ prev: null, next: null }` si l'article est
 * introuvable (le composant ne rend alors rien).
 */
export async function loadAdjacentArticles(
  currentSlug: string,
  locale: Locale,
  categorySlug: string | null,
): Promise<{ prev: ArticleLink | null; next: ArticleLink | null }> {
  const all = await loadBlogIndexForView(locale).catch(() => []);
  const scoped =
    categorySlug != null ? all.filter((a) => a.categorySlug === categorySlug) : [...all];
  const list = scoped.length >= 2 ? scoped : all;
  const idx = list.findIndex((a) => a.slug === currentSlug);
  if (idx === -1) return { prev: null, next: null };
  const toLink = (a: BlogArticleView | undefined): ArticleLink | null =>
    a ? { title: a.title, href: `/blog/${a.slug}` } : null;
  return {
    // Liste DESC : index+1 = plus ancien (précédent), index-1 = plus récent (suivant).
    prev: toLink(list[idx + 1]),
    next: toLink(list[idx - 1]),
  };
}

/**
 * Refonte 2026-06-22 — précédent/suivant pour /guides et /actualites (parité
 * /blog). Adjacence chronologique au sein du MÊME type (news ou guides). Le H1
 * de la page = la route ; on génère donc des href `/actualites/<slug>` ou
 * `/guides/<slug>`. Retourne `{ prev:null, next:null }` si introuvable.
 */
export async function loadAdjacentArticlesByType(
  currentSlug: string,
  locale: Locale,
  type: "news" | "guides",
): Promise<{ prev: ArticleLink | null; next: ArticleLink | null }> {
  const rows = await prisma.articleTranslation
    .findMany({
      where: {
        locale,
        article: { status: "published", ...(type === "news" ? { isNews: true } : {}) },
        ...(type === "guides" ? { slug: { startsWith: "guide-" } } : {}),
      },
      select: { slug: true, title: true, article: { select: { publishedAt: true } } },
      orderBy: { article: { publishedAt: "desc" } },
      take: 300,
    })
    .catch(() => []);
  const idx = rows.findIndex((r) => r.slug === currentSlug);
  if (idx === -1) return { prev: null, next: null };
  const seg = type === "news" ? "actualites" : "guides";
  const toLink = (r: (typeof rows)[number] | undefined): ArticleLink | null =>
    r ? { title: r.title, href: `/${seg}/${r.slug}` } : null;
  // Liste DESC : index+1 = plus ancien (précédent), index-1 = plus récent (suivant).
  return { prev: toLink(rows[idx + 1]), next: toLink(rows[idx - 1]) };
}

/**
 * Refonte templates 2026-06-22 — « People Also Ask » (`<ArticlePeopleAlsoAsk>`).
 * Distinct de la FAQ inline ET des « articles connexes » : ce sont de VRAIES
 * questions issues des FAQ d'AUTRES articles publiés (indexables), chaque
 * question pointant vers la page où elle est répondue. Renforce le maillage
 * interne thématique. Vide si aucune FAQ exploitable (composant non rendu).
 */
export async function loadPeopleAlsoAsk(
  currentSlug: string,
  locale: Locale,
  limit = 5,
): Promise<ReadonlyArray<{ question: string; href: string }>> {
  const rows = await prisma.articleTranslation
    .findMany({
      where: {
        locale,
        slug: { not: currentSlug },
        article: { status: "published", indexationTier: { not: "tier_3_noindex_nofollow" } },
      },
      // Refonte 2026-06-22 — sélectionne le discriminant de type pour router le
      // href vers le bon segment (le href était hardcodé /blog/<slug> → 404 pour
      // les items actualites/guides). News = isNews ; guide = slug `guide-*`.
      select: { slug: true, article: { select: { faqJson: true, isNews: true } } },
      orderBy: { article: { publishedAt: "desc" } },
      take: 24,
    })
    .catch(() => []);
  const out: Array<{ question: string; href: string }> = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const faq = parseFaqItems(r.article?.faqJson);
    const first = faq[0];
    if (!first) continue;
    const key = first.question.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ question: first.question.trim(), href: hrefForArticle(r.slug, r.article?.isNews) });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Refonte 2026-06-22 — construit le href interne d'un article selon son type.
 * Discriminants (cf. prisma `Article`) : `isNews` → segment `/actualites`,
 * slug préfixé `guide-` → `/guides`, sinon (défaut sûr) → `/blog`.
 */
function hrefForArticle(slug: string, isNews: boolean | null | undefined): string {
  if (isNews) return `/actualites/${slug}`;
  if (slug.startsWith("guide-")) return `/guides/${slug}`;
  return `/blog/${slug}`;
}
