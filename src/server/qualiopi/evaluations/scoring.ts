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
 * - `scoreMax` = nb compétences **NOTÉES** × 3.
 * - `scorePct` = round(scoreObtenu / scoreMax × 100), 0 si scoreMax = 0.
 *
 * 🔴 Audit certification 2026-07-26 (F22). Une note absente valait 0 tout en
 * comptant dans `scoreMax` — donc MOINS qu'un « non acquis », qui vaut 1. Sur
 * cinq objectifs au seuil de 70 %, trois « acquis » et deux cases oubliées
 * donnaient 60 % → échec, alors que cinq « non acquis » explicitement notés
 * donnaient 33 %. Un stagiaire pouvait donc échouer à cause d'une case que le
 * formateur avait sautée, et ce verdict partait sur son attestation.
 *
 * L'oubli de saisie et l'échec réel étaient indiscernables. Ils ne le sont plus :
 * une compétence non notée sort du calcul, et l'attestation la mentionne
 * séparément sous « Non évalués » (cf. `getFinaleResultats`). Un trou de saisie
 * se voit et se corrige ; un faux échec, non.
 */
export function computeEvaluationScore(
  competences: Array<{ note?: 1 | 2 | 3 }>,
): EvaluationScoreResult {
  const notees = competences.filter((c) => c.note === 1 || c.note === 2 || c.note === 3);
  const scoreMax = notees.length * 3;
  const scoreObtenu = notees.reduce<number>((acc, c) => acc + (c.note ?? 0), 0);
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
