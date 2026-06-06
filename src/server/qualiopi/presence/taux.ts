/**
 * Calcul du taux de présence — Qualiopi indicateur 12.
 *
 * Décision Will #7 :
 *   - ≥ seuilComplete (défaut 80 %) → "complete"
 *   - 60 %...(seuilComplete - 1) → "partielle"
 *   - < 60 % → "aucune"
 *
 * Aucun import Prisma / accès DB.
 */

import type { TauxResult } from "./types";

/** Seuil inférieur de présence partielle (décision Will #7). */
const SEUIL_PARTIELLE_PCT = 60;

/**
 * Calcule le taux de présence global pour un ensemble de créneaux.
 *
 * @param creneaux - Liste des créneaux avec leur durée prévue et réalisée.
 * @returns `tauxPct` arrondi à l'entier, 0 si aucune durée prévue.
 */
export function computeTauxPresence(
  creneaux: Array<{ dureePrevueMinutes: number; dureeRealiseeMinutes: number }>,
): TauxResult {
  const minutesPrevues = creneaux.reduce((acc, c) => acc + c.dureePrevueMinutes, 0);
  const minutesRealisees = creneaux.reduce((acc, c) => acc + c.dureeRealiseeMinutes, 0);

  if (minutesPrevues === 0) {
    return { tauxPct: 0, minutesPrevues: 0, minutesRealisees: 0 };
  }

  const tauxPct = Math.round((minutesRealisees / minutesPrevues) * 100);
  return { tauxPct, minutesPrevues, minutesRealisees };
}

/**
 * Classe un taux de présence en catégorie qualitative.
 *
 * @param tauxPct         - Taux calculé (0–100+).
 * @param seuilCompletePct - Seuil de présence complète (défaut 80).
 */
export function classifierPresence(
  tauxPct: number,
  seuilCompletePct = 80,
): "complete" | "partielle" | "aucune" {
  if (tauxPct >= seuilCompletePct) return "complete";
  if (tauxPct >= SEUIL_PARTIELLE_PCT) return "partielle";
  return "aucune";
}
