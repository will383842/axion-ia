import { describe, it, expect } from "vitest";
import { computeRoi, ROI_CONSTANTS } from "./compute";

describe("computeRoi()", () => {
  it("returns zero savings when team size is zero", () => {
    const r = computeRoi({
      teamSize: 0,
      annualSalaryK: 48,
      repetitivePct: 30,
      aiCoveragePct: 60,
    });
    expect(r.annualSavings).toBe(0);
    expect(r.hoursSavedPerWeek).toBe(0);
    expect(r.paybackWeeks).toBe(0);
  });

  it("returns zero savings when both percentage levers are zero", () => {
    const r = computeRoi({
      teamSize: 50,
      annualSalaryK: 48,
      repetitivePct: 0,
      aiCoveragePct: 0,
    });
    expect(r.annualSavings).toBe(0);
    expect(r.paybackWeeks).toBe(0);
  });

  it("scales linearly with team size", () => {
    const base = computeRoi({
      teamSize: 10,
      annualSalaryK: 48,
      repetitivePct: 30,
      aiCoveragePct: 60,
    });
    const doubled = computeRoi({
      teamSize: 20,
      annualSalaryK: 48,
      repetitivePct: 30,
      aiCoveragePct: 60,
    });
    // Allow ±1 € rounding wobble.
    expect(Math.abs(doubled.annualSavings - 2 * base.annualSavings)).toBeLessThanOrEqual(2);
    expect(doubled.hoursSavedPerWeek).toBeGreaterThan(base.hoursSavedPerWeek);
  });

  it("scales linearly with the repetitive-task percentage", () => {
    const low = computeRoi({
      teamSize: 20,
      annualSalaryK: 48,
      repetitivePct: 20,
      aiCoveragePct: 60,
    });
    const high = computeRoi({
      teamSize: 20,
      annualSalaryK: 48,
      repetitivePct: 40,
      aiCoveragePct: 60,
    });
    expect(Math.abs(high.annualSavings - 2 * low.annualSavings)).toBeLessThanOrEqual(2);
  });

  it("clamps paybackWeeks to ≥ 1 once savings exist", () => {
    // Massively profitable scenario.
    const r = computeRoi({
      teamSize: 500,
      annualSalaryK: 200,
      repetitivePct: 80,
      aiCoveragePct: 90,
    });
    expect(r.paybackWeeks).toBeGreaterThanOrEqual(1);
    expect(r.paybackWeeks).toBeLessThan(ROI_CONSTANTS.workingWeeks); // any sane scenario pays back in < 1 yr
  });

  it("matches a hand-computed reference scenario", () => {
    // 20 people, 48 k€ gross, 30 % repetitive, 60 % AI coverage.
    // hoursSavedPerYear = 20 * 40 * 46 * 0.3 * 0.6 = 6 624 h
    // hourlyRate = 48 000 * 1.4 / (40 * 46) = 36.521739…
    // annualSavings ≈ round(6 624 * 36.521739) = 241 920 €
    // hoursSavedPerWeek = round(6 624 / 46) = 144 h
    // weeklySavings = 241 920 / 46 ≈ 5 259
    // paybackWeeks = max(1, round(5 000 / 5 259)) = 1
    const r = computeRoi({
      teamSize: 20,
      annualSalaryK: 48,
      repetitivePct: 30,
      aiCoveragePct: 60,
    });
    expect(r.annualSavings).toBe(241_920);
    expect(r.hoursSavedPerWeek).toBe(144);
    expect(r.paybackWeeks).toBe(1);
  });
});
