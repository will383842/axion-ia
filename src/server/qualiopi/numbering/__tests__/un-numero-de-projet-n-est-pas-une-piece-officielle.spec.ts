/**
 * ⛔ UN NUMÉRO DE PROJET N'EST PAS UNE PIÈCE OFFICIELLE (chantier visio, PR 2).
 *
 * `AXI-PRJ-AAAA-NNN` classe un dossier de travail (« la formation RH
 * d'octobre »). Ce n'est ni un devis, ni une facture, ni une attestation : il
 * ne doit jamais être reconnu par le validateur des pièces officielles, ni
 * entrer dans les registres que lit un auditeur.
 *
 * Mutation qui fait rougir : ajouter `PRJ` à `DOCUMENT_NUMBER_REGEX`, ou une
 * clé `projet: "AXI-PRJ"` à `NUMBERING_PREFIX`.
 * Contre-témoin : un vrai numéro de devis reste une pièce officielle.
 */

import { describe, expect, it } from "vitest";
import {
  DOCUMENT_NUMBER_REGEX,
  formatNumeroProjet,
  isNumeroProjet,
  isValidDocumentNumber,
  NUMBERING_PREFIX,
  parseSequence,
  prefixeSerieProjet,
  PREFIXE_PROJET,
} from "../formats";

describe("un numéro de projet n'est pas une pièce officielle", () => {
  it("le format est AXI-PRJ-AAAA-NNN", () => {
    expect(formatNumeroProjet(2026, 1)).toBe("AXI-PRJ-2026-001");
    expect(formatNumeroProjet(2026, 1234)).toBe("AXI-PRJ-2026-1234");
    expect(isNumeroProjet("AXI-PRJ-2026-001")).toBe(true);
    expect(isNumeroProjet("AXI-PRJ-001")).toBe(false);
  });

  it("le validateur des pièces officielles le refuse", () => {
    expect(isValidDocumentNumber(formatNumeroProjet(2026, 1))).toBe(false);
    expect(DOCUMENT_NUMBER_REGEX.source).not.toContain("PRJ");
  });

  it("la série n'entre dans aucun registre de numérotation officiel", () => {
    expect(Object.values(NUMBERING_PREFIX)).not.toContain(PREFIXE_PROJET);
    expect(Object.keys(NUMBERING_PREFIX)).not.toContain("projet");
  });

  it("contre-témoin : un numéro de devis reste une pièce officielle", () => {
    expect(isValidDocumentNumber("AXI-DEV-2026-001")).toBe(true);
  });

  it("la borne haute de la série se lit avec parseSequence", () => {
    const prefixe = prefixeSerieProjet(2026);
    expect(parseSequence("AXI-PRJ-2026-007", prefixe)).toBe(7);
    expect(parseSequence("AXI-DEV-2026-007", prefixe)).toBeNull();
  });

  it("refuse une année ou une séquence invalide", () => {
    expect(() => formatNumeroProjet(1999, 1)).toThrow();
    expect(() => formatNumeroProjet(2026, 0)).toThrow();
  });
});
