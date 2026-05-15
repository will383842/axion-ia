import { describe, expect, it } from "vitest";
import { detectSearchEngine } from "@/lib/tracking";

describe("detectSearchEngine", () => {
  it("returns 'direct' for empty or null referrer", () => {
    expect(detectSearchEngine(null)).toBe("direct");
    expect(detectSearchEngine(undefined)).toBe("direct");
    expect(detectSearchEngine("")).toBe("direct");
    expect(detectSearchEngine("   ")).toBe("direct");
  });

  it("buckets Google variants", () => {
    expect(detectSearchEngine("https://www.google.com/")).toBe("google");
    expect(detectSearchEngine("https://google.fr/search?q=axion")).toBe("google");
    expect(detectSearchEngine("https://www.google.co.uk/")).toBe("google");
  });

  it("buckets Bing", () => {
    expect(detectSearchEngine("https://www.bing.com/search?q=foo")).toBe("bing");
  });

  it("buckets Qwant / Ecosia / Lilo / DDG", () => {
    expect(detectSearchEngine("https://www.qwant.com/")).toBe("qwant");
    expect(detectSearchEngine("https://www.ecosia.org/search?q=ax")).toBe("ecosia");
    expect(detectSearchEngine("https://www.lilo.org/")).toBe("lilo");
    expect(detectSearchEngine("https://duckduckgo.com/?q=axion")).toBe("ddg");
    expect(detectSearchEngine("https://html.duckduckgo.com/html/?q=test")).toBe("ddg");
  });

  it("buckets LLM citation sources", () => {
    expect(detectSearchEngine("https://www.perplexity.ai/search/abc")).toBe("perplexity");
    expect(detectSearchEngine("https://chat.openai.com/c/abc")).toBe("chatgpt");
    expect(detectSearchEngine("https://chatgpt.com/c/abc")).toBe("chatgpt");
    expect(detectSearchEngine("https://claude.ai/chat/abc")).toBe("claude");
    expect(detectSearchEngine("https://gemini.google.com/app")).toBe("gemini");
    expect(detectSearchEngine("https://bard.google.com/")).toBe("gemini");
    expect(detectSearchEngine("https://chat.mistral.ai/chat")).toBe("mistral");
    expect(detectSearchEngine("https://copilot.microsoft.com/")).toBe("copilot");
  });

  it("buckets unknown referrer as 'other'", () => {
    expect(detectSearchEngine("https://linkedin.com/in/foo")).toBe("other");
    expect(detectSearchEngine("https://twitter.com/anyhandle")).toBe("other");
  });

  it("is case-insensitive on host", () => {
    expect(detectSearchEngine("https://Google.com/")).toBe("google");
    expect(detectSearchEngine("https://BING.COM/search?q=foo")).toBe("bing");
  });
});
