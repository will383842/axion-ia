import { describe, it, expect } from "vitest";
import { ESSENTIELLE_SUB_TIERS } from "@/content/pricing";
import { CLIENT_SECTORS } from "@/content/sectors";
import {
  computeRoi,
  computeTrainingCost,
  ADOPTION_EFFICIENCY,
  ROI_CONSTANTS,
  ROI_BOUNDS,
  ROI_SECTOR_PRESETS,
  ROI_TASK_FAMILIES,
  type RoiInputs,
} from "./compute";

/** Scénario de référence : 10 personnes, 3 h/j répétitives, adoption réaliste. */
const BASE: RoiInputs = {
  teamSize: 10,
  hoursDailyOnRepetitive: 3,
  adoption: "realiste",
  sector: "generique",
  hourlyCostEur: 45,
};

describe("computeRoi()", () => {
  it("returns zero gains when team size is zero", () => {
    const r = computeRoi({ ...BASE, teamSize: 0 });
    expect(r.hoursSavedPerWeekTeam).toBe(0);
    expect(r.hoursSavedPerYearTeam).toBe(0);
    expect(r.daysLiberatedPerMonth).toBe(0);
    expect(r.fteRecovered).toBe(0);
    expect(r.emailsAssistedPerMonth).toBe(0);
    expect(r.reportsAssistedPerMonth).toBe(0);
    expect(r.money.annualValueEur).toBe(0);
    expect(r.money.paybackWorkingDays).toBeNull();
  });

  it("returns zero gains when there are no repetitive tasks", () => {
    const r = computeRoi({ ...BASE, hoursDailyOnRepetitive: 0 });
    expect(r.hoursSavedPerDayPerPerson).toBe(0);
    expect(r.hoursSavedPerWeekTeam).toBe(0);
    expect(r.pctTimeFreedDaily).toBe(0);
    // Pas de gain → aucun retour possible, alors même que la formation a un coût.
    expect(r.money.trainingCostEur).toBeGreaterThan(0);
    expect(r.money.paybackWorkingDays).toBeNull();
  });

  it("scales team totals linearly with team size, keeping the per-person figure stable", () => {
    const base = computeRoi(BASE);
    const doubled = computeRoi({ ...BASE, teamSize: 20 });
    expect(doubled.hoursSavedPerDayPerPerson).toBe(base.hoursSavedPerDayPerPerson);
    expect(doubled.hoursSavedPerWeekTeam).toBe(2 * base.hoursSavedPerWeekTeam);
    expect(doubled.hoursSavedPerYearTeam).toBe(2 * base.hoursSavedPerYearTeam);
    expect(doubled.money.annualValueEur).toBe(2 * base.money.annualValueEur);
  });

  it("scales linearly with hoursDailyOnRepetitive", () => {
    const low = computeRoi({ ...BASE, hoursDailyOnRepetitive: 1 });
    const high = computeRoi({ ...BASE, hoursDailyOnRepetitive: 4 });
    expect(high.hoursSavedPerDayPerPerson).toBeCloseTo(4 * low.hoursSavedPerDayPerPerson, 5);
  });

  it("matches a hand-computed reference scenario", () => {
    // 10 personnes, 3 h/j répétitives, adoption réaliste (60 %), 45 €/h.
    //   hoursSavedPerDayPerPerson = 3 × 0.6                      = 1.8 h
    //   hoursSavedPerWeekTeam     = round(1.8 × 10 × 5)          = 90 h
    //   hoursSavedPerYearTeam     = round(1.8 × 10 × 218)        = 3 924 h
    //   daysLiberatedPerMonth     = round(1.8 × 10 × 21 / 7)     = 54 j
    //   pctTimeFreedDaily         = round(1.8 / 7 × 100)         = 26 %
    //   fteRecovered              = round1(3 924 / 1 607)        = 2.4
    //   emailsAssistedPerMonth    = round(10 × 30 × 21 × 0.6)    = 3 780
    //   reportsAssistedPerMonth   = round(10 × 8 × 0.6)          = 48
    //   annualValueEur            = 3 924 × 45                   = 176 580 €
    //   trainingCostEur           = palier 2-15 pers             = 2 450 €
    //   paybackWorkingDays        = ceil(2450 / (1.8 × 10 × 45)) = ceil(3.02…) = 4 j
    const r = computeRoi(BASE);
    expect(r.hoursSavedPerDayPerPerson).toBe(1.8);
    expect(r.hoursSavedPerWeekTeam).toBe(90);
    expect(r.hoursSavedPerYearTeam).toBe(3924);
    expect(r.daysLiberatedPerMonth).toBe(54);
    expect(r.pctTimeFreedDaily).toBe(26);
    expect(r.fteRecovered).toBe(2.4);
    expect(r.emailsAssistedPerMonth).toBe(3780);
    expect(r.reportsAssistedPerMonth).toBe(48);
    expect(r.money.annualValueEur).toBe(176_580);
    expect(r.money.trainingCostEur).toBe(2450);
    expect(r.money.paybackWorkingDays).toBe(4);
  });

  it("applies the efficiency of the chosen adoption scenario", () => {
    const prudent = computeRoi({ ...BASE, adoption: "prudent" });
    const realiste = computeRoi({ ...BASE, adoption: "realiste" });
    const ambitieux = computeRoi({ ...BASE, adoption: "ambitieux" });

    expect(prudent.efficiency).toBe(0.4);
    expect(realiste.efficiency).toBe(0.6);
    expect(ambitieux.efficiency).toBe(0.75);

    // 3 h × chaque efficacité (2.25 arrondi à 2.3).
    expect(prudent.hoursSavedPerDayPerPerson).toBe(1.2);
    expect(realiste.hoursSavedPerDayPerPerson).toBe(1.8);
    expect(ambitieux.hoursSavedPerDayPerPerson).toBe(2.3);

    expect(prudent.hoursSavedPerYearTeam).toBeLessThan(realiste.hoursSavedPerYearTeam);
    expect(realiste.hoursSavedPerYearTeam).toBeLessThan(ambitieux.hoursSavedPerYearTeam);
  });

  it("clamps out-of-range inputs instead of producing absurd figures", () => {
    const negative = computeRoi({ ...BASE, teamSize: -5, hoursDailyOnRepetitive: -2 });
    expect(negative.hoursSavedPerWeekTeam).toBe(0);
    expect(negative.money.trainingCostEur).toBe(0);

    const huge = computeRoi({ ...BASE, teamSize: 10_000, hoursDailyOnRepetitive: 99 });
    const capped = computeRoi({
      ...BASE,
      teamSize: ROI_BOUNDS.teamSize.max,
      hoursDailyOnRepetitive: ROI_BOUNDS.hoursDailyOnRepetitive.max,
    });
    expect(huge).toEqual(capped);

    expect(computeRoi({ ...BASE, hourlyCostEur: 1 }).money.hourlyCostEur).toBe(
      ROI_BOUNDS.hourlyCostEur.min,
    );
    expect(computeRoi({ ...BASE, hourlyCostEur: 9_999 }).money.hourlyCostEur).toBe(
      ROI_BOUNDS.hourlyCostEur.max,
    );
  });

  it("never frees more than a full working day", () => {
    // Pire cas admissible : 6 h répétitives, adoption ambitieuse.
    const worst = computeRoi({
      ...BASE,
      hoursDailyOnRepetitive: ROI_BOUNDS.hoursDailyOnRepetitive.max,
      adoption: "ambitieux",
    });
    expect(worst.hoursSavedPerDayPerPerson).toBeLessThanOrEqual(ROI_CONSTANTS.hoursPerDay);
    expect(worst.pctTimeFreedDaily).toBeLessThanOrEqual(100);
  });
});

describe("task breakdown", () => {
  it("splits the freed hours across the four families, in a stable order", () => {
    const r = computeRoi(BASE);
    expect(r.taskBreakdown.map((s) => s.family)).toEqual([...ROI_TASK_FAMILIES]);
  });

  it("has sector mixes that always sum to 100 %", () => {
    for (const [key, preset] of Object.entries(ROI_SECTOR_PRESETS)) {
      const total = ROI_TASK_FAMILIES.reduce((sum, f) => sum + preset.taskMixPct[f], 0);
      expect(total, `mix du secteur "${key}"`).toBe(100);
    }
  });

  it("distributes essentially all the freed weekly hours (rounding aside)", () => {
    const r = computeRoi(BASE);
    const distributed = r.taskBreakdown.reduce((sum, s) => sum + s.hoursPerWeekTeam, 0);
    // 4 arrondis à l'entier → écart maximal de 2 h sur le total.
    expect(Math.abs(distributed - r.hoursSavedPerWeekTeam)).toBeLessThanOrEqual(2);
  });

  it("reflects the sector: a law firm leans on research, an accountant on reporting", () => {
    const juridique = computeRoi({ ...BASE, sector: "juridique" });
    const compta = computeRoi({ ...BASE, sector: "comptabilite_finance" });
    const share = (r: ReturnType<typeof computeRoi>, family: string) =>
      r.taskBreakdown.find((s) => s.family === family)!.sharePct;

    expect(share(juridique, "recherche")).toBeGreaterThan(share(compta, "recherche"));
    expect(share(compta, "reporting")).toBeGreaterThan(share(juridique, "reporting"));
  });

  it("falls back to the generic mix for an unknown sector", () => {
    // Cas défensif : clé hors SSOT (vieux lien, données corrompues).
    const unknown = computeRoi({ ...BASE, sector: "n_existe_pas" as never });
    const generic = computeRoi({ ...BASE, sector: "generique" });
    expect(unknown.taskBreakdown).toEqual(generic.taskBreakdown);
  });

  it("covers every SSOT client sector, so the <select> can never render a hole", () => {
    for (const sector of CLIENT_SECTORS) {
      expect(ROI_SECTOR_PRESETS[sector.slug], `preset manquant : ${sector.slug}`).toBeDefined();
    }
    // +1 pour la clé "generique".
    expect(Object.keys(ROI_SECTOR_PRESETS)).toHaveLength(CLIENT_SECTORS.length + 1);
  });
});

describe("computeTrainingCost()", () => {
  const small = ESSENTIELLE_SUB_TIERS.find((t) => t.id === "essentielle-standard")!.priceFlat;
  const large = ESSENTIELLE_SUB_TIERS.find((t) => t.id === "essentielle-complete")!.priceFlat;

  it("is free for an empty team", () => {
    expect(computeTrainingCost(0)).toEqual({ trainingCostEur: 0, sessionsNeeded: 0 });
    expect(computeTrainingCost(-3)).toEqual({ trainingCostEur: 0, sessionsNeeded: 0 });
  });

  it("uses the small-group price up to 15 people", () => {
    expect(computeTrainingCost(1).trainingCostEur).toBe(small);
    expect(computeTrainingCost(15).trainingCostEur).toBe(small);
  });

  it("switches to the large-group price from 16 to 30 people", () => {
    expect(computeTrainingCost(16).trainingCostEur).toBe(large);
    expect(computeTrainingCost(30)).toEqual({ trainingCostEur: large, sessionsNeeded: 1 });
  });

  it("adds a session per 30-people slice beyond a single group", () => {
    expect(computeTrainingCost(31)).toEqual({ trainingCostEur: 2 * large, sessionsNeeded: 2 });
    expect(computeTrainingCost(60)).toEqual({ trainingCostEur: 2 * large, sessionsNeeded: 2 });
    expect(computeTrainingCost(61)).toEqual({ trainingCostEur: 3 * large, sessionsNeeded: 3 });
  });

  it("reads its prices from the pricing SSOT, never from a literal", () => {
    // Garde-fou : si ESSENTIELLE_SUB_TIERS bouge, le simulateur suit.
    expect(computeRoi({ ...BASE, teamSize: 10 }).money.trainingCostEur).toBe(small);
    expect(computeRoi({ ...BASE, teamSize: 20 }).money.trainingCostEur).toBe(large);
  });
});

describe("model assumptions", () => {
  it("keeps the adoption scenarios ordered and within plausible bounds", () => {
    const { prudent, realiste, ambitieux } = ADOPTION_EFFICIENCY;
    expect(prudent).toBeGreaterThan(0);
    expect(prudent).toBeLessThan(realiste);
    expect(realiste).toBeLessThan(ambitieux);
    expect(ambitieux).toBeLessThan(1);
  });

  it("uses French statutory working-time references", () => {
    expect(ROI_CONSTANTS.hoursPerDay).toBe(7);
    expect(ROI_CONSTANTS.annualHoursPerFte).toBe(1607);
  });
});
