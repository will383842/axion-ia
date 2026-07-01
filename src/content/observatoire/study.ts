/**
 * Observatoire de l'IA dans les entreprises françaises 2026 — SSOT métadonnées.
 *
 * Constante unique réutilisée partout (page résultats, presse, JSON-LD Dataset,
 * générateur d'articles, dashboard admin). Données structurées canoniques —
 * la prose UI passe par les messages i18n (namespace `observatoire`).
 *
 * Réutilise les SSOT existants : `KB_SECTOR_TAGS` (secteurs) et `REGIONS`
 * (régions métropole). Ne hardcode aucune liste parallèle.
 *
 * ⚠️ INTÉGRITÉ DES CHIFFRES — l'échantillon affiché publiquement est le nombre
 * RÉEL de réponses (`BarometerSnapshot.totalResponses`), jamais une valeur en
 * dur. `SEED_TARGET_RESPONSES` ci-dessous sert UNIQUEMENT au seed de
 * développement/démo (`pnpm barometer:seed`) — il n'est jamais publié comme
 * un effectif réel et le seed ne tourne pas au déploiement prod.
 */

import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import { REGIONS, type Region } from "@/content/regions";

/** Nom officiel de l'étude — proper noun exact (JSON-LD, H1, citations). */
export const STUDY_NAME_FR = "L'Observatoire de l'IA dans les entreprises françaises 2026";
export const STUDY_NAME_EN = "The 2026 AI in French Companies Observatory";

/** Éditeur / créateur des données. */
export const STUDY_PUBLISHER = "Axion-IA";
export const STUDY_PUBLISHER_URL = "https://axion-ia.com";

/** Licence ouverte CC BY 4.0 — invite la citation avec attribution. */
export const STUDY_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const STUDY_LICENSE_LABEL = "CC BY 4.0";
export const STUDY_ATTRIBUTION = "Source : Observatoire Axion-IA 2026 — axion-ia.com";

/**
 * Période de terrain — collecte CONTINUE (l'observatoire ne se clôt pas).
 * `temporalCoverage` est un intervalle ISO 8601 OUVERT (`2026-01-06/..`),
 * format reconnu par schema.org pour un dataset toujours alimenté.
 */
export const STUDY_PERIOD_START = "2026-01-06";
export const STUDY_TEMPORAL_COVERAGE = `${STUDY_PERIOD_START}/..`;
export const STUDY_SPATIAL_COVERAGE = "France";

/** Méthode. */
export const STUDY_QUESTION_COUNT = 16;
export const STUDY_METHOD_FR =
  "Questionnaire en ligne auto-administré ; répondants = dirigeants et décideurs d'entreprises françaises.";
export const STUDY_METHOD_EN =
  "Self-administered online questionnaire; respondents = executives and decision-makers of French companies.";

/**
 * Couverture dérivée des SSOT (jamais hardcodée).
 * - Régions : 13 métropole (`type === "metropole"`).
 * - Secteurs : 30 tags `KB_SECTOR_TAGS`.
 * - Tailles : 4 valeurs de l'enum Prisma `CompanySize`.
 */
export const STUDY_REGIONS: ReadonlyArray<Region> = REGIONS.filter((r) => r.type === "metropole");
export const STUDY_REGION_COUNT = STUDY_REGIONS.length; // 13
export const STUDY_SECTOR_COUNT = KB_SECTOR_TAGS.length; // 30 (dérivé du SSOT)
export const STUDY_COMPANY_SIZE_COUNT = 4; // CompanySize: TPE · PME · ETI · GRANDE_ENTREPRISE

/**
 * Cible d'effectif du SEED DE DÉVELOPPEMENT uniquement (démo/QA). NE PAS
 * publier comme un effectif réel. L'effectif public = snapshot.totalResponses.
 */
export const SEED_TARGET_RESPONSES = 8627;

/** Clé canonique du snapshot d'agrégats lu par toutes les pages publiques. */
export const SNAPSHOT_KEY_LATEST = "latest";

/** Variables mesurées (pour JSON-LD `Dataset.variableMeasured`). */
export const STUDY_VARIABLES_MEASURED: ReadonlyArray<string> = [
  "Niveau de maturité IA",
  "Existence d'une stratégie IA formalisée",
  "Usages de l'IA en entreprise",
  "Outils d'IA utilisés",
  "Budget IA annuel",
  "Freins à l'adoption de l'IA",
  "Temps gagné grâce à l'IA",
  "Préoccupation RGPD / souveraineté des données",
  "Formation des équipes à l'IA",
  "Intention d'investissement IA",
];

/** Technique de mesure (JSON-LD `Dataset.measurementTechnique`). */
export const STUDY_MEASUREMENT_TECHNIQUE = "Questionnaire en ligne auto-administré (16 questions)";

/**
 * Clés des constats phares (KPI). Chaque insight est calculé depuis le
 * snapshot réel ; ces clés mappent vers la prose i18n et le générateur
 * d'articles `barometer_insight`. Aucun pourcentage n'est figé ici.
 */
export const BAROMETER_INSIGHT_KEYS = [
  "competitors_use_ai",
  "no_formal_strategy",
  "rgpd_concern",
  "investment_intent",
] as const;

export type BarometerInsightKey = (typeof BAROMETER_INSIGHT_KEYS)[number];
