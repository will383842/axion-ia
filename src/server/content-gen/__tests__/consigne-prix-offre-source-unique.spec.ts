// La consigne de prix des prompts lit la durée du rendez-vous gratuit dans
// `src/content/offre.ts` : le texte rendu reste EXACTEMENT celui d'avant.
// Voir `src/content/__tests__/offre-source-unique.spec.ts` pour la source et le balayage
// (rangé ici, et non là-bas, pour respecter l'isolation du module de génération).

import { describe, it, expect } from "vitest";

import { FORMULE_SUR_DEVIS } from "@/server/content-gen/brand/consigne-prix";

describe("consigne de prix — branchée sur la source unique de l'offre", () => {
  it("rend la même formule qu'avant", () => {
    expect(FORMULE_SUR_DEVIS).toBe(
      "sur devis, parlons-en lors du rendez-vous gratuit de 45 minutes",
    );
  });
});
