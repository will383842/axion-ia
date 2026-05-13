/**
 * Knowledge Base — seuils quality score par type.
 *
 * Le quality score (Sprint KB-13) est un /100 calculé sur 10 critères pondérés.
 * Si une entrée est en statut `published` mais que son score < seuil, l'admin
 * a un warning. Un score < seuil bloque la transition `review → approved`
 * (sauf override admin justifié — loggé dans ActivityLog).
 *
 * Seuils paramétrables via `Setting.kb.quality.threshold.<type>` runtime override.
 */

import type { KbType } from "../../../prisma/generated/client";

export const DEFAULT_QUALITY_THRESHOLDS: Record<KbType, number> = {
  article: 75,
  case_study: 80,
  help_article: 70,
  faq: 60, // FAQ peut être courte
  glossary_term: 50, // Glossaire = définition courte
  guide: 85, // Guide long-form = exigence haute
  methodology: 75,
  doctrine: 70,
  adr: 70,
  prompt_template: 60,
  sop: 75,
  post_mortem: 70,
  tool_card: 65,
  competitor_card: 65,
  commercial_doc: 70,
  onboarding_step: 70,
  // V4 — Knowledge Factory Industrielle (seuils LLM scoring auto)
  automation_recipe: 60,
  tool_review: 65,
  industry_use_case: 70,
  comparison: 65,
  implementation_playbook: 75,
  prompt_pattern: 60,
  roi_calculator_template: 65,
  intervention_module: 70,
  competence_boost: 60,
  secteur_brief: 65,
  dept_brief: 65,
  metier_brief: 65,
};

/** Word count minimum par type (composant du quality score). */
export const DEFAULT_MIN_WORD_COUNT: Record<KbType, number> = {
  article: 400,
  case_study: 600,
  help_article: 300,
  faq: 30, // Question courte + réponse courte OK
  glossary_term: 30,
  guide: 1500,
  methodology: 500,
  doctrine: 300,
  adr: 200,
  prompt_template: 100,
  sop: 400,
  post_mortem: 600,
  tool_card: 200,
  competitor_card: 250,
  commercial_doc: 300,
  onboarding_step: 200,
  // V4 — heuristic gate (§17.3 spec : < 300 mots reject, sauf faq/glossary)
  automation_recipe: 300,
  tool_review: 400,
  industry_use_case: 500,
  comparison: 400,
  implementation_playbook: 800,
  prompt_pattern: 200,
  roi_calculator_template: 300,
  intervention_module: 400,
  competence_boost: 200,
  secteur_brief: 400,
  dept_brief: 400,
  metier_brief: 400,
};

export function getQualityThreshold(type: KbType): number {
  return DEFAULT_QUALITY_THRESHOLDS[type];
}

export function getMinWordCount(type: KbType): number {
  return DEFAULT_MIN_WORD_COUNT[type];
}
