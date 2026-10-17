// @vitest-environment node

/**
 * Qualiopi ind. 21 — le numéro de déclaration d'activité est OBLIGATOIRE dans le dossier
 * en ligne : « en cours » (valeur des dossiers d'avant le 17/10) ne passe plus l'étape 2.
 */

import { describe, expect, it } from "vitest";

import { NDA_EN_COURS, manquesEtape2 } from "../../dossier-regles";

const BASE = {
  siret: "12345678900011",
  regimeTva: "franchise_293b" as const,
  ibanSaisi: true,
  entrepriseBloquante: false,
};

describe("étape 2 du dossier — numéro de déclaration", () => {
  it("un numéro saisi passe", () => {
    expect(manquesEtape2({ ...BASE, nda: "84691234569" })).toEqual([]);
  });
  it("« en cours » ou absent : manque", () => {
    expect(manquesEtape2({ ...BASE, nda: NDA_EN_COURS })).toEqual([
      "votre numéro de déclaration d'activité",
    ]);
    expect(manquesEtape2({ ...BASE, nda: null })).toEqual([
      "votre numéro de déclaration d'activité",
    ]);
  });
});
