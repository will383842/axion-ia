/**
 * Tests — content-quality.ts : contrôle qualité déterministe du contenu détaillé.
 */

import { describe, it, expect } from "vitest";
import { evaluateContenuDetailleQuality } from "./content-quality";
import { CONTENU_DETAILLE_VERSION, type ContenuDetaille } from "./content-schema";

function seq(withExercice: boolean) {
  return {
    titre: "Séquence",
    dureeMin: 30,
    concepts: [{ titre: "Concept", explication: "Explication suffisamment longue pour valider." }],
    exempleConcret: "Un exemple concret et réaliste, suffisamment détaillé pour compter.",
    pointsVigilance: [],
    ...(withExercice
      ? {
          exercice: {
            consigne: "Faire l'exercice décrit ici clairement.",
            dureeMin: 15,
            corrige: "Éléments de corrigé attendus détaillés.",
            criteresReussite: ["Critère observable"],
          },
        }
      : {}),
    noteFormateur: "Note d'animation.",
  };
}

function contenu(nbSeqPratique: number, nbSeqTotal: number): ContenuDetaille {
  const sequences = [
    ...Array.from({ length: nbSeqPratique }, () => seq(true)),
    ...Array.from({ length: nbSeqTotal - nbSeqPratique }, () => seq(false)),
  ];
  return {
    version: CONTENU_DETAILLE_VERSION,
    modalite: "presentiel",
    modules: [
      {
        moduleId: "M1",
        titre: "Module",
        introduction: "Introduction du module suffisamment longue pour valider.",
        sequences,
        synthese: "Synthèse du module suffisamment longue pour valider le seuil.",
        quiz: [
          {
            question: "Question ?",
            options: ["A", "B"],
            bonneReponseIndex: 0,
            explication: "Explication de la bonne réponse.",
          },
        ],
      },
    ],
  };
}

describe("content-quality", () => {
  it("note haut un contenu complet et pratique (≥60%)", () => {
    const r = evaluateContenuDetailleQuality(contenu(3, 4)); // 75% pratique
    expect(r.ratioPratique).toBeGreaterThanOrEqual(0.6);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.verdict).toBe("excellent");
    expect(r.manques).toHaveLength(0);
  });

  it("signale un ratio pratique insuffisant (<60%)", () => {
    const r = evaluateContenuDetailleQuality(contenu(1, 4)); // 25% pratique
    expect(r.ratioPratique).toBeLessThan(0.6);
    expect(r.manques.some((m) => m.includes("Ratio pratique"))).toBe(true);
    // Un contenu trop théorique ne peut pas être « excellent » (indicateur 9).
    expect(r.verdict).not.toBe("excellent");
  });

  it("signale une incohérence horaire (contenu trop court pour la durée)", () => {
    // contenu(3,4) = 4 séquences × 30 min = 120 min ; on vise 8h (480 min).
    const r = evaluateContenuDetailleQuality(contenu(3, 4), 8);
    expect(r.stats.totalMinutes).toBe(120);
    expect(r.manques.some((m) => m.includes("Volume horaire"))).toBe(true);
  });

  it("pas d'alerte horaire si la durée n'est pas fournie", () => {
    const r = evaluateContenuDetailleQuality(contenu(3, 4));
    expect(r.manques.some((m) => m.includes("Volume horaire"))).toBe(false);
  });

  it("verdict insuffisant + score 0 si aucun module", () => {
    const vide: ContenuDetaille = {
      version: CONTENU_DETAILLE_VERSION,
      modalite: "distanciel",
      modules: [],
    };
    const r = evaluateContenuDetailleQuality(vide);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe("insuffisant");
    expect(r.manques[0]).toContain("Aucun module");
  });
});
