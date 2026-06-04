// Génération LLM streamée (T-07) — wrapper sur provider-router (Anthropic).
//
// Le router applique déjà prompt caching (cache_control ephemeral) sur le system
// prompt + cost-cap. On résout les tokens {{price}} de la sortie (SSOT) AVANT
// de la rendre (l'output-guard re-vérifie ensuite). Sélection du modèle par
// palier (D-LLM-TIER : sonnet/haiku).

import { generate } from "@/server/content-gen/providers/provider-router";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import type { LlmTier } from "@/server/chatbot/constants";

const MODEL_BY_TIER: Record<LlmTier, string> = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
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
export const generateAnswer: GenerateAnswerFn = async (opts) => {
  const res = await generate({
    jobId: `chatbot-${Date.now()}`,
    contentType: "qa_derived",
    role: "text",
    preferredProvider: "anthropic",
    model: MODEL_BY_TIER[opts.tier],
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
};
