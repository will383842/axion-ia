/**
 * Garde-fou — matrice de prix catalogue formations (catégorie × durée).
 * Valeurs FIGÉES sur `Downloads/Titres_Formations_Axion-IA.md` (refonte
 * 2026-07-19, décision Will : prix publics par groupe de 2 à 15 participants).
 * Toute modif accidentelle d'un prix casse ce test. Additif : n'affecte pas
 * INTERVENTION_TIERS (testé ailleurs).
 */

import { describe, it, expect } from "vitest";
import {
  FORMATION_PRICE_MATRIX,
  getFormationPrice,
  getFormationBrackets,
  getFormationEntryPrice,
  formatFormationPrice,
  getFormationCatalogPriceRange,
} from "@/content/pricing";

describe("matrice prix — valeurs figées (catalogue 2026-07-19)", () => {
  it("offres générales : 4h 1200 · 1j 1900 · 2j 3600", () => {
    expect(getFormationPrice("generale", "4h")).toBe(1200);
    expect(getFormationPrice("generale", "1j")).toBe(1900);
    expect(getFormationPrice("generale", "2j")).toBe(3600);
    expect(getFormationPrice("generale", "3j")).toBeUndefined();
  });

  it("offres par métier : 1j 1900 · 2j 3600 (pas de 4h)", () => {
    expect(getFormationPrice("metier", "1j")).toBe(1900);
    expect(getFormationPrice("metier", "2j")).toBe(3600);
    expect(getFormationPrice("metier", "4h")).toBeUndefined();
  });

  it("offres par secteur : 1j 2200 · 2j 3900 (pas de 4h)", () => {
    expect(getFormationPrice("secteur", "1j")).toBe(2200);
    expect(getFormationPrice("secteur", "2j")).toBe(3900);
    expect(getFormationPrice("secteur", "4h")).toBeUndefined();
  });
});

describe("matrice prix — helpers", () => {
  it("getFormationBrackets : tranche unique 2-15 quand la case existe", () => {
    expect(getFormationBrackets("generale", "1j")).toEqual(["2-15"]);
    expect(getFormationBrackets("secteur", "2j")).toEqual(["2-15"]);
    expect(getFormationBrackets("metier", "4h")).toEqual([]);
  });

  it("getFormationEntryPrice = le prix de la case (tranche unique)", () => {
    expect(getFormationEntryPrice("generale", "4h")).toBe(1200);
    expect(getFormationEntryPrice("secteur", "1j")).toBe(2200);
    expect(getFormationEntryPrice("generale", "4h")).toBeLessThan(
      getFormationEntryPrice("generale", "1j")!,
    );
  });

  it("formatFormationPrice formate (et tombe sur « Sur devis » si absent)", () => {
    expect(formatFormationPrice("generale", "4h", "fr")).toContain("1");
    expect(formatFormationPrice("generale", "4h", "fr")).not.toContain("HT HT");
    expect(formatFormationPrice("metier", "4h", "fr")).toBe("Sur devis");
  });

  it("fourchette catalogue : min 1200, max 3900", () => {
    expect(getFormationCatalogPriceRange()).toEqual({ minEur: 1200, maxEur: 3900 });
  });

  it("intégrité matrice : tous les prix > 0, secteur ≥ métier à durée égale", () => {
    for (const cat of Object.keys(FORMATION_PRICE_MATRIX) as Array<
      keyof typeof FORMATION_PRICE_MATRIX
    >) {
      for (const v of Object.values(FORMATION_PRICE_MATRIX[cat])) {
        if (typeof v === "number") expect(v).toBeGreaterThan(0);
      }
    }
    expect(getFormationPrice("secteur", "1j")!).toBeGreaterThan(getFormationPrice("metier", "1j")!);
    expect(getFormationPrice("secteur", "2j")!).toBeGreaterThan(getFormationPrice("metier", "2j")!);
    // Progression durée (générales) : 4h < 1j < 2j.
    expect(getFormationPrice("generale", "4h")!).toBeLessThan(getFormationPrice("generale", "1j")!);
    expect(getFormationPrice("generale", "1j")!).toBeLessThan(getFormationPrice("generale", "2j")!);
  });
});
