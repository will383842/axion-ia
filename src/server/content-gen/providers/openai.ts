/**
 * Content Generator — OpenAI provider (text + embeddings + image legacy).
 *
 * Sprint 1 Day 1 AGT-B = STUB typé. Implémentation complète Day 2 :
 * - streaming `stream: true` + onStreamChunk hook
 * - retry × 3 backoff exp (10s/30s/60s)
 * - timeout 30s
 * - parsing JSON output strict (Zod validation)
 * - tracking cost en CostLedger (atomic Prisma transaction)
 * - détection content_filter → re-prompt neutre
 *
 * Cf. _AUDIT/SPRINT-1-DAY-BY-DAY.md Day 2 § 09:00.
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";

// Lecture directe process.env (PAS @/env t3-validator) — les stubs doivent
// rester testable côté Vitest (t3-env throw côté client-side detected).
// Day 2 : wrapper `getProviderConfig()` qui lit ProviderConfig DB.

export const openaiProvider: IProvider = {
  key: "openai",
  supportedRoles: ["text", "image", "rerank"],

  async generate(_req: GenerationRequest): Promise<GenerationResponse> {
    if (!process.env.OPENAI_API_KEY) {
      throw new ProviderError("OPENAI_API_KEY not set", "auth_failed", "openai", false);
    }
    // Sprint 1 Day 2 — implémentation streaming + retry + cost tracking
    throw new ProviderError(
      "openai.generate not yet implemented (Sprint 1 Day 2)",
      "unknown",
      "openai",
      false,
    );
  },

  async healthCheck(): Promise<boolean> {
    // Sprint 1 Day 2 — appel light /models endpoint avec cache Redis 60s
    return Boolean(process.env.OPENAI_API_KEY);
  },
};
