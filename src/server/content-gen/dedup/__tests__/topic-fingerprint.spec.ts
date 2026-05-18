// City Domination 2026-05-18 P1-6 — Tests topic-fingerprint stub + Hamming.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hammingDistance,
  computeTopicFingerprint,
  TOPIC_FINGERPRINT_THRESHOLDS,
} from "../topic-fingerprint";

describe("hammingDistance", () => {
  it("retourne 0 pour 2 fingerprints identiques", () => {
    expect(hammingDistance("a1b2c3d4e5f60718", "a1b2c3d4e5f60718")).toBe(0);
  });

  it("retourne distance correcte sur 2 hex différents", () => {
    // 0000000000000000 vs 0000000000000001 = 1 bit diff
    expect(hammingDistance("0000000000000000", "0000000000000001")).toBe(1);
    // 0000000000000000 vs 000000000000000f = 4 bits diff (0xf = 1111)
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
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("retourne null si pas de VOYAGE_API_KEY et fallback désactivé (default V1)", async () => {
    const fp = await computeTopicFingerprint("Audit IA pour PME industrie");
    expect(fp).toBeNull();
  });

  it("retourne null même avec VOYAGE_API_KEY tant que TODO Sprint S+2 (stubbed)", async () => {
    process.env["VOYAGE_API_KEY"] = "test-key";
    const fp = await computeTopicFingerprint("Test");
    // V1 stubbed — retourne null jusqu'à activation S+2
    expect(fp).toBeNull();
  });

  it("retourne fallback SHA-256 si VOYAGE_AI_FINGERPRINT_FALLBACK=true (dev/test only)", async () => {
    process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] = "true";
    const fp = await computeTopicFingerprint("Audit IA pour PME industrie");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("fallback déterministe : même input → même output", async () => {
    process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] = "true";
    const fp1 = await computeTopicFingerprint("Test article");
    const fp2 = await computeTopicFingerprint("Test article");
    expect(fp1).toBe(fp2);
  });

  it("fallback insensible casse/espaces leading/trailing", async () => {
    process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] = "true";
    const fp1 = await computeTopicFingerprint("Test article");
    const fp2 = await computeTopicFingerprint("  TEST ARTICLE  ");
    expect(fp1).toBe(fp2);
  });
});

describe("TOPIC_FINGERPRINT_THRESHOLDS", () => {
  it("seuils Hamming distance documentés (BLOCK=8, WARN=12)", () => {
    expect(TOPIC_FINGERPRINT_THRESHOLDS.BLOCK).toBe(8);
    expect(TOPIC_FINGERPRINT_THRESHOLDS.WARN).toBe(12);
  });
});
