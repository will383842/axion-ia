/**
 * Tests — heures.ts (1-to-1 / AFEST)
 *
 * Vérifie la règle fondamentale : heures réelles = Σ CompteRenduSeance.dureeMinutes
 * (PAS Formation.dureeHeures × taux), + le taux d'assiduité vs heures prévues.
 */

import { describe, it, expect } from "vitest";
import { sumHeuresReelles, computeTaux1to1 } from "./heures";

describe("sumHeuresReelles", () => {
  it("somme les durées de séance en heures (centièmes)", () => {
    // 180 + 150 + 240 = 570 min = 9,5 h
    expect(
      sumHeuresReelles([{ dureeMinutes: 180 }, { dureeMinutes: 150 }, { dureeMinutes: 240 }]),
    ).toBe(9.5);
  });

  it("ignore les séances sans durée (null = 0)", () => {
    expect(sumHeuresReelles([{ dureeMinutes: 120 }, { dureeMinutes: null }])).toBe(2);
  });

  it("aucune séance → 0 h", () => {
    expect(sumHeuresReelles([])).toBe(0);
  });

  it("arrondit au centième (90 min = 1,5 h)", () => {
    expect(sumHeuresReelles([{ dureeMinutes: 90 }])).toBe(1.5);
  });

  it("450 min = 7,5 h (centièmes 7,50)", () => {
    expect(sumHeuresReelles([{ dureeMinutes: 450 }])).toBe(7.5);
  });
});

describe("computeTaux1to1", () => {
  it("heures réalisées / heures prévues × 100", () => {
    expect(computeTaux1to1(12, 14)).toBe(86); // 12/14 = 85,7 → 86
  });

  it("assiduité complète (≥ prévu) → 100 %", () => {
    expect(computeTaux1to1(14, 14)).toBe(100);
  });

  it("sans heures prévues + heures réalisées > 0 → 100 %", () => {
    expect(computeTaux1to1(9.5, null)).toBe(100);
    expect(computeTaux1to1(9.5, 0)).toBe(100);
  });

  it("sans heures prévues + aucune heure réalisée → 0 %", () => {
    expect(computeTaux1to1(0, null)).toBe(0);
  });

  it("parcours partiel (9,5 h / 20 h prévues) → 48 %", () => {
    expect(computeTaux1to1(9.5, 20)).toBe(48); // 47,5 → 48
  });

  it("cohérence centièmes → taux entier (1,45 h / 2 h = 73 %)", () => {
    // Le taux d'assiduité s'applique au % (entier RNQ), pas aux centièmes d'heure.
    expect(computeTaux1to1(1.45, 2)).toBe(73); // 72,5 → 73
  });
});
