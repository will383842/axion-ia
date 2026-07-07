/**
 * Tests — adaptation à la durée dans les prompts (recommendedModuleRange +
 * buildDureeGuidance + injection dans buildStructureUserPrompt).
 */

import { describe, it, expect } from "vitest";
import { recommendedModuleRange, buildDureeGuidance, buildStructureUserPrompt } from "./prompts";

describe("adaptation à la durée", () => {
  it("propose plus de modules pour une formation longue", () => {
    const court = recommendedModuleRange(4); // 4h
    const long = recommendedModuleRange(21); // 3j
    expect(court.min).toBeGreaterThanOrEqual(2);
    expect(long.min).toBeGreaterThan(court.min);
    expect(long.max).toBeLessThanOrEqual(12); // plafond aligné worker
    expect(court.max).toBeGreaterThanOrEqual(court.min);
  });

  it("buildDureeGuidance chiffre le total, le nombre de modules et le temps pratique", () => {
    const g = buildDureeGuidance(4, 70);
    expect(g).toContain("240 minutes"); // 4h
    expect(g).toContain("70 %"); // ratio réel utilisé
    expect(g).toMatch(/\d+ à \d+ modules/);
  });

  it("utilise 60% par défaut si ratio absent", () => {
    expect(buildDureeGuidance(7, null)).toContain("60 %");
    expect(buildDureeGuidance(7, undefined)).toContain("60 %");
  });

  it("buildStructureUserPrompt injecte la durée cible et le ratio réel", () => {
    const prompt = buildStructureUserPrompt({
      titre: "IA Express",
      dureeHeures: 4,
      modalite: "presentiel",
      objectifsPedagogiques: ["Utiliser un LLM"],
      ratioPratiquePct: 75,
    });
    expect(prompt).toContain("240 minutes");
    expect(prompt).toContain("75 %");
    expect(prompt).toContain("0.75"); // ratioPratiqueEstime aligné
  });
});
