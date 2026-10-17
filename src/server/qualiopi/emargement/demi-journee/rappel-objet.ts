/**
 * Chantier QNC, lot L06 — le code stable d'un rappel de début de demi-journée
 * dans `relances_journal.objet` (≤ 80 caractères). Module PUR, sans import :
 * le worker et la console le lisent tous deux.
 */

export const PREFIXE_OBJET_RAPPEL = "emargement_demi_journee:" as const;

/** `emargement_demi_journee:2026-10-16:matin`. */
export function objetRappel(cleDemiJournee: string): string {
  return `${PREFIXE_OBJET_RAPPEL}${cleDemiJournee}`;
}
