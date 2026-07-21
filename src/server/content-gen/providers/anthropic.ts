/**
 * Content Generator — Anthropic provider (Claude text + prompt caching).
 *
 * Sprint 1 Day 2 AGT-B step 13:00 — implémentation complète :
 * - streaming `stream: true`
 * - prompt caching `cache_control: { type: "ephemeral" }` sur system prompt
 *   (§ 9.11.3 — cache 5 min TTL Anthropic)
 * - retry × 3 backoff exp via withRetry
 * - timeout 60s (long-form Claude tolère)
 * - tracking cost atomic via trackCost
 * - cost cap check pré-call via assertCostCapAvailable
 * - cache_read_input_tokens + cache_creation_input_tokens trackés (économie réelle)
 *
 * Pricing 2026-05 (à mettre à jour si Anthropic change) :
 * - claude-sonnet-4-6 : $3.00 / 1M input · $15.00 / 1M output
 *                       cache_read = $0.30 / 1M (10× cheaper)
 *                       cache_write = $3.75 / 1M (25% premium 1ʳᵉ fois)
 * - claude-opus-4-7   : $15.00 / 1M input · $75.00 / 1M output
 *                       cache_read = $1.50 / 1M · cache_write = $18.75 / 1M
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 7.1 + § 9.11.3.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";
import { withRetry } from "../lib/retry";
import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";
import { readProviderConfig } from "../lib/config-reader";

const DEFAULT_TIMEOUT_MS = 60_000; // 60s — long-form Claude

/**
 * Pricing table USD per token (input/output + cache). Stable enough V1.
 * V2 : déplacer en DB `ProviderConfig.extraConfig.pricing`.
 */
const PRICING: Record<
  string,
  {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  }
> = {
  "claude-sonnet-4-6": {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  // Opus 4.x — tarif réel Anthropic : $15 / $75 par 1M tokens (cache read
  // $1.50, cache write $18.75). Aligné sur le commentaire de doc en tête de
  // fichier ET sur src/server/clients/claude-search.ts (qui price déjà $15/$75).
  // NB : inerte côté content-gen (route GPT-4o → Sonnet ; Opus jamais
  // sélectionné par défaut) — c'est un cap de sécurité correct si on l'active.
  "claude-opus-4-8": {
    input: 15.0 / 1_000_000,
    output: 75.0 / 1_000_000,
    cacheRead: 1.5 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  "claude-opus-4-7": {
    input: 15.0 / 1_000_000,
    output: 75.0 / 1_000_000,
    cacheRead: 1.5 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  "claude-haiku-4-5": {
    input: 1.0 / 1_000_000,
    output: 5.0 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
    cacheWrite: 1.25 / 1_000_000,
  },
};

function computeCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
  cacheRead: number,
  cacheWrite: number,
): number {
  const rates = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  if (!rates) return 0;
  return (
    tokensInput * rates.input +
    tokensOutput * rates.output +
    cacheRead * rates.cacheRead +
    cacheWrite * rates.cacheWrite
  );
}

/** Exporté pour les tests — cf. `mapOpenAiError` dans `openai.ts`. */
export function mapAnthropicError(err: unknown): ProviderError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new ProviderError(`Anthropic auth: ${err.message}`, "auth_failed", "anthropic", false);
    }
    // Un 429 Anthropic est un rate-limit, POINT. Le crédit épuisé arrive en 400
    // (`invalid_request_error` « Your credit balance is too low ») ou en 402 —
    // jamais en 429.
    //
    // ⚠️ AUDIT 2026-07-21 (2e passe) — ce branchement DOIT précéder le test
    // quota ci-dessous, qui accepte le simple mot « billing ». Or le message de
    // rate-limit d'Anthropic renvoie lui-même vers la page « Plans & Billing » :
    // avec l'ordre inverse, un vrai rate-limit transitoire était classé
    // `quota_exhausted` NON-retryable et le job mourait alors qu'un simple
    // retry aurait abouti. C'est le bug corrigé pour OpenAI, à l'envers.
    // Ici on ne bascule en quota que sur une mention EXPLICITE de crédit.
    if (status === 429) {
      const isQuota = /credit balance is too low|insufficient[_-]quota/i.test(err.message);
      if (isQuota) {
        return new ProviderError(
          `Anthropic quota épuisé (compte à recharger) : ${err.message}`,
          "quota_exhausted",
          "anthropic",
          false,
        );
      }
      return new ProviderError(
        `Anthropic rate limited: ${err.message}`,
        "rate_limited",
        "anthropic",
        true,
      );
    }
    // Hors 429, le motif large reste justifié : c'est là qu'Anthropic signale
    // réellement le crédit épuisé (400 `invalid_request_error`, 402). Observé en
    // prod : 128 jobs échoués sous l'étiquette générique « Anthropic API 400 ».
    if (
      /credit balance is too low|billing|insufficient[_-]quota/i.test(err.message) ||
      status === 402
    ) {
      return new ProviderError(
        `Anthropic quota épuisé (compte à recharger) : ${err.message}`,
        "quota_exhausted",
        "anthropic",
        false,
      );
    }
    if (status && status >= 500) {
      return new ProviderError(`Anthropic server ${status}`, "down", "anthropic", true);
    }
    if (status === 400 && /content[_-]filter|policy/i.test(err.message)) {
      return new ProviderError(`Anthropic content filter`, "content_filter", "anthropic", false);
    }
    return new ProviderError(
      `Anthropic API ${status}: ${err.message}`,
      "unknown",
      "anthropic",
      false,
    );
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ProviderError(`Anthropic timeout`, "timeout", "anthropic", true);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ProviderError(`Anthropic connection error`, "down", "anthropic", true);
  }
  return new ProviderError(
    `Anthropic unknown: ${err instanceof Error ? err.message : String(err)}`,
    "unknown",
    "anthropic",
    false,
  );
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderError("ANTHROPIC_API_KEY not set", "auth_failed", "anthropic", false);
  }
  return new Anthropic({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
}

export const anthropicProvider: IProvider = {
  key: "anthropic",
  supportedRoles: ["text"],

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    if (req.role !== "text") {
      throw new ProviderError(
        `Anthropic supports text only (got '${req.role}')`,
        "unknown",
        "anthropic",
        false,
      );
    }

    const config = await readProviderConfig("anthropic");
    if (!config.enabled) {
      throw new ProviderError(
        "Anthropic provider disabled in DB",
        "auth_failed",
        "anthropic",
        false,
      );
    }
    const model = req.model ?? config.model;

    await assertCostCapAvailable("anthropic", 0.15);

    const client = getClient();
    const startedAt = Date.now();
    let tokensInput = 0;
    let tokensOutput = 0;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let fullText = "";
    let stopReason: string | null = null;

    // Les modèles Claude 4.7+ (Opus 4.7/4.8, Sonnet 5, Fable 5, Mythos 5) REFUSENT
    // les paramètres d'échantillonnage : envoyer `temperature` déclenche un
    // 400 invalid_request_error. On ne transmet donc `temperature` qu'aux modèles
    // qui l'acceptent encore (Opus 4.6, Sonnet 4.6, Haiku 4.5 et antérieurs).
    const SAMPLING_PARAM_REJECTING_MODELS = new Set<string>([
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-sonnet-5",
      "claude-fable-5",
      "claude-mythos-5",
    ]);
    const sendTemperature =
      req.temperature !== undefined && !SAMPLING_PARAM_REJECTING_MODELS.has(model);

    const executeCall = async () => {
      const stream = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? 4096,
        ...(sendTemperature ? { temperature: req.temperature } : {}),
        // System avec prompt caching (cache 5 min TTL côté Anthropic)
        system: [
          {
            type: "text",
            text: req.systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: req.userPrompt }],
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const delta = event.delta.text;
          fullText += delta;
          if (req.onStreamChunk) req.onStreamChunk(delta);
        }
        if (event.type === "message_start" && event.message.usage) {
          tokensInput = event.message.usage.input_tokens;
          cacheReadInputTokens = event.message.usage.cache_read_input_tokens ?? 0;
          cacheCreationInputTokens = event.message.usage.cache_creation_input_tokens ?? 0;
        }
        if (event.type === "message_delta" && event.usage) {
          tokensOutput = event.usage.output_tokens;
          if (event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason;
          }
        }
      }
    };

    try {
      await withRetry(async () => {
        try {
          await executeCall();
        } catch (err) {
          throw mapAnthropicError(err);
        }
      });
    } catch (err) {
      throw err instanceof ProviderError ? err : mapAnthropicError(err);
    }

    if (stopReason === "max_tokens") {
      // Troncature LLM (audit 2026-06-25) : la sortie a atteint max_tokens = coupée.
      // On NE throw PAS (les gates word-count en aval gèrent) mais on rend la
      // troncature OBSERVABLE au lieu de la persister en silence (avant : « OK »).
      console.warn(
        `[anthropic] ⚠️ sortie TRONQUÉE (stop_reason="max_tokens", model=${model}, ` +
          `maxTokens=${req.maxTokens ?? 4096}, ${tokensOutput} tokens) — ` +
          `contenu potentiellement incomplet ; gates word-count en aval appliquées.`,
      );
    } else if (stopReason === "stop_sequence" || stopReason === "end_turn") {
      // OK
    } else if (stopReason === "tool_use" || stopReason === "pause_turn") {
      // OK pour V1 (tool_use pas utilisé V1)
    } else if (stopReason) {
      // refusal / autre — log warning
      console.warn(`[anthropic] unexpected stop_reason: ${stopReason}`);
    }
    if (!fullText) {
      throw new ProviderError(
        "Anthropic returned empty content",
        "invalid_response",
        "anthropic",
        false,
      );
    }

    const costUsd = computeCost(
      model,
      tokensInput,
      tokensOutput,
      cacheReadInputTokens,
      cacheCreationInputTokens,
    );
    const durationMs = Date.now() - startedAt;

    await trackCost({
      ...(req.jobId ? { jobId: req.jobId } : {}),
      provider: "anthropic",
      model,
      tokensInput: tokensInput + cacheReadInputTokens + cacheCreationInputTokens,
      tokensOutput,
      costUsd,
    });

    return {
      provider: "anthropic",
      model,
      output: fullText,
      tokensInput,
      tokensOutput,
      costUsd,
      durationMs,
      cacheReadInputTokens,
      cacheCreationInputTokens,
    };
  },

  async healthCheck(): Promise<boolean> {
    if (!process.env.ANTHROPIC_API_KEY) return false;
    try {
      const config = await readProviderConfig("anthropic");
      if (!config.enabled) return false;
      // Anthropic ne propose pas d'endpoint /models, on fait un mini-call ($0.0001)
      const client = getClient();
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 5,
        messages: [{ role: "user", content: "Hi" }],
      });
      return true;
    } catch {
      return false;
    }
  },
};
