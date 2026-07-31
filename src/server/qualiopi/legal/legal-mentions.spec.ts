import { describe, expect, it } from "vitest";
import { getLegal } from "@/content/legal";
import {
  LEGAL_MENTIONS,
  formatHeuresCentiemes,
  formatMentionMarqueQualiopi,
  DOCUMENT_RETENTION_YEARS,
  TAUX_PENALITES_RETARD_FR,
} from "./legal-mentions";

describe("LEGAL_MENTIONS — bases juridiques exactes", () => {
  it("convention cite L.6353-1 et L.6353-2", () => {
    expect(LEGAL_MENTIONS.convention).toContain("L.6353-1");
    expect(LEGAL_MENTIONS.convention).toContain("L.6353-2");
  });
  it("attestation cite L.6353-1 et D.6353-1", () => {
    expect(LEGAL_MENTIONS.attestation).toContain("L.6353-1");
    expect(LEGAL_MENTIONS.attestation).toContain("D.6353-1");
  });
  it("certificat de réalisation cite R.6313-3 + arrêté du 21 décembre 2018", () => {
    expect(LEGAL_MENTIONS.certificatRealisation).toContain("R.6313-3");
    expect(LEGAL_MENTIONS.certificatRealisation).toContain("21 décembre 2018");
  });
  it("facture cite l'exonération TVA 261-4-4° CGI + formation professionnelle continue", () => {
    expect(LEGAL_MENTIONS.factureExonerationTva).toContain("261-4-4°");
    expect(LEGAL_MENTIONS.factureExonerationTva).toContain("Code Général des Impôts");
    expect(LEGAL_MENTIONS.factureExonerationTva.toLowerCase()).toContain(
      "formation professionnelle continue",
    );
  });
  it("règlement intérieur cite L.6352-3", () => {
    expect(LEGAL_MENTIONS.reglementInterieur).toContain("L.6352-3");
  });
  it("conservation légale = 5 ans", () => {
    expect(DOCUMENT_RETENTION_YEARS).toBe(5);
  });
});

/**
 * F52 — la facture et les CGV portaient DEUX taux de pénalités différents : la
 * facture annonçait « trois fois le taux d'intérêt légal » (le PLANCHER d'une
 * stipulation dérogatoire) alors que les CGV stipulent le taux supplétif
 * BCE + 10 points. Une facture est un acte UNILATÉRAL : le taux qu'elle imprime
 * sans être stipulé au contrat est INOPPOSABLE.
 *
 * Ce bloc est la SEULE chose qui empêche la divergence de se reformer : les deux
 * textes vivent dans des modules qui ne se connaissent pas (contenu public vs
 * registre de mentions PDF). La clause CGV est résolue DANS chaque test, jamais
 * au niveau module : un renommage de section doit faire rougir ces tests-là, pas
 * faire tomber la collecte du fichier entier.
 */
describe("Pénalités de retard — concordance CGV ↔ facture (F52)", () => {
  function clauseCgv(langue: "fr" | "en", prefixeTitre: string): string {
    const section = getLegal("conditions-generales")[langue].sections.find((s) =>
      s.title.startsWith(prefixeTitre),
    );
    if (!section) {
      throw new Error(
        `CGV ${langue} : section « ${prefixeTitre}… » introuvable (titre renommé ?). Le garde-fou F52 ne peut plus vérifier le taux de pénalités.`,
      );
    }
    return section.body;
  }

  it("le taux imprimé sur la facture est celui stipulé aux CGV (FR)", () => {
    expect(LEGAL_MENTIONS.facturePenalitesRetard).toContain(TAUX_PENALITES_RETARD_FR);
    expect(clauseCgv("fr", "Retard de paiement")).toContain(TAUX_PENALITES_RETARD_FR);
  });

  it("le miroir EN des CGV porte le même taux", () => {
    // Le miroir EN de ce fichier a déjà dérivé du FR sur d'autres clauses : un
    // garde-fou FR-only ne verrait pas la prochaine divergence.
    const clause = clauseCgv("en", "Late payment");
    expect(clause).toContain("European Central Bank");
    expect(clause).toContain("plus 10 percentage points");
    expect(clause).not.toContain("three times");
  });

  it("le taux partagé dit bien BCE + 10 points", () => {
    // Épingle la VALEUR du fragment : sans cela, le réécrire des deux côtés
    // passerait au vert.
    expect(TAUX_PENALITES_RETARD_FR).toContain("Banque centrale européenne");
    expect(TAUX_PENALITES_RETARD_FR).toContain("majoré de 10 points de pourcentage");
  });

  it("la mention de facture cite sa base légale et pas le taux erroné", () => {
    // Assertion négative ciblée sur la FORMULATION FAUTIVE, pas sur le mot
    // « trois fois » : le rappel du plancher de L.441-10 II (« sans que ce taux
    // puisse être inférieur à trois fois le taux d'intérêt légal ») reste licite
    // et ne doit pas être verrouillé par un test.
    expect(LEGAL_MENTIONS.facturePenalitesRetard).not.toContain("calculées au taux de trois fois");
    expect(LEGAL_MENTIONS.facturePenalitesRetard).toContain("L.441-10");
    expect(LEGAL_MENTIONS.facturePenalitesRetard).toContain(
      "dès le jour suivant la date d'échéance",
    );
  });

  it("aucune espace insécable dans le taux ni dans la mention de facture", () => {
    // U+00A0 / U+202F écrits en ÉCHAPPEMENT, jamais en littéral : une classe de
    // caractères invisibles se fait normaliser en espaces ordinaires au premier
    // copier-coller et devient soit un no-op, soit une classe qui matche TOUTES
    // les espaces. Une insécable ici casserait `facture.spec.tsx`, qui compare
    // le texte du PDF après `.replace(/\s+/g, " ")`.
    expect(TAUX_PENALITES_RETARD_FR).not.toMatch(/[  ]/);
    expect(LEGAL_MENTIONS.facturePenalitesRetard).not.toMatch(/[  ]/);
  });
});

describe("formatMentionMarqueQualiopi — mention obligatoire de la marque", () => {
  it("contient le verbatim officiel + la catégorie certifiée", () => {
    const m = formatMentionMarqueQualiopi("Actions de formation");
    expect(m).toContain(
      "La certification qualité a été délivrée au titre de la ou des catégories d'actions suivantes :",
    );
    expect(m).toContain("Actions de formation");
    expect(m.endsWith(".")).toBe(true);
  });
  it("trim la catégorie et accepte une liste", () => {
    const m = formatMentionMarqueQualiopi("  Actions de formation, Bilans de compétences  ");
    expect(m).toContain("Actions de formation, Bilans de compétences");
    expect(m).not.toContain("  Actions");
  });
});

describe("formatHeuresCentiemes — durées EN CENTIÈMES (jamais 7h00)", () => {
  it.each([
    [7, "7,00"],
    [1.5, "1,50"],
    [7.25, "7,25"],
    [0, "0,00"],
    [14, "14,00"],
    [3.5, "3,50"],
  ])("%s h → %s", (h, expected) => {
    expect(formatHeuresCentiemes(h)).toBe(expected);
  });
  it("n'utilise jamais le format horaire 'h'", () => {
    expect(formatHeuresCentiemes(7)).not.toContain("h");
  });
  it("rejette les durées invalides", () => {
    expect(() => formatHeuresCentiemes(-1)).toThrow();
    expect(() => formatHeuresCentiemes(Number.NaN)).toThrow();
  });
});
