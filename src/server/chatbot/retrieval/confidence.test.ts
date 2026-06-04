/**
 * T-11 — Seuil de confiance retrieval → escalade.
 */

import { describe, it, expect } from "vitest";
import { assessConfidence } from "@/server/chatbot/retrieval/confidence";

describe("T-11 assessConfidence", () => {
  it("aucun chunk → score 0, non confiant", () => {
    expect(assessConfidence([], 0.35)).toEqual({ score: 0, confident: false });
  });

  it("chunk fort (score RRF élevé) → confiant", () => {
    const r = assessConfidence([{ score: 2 / 61 }], 0.35); // max théorique → score 1
    expect(r.score).toBeCloseTo(1, 5);
    expect(r.confident).toBe(true);
  });

  it("chunk faible (sous le seuil) → non confiant", () => {
    const r = assessConfidence([{ score: 0.001 }], 0.35);
    expect(r.score).toBeLessThan(0.35);
    expect(r.confident).toBe(false);
  });

  it("retient le meilleur score parmi les chunks", () => {
    const r = assessConfidence([{ score: 0.001 }, { score: 2 / 61 }, { score: 0.0005 }], 0.35);
    expect(r.confident).toBe(true);
  });
});
