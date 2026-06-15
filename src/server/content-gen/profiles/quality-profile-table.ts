/**
 * Content Generator — Routeur de PROFILS QUALITÉ par type de contenu (PH1).
 *
 * Issu du plan `_AUDIT/PLAN-CONTENT-ENGINE-V2-2026-06-15/PLAN.md` §2.
 *
 * Problème résolu : la stratégie « content-engine v2 » (benefit-gate, pain-matrix)
 * ne convient qu'au contenu COMMERCIAL. Appliquée au corpus INFORMATIONNEL/AEO
 * (glossaire, what_is, FAQ, qa) — celui que les LLM citent — un gate « 2 chiffres
 * + avant/après » le basculerait en tier_3 = désindexation. Il faut donc un
 * PROFIL par type de contenu, qui se RÉCONCILIE avec la dimension `SearchIntent`
 * déjà existante (`intent-prompt-adapter.ts`), JAMAIS un axe parallèle.
 *
 * ⚠️ PH1 = MODULE PUR, DORMANT. Cette table NE PILOTE encore AUCUN gate ni
 * décision de publication. Elle est calculée (flag `QUALITY_PROFILES_ENABLED`)
 * et persistée pour OBSERVABILITÉ uniquement. La consommation des seuils
 * (`benefitMin`, etc.) est le périmètre de PH2 — voir le plan. Tant que rien ne
 * lit `QUALITY_PROFILE_GATES`, le comportement de génération est inchangé.
 *
 * Aucune I/O (pas de Prisma/Redis/réseau) : 100 % testable et pur.
 */

import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";

/** Les 4 profils qualité (plan §2). */
export type QualityProfile = "commercial" | "informational_aeo" | "local" | "news";

export const QUALITY_PROFILES: readonly QualityProfile[] = [
  "commercial",
  "informational_aeo",
  "local",
  "news",
] as const;

/**
 * Profil de BASE par `ContentType` (couvre EXHAUSTIVEMENT les 21 valeurs de
 * l'enum Prisma). Le type `Record<ContentType, QualityProfile>` force la
 * compilation à échouer si un futur `ContentType` n'est pas mappé ici — garde
 * structurelle (doublée par un test runtime). Référence : plan §2.
 */
export const PROFILE_BY_CONTENT_TYPE: Record<ContentType, QualityProfile> = {
  // ── commercial (différenciation douleur/bénéfice chiffré) ───────────────────
  pain_point_solution: "commercial",
  best_for_x_in_y: "commercial",
  vs_comparator: "commercial",
  alternative_to: "commercial",
  comparison: "commercial",
  calculator_roi: "commercial",
  top_x_in_y: "commercial",
  how_to_x_in_y: "commercial",
  case_study_local: "commercial",
  // ── informational_aeo (citabilité LLM — NE PAS soumettre au benefit-gate) ───
  glossary_term: "informational_aeo",
  what_is_x: "informational_aeo",
  faq_standalone: "informational_aeo",
  faq_geo: "informational_aeo",
  qa_derived: "informational_aeo",
  guide_pilier: "informational_aeo",
  long_tail_keyword: "informational_aeo",
  blog_article: "informational_aeo",
  blog_from_keywords: "informational_aeo",
  blog_from_title: "informational_aeo",
  // ── local (hubs/landings villes — ancrage économique réel) ──────────────────
  landing_ville: "local",
  // ── news (veille RSS — fraîcheur) ───────────────────────────────────────────
  blog_from_rss: "news",
};

/**
 * Profil pour les 6 générateurs villes pilotés en CLI (HORS enum `ContentType`,
 * donc jamais passés à `getGenerator()` — cf. plan §2 et generators/index.ts).
 * Résolus par clé de générateur, tous `local`.
 */
export const PROFILE_BY_CLI_GENERATOR: Record<string, QualityProfile> = {
  "ville-hub-copy": "local",
  "landing-ville-economic-data": "local",
  "landing-ville-ecosystem": "local",
  "landing-ville-secteurs": "local",
  "landing-ville-cas-usage": "local",
  "landing-ville-faq-extended": "local",
};

/**
 * Seuils PAR PROFIL (DONNÉES — DORMANTES en PH1, consommées en PH2).
 * Defaults rétro-compatibles : `benefitMin: null` partout SAUF commercial=70, de
 * sorte qu'une fois branché (PH2) le `blockingFail` des profils info/local/news
 * reste bit-à-bit identique à l'actuel. `mayMutateVilleTier:false` partout
 * (les villes restent log-only — décisions #66 / Fix C2).
 */
export interface QualityProfileGates {
  /** Score benefit-concreteness minimal sous lequel bloquer (PH2). null = inerte. */
  readonly benefitMin: number | null;
  /** "max" = max(seuil profil, plancher global) ; "global" = plancher global seul. */
  readonly qualityThresholdMode: "global" | "max";
  /** Exiger un directAnswer 40-80 mots (déjà requis aujourd'hui pour tier-1). */
  readonly requireDirectAnswer: boolean;
  /** Autorise-t-on ce profil à MUTER l'indexationTier d'une ville ? Toujours false. */
  readonly mayMutateVilleTier: boolean;
}

export const QUALITY_PROFILE_GATES: Record<QualityProfile, QualityProfileGates> = {
  commercial: {
    benefitMin: 70,
    qualityThresholdMode: "max",
    requireDirectAnswer: true,
    mayMutateVilleTier: false,
  },
  informational_aeo: {
    benefitMin: null,
    qualityThresholdMode: "global",
    requireDirectAnswer: true,
    mayMutateVilleTier: false,
  },
  local: {
    benefitMin: null,
    qualityThresholdMode: "global",
    requireDirectAnswer: true,
    mayMutateVilleTier: false,
  },
  news: {
    benefitMin: null,
    qualityThresholdMode: "global",
    requireDirectAnswer: true,
    mayMutateVilleTier: false,
  },
};

/**
 * Résout le profil qualité effectif pour un (contentType, searchIntent).
 *
 * Base = profil du `ContentType`. Le `SearchIntent` peut REDIRIGER le profil
 * (réconciliation avec l'axe intent existant), selon les 2 règles du plan §2 :
 *   - base commercial + intent {informational | local} → ce profil
 *   - base informational_aeo + intent {commercial_investigation | transactional} → commercial
 * Les autres intents (navigational/voice_search/ai_overview/featured_snippet)
 * conservent le profil de base. Fonction pure et déterministe.
 */
export function resolveQualityProfile(
  contentType: ContentType,
  searchIntent?: SearchIntent | null,
): QualityProfile {
  const base = PROFILE_BY_CONTENT_TYPE[contentType];
  if (!searchIntent) return base;

  if (base === "commercial") {
    if (searchIntent === "informational") return "informational_aeo";
    if (searchIntent === "local") return "local";
  }
  if (base === "informational_aeo") {
    if (searchIntent === "commercial_investigation" || searchIntent === "transactional") {
      return "commercial";
    }
  }
  return base;
}

/** Résout le profil d'un générateur ville CLI (clé de générateur). `null` si inconnu. */
export function resolveCliGeneratorProfile(generatorKey: string): QualityProfile | null {
  return PROFILE_BY_CLI_GENERATOR[generatorKey] ?? null;
}

/** Accès aux seuils d'un profil (DORMANT en PH1). */
export function getProfileGates(profile: QualityProfile): QualityProfileGates {
  return QUALITY_PROFILE_GATES[profile];
}
