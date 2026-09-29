/**
 * « Préparer », bloc 9 — une échéance plus proche que `DELAI_OPCO_JOURS` (lu
 * dans `seuils.ts`, décision B11) avec un financement OPCO annoncé est signalée.
 *
 * Mutation qui fait rougir : comparer à une constante écrite en dur, ou oublier
 * la condition « financement OPCO ».
 * Contre-témoins : échéance lointaine → rien ; financement sans OPCO → rien.
 * Angle mort : « OPCO » est reconnu dans le texte du fait financement ; un
 * financement dit « par l'opérateur de compétences » sans le sigle ne l'est pas.
 */

import { describe, expect, it } from "vitest";
import { preparer, type EntreePreparer } from "../preparer";
import { DELAI_OPCO_JOURS } from "../seuils";
import { MAINTENANT, faitProjet, ilYA } from "./_faits";

const P = "p-1";

function entree(joursAvantEcheance: number, financement: string): EntreePreparer {
  return {
    client: { id: "cl", numero: "AXI-CLI-901", raisonSociale: "Client fictif" },
    projetId: P,
    projets: [
      {
        id: P,
        numero: "AXI-PRJ-2026-010",
        titre: "Formation",
        statut: "ouvert",
        derniereReouvertureLe: null,
      },
    ],
    faits: [
      faitProjet(P, { type: "echeance", dateCible: ilYA(-joursAvantEcheance) }),
      faitProjet(P, { type: "financement", texteCourt: financement }),
    ],
    dernierSuivi: null,
    questionsSansReponse: [],
    personnes: [],
    comptesRendusNonValides: [],
    enregistrementsRefusesLe: [],
    maintenant: MAINTENANT,
  };
}

describe("une échéance trop proche avec OPCO est signalée", () => {
  it("le seuil vient de seuils.ts (45 jours, décision B11)", () => {
    expect(DELAI_OPCO_JOURS).toBe(45);
  });

  it("échéance dans 20 jours + OPCO → signalée", () => {
    const s = preparer(entree(20, "OPCO Atlas")).echeanceProcheAvecOpco;
    expect(s).not.toBeNull();
    expect(s?.seuilJours).toBe(DELAI_OPCO_JOURS);
    expect(s?.joursRestants).toBeLessThan(DELAI_OPCO_JOURS);
  });

  it("à un jour sous le seuil → signalée ; au-delà → rien", () => {
    expect(preparer(entree(DELAI_OPCO_JOURS - 1, "opco")).echeanceProcheAvecOpco).not.toBeNull();
    expect(preparer(entree(DELAI_OPCO_JOURS + 5, "opco")).echeanceProcheAvecOpco).toBeNull();
  });

  it("contre-témoin : financement direct → rien", () => {
    expect(preparer(entree(10, "sur fonds propres")).echeanceProcheAvecOpco).toBeNull();
  });
});
