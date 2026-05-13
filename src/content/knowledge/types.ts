/**
 * Knowledge Base — types polymorphiques.
 *
 * SSOT : `_AUDIT/KNOWLEDGE-BASE-2026/02-SSOT.md` (Agent 2).
 * 16 valeurs alignées avec enum Prisma `KbType` (schema.prisma).
 * Aucune valeur traduite (DB stable) — labels via `LABELS_FR` / `LABELS_EN`.
 */

import type { KbType } from "../../../prisma/generated/client";

export const KB_TYPES: readonly KbType[] = [
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
] as const;

/** Types publics (URL dédiée préservée existant ou hub `/ressources/`). */
export const PUBLIC_KB_TYPES = [
  "article",
  "case_study",
  "help_article",
  "faq",
  "glossary_term",
  "guide",
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
