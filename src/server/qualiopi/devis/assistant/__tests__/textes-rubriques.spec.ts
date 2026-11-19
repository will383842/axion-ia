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
  /qualiopi|opco|financ|prise en charge|aucun gain garanti|(?:certif\w*|conforme)\s+(?:à l')?ai act|ai act|chatgpt|openai|claude|mistral|gemini|copilot|grenoble|€/i;

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
  it("TEXTE_PLAFOND_RESPONSABILITE reprend l'art. 38 : faute prouvée, fait générateur, 12 mois", () => {
    expect(TEXTE_PLAFOND_RESPONSABILITE).toContain("faute prouvée");
    expect(TEXTE_PLAFOND_RESPONSABILITE).toContain("fait générateur");
    expect(TEXTE_PLAFOND_RESPONSABILITE).toContain("12 mois");
  });
  it("TEXTE_GARANTIE renvoie aux limites des conditions générales", () => {
    expect(TEXTE_GARANTIE).toContain("dans les limites prévues aux conditions générales");
  });
  it("TEXTE_PLAFOND_FRAIS ne finit pas par un point", () => {
    expect(TEXTE_PLAFOND_FRAIS.endsWith(".")).toBe(false);
  });
});
