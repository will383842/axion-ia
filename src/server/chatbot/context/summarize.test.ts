// T-31 — résumé de contexte long (shouldSummarize + summarizeConversation).

import { describe, it, expect, vi } from "vitest";
import {
  shouldSummarize,
  summarizeConversation,
  SUMMARIZE_AFTER_MESSAGES,
} from "@/server/chatbot/context/summarize";
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

describe("shouldSummarize", () => {
  it("ne résume pas sous le palier", () => {
    expect(shouldSummarize(SUMMARIZE_AFTER_MESSAGES - 1)).toBe(false);
    expect(shouldSummarize(0)).toBe(false);
  });
  it("résume au palier puis tous les N messages (borne le coût)", () => {
    expect(shouldSummarize(12)).toBe(true); // palier (12 % 6 === 0)
    expect(shouldSummarize(13)).toBe(false);
    expect(shouldSummarize(18)).toBe(true);
  });
});

describe("summarizeConversation", () => {
  it("appelle le LLM léger et renvoie le résumé", async () => {
    const gen = vi.fn(async (_opts: GenerateAnswerOptions) =>
      answer("- Besoin : audit IA\n- Profil : PME industrie"),
    );
    const r = await summarizeConversation(
      [
        { role: "user", contenu: "Je veux un audit" },
        { role: "assistant", contenu: "Pour quelle structure ?" },
      ],
      gen,
      "haiku",
    );
    expect(r).toContain("audit IA");
    // Le transcript est passé en userPrompt, le tier respecté.
    expect(gen.mock.calls[0]![0].tier).toBe("haiku");
    expect(gen.mock.calls[0]![0].userPrompt).toContain("Visiteur : Je veux un audit");
  });

  it("renvoie null si conversation vide", async () => {
    const gen = vi.fn();
    expect(await summarizeConversation([], gen, "haiku")).toBeNull();
    expect(gen).not.toHaveBeenCalled();
  });

  it("best-effort : null si le LLM échoue", async () => {
    const gen = vi.fn(async () => {
      throw new Error("LLM down");
    });
    const r = await summarizeConversation([{ role: "user", contenu: "x" }], gen, "haiku");
    expect(r).toBeNull();
  });
});
