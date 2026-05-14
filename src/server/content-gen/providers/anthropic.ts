/**
 * Content Generator — Anthropic provider (text long-form + prompt caching).
 *
 * Sprint 1 Day 1 AGT-B = STUB typé. Implémentation Day 2 § 13:00 :
 * - streaming `stream: true`
 * - prompt caching `cache_control: ephemeral` sur system prompt (§ 9.11.3)
 * - retry × 3 backoff exp
 * - timeout 60s (long-form tolère)
 * - tracking cost + cache_read_input_tokens / cache_creation_input_tokens
 *
 * Modèle default V1 : `claude-sonnet-4-6` (master prompt Q2 option recommandée),
 * fallback `claude-opus-4-7` pour qualité maximale (cost cap permettant).
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";

// process.env direct (cf. openai.ts) — Day 2 wrappera via ProviderConfig DB.

export const anthropicProvider: IProvider = {
  key: "anthropic",
  supportedRoles: ["text"],

  async generate(_req: GenerationRequest): Promise<GenerationResponse> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ProviderError("ANTHROPIC_API_KEY not set", "auth_failed", "anthropic", false);
    }
    throw new ProviderError(
      "anthropic.generate not yet implemented (Sprint 1 Day 2)",
      "unknown",
      "anthropic",
      false,
    );
  },

  async healthCheck(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
};
