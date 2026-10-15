/**
 * Vérification 2, équipe A (argent) — la vue « Virements à faire » met les DEUX flux côte à
 * côte sans jamais les mélanger (FAC-9) : une ligne d'apporteur reste une ligne d'apporteur,
 * à son montant, même quand le même bénéficiaire est aussi formateur ; aucune ligne n'est
 * doublée ni fusionnée ; l'ordre est celui de la date cible, les pièces sans échéance après.
 *
 * Sans écran ni base : `ordonnerVirements`, la mise en ordre pure que la vue applique à ce
 * qu'elle a lu.
 */

import { describe, expect, it } from "vitest";

import {
  ordonnerVirements,
  totauxVirements,
  type VirementLu,
} from "@/server/paiements-sortants/virements";

const MEME_PERSONNE = "Camille Banc";

const lus: VirementLu[] = [
  {
    flux: "apporteur",
    pieceId: "AXI-APP-2041-001",
    beneficiaireId: "apporteur-1",
    beneficiaire: MEME_PERSONNE,
    reference: "AXI-APP-2041-001",
    montantCents: 12_345,
    emissionAt: new Date("2041-03-01T10:00:00Z"),
    echeance: null,
  },
  {
    flux: "formateur",
    pieceId: "releve-1",
    beneficiaireId: "formateur-1",
    beneficiaire: MEME_PERSONNE,
    reference: "AXI-AUTOF-2041-007",
    montantCents: 70_000,
    emissionAt: new Date("2041-03-02T10:00:00Z"),
    echeance: "2041-04-01",
    origineReleve: "passage_mission",
  },
  {
    flux: "formateur",
    pieceId: "releve-2",
    beneficiaireId: "formateur-1",
    beneficiaire: MEME_PERSONNE,
    reference: "AXI-AUTOF-2041-008",
    montantCents: 35_000,
    emissionAt: new Date("2041-03-03T10:00:00Z"),
    echeance: "2041-03-20",
    origineReleve: "passage_mission",
  },
];

describe("V2-A — « Virements à faire » : deux flux, aucune fusion", () => {
  it("une ligne par pièce, chacune dans son flux et à son montant, même bénéficiaire", () => {
    const vs = ordonnerVirements(lus, "2041-03-15");
    expect(vs).toHaveLength(3);
    expect(vs.map((v) => [v.flux, v.pieceId, v.montantCents])).toEqual([
      ["formateur", "releve-2", 35_000],
      ["formateur", "releve-1", 70_000],
      ["apporteur", "AXI-APP-2041-001", 12_345],
    ]);
    expect(totauxVirements(vs).parFlux).toEqual({ apporteur: 12_345, formateur: 105_000 });
  });

  it("couleurs : orange à J-5 de la date cible, rouge après l'échéance, apporteur sans échéance", () => {
    const vs = ordonnerVirements(lus, "2041-03-22");
    const couleur = Object.fromEntries(vs.map((v) => [v.pieceId, v.couleur]));
    expect(couleur).toEqual({
      "releve-2": "rouge",
      "releve-1": "a_venir",
      "AXI-APP-2041-001": "sans_echeance",
    });
  });
});
