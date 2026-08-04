// Mapping preset (slug + config CampaignTemplate) → état initial du wizard.
// B6 — flux presets : /coverage/presets → /campaigns/new?preset=<slug>.
//
// Pure data + helpers (pas de "use client", pas d'I/O) : réutilisable côté
// composant client ET côté tests vitest.

import {
  WIZARD_CONTENT_TYPES,
  type WizardContentType,
} from "@/server/actions/content-gen/campaign-wizard-constants";

export type ServiceSector =
  "interventions_formations" | "audits" | "implementations" | "un_a_un" | "sites_web_augmentes";

/**
 * Config telle que stockée dans `CampaignTemplate.config` (Json) et dans la
 * liste de secours `FALLBACK_PRESETS` de CampaignPresetsV2.
 */
export interface PresetConfig {
  verticals?: string[];
  types?: string[];
  batchSize?: number;
  dailyCap?: number;
}

const VALID_SECTORS: ReadonlySet<string> = new Set<ServiceSector>([
  "interventions_formations",
  "audits",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
]);

/**
 * Slugs de types de contenu utilisés par les presets (TYPE_SHORT) qui diffèrent
 * de l'enum WizardContentType réel. Le cas connu : `blog_pillar` → `guide_pilier`.
 * Les autres slugs preset (blog_from_*, qa_derived, comparison) correspondent
 * déjà 1:1 à un WizardContentType. NB : `landing_ville` n'est plus un
 * WizardContentType (CLI-only) → `mapPresetTypeToWizardType` le renvoie `null`,
 * il est donc filtré silencieusement par `presetToWizardSeed`.
 */
const PRESET_TYPE_ALIASES: Record<string, WizardContentType> = {
  blog_pillar: "guide_pilier",
  blog_pilier: "guide_pilier",
  faq: "qa_derived",
};

const WIZARD_TYPE_SET: ReadonlySet<string> = new Set(WIZARD_CONTENT_TYPES);

/** Mappe un slug de type preset vers un WizardContentType valide (ou null). */
export function mapPresetTypeToWizardType(presetType: string): WizardContentType | null {
  const aliased = PRESET_TYPE_ALIASES[presetType];
  if (aliased) return aliased;
  if (WIZARD_TYPE_SET.has(presetType)) return presetType as WizardContentType;
  return null;
}

export interface PresetWizardSeed {
  serviceSector: ServiceSector | null;
  /** Poids % par WizardContentType (somme = 100) dérivés des types du preset. */
  contentTypeWeights: Partial<Record<WizardContentType, number>> | null;
  dailyArticles: number | null;
  targetPerCity: number | null;
}

/**
 * Dérive l'état initial du wizard depuis un preset.
 * - 1re verticale valide → serviceSector
 * - types valides → poids % égaux (somme normalisée à 100)
 * - dailyCap → dailyArticles ; batchSize → targetPerCity
 */
export function presetToWizardSeed(config: PresetConfig | undefined): PresetWizardSeed {
  const seed: PresetWizardSeed = {
    serviceSector: null,
    contentTypeWeights: null,
    dailyArticles: null,
    targetPerCity: null,
  };
  if (!config) return seed;

  const sector = (config.verticals ?? []).find((v) => VALID_SECTORS.has(v));
  if (sector) seed.serviceSector = sector as ServiceSector;

  const mappedTypes = (config.types ?? [])
    .map(mapPresetTypeToWizardType)
    .filter((t): t is WizardContentType => t !== null);
  // Dédupe (un alias pourrait collisionner).
  const uniqueTypes = Array.from(new Set(mappedTypes));
  if (uniqueTypes.length > 0) {
    const base = Math.floor(100 / uniqueTypes.length);
    const remainder = 100 - base * uniqueTypes.length;
    const weights: Partial<Record<WizardContentType, number>> = {};
    uniqueTypes.forEach((t, i) => {
      weights[t] = base + (i < remainder ? 1 : 0);
    });
    seed.contentTypeWeights = weights;
  }

  if (typeof config.dailyCap === "number" && config.dailyCap > 0) {
    seed.dailyArticles = Math.min(1000, Math.max(1, Math.round(config.dailyCap)));
  }
  if (typeof config.batchSize === "number" && config.batchSize > 0) {
    seed.targetPerCity = Math.min(200, Math.max(1, Math.round(config.batchSize)));
  }

  return seed;
}
