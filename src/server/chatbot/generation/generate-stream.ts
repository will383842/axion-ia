// Génération LLM streamée (T-07) — wrapper sur provider-router (Anthropic).
//
// Le router applique déjà prompt caching (cache_control ephemeral) sur le system
// prompt + cost-cap. On résout les tokens {{price}} de la sortie (SSOT) AVANT
// de la rendre (l'output-guard re-vérifie ensuite). Sélection du modèle par
// palier (D-LLM-TIER : sonnet/haiku).

import { generate } from "@/server/content-gen/providers/provider-router";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import type { LlmTier } from "@/server/chatbot/constants";
import { CircuitBreaker } from "@/server/chatbot/resilience/circuit-breaker";

// T-16 — disjoncteur sur l'appel LLM externe. Après 4 échecs consécutifs
// (Anthropic down / rate-limit / timeout), on ouvre 15 s : les tours suivants
// échouent immédiatement (fail-fast) → l'orchestrateur bascule en mode dégradé
// (RDV) sans empiler des timeouts. Un essai half-open referme au retour du service.
const llmBreaker = new CircuitBreaker({
  name: "llm-anthropic",
  failureThreshold: 4,
  cooldownMs: 15_000,
});

// Provider de génération du chatbot. Décision Will 2026-06-05 : bascule sur
// OpenAI (Anthropic = 0 crédit ; gpt-4o-mini ~7-8× moins cher que Haiku pour ce
// usage, et l'output-guard garantit le zéro-hallucination quel que soit le modèle).
// Le tier "haiku" (faqSimple) → gpt-4o-mini (le moins cher) ; "sonnet" → gpt-4o.
const GENERATION_PROVIDER = (process.env.CHATBOT_LLM_PROVIDER ?? "openai") as
  | "openai"
  | "anthropic";

const MODEL_BY_TIER: Record<"openai" | "anthropic", Record<LlmTier, string>> = {
  openai: {
    sonnet: "gpt-4o",
    haiku: "gpt-4o-mini",
  },
  anthropic: {
    sonnet: "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5",
  },
};

export interface GenerateAnswerOptions {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly tier: LlmTier;
  readonly maxTokens?: number;
  /** Callback de streaming token-par-token (typing). */
  readonly onChunk?: (chunk: string) => void;
}

export interface GeneratedAnswer {
  readonly text: string;
  readonly model: string;
  readonly costUsd: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
}

/** Fonction de génération injectable (mockée en test). */
export type GenerateAnswerFn = (opts: GenerateAnswerOptions) => Promise<GeneratedAnswer>;

/** Implémentation réelle via provider-router (Anthropic, streamé, prompt caching). */
export const generateAnswer: GenerateAnswerFn = async (opts) =>
  llmBreaker.run(async () => {
    const res = await generate({
      jobId: `chatbot-${Date.now()}`,
      contentType: "qa_derived",
      role: "text",
      preferredProvider: GENERATION_PROVIDER,
      model: MODEL_BY_TIER[GENERATION_PROVIDER][opts.tier],
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      stream: true,
      maxTokens: opts.maxTokens ?? 800,
      temperature: 0.4,
      ...(opts.onChunk ? { onStreamChunk: opts.onChunk } : {}),
    });
    return {
      text: resolvePriceTokens(res.output, "fr"),
      model: res.model,
      costUsd: res.costUsd,
      tokensInput: res.tokensInput,
      tokensOutput: res.tokensOutput,
    };
  });
