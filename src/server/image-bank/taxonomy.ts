/**
 * taxonomy.ts — SSOT taxonomie métier Axion-IA (GAP-01)
 *
 * Source unique de vérité pour les 3 modules + sous-modules canoniques.
 * Doit s'aligner sur `src/app/[locale]/{interventions,audit,implementation}/*`.
 *
 * Si une nouvelle sous-page métier est créée → ajouter ici.
 * Si une sous-page est retirée → garder ici avec flag `deprecated: true` + redirect 301.
 *
 * @see axionia/_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md §3.1 + §3.2
 */

// ──────────────────────────────────────────────────────────
// Modules canoniques (3)
// ──────────────────────────────────────────────────────────

export const MODULES = ["interventions", "audits", "implementations"] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS_FR: Record<Module, string> = {
  interventions: "Interventions & Formations",
  audits: "Audits IA",
  implementations: "Implémentations IA",
};

export const MODULE_LABELS_EN: Record<Module, string> = {
  interventions: "Interventions & Training",
  audits: "AI Audits",
  implementations: "AI Implementations",
};

// ──────────────────────────────────────────────────────────
// Sub-modules par module (à synchroniser avec routing.ts)
// ──────────────────────────────────────────────────────────

export const SUB_MODULES_INTERVENTIONS = [
  "essentielle",
  "approfondie",
  "dirigeants",
  "collectives",
  "individuel",
  "conference",
  "conference-pleniere",
  "conference-keynote",
  "atelier-ia-cible",
  "demarrage-ia-express",
  "gagner-du-temps",
  "coaching-decouverte",
  "coaching-avance",
  "dirigeant-productivite",
  "dirigeant-vision-strategique",
  "claude-dirigeant",
  "claude-implementation-individuel",
  "intervention-claude",
  "par-ville",
] as const;

export const SUB_MODULES_AUDITS = [
  "flash",
  "cible",
  "strategique-pme",
  "strategique-eti",
  "par-ville",
] as const;

export const SUB_MODULES_IMPLEMENTATIONS = [
  "chatbot",
  "agents",
  "crm-erp",
  "documents",
  "ia-custom",
  "integrations",
  "no-code",
  "processus",
  "structuration",
  "par-fonction",
  "par-techno",
  "par-ville",
] as const;

export type SubModuleInterventions = (typeof SUB_MODULES_INTERVENTIONS)[number];
export type SubModuleAudits = (typeof SUB_MODULES_AUDITS)[number];
export type SubModuleImplementations = (typeof SUB_MODULES_IMPLEMENTATIONS)[number];
export type SubModule = SubModuleInterventions | SubModuleAudits | SubModuleImplementations;

export const SUB_MODULES_BY_MODULE: Record<Module, readonly SubModule[]> = {
  interventions: SUB_MODULES_INTERVENTIONS,
  audits: SUB_MODULES_AUDITS,
  implementations: SUB_MODULES_IMPLEMENTATIONS,
};

// ──────────────────────────────────────────────────────────
// Axes additionnels (additionalProperty JSON-LD)
// ──────────────────────────────────────────────────────────

export const TARGET_SIZES = ["tpe", "pme", "eti", "grande-entreprise"] as const;
export type TargetSize = (typeof TARGET_SIZES)[number];

export const TARGET_PERSONAS = [
  "dirigeant",
  "dirigeante",
  "direction-marketing",
  "direction-rh",
  "direction-financiere",
  "direction-it",
  "operationnel",
  "equipe",
] as const;
export type TargetPersona = (typeof TARGET_PERSONAS)[number];

export const TARGET_SECTORS = [
  "industrie",
  "services",
  "commerce",
  "sante",
  "juridique",
  "immobilier",
  "formation",
  "tech",
  "b2b-generique",
] as const;
export type TargetSector = (typeof TARGET_SECTORS)[number];

export const TARGET_TECHNOS = [
  "claude",
  "gpt",
  "gemini",
  "mistral",
  "llama",
  "n8n",
  "zapier",
  "make",
  "notion",
  "airtable",
  "python",
  "no-code",
  "agnostic",
] as const;
export type TargetTechno = (typeof TARGET_TECHNOS)[number];

export const TARGET_FORMATS = [
  "presentiel",
  "distanciel",
  "hybride",
  "replay",
  "livrable",
] as const;
export type TargetFormat = (typeof TARGET_FORMATS)[number];

export const TARGET_DURATIONS = [
  "flash-30min",
  "demi-journee",
  "1-jour",
  "2-jours",
  "5-jours",
  "programme",
  "recurrent",
] as const;
export type TargetDuration = (typeof TARGET_DURATIONS)[number];

// ──────────────────────────────────────────────────────────
// Surface categories (éditorial public)
// ──────────────────────────────────────────────────────────

export const SURFACE_CATEGORIES = [
  "ia-operationnelle",
  "equipe",
  "cas-concrets",
  "interventions-formations",
  "audits",
  "implementations",
  "villes-regions",
  "personas",
] as const;
export type SurfaceCategory = (typeof SURFACE_CATEGORIES)[number];

export const SURFACE_CATEGORY_LABELS_FR: Record<SurfaceCategory, string> = {
  "ia-operationnelle": "IA opérationnelle",
  equipe: "Équipe & porte-parole",
  "cas-concrets": "Cas concrets & schémas",
  "interventions-formations": "Interventions & formations",
  audits: "Audits IA",
  implementations: "Implémentations & techno",
  "villes-regions": "Villes & régions",
  personas: "Personas & dirigeants",
};

export const SURFACE_CATEGORY_LABELS_EN: Record<SurfaceCategory, string> = {
  "ia-operationnelle": "Operational AI",
  equipe: "Team & spokespeople",
  "cas-concrets": "Use cases & diagrams",
  "interventions-formations": "Interventions & training",
  audits: "AI audits",
  implementations: "Implementations & tech",
  "villes-regions": "Cities & regions",
  personas: "Personas & leaders",
};

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

export function isValidModule(value: string): value is Module {
  return (MODULES as readonly string[]).includes(value);
}

export function isValidSubModule(module: Module, value: string): boolean {
  return (SUB_MODULES_BY_MODULE[module] as readonly string[]).includes(value);
}

export function getModuleLabel(module: Module, locale: "fr" | "en"): string {
  return locale === "fr" ? MODULE_LABELS_FR[module] : MODULE_LABELS_EN[module];
}

export function getSurfaceCategoryLabel(cat: SurfaceCategory, locale: "fr" | "en"): string {
  return locale === "fr" ? SURFACE_CATEGORY_LABELS_FR[cat] : SURFACE_CATEGORY_LABELS_EN[cat];
}

/**
 * Suggère la SurfaceCategory à partir du module (pour rétro-classement éditorial).
 */
export function moduleToSurfaceCategory(module: Module): SurfaceCategory {
  return module === "audits"
    ? "audits"
    : module === "implementations"
      ? "implementations"
      : "interventions-formations";
}
