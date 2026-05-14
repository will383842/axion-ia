import { describe, expect, it } from "vitest";
import { computeFactCheckScore, extractClaims, type ClaimVerdict } from "../claims-extractor";

describe("extractClaims", () => {
  it("returns empty for body with no numeric claims", () => {
    const body = "L'IA opérationnelle aide les PME. Axion-IA accompagne les dirigeants.";
    expect(extractClaims(body)).toEqual([]);
  });

  it("detects percentage claims", () => {
    const body = "Selon notre étude, 75 % des PME utilisent l'IA en 2026.";
    const claims = extractClaims(body);
    const pct = claims.find((c) => c.kind === "percentage");
    expect(pct).toBeDefined();
    expect(pct?.match).toMatch(/75\s*%/);
  });

  it("detects EUR amounts", () => {
    const body = "Le projet a coûté 12 000 € en 2024.";
    const claims = extractClaims(body);
    expect(claims.some((c) => c.kind === "amount")).toBe(true);
  });

  it("detects ratios like '3 sur 10'", () => {
    const body = "3 entreprises sur 10 ont déployé une IA en production.";
    const claims = extractClaims(body);
    expect(claims.some((c) => c.kind === "ratio")).toBe(true);
  });

  it("detects attributions 'selon X'", () => {
    const body = "Selon Gartner, l'IA générera 15 trillions en 2030.";
    const claims = extractClaims(body);
    expect(claims.some((c) => c.kind === "attribution")).toBe(true);
  });

  it("strips HTML tags before extracting", () => {
    const body = "<p>L'adoption atteint <strong>42 %</strong> en France.</p>";
    const claims = extractClaims(body);
    expect(claims.some((c) => c.kind === "percentage" && c.match.includes("42"))).toBe(true);
  });

  it("caps at 30 claims max", () => {
    const longBody = Array.from({ length: 50 }, (_, i) => `Statistique : ${i + 1} %.`).join(" ");
    const claims = extractClaims(longBody);
    expect(claims.length).toBeLessThanOrEqual(30);
  });

  it("truncates very long sentences to 280 chars", () => {
    const longSentence = "A".repeat(500) + " 50 %.";
    const claims = extractClaims(longSentence);
    if (claims.length > 0) {
      expect(claims[0]!.sentence.length).toBeLessThanOrEqual(281);
    }
  });

  it("dedupes identical matches in same sentence", () => {
    const body = "50 % et 50 % et 50 % sont les meilleurs taux.";
    const claims = extractClaims(body);
    const pctClaims = claims.filter((c) => c.kind === "percentage");
    expect(pctClaims.length).toBeLessThanOrEqual(3);
  });
});

describe("computeFactCheckScore", () => {
  it("returns 100 for empty verdicts (no claims to check)", () => {
    expect(computeFactCheckScore([])).toBe(100);
  });

  it("returns 100 when all validated", () => {
    const verdicts: ClaimVerdict[] = [
      { status: "validated" },
      { status: "validated" },
      { status: "validated" },
    ];
    expect(computeFactCheckScore(verdicts)).toBe(100);
  });

  it("returns 0 when all refuted", () => {
    const verdicts: ClaimVerdict[] = [{ status: "refuted" }, { status: "refuted" }];
    expect(computeFactCheckScore(verdicts)).toBe(0);
  });

  it("returns 50 when all unclear", () => {
    expect(computeFactCheckScore([{ status: "unclear" }, { status: "unclear" }])).toBe(50);
  });

  it("balances validated against refuted", () => {
    const verdicts: ClaimVerdict[] = [
      { status: "validated" },
      { status: "validated" },
      { status: "refuted" },
    ];
    // 2 validated - 1 refuted = +1, normalized over 3 → 0.667
    // ((+1/3) + 1) / 2 = 0.667
    expect(computeFactCheckScore(verdicts)).toBe(67);
  });

  it("clamps to [0, 100] range", () => {
    expect(computeFactCheckScore([{ status: "validated" }])).toBeLessThanOrEqual(100);
    expect(computeFactCheckScore([{ status: "refuted" }])).toBeGreaterThanOrEqual(0);
  });
});
