/**
 * Originality.ai client stub (Sprint v7 Phase 16).
 *
 * Gate optionnel pour détection plagiat / AI-generated content via API
 * Originality.ai (https://originality.ai). Renforce les checks anti-doorway
 * HCU 2024-2026 + signal AI Act art. 50 (transparence sur la part IA).
 *
 * API key gérée via env ORIGINALITY_AI_API_KEY :
 *   - Absente : gate désactivé honnêtement, warning loggé (non-bloquant)
 *   - Présente : appel HTTP réel /scan/ai (fail-open si erreur réseau/API)
 *   ⚠️ Contrat API à valider contre une vraie clé lors de l'activation.
 *
 * Coût : ~$0.01 par 1k mots scannés. Sur 30 articles/jour × 1500 mots = ~$13/mois.
 * Activable en Phase D (mois 13+) après stabilisation Quality Loop V1.
 */

/** Endpoint AI-detection Originality.ai (v1). */
const ORIGINALITY_API_URL = "https://api.originality.ai/api/v1/scan/ai";

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

  const apiKey = getApiKey()!; // garanti présent (early-return ci-dessus si absent)
  const wordCount = input.contentText.split(/\s+/).filter((w) => w.length > 0).length;
  const estimatedCost = (wordCount / 1000) * 0.01;

  // Appel HTTP réel Originality.ai — endpoint AI-detection v1.
  // ⚠️ À valider contre une vraie clé lors de l'activation (le contrat exact de
  // l'API peut évoluer) ; en cas d'erreur on fail-open (non-bloquant) pour ne
  // jamais geler la génération sur une dépendance externe.
  try {
    const res = await fetch(ORIGINALITY_API_URL, {
      method: "POST",
      headers: {
        "X-OAI-API-KEY": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        content: input.contentText,
        title: input.contentUrl ?? input.contentType ?? "axion-ia",
        aiModelVersion: "1",
        storeScan: "false",
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`originality HTTP ${res.status} ${res.statusText} ${detail}`.trim());
    }
    const json = (await res.json()) as {
      score?: { ai?: number; original?: number };
      // L'endpoint /scan/ai ne renvoie pas le plagiat (crédits séparés /scan/plag).
    };
    const aiFraction = json.score?.ai ?? 0; // 0..1
    const originalFraction = json.score?.original ?? 1 - aiFraction; // 0..1
    return {
      originalityScore: Math.round(originalFraction * 100),
      aiDetectedScore: Math.round(aiFraction * 100),
      plagiarismScore: 0, // non couvert par l'endpoint AI ; gate plagiat = no-op
      scannedAt: new Date().toISOString(),
      fallback: false,
      costUsd: estimatedCost,
    };
  } catch (err) {
    // Fail-open : on ne bloque jamais la publication sur une panne Originality.ai.
    console.warn(
      "[originality-ai] scan échoué, fail-open (non-bloquant) :",
      (err as Error).message,
    );
    return {
      originalityScore: 100,
      aiDetectedScore: 0,
      plagiarismScore: 0,
      scannedAt: new Date().toISOString(),
      fallback: true,
      costUsd: 0,
    };
  }
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
