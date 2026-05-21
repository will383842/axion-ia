/**
 * B.7 P0-6 — Tests openai-embedder.ts
 *
 * Couvre :
 * 1. embed() retourne null si OPENAI_EMBEDDINGS_ENABLED != 'true'.
 * 2. embed() throw si flag true mais OPENAI_API_KEY absent.
 * 3. embed() succes : mock fetch → embedding 3072 dim.
 * 4. embed() bad dim → null.
 * 5. embed() HTTP error → null (fail-soft).
 * 6. embed() daily cap → null.
 * 7. buildEmbeddingInput : title + meta + body (500 mots cap).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  embed,
  buildEmbeddingInput,
  OPENAI_EMBEDDING_DIMENSION,
  __resetTokenCounter,
} from "../openai-embedder";

const originalEnv = { ...process.env };

beforeEach(() => {
  __resetTokenCounter();
  // Reset env vars eventuellement modifiees par tests precedents.
  delete process.env["OPENAI_EMBEDDINGS_ENABLED"];
  delete process.env["OPENAI_API_KEY"];
  delete process.env["OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY"];
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("embed — flag default off", () => {
  it("returns null when OPENAI_EMBEDDINGS_ENABLED is not 'true'", async () => {
    expect(await embed("audit IA")).toBeNull();
  });

  it("returns null when flag is exactly 'false'", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "false";
    expect(await embed("audit IA")).toBeNull();
  });
});

describe("embed — config errors", () => {
  it("throws when enabled but API key missing", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    await expect(embed("audit IA")).rejects.toThrow(/OPENAI_API_KEY missing/);
  });
});

describe("embed — successful call", () => {
  it("returns embedding 3072 dim on OK response", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";
    const fakeEmbedding = new Array(OPENAI_EMBEDDING_DIMENSION).fill(0.01);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: fakeEmbedding }],
          usage: { total_tokens: 42 },
        }),
      } as unknown as Response),
    );
    const result = await embed("audit IA conformite RGPD");
    expect(result).not.toBeNull();
    expect(result?.embedding.length).toBe(OPENAI_EMBEDDING_DIMENSION);
    expect(result?.tokensUsed).toBe(42);
    expect(result?.model).toBe("text-embedding-3-large");
  });

  it("returns null when dim mismatch (bad API response)", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { total_tokens: 5 },
        }),
      } as unknown as Response),
    );
    expect(await embed("audit IA")).toBeNull();
  });

  it("returns null on HTTP error (rate limit, 5xx)", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      } as unknown as Response),
    );
    expect(await embed("audit IA")).toBeNull();
  });

  it("returns null on network exception (fail-soft)", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")));
    expect(await embed("audit IA")).toBeNull();
  });
});

describe("embed — daily cap", () => {
  it("returns null when daily token cap exceeded", async () => {
    process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
    process.env["OPENAI_API_KEY"] = "sk-test-fake";
    process.env["OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY"] = "10";
    const text = "a".repeat(200); // est ~50 tokens > cap 10
    expect(await embed(text)).toBeNull();
  });
});

describe("buildEmbeddingInput", () => {
  it("combines title + metaDescription + body (first 500 words)", () => {
    const input = buildEmbeddingInput({
      title: "Audit IA conformite",
      metaDescription: "Guide complet RGPD AI Act",
      bodyText: "Lorem ipsum dolor sit amet ".repeat(200),
    });
    expect(input).toContain("Audit IA conformite");
    expect(input).toContain("Guide complet RGPD AI Act");
    // 200 x 5 words = 1000 words, mais cap a 500 dans le body, donc trims.
    const wordCount = input.split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(510); // 500 + title + meta
  });

  it("works with title only", () => {
    expect(buildEmbeddingInput({ title: "Solo title" })).toBe("Solo title");
  });

  it("caps total length to 32k chars", () => {
    const longBody = "x".repeat(100_000);
    const input = buildEmbeddingInput({ title: "T", bodyText: longBody });
    expect(input.length).toBeLessThanOrEqual(32_000);
  });
});
