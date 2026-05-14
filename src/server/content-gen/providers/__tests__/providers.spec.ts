/**
 * Sprint 1 Day 1 AGT-B — Tests minimaux des stubs providers.
 *
 * Vérifie le contrat IProvider (key + supportedRoles) sur chaque stub.
 * Les tests d'implémentation réelle (streaming, retry, cost tracking) sont
 * ajoutés Sprint 1 Day 2.
 */

import { describe, expect, it } from "vitest";
import { openaiProvider } from "../openai";
import { anthropicProvider } from "../anthropic";
import { perplexityProvider } from "../perplexity";
import { unsplashProvider } from "../unsplash";
import { ProviderError } from "../IProvider";

describe("Content Generator providers — stub contract (Sprint 1 Day 1)", () => {
  it("openaiProvider exposes key + supportedRoles", () => {
    expect(openaiProvider.key).toBe("openai");
    expect(openaiProvider.supportedRoles).toContain("text");
    expect(openaiProvider.supportedRoles).toContain("image");
    expect(openaiProvider.supportedRoles).toContain("rerank");
  });

  it("anthropicProvider exposes key + supportedRoles (text only)", () => {
    expect(anthropicProvider.key).toBe("anthropic");
    expect(anthropicProvider.supportedRoles).toEqual(["text"]);
  });

  it("perplexityProvider exposes key + supportedRoles (data only)", () => {
    expect(perplexityProvider.key).toBe("perplexity");
    expect(perplexityProvider.supportedRoles).toEqual(["data"]);
  });

  it("unsplashProvider exposes key + supportedRoles (stock_image only)", () => {
    expect(unsplashProvider.key).toBe("unsplash");
    expect(unsplashProvider.supportedRoles).toEqual(["stock_image"]);
  });

  it("generate() throws ProviderError when API key absent", async () => {
    // Toutes les implémentations Sprint 1 sont des stubs qui throw auth_failed
    // si la clé env est absente. Le test est volontairement tolérant : on accepte
    // soit auth_failed (clé absente) soit unknown (stub Day 2-4 not implemented).
    const dummyReq = {
      jobId: "test-job-1",
      contentType: "blog_article",
      role: "text" as const,
      systemPrompt: "test",
      userPrompt: "test",
    };

    await expect(openaiProvider.generate(dummyReq)).rejects.toThrow(ProviderError);
  });
});
