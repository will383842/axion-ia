/**
 * Content Generator — Constants UI (Pass B P2-11).
 *
 * Source de vérité unique pour les labels FR + couleurs sémantiques + icônes
 * dérivés des enums Prisma content-gen. Évite la duplication inline dans
 * chaque page admin.
 *
 * Convention :
 *   - Chaque enum Prisma a sa map `XXX_LABELS_FR` (string → string FR).
 *   - Les statuts de pipeline ont une map `XXX_VARIANT` (string → variant
 *     sémantique pour les badges UI : neutral | running | success | warning | danger).
 *   - Aucun import Prisma direct ici (Edge runtime safe — usable depuis
 *     Server Components ET Client Components).
 *
 * Doctrine § 21 : FR uniquement (admin reste FR-only).
 */

// ────────────────────────────────────────────────────────────────────────────
// ContentType
// ────────────────────────────────────────────────────────────────────────────

export const CONTENT_TYPE_LABELS_FR: Record<string, string> = {
  landing_ville: "Page ville",
  blog_article: "Article de blog",
  blog_from_rss: "Article RSS (actualité)",
  blog_from_keywords: "Article (depuis mots-clés)",
  blog_from_title: "Article (depuis titre)",
  comparison: "Comparatif",
  guide_pilier: "Guide pilier",
  qa_derived: "Q/R dérivée",
  faq_standalone: "FAQ autonome",
};

export const CONTENT_TYPE_PIPELINE_FR: Record<string, "P1" | "P2" | "P3"> = {
  landing_ville: "P1",
  blog_from_rss: "P2",
  blog_article: "P3",
  blog_from_keywords: "P3",
  blog_from_title: "P3",
  comparison: "P3",
  guide_pilier: "P3",
  qa_derived: "P3",
  faq_standalone: "P3",
};

// ────────────────────────────────────────────────────────────────────────────
// ContentGenJobStatus
// ────────────────────────────────────────────────────────────────────────────

export const JOB_STATUS_LABELS_FR: Record<string, string> = {
  queued: "En file d'attente",
  running: "En cours",
  generating_text: "Génération texte",
  generating_image: "Génération image",
  running_qa: "Contrôle qualité",
  quality_improving: "Amélioration qualité",
  needs_review: "Attente revue",
  approved: "Approuvé",
  publishing: "Publication",
  published: "Publié",
  failed: "Échec",
  cancelled: "Annulé",
};

export const JOB_STATUS_VARIANT: Record<
  string,
  "neutral" | "running" | "success" | "warning" | "danger"
> = {
  queued: "neutral",
  running: "running",
  generating_text: "running",
  generating_image: "running",
  running_qa: "running",
  quality_improving: "running",
  needs_review: "warning",
  approved: "success",
  publishing: "running",
  published: "success",
  failed: "danger",
  cancelled: "neutral",
};

// ────────────────────────────────────────────────────────────────────────────
// IndexationTier
// ────────────────────────────────────────────────────────────────────────────

export const TIER_LABELS_FR: Record<string, string> = {
  tier_1_indexable: "Tier 1 — indexable",
  tier_2_noindex_follow: "Tier 2 — noindex follow",
  tier_3_noindex_nofollow: "Tier 3 — noindex nofollow",
};

export const TIER_SHORT_FR: Record<string, string> = {
  tier_1_indexable: "T1",
  tier_2_noindex_follow: "T2",
  tier_3_noindex_nofollow: "T3",
};

// ────────────────────────────────────────────────────────────────────────────
// ProviderKey / ProviderRole
// ────────────────────────────────────────────────────────────────────────────

export const PROVIDER_LABELS_FR: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  perplexity: "Perplexity",
  unsplash: "Unsplash",
  gpt_image: "GPT Image (désactivé V1)",
};

export const PROVIDER_ROLE_LABELS_FR: Record<string, string> = {
  text: "Texte",
  image: "Image générée",
  data: "Données (recherche)",
  stock_image: "Image stock",
  rerank: "Re-ranking",
};

// ────────────────────────────────────────────────────────────────────────────
// ReviewStatus
// ────────────────────────────────────────────────────────────────────────────

export const REVIEW_STATUS_LABELS_FR: Record<string, string> = {
  pending: "Attente revue",
  approved: "Approuvé",
  rejected: "Rejeté",
  needs_edits: "Modifications demandées",
  promoted_t1: "Promu Tier 1",
};

export const REVIEW_STATUS_VARIANT: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  needs_edits: "warning",
  promoted_t1: "success",
};

// ────────────────────────────────────────────────────────────────────────────
// CoverageStatus / CoverageScope
// ────────────────────────────────────────────────────────────────────────────

export const COVERAGE_STATUS_LABELS_FR: Record<string, string> = {
  draft: "Brouillon",
  queued: "En file d'attente",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
  failed: "Échec",
  cancelled: "Annulée",
  scheduled: "Planifiée",
};

export const COVERAGE_STATUS_VARIANT: Record<
  string,
  "neutral" | "running" | "success" | "warning" | "danger"
> = {
  draft: "neutral",
  queued: "neutral",
  running: "running",
  paused: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
  scheduled: "neutral",
};

export const COVERAGE_SCOPE_LABELS_FR: Record<string, string> = {
  ville: "Ville",
  departement: "Département",
  region: "Région",
  multi: "Multi-scope",
};

// ────────────────────────────────────────────────────────────────────────────
// SearchIntent
// ────────────────────────────────────────────────────────────────────────────

export const SEARCH_INTENT_LABELS_FR: Record<string, string> = {
  informational: "Informationnelle",
  commercial_investigation: "Commerciale (comparaison)",
  transactional: "Transactionnelle",
  navigational: "Navigationnelle",
  local: "Locale",
};

// ────────────────────────────────────────────────────────────────────────────
// WebVitalMetric / WebVitalRating
// ────────────────────────────────────────────────────────────────────────────

export const WEB_VITAL_METRIC_LABELS_FR: Record<string, string> = {
  LCP: "LCP (chargement)",
  INP: "INP (interactivité)",
  CLS: "CLS (stabilité visuelle)",
  FCP: "FCP (premier rendu)",
  TTFB: "TTFB (réponse serveur)",
  TBT: "TBT (blocage total)",
};

export const WEB_VITAL_RATING_LABELS_FR: Record<string, string> = {
  good: "Bon",
  needs_improvement: "À améliorer",
  poor: "Mauvais",
};

export const WEB_VITAL_RATING_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  good: "success",
  needs_improvement: "warning",
  poor: "danger",
};

// ────────────────────────────────────────────────────────────────────────────
// OrganisationType (audit 2026-05-15 P2-25)
// ────────────────────────────────────────────────────────────────────────────

export const ORGANISATION_TYPE_LABELS_FR: Record<string, string> = {
  entreprise_privee: "Entreprise privée",
  ecole: "École",
  universite: "Université",
  mairie: "Mairie",
  collectivite: "Collectivité",
  hopital: "Hôpital",
  association: "Association",
  comite_entreprise: "Comité d'entreprise",
  opco: "OPCO",
  carsat: "CARSAT",
  etablissement_public: "Établissement public",
  autre: "Autre",
};

// ────────────────────────────────────────────────────────────────────────────
// CompanySize (INSEE — audit 2026-05-15 P2-25)
// ────────────────────────────────────────────────────────────────────────────

export const COMPANY_SIZE_LABELS_FR: Record<string, string> = {
  TPE: "TPE (1-9 salariés)",
  PME: "PME (10-249 salariés)",
  ETI: "ETI (250-4 999 salariés)",
  GRANDE_ENTREPRISE: "Grande entreprise (≥ 5 000 salariés)",
};

// ────────────────────────────────────────────────────────────────────────────
// TrustTier (citations §9bis.5bis — audit 2026-05-15 P2-25)
// ────────────────────────────────────────────────────────────────────────────

export const TRUST_TIER_LABELS_FR: Record<string, string> = {
  official: "Officielle (.gouv, .fr ETS publics)",
  high: "Haute (presse établie, recherche académique)",
  standard: "Standard (médias spécialisés, blogs experts)",
  low: "Faible (forum, blog perso)",
  excluded: "Exclue (banlist)",
};

export const TRUST_TIER_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  official: "success",
  high: "success",
  standard: "neutral",
  low: "warning",
  excluded: "danger",
};

// ────────────────────────────────────────────────────────────────────────────
// LogLevel (GenerationLog — audit 2026-05-15 P2-25)
// ────────────────────────────────────────────────────────────────────────────

export const LOG_LEVEL_LABELS_FR: Record<string, string> = {
  debug: "Debug",
  info: "Info",
  warn: "Warning",
  error: "Erreur",
};

export const LOG_LEVEL_VARIANT: Record<string, "neutral" | "running" | "warning" | "danger"> = {
  debug: "neutral",
  info: "running",
  warn: "warning",
  error: "danger",
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Retourne le label FR ou la clé brute en fallback (`unknown_status_X` reste lisible). */
export function getLabelFr<K extends string>(
  map: Record<string, string>,
  key: K | string | null | undefined,
): string {
  if (!key) return "—";
  return map[key] ?? key;
}
