/**
 * Tests — deck-days : regroupement par journée des formations multi-jours.
 */

import { describe, it, expect } from "vitest";
import { grouperParJour, estMultiJours, dureeModuleMin, MINUTES_PAR_JOUR } from "./deck-days";
import { construireDeck } from "./deck-builder";
import {
  CONTENU_DETAILLE_VERSION,
  type ContenuDetaille,
  type ModuleContenu,
} from "../../engine/content-schema";

function mod(id: string, dureeMinTotal: number): ModuleContenu {
  return {
    moduleId: id,
    titre: `Module ${id}`,
    introduction: "Introduction du module suffisamment longue pour valider.",
    sequences: [
      {
        titre: "Séquence",
        dureeMin: dureeMinTotal,
        concepts: [{ titre: "Concept", explication: "Explication assez longue pour valider." }],
        exempleConcret: "Un exemple concret et détaillé pour la démonstration.",
        pointsVigilance: [],
        noteFormateur: "Note d'animation.",
      },
    ],
    synthese: "Synthèse du module suffisamment longue pour valider.",
    quiz: [],
  };
}

describe("deck-days", () => {
  it("mono-jour : une formation ≤ 7h reste sur 1 journée", () => {
    const modules = [mod("1", 120), mod("2", 120)]; // 4h
    const jours = grouperParJour(modules);
    expect(jours).toHaveLength(1);
    expect(estMultiJours(modules)).toBe(false);
  });

  it("multi-jours : 3 jours (21h) → 3 journées ~7h", () => {
    // 6 modules de 210 min = 1260 min = 21h → 3 journées de 420 min
    const modules = Array.from({ length: 6 }, (_, i) => mod(String(i + 1), 210));
    const jours = grouperParJour(modules);
    expect(jours.length).toBe(3);
    expect(estMultiJours(modules)).toBe(true);
    for (const j of jours) expect(j.dureeMin).toBeLessThanOrEqual(MINUTES_PAR_JOUR);
  });

  it("dureeModuleMin somme les séquences", () => {
    expect(dureeModuleMin(mod("1", 90))).toBe(90);
  });

  it("le deck insère des slides Jour + bilan pour une formation multi-jours", () => {
    const modules = Array.from({ length: 6 }, (_, i) => mod(String(i + 1), 210));
    const contenu: ContenuDetaille = {
      version: CONTENU_DETAILLE_VERSION,
      modalite: "presentiel",
      modules,
    };
    const deck = construireDeck({ titreFormation: "Formation 3 jours", contenuDetaille: contenu });
    const jourSlides = deck.slides.filter((s) => s.kind === "jour");
    expect(jourSlides.length).toBe(3);
    expect(jourSlides[0]?.titre).toBe("Jour 1");
    expect(deck.slides.some((s) => s.titre.includes("Bilan du jour"))).toBe(true);
  });

  it("le deck n'insère PAS de slide Jour pour une formation mono-jour", () => {
    const contenu: ContenuDetaille = {
      version: CONTENU_DETAILLE_VERSION,
      modalite: "presentiel",
      modules: [mod("1", 120), mod("2", 120)],
    };
    const deck = construireDeck({ titreFormation: "Formation 4h", contenuDetaille: contenu });
    expect(deck.slides.some((s) => s.kind === "jour")).toBe(false);
  });
});
