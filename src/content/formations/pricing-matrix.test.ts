/**
 * Garde-fou — matrice de prix catalogue formations V2 (gamme × durée × effectif).
 * Valeurs FIGÉES sur `50-commercial/catalogue-formations-ia-final.md`. Toute
 * modif accidentelle d'un prix casse ce test. Additif : n'affecte pas
 * INTERVENTION_TIERS (testé ailleurs).
 */

import { describe, it, expect } from "vitest";
import {
  FORMATION_PRICE_MATRIX,
  getFormationPrice,
  getFormationBrackets,
  getFormationEntryPrice,
  formatFormationPrice,
} from "@/content/pricing";

describe("matrice prix V2 — valeurs figées (catalogue 2026-06-11)", () => {
  it("gamme IA standard", () => {
    expect(getFormationPrice("ia-standard", "4h", "2-15")).toBe(1200);
    expect(getFormationPrice("ia-standard", "4h", "16-30")).toBe(1900);
    expect(getFormationPrice("ia-standard", "1j", "2-15")).toBe(1900);
    expect(getFormationPrice("ia-standard", "1j", "16-30")).toBe(3200);
    expect(getFormationPrice("ia-standard", "2j", "2-15")).toBe(3600);
    expect(getFormationPrice("ia-standard", "2j", "16-30")).toBe(5800);
    expect(getFormationPrice("ia-standard", "3j", "2-15")).toBe(4900);
    expect(getFormationPrice("ia-standard", "3j", "16-30")).toBe(7900);
  });

  it("gamme Agents & Automatisations (groupes 2-12)", () => {
    expect(getFormationPrice("agents-automatisations", "2j", "2-12")).toBe(3600);
    expect(getFormationPrice("agents-automatisations", "3j", "2-12")).toBe(4900);
    // Agents n'existe pas en 4h ni 1j
    expect(getFormationPrice("agents-automatisations", "4h", "2-15")).toBeUndefined();
    expect(getFormationPrice("agents-automatisations", "1j", "2-15")).toBeUndefined();
  });

  it("gamme Claude (+20%)", () => {
    expect(getFormationPrice("claude", "1j", "2-15")).toBe(2300);
    expect(getFormationPrice("claude", "1j", "16-30")).toBe(3850);
    expect(getFormationPrice("claude", "2j", "2-12")).toBe(4300);
    expect(getFormationPrice("claude", "3j", "2-12")).toBe(5900);
  });
});

describe("matrice prix V2 — helpers", () => {
  it("getFormationBrackets renvoie les tranches existantes dans l'ordre", () => {
    expect(getFormationBrackets("ia-standard", "1j")).toEqual(["2-15", "16-30"]);
    expect(getFormationBrackets("agents-automatisations", "2j")).toEqual(["2-12"]);
    expect(getFormationBrackets("claude", "2j")).toEqual(["2-12"]);
    expect(getFormationBrackets("agents-automatisations", "4h")).toEqual([]);
  });

  it("getFormationEntryPrice = prix le plus bas de la case", () => {
    expect(getFormationEntryPrice("ia-standard", "4h")).toBe(1200);
    expect(getFormationEntryPrice("claude", "1j")).toBe(2300);
    expect(getFormationEntryPrice("agents-automatisations", "3j")).toBe(4900);
    expect(getFormationEntryPrice("ia-standard", "4h")).toBeLessThan(
      getFormationEntryPrice("ia-standard", "1j")!,
    );
  });

  it("formatFormationPrice formate (et tombe sur « Sur devis » si absent)", () => {
    expect(formatFormationPrice("ia-standard", "4h", "2-15", "fr")).toContain("1");
    expect(formatFormationPrice("agents-automatisations", "4h", "2-15", "fr")).toBe("Sur devis");
  });

  it("intégrité matrice : tous les prix > 0 et cohérents (4h < 1j < 2j < 3j en IA)", () => {
    for (const gamme of Object.keys(FORMATION_PRICE_MATRIX) as Array<
      keyof typeof FORMATION_PRICE_MATRIX
    >) {
      for (const duree of Object.keys(FORMATION_PRICE_MATRIX[gamme])) {
        const cell = FORMATION_PRICE_MATRIX[gamme][duree as "4h"];
        for (const v of Object.values(cell ?? {})) {
          if (typeof v === "number") expect(v).toBeGreaterThan(0);
        }
      }
    }
    // Progression durée en IA standard (tranche 2-15)
    expect(getFormationEntryPrice("ia-standard", "4h")!).toBeLessThan(
      getFormationEntryPrice("ia-standard", "1j")!,
    );
    expect(getFormationEntryPrice("ia-standard", "1j")!).toBeLessThan(
      getFormationEntryPrice("ia-standard", "2j")!,
    );
    expect(getFormationEntryPrice("ia-standard", "2j")!).toBeLessThan(
      getFormationEntryPrice("ia-standard", "3j")!,
    );
  });
});
