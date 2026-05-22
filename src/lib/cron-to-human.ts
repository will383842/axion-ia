/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — D.3
 *
 * Helper : convertit une expression cron en texte lisible en français.
 * Utilisé dans l'UI admin pour afficher le recurringSchedule d'une campagne.
 *
 * Dépendance : cronstrue (client-safe, pas de dépendance serveur).
 */

import cronstrue from "cronstrue/i18n";

/**
 * Convertit une expression cron en description française lisible.
 * Retourne l'expression originale si la conversion échoue.
 *
 * @example
 * cronToHuman("0 9 * * 1") // "À 09:00 AM, le lundi seulement"
 * cronToHuman("0 7 * * *") // "À 07:00 AM, tous les jours"
 */
export function cronToHuman(expression: string): string {
  try {
    return cronstrue.toString(expression, { locale: "fr", verbose: false });
  } catch {
    return expression;
  }
}
