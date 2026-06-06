/**
 * Tests — scoring.ts
 *
 * Vérifie computeWeightedScore :
 * - 100/100 sur tous critères → 100
 * - 0/100 sur tous critères → 0
 * - Scores partiels (cas réels)
 * - Critère absent de parCritere → score 0 pour ce critère
 * - Clamp des valeurs hors [0, 100]
 */

import { describe, it, expect } from "vitest";
import { computeWeightedScore } from "./scoring";
import { DEFAULT_GRILLE_CRITERES } from "./grille-schema";
import type { GrilleCriteres } from "./grille-schema";

const SIMPLE_GRILLE: GrilleCriteres = [
  {
    id: "c1",
    libelle: "Critère 1 avec libellé long",
    poids: 60,
    scoreMin: 60,
  },
  {
    id: "c2",
    libelle: "Critère 2 avec libellé long",
    poids: 40,
    scoreMin: 60,
  },
];

describe("computeWeightedScore", () => {
  it("100/100 sur tous les critères → 100", () => {
    const parCritere: Record<string, number> = {};
    for (const c of DEFAULT_GRILLE_CRITERES) {
      parCritere[c.id] = 100;
    }
    expect(computeWeightedScore(parCritere, DEFAULT_GRILLE_CRITERES)).toBe(100);
  });

  it("0/100 sur tous les critères → 0", () => {
    const parCritere: Record<string, number> = {};
    for (const c of DEFAULT_GRILLE_CRITERES) {
      parCritere[c.id] = 0;
    }
    expect(computeWeightedScore(parCritere, DEFAULT_GRILLE_CRITERES)).toBe(0);
  });

  it("grille 2 critères (poids 60+40), scores 80+50 → 68", () => {
    // (80/100 * 60) + (50/100 * 40) = 48 + 20 = 68
    const result = computeWeightedScore({ c1: 80, c2: 50 }, SIMPLE_GRILLE);
    expect(result).toBe(68);
  });

  it("grille 2 critères, scores 100+0 → 60", () => {
    // (100/100 * 60) + (0/100 * 40) = 60 + 0 = 60
    expect(computeWeightedScore({ c1: 100, c2: 0 }, SIMPLE_GRILLE)).toBe(60);
  });

  it("critère absent de parCritere → score 0 pour ce critère", () => {
    // Seul c1=100 fourni, c2 absent → 0
    // (100/100 * 60) + (0/100 * 40) = 60
    expect(computeWeightedScore({ c1: 100 }, SIMPLE_GRILLE)).toBe(60);
  });

  it("grille vide → 0", () => {
    expect(computeWeightedScore({ c1: 100 }, [])).toBe(0);
  });

  it("scores négatifs clampés à 0", () => {
    // -50 → 0 → (0/100*60) + (80/100*40) = 32
    expect(computeWeightedScore({ c1: -50, c2: 80 }, SIMPLE_GRILLE)).toBe(32);
  });

  it("scores > 100 clampés à 100", () => {
    // 150 → 100 → (100/100*60) + (0/100*40) = 60
    expect(computeWeightedScore({ c1: 150, c2: 0 }, SIMPLE_GRILLE)).toBe(60);
  });

  it("arrondi correct : score 75 + grille équilibrée (50+50)", () => {
    const grille: GrilleCriteres = [
      { id: "a", libelle: "Critère A libellé long", poids: 50, scoreMin: 60 },
      { id: "b", libelle: "Critère B libellé long", poids: 50, scoreMin: 60 },
    ];
    // (75/100 * 50) + (75/100 * 50) = 37.5 + 37.5 = 75
    expect(computeWeightedScore({ a: 75, b: 75 }, grille)).toBe(75);
  });

  it("arrondi correct : 33.33... arrondi à l'entier le plus proche", () => {
    const grille: GrilleCriteres = [
      { id: "a", libelle: "Critère unique long long long", poids: 100, scoreMin: 60 },
    ];
    // (33/100 * 100) = 33
    expect(computeWeightedScore({ a: 33 }, grille)).toBe(33);
  });
});
