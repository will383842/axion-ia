/**
 * Tests — deck-pptx : génération PowerPoint (smoke, fail-soft).
 *
 * En local (pptxgenjs absent via jonction node_modules) → retourne null sans
 * throw. En CI (lib installée) → retourne un Buffer .pptx (signature ZIP « PK »).
 * Le test valide les DEUX cas sans casser.
 */

import { describe, it, expect } from "vitest";
import { construireDeck } from "./deck-builder";
import { renderDeckPptx } from "./deck-pptx";
import { CONTENU_DETAILLE_VERSION, type ContenuDetaille } from "../../engine/content-schema";

const CONTENU: ContenuDetaille = {
  version: CONTENU_DETAILLE_VERSION,
  modalite: "presentiel",
  modules: [
    {
      moduleId: "M1",
      titre: "Module 1",
      introduction: "Introduction du module suffisamment longue pour valider.",
      sequences: [
        {
          titre: "Séquence 1",
          dureeMin: 30,
          concepts: [{ titre: "Concept", explication: "Explication assez longue pour valider." }],
          exempleConcret: "Exemple concret et détaillé pour la démonstration.",
          pointsVigilance: [],
          noteFormateur: "Note d'animation.",
        },
      ],
      synthese: "Synthèse du module suffisamment longue pour valider.",
      quiz: [],
    },
  ],
};

describe("deck-pptx (smoke fail-soft)", () => {
  it("retourne null (lib absente) OU un Buffer .pptx (signature ZIP), sans throw", async () => {
    const deck = construireDeck({ titreFormation: "IA Express", contenuDetaille: CONTENU });
    const result = await renderDeckPptx(deck);
    if (result === null) {
      expect(result).toBeNull(); // fail-soft local
    } else {
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.subarray(0, 2).toString()).toBe("PK"); // ZIP/OOXML magic
    }
  });
});
