import { describe, expect, it } from "vitest";
import { classerReferentIA, REFERENTS_IA } from "@/lib/analytics/referents-ia";
import { detectSearchEngine } from "@/lib/tracking-referer";

const ATTENDUS: Array<[string, string]> = [
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["copilot.microsoft.com", "copilot"],
  ["gemini.google.com", "gemini"],
  ["bard.google.com", "gemini"],
  ["chat.mistral.ai", "mistral"],
  ["claude.ai", "claude"],
  ["chat.deepseek.com", "deepseek"],
  ["you.com", "you"],
  ["phind.com", "phind"],
];

describe("classerReferentIA", () => {
  it.each(ATTENDUS)("classe %s", (domaine, id) => {
    expect(classerReferentIA(domaine)?.id).toBe(id);
    expect(classerReferentIA(`https://${domaine}/c/abc?x=1`)?.id).toBe(id);
  });

  it("accepte sous-domaines et majuscules", () => {
    expect(classerReferentIA("https://WWW.Perplexity.AI/search/x")?.id).toBe("perplexity");
    expect(classerReferentIA("Fr.ChatGPT.com")?.id).toBe("chatgpt");
  });

  it("distingue bing.com/chat de la recherche Bing", () => {
    expect(classerReferentIA("bing.com/chat")?.id).toBe("copilot");
    expect(classerReferentIA("https://www.bing.com/chat?q=a")?.id).toBe("copilot");
    expect(classerReferentIA("https://www.bing.com/search?q=a")).toBeNull();
    expect(classerReferentIA("bing.com")).toBeNull();
  });

  it("ne confond pas avec des domaines proches ou non IA", () => {
    expect(classerReferentIA("https://google.com/")).toBeNull();
    expect(classerReferentIA("https://notchatgpt.com/")).toBeNull();
    expect(classerReferentIA("https://chatgpt.com.evil.io/")).toBeNull();
    expect(classerReferentIA("")).toBeNull();
    expect(classerReferentIA(null)).toBeNull();
  });

  it("tracking-referer partage la même liste", () => {
    for (const ia of REFERENTS_IA) {
      for (const d of ia.domaines) {
        expect(detectSearchEngine(`https://${d}/`)).toBe(ia.id);
      }
    }
  });
});
