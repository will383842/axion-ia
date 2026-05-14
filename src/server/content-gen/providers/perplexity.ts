/**
 * Content Generator — Perplexity Sonar (data récente + citations extraites).
 *
 * Sprint 1 Day 1 AGT-B = STUB typé. Implémentation Day 2 § 13:00 :
 * - `search_recency_filter` ≤ N mois (default 12)
 * - citations extraites depuis la réponse → tableau `citations[]`
 * - retry × 3 backoff exp
 * - timeout 60s (search tolère)
 * - PAS de fallback (Perplexity = source unique pour données temps réel)
 *
 * Modèle default V1 : `sonar-pro` (haute qualité, plus cher).
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";

export const perplexityProvider: IProvider = {
  key: "perplexity",
  supportedRoles: ["data"],

  async generate(_req: GenerationRequest): Promise<GenerationResponse> {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new ProviderError("PERPLEXITY_API_KEY not set", "auth_failed", "perplexity", false);
    }
    throw new ProviderError(
      "perplexity.generate not yet implemented (Sprint 1 Day 2)",
      "unknown",
      "perplexity",
      false,
    );
  },

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.PERPLEXITY_API_KEY);
  },
};
