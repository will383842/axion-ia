import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildPh3PromptAugmentation } from "../prompt-augmentation";

const saved = process.env.QUALITY_PROFILES_ENABLED;
afterEach(() => {
  if (saved === undefined) delete process.env.QUALITY_PROFILES_ENABLED;
  else process.env.QUALITY_PROFILES_ENABLED = saved;
});

describe("buildPh3PromptAugmentation (PH3b)", () => {
  describe("flag OFF (dormance)", () => {
    beforeEach(() => {
      delete process.env.QUALITY_PROFILES_ENABLED;
    });
    it("retourne '' (chaîne vide) ⇒ prompt inchangé", () => {
      expect(
        buildPh3PromptAugmentation({
          contentType: "pain_point_solution",
          targetSearchIntent: "commercial_investigation",
          targetSecteur: "comptabilite_finance",
          vertical: "audits",
          anchorVilleSlug: "paris",
        }),
      ).toBe("");
    });
  });

  describe("flag ON", () => {
    beforeEach(() => {
      process.env.QUALITY_PROFILES_ENABLED = "true";
    });

    it("profil commercial + targetSecteur + vertical → injecte le contexte douleur", () => {
      const s = buildPh3PromptAugmentation({
        contentType: "pain_point_solution",
        targetSearchIntent: "commercial_investigation",
        targetSecteur: "comptabilite_finance",
        vertical: "audits",
      });
      expect(s.length).toBeGreaterThan(0);
      // serializePainContextForPrompt produit un bloc douleur (sans € — cf. price-gate)
      expect(s).not.toMatch(/\d+\s*k?€/);
    });

    it("ville ancrée → injecte le bloc d'ancrage local (même sans data éco = mode dégradé)", () => {
      const s = buildPh3PromptAugmentation({
        contentType: "blog_article",
        targetSearchIntent: "informational",
        anchorVilleSlug: "paris",
      });
      expect(s).toMatch(/ANCRAGE/i);
      expect(s.toLowerCase()).toContain("paris");
    });

    it("profil informational sans ville ni secteur → '' (pas d'injection)", () => {
      expect(
        buildPh3PromptAugmentation({
          contentType: "glossary_term",
          targetSearchIntent: "informational",
        }),
      ).toBe("");
    });

    it("profil informational : PAS de pain-matrix même avec targetSecteur (commercial-only)", () => {
      const s = buildPh3PromptAugmentation({
        contentType: "glossary_term",
        targetSearchIntent: "informational",
        targetSecteur: "comptabilite_finance",
        vertical: "audits",
      });
      expect(s).toBe("");
    });

    it("ville inconnue → pas de throw, '' ou ancrage selon résolution", () => {
      const s = buildPh3PromptAugmentation({
        contentType: "blog_article",
        targetSearchIntent: "informational",
        anchorVilleSlug: "ville-totalement-inexistante-xyz",
      });
      expect(typeof s).toBe("string");
    });
  });
});
