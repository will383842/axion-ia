/**
 * Sous-lot 8C — le dossier de financement n'est plus optionnel.
 *
 * Le défaut : `creerDossierDepuisSession` n'avait qu'un appelant, un bouton.
 * Vérifié en production, **zéro dossier existait** — donc aucune alerte de
 * suivi financeur et aucune ligne au cockpit, pour aucune affaire. Le suivi
 * OPCO était éteint sans que rien ne le signale.
 */

import { describe, expect, it } from "vitest";
import { changementOuvreUnDossier, sessionExigeUnDossier } from "./dossier-auto";

describe("quels financements appellent un dossier de suivi", () => {
  it.each(["opco", "cpf", "france_travail", "mixte"])("%s → oui", (f) => {
    expect(sessionExigeUnDossier(f)).toBe(true);
  });

  it("🔴 `direct` → NON : pas de financeur, donc rien à suivre", () => {
    // Ouvrir un dossier pour une affaire payée sur fonds propres ajouterait une
    // ligne vide au cockpit, et une ligne vide apprend à ne plus le regarder.
    expect(sessionExigeUnDossier("direct")).toBe(false);
  });

  it("`mixte` EST visé — il porte une part mutualisée, donc un financeur à relancer", () => {
    expect(sessionExigeUnDossier("mixte")).toBe(true);
  });

  it("n'ouvre rien sur un financement absent ou inconnu", () => {
    expect(sessionExigeUnDossier(null)).toBe(false);
    expect(sessionExigeUnDossier(undefined)).toBe(false);
    expect(sessionExigeUnDossier("")).toBe(false);
    expect(sessionExigeUnDossier("subvention_region")).toBe(false);
  });

  it("tolère casse et espaces", () => {
    expect(sessionExigeUnDossier("  OPCO ")).toBe(true);
  });
});

describe("🔴 quand un CHANGEMENT ouvre un dossier", () => {
  it("direct → opco : ouvre", () => {
    expect(changementOuvreUnDossier("direct", "opco")).toBe(true);
  });

  it("aucun financement → cpf : ouvre", () => {
    expect(changementOuvreUnDossier(null, "cpf")).toBe(true);
  });

  it("🔴 opco → opco : n'ouvre RIEN — sinon corriger une coquille rouvrirait un dossier clos", () => {
    // C'est le vrai piège : le formulaire de financement se réenregistre pour
    // un numéro de dossier, une subrogation, une date. Chacun de ces
    // enregistrements repasse ici.
    expect(changementOuvreUnDossier("opco", "opco")).toBe(false);
  });

  it("opco → cpf : n'ouvre pas un SECOND dossier", () => {
    // On restait dans le périmètre suivi : le dossier existant se met à jour
    // ou se clôt à la main, il ne se dédouble pas.
    expect(changementOuvreUnDossier("opco", "cpf")).toBe(false);
  });

  it("🔴 opco → direct : n'ouvre pas, et ne SUPPRIME rien non plus", () => {
    // Cette fonction ne décide que de l'ouverture. La suppression n'existe pas :
    // un dossier porte des dates, des montants et un historique de transitions.
    // Le refermer est une décision humaine (`clos`), pas l'effet de bord d'un
    // changement de menu déroulant.
    expect(changementOuvreUnDossier("opco", "direct")).toBe(false);
  });

  it("direct → direct : rien", () => {
    expect(changementOuvreUnDossier("direct", "direct")).toBe(false);
  });

  it("un champ modifié SANS toucher au financement n'ouvre rien", () => {
    // `financementApres` est `undefined` quand le formulaire n'envoie pas le
    // champ — cas le plus fréquent (on met à jour le n° de dossier seul).
    expect(changementOuvreUnDossier("opco", undefined)).toBe(false);
    expect(changementOuvreUnDossier("direct", undefined)).toBe(false);
  });
});
