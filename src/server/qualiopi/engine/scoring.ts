/**
 * Qualiopi — Formation Engine T4 : Calcul du score pondéré.
 *
 * Module PUR — zéro dépendance externe. Fonction testable de façon isolée.
 *
 * Algorithme :
 *   scoreGlobal = Σ (score_critère / 100 × poids_critère)  arrondi à l'entier le plus proche
 *
 * Exemple : 2 critères (poids 60 + 40), scores 80 et 50 :
 *   (80/100 × 60) + (50/100 × 40) = 48 + 20 = 68
 */

import type { GrilleCriteres } from "@/server/qualiopi/engine/grille-schema";

/**
 * Calcule le score global pondéré (0-100, arrondi à l'entier).
 *
 * - Si un critère de la grille est absent de `parCritere`, son score est 0.
 * - Les scores `parCritere` sont clampés à [0, 100] pour la robustesse.
 *
 * @param parCritere Map { critereId → score 0-100 }
 * @param criteres   Grille de critères avec leurs poids
 * @returns          Score global pondéré arrondi (0-100)
 */
export function computeWeightedScore(
  parCritere: Record<string, number>,
  criteres: GrilleCriteres,
): number {
  if (criteres.length === 0) return 0;

  let total = 0;
  for (const critere of criteres) {
    const rawScore = parCritere[critere.id] ?? 0;
    const score = Math.max(0, Math.min(100, rawScore));
    total += (score / 100) * critere.poids;
  }

  return Math.round(total);
}
