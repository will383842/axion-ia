// Seuil de confiance retrieval → escalade (T-11, doc 16 e/§1.2).
//
// Si le meilleur chunk récupéré est trop faible (ou aucun), on N'APPELLE PAS le
// LLM : on escalade (jamais d'invention). Le score est normalisé sur le max
// théorique RRF (présent en rang 0 dans les 2 listes ≈ 2/(60+1)). Seuil
// configurable par tenant (settings.confidenceThreshold).

/** Max théorique d'un score RRF (k0=60, rang 0 dans les 2 listes). */
const RRF_MAX = 2 / 61;

export interface ConfidenceResult {
  /** Score normalisé [0..1]. */
  readonly score: number;
  /** true si ≥ seuil et au moins un chunk. */
  readonly confident: boolean;
}

/** Évalue la confiance d'un ensemble de chunks (par leur meilleur score RRF). */
export function assessConfidence(
  chunks: ReadonlyArray<{ score: number }>,
  threshold: number,
): ConfidenceResult {
  if (chunks.length === 0) return { score: 0, confident: false };
  const top = Math.max(...chunks.map((c) => c.score));
  const score = Math.min(1, top / RRF_MAX);
  return { score, confident: score >= threshold };
}
