// Barrel + helpers content factory blog (Sprint 14.10, 2026-05-08).
//
// Architecture : 1 fichier par article dans `posts/<slug>.ts` (anticipation
// volume 100K+ articles via outil de génération externe). Migration Prisma
// DB obligatoire Sprint 15+ quand volume > 5K.
//
// Le barrel ré-exporte `BLOG_POSTS` (compat existing code dans transversal.ts
// + sitemap + pages /blog/*).

import type {
  BlogPost,
  IndexationTier,
  BlogSector,
  BlogCompanySize,
  BlogServiceType,
  BlogFormat,
} from "./types";

import { slugify } from "@/lib/slug";

export type {
  BlogPost,
  BlogPostCopy,
  BlogFaqItem,
  BlogCategory,
  BlogSector,
  BlogCompanySize,
  BlogServiceType,
  BlogFormat,
  IndexationTier,
} from "./types";

/**
 * Liste exhaustive des articles. Sert au sitemap, à `/blog`, aux pages
 * taxonomies, et à `getRelatedBlogPosts(ville)` pour le maillage villes.
 *
 * Quand le volume dépasse ~5K articles, migrer vers Prisma DB (Sprint 15+).
 * Le barrel restera exposé en helper pour rétrocompat avec le rendering SSG.
 */
// Vidé le 2026-07-03 (audit blog) : les 3 posts FS legacy
// (pourquoi-auditer-avant-implementer, 3-quick-wins-2026, ia-custom-quand-vraiment)
// existaient AUSSI en base (stubs thin ~400 car.) qui les masquaient (loader
// DB-first). Ils ont été régénérés/enrichis en base (8-10 k car.) avec de
// nouveaux slugs keyword-rich ; garder les fichiers FS ré-affichait l'ancien
// contenu thin à l'ancienne URL au lieu de 301 vers l'article enrichi
// (loader.ts consulte le FS AVANT le redirect slug-history). Tout le blog est
// désormais piloté par la DB (Article/ArticleTranslation).
export const BLOG_POSTS: ReadonlyArray<BlogPost> = [];

// ============================================================================
// Tier resolver — anti-doorway HCU 2024 strict
// ============================================================================

/**
 * Calcule le tier d'indexation effectif d'un post. Utilise `indexationTier`
 * explicite si fourni, sinon dérive du qualityScore + word count + faq count
 * + promotedAt. Conservatif par défaut : tier-2 (noindex follow) tant qu'aucun
 * signal positif clair.
 */
export function resolveTier(post: BlogPost): IndexationTier {
  if (post.indexationTier) return post.indexationTier;

  const wordCount = countWords(post.fr.body);
  const score = post.qualityScore ?? 0;
  const faqCount = post.fr.faq?.length ?? 0;
  const hasDirectAnswer = !!post.fr.directAnswer && countWords(post.fr.directAnswer) >= 40;
  const promoted = !!post.promotedAt;

  // Tier-3 : drafts manifestes ou low-quality détecté
  if (score < 40 || wordCount < 400) return "tier-3-noindex-nofollow";

  // Tier-1 : qualité validée ET signaux positifs ET (promotion explicite OU score haut + tous critères)
  if (
    score >= 70 &&
    wordCount >= 800 &&
    hasDirectAnswer &&
    faqCount >= 4 &&
    (promoted || score >= 80)
  ) {
    return "tier-1-indexable";
  }

  // Tier-2 par défaut : crawlable mais pas indexé
  return "tier-2-noindex-follow";
}

export function isTier1(post: BlogPost): boolean {
  return resolveTier(post) === "tier-1-indexable";
}

export function isIndexable(post: BlogPost): boolean {
  return resolveTier(post) === "tier-1-indexable";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// Helpers d'accès — articles & slugs
// ============================================================================

const SLUG_INDEX = new Map(BLOG_POSTS.map((p) => [p.slug, p] as const));

export function getBlogPost(slug: string): BlogPost | undefined {
  return SLUG_INDEX.get(slug);
}

export function getAllBlogSlugs(): ReadonlyArray<string> {
  return BLOG_POSTS.map((p) => p.slug);
}

/** Articles tier-1 uniquement (sitemap, listing /blog par défaut). */
export function getIndexableBlogPosts(): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter(isIndexable);
}

// ============================================================================
// Helpers taxonomies — pages d'index
// ============================================================================

// slugify importé depuis @/lib/slug (SSOT V-10 2026-05-22).

// --- Catégorie ---
export function getAllBlogCategorySlugs(): ReadonlyArray<string> {
  const cats = new Set(BLOG_POSTS.map((p) => slugify(p.category)));
  return [...cats];
}
export function getBlogPostsByCategory(slug: string): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => slugify(p.category) === slug);
}
export function getBlogCategoryLabel(slug: string): string | undefined {
  const found = BLOG_POSTS.find((p) => slugify(p.category) === slug);
  return found?.category;
}

// --- Tag ---
export function getAllBlogTagSlugs(): ReadonlyArray<string> {
  const tags = new Set<string>();
  BLOG_POSTS.forEach((p) => p.tags.forEach((t) => tags.add(slugify(t))));
  return [...tags];
}
export function getBlogPostsByTag(slug: string): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => p.tags.some((t) => slugify(t) === slug));
}

// --- Auteur ---
export function getAllBlogAuthorSlugs(): ReadonlyArray<string> {
  const authors = new Set(BLOG_POSTS.map((p) => slugify(p.author)));
  return [...authors];
}
export function getBlogPostsByAuthor(slug: string): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => slugify(p.author) === slug);
}

export function getBlogAuthorLabel(slug: string): string | undefined {
  const found = BLOG_POSTS.find((p) => slugify(p.author) === slug);
  return found?.author;
}

// --- NEW : Secteur ---
export function getAllBlogSectorSlugs(): ReadonlyArray<BlogSector> {
  const sectors = new Set<BlogSector>();
  BLOG_POSTS.forEach((p) => p.sectors?.forEach((s) => sectors.add(s)));
  return [...sectors];
}
export function getBlogPostsBySector(slug: BlogSector): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => p.sectors?.includes(slug));
}

// --- NEW : Taille entreprise ---
export function getAllBlogCompanySizeSlugs(): ReadonlyArray<BlogCompanySize> {
  const sizes = new Set<BlogCompanySize>();
  BLOG_POSTS.forEach((p) => p.companySizes?.forEach((s) => sizes.add(s)));
  return [...sizes];
}
export function getBlogPostsByCompanySize(slug: BlogCompanySize): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => p.companySizes?.includes(slug));
}

// --- NEW : Service ---
export function getAllBlogServiceTypeSlugs(): ReadonlyArray<BlogServiceType> {
  const services = new Set<BlogServiceType>();
  BLOG_POSTS.forEach((p) => p.serviceTypes?.forEach((s) => services.add(s)));
  return [...services];
}
export function getBlogPostsByServiceType(slug: BlogServiceType): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => p.serviceTypes?.includes(slug));
}

// --- NEW : Format ---
export function getBlogPostsByFormat(format: BlogFormat): ReadonlyArray<BlogPost> {
  return BLOG_POSTS.filter((p) => p.format === format);
}

// ============================================================================
// Helpers labels lisibles (pour rendering page)
// ============================================================================

const SECTOR_LABELS_FR: Record<BlogSector, string> = {
  industrie: "Industrie",
  comptabilite: "Comptabilité & expertise",
  juridique: "Juridique",
  "banque-finance": "Banque & finance",
  conseil: "Conseil",
  sante: "Santé",
  retail: "Retail",
  ecommerce: "E-commerce",
  logistique: "Logistique",
  "agro-alimentaire": "Agro-alimentaire",
  tech: "Tech",
  saas: "SaaS",
  tourisme: "Tourisme",
  education: "Éducation",
  immobilier: "Immobilier",
  autre: "Autre",
};
const SECTOR_LABELS_EN: Record<BlogSector, string> = {
  industrie: "Industry",
  comptabilite: "Accounting & expertise",
  juridique: "Legal",
  "banque-finance": "Banking & finance",
  conseil: "Consulting",
  sante: "Health",
  retail: "Retail",
  ecommerce: "E-commerce",
  logistique: "Logistics",
  "agro-alimentaire": "Agri-food",
  tech: "Tech",
  saas: "SaaS",
  tourisme: "Tourism",
  education: "Education",
  immobilier: "Real estate",
  autre: "Other",
};

export function getSectorLabel(sector: BlogSector, locale: "fr" | "en"): string {
  return (locale === "fr" ? SECTOR_LABELS_FR : SECTOR_LABELS_EN)[sector];
}

// Classification INSEE officielle (4 tailles) — cf. types.ts.
const SIZE_LABELS_FR: Record<BlogCompanySize, string> = {
  tpe: "TPE",
  pme: "PME",
  eti: "ETI",
  "grande-entreprise": "Grande entreprise",
};
const SIZE_LABELS_EN: Record<BlogCompanySize, string> = {
  tpe: "Micro-business",
  pme: "SME",
  eti: "Mid-cap",
  "grande-entreprise": "Large enterprise",
};

export function getCompanySizeLabel(size: BlogCompanySize, locale: "fr" | "en"): string {
  return (locale === "fr" ? SIZE_LABELS_FR : SIZE_LABELS_EN)[size];
}

const SERVICE_LABELS_FR: Record<BlogServiceType, string> = {
  audit: "Audit IA",
  interventions: "Interventions IA",
  implementation: "Implémentation IA",
};
const SERVICE_LABELS_EN: Record<BlogServiceType, string> = {
  audit: "AI audit",
  interventions: "AI sessions",
  implementation: "AI implementation",
};

export function getServiceTypeLabel(service: BlogServiceType, locale: "fr" | "en"): string {
  return (locale === "fr" ? SERVICE_LABELS_FR : SERVICE_LABELS_EN)[service];
}

// === Slugify exposé pour les pages /blog/categorie /blog/tag etc. ===
export { slugify };
