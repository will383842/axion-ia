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

  it("exclut une absence ACTÉE (présence signée + bénéficiaire absent)", () => {
    // Séance 1 présente (120) comptée ; séance 2 absence signée exclue.
    expect(
      sumHeuresReelles([
        { dureeMinutes: 120, presenceSigneeAt: new Date("2026-01-01"), beneficiairePresent: true },
        { dureeMinutes: 180, presenceSigneeAt: new Date("2026-01-02"), beneficiairePresent: false },
      ]),
    ).toBe(2);
  });

  it("compte une séance NON encore signée (présence en attente ≠ absence)", () => {
    // beneficiairePresent=false SANS presenceSigneeAt = pas encore signée → comptée
    // (ne pas régresser en mettant à 0 les séances en attente de signature).
    expect(
      sumHeuresReelles([{ dureeMinutes: 120, presenceSigneeAt: null, beneficiairePresent: false }]),
    ).toBe(2);
  });
});

describe("computeTaux1to1", () => {
  it("heures réalisées / heures prévues × 100", () => {
    expect(computeTaux1to1(12, 14)).toBe(86); // 12/14 = 85,7 → 86
  });

  it("assiduité complète (≥ prévu) → 100 %", () => {
    expect(computeTaux1to1(14, 14)).toBe(100);
  });

  // 🔴 F65 — ces deux cas retournaient 100 % et 0 %. Sans durée conventionnelle,
  // il n'y a AUCUNE référence : le taux n'est pas 100 %, il est incalculable.
  // Un parcours de 2 h sur 30 prévues aurait été attesté « 100 % d'assiduité »
  // du seul fait qu'aucune durée n'était renseignée — et ce taux partait sur
  // l'attestation. `null` force l'appelant à refuser d'attester.
  it("F65 : sans heures prévues, le taux est INCALCULABLE, pas 100 %", () => {
    expect(computeTaux1to1(9.5, null)).toBeNull();
    expect(computeTaux1to1(9.5, 0)).toBeNull();
  });

  it("F65 : incalculable aussi quand rien n'a été réalisé", () => {
    expect(computeTaux1to1(0, null)).toBeNull();
  });

  it("reste calculable dès qu'une durée conventionnelle existe", () => {
    expect(computeTaux1to1(0, 14)).toBe(0);
    expect(computeTaux1to1(7, 14)).toBe(50);
  });

  it("parcours partiel (9,5 h / 20 h prévues) → 48 %", () => {
    expect(computeTaux1to1(9.5, 20)).toBe(48); // 47,5 → 48
  });

  it("cohérence centièmes → taux entier (1,45 h / 2 h = 73 %)", () => {
    // Le taux d'assiduité s'applique au % (entier RNQ), pas aux centièmes d'heure.
    expect(computeTaux1to1(1.45, 2)).toBe(73); // 72,5 → 73
  });
});
