/**
 * La garantie de remboursement de la Journée IA entre dans les CGV (alinéa 47.10).
 * Aucun montant n'est tapé : le seuil se calcule depuis `pricing.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLegal } from "@/content/legal";
import {
  MAJORATION_PLANCHER_COUT_HORAIRE_PCT,
  MULTIPLE_GARANTIE,
  SEUIL_DEVIS_DEDUCTION_EUR,
  seuilGarantieEur,
} from "@/content/journee-ia-commun";

const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const sections = getLegal("conditions-generales").fr.sections;
const corps = (n: number): string => {
  const section = sections.find((s) => s.title.includes(`Article ${n}. `));
  if (!section) throw new Error(`Article ${n} introuvable dans les CGV`);
  return section.body;
};

describe("CGV : garantie de la Journée IA (art. 47.10)", () => {
  it("l'article 47 porte l'alinéa 47.10, les gains identifiés et le seuil calculé", () => {
    const a47 = corps(47);
    expect(a47).toContain("47.10 Garantie de remboursement de la Journée IA");
    expect(a47).toContain("gains identifiés");
    expect(a47).toContain(`${milliers(seuilGarantieEur())} euros HT`);
    expect(a47).toContain(`${MULTIPLE_GARANTIE} fois le prix HT`);
  });

  it("l'article 47 ne contient aucun terme interdit ni l'ancien délai de 90 jours", () => {
    const a47 = corps(47);
    expect(a47).not.toMatch(
      /Grenoble|gain garanti|validés par vous|sans discussion|OPCO|financement|prise en charge/i,
    );
    expect(a47).not.toContain("90 jours");
  });

  it("les articles 16.2 et 48.3 renvoient à l'article 47.10", () => {
    expect(corps(16)).toContain("article 47.10");
    expect(corps(48)).toContain("article 47.10");
  });

  it("l'article 47.7 exige un devis d'au moins le seuil calculé, avant déduction", () => {
    const a47 = corps(47);
    expect(a47).toContain("atteint au moins");
    expect(a47).toContain(`${milliers(SEUIL_DEVIS_DEDUCTION_EUR)} euros HT avant déduction`);
  });

  it("legal.ts ne tape pas le seuil du devis de déduction dans l'article 47.7", () => {
    const source = readFileSync(join(process.cwd(), "src/content/legal.ts"), "utf8");
    // L'article 38.2 cite déjà un autre plafond de « 5 000 euros » : on borne le contrôle au 47.7.
    const debut = source.indexOf("47.7 Passage à un projet.");
    const fin = source.indexOf("47.8 Sécurité sur place.");
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    const a477 = source.slice(debut, fin);
    expect(a477).not.toContain("5 000");
    expect(a477).not.toContain("5000");
    expect(a477).toContain("${SEUIL_DEDUCTION}");
  });

  it("le source de legal.ts ne tape aucun montant de la journée", () => {
    const source = readFileSync(join(process.cwd(), "src/content/legal.ts"), "utf8");
    expect(source).not.toMatch(/4[\s\u00a0\u202f]?470/);
    expect(source).not.toMatch(/1[\s\u00a0\u202f]?490/);
  });
  describe("texte rendu de l'article 47", () => {
    const phrases = [
      "n'atteint pas",
      "sans que le Client ait à le demander",
      "TVA correspondante",
      "même s'il est remboursé ou si le prix cesse d'être dû",
      "Elle ne s'applique pas à une journée remboursée au titre de l'article 47.10",
      "autour du siège d'Axion-IA",
      "Par exception à l'article 9.2",
      "La garantie ne couvre que la journée tenue",
      "le prix de mise en place, par Axion-IA ou par un tiers, n'est pas retiré",
      `majoré de ${MAJORATION_PLANCHER_COUT_HORAIRE_PCT} %`,
      "la déduction est reprise",
      "dans le total remis à la fin de la journée",
      "arrondi au centime",
      "dans les 30 jours suivant cet accord",
      "À défaut de remise écrite du total",
      "restituer le remboursement reçu",
      "les sommes qu'il a lui-même payées au titre de ce prix",
      `${milliers(SEUIL_DEVIS_DEDUCTION_EUR)} euros HT avant déduction`,
    ];
    for (const phrase of phrases) {
      it(`contient « ${phrase} »`, () => {
        expect(corps(47)).toContain(phrase);
      });
    }

    describe("47.10 ne dépend plus du questionnaire de préparation", () => {
      const a4710 = () => {
        const a47 = corps(47);
        return a47.slice(a47.indexOf("47.10 Garantie"));
      };
      it("l'alinéa 47.10 est bien présent", () => {
        expect(corps(47).indexOf("47.10 Garantie")).toBeGreaterThan(-1);
      });
      it("ne mentionne aucun questionnaire", () => {
        expect(a4710()).not.toMatch(/questionnaire/i);
      });
      for (const phrase of [
        "sans autre formalité",
        "Si le Client n'indique pas de coût horaire",
        "au plus tard pendant la journée",
      ]) {
        it(`contient « ${phrase} »`, () => {
          expect(a4710()).toContain(phrase);
        });
      }
    });

    it("ne propose plus de tenue à distance", () => {
      expect(corps(47)).not.toContain("tenue à distance");
    });

    it("n'emploie pas « La Journée IA » avec l'article", () => {
      expect(corps(47)).not.toContain("La Journée IA");
    });

    it("les articles 16 et 48 ne parlent pas de « gain garanti »", () => {
      expect(corps(16)).not.toContain("gain garanti");
      expect(corps(48)).not.toContain("gain garanti");
    });

    it("corps() lève une erreur si l'article est introuvable", () => {
      expect(() => corps(9999)).toThrow(/introuvable/);
    });
  });
});
