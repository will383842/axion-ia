/**
 * Content Generator — Perplexity Sonar (data récente + citations extraites).
 *
 * Sprint 1 Day 2 AGT-B step 13:00 — implémentation complète :
 * - chat.completions style API (compatible OpenAI) avec model `sonar-pro`
 * - `search_recency_filter` ≤ N mois (default 12)
 * - citations[] extraites depuis la réponse (signal AEO/GEO majeur)
 * - retry × 3 backoff exp via withRetry
 * - timeout 60s (search tolère)
 * - tracking cost atomic via trackCost
 * - cost cap check pré-call
 * - PAS de fallback automatique (Perplexity = source unique data temps réel)
 *
 * Pricing 2026-05 (à mettre à jour si Perplexity change) :
 * - sonar-pro    : $3.00 / 1M input + $15.00 / 1M output + $5 / 1K searches
 * - sonar-medium : $1.00 / 1M input + $5.00 / 1M output + $5 / 1K searches
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 7.1.
 */

import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";
import { withRetry } from "../lib/retry";
import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";
import { readProviderConfig } from "../lib/config-reader";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_TIMEOUT_MS = 60_000;

interface PerplexityResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: ReadonlyArray<{
    readonly message: { readonly role: string; readonly content: string };
    readonly finish_reason: string;
  }>;
  readonly usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
  readonly citations?: ReadonlyArray<string>; // URLs
  readonly search_results?: ReadonlyArray<{
    readonly url: string;
    readonly title: string;
    readonly date?: string;
  }>;
}

const PRICING: Record<string, { input: number; output: number; searchPerCall: number }> = {
  "sonar-pro": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000, searchPerCall: 0.005 },
  "sonar-medium": { input: 1.0 / 1_000_000, output: 5.0 / 1_000_000, searchPerCall: 0.005 },
  sonar: { input: 1.0 / 1_000_000, output: 1.0 / 1_000_000, searchPerCall: 0.005 },
};

function computeCost(model: string, tokensInput: number, tokensOutput: number): number {
  const rates = PRICING[model] ?? PRICING["sonar-pro"];
  if (!rates) return 0;
  return tokensInput * rates.input + tokensOutput * rates.output + rates.searchPerCall;
}

function getApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new ProviderError("PERPLEXITY_API_KEY not set", "auth_failed", "perplexity", false);
  }
  return key;
}

/**
 * Map les erreurs HTTP Perplexity vers ProviderError typés.
 *
 * Exporté uniquement pour les tests (même motif que `mapOpenAiError`) : la
 * distinction 429 rate-limit / 429 quota décide du flag `retryable`, donc du
 * fait qu'un job reboucle indéfiniment ou échoue net.
 *
 * Fix 2026-08-15 (audit e2e, F3) — Perplexity avait le bug quota de juillet à
 * l'identique : TOUT 429 était mappé `rate_limited` retryable, sans détecter le
 * crédit épuisé. Un compte à sec ⇒ retries 10/30/60 s par appel + re-tentatives
 * BullMQ, cause invisible (le body d'origine était en plus écrasé par la
 * constante « Perplexity rate limited »). C'est exactement le bug déjà corrigé
 * pour OpenAI (`openai.ts`, AUDIT 2026-07-21) et Anthropic (`anthropic.ts`).
 *
 * ⚠️ Ordre important (leçon anthropic.ts) : on ne bascule en quota que sur une
 * mention EXPLICITE de crédit/quota épuisé, testée AVANT le rate-limit
 * générique — un message de rate-limit qui renvoie vers la page billing ne
 * doit PAS être classé quota. Bénéfice bonus : le code `quota_exhausted`
 * non-retryable permet au quota-guard de déclencher l'auto-arrêt si Perplexity
 * devient un jour un provider critique.
 */
export function mapPerplexityError(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(`Perplexity auth: ${body}`, "auth_failed", "perplexity", false);
  }
  if (status === 429) {
    const isQuota =
      /insufficient[_-]?(quota|credit)|credit balance|out of credits?|exceeded your current quota|purchase (more )?credits?/i.test(
        body,
      );
    if (isQuota) {
      // Message d'origine CONSERVÉ (il était écrasé avant le fix — la cause
      // réelle n'apparaissait ni en base ni dans les alertes).
      return new ProviderError(
        `Perplexity quota épuisé (compte à recharger) : ${body.slice(0, 300)}`,
        "quota_exhausted",
        "perplexity",
        false,
      );
    }
    return new ProviderError(
      `Perplexity rate limited: ${body.slice(0, 300)}`,
      "rate_limited",
      "perplexity",
      true,
    );
  }
  if (status >= 500) {
    return new ProviderError(`Perplexity server ${status}`, "down", "perplexity", true);
  }
  return new ProviderError(
    `Perplexity error ${status}: ${body.slice(0, 200)}`,
    "unknown",
    "perplexity",
    false,
  );
}

function monthsToRecencyFilter(months: number): string {
  if (months <= 1) return "month";
  if (months <= 12) return "year";
  return "year"; // Perplexity max = year
}

export const perplexityProvider: IProvider = {
  key: "perplexity",
  supportedRoles: ["data"],

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    if (req.role !== "data") {
      throw new ProviderError(
        `Perplexity supports data only (got '${req.role}')`,
        "unknown",
        "perplexity",
        false,
      );
    }

    const config = await readProviderConfig("perplexity");
    if (!config.enabled) {
      throw new ProviderError(
        "Perplexity provider disabled in DB",
        "auth_failed",
        "perplexity",
        false,
      );
    }
    const model = req.model ?? config.model;

    await assertCostCapAvailable("perplexity", 0.05);

    const apiKey = getApiKey();
    const startedAt = Date.now();

    const recencyFilter = monthsToRecencyFilter(req.searchRecencyMonths ?? 12);

    const body = {
      model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userPrompt },
      ],
      max_tokens: req.maxTokens ?? 4096,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      search_recency_filter: recencyFilter,
      // V2 : search_domain_filter pour scope sources (whitelist `insee.fr`, etc.)
    };

    const response: PerplexityResponse = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(PERPLEXITY_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutHandle);
        if (!res.ok) {
          const errBody = await res.text();
          throw mapPerplexityError(res.status, errBody);
        }
        return (await res.json()) as PerplexityResponse;
      } catch (err) {
        clearTimeout(timeoutHandle);
        if (err instanceof Error && err.name === "AbortError") {
          throw new ProviderError("Perplexity timeout", "timeout", "perplexity", true);
        }
        throw err instanceof ProviderError
          ? err
          : new ProviderError(
              `Perplexity fetch: ${err instanceof Error ? err.message : err}`,
              "unknown",
              "perplexity",
              false,
            );
      }
    });

    const content = response.choices[0]?.message?.content ?? "";
    if (!content) {
      throw new ProviderError(
        "Perplexity returned empty content",
        "invalid_response",
        "perplexity",
        false,
      );
    }

    // Extract citations — preferred `search_results[]` (rich), fallback `citations[]` (urls only)
    const citations = response.search_results
      ? response.search_results.map((sr) => ({
          url: sr.url,
          title: sr.title,
          ...(sr.date ? { publishedAt: sr.date } : {}),
        }))
      : (response.citations ?? []).map((url) => ({ url, title: url }));

    if (req.onStreamChunk) {
      // Perplexity API non-streaming pour now — on simule un seul chunk final.
      req.onStreamChunk(content);
    }

    const tokensInput = response.usage.prompt_tokens;
    const tokensOutput = response.usage.completion_tokens;
    const costUsd = computeCost(model, tokensInput, tokensOutput);
    const durationMs = Date.now() - startedAt;

    await trackCost({
      ...(req.jobId ? { jobId: req.jobId } : {}),
      provider: "perplexity",
      model,
      tokensInput,
      tokensOutput,
      costUsd,
    });

    return {
      provider: "perplexity",
      model,
      output: content,
      tokensInput,
      tokensOutput,
      costUsd,
      durationMs,
      citations,
    };
  },

  async healthCheck(): Promise<boolean> {
    if (!process.env.PERPLEXITY_API_KEY) return false;
    try {
      const config = await readProviderConfig("perplexity");
      if (!config.enabled) return false;
      // Mini-call ($0.005 + tokens) — pas idéal mais Perplexity n'a pas d'endpoint santé.
      const res = await fetch(PERPLEXITY_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
