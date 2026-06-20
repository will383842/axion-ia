import { describe, expect, it } from "vitest";
import {
  LEGAL_MENTIONS,
  formatHeuresCentiemes,
  formatMentionMarqueQualiopi,
  DOCUMENT_RETENTION_YEARS,
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
