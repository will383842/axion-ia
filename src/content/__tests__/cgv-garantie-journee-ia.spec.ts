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

  it("le remboursement n'est jamais automatique : il passe par la demande de l'alinéa (f)", () => {
    const a47 = corps(47);
    expect(a47).not.toContain("sans autre formalité");
    expect(a47).not.toContain("Axion-IA rembourse le Client");
    expect(a47).toContain("le Client peut obtenir le remboursement de la journée selon (f)");
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
      "dans le rapport écrit remis selon l'article 47.1 (c)",
      "Le rapport indique le total et son détail",
      "des coûts d'erreurs, de retards et de pénalités évités",
      "peut demander le remboursement par écrit dans les 30 jours suivant la remise du rapport",
      "la demande est réputée acceptée",
      "rembourse par virement, dans les 30 jours suivant l'acceptation",
      "à défaut : 15) participants",
      "TVA correspondante",
      "même s'il est remboursé ou si le prix cesse d'être dû",
      "Elle ne s'applique pas à une journée remboursée au titre de l'article 47.10",
      "autour du siège d'Axion-IA",
      "par exception à l'article 9.2",
      "La garantie ne couvre que la journée tenue",
      "le prix de mise en place, par Axion-IA ou par un tiers, n'est pas retiré",
      `majoré de ${MAJORATION_PLANCHER_COUT_HORAIRE_PCT} %`,
      "la déduction est reprise",
      "arrondi au centime",
      "restituer le remboursement reçu",
      "les sommes que le Client a lui-même payées au titre de ce prix",
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
        "Si le Client n'indique pas de coût horaire",
        "au plus tard pendant la journée",
      ]) {
        it(`contient « ${phrase} »`, () => {
          expect(a4710()).toContain(phrase);
        });
      }
    });

    it("n'écrit plus « à la fin de la journée » dans 47.10, hors l'alinéa (d)", () => {
      const a47 = corps(47);
      const a4710 = a47.slice(a47.indexOf("47.10 Garantie"));
      const hors = a4710.replace(/avant la fin de la journée/g, "");
      expect(hors).not.toContain("à la fin de la journée");
      expect(hors).not.toContain("pendant la journée, ce que");
    });

    it("n'écrit pas « sans que le Client ait à le demander » dans l'article 47", () => {
      expect(corps(47)).not.toContain("sans que le Client ait à le demander");
    });

    it("n'annonce plus 12 participants par défaut", () => {
      expect(corps(47)).not.toContain("à défaut : 12) participants");
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
