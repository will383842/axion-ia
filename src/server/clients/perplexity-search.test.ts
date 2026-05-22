/**
 * Tests Perplexity search wrapper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_KEY = process.env.PERPLEXITY_API_KEY;

describe("perplexitySearch", () => {
  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.PERPLEXITY_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("Throw si PERPLEXITY_API_KEY absente", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const { perplexitySearch, PerplexitySearchError } = await import("./perplexity-search");
    await expect(perplexitySearch({ query: "test" })).rejects.toBeInstanceOf(
      PerplexitySearchError,
    );
  });

  it("Throw si PERPLEXITY_API_KEY=stub.invalid (build mode)", async () => {
    process.env.PERPLEXITY_API_KEY = "stub.invalid";
    const { perplexitySearch, PerplexitySearchError } = await import("./perplexity-search");
    await expect(perplexitySearch({ query: "test" })).rejects.toBeInstanceOf(
      PerplexitySearchError,
    );
  });

  it("Throw avec status code 429 retryable", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });
    vi.stubGlobal("fetch", mockFetch);
    const { perplexitySearch, PerplexitySearchError } = await import("./perplexity-search");
    await expect(perplexitySearch({ query: "test" })).rejects.toMatchObject({
      name: "PerplexitySearchError",
      status: 429,
      retryable: true,
    });
  });

  it("Throw avec status code 401 non-retryable", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });
    vi.stubGlobal("fetch", mockFetch);
    const { perplexitySearch } = await import("./perplexity-search");
    await expect(perplexitySearch({ query: "test" })).rejects.toMatchObject({
      status: 401,
      retryable: false,
    });
  });

  it("Parse citations[] + search_results[] et merge URLs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "test-id",
          model: "sonar",
          choices: [
            {
              message: {
                role: "assistant",
                content:
                  "1. INSEE - https://www.insee.fr/fr/statistiques\n2. CNIL - https://www.cnil.fr/",
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 120, total_tokens: 170 },
          search_results: [
            { url: "https://www.insee.fr/fr/statistiques", title: "INSEE Stats" },
            { url: "https://www.cnil.fr/", title: "CNIL" },
          ],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);
    const { perplexitySearch } = await import("./perplexity-search");
    const result = await perplexitySearch({ query: "10 sources INSEE et CNIL" });

    expect(result.citations.length).toBe(2);
    expect(result.citations[0]?.url).toBe("https://www.insee.fr/fr/statistiques");
    expect(result.urls).toContain("https://www.insee.fr/fr/statistiques");
    expect(result.urls).toContain("https://www.cnil.fr/");
    expect(result.tokensInput).toBe(50);
    expect(result.tokensOutput).toBe(120);
  });

  it("Passe search_domain_filter dans le body de la requête", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "x",
          model: "sonar",
          choices: [{ message: { role: "assistant", content: "" } }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);
    const { perplexitySearch } = await import("./perplexity-search");
    await perplexitySearch({ query: "test", searchDomainFilter: ["gouv.fr", "fr"] });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(callBody.search_domain_filter).toEqual(["gouv.fr", "fr"]);
  });

  it("Fallback citations[] (URLs only) si search_results[] absent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "x",
          model: "sonar",
          choices: [{ message: { role: "assistant", content: "voir https://example.com" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          citations: ["https://example.com"],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);
    const { perplexitySearch } = await import("./perplexity-search");
    const result = await perplexitySearch({ query: "test" });
    expect(result.citations.length).toBe(1);
    expect(result.citations[0]?.url).toBe("https://example.com");
    expect(result.urls).toContain("https://example.com");
  });
});

describe("extractUrlsFromText", () => {
  it("Extrait URLs et dédoublonne", async () => {
    const { extractUrlsFromText } = await import("./perplexity-search");
    const text = "Voir https://insee.fr/stats et https://insee.fr/stats encore https://cnil.fr/";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual(["https://insee.fr/stats", "https://cnil.fr/"]);
  });

  it("Strip trailing ponctuation", async () => {
    const { extractUrlsFromText } = await import("./perplexity-search");
    const text = "L'URL est https://example.fr/, voir aussi https://test.com.";
    const urls = extractUrlsFromText(text);
    expect(urls).toEqual(["https://example.fr/", "https://test.com"]);
  });
});

describe("createConcurrencyLimiter", () => {
  it("Limite la concurrence", async () => {
    const { createConcurrencyLimiter } = await import("./perplexity-search");
    const limit = createConcurrencyLimiter(2);
    let active = 0;
    let peak = 0;
    const job = async () => {
      active += 1;
      if (active > peak) peak = active;
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
    };
    await Promise.all([limit(job), limit(job), limit(job), limit(job), limit(job)]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("computePerplexityCost", () => {
  it("Calcule sonar cost", async () => {
    const { computePerplexityCost } = await import("./perplexity-search");
    // sonar : $1/$1/1M input/output + $0.005 per call
    // 1000 input + 1000 output = $0.001 + $0.001 + $0.005 = $0.007
    const cost = computePerplexityCost("sonar", 1000, 1000);
    expect(cost).toBeCloseTo(0.007, 4);
  });

  it("Default sonar pour modèle inconnu", async () => {
    const { computePerplexityCost } = await import("./perplexity-search");
    const a = computePerplexityCost("sonar", 1000, 1000);
    const b = computePerplexityCost("unknown-model", 1000, 1000);
    expect(a).toBeCloseTo(b, 4);
  });
});
