/**
 * Tests — taux.ts
 *
 * Vérifie :
 *   - computeTauxPresence : cas normaux, zéro prévu, arrondi
 *   - classifierPresence : seuils 80 (défaut), 60, et seuil custom
 */

import { describe, it, expect } from "vitest";
import { computeTauxPresence, classifierPresence } from "./taux";

describe("computeTauxPresence", () => {
  it("100 % présence → tauxPct=100", () => {
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
    ]);
    expect(result.tauxPct).toBe(100);
    expect(result.minutesPrevues).toBe(420);
    expect(result.minutesRealisees).toBe(420);
  });

  it("0 % présence → tauxPct=0", () => {
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
    ]);
    expect(result.tauxPct).toBe(0);
  });

  it("présence partielle → arrondi correct", () => {
    // 315/420 = 75 %
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 105 },
    ]);
    expect(result.tauxPct).toBe(75);
  });

  it("arrondi au plus proche : 2/3 = 66.66 → 67", () => {
    const result = computeTauxPresence([{ dureePrevueMinutes: 300, dureeRealiseeMinutes: 200 }]);
    expect(result.tauxPct).toBe(67);
  });

  it("aucune durée prévue (liste vide) → tauxPct=0", () => {
    const result = computeTauxPresence([]);
    expect(result.tauxPct).toBe(0);
    expect(result.minutesPrevues).toBe(0);
    expect(result.minutesRealisees).toBe(0);
  });

  it("aucune durée prévue (zéro) → tauxPct=0", () => {
    const result = computeTauxPresence([{ dureePrevueMinutes: 0, dureeRealiseeMinutes: 0 }]);
    expect(result.tauxPct).toBe(0);
  });

  it("somme plusieurs créneaux correcte", () => {
    const result = computeTauxPresence([
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 210 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 168 },
      { dureePrevueMinutes: 210, dureeRealiseeMinutes: 0 },
    ]);
    // (210+168+0)/(210+210+210) = 378/630 = 60 %
    expect(result.tauxPct).toBe(60);
    expect(result.minutesPrevues).toBe(630);
    expect(result.minutesRealisees).toBe(378);
  });
});

describe("classifierPresence", () => {
  // ── Seuil défaut (80) ──
  it("80 % → 'complete' (≥ seuil défaut 80)", () => {
    expect(classifierPresence(80)).toBe("complete");
  });

  it("100 % → 'complete'", () => {
    expect(classifierPresence(100)).toBe("complete");
  });

  it("75 % → 'partielle' (60..79)", () => {
    expect(classifierPresence(75)).toBe("partielle");
  });

  it("60 % → 'partielle' (borne inférieure)", () => {
    expect(classifierPresence(60)).toBe("partielle");
  });

  it("59 % → 'aucune' (< 60)", () => {
    expect(classifierPresence(59)).toBe("aucune");
  });

  it("0 % → 'aucune'", () => {
    expect(classifierPresence(0)).toBe("aucune");
  });

  // ── Seuil custom ──
  it("seuil 90 : 89 % → 'partielle'", () => {
    expect(classifierPresence(89, 90)).toBe("partielle");
  });

  it("seuil 90 : 90 % → 'complete'", () => {
    expect(classifierPresence(90, 90)).toBe("complete");
  });

  it("seuil 70 : 70 % → 'complete'", () => {
    expect(classifierPresence(70, 70)).toBe("complete");
  });

  it("seuil 70 : 65 % → 'partielle'", () => {
    expect(classifierPresence(65, 70)).toBe("partielle");
  });
});
