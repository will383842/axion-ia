/**
 * T-04 — Câblage Voyage AI réel dans embeddings.ts (mock HTTP).
 *
 * Vérifie : appel Voyage quand VOYAGE_API_KEY présente (dimension 1024, tokens
 * depuis usage, modelVersion sans -stub) · erreur HTTP → throw (pas de poison) ·
 * dimension inattendue → throw · refus confidentialité AVANT tout appel réseau ·
 * sans clé → stub déterministe (KB tests inchangés).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateEmbedding,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL_VERSION,
  EmbeddingConfidentialityRefusal,
} from "./embeddings";

const savedKey = process.env.VOYAGE_API_KEY;

afterEach(() => {
  if (savedKey === undefined) delete process.env.VOYAGE_API_KEY;
  else process.env.VOYAGE_API_KEY = savedKey;
  vi.unstubAllGlobals();
});

describe("T-04 chemin Voyage (clé présente)", () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = "test-key";
  });

  it("appelle Voyage et retourne le vecteur 1024 + tokens usage", async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0.01);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: vector }], usage: { total_tokens: 7 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await generateEmbedding("texte à embedder");
    expect(r.embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(r.tokensUsed).toBe(7);
    expect(r.modelVersion).toBe(EMBEDDING_MODEL_VERSION); // pas de suffixe -stub
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("voyageai.com");
    expect(
      String(opts.headers && (opts.headers as Record<string, string>).Authorization),
    ).toContain("test-key");
  });

  it("erreur HTTP Voyage → throw (le worker BullMQ retentera)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "",
      })),
    );
    await expect(generateEmbedding("x")).rejects.toThrow(/Voyage HTTP 429/);
  });

  it("dimension inattendue → throw (pas de poison de l'index)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }) })),
    );
    await expect(generateEmbedding("x")).rejects.toThrow(/dimension inattendue/);
  });

  it("REFUS confidentialité AVANT tout appel réseau (même avec clé)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateEmbedding("secret", "confidential")).rejects.toBeInstanceOf(
      EmbeddingConfidentialityRefusal,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("T-04 fallback stub (clé absente — KB tests inchangés)", () => {
  beforeEach(() => {
    delete process.env.VOYAGE_API_KEY;
  });

  it("sans clé → stub déterministe (dimension 1024, modelVersion -stub)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r1 = await generateEmbedding("identique");
    const r2 = await generateEmbedding("identique");
    expect(r1.embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(r1.embedding).toEqual(r2.embedding); // déterministe
    expect(r1.modelVersion).toContain("-stub");
    expect(fetchMock).not.toHaveBeenCalled(); // aucun appel réseau sans clé
  });
});
