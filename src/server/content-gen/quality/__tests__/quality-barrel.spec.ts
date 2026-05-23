/**
 * Sprint v7 Session 10 commit 4/4 — smoke test cross-Phase quality barrel.
 *
 * Vérifie que tous les helpers quality (V1 + Phase 16 + Phase 17) sont
 * exposés depuis le barrel `quality/index.ts` (SSOT single import path).
 */

import { describe, it, expect } from "vitest";
import * as quality from "../index";

describe("Phase 16+17 — Quality barrel SSOT", () => {
  it("Q1: barrel exporte les V1 helpers (readability + seo + doctrine + soft-404 + plagiarism)", () => {
    expect(typeof quality.computeReadabilityFr).toBe("function");
    expect(typeof quality.computeSeoScore).toBe("function");
    expect(typeof quality.checkDoctrine).toBe("function");
    expect(typeof quality.evaluateSoft404).toBe("function");
    expect(typeof quality.jaccardSimilarity).toBe("function");
    expect(typeof quality.checkPlagiarism).toBe("function");
  });

  it("Q2: barrel exporte les Phase 16 helpers (multi-judge + originality)", () => {
    expect(typeof quality.composeMultiJudge).toBe("function");
    expect(typeof quality.scanWithOriginalityAi).toBe("function");
    expect(typeof quality.passesOriginalityGate).toBe("function");
  });

  it("Q3: smoke composeMultiJudge depuis barrel = même comportement que direct", () => {
    delete process.env.MULTI_JUDGE_ENABLED;
    const result = quality.composeMultiJudge([
      { judgeName: "X", score: 65, feedback: "", costUsd: 0.01, tokens: 100 },
    ]);
    expect(result.consensusScore).toBe(65);
    expect(result.judges.length).toBe(1);
  });
});
