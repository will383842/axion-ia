/**
 * Régression Fix 2026-08-15 (audit e2e, F3) — mapping des erreurs HTTP
 * Perplexity vers `retryable`.
 *
 * Le bug corrigé : Perplexity avait le bug quota de juillet À L'IDENTIQUE —
 * TOUT 429 était mappé `rate_limited` retryable (et le body d'origine écrasé
 * par la constante « Perplexity rate limited »). Un compte à sec ⇒ retries
 * 10/30/60 s par appel + re-tentatives BullMQ, cause invisible partout.
 * C'est le même bug déjà corrigé pour OpenAI et Anthropic, verrouillé par
 * `provider-error-mapping.spec.ts` — mêmes assertions ici.
 *
 * Perplexity n'a pas de SDK Stainless : le mapper reçoit (status, body texte
 * brut) directement depuis le fetch — pas besoin de fabriquer un APIError.
 */

import { describe, expect, it } from "vitest";
import { mapPerplexityError } from "../perplexity";

describe("mapPerplexityError — 429 quota vs 429 rate-limit", () => {
  it("429 crédit épuisé → quota_exhausted, NON retryable", () => {
    const mapped = mapPerplexityError(
      429,
      '{"error":{"message":"Your credit balance is too low. Please purchase more credits.","type":"insufficient_quota"}}',
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("429 « exceeded your current quota » → quota_exhausted, NON retryable", () => {
    const mapped = mapPerplexityError(
      429,
      "You exceeded your current quota, please check your plan and billing details.",
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("429 rate-limit transitoire → rate_limited, RETRYABLE", () => {
    const mapped = mapPerplexityError(
      429,
      '{"error":{"message":"Rate limit exceeded. Please retry after a few seconds.","type":"rate_limit_exceeded"}}',
    );

    expect(mapped.code).toBe("rate_limited");
    expect(mapped.retryable).toBe(true);
  });

  it("429 mentionnant la page billing SANS mention explicite de crédit reste RETRYABLE (piège anthropic.ts)", () => {
    // Le motif quota ne doit matcher que sur une mention EXPLICITE de crédit
    // épuisé : un message de rate-limit renvoyant vers la page « billing »
    // ne doit pas tuer le job (leçon du fix Anthropic 2026-07-21, 2e passe).
    const mapped = mapPerplexityError(
      429,
      "Rate limit exceeded. See your billing page for higher limits.",
    );

    expect(mapped.code).toBe("rate_limited");
    expect(mapped.retryable).toBe(true);
  });

  it("conserve le message original du provider (il était écrasé avant le fix)", () => {
    const quota = mapPerplexityError(429, "Your credit balance is too low.");
    const rateLimit = mapPerplexityError(429, "Rate limit exceeded on sonar-pro.");

    expect(quota.message).toContain("Your credit balance is too low.");
    expect(rateLimit.message).toContain("Rate limit exceeded on sonar-pro.");
  });

  it("401 reste auth_failed non-retryable (pas de régression collatérale)", () => {
    const mapped = mapPerplexityError(401, "Invalid API key");

    expect(mapped.code).toBe("auth_failed");
    expect(mapped.retryable).toBe(false);
  });

  it("5xx reste down + retryable", () => {
    const mapped = mapPerplexityError(503, "Service Unavailable");

    expect(mapped.code).toBe("down");
    expect(mapped.retryable).toBe(true);
  });
});
