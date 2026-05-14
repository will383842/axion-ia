/**
 * Content Generator — Embedding-based dedup (Sprint 12 V2).
 *
 * Remplace progressivement le dedup shingling V1 (Jaccard tokens) par cosine
 * similarity sur embeddings vectoriels (Voyage AI ou Perplexity pplx-embed).
 *
 * Doctrine (master prompt § 3.2 Sprint 12) :
 *   - Seuil cosine ≥ 0.85 = doublon (rejet)
 *   - Seuil 0.80-0.85 = similaire (audit log warn, autorise mais flag review)
 *   - Seuil < 0.80 = OK distinct
 *
 * Fonctions pures testables. L'I/O (call Voyage API + Pgvector query) reste
 * dans le worker similarity-monitor existant qui appellera ce module.
 */

/** Cosine similarity entre 2 vecteurs de même dimension. Retour [0,1]. */
export function cosineSimilarity(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  if (a.length !== b.length) {
    throw new Error(`vector dim mismatch (${a.length} vs ${b.length})`);
  }
  if (a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type DedupVerdict = "ok" | "similar" | "duplicate";

export interface DedupVerdictInput {
  readonly similarity: number;
  /** Seuils configurables (default master prompt). */
  readonly duplicateThreshold?: number;
  readonly similarThreshold?: number;
}

export interface DedupVerdictResult {
  readonly verdict: DedupVerdict;
  readonly similarity: number;
  readonly reason: string;
}

export const DEFAULT_DEDUP_THRESHOLDS = {
  duplicateThreshold: 0.85,
  similarThreshold: 0.8,
} as const;

export function classifyDedupVerdict(input: DedupVerdictInput): DedupVerdictResult {
  const dup = input.duplicateThreshold ?? DEFAULT_DEDUP_THRESHOLDS.duplicateThreshold;
  const sim = input.similarThreshold ?? DEFAULT_DEDUP_THRESHOLDS.similarThreshold;

  if (input.similarity >= dup) {
    return {
      verdict: "duplicate",
      similarity: input.similarity,
      reason: `cosine ${input.similarity.toFixed(3)} ≥ duplicateThreshold ${dup}`,
    };
  }
  if (input.similarity >= sim) {
    return {
      verdict: "similar",
      similarity: input.similarity,
      reason: `cosine ${input.similarity.toFixed(3)} ∈ [${sim}, ${dup}) — review recommandé`,
    };
  }
  return {
    verdict: "ok",
    similarity: input.similarity,
    reason: `cosine ${input.similarity.toFixed(3)} < ${sim}`,
  };
}
