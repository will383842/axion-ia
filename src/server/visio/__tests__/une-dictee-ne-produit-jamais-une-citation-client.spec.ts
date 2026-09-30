/**
 * Une dictée ne produit jamais une citation du client (PR 7, B5).
 *
 * Une dictée n'a qu'une piste : Williams, seul, après un appel téléphonique.
 * En `nature = "dictee"`, la vérification V1 remplace G3 par « la preuve est
 * sur la piste de Williams » :
 *   · chaque fait gardé est `rapporte_par_williams`, locuteur `axion` — même un
 *     budget ou un besoin (Williams RAPPORTE ce que le client a dit ; Will
 *     valide) ;
 *   · un fait qui se déclare dit « par le client » est rejeté : il n'y a pas
 *     de client dans une dictée.
 *
 * Mutation qui rougit : laisser `certitude` à `dit_explicitement` en dictée,
 * ou accepter `locuteur_declare: "client"`.
 * Contre-témoin : en visio, le même budget cité sur la piste de Williams est
 * rejeté (G3 inchangé).
 */

import { describe, expect, it } from "vitest";

import { entrelacer } from "../dialogue";
import { fait, extraction } from "../../../../tests/fixtures/visio/scenario-menuiserie";
import { catalogueDeTest } from "../../../../tests/outils/faux-circuit-visio";
import { verifierFaits } from "../verification/verifier-faits";
import type { SegmentStocke } from "../dialogue";

const DICTEE: SegmentStocke[] = [
  {
    ordre: 10_000_000,
    piste: "axion",
    debutMs: 2_000,
    finMs: 9_000,
    locuteurBrut: null,
    texte: "Appel avec la cliente : ils ont un budget de trois mille euros pour la formation.",
    horsAccord: false,
    apresRefus: false,
  },
  {
    ordre: 10_000_001,
    piste: "axion",
    debutMs: 10_000,
    finMs: 16_000,
    locuteurBrut: null,
    texte: "Je lui envoie le programme vendredi, et on se rappelle la semaine prochaine.",
    horsAccord: false,
    apresRefus: false,
  },
];

const budget = fait({
  ref: "F01",
  type: "budget",
  enonce: "Budget annoncé de 3 000 euros",
  locuteur_declare: "axion",
  preuves: [
    {
      segment_ids: ["S0001"],
      citation: "ils ont un budget de trois mille euros pour la formation",
    },
  ],
  valeur: {
    montant_min_cents: 300000,
    montant_max_cents: 300000,
    base_montant: "non_precise",
    periode_montant: "total",
    date_cible: null,
    precision_date: null,
    expression_temporelle: null,
    quantite: null,
    unite: null,
    ref_catalogue: null,
    texte_court: null,
  },
});

function v(nature: "visio" | "dictee", faits = [budget]) {
  return verifierFaits({
    extraction: extraction(faits),
    segments: entrelacer(DICTEE).segments,
    catalogue: catalogueDeTest().refs,
    connus: new Set(),
    dateEchange: new Date("2026-10-06T10:00:00Z"),
    nature,
  });
}

describe("une dictée ne produit jamais une citation du client", () => {
  it("en dictée, le fait est rapporté par Williams, locuteur axion", () => {
    const f = v("dictee").faits.find((x) => x.ref === "F01");
    expect(f).toMatchObject({
      statut: "propose",
      certitude: "rapporte_par_williams",
      locuteur: "axion",
    });
  });

  it("un fait qui se dit « du client » est rejeté en dictée", () => {
    const f = v("dictee", [{ ...budget, locuteur_declare: "client" }]).faits[0];
    expect(f).toMatchObject({ statut: "rejete", motif: "locuteur_non_admis" });
  });

  it("contre-témoin : en visio, le budget sur la piste de Williams est rejeté (G3)", () => {
    const f = v("visio").faits[0];
    expect(f).toMatchObject({ statut: "rejete", motif: "locuteur_non_admis" });
  });
});
