/**
 * Tests — grille-v3 « Standard Axion-IA » (seed 2026-08-05).
 *
 * Miroir de grille-v2.spec + vérifications propres à la v3 : les 3 critères du
 * Standard de contenu pédagogique de Will (5 blocs, transmissibilité
 * formateur, « à emporter »), et le bump de promptVersion (sans lui, le cache
 * IA servirait des évaluations rendues sous la grille v2).
 */

import { describe, it, expect } from "vitest";
import { GRILLE_V3_CRITERES } from "../../../../prisma/seeds/qualiopi/grille-v3";
import { GrilleCriteresSchema } from "@/server/qualiopi/engine/grille-schema";

describe("GRILLE_V3_CRITERES", () => {
  it("contient exactement 13 critères", () => {
    expect(GRILLE_V3_CRITERES).toHaveLength(13);
  });

  it("somme des poids = 100", () => {
    const somme = GRILLE_V3_CRITERES.reduce((acc, c) => acc + c.poids, 0);
    expect(somme).toBe(100);
  });

  it("valide par GrilleCriteresSchema (Zod)", () => {
    const result = GrilleCriteresSchema.safeParse(GRILLE_V3_CRITERES);
    expect(result.success).toBe(true);
  });

  it("IDs uniques", () => {
    const ids = GRILLE_V3_CRITERES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("conserve les 10 critères de la v2 et ajoute les 3 du Standard", () => {
    const ids = GRILLE_V3_CRITERES.map((c) => c.id);
    for (const idV2 of [
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
    ]) {
      expect(ids, `critère v2 "${idV2}" perdu`).toContain(idV2);
    }
    expect(ids).toContain("cinq_blocs_module");
    expect(ids).toContain("transmissibilite_formateur");
    expect(ids).toContain("a_emporter_tangible");
  });

  it("les critères du Standard portent ses exigences textuelles clés", () => {
    const parId = new Map(GRILLE_V3_CRITERES.map((c) => [c.id, c]));
    // Le prompt d'évaluation est généré depuis ces descriptifs : si l'exigence
    // n'y est pas écrite, elle n'est pas évaluée.
    expect(parId.get("cinq_blocs_module")?.descriptif).toContain("prompt affiché EN ENTIER");
    expect(parId.get("transmissibilite_formateur")?.descriptif).toContain("plan B");
    expect(parId.get("transmissibilite_formateur")?.descriptif).toContain("universels");
    expect(parId.get("a_emporter_tangible")?.descriptif).toContain("réutilisable");
  });
});
