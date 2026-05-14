/**
 * KB V4 — Tests embeddings + cosine + builder. Pure. Pas de DB.
 */

import { describe, expect, it } from "vitest";
import {
  buildEmbeddingInput,
  cosineSimilarity,
  EMBEDDING_DIMENSION,
  EmbeddingConfidentialityRefusal,
  generateEmbedding,
} from "./embeddings";

describe("generateEmbedding", () => {
  it("retourne un vecteur de dimension correcte", async () => {
    const r = await generateEmbedding("test text");
    expect(r.embedding).toHaveLength(EMBEDDING_DIMENSION);
    expect(r.dimensionality).toBe(EMBEDDING_DIMENSION);
  });

  it("retourne le même vecteur pour le même texte (déterministe)", async () => {
    const r1 = await generateEmbedding("identical text");
    const r2 = await generateEmbedding("identical text");
    expect(r1.embedding).toEqual(r2.embedding);
  });

  it("retourne des vecteurs différents pour textes différents", async () => {
    const r1 = await generateEmbedding("text A");
    const r2 = await generateEmbedding("text B");
    expect(r1.embedding).not.toEqual(r2.embedding);
  });

  it("vecteur normalisé L2 (norme ≈ 1)", async () => {
    const r = await generateEmbedding("normalize me");
    const norm = Math.sqrt(r.embedding.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("compte tokens approximatif (4 chars/token)", async () => {
    const r = await generateEmbedding("abcdefgh");
    expect(r.tokensUsed).toBe(2);
  });

  it("REFUS si confidentiality='confidential'", async () => {
    await expect(generateEmbedding("secret", "confidential")).rejects.toBeInstanceOf(
      EmbeddingConfidentialityRefusal,
    );
  });

  it("REFUS si confidentiality='secret'", async () => {
    await expect(generateEmbedding("top secret", "secret")).rejects.toBeInstanceOf(
      EmbeddingConfidentialityRefusal,
    );
  });

  it("OK si confidentiality='internal' ou 'public'", async () => {
    await expect(generateEmbedding("internal", "internal")).resolves.toBeDefined();
    await expect(generateEmbedding("public", "public")).resolves.toBeDefined();
  });
});

describe("cosineSimilarity", () => {
  it("vecteurs identiques → 1", () => {
    const v = [0.6, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("vecteurs orthogonaux → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("vecteurs opposés → -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("throw si dimensions différentes", () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow();
  });
});

describe("buildEmbeddingInput", () => {
  it("concat title + excerpt + body", () => {
    const out = buildEmbeddingInput({
      title: "T",
      excerpt: "E",
      bodyText: "Body words here",
    });
    expect(out).toContain("T");
    expect(out).toContain("E");
    expect(out).toContain("Body");
  });

  it("tronque body à 500 mots", () => {
    const body = Array.from({ length: 600 }, (_, i) => `w${i}`).join(" ");
    const out = buildEmbeddingInput({ title: "T", bodyText: body });
    expect(out.split(/\s+/).length).toBeLessThanOrEqual(503); // title + 2 newlines + 500 words ish
  });

  it("title seul OK", () => {
    const out = buildEmbeddingInput({ title: "Just title" });
    expect(out).toBe("Just title");
  });
});
