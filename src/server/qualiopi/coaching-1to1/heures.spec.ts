/**
 * Tests — heures.ts (coaching 1-to-1, conseil).
 *
 * Règle : heures réelles = Σ CompteRenduSeance.dureeMinutes / 60, sans gate de
 * régime de preuve (2026-08-10 — le module AFEST et ses régimes ont été
 * supprimés, décision Will). + le taux d'avancement vs heures prévues.
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

  it("avancement complet (≥ prévu) → 100 %", () => {
    expect(computeTaux1to1(14, 14)).toBe(100);
  });

  // 🔴 F65 — ces deux cas retournaient 100 % et 0 %. Sans durée prévue, il n'y
  // a AUCUNE référence : le taux n'est pas 100 %, il est incalculable. `null`
  // force l'appelant à afficher « non calculable ».
  it("F65 : sans heures prévues, le taux est INCALCULABLE, pas 100 %", () => {
    expect(computeTaux1to1(9.5, null)).toBeNull();
    expect(computeTaux1to1(9.5, 0)).toBeNull();
  });

  it("F65 : incalculable aussi quand rien n'a été réalisé", () => {
    expect(computeTaux1to1(0, null)).toBeNull();
  });

  it("reste calculable dès qu'une durée prévue existe", () => {
    expect(computeTaux1to1(0, 14)).toBe(0);
    expect(computeTaux1to1(7, 14)).toBe(50);
  });

  it("parcours partiel (9,5 h / 20 h prévues) → 48 %", () => {
    expect(computeTaux1to1(9.5, 20)).toBe(48); // 47,5 → 48
  });

  it("cohérence centièmes → taux entier (1,45 h / 2 h = 73 %)", () => {
    expect(computeTaux1to1(1.45, 2)).toBe(73); // 72,5 → 73
  });
});
