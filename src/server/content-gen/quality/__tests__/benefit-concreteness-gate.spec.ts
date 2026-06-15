import { describe, it, expect } from "vitest";
import {
  evaluateBenefitConcreteness,
  ANTI_FLUFF_PHRASES,
} from "../benefit-concreteness-gate";

describe("benefit-concreteness-gate (PH2)", () => {
  it("texte commercial fort (2 chiffres + avant/après + 0 fluff) → score 100", () => {
    const content =
      "Cet audit vous apporte 30% de gain sur la saisie et 60% de réduction des erreurs. " +
      "Avant : vos équipes ressaisissent tout. Désormais : la donnée circule seule.";
    const r = evaluateBenefitConcreteness(content);
    expect(r.concreteNumbersCount).toBeGreaterThanOrEqual(2);
    expect(r.hasBeforeAfter).toBe(true);
    expect(r.antiFluffFound).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.feedback).toBe("");
  });

  it("texte vide ou jargon creux → score bas + feedback ciblé (jamais de throw)", () => {
    const content =
      "Notre solution IA innovante révolutionne votre activité grâce à des synergies puissantes.";
    const r = evaluateBenefitConcreteness(content);
    expect(r.score).toBeLessThan(70);
    expect(r.antiFluffFound.length).toBeGreaterThan(0);
    expect(r.antiFluffFound).toContain("solution ia");
    expect(r.feedback).toMatch(/jargon|chiffres|scénario/i);
  });

  it("chiffres concrets seuls (sans avant/après, sans fluff) → 40 + 30 = 70", () => {
    const content = "Vous récupérez 30% de gain et 2 h par semaine sur les relances.";
    const r = evaluateBenefitConcreteness(content);
    expect(r.concreteNumbersCount).toBeGreaterThanOrEqual(2);
    expect(r.hasBeforeAfter).toBe(false);
    // 40 (chiffres) + 0 (avant/après) + 30 (anti-fluff propre) = 70
    expect(r.score).toBe(70);
  });

  it("un seul chiffre concret → 20 (proportionnel)", () => {
    const content = "Vous gagnez 30% de gain, sans autre détail chiffré ici.";
    const r = evaluateBenefitConcreteness(content);
    expect(r.concreteNumbersCount).toBe(1);
    // 20 (1 chiffre) + 0 + 30 (propre) = 50
    expect(r.score).toBe(50);
  });

  it("détecte le scénario avant/après", () => {
    const before = evaluateBenefitConcreteness("Avant : c'était long.");
    expect(before.hasBeforeAfter).toBe(false); // après manquant
    const both = evaluateBenefitConcreteness(
      "Avant : c'était long. Désormais : tout est rapide.",
    );
    expect(both.hasBeforeAfter).toBe(true);
  });

  it("string vide / null → score 0, pas d'exception", () => {
    expect(evaluateBenefitConcreteness("").score).toBe(0);
    // @ts-expect-error robustesse runtime
    expect(evaluateBenefitConcreteness(null).score).toBe(0);
  });

  it("est déterministe (même entrée → même score)", () => {
    const c = "30% de gain. 60% de réduction. Avant : X. Désormais : Y.";
    expect(evaluateBenefitConcreteness(c).score).toBe(evaluateBenefitConcreteness(c).score);
  });

  it("la liste anti-fluff est distincte et non vide (concept marketing creux)", () => {
    expect(ANTI_FLUFF_PHRASES.length).toBeGreaterThan(10);
    expect(ANTI_FLUFF_PHRASES).toContain("synergies");
    expect(ANTI_FLUFF_PHRASES).toContain("disruptif");
  });
});
