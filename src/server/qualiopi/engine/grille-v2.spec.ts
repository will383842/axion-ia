/**
 * Tests — grille-v2 (seed T5 Excellence)
 *
 * Vérifie :
 * - GRILLE_V2_CRITERES contient exactement 10 critères
 * - Somme des poids = 100
 * - Valide par GrilleCriteresSchema (Zod)
 * - Tous les scoreMin dans [0, 100]
 * - IDs uniques
 */

import { describe, it, expect } from "vitest";
import { GRILLE_V2_CRITERES } from "../../../../prisma/seeds/qualiopi/grille-v2";
import { GrilleCriteresSchema } from "./grille-schema";

describe("GRILLE_V2_CRITERES", () => {
  it("contient exactement 10 critères", () => {
    expect(GRILLE_V2_CRITERES).toHaveLength(10);
  });

  it("somme des poids = 100", () => {
    const somme = GRILLE_V2_CRITERES.reduce((acc, c) => acc + c.poids, 0);
    expect(somme).toBe(100);
  });

  it("valide par GrilleCriteresSchema (Zod)", () => {
    const result = GrilleCriteresSchema.safeParse(GRILLE_V2_CRITERES);
    if (!result.success) {
      // Affiche les erreurs Zod pour faciliter le debug
      const msgs = result.error.issues.map((i) => i.message).join("; ");
      throw new Error(`GrilleCriteresSchema invalide : ${msgs}`);
    }
    expect(result.success).toBe(true);
  });

  it("tous les scoreMin sont dans [0, 100] et entiers", () => {
    for (const c of GRILLE_V2_CRITERES) {
      expect(c.scoreMin).toBeGreaterThanOrEqual(0);
      expect(c.scoreMin).toBeLessThanOrEqual(100);
      expect(Number.isInteger(c.scoreMin)).toBe(true);
    }
  });

  it("tous les poids sont dans [0, 100] et entiers", () => {
    for (const c of GRILLE_V2_CRITERES) {
      expect(c.poids).toBeGreaterThanOrEqual(0);
      expect(c.poids).toBeLessThanOrEqual(100);
      expect(Number.isInteger(c.poids)).toBe(true);
    }
  });

  it("IDs uniques", () => {
    const ids = GRILLE_V2_CRITERES.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("contient les 10 IDs attendus", () => {
    const expectedIds = [
      "objectifs_mesurables",
      "bloom_progression",
      "moments_cles",
      "alignement_objectifs_contenu_eval",
      "progression_pedagogique",
      "ratio_pratique",
      "kirkpatrick_l2",
      "clarte_structure",
      "faisabilite_exercices",
      "fil_rouge_narratif",
    ];
    const actualIds = GRILLE_V2_CRITERES.map((c) => c.id);
    for (const id of expectedIds) {
      expect(actualIds).toContain(id);
    }
  });

  it("tous les libellés font ≥ 10 caractères", () => {
    for (const c of GRILLE_V2_CRITERES) {
      expect(c.libelle.length).toBeGreaterThanOrEqual(10);
    }
  });
});
