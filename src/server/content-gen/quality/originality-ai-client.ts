/**
 * Originality.ai client stub (Sprint v7 Phase 16).
 *
 * Gate optionnel pour détection plagiat / AI-generated content via API
 * Originality.ai (https://originality.ai). Renforce les checks anti-doorway
 * HCU 2024-2026 + signal AI Act art. 50 (transparence sur la part IA).
 *
 * V1 squelette stub. API key gérée via env ORIGINALITY_AI_API_KEY :
 *   - Absente : gate désactivé, fallback warning loggé (non-bloquant)
 *   - Présente : appel API réel (productionisation Sessions 11+ avec retry +
 *     circuit breaker pattern aligné providers-router.ts existant)
 *
 * Coût : ~$0.01 par 1k mots scannés. Sur 30 articles/jour × 1500 mots = ~$13/mois.
 * Activable en Phase D (mois 13+) après stabilisation Quality Loop V1.
 */

function getApiKey(): string | undefined {
  return process.env.ORIGINALITY_AI_API_KEY;
}

export interface OriginalityScanResult {
  readonly originalityScore: number; // 0-100 (100 = 100% original)
  readonly aiDetectedScore: number; // 0-100 (probabilité contenu IA-généré)
  readonly plagiarismScore: number; // 0-100 (% similar passages found web)
  readonly scannedAt: string;
  readonly fallback: boolean; // true si stub fallback (key absent)
  readonly costUsd: number;
}

export interface OriginalityScanInput {
  readonly contentText: string; // Body text à scanner (≥ 100 mots requis)
  readonly contentUrl?: string; // URL canonique (audit trail)
  readonly contentType?: string; // ContentType slug
}

/**
 * Scan un texte via Originality.ai. Fallback safe si API key absente.
 *
 * Productionisation Sessions 11+ :
 *   - HTTP fetch POST https://api.originality.ai/api/v1/scan
 *   - Auth header Bearer ${API_KEY}
 *   - Body { content, aiModelVersion: "v3" }
 *   - Parse response.score.original × 100, ai_score, plagiarism
 *   - Retry 3× avec backoff exponentiel
 *   - Circuit breaker si > 5 fails consécutifs
 */
export async function scanWithOriginalityAi(
  input: OriginalityScanInput,
): Promise<OriginalityScanResult> {
  if (!getApiKey()) {
    console.log("[originality-ai] ORIGINALITY_AI_API_KEY absent — fallback warning non-bloquant");
    return {
      originalityScore: 100, // neutre, n'impacte pas le gate qualityScore
      aiDetectedScore: 0,
      plagiarismScore: 0,
      scannedAt: new Date().toISOString(),
      fallback: true,
      costUsd: 0,
    };
  }

  if (input.contentText.trim().length < 100) {
    throw new Error("originality_min_length:content_text must be ≥ 100 chars");
  }

  // V1 stub : retourne data fake mais structure attendue.
  // Sessions 11+ : appel HTTP réel.
  console.log("[originality-ai] V1 stub — HTTP API call reportée Sessions 11+");
  const wordCount = input.contentText.split(/\s+/).filter((w) => w.length > 0).length;
  const estimatedCost = (wordCount / 1000) * 0.01;
  return {
    originalityScore: 95, // stub neutre haut
    aiDetectedScore: 50, // stub neutre (peut être IA-assisté → AI Act art. 50 OK)
    plagiarismScore: 5, // stub neutre bas
    scannedAt: new Date().toISOString(),
    fallback: false,
    costUsd: estimatedCost,
  };
}

/**
 * Helper gate : retourne true si l'article passe les seuils Originality
 * (configurable via env vars). En mode fallback (pas d'API key), retourne
 * toujours true (gate inactif).
 */
export function passesOriginalityGate(result: OriginalityScanResult): {
  readonly passed: boolean;
  readonly reason: string | null;
} {
  if (result.fallback) {
    return { passed: true, reason: "fallback_no_api_key" };
  }
  const minOriginality = Number(process.env.ORIGINALITY_MIN_SCORE ?? 75);
  const maxAi = Number(process.env.ORIGINALITY_MAX_AI_SCORE ?? 90);
  const maxPlagiarism = Number(process.env.ORIGINALITY_MAX_PLAGIARISM ?? 20);

  if (result.originalityScore < minOriginality) {
    return {
      passed: false,
      reason: `originality_below_threshold:${result.originalityScore}<${minOriginality}`,
    };
  }
  if (result.aiDetectedScore > maxAi) {
    return { passed: false, reason: `ai_score_above_threshold:${result.aiDetectedScore}>${maxAi}` };
  }
  if (result.plagiarismScore > maxPlagiarism) {
    return {
      passed: false,
      reason: `plagiarism_above_threshold:${result.plagiarismScore}>${maxPlagiarism}`,
    };
  }
  return { passed: true, reason: null };
}
