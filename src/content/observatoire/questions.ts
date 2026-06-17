/**
 * Observatoire IA 2026 — structure du questionnaire (16 questions).
 *
 * `value` des options = slugs EN STABLES, alignés EXACTEMENT sur les enums
 * Prisma (MaturityLevel, HasStrategy, …) et l'enum CompanySize. Les libellés
 * affichés sont résolus à l'affichage :
 *  - questions `sector`  → `KB_SECTOR_TAGS` (labelFr/labelEn) — SSOT
 *  - question  `region`  → `STUDY_REGIONS` (nameFr/nameEn) — SSOT
 *  - autres options + intitulés de question → messages i18n
 *    (`observatoire.questions.<id>.label` / `.options.<value>`)
 *
 * Aucune liste secteurs/régions n'est dupliquée ici.
 */

import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import { STUDY_REGIONS } from "@/content/observatoire/study";

export type QuestionType = "single" | "multi";

/** Provenance des options d'une question. */
export type OptionSource = "enum" | "sector" | "region" | "company_size";

export interface BarometerQuestion {
  /** Identifiant stable = clé i18n + (souvent) colonne BarometerResponse. */
  readonly id: string;
  readonly type: QuestionType;
  readonly source: OptionSource;
  /** Valeurs d'options pour les questions `enum` / `company_size`. */
  readonly options?: ReadonlyArray<string>;
  /** Max de sélections (questions `multi`). */
  readonly maxSelections?: number;
  /** Posée seulement si maturité ≥ POC (satisfaction). */
  readonly conditionalOnMaturityPoc?: boolean;
}

/** Valeurs CompanySize (enum Prisma) — ordre d'affichage croissant. */
export const COMPANY_SIZE_VALUES = ["TPE", "PME", "ETI", "GRANDE_ENTREPRISE"] as const;

/** Slugs des options multi-choix (stockées en JSON, hors enum). */
export const USE_CASE_VALUES = [
  "automation",
  "chatbot",
  "content",
  "data_analysis",
  "internal_rag",
  "sales",
  "dev",
  "none",
] as const;

export const TOOL_VALUES = [
  "chatgpt",
  "copilot",
  "claude",
  "gemini",
  "mistral",
  "internal",
  "none",
] as const;

export const BARRIER_VALUES = [
  "skills",
  "budget",
  "roi",
  "security_rgpd",
  "data_quality",
  "internal_resistance",
  "time",
  "not_priority",
] as const;

export const BARRIERS_MAX_SELECTIONS = 3;

export const BAROMETER_QUESTIONS: ReadonlyArray<BarometerQuestion> = [
  { id: "companySize", type: "single", source: "company_size", options: [...COMPANY_SIZE_VALUES] },
  { id: "sector", type: "single", source: "sector" },
  { id: "region", type: "single", source: "region" },
  {
    id: "respondentRole",
    type: "single",
    source: "enum",
    options: ["ceo_founder", "gm_coo", "cio_it", "business_director", "ops_manager", "other"],
  },
  {
    id: "maturityLevel",
    type: "single",
    source: "enum",
    options: ["none", "exploration", "poc", "production", "scaled"],
  },
  {
    id: "competitorsUseAi",
    type: "single",
    source: "enum",
    options: ["yes_clearly", "probably", "dont_know", "no"],
  },
  {
    id: "hasStrategy",
    type: "single",
    source: "enum",
    options: ["formalized", "in_progress", "none"],
  },
  { id: "useCases", type: "multi", source: "enum", options: [...USE_CASE_VALUES] },
  { id: "tools", type: "multi", source: "enum", options: [...TOOL_VALUES] },
  {
    id: "annualBudget",
    type: "single",
    source: "enum",
    options: ["zero", "lt_1k", "k1_5", "k5_20", "k20_100", "gt_100k", "dont_know"],
  },
  {
    id: "barriers",
    type: "multi",
    source: "enum",
    options: [...BARRIER_VALUES],
    maxSelections: BARRIERS_MAX_SELECTIONS,
  },
  {
    id: "timeSavedPerDay",
    type: "single",
    source: "enum",
    options: ["none", "lt_30min", "m30_1h", "h1_2", "h2_3", "gt_3h"],
  },
  {
    id: "rgpdConcern",
    type: "single",
    source: "enum",
    options: ["very", "somewhat", "little", "not_at_all"],
  },
  {
    id: "teamTrained",
    type: "single",
    source: "enum",
    options: ["formal", "informal", "none"],
  },
  {
    id: "satisfaction",
    type: "single",
    source: "enum",
    options: ["very_satisfied", "satisfied", "mixed", "disappointed"],
    conditionalOnMaturityPoc: true,
  },
  {
    id: "investmentIntent",
    type: "single",
    source: "enum",
    options: ["strong_increase", "increase", "stable", "decrease", "none_budget"],
  },
];

/** Valeurs de maturité considérées « ≥ POC » (gate de la question satisfaction). */
export const MATURITY_GE_POC = ["poc", "production", "scaled"] as const;

/** Slugs secteurs valides (clé de validation Zod côté Server Action). */
export const SECTOR_SLUGS: ReadonlyArray<string> = KB_SECTOR_TAGS.map((t) => t.slug);

/** Slugs régions métropole valides. */
export const REGION_SLUGS: ReadonlyArray<string> = STUDY_REGIONS.map((r) => r.slug);
