/**
 * Knowledge Base — types polymorphiques.
 *
 * SSOT : `_AUDIT/KNOWLEDGE-BASE-2026/02-SSOT.md` (Agent 2).
 * 16 valeurs alignées avec enum Prisma `KbType` (schema.prisma).
 * Aucune valeur traduite (DB stable) — labels via `LABELS_FR` / `LABELS_EN`.
 */

import type { KbType } from "../../../prisma/generated/client";

export const KB_TYPES: readonly KbType[] = [
  // V3 — 16 types
  "article",
  "case_study",
  "help_article",
  "faq",
  "glossary_term",
  "guide",
  "methodology",
  "doctrine",
  "adr",
  "prompt_template",
  "sop",
  "post_mortem",
  "tool_card",
  "competitor_card",
  "commercial_doc",
  "onboarding_step",
  // V4 — 12 types Knowledge Factory Industrielle (FR uniquement V1)
  "automation_recipe",
  "tool_review",
  "industry_use_case",
  "comparison",
  "implementation_playbook",
  "prompt_pattern",
  "roi_calculator_template",
  "intervention_module",
  "competence_boost",
  "secteur_brief",
  "dept_brief",
  "metier_brief",
] as const;

/** Types publics (URL dédiée préservée existant ou hub `/ressources/`). */
export const PUBLIC_KB_TYPES = [
  // V3 — URL dédiée
  "article",
  "case_study",
  "help_article",
  "faq",
  "glossary_term",
  "guide",
  // V4 — Hub /ressources/ uniquement V1 (path type-spécifique futur)
  "automation_recipe",
  "tool_review",
  "industry_use_case",
  "comparison",
  "implementation_playbook",
  "prompt_pattern",
  "roi_calculator_template",
  "intervention_module",
  "competence_boost",
  "secteur_brief",
  "dept_brief",
  "metier_brief",
] as const satisfies readonly KbType[];

/** Types internes (audience `team` ou `will_only` par défaut). */
export const INTERNAL_KB_TYPES = [
  "methodology",
  "doctrine",
  "adr",
  "prompt_template",
  "sop",
  "post_mortem",
  "tool_card",
  "competitor_card",
] as const satisfies readonly KbType[];

/** Types orientés client connecté (`/mes-ressources/`). */
export const CLIENT_KB_TYPES = [
  "commercial_doc",
  "onboarding_step",
] as const satisfies readonly KbType[];

/**
 * Mapping `type` → schema.org JSON-LD `@type`.
 * Sources : Agent 6 (Public Surface) + Agent 12 (E-E-A-T) + master prompt §0.0/11.
 */
export const KB_TYPE_TO_JSONLD: Record<KbType, string> = {
  // V3
  article: "Article",
  case_study: "Article",
  help_article: "Article",
  faq: "FAQPage",
  glossary_term: "DefinedTerm",
  guide: "TechArticle",
  methodology: "Article",
  doctrine: "Article",
  adr: "Article",
  prompt_template: "Article",
  sop: "HowTo",
  post_mortem: "Article",
  tool_card: "Article",
  competitor_card: "Article",
  commercial_doc: "Article",
  onboarding_step: "HowTo",
  // V4 — Knowledge Factory Industrielle
  automation_recipe: "HowTo",
  tool_review: "Review",
  industry_use_case: "Article",
  comparison: "Article",
  implementation_playbook: "HowTo",
  prompt_pattern: "Article",
  roi_calculator_template: "Article",
  intervention_module: "Course",
  competence_boost: "LearningResource",
  secteur_brief: "Article",
  dept_brief: "Article",
  metier_brief: "Article",
};

export type KbTypeMeta = {
  readonly value: KbType;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly jsonLd: string;
  readonly isPublic: boolean;
};

export const KB_TYPE_META: Record<KbType, KbTypeMeta> = {
  article: {
    value: "article",
    labelFr: "Article",
    labelEn: "Article",
    jsonLd: "Article",
    isPublic: true,
  },
  case_study: {
    value: "case_study",
    labelFr: "Cas concret",
    labelEn: "Case study",
    jsonLd: "Article",
    isPublic: true,
  },
  help_article: {
    value: "help_article",
    labelFr: "Article d'aide",
    labelEn: "Help article",
    jsonLd: "Article",
    isPublic: true,
  },
  faq: { value: "faq", labelFr: "FAQ", labelEn: "FAQ", jsonLd: "FAQPage", isPublic: true },
  glossary_term: {
    value: "glossary_term",
    labelFr: "Terme glossaire",
    labelEn: "Glossary term",
    jsonLd: "DefinedTerm",
    isPublic: true,
  },
  guide: {
    value: "guide",
    labelFr: "Guide IA",
    labelEn: "AI guide",
    jsonLd: "TechArticle",
    isPublic: true,
  },
  methodology: {
    value: "methodology",
    labelFr: "Méthodologie",
    labelEn: "Methodology",
    jsonLd: "Article",
    isPublic: false,
  },
  doctrine: {
    value: "doctrine",
    labelFr: "Doctrine",
    labelEn: "Doctrine",
    jsonLd: "Article",
    isPublic: false,
  },
  adr: { value: "adr", labelFr: "ADR", labelEn: "ADR", jsonLd: "Article", isPublic: false },
  prompt_template: {
    value: "prompt_template",
    labelFr: "Template de prompt",
    labelEn: "Prompt template",
    jsonLd: "Article",
    isPublic: false,
  },
  sop: {
    value: "sop",
    labelFr: "Procédure opérationnelle",
    labelEn: "Standard operating procedure",
    jsonLd: "HowTo",
    isPublic: false,
  },
  post_mortem: {
    value: "post_mortem",
    labelFr: "Post-mortem",
    labelEn: "Post-mortem",
    jsonLd: "Article",
    isPublic: false,
  },
  tool_card: {
    value: "tool_card",
    labelFr: "Fiche outil",
    labelEn: "Tool card",
    jsonLd: "Article",
    isPublic: false,
  },
  competitor_card: {
    value: "competitor_card",
    labelFr: "Fiche concurrent",
    labelEn: "Competitor card",
    jsonLd: "Article",
    isPublic: false,
  },
  commercial_doc: {
    value: "commercial_doc",
    labelFr: "Document commercial",
    labelEn: "Commercial document",
    jsonLd: "Article",
    isPublic: false,
  },
  onboarding_step: {
    value: "onboarding_step",
    labelFr: "Étape onboarding",
    labelEn: "Onboarding step",
    jsonLd: "HowTo",
    isPublic: false,
  },
  // V4 — Knowledge Factory Industrielle (FR uniquement V1 ; EN labels = mirroring informatif)
  automation_recipe: {
    value: "automation_recipe",
    labelFr: "Recette d'automatisation",
    labelEn: "Automation recipe",
    jsonLd: "HowTo",
    isPublic: true,
  },
  tool_review: {
    value: "tool_review",
    labelFr: "Avis outil IA",
    labelEn: "AI tool review",
    jsonLd: "Review",
    isPublic: true,
  },
  industry_use_case: {
    value: "industry_use_case",
    labelFr: "Cas d'usage sectoriel",
    labelEn: "Industry use case",
    jsonLd: "Article",
    isPublic: true,
  },
  comparison: {
    value: "comparison",
    labelFr: "Comparatif outils",
    labelEn: "Tools comparison",
    jsonLd: "Article",
    isPublic: true,
  },
  implementation_playbook: {
    value: "implementation_playbook",
    labelFr: "Playbook d'implémentation",
    labelEn: "Implementation playbook",
    jsonLd: "HowTo",
    isPublic: true,
  },
  prompt_pattern: {
    value: "prompt_pattern",
    labelFr: "Pattern de prompt",
    labelEn: "Prompt pattern",
    jsonLd: "Article",
    isPublic: true,
  },
  roi_calculator_template: {
    value: "roi_calculator_template",
    labelFr: "Template calculateur ROI",
    labelEn: "ROI calculator template",
    jsonLd: "Article",
    isPublic: true,
  },
  intervention_module: {
    // Doctrine axionia-core : « intervention » jamais « training »/« formation »
    value: "intervention_module",
    labelFr: "Module d'intervention",
    labelEn: "Intervention module",
    jsonLd: "Course",
    isPublic: true,
  },
  competence_boost: {
    value: "competence_boost",
    labelFr: "Boost de compétence",
    labelEn: "Competence boost",
    jsonLd: "LearningResource",
    isPublic: true,
  },
  secteur_brief: {
    value: "secteur_brief",
    labelFr: "Brief sectoriel",
    labelEn: "Sector brief",
    jsonLd: "Article",
    isPublic: true,
  },
  dept_brief: {
    value: "dept_brief",
    labelFr: "Brief département",
    labelEn: "Department brief",
    jsonLd: "Article",
    isPublic: true,
  },
  metier_brief: {
    value: "metier_brief",
    labelFr: "Brief métier",
    labelEn: "Role brief",
    jsonLd: "Article",
    isPublic: true,
  },
};

export function getKbTypeMeta(type: KbType): KbTypeMeta {
  return KB_TYPE_META[type];
}

export function getJsonLdType(type: KbType): string {
  return KB_TYPE_TO_JSONLD[type];
}

export function isPublicKbType(type: KbType): boolean {
  return KB_TYPE_META[type].isPublic;
}
