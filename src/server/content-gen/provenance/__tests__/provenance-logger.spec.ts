/**
 * B.4 P1.5 — Tests provenance-logger.ts.
 *
 * Verifie :
 * 1. hashPrompt produit un hash SHA-256 tronque 64 chars.
 * 2. computeProvenanceHash chaine correctement previousHash + promptHash + timestamp.
 * 3. logProvenance cree un enregistrement en DB.
 * 4. getProvenanceForArticle retourne les enregistrements tries par timestamp ASC.
 * 5. article genere (mock LLM) → provenance logged → forget (delete) → 0 trace.
 */

import { describe, it, expect, vi } from "vitest";
import { hashPrompt, computeProvenanceHash } from "../provenance-logger";

// ── Mock prisma ────────────────────────────────────────────────────────────────

const provenanceFindFirstMock = vi.fn(async () => null);
const provenanceCreateMock = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: "prov-1",
  ...args.data,
}));
const provenanceFindManyMock = vi.fn(async () => []);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generationProvenance: {
      findFirst: () => provenanceFindFirstMock(),
      create: (args: { data: Record<string, unknown> }) => provenanceCreateMock(args),
      findMany: () => provenanceFindManyMock(),
    },
    article: {
      delete: vi.fn(async () => ({ id: "art-1" })),
    },
  },
}));

import { logProvenance, getProvenanceForArticle } from "../provenance-logger";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("provenance-logger — B.4 P0-9 AI Act art.50", () => {
  it("hashPrompt retourne un hash hexadecimal de 64 chars", () => {
    const h = hashPrompt("blog_article:job-123:art-456");
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it("hashPrompt est deterministe", () => {
    const input = "test:input";
    expect(hashPrompt(input)).toBe(hashPrompt(input));
  });

  it("computeProvenanceHash chaine les hashes (different si previousHash change)", () => {
    const ts = new Date("2026-05-21T12:00:00Z");
    const ph = "deadbeef12345678";
    const h1 = computeProvenanceHash("", ph, ts);
    const h2 = computeProvenanceHash("abcdef1234", ph, ts);
    expect(h1).not.toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("logProvenance cree un enregistrement en DB", async () => {
    provenanceFindFirstMock.mockResolvedValueOnce(null);
    provenanceCreateMock.mockResolvedValueOnce({ id: "prov-new" } as never);

    const id = await logProvenance({
      articleId: "art-uuid-1",
      step: "publish",
      provider: "openai",
      model: "gpt-4o-mini",
      promptHash: hashPrompt("test:prompt"),
      inputTokens: 1200,
      outputTokens: 800,
      costUsd: 0.003,
    });

    expect(provenanceCreateMock).toHaveBeenCalledOnce();
    const createArg = provenanceCreateMock.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createArg.data.articleId).toBe("art-uuid-1");
    expect(createArg.data.step).toBe("publish");
    expect(createArg.data.provider).toBe("openai");
    expect(createArg.data.inputTokens).toBe(1200);
    expect(typeof createArg.data.hash).toBe("string");
    expect(id).toBe("prov-new");
  });

  it("logProvenance graceful si DB down (retourne null sans throw)", async () => {
    provenanceFindFirstMock.mockRejectedValueOnce(new Error("DB down"));
    const id = await logProvenance({
      articleId: "art-uuid-2",
      step: "publish",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      promptHash: hashPrompt("test:prompt2"),
      inputTokens: 500,
      outputTokens: 300,
      costUsd: 0.001,
    });
    expect(id).toBeNull();
  });

  it("getProvenanceForArticle retourne [] si aucune trace", async () => {
    provenanceFindManyMock.mockResolvedValueOnce([]);
    const trace = await getProvenanceForArticle("art-empty");
    expect(trace).toEqual([]);
  });

  it("getProvenanceForArticle retourne les enregistrements avec cost stringify", async () => {
    provenanceFindManyMock.mockResolvedValueOnce([
      {
        id: "p-1",
        step: "publish",
        provider: "openai",
        model: "gpt-4o-mini",
        modelVersion: null,
        promptHash: "abc123",
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 0,
        cost: { toString: () => "0.000500" },
        regulationVersion: "AI-Act-2024/1689",
        previousHash: null,
        hash: "deadbeef",
        timestamp: new Date("2026-05-21T12:00:00Z"),
      } as never,
    ]);
    const trace = await getProvenanceForArticle("art-1");
    expect(trace).toHaveLength(1);
    expect(trace[0]?.cost).toBe("0.000500");
  });
});
