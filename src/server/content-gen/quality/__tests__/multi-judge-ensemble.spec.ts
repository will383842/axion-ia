/**
 * Sprint v7 Phase 16 — Tests multi-judge ensemble + originality-ai gate.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { composeMultiJudge, type JudgeResult } from "../multi-judge-ensemble";
import {
  scanWithOriginalityAi,
  passesOriginalityGate,
  type OriginalityScanResult,
} from "../originality-ai-client";

function judge(name: string, score: number, costUsd = 0.01): JudgeResult {
  return { judgeName: name, score, feedback: "stub", costUsd, tokens: 100 };
}

describe("Phase 16 — Multi-judge ensemble", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.MULTI_JUDGE_ENABLED;
  });
  afterEach(() => {
    if (original !== undefined) process.env.MULTI_JUDGE_ENABLED = original;
    else delete process.env.MULTI_JUDGE_ENABLED;
  });

  it("MJ1: désactivé par défaut (MULTI_JUDGE_ENABLED!=true) → retourne judge[0] single", () => {
    delete process.env.MULTI_JUDGE_ENABLED;
    const result = composeMultiJudge([judge("A", 72), judge("B", 88)]);
    expect(result.consensusScore).toBe(72);
    expect(result.judges.length).toBe(1);
    expect(result.variance).toBe(0);
    expect(result.tieBreakerUsed).toBe(false);
  });

  it("MJ2: activé + écart < 15 → médiane consensus", () => {
    process.env.MULTI_JUDGE_ENABLED = "true";
    const result = composeMultiJudge([judge("A", 70), judge("B", 75), judge("C", 80)]);
    expect(result.consensusScore).toBe(75); // médiane
    expect(result.variance).toBe(10);
    expect(result.tieBreakerUsed).toBe(false);
  });

  it("MJ3: activé + écart ≥ 15 + tie-breaker fourni → arbitré", () => {
    process.env.MULTI_JUDGE_ENABLED = "true";
    const result = composeMultiJudge(
      [judge("A", 60), judge("B", 85)],
      judge("Tiebreaker", 78, 0.05),
    );
    expect(result.consensusScore).toBe(78);
    expect(result.tieBreakerUsed).toBe(true);
    expect(result.arbitered).toBe(true);
    expect(result.judges.length).toBe(3);
  });

  it("MJ4: activé + écart ≥ 15 sans tie-breaker → médiane fallback", () => {
    process.env.MULTI_JUDGE_ENABLED = "true";
    const result = composeMultiJudge([judge("A", 50), judge("B", 90)]);
    expect(result.consensusScore).toBe(70); // médiane (50+90)/2
    expect(result.tieBreakerUsed).toBe(false);
  });

  it("MJ5: judges vide + désactivé → score 0 (defensive)", () => {
    delete process.env.MULTI_JUDGE_ENABLED;
    const result = composeMultiJudge([]);
    expect(result.consensusScore).toBe(0);
    expect(result.judges.length).toBe(0);
  });

  it("MJ6: totalCostUsd somme tous les juges (+ tie-breaker)", () => {
    process.env.MULTI_JUDGE_ENABLED = "true";
    const result = composeMultiJudge(
      [judge("A", 50, 0.01), judge("B", 90, 0.02)],
      judge("T", 70, 0.05),
    );
    expect(result.totalCostUsd).toBeCloseTo(0.08, 5);
  });
});

describe("Phase 16 — Originality.ai gate", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.ORIGINALITY_AI_API_KEY;
  });
  afterEach(() => {
    if (original !== undefined) process.env.ORIGINALITY_AI_API_KEY = original;
    else delete process.env.ORIGINALITY_AI_API_KEY;
  });

  it("OA1: API key absente → fallback safe non-bloquant", async () => {
    delete process.env.ORIGINALITY_AI_API_KEY;
    const result = await scanWithOriginalityAi({ contentText: "x".repeat(200) });
    expect(result.fallback).toBe(true);
    expect(result.costUsd).toBe(0);
    expect(result.originalityScore).toBe(100); // neutre n'impacte pas gate
  });

  it("OA2: contentText < 100 chars throw 'originality_min_length' (key fourni)", async () => {
    process.env.ORIGINALITY_AI_API_KEY = "stub-key";
    await expect(scanWithOriginalityAi({ contentText: "short" })).rejects.toThrow(
      /originality_min_length/,
    );
  });

  it("OA3: passesOriginalityGate fallback → toujours passed", () => {
    const result = passesOriginalityGate({
      originalityScore: 0,
      aiDetectedScore: 100,
      plagiarismScore: 100,
      scannedAt: new Date().toISOString(),
      fallback: true,
      costUsd: 0,
    });
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("fallback_no_api_key");
  });

  it("OA4: passesOriginalityGate fail si originalityScore < 75 default", () => {
    const result = passesOriginalityGate({
      originalityScore: 60,
      aiDetectedScore: 50,
      plagiarismScore: 5,
      scannedAt: new Date().toISOString(),
      fallback: false,
      costUsd: 0.01,
    } as OriginalityScanResult);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/originality_below_threshold/);
  });

  it("OA5: passesOriginalityGate fail si plagiarismScore > 20 default", () => {
    const result = passesOriginalityGate({
      originalityScore: 90,
      aiDetectedScore: 50,
      plagiarismScore: 25,
      scannedAt: new Date().toISOString(),
      fallback: false,
      costUsd: 0.01,
    } as OriginalityScanResult);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/plagiarism_above_threshold/);
  });
});
