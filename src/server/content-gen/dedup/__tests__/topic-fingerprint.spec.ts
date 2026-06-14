// City Domination 2026-05-18 P1-6 — Tests topic-fingerprint (activé 2026-06-14).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hammingDistance,
  computeTopicFingerprint,
  classifyTopicDuplicate,
  TOPIC_FINGERPRINT_THRESHOLDS,
} from "../topic-fingerprint";

const { genEmbedMock } = vi.hoisted(() => ({ genEmbedMock: vi.fn() }));
vi.mock("@/lib/knowledge/embeddings", () => ({ generateEmbedding: genEmbedMock }));

/** Embedding factice 1024-dim déterministe (dérivé d'une seed). */
function fakeEmbedding(seed: number): number[] {
  return Array.from({ length: 1024 }, (_, i) => Math.sin((i + 1) * seed));
}

describe("hammingDistance", () => {
  it("retourne 0 pour 2 fingerprints identiques", () => {
    expect(hammingDistance("a1b2c3d4e5f60718", "a1b2c3d4e5f60718")).toBe(0);
  });

  it("retourne distance correcte sur 2 hex différents", () => {
    expect(hammingDistance("0000000000000000", "0000000000000001")).toBe(1);
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
  });

  it("retourne -1 si longueur ≠ 16 hex chars", () => {
    expect(hammingDistance("a1b2", "c3d4")).toBe(-1);
    expect(hammingDistance("a1b2c3d4e5f60718a", "a1b2c3d4e5f60718")).toBe(-1);
  });

  it("retourne -1 si caractères non-hex", () => {
    expect(hammingDistance("zzzzzzzzzzzzzzzz", "0000000000000000")).toBe(-1);
  });

  it("case-insensitive (uppercase OK)", () => {
    expect(hammingDistance("A1B2C3D4E5F60718", "a1b2c3d4e5f60718")).toBe(0);
  });
});

describe("computeTopicFingerprint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["VOYAGE_API_KEY"];
    delete process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"];
    genEmbedMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("embedding réel → fingerprint 16-hex valide (SimHash)", async () => {
    genEmbedMock.mockResolvedValue({
      embedding: fakeEmbedding(0.7),
      modelVersion: "2026-06",
      model: "voyage-3",
      dimensionality: 1024,
      tokensUsed: 5,
    });
    const fp = await computeTopicFingerprint("Audit IA pour PME industrie");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("déterministe : même embedding → même fingerprint", async () => {
    genEmbedMock.mockResolvedValue({
      embedding: fakeEmbedding(1.3),
      modelVersion: "2026-06",
      model: "voyage-3",
      dimensionality: 1024,
      tokensUsed: 5,
    });
    const a = await computeTopicFingerprint("Texte A");
    const b = await computeTopicFingerprint("Texte A");
    expect(a).toBe(b);
  });

  it("embedding STUB (sans clé) → null (pas de sémantique)", async () => {
    genEmbedMock.mockResolvedValue({
      embedding: fakeEmbedding(0.5),
      modelVersion: "2026-06-stub",
      model: "voyage-3",
      dimensionality: 1024,
      tokensUsed: 5,
    });
    const fp = await computeTopicFingerprint("Test");
    expect(fp).toBeNull();
  });

  it("erreur embedding (Voyage down) → null (fail-soft)", async () => {
    genEmbedMock.mockRejectedValue(new Error("network"));
    const fp = await computeTopicFingerprint("Test");
    expect(fp).toBeNull();
  });

  it("fallback SHA-256 si VOYAGE_AI_FINGERPRINT_FALLBACK=true (n'appelle PAS l'embedding)", async () => {
    process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] = "true";
    const fp = await computeTopicFingerprint("Audit IA pour PME industrie");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(genEmbedMock).not.toHaveBeenCalled();
  });

  it("fallback déterministe + insensible casse/espaces", async () => {
    process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] = "true";
    const a = await computeTopicFingerprint("Test article");
    const b = await computeTopicFingerprint("  TEST ARTICLE  ");
    expect(a).toBe(b);
  });
});

describe("classifyTopicDuplicate", () => {
  it("corpus vide → ok", () => {
    expect(classifyTopicDuplicate("0000000000000000", []).verdict).toBe("ok");
  });

  it("distance ≤ BLOCK → duplicate", () => {
    // 0 bit de diff
    const r = classifyTopicDuplicate("0000000000000000", ["0000000000000000"]);
    expect(r.verdict).toBe("duplicate");
    expect(r.minDistance).toBe(0);
  });

  it("distance > WARN → ok", () => {
    // 0x...ffff = 16 bits de diff (> 12)
    const r = classifyTopicDuplicate("0000000000000000", ["000000000000ffff"]);
    expect(r.verdict).toBe("ok");
  });

  it("retient la distance minimale du corpus", () => {
    const r = classifyTopicDuplicate("0000000000000000", [
      "000000000000ffff", // loin
      "0000000000000003", // 2 bits → duplicate
    ]);
    expect(r.minDistance).toBe(2);
    expect(r.verdict).toBe("duplicate");
  });
});

describe("TOPIC_FINGERPRINT_THRESHOLDS", () => {
  it("seuils Hamming distance documentés (BLOCK=8, WARN=12)", () => {
    expect(TOPIC_FINGERPRINT_THRESHOLDS.BLOCK).toBe(8);
    expect(TOPIC_FINGERPRINT_THRESHOLDS.WARN).toBe(12);
  });
});
