/**
 * Multi-judge quality ensemble (Sprint v7 Phase 16).
 *
 * Run plusieurs LLM-judges en parallèle et calcule un score consensus pour
 * réduire la variance individuelle d'un seul judge. Pattern :
 *   - Judge A (gpt-4o-mini)  → score 0-100
 *   - Judge B (claude-haiku) → score 0-100
 *   - Judge C (gpt-4o)       → score 0-100 (judge tie-breaker premium)
 *   - Consensus = median si écart < 15, sinon Judge C arbitre
 *
 * V1 squelette : retourne stub data si juges non-configurés. Productionisation
 * Sessions 11+ avec llm-judge.ts existant (lib factorisable).
 *
 * Activation : feature flag MULTI_JUDGE_ENABLED (default off). Reste sur judge
 * single existant tant que désactivé (zero régression).
 */

export interface JudgeResult {
  readonly judgeName: string;
  readonly score: number;
  readonly feedback: string;
  readonly costUsd: number;
  readonly tokens: number;
}

export interface MultiJudgeEnsembleResult {
  readonly consensusScore: number;
  readonly variance: number; // 0-100, indicateur de désaccord
  readonly judges: ReadonlyArray<JudgeResult>;
  readonly arbitered: boolean; // true si judge C a tranché
  readonly totalCostUsd: number;
  readonly tieBreakerUsed: boolean;
}

const VARIANCE_ARBITRATION_THRESHOLD = 15; // ≥ écart 15 → activer judge C

function isMultiJudgeEnabled(): boolean {
  return process.env.MULTI_JUDGE_ENABLED === "true";
}

/**
 * Calcule la médiane d'un array de nombres (centrée stable).
 */
function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

/**
 * Calcule la variance simplifiée (écart max - min) sur les scores.
 * Volontairement simple pour rester interprétable côté admin UI.
 */
function variance(values: ReadonlyArray<number>): number {
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Composé d'un ensemble de juges déjà runnés. V1 = pure function (pas de
 * LLM call ici, les juges sont passés en input pour être déterministe en tests).
 * Productionisation : Sessions 11+ ajouteront `runJudgeXxx()` adapters
 * appelant llm-judge.ts existant en parallèle via Promise.all().
 */
export function composeMultiJudge(
  judges: ReadonlyArray<JudgeResult>,
  tieBreakerJudge?: JudgeResult,
): MultiJudgeEnsembleResult {
  if (!isMultiJudgeEnabled()) {
    // Stub mode : retourne le 1er judge tel-quel (= comportement single-judge).
    const j0 = judges[0];
    if (!j0) {
      return {
        consensusScore: 0,
        variance: 0,
        judges: [],
        arbitered: false,
        totalCostUsd: 0,
        tieBreakerUsed: false,
      };
    }
    return {
      consensusScore: j0.score,
      variance: 0,
      judges: [j0],
      arbitered: false,
      totalCostUsd: j0.costUsd,
      tieBreakerUsed: false,
    };
  }

  const scores = judges.map((j) => j.score);
  const v = variance(scores);
  const med = median(scores);
  const totalCostBase = judges.reduce((s, j) => s + j.costUsd, 0);

  // Si écart < 15 ou pas de tie-breaker fourni → médiane consensus, pas d'arbitrage.
  if (v < VARIANCE_ARBITRATION_THRESHOLD || !tieBreakerJudge) {
    return {
      consensusScore: med,
      variance: v,
      judges,
      arbitered: false,
      totalCostUsd: totalCostBase,
      tieBreakerUsed: false,
    };
  }

  // Sinon : tie-breaker arbitre.
  return {
    consensusScore: tieBreakerJudge.score,
    variance: v,
    judges: [...judges, tieBreakerJudge],
    arbitered: true,
    totalCostUsd: totalCostBase + tieBreakerJudge.costUsd,
    tieBreakerUsed: true,
  };
}
