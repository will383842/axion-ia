/**
 * Content Generator — OpenAI provider (text + rerank).
 *
 * Sprint 1 Day 2 AGT-B step 09:00 — implémentation complète :
 * - streaming `stream: true` + `onStreamChunk` hook (anti-waterfall § 9.11.2)
 * - retry × 3 backoff exp 10s/30s/60s via withRetry
 * - timeout 30s default (60s pour long-form)
 * - tracking cost atomic via trackCost (CostLedger + ProviderConfig increment)
 * - cost cap check pré-call via assertCostCapAvailable
 * - détection content_filter → ProviderError non-retryable
 *
 * Pricing 2026-05 (à mettre à jour si OpenAI change) :
 * - gpt-4o      : $2.50 / 1M input · $10.00 / 1M output
 * - gpt-4o-mini : $0.15 / 1M input · $0.60 / 1M output
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 7.1 + § 0.4.
 */

import OpenAI from "openai";
import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";
import { withRetry } from "../lib/retry";
import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";
import { readProviderConfig } from "../lib/config-reader";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Pricing table USD per token (input/output). Stable enough pour V1.
 * V2 : déplacer en DB `ProviderConfig.extraConfig.pricing` éditable admin.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4.1": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4.1-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
};

function computeCost(model: string, tokensInput: number, tokensOutput: number): number {
  const rates = PRICING[model] ?? PRICING["gpt-4o"];
  if (!rates) return 0;
  return tokensInput * rates.input + tokensOutput * rates.output;
}

/**
 * Map erreurs SDK OpenAI vers ProviderError typés.
 *
 * Exporté uniquement pour les tests : la distinction 429 rate-limit / 429 quota
 * décide du flag `retryable`, donc du fait qu'un job reboucle indéfiniment ou
 * échoue net. Cf. `__tests__/provider-error-mapping.spec.ts`.
 */
export function mapOpenAiError(err: unknown): ProviderError {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new ProviderError(
        `OpenAI auth failed: ${err.message}`,
        "auth_failed",
        "openai",
        false,
      );
    }
    // ⚠️ AUDIT 2026-07-21 — OpenAI renvoie 429 pour DEUX situations opposées :
    //   - `rate_limit_exceeded`  → transitoire, le retry a du sens
    //   - `insufficient_quota`   → crédit du compte épuisé, le retry ne peut
    //                              JAMAIS réussir tant qu'un humain n'a pas payé
    // L'ancien code mappait les deux vers `rate_limited` + `retryable: true` ET
    // écrasait `err.message` par une constante. Conséquences observées en prod :
    //   - 919 jobs échoués en 2 semaines, tous étiquetés « OpenAI rate limited »
    //     alors que le compte était en `insufficient_quota` depuis des jours ;
    //   - retries infinis sur une opération structurellement impossible, chaque
    //     tentative consommant un slot de couverture (slots monotones = perdus) ;
    //   - cause réelle invisible en base, en console admin et dans les alertes.
    if (status === 429) {
      const isQuota =
        err.code === "insufficient_quota" ||
        /insufficient[_-]quota|exceeded your current quota|check your plan and billing/i.test(
          err.message,
        );
      if (isQuota) {
        return new ProviderError(
          `OpenAI quota épuisé (compte à recharger) : ${err.message}`,
          "quota_exhausted",
          "openai",
          false,
        );
      }
      return new ProviderError(
        `OpenAI rate limited: ${err.message}`,
        "rate_limited",
        "openai",
        true,
      );
    }
    if (status && status >= 500) {
      return new ProviderError(`OpenAI server error ${status}`, "down", "openai", true);
    }
    // 400 + content_filter
    if (err.code === "content_filter" || /content[_-]filter/i.test(err.message)) {
      return new ProviderError(`OpenAI content filter`, "content_filter", "openai", false);
    }
    // 🔴 Cette branche est celle où `status` peut manquer : toutes les autres
    // sont gardées par un test sur sa valeur. Interpolé tel quel, il produisait
    // « OpenAI API error undefined: Connection error. » — le message que la
    // console affiche encore sur les jobs échoués, et qui ne dit rien à qui le
    // lit. Sans statut, on n'en invente pas : on n'écrit que ce qu'on sait.
    return new ProviderError(
      status === undefined
        ? `Erreur OpenAI (sans code HTTP) : ${err.message}`
        : `Erreur OpenAI ${status} : ${err.message}`,
      "unknown",
      "openai",
      false,
    );
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new ProviderError(`OpenAI timeout`, "timeout", "openai", true);
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new ProviderError(`OpenAI connection error`, "down", "openai", true);
  }
  return new ProviderError(
    `OpenAI unknown error: ${err instanceof Error ? err.message : String(err)}`,
    "unknown",
    "openai",
    false,
  );
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("OPENAI_API_KEY not set", "auth_failed", "openai", false);
  }
  // CORRECTIF 2026-06-19 — Forcer le fetch NATIF de Node. Le client HTTP par
  // défaut du SDK openai (node-fetch bundlé) coupe les réponses longues
  // (« Invalid response body … Premature close » à ~9s) sur les gros prompts de
  // génération (8000 maxTokens, 30-60s), faisant échouer TOUS les jobs content-gen.
  // Le fetch natif (globalThis.fetch / undici) tient les requêtes longues. Vérifié
  // en prod : SDK défaut → Premature close ; SDK + fetch natif → OK (13s).
  return new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT_MS, fetch: globalThis.fetch });
}

export const openaiProvider: IProvider = {
  key: "openai",
  supportedRoles: ["text", "image", "rerank"],

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    if (req.role !== "text" && req.role !== "rerank") {
      throw new ProviderError(
        `OpenAI provider V1 supports text/rerank only (got '${req.role}')`,
        "unknown",
        "openai",
        false,
      );
    }

    // 1. Config + cost cap check
    const config = await readProviderConfig("openai");
    if (!config.enabled) {
      throw new ProviderError("OpenAI provider disabled in DB", "auth_failed", "openai", false);
    }
    const model = req.model ?? config.model;

    // Estimation cost : ~10 cents par job text typique (V1 — affinée Day 5).
    await assertCostCapAvailable("openai", 0.1);

    const client = getClient();
    const startedAt = Date.now();
    let tokensInput = 0;
    let tokensOutput = 0;
    let fullText = "";
    let contentFilterTriggered = false;
    let truncatedByLength = false;

    // JSON mode (2026-07-01) : quand un générateur demande explicitement une sortie
    // JSON (plans/outlines) ET que le modèle le supporte, on force
    // `response_format: {type:"json_object"}` → GPT ne peut plus renvoyer de prose
    // hors JSON (cause des « plan invalide » / « outline parse failed »). Les prompts
    // de plan contiennent déjà « JSON » (contrainte OpenAI). Familles gpt-4o/4.1/4-turbo.
    const supportsJsonMode =
      /^gpt-4o/.test(model) || /^gpt-4\.1/.test(model) || /^gpt-4-turbo/.test(model);
    const useJsonFormat = req.responseFormatJson === true && supportsJsonMode;

    const executeCall = async () => {
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        stream: true,
        stream_options: { include_usage: true },
        ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(useJsonFormat ? { response_format: { type: "json_object" as const } } : {}),
      });

      for await (const chunk of stream) {
        // content_filter signal côté OpenAI (rare en streaming, plus souvent en delta finish_reason)
        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason === "content_filter") {
          contentFilterTriggered = true;
        }
        // Troncature LLM (audit 2026-06-25) : finish_reason="length" = sortie coupée
        // (maxTokens atteint). On NE throw PAS (les gates word-count en aval gèrent),
        // mais on rend la troncature OBSERVABLE au lieu de la persister en silence.
        if (finishReason === "length") {
          truncatedByLength = true;
        }
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          if (req.onStreamChunk) req.onStreamChunk(delta);
        }
        if (chunk.usage) {
          tokensInput = chunk.usage.prompt_tokens;
          tokensOutput = chunk.usage.completion_tokens;
        }
      }
    };

    try {
      await withRetry(async () => {
        try {
          await executeCall();
        } catch (err) {
          throw mapOpenAiError(err);
        }
      });
    } catch (err) {
      // ProviderError final après retry exhausted ou non-retryable
      throw err instanceof ProviderError ? err : mapOpenAiError(err);
    }

    if (contentFilterTriggered) {
      throw new ProviderError(
        "OpenAI content filter triggered mid-stream",
        "content_filter",
        "openai",
        false,
      );
    }
    if (!fullText || fullText.trim().length === 0) {
      // Sortie VIDE (throttling « soft » OpenAI sans 429, ou quota dégradé) :
      // RETRYABLE=true → le routeur bascule sur le fallback (Anthropic) au lieu
      // d'échouer le job. Avant : `false` (non-retryable) = échec sec SANS fallback
      // → cause racine des « plan invalide » / « outline parse failed » / « aucun
      // output valide » intermittents (2026-07-02).
      throw new ProviderError("OpenAI returned empty content", "invalid_response", "openai", true);
    }
    if (truncatedByLength) {
      console.warn(
        `[openai] ⚠️ sortie TRONQUÉE (finish_reason="length", model=${model}, ` +
          `maxTokens=${req.maxTokens ?? "default"}, ${tokensOutput} tokens) — ` +
          `contenu potentiellement incomplet ; les gates word-count en aval s'appliquent.`,
      );
    }

    const costUsd = computeCost(model, tokensInput, tokensOutput);
    const durationMs = Date.now() - startedAt;

    // 2. Track cost atomic (CostLedger + ProviderConfig increment)
    await trackCost({
      ...(req.jobId ? { jobId: req.jobId } : {}),
      provider: "openai",
      model,
      tokensInput,
      tokensOutput,
      costUsd,
    });

    return {
      provider: "openai",
      model,
      output: fullText,
      tokensInput,
      tokensOutput,
      costUsd,
      durationMs,
      contentFilterTriggered: false,
    };
  },

  async healthCheck(): Promise<boolean> {
    if (!process.env.OPENAI_API_KEY) return false;
    try {
      const config = await readProviderConfig("openai");
      if (!config.enabled) return false;
      // Health check léger via /v1/models (pas de cost). Sprint 1 Day 2 implémente
      // un cache Redis 60s pour éviter hammering.
      const client = getClient();
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  },
};
