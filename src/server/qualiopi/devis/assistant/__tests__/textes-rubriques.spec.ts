import { describe, expect, it } from "vitest";
import {
  TEXTE_DELAIS,
  TEXTE_GARANTIE,
  TEXTE_PLAFOND_FRAIS,
  TEXTE_PLAFOND_RESPONSABILITE,
} from "../textes-rubriques";

const TEXTES = {
  TEXTE_DELAIS,
  TEXTE_GARANTIE,
  TEXTE_PLAFOND_FRAIS,
  TEXTE_PLAFOND_RESPONSABILITE,
};
const INTERDIT =
  /qualiopi|opco|financ|prise en charge|aucun gain garanti|ai act|chatgpt|openai|claude|mistral|gemini|copilot|grenoble|€/i;

describe("textes des rubriques du devis", () => {
  for (const [nom, texte] of Object.entries(TEXTES)) {
    it(`${nom} : aucun mot interdit`, () => {
      expect(texte).not.toMatch(INTERDIT);
    });
    it(`${nom} : 600 caractères au plus`, () => {
      expect(texte.length).toBeGreaterThan(0);
      expect(texte.length).toBeLessThanOrEqual(600);
    });
  }
  it("TEXTE_PLAFOND_FRAIS ne finit pas par un point", () => {
    expect(TEXTE_PLAFOND_FRAIS.endsWith(".")).toBe(false);
  });
});
