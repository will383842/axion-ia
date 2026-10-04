// @vitest-environment node
/**
 * Le dossier client accueille les DEUX rendez-vous clients — « Diagnostic IA »
 * et « Échange projet » (ex-« Discutons de votre projet IA ») — chantier
 * « Types de rendez-vous », lot L2, 2026-10-04.
 *
 * Ce qui doit tenir :
 *   1. le type classé (`typeRendezVous`) décide quand il est présent : renommer
 *      un type chez Calendly ne le fait plus sortir du dossier ;
 *   2. sans type (ou `autre`), repli sur le nom, avec les trois noms ;
 *   3. apporteur, salon, entretien : toujours dehors.
 *
 * Mutation qui fait rougir : retirer « echange projet » de la liste → le type
 * renommé sort du dossier ; ignorer `typeRendezVous` → un nom inconnu porté par
 * un diagnostic sort du dossier.
 */
import { describe, expect, it } from "vitest";

import { estRendezVousDuDossier, estTypeDuDossier } from "../liste-blanche-types";

describe("par le TYPE quand il est là", () => {
  it.each(["diagnostic", "echange_projet"] as const)(
    "%s entre au dossier, quel que soit le nom",
    (t) => {
      expect(
        estRendezVousDuDossier({ eventTypeName: "Nom changé chez Calendly", typeRendezVous: t }),
      ).toBe(true);
    },
  );

  it.each(["apporteur", "salon"] as const)("%s reste dehors, même sous un nom client", (t) => {
    expect(
      estRendezVousDuDossier({ eventTypeName: "Discutons de votre projet IA", typeRendezVous: t }),
    ).toBe(false);
  });

  it("un entretien de candidat reste dehors, même typé diagnostic", () => {
    expect(
      estRendezVousDuDossier({
        eventTypeName: "Diagnostic IA",
        typeRendezVous: "diagnostic",
        linkedJobApplicationId: "x",
      }),
    ).toBe(false);
  });

  it("un nom d'échange apporteur ne passe jamais, même mal typé", () => {
    expect(
      estRendezVousDuDossier({
        eventTypeName: "Échange apporteur d'affaires",
        typeRendezVous: "echange_projet",
      }),
    ).toBe(false);
  });

  it("`autre` ou absent : repli sur le nom", () => {
    expect(
      estRendezVousDuDossier({ eventTypeName: "Diagnostic IA", typeRendezVous: "autre" }),
    ).toBe(true);
    expect(estRendezVousDuDossier({ eventTypeName: "Type inventé", typeRendezVous: null })).toBe(
      false,
    );
  });
});

describe("par le NOM sinon — les trois noms clients", () => {
  it.each([
    "Discutons de votre projet IA",
    "Échange projet",
    "Diagnostic IA",
    "diagnostic  ia (30 min)",
  ])("« %s » entre au dossier", (nom) => {
    expect(estTypeDuDossier(nom)).toBe(true);
    expect(estRendezVousDuDossier({ eventTypeName: nom })).toBe(true);
  });

  it.each([
    "Échange apporteur d'affaires (15 min)",
    "Rencontre salon GOFAB",
    "Pour info : échange projet",
    "Entretien de recrutement",
  ])("« %s » reste dehors", (nom) => {
    expect(estRendezVousDuDossier({ eventTypeName: nom })).toBe(false);
  });
});
