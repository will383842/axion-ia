/**
 * Tests — grille-schema.ts
 *
 * Vérifie :
 * - DEFAULT_GRILLE_CRITERES est valide (parse sans erreur)
 * - Somme des poids = 100
 * - Rejet si somme ≠ 100
 * - Rejet si libelle < 10 chars
 */

import { describe, it, expect } from "vitest";
import {
  GrilleCriteresSchema,
  CritereQualiteSchema,
  DEFAULT_GRILLE_CRITERES,
} from "./grille-schema";

describe("CritereQualiteSchema", () => {
  it("accepte un critère valide", () => {
    const result = CritereQualiteSchema.safeParse({
      id: "test_critere",
      libelle: "Un libellé valide de plus de 10 chars",
      poids: 50,
      scoreMin: 60,
    });
    expect(result.success).toBe(true);
  });

  it("rejette un libelle trop court (< 10 chars)", () => {
    const result = CritereQualiteSchema.safeParse({
      id: "court",
      libelle: "Court",
      poids: 50,
      scoreMin: 60,
    });
    expect(result.success).toBe(false);
  });

  it("accepte le champ descriptif optionnel", () => {
    const result = CritereQualiteSchema.safeParse({
      id: "avec_desc",
      libelle: "Libellé avec descriptif",
      poids: 40,
      scoreMin: 50,
      descriptif: "Description longue du critère",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un poids > 100", () => {
    const result = CritereQualiteSchema.safeParse({
      id: "trop_haut",
      libelle: "Libellé bien long ici",
      poids: 150,
      scoreMin: 60,
    });
    expect(result.success).toBe(false);
  });
});

describe("GrilleCriteresSchema", () => {
  it("accepte DEFAULT_GRILLE_CRITERES sans erreur", () => {
    const result = GrilleCriteresSchema.safeParse(DEFAULT_GRILLE_CRITERES);
    expect(result.success).toBe(true);
  });

  it("DEFAULT_GRILLE_CRITERES somme des poids = 100", () => {
    const somme = DEFAULT_GRILLE_CRITERES.reduce((acc, c) => acc + c.poids, 0);
    expect(somme).toBe(100);
  });

  it("DEFAULT_GRILLE_CRITERES contient exactement 6 critères", () => {
    expect(DEFAULT_GRILLE_CRITERES).toHaveLength(6);
  });

  it("DEFAULT_GRILLE_CRITERES — tous les scoreMin sont des entiers 0-100", () => {
    for (const c of DEFAULT_GRILLE_CRITERES) {
      expect(c.scoreMin).toBeGreaterThanOrEqual(0);
      expect(c.scoreMin).toBeLessThanOrEqual(100);
      expect(Number.isInteger(c.scoreMin)).toBe(true);
    }
  });

  it("rejette si somme poids ≠ 100 (somme = 90)", () => {
    const grille = [
      { id: "c1", libelle: "Premier critère très long", poids: 50, scoreMin: 60 },
      { id: "c2", libelle: "Deuxième critère long aussi", poids: 40, scoreMin: 60 },
    ];
    const result = GrilleCriteresSchema.safeParse(grille);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "";
      expect(msg).toContain("90");
    }
  });

  it("rejette si somme poids > 100 (somme = 110)", () => {
    const grille = [
      { id: "c1", libelle: "Premier critère très long", poids: 60, scoreMin: 60 },
      { id: "c2", libelle: "Deuxième critère long aussi", poids: 50, scoreMin: 60 },
    ];
    const result = GrilleCriteresSchema.safeParse(grille);
    expect(result.success).toBe(false);
  });

  it("accepte une grille personnalisée avec somme=100", () => {
    const grille = [
      { id: "a", libelle: "Critère A avec libellé long", poids: 60, scoreMin: 50 },
      { id: "b", libelle: "Critère B avec libellé long", poids: 40, scoreMin: 50 },
    ];
    const result = GrilleCriteresSchema.safeParse(grille);
    expect(result.success).toBe(true);
  });
});
