/**
 * Qualiopi — Logique pure de scoring évaluation des acquis (T9).
 *
 * Module PUR : aucun import Prisma / accès DB / next.
 * Indicateur Qualiopi 11 — évaluation des acquis par objectif pédagogique.
 *
 * Décision de notation :
 *   - Chaque compétence reçoit une note 1 (non acquis), 2 (en cours), 3 (acquis).
 *   - scoreMax = nombre de compétences × 3.
 *   - scoreObtenu = somme des notes (les notes absentes comptent 0 pour obtenu
 *     mais la compétence est incluse dans scoreMax — elle reste attendue).
 *   - scorePct = round(obtenu / max × 100) ; 0 si max = 0.
 */

// ────────────────────────────────────────────────────────────────
// Scoring brut
// ────────────────────────────────────────────────────────────────

export interface EvaluationScoreResult {
  scoreObtenu: number;
  scoreMax: number;
  scorePct: number;
}

/**
 * Calcule le score global d'une évaluation à partir des notes par compétence.
 *
 * - `scoreMax` = nb compétences × 3 (toutes compétences attendues).
 * - Les notes absentes (undefined) = 0 pour scoreObtenu, mais la compétence
 *   entre bien dans scoreMax (elle est attendue et non notée = pénalité).
 * - `scorePct` = round(scoreObtenu / scoreMax × 100), 0 si scoreMax = 0.
 */
export function computeEvaluationScore(
  competences: Array<{ note?: 1 | 2 | 3 }>,
): EvaluationScoreResult {
  const scoreMax = competences.length * 3;
  const scoreObtenu = competences.reduce<number>((acc, c) => acc + (c.note ?? 0), 0);
  const scorePct = scoreMax === 0 ? 0 : Math.round((scoreObtenu / scoreMax) * 100);
  return { scoreObtenu, scoreMax, scorePct };
}

// ────────────────────────────────────────────────────────────────
// Niveau global
// ────────────────────────────────────────────────────────────────

/**
 * Déduit le niveau global d'acquisition depuis le pourcentage de score.
 *
 * Règle :
 *   - < 50 %  → "non_acquis"
 *   - 50–80 % → "partiellement_acquis" (inclusif des deux bornes)
 *   - > 80 %  → "acquis"
 */
export function niveauFromScore(
  scorePct: number,
): "non_acquis" | "partiellement_acquis" | "acquis" {
  if (scorePct > 80) return "acquis";
  if (scorePct >= 50) return "partiellement_acquis";
  return "non_acquis";
}

// ────────────────────────────────────────────────────────────────
// Réussite
// ────────────────────────────────────────────────────────────────

/**
 * Indique si le score représente une réussite selon le seuil configuré.
 *
 * @param scorePct         - Pourcentage de score calculé (0–100).
 * @param seuilReussitePct - Seuil de réussite en % (ex. 70). Défaut registre.
 */
export function reussiteFromScore(scorePct: number, seuilReussitePct: number): boolean {
  return scorePct >= seuilReussitePct;
}
