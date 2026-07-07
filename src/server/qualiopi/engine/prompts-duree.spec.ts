/**
 * Tests — adaptation à la durée dans les prompts (recommendedModuleRange +
 * buildDureeGuidance + injection dans buildStructureUserPrompt).
 */

import { describe, it, expect } from "vitest";
import {
  recommendedModuleRange,
  buildDureeGuidance,
  buildStructureUserPrompt,
  buildContextePedagogique,
  buildModuleContentStructuredUserPrompt,
  buildContentCritiqueSystemPrompt,
} from "./prompts";

describe("adaptation à la durée", () => {
  it("propose plus de modules pour une formation longue", () => {
    const court = recommendedModuleRange(4); // 4h
    const long = recommendedModuleRange(21); // 3j
    expect(court.min).toBeGreaterThanOrEqual(2);
    expect(long.min).toBeGreaterThan(court.min);
    expect(long.max).toBeLessThanOrEqual(12); // plafond aligné worker
    expect(court.max).toBeGreaterThanOrEqual(court.min);
  });

  it("buildDureeGuidance chiffre le total, le nombre de modules et le temps pratique", () => {
    const g = buildDureeGuidance(4, 70);
    expect(g).toContain("240 minutes"); // 4h
    expect(g).toContain("70 %"); // ratio réel utilisé
    expect(g).toMatch(/\d+ à \d+ modules/);
  });

  it("utilise 60% par défaut si ratio absent", () => {
    expect(buildDureeGuidance(7, null)).toContain("60 %");
    expect(buildDureeGuidance(7, undefined)).toContain("60 %");
  });

  it("buildStructureUserPrompt injecte la durée cible et le ratio réel", () => {
    const prompt = buildStructureUserPrompt({
      titre: "IA Express",
      dureeHeures: 4,
      modalite: "presentiel",
      objectifsPedagogiques: ["Utiliser un LLM"],
      ratioPratiquePct: 75,
    });
    expect(prompt).toContain("240 minutes");
    expect(prompt).toContain("75 %");
    expect(prompt).toContain("0.75"); // ratioPratiqueEstime aligné
  });
});

describe("contexte pédagogique", () => {
  it("retourne '' si aucun paramètre (ou tous_niveaux)", () => {
    expect(buildContextePedagogique({})).toBe("");
    expect(buildContextePedagogique({ niveau: "tous_niveaux" })).toBe("");
    expect(buildContextePedagogique({ prerequis: "  " })).toBe("");
  });

  it("injecte niveau, prérequis, secteur et outils quand renseignés", () => {
    const ctx = buildContextePedagogique({
      niveau: "debutant",
      prerequis: "savoir utiliser un navigateur",
      secteurCible: "cabinet d'avocats",
      outilsClient: "Microsoft 365",
    });
    expect(ctx).toContain("debutant");
    expect(ctx).toContain("savoir utiliser un navigateur");
    expect(ctx).toContain("cabinet d'avocats");
    expect(ctx).toContain("Microsoft 365");
  });

  it("le prompt de structure intègre le contexte pédagogique", () => {
    const prompt = buildStructureUserPrompt({
      titre: "IA & droit",
      dureeHeures: 7,
      modalite: "presentiel",
      objectifsPedagogiques: ["Rédiger plus vite"],
      niveau: "debutant",
      secteurCible: "cabinet d'avocats",
    });
    expect(prompt).toContain("cabinet d'avocats");
    expect(prompt).toContain("debutant");
  });
});

describe("auto-correction & critique du contenu", () => {
  const baseModule = {
    formationTitre: "IA Express",
    modalite: "presentiel",
    objectifsFormation: ["Utiliser un LLM"],
    module: { moduleId: "M1", titre: "Module 1" },
  };

  it("les consignes d'amélioration sont injectées dans le prompt de contenu", () => {
    const withConsignes = buildModuleContentStructuredUserPrompt({
      ...baseModule,
      consignes: "AXE_A_CORRIGER : exemples trop génériques",
    });
    expect(withConsignes).toContain("CONSIGNES D'AMÉLIORATION");
    expect(withConsignes).toContain("AXE_A_CORRIGER");
    // absentes si pas de consignes
    expect(buildModuleContentStructuredUserPrompt(baseModule)).not.toContain(
      "CONSIGNES D'AMÉLIORATION",
    );
  });

  it("le prompt système de critique challenge concret/transférabilité/exercices", () => {
    const sys = buildContentCritiqueSystemPrompt().toLowerCase();
    expect(sys).toContain("avocat du diable");
    expect(sys).toContain("transférabilité");
    expect(sys).toContain("exercices");
    expect(sys).toContain('"axes"');
  });
});
