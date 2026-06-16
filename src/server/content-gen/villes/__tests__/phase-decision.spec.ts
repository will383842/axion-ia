import { describe, it, expect } from "vitest";
import { computeNextVillePhase } from "../phase-decision";
import { PHASE_DEFINITIONS } from "../phased-coverage";

describe("computeNextVillePhase (PH5)", () => {
  const targets = {
    PHASE_1_HUB: 6,
    PHASE_2_PILIERS: 4,
    PHASE_3_DOULEURS: 10,
    PHASE_4_CONVERSION: 8,
    PHASE_5_LONGTAIL: 12,
  } as const;

  it("rien publié → commence par PHASE_1_HUB", () => {
    expect(computeNextVillePhase({}, targets)).toBe("PHASE_1_HUB");
  });

  it("Phase 1 incomplète → reste sur PHASE_1_HUB", () => {
    expect(computeNextVillePhase({ PHASE_1_HUB: 3 }, targets)).toBe("PHASE_1_HUB");
  });

  it("Phase 1 atteinte (gate Phase 2 satisfait) → passe à PHASE_2_PILIERS", () => {
    expect(computeNextVillePhase({ PHASE_1_HUB: 6 }, targets)).toBe("PHASE_2_PILIERS");
  });

  it("gate fermé : Phase 1 complète par target mais < minArticles dépendance → attendre (null)", () => {
    // target Phase 1 = 2 (atteint) mais le gate Phase 2 exige minArticlesInDepPhase (4)
    const def2 = PHASE_DEFINITIONS.find((p) => p.phase === "PHASE_2_PILIERS");
    expect(def2?.minArticlesInDepPhase).toBeGreaterThan(2);
    expect(computeNextVillePhase({ PHASE_1_HUB: 2 }, { ...targets, PHASE_1_HUB: 2 })).toBeNull();
  });

  it("progression : Phases 1+2 atteintes → PHASE_3_DOULEURS", () => {
    expect(computeNextVillePhase({ PHASE_1_HUB: 6, PHASE_2_PILIERS: 4 }, targets)).toBe(
      "PHASE_3_DOULEURS",
    );
  });

  it("toutes les cibles atteintes → null (ville couverte)", () => {
    expect(
      computeNextVillePhase(
        {
          PHASE_1_HUB: 6,
          PHASE_2_PILIERS: 4,
          PHASE_3_DOULEURS: 10,
          PHASE_4_CONVERSION: 8,
          PHASE_5_LONGTAIL: 12,
        },
        targets,
      ),
    ).toBeNull();
  });

  it("déterministe", () => {
    const a = computeNextVillePhase({ PHASE_1_HUB: 6 }, targets);
    const b = computeNextVillePhase({ PHASE_1_HUB: 6 }, targets);
    expect(a).toBe(b);
  });
});
