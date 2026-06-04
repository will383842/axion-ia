// T-18 — classifieur d'intention LLM léger (raffinement hors_sujet).

import { describe, it, expect, vi } from "vitest";
import { isOnTopicViaLlm } from "@/server/chatbot/catalog/intent-llm";
import type {
  GeneratedAnswer,
  GenerateAnswerOptions,
} from "@/server/chatbot/generation/generate-stream";

const answer = (text: string): GeneratedAnswer => ({
  text,
  model: "claude-haiku-4-5",
  costUsd: 0,
  tokensInput: 0,
  tokensOutput: 0,
});

describe("isOnTopicViaLlm", () => {
  it("LLM répond SUJET → true (promu en explication)", async () => {
    const gen = vi.fn(async (_o: GenerateAnswerOptions) => answer("SUJET"));
    expect(await isOnTopicViaLlm("Que propose Axion-IA ?", gen, "haiku")).toBe(true);
    expect(gen.mock.calls[0]![0].tier).toBe("haiku");
  });

  it("LLM répond HORS_SUJET → false", async () => {
    const gen = vi.fn(async (_o: GenerateAnswerOptions) => answer("HORS_SUJET"));
    expect(await isOnTopicViaLlm("Quelle est la météo ?", gen, "haiku")).toBe(false);
  });

  it("fail-soft → false si le LLM échoue", async () => {
    const gen = vi.fn(async () => {
      throw new Error("LLM down");
    });
    expect(await isOnTopicViaLlm("x", gen, "haiku")).toBe(false);
  });
});
