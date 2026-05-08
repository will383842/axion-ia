// Types canoniques content factory AxionIA — Sprint 14.10 (2026-05-08).
// Documentés dans `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md`.
//
// Décisions Will 2026-05-08 :
//   1. Volume cible 100K+ articles → architecture anticipe Prisma DB Sprint 15+
//   2. Pyramide indexation 3 tiers (anti-doorway HCU 2024 strict)
//   3. URL plate `/blog/<slug>` avec filtres URL `?service=...`
//   4. Q/R atomiques groupées en FAQ embed (Speakable JSON-LD), pas de page
//      individuelle par Q/R (sauf promotion future depuis Search Console)
//
// L'outil de génération externe (Will) DOIT produire des objets `BlogPost`
// conformes à ce type. Le script `pnpm posts:validate` valide chaque commit.

// === Taxonomies (5 dimensions) ===

export type BlogCategory =
  | "Audit IA"
  | "Interventions"
  | "Implémentation"
  | "Cas d'usage"
  | "Méthodologie"
  | "Stratégie"
  | "Outils"
  | "Tendances";

export type BlogSector =
  | "industrie"
  | "comptabilite"
  | "juridique"
  | "banque-finance"
  | "conseil"
  | "sante"
  | "retail"
  | "ecommerce"
  | "logistique"
  | "agro-alimentaire"
  | "tech"
  | "saas"
  | "tourisme"
  | "education"
  | "immobilier"
  | "autre";

/**
 * Tailles d'entreprise — classification INSEE officielle (4 catégories).
 *   - `tpe`               : Micro-entreprise (< 10 salariés, CA < 2 M€)
 *   - `pme`               : Petite/moyenne entreprise (10-249 salariés, CA < 50 M€)
 *   - `eti`               : Entreprise de taille intermédiaire (250-4999, CA < 1500 M€)
 *   - `grande-entreprise` : Grande entreprise / grand compte (5000+, CA > 1500 M€)
 *
 * Sprint 14.10.1 (2026-05-08) : alignement INSEE strict (auparavant 5 valeurs
 * dont `gme` et `grand-compte` non standards). Cohérent avec recherches Google
 * naturelles (« audit IA pour ETI », « formation IA grande entreprise »).
 */
export type BlogCompanySize = "tpe" | "pme" | "eti" | "grande-entreprise";

export type BlogServiceType = "audit" | "interventions" | "implementation";

export type BlogFormat =
  | "article"
  | "comparatif"
  | "guide"
  | "cas-pratique"
  | "interview"
  | "veille"
  | "tribune";

// === Pyramide indexation (3 tiers anti-doorway HCU 2024) ===

export type IndexationTier =
  | "tier-1-indexable" // Validé, dans sitemap, meta robots index
  | "tier-2-noindex-follow" // Bulk en attente review, crawlable mais pas indexé
  | "tier-3-noindex-nofollow"; // Drafts ou low-quality, pas de signal

// === FAQ embed (Speakable JSON-LD) ===

export interface BlogFaqItem {
  /** Question 8-15 mots. */
  q: string;
  /** Réponse 30-100 mots. Speakable-friendly (phrase claire, pas de balisage). */
  a: string;
}

// === Copy localisé FR + EN ===

export interface BlogPostCopy {
  /** Titre 50-70 chars optimisé SEO (Google tronque à ~60). */
  title: string;
  /** Excerpt 120-180 chars optimisé meta description. */
  excerpt: string;
  /**
   * Direct answer 40-80 mots citable LLMs (Perplexity / Claude.ai / Google AI
   * Overviews). Apparaît juste après le H1, sert de teaser indexable + AEO.
   * **Obligatoire** pour tier-1.
   */
  directAnswer?: string;
  /** Body markdown ou string structured (templates de rendu Sprint 14.10+). */
  body: string;
  /** FAQ embed — 4-12 Q/R atomiques. Active FAQPage Speakable JSON-LD. */
  faq?: ReadonlyArray<BlogFaqItem>;
  /** Hero image alt-text (a11y + SEO). */
  heroAlt?: string;
  /** Mots-clés primaires (max 3). Sert au scoring qualité automatique. */
  primaryKeywords?: ReadonlyArray<string>;
}

// === Entité principale BlogPost ===

export interface BlogPost {
  // --- Identification ---
  /** Slug FR-canonique kebab-case ASCII unique. Sert de clé. */
  slug: string;
  /** Date de publication ISO. */
  publishedAt: string;
  /** Date de dernière révision ISO. Signal AEO 2026 (Google AI Overviews valorise freshness). */
  updatedAt?: string;
  /** Estimation lecture (ex "8 min"). */
  readingTime: string;
  /** Auteur affiché. */
  author: string;
  /** Catégorie principale (1 valeur). */
  category: BlogCategory;

  // --- Taxonomies multi-dim ---
  /** Tags libres pour groupage transversal (~3-8 par article). */
  tags: ReadonlyArray<string>;
  /** Secteurs métiers ciblés (NAF). Optionnel. */
  sectors?: ReadonlyArray<BlogSector>;
  /** Tailles entreprise ciblées. Optionnel. */
  companySizes?: ReadonlyArray<BlogCompanySize>;
  /** Types de prestation AxionIA traités. Optionnel. */
  serviceTypes?: ReadonlyArray<BlogServiceType>;
  /** Slugs villes liées (cf. `src/content/villes/`). Optionnel. */
  relatedCities?: ReadonlyArray<string>;
  /** Slugs régions liées (cf. `src/content/regions.ts`). Optionnel. */
  relatedRegions?: ReadonlyArray<string>;
  /** Format éditorial. */
  format: BlogFormat;

  // --- Indexation ---
  /**
   * Tier d'indexation. Si non fourni, calculé automatiquement par
   * `resolveTier()` à partir de `qualityScore` + word count + faq count.
   * Default conservatif = `tier-2-noindex-follow`.
   */
  indexationTier?: IndexationTier;
  /** Score qualité 0-100 (calculé par l'outil de génération). */
  qualityScore?: number;
  /**
   * Date de promotion vers tier-1 (validation Will ou critère auto-promotion).
   * Si absente et pas de tier explicite, l'article reste tier-2.
   */
  promotedAt?: string;

  // --- Contenu ---
  fr: BlogPostCopy;
  en: BlogPostCopy;
}
