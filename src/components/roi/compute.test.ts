import { describe, it, expect } from "vitest";
import { computeRoi, ROI_CONSTANTS } from "./compute";

describe("computeRoi()", () => {
  it("returns zero gains when team size is zero", () => {
    const r = computeRoi({
      teamSize: 0,
      hoursDailyOnRepetitive: 3,
    });
    expect(r.hoursSavedPerWeekTeam).toBe(0);
    expect(r.daysLiberatedPerMonth).toBe(0);
    expect(r.emailsAutoPerMonth).toBe(0);
    expect(r.reportsAutoPerMonth).toBe(0);
  });

  it("returns zero gains when no repetitive tasks", () => {
    const r = computeRoi({
      teamSize: 10,
      hoursDailyOnRepetitive: 0,
    });
    expect(r.hoursSavedPerDayPerPerson).toBe(0);
    expect(r.hoursSavedPerWeekTeam).toBe(0);
    expect(r.daysLiberatedPerMonth).toBe(0);
    expect(r.pctTimeFreedDaily).toBe(0);
  });

  it("scales linearly with team size", () => {
    const base = computeRoi({ teamSize: 10, hoursDailyOnRepetitive: 3 });
    const doubled = computeRoi({ teamSize: 20, hoursDailyOnRepetitive: 3 });
    // hoursSavedPerDayPerPerson est par personne, donc identique
    expect(doubled.hoursSavedPerDayPerPerson).toBe(base.hoursSavedPerDayPerPerson);
    // En revanche, totaux équipe doublent (±1 arrondi)
    expect(
      Math.abs(doubled.hoursSavedPerWeekTeam - 2 * base.hoursSavedPerWeekTeam),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(doubled.daysLiberatedPerMonth - 2 * base.daysLiberatedPerMonth),
    ).toBeLessThanOrEqual(1);
  });

  it("scales linearly with hoursDailyOnRepetitive", () => {
    const low = computeRoi({ teamSize: 10, hoursDailyOnRepetitive: 1 });
    const high = computeRoi({ teamSize: 10, hoursDailyOnRepetitive: 4 });
    expect(high.hoursSavedPerDayPerPerson).toBeCloseTo(4 * low.hoursSavedPerDayPerPerson, 1);
  });

  it("matches a hand-computed reference scenario", () => {
    // 10 personnes, 3 h/jour sur tâches répétitives.
    // hoursSavedPerDayPerPerson = 3 * 0.6 = 1.8 h
    // hoursSavedPerWeekTeam = round(1.8 * 10 * 5) = 90 h
    // daysLiberatedPerMonth = round(1.8 * 10 * 21 / 8) = 47 j
    // emailsAutoPerMonth = round(10 * 50 * 21 * 0.6) = 6 300
    // reportsAutoPerMonth = round(10 * 12 * 0.6) = 72
    // pctTimeFreedDaily = round(1.8 / 8 * 100) = 23 %
    const r = computeRoi({ teamSize: 10, hoursDailyOnRepetitive: 3 });
    expect(r.hoursSavedPerDayPerPerson).toBe(1.8);
    expect(r.hoursSavedPerWeekTeam).toBe(90);
    expect(r.daysLiberatedPerMonth).toBe(47);
    expect(r.emailsAutoPerMonth).toBe(6300);
    expect(r.reportsAutoPerMonth).toBe(72);
    expect(r.pctTimeFreedDaily).toBe(23);
  });

  it("ai efficiency is reasonable (60 %)", () => {
    expect(ROI_CONSTANTS.aiEfficiency).toBe(0.6);
    expect(ROI_CONSTANTS.aiEfficiency).toBeGreaterThan(0);
    expect(ROI_CONSTANTS.aiEfficiency).toBeLessThan(1);
  });
});
