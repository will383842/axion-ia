import { describe, expect, it } from "vitest";
import {
  classifyDedupVerdict,
  cosineSimilarity,
  DEFAULT_DEDUP_THRESHOLDS,
} from "../embedding-similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
  });

  it("handles unit-normalized vectors correctly", () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96, 4);
  });

  it("returns 0 when one vector is zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dim mismatch/);
  });

  it("scale-invariant (magnitude doesn't change similarity)", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
  });
});

describe("classifyDedupVerdict", () => {
  it("verdict=ok when similarity below similar threshold", () => {
    const result = classifyDedupVerdict({ similarity: 0.5 });
    expect(result.verdict).toBe("ok");
  });

  it("verdict=similar when in [0.80, 0.85)", () => {
    expect(classifyDedupVerdict({ similarity: 0.82 }).verdict).toBe("similar");
    expect(classifyDedupVerdict({ similarity: 0.8 }).verdict).toBe("similar");
    expect(classifyDedupVerdict({ similarity: 0.849 }).verdict).toBe("similar");
  });

  it("verdict=duplicate when >= 0.85", () => {
    expect(classifyDedupVerdict({ similarity: 0.85 }).verdict).toBe("duplicate");
    expect(classifyDedupVerdict({ similarity: 0.95 }).verdict).toBe("duplicate");
    expect(classifyDedupVerdict({ similarity: 1.0 }).verdict).toBe("duplicate");
  });

  it("respects custom thresholds", () => {
    const result = classifyDedupVerdict({
      similarity: 0.7,
      duplicateThreshold: 0.6,
      similarThreshold: 0.5,
    });
    expect(result.verdict).toBe("duplicate");
  });

  it("includes the cosine value in reason", () => {
    const result = classifyDedupVerdict({ similarity: 0.876 });
    expect(result.reason).toContain("0.876");
  });

  it("uses default thresholds when not provided", () => {
    expect(DEFAULT_DEDUP_THRESHOLDS.duplicateThreshold).toBe(0.85);
    expect(DEFAULT_DEDUP_THRESHOLDS.similarThreshold).toBe(0.8);
  });
});
