/**
 * Knowledge Base — fenêtres de revue par type (durée en mois).
 *
 * Une entrée publiée doit être revue à intervalles réguliers (fraîcheur).
 * Le cron `knowledge-review-expiry.ts` (Sprint KB-17) alerte si `reviewedAt + window < now`.
 *
 * Paramétrable via `Setting.kb.review.window.<type>` runtime override.
 */

import type { KbType } from "../../../prisma/generated/client";

/** Durée en mois entre 2 revues (par défaut). */
export const DEFAULT_REVIEW_WINDOW_MONTHS: Record<KbType, number> = {
  article: 18,
  case_study: 24,
  help_article: 12,
  faq: 12,
  glossary_term: 24,
  guide: 18,
  methodology: 12,
  doctrine: 12,
  adr: 36, // ADR = décisions stables
  prompt_template: 6, // Prompts évoluent vite
  sop: 12,
  post_mortem: 60, // Post-mortem = historique
  tool_card: 6, // Outils évoluent vite
  competitor_card: 6,
  commercial_doc: 12,
  onboarding_step: 12,
  // V4 — Knowledge Factory Industrielle (fenêtres adaptées à fraîcheur écosystème IA)
  automation_recipe: 6, // Outils N8N/Zapier évoluent vite
  tool_review: 6, // Avis outils IA — révision fréquente
  industry_use_case: 12,
  comparison: 6, // Comparatifs — prix/features changent
  implementation_playbook: 12,
  prompt_pattern: 6, // Prompts — fréquent
  roi_calculator_template: 12,
  intervention_module: 12,
  competence_boost: 6,
  secteur_brief: 12,
  dept_brief: 12,
  metier_brief: 12,
};

export function getReviewWindowMonths(type: KbType): number {
  return DEFAULT_REVIEW_WINDOW_MONTHS[type];
}

/**
 * Renvoie la date d'échéance prochaine de revue à partir de `reviewedAt`.
 * Utilise setUTCMonth pour déterminisme cross-timezone (CI/dev/prod alignés).
 */
export function computeReviewDueAt(type: KbType, reviewedAt: Date): Date {
  const months = getReviewWindowMonths(type);
  const due = new Date(reviewedAt);
  due.setUTCMonth(due.getUTCMonth() + months);
  return due;
}
