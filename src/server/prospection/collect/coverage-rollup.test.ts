import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  rollupDepartementsToRegionsToFrance,
  dimKey,
  type CoverageCounters,
} from "./coverage-rollup";

describe("computeMetrics", () => {
  it("pas de division par zéro (agrégats stub tolérés)", () => {
    const m = computeMetrics({
      stockAttendu: 0,
      collectees: 0,
      enrichies: 0,
      exploitables: 0,
      partiels: 0,
      nonContactables: 0,
    });
    expect(m.pctCompletion).toBe(0);
    expect(m.pctExploitableSurCollectees).toBe(0);
    expect(m.pctExploitableSurStock).toBe(0);
  });
  it("taux corrects", () => {
    const m = computeMetrics({
      stockAttendu: 100,
      collectees: 80,
      enrichies: 40,
      exploitables: 20,
      partiels: 10,
      nonContactables: 50,
    });
    expect(m.pctCompletion).toBeCloseTo(0.8);
    expect(m.pctExploitableSurCollectees).toBeCloseTo(0.25);
    expect(m.pctExploitableSurStock).toBeCloseTo(0.2);
  });
  it("borne les taux à 1.0 (collectées > stock ne dépasse jamais 100 %)", () => {
    const m = computeMetrics({
      stockAttendu: 100,
      collectees: 130, // divergence résiduelle UL↔siège
      enrichies: 0,
      exploitables: 120,
      partiels: 0,
      nonContactables: 10,
    });
    expect(m.pctCompletion).toBe(1);
    expect(m.pctExploitableSurStock).toBe(1);
  });
});

describe("dimKey", () => {
  it("agrégat = étoiles", () => {
    expect(dimKey()).toBe("*|*|*");
    expect(dimKey("btp", "PME")).toBe("btp|PME|*");
  });
});

describe("rollupDepartementsToRegionsToFrance", () => {
  function c(over: Partial<CoverageCounters>): CoverageCounters {
    return {
      stockAttendu: 0,
      collectees: 0,
      enrichies: 0,
      exploitables: 0,
      partiels: 0,
      nonContactables: 0,
      ...over,
    };
  }
  it("agrège dép → région → France (Isère+Rhône → ARA)", () => {
    const perDep = new Map<string, CoverageCounters>([
      ["38", c({ stockAttendu: 100, collectees: 80, exploitables: 20 })], // Isère → 84
      ["69", c({ stockAttendu: 200, collectees: 150, exploitables: 60 })], // Rhône → 84
      ["75", c({ stockAttendu: 300, collectees: 300, exploitables: 100 })], // Paris → 11
    ]);
    const stats = rollupDepartementsToRegionsToFrance(perDep);

    const ara = stats.find((s) => s.scope === "region" && s.scopeId === "84");
    expect(ara?.stockAttendu).toBe(300);
    expect(ara?.collectees).toBe(230);
    expect(ara?.exploitables).toBe(80);

    const idf = stats.find((s) => s.scope === "region" && s.scopeId === "11");
    expect(idf?.collectees).toBe(300);

    const fr = stats.find((s) => s.scope === "france");
    expect(fr?.stockAttendu).toBe(600);
    expect(fr?.collectees).toBe(530);
    expect(fr?.pctCompletion).toBeCloseTo(530 / 600);

    // 3 dép + 2 régions + 1 France = 6 stats
    expect(stats).toHaveLength(6);
  });
});
