import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationRequest, GenerationResponse } from "../IProvider";

const { openaiMock, anthropicMock } = vi.hoisted(() => ({
  openaiMock: {
    key: "openai" as const,
    generate: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  },
  anthropicMock: {
    key: "anthropic" as const,
    generate: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../openai", () => ({ openaiProvider: openaiMock }));
vi.mock("../anthropic", () => ({ anthropicProvider: anthropicMock }));
vi.mock("../perplexity", () => ({
  perplexityProvider: { key: "perplexity", generate: vi.fn(), healthCheck: vi.fn() },
}));
vi.mock("../unsplash", () => ({
  unsplashProvider: { key: "unsplash", generate: vi.fn(), healthCheck: vi.fn() },
}));

import { _resetCircuits, generateCompete } from "../provider-router";

const baseReq: GenerationRequest = {
  jobId: "j-1",
  contentType: "blog_article",
  role: "text",
  systemPrompt: "system",
  userPrompt: "user",
};

function fakeResponse(provider: "openai" | "anthropic", output: string): GenerationResponse {
  return {
    provider,
    model: provider === "openai" ? "gpt-4o" : "claude-sonnet-4-6",
    output,
    tokensInput: 100,
    tokensOutput: 200,
    costUsd: 0.01,
    durationMs: 1500,
  };
}

describe("generateCompete", () => {
  beforeEach(() => {
    _resetCircuits();
    openaiMock.generate.mockReset();
    anthropicMock.generate.mockReset();
  });

  afterEach(() => {
    _resetCircuits();
  });

  it("returns the highest-scoring response when both succeed", async () => {
    openaiMock.generate.mockResolvedValue(fakeResponse("openai", "openai content"));
    anthropicMock.generate.mockResolvedValue(fakeResponse("anthropic", "anthropic content"));

    const scoreFn = (r: GenerationResponse): number => (r.provider === "anthropic" ? 88 : 72);

    const winner = await generateCompete(baseReq, scoreFn);
    expect(winner.provider).toBe("anthropic");
    expect(openaiMock.generate).toHaveBeenCalledOnce();
    expect(anthropicMock.generate).toHaveBeenCalledOnce();
  });

  it("returns openai when it scores higher", async () => {
    openaiMock.generate.mockResolvedValue(fakeResponse("openai", "openai content"));
    anthropicMock.generate.mockResolvedValue(fakeResponse("anthropic", "anthropic content"));

    const scoreFn = (r: GenerationResponse): number => (r.provider === "openai" ? 90 : 60);

    const winner = await generateCompete(baseReq, scoreFn);
    expect(winner.provider).toBe("openai");
  });

  it("returns the surviving provider when one fails", async () => {
    openaiMock.generate.mockRejectedValue(new Error("OpenAI down"));
    anthropicMock.generate.mockResolvedValue(fakeResponse("anthropic", "fallback"));

    const winner = await generateCompete(baseReq, () => 50);
    expect(winner.provider).toBe("anthropic");
  });

  it("throws when both fail", async () => {
    openaiMock.generate.mockRejectedValue(new Error("OpenAI down"));
    anthropicMock.generate.mockRejectedValue(new Error("Anthropic down"));

    await expect(generateCompete(baseReq, () => 50)).rejects.toThrow();
  });

  it("skips candidates whose scoreFn throws", async () => {
    openaiMock.generate.mockResolvedValue(fakeResponse("openai", "broken"));
    anthropicMock.generate.mockResolvedValue(fakeResponse("anthropic", "ok"));

    const scoreFn = (r: GenerationResponse): number => {
      if (r.provider === "openai") throw new Error("score parse error");
      return 80;
    };

    const winner = await generateCompete(baseReq, scoreFn);
    expect(winner.provider).toBe("anthropic");
  });

  it("falls back to single-mode generate when only one eligible candidate", async () => {
    // Forcer circuit OpenAI ouvert via récidive failures
    for (let i = 0; i < 6; i++) {
      openaiMock.generate.mockRejectedValueOnce(new Error("rate_limited"));
    }
    anthropicMock.generate.mockResolvedValue(fakeResponse("anthropic", "fallback only"));

    // 5 failures pour ouvrir le circuit
    const { generate } = await import("../provider-router");
    for (let i = 0; i < 5; i++) {
      try {
        await generate(baseReq);
      } catch {
        // ignore
      }
    }

    // Reset anthropic mock pour compete test propre
    anthropicMock.generate.mockClear();
    anthropicMock.generate.mockResolvedValue(fakeResponse("anthropic", "single mode"));

    const winner = await generateCompete(baseReq, () => 80);
    expect(winner.provider).toBe("anthropic");
  });
});
