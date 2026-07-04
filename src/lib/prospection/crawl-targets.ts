// SSOT — Cibles du mini-crawl 2 passes du site public d'une entreprise (T1).
//
// Module Prospection. On ne crawle JAMAIS tout le site : uniquement les 2-3 pages
// qui contiennent réellement les coordonnées (passe A) et les responsables
// (passe B). Budgets par défaut ici, surchargables via `SiteSetting` catégorie
// `prospection` (02-SPEC §4/§6, 07-DECISIONS Q10). Pur, aucune I/O.

/** Passe A — pages coordonnées (email/téléphone). Mentions légales = meilleure source. */
export const CONTACT_PAGE_PATHS: readonly string[] = [
  "/mentions-legales",
  "/mentions-legales/",
  "/contact",
  "/nous-contacter",
  "/contactez-nous",
  "/contact/",
  "/coordonnees",
  "/informations-legales",
  "/legal",
];

/** Passe B — pages « équipe / direction » (responsables de secteur). */
export const TEAM_PAGE_PATHS: readonly string[] = [
  "/equipe",
  "/notre-equipe",
  "/notre-cabinet",
  "/direction",
  "/qui-sommes-nous",
  "/a-propos",
  "/associes",
  "/nos-experts",
  "/organigramme",
  "/l-agence",
  "/team",
  "/about",
  "/notre-histoire",
  "/nos-collaborateurs",
];

/**
 * Libellés de liens de menu à suivre en passe B (profondeur ≤ 2). Comparés au
 * texte normalisé (minuscule, sans accents) du lien.
 */
export const TEAM_MENU_LABEL_HINTS: readonly string[] = [
  "equipe",
  "direction",
  "qui sommes nous",
  "a propos",
  "notre cabinet",
  "associes",
  "nos experts",
  "organigramme",
  "collaborateurs",
];

/** Secteurs où la passe B (responsables) est activée par défaut (cabinets/agences). */
export const TEAM_ENRICH_DEFAULT_SECTEURS: readonly string[] = ["droit", "sante", "conseil", "btp"];

/** Budgets de crawl par défaut (surchargables via SiteSetting). */
export const DEFAULT_CRAWL_BUDGET = {
  /** Passe A : nb max de pages coordonnées. */
  maxPagesContact: 3,
  /** Passe B : nb max de pages personnes RÉCUPÉRÉES (200 OK). */
  maxPagesPersonnes: 4,
  /**
   * Plafond global de pages RÉCUPÉRÉES (200 OK) par entreprise. Doit couvrir
   * Passe A (≤ maxPagesContact+1) + Passe B (≤ maxPagesPersonnes) sinon la Passe B
   * est affamée (réconciliation adversariale T5 D1). Les 404 ne comptent PAS.
   */
  maxPagesEntreprise: 10,
  /** Passe B : nb max de chemins équipe TENTÉS (la plupart renvoient 404). */
  maxTeamAttempts: 6,
  /** Profondeur max de suivi de liens en passe B. */
  maxDepthPersonnes: 2,
  /** Timeout par page (ms). */
  pageTimeoutMs: 8000,
  /** Taille max téléchargée par page (octets). */
  maxBytesPerPage: 2 * 1024 * 1024,
  /** Délai de politesse entre 2 requêtes au même domaine (ms) si robots.txt muet. */
  defaultCrawlDelayMs: 1000,
} as const;

export type CrawlBudget = typeof DEFAULT_CRAWL_BUDGET;

/** User-agent identifiable du mini-crawl prospection. */
export const PROSPECTION_CRAWLER_USER_AGENT = "Axion-IA-Prospection";
