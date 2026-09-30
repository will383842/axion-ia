/**
 * G7 — UNE RÉFÉRENCE CATALOGUE INCONNUE EST REJETÉE : seulement les
 * références de la liste envoyée, jamais une référence « proche ».
 */

import { describe, expect, it } from "vitest";

import { controlerEbauche } from "../../consolider";
import { fait } from "../../../../../tests/fixtures/visio/scenario-menuiserie";
import { catalogueDeTest } from "../../../../../tests/outils/faux-circuit-visio";
import { FAITS, leFait, verifier } from "./outils";

const OFFRE = (ref: string) =>
  fait({
    ref: "F09",
    type: "offre_envisagee",
    cle: ref,
    enonce: "La formation d'une journée est envisagée.",
    valeur: { ...FAITS[0]!.valeur, quantite: null, unite: null, ref_catalogue: ref },
    preuves: [{ segment_ids: ["S0010"], citation: "le programme de la formation vendredi" }],
    locuteur_declare: "axion",
  });

describe("une référence catalogue inconnue est rejetée", () => {
  it("fait : OFF:AXI-OFF-999 → reference_catalogue_inconnue", () => {
    expect(leFait(verifier([...FAITS, OFFRE("OFF:AXI-OFF-999")]), "F09")).toMatchObject({
      statut: "rejete",
      motif: "reference_catalogue_inconnue",
    });
  });

  it("ébauche : la ligne inconnue est retirée, la connue reste", () => {
    const r = controlerEbauche(
      {
        lignes: [
          {
            ref_catalogue: "OFF:AXI-OFF-001",
            quantite: 1,
            unite: "groupes",
            faits_refs: ["F01"],
            justification: "x",
          },
          {
            ref_catalogue: "OFF:AXI-OFF-002",
            quantite: 1,
            unite: "groupes",
            faits_refs: ["F01"],
            justification: "proche",
          },
        ],
        sans_reference: [],
        activite: null,
        financement_suggere: null,
        nb_participants: null,
        duree_heures: null,
        modalite_opco: null,
        ref_client: null,
        hypotheses: [],
        alternatives: [],
        manquant_pour_chiffrer: [],
        personnalisation_formation: null,
      },
      catalogueDeTest().refs,
    );
    expect(r.ok && r.ebauche.lignes.map((l) => l.ref_catalogue)).toEqual(["OFF:AXI-OFF-001"]);
  });

  it("contre-témoin : une référence de la liste passe", () => {
    expect(leFait(verifier([...FAITS, OFFRE("OFF:AXI-OFF-001")]), "F09").statut).toBe("propose");
  });
});
