/**
 * Tests — lieu imprimé sur les documents légaux.
 *
 * Le défaut corrigé ici : cinq gabarits annonçaient l'adresse de l'ORGANISME
 * comme lieu de déroulement, y compris pour une formation donnée chez le client.
 */

import { describe, it, expect } from "vitest";

import { resolveLieuDocument, resolveLieuConvocation } from "./resolve-lieu-document";

const IDENTITE = {
  adresseExercice: "10 rue de l'Exercice, 38000 Grenoble",
  adresseSiege: "1 rue du Siège, 38000 Grenoble",
};

describe("resolveLieuDocument", () => {
  // 🔴 Le test qui porte tout le chantier.
  it("imprime le lieu RÉEL de la session, pas l'adresse de l'organisme", () => {
    const lieu = resolveLieuDocument(
      {
        lieuType: "sur_site",
        lieuAdresse: "5 rue des Docks",
        lieuCodePostal: "42000",
        lieuVille: "Saint-Étienne",
      },
      IDENTITE,
    );
    expect(lieu).toContain("Saint-Étienne");
    expect(lieu).not.toContain("Grenoble");
  });

  it("session sans lieu : repli sur l'adresse d'exercice (comportement historique)", () => {
    expect(resolveLieuDocument({}, IDENTITE)).toBe(IDENTITE.adresseExercice);
  });

  it("sans adresse d'exercice : repli sur le siège", () => {
    expect(resolveLieuDocument({}, { adresseSiege: IDENTITE.adresseSiege })).toBe(
      IDENTITE.adresseSiege,
    );
  });

  it("aucune adresse connue : « — », jamais une chaîne vide", () => {
    expect(resolveLieuDocument({}, {})).toBe("—");
  });

  // Un lieu partiellement rempli reste un lieu : on ne retombe pas sur l'adresse
  // de l'organisme au prétexte qu'il manque le code postal.
  it("un seul champ renseigné suffit à primer sur l'adresse de l'organisme", () => {
    expect(resolveLieuDocument({ lieuVille: "Saint-Étienne" }, IDENTITE)).toContain(
      "Saint-Étienne",
    );
  });

  it("distanciel : n'expose que l'hôte de la visio, jamais le lien complet", () => {
    const lieu = resolveLieuDocument(
      { lieuType: "distanciel", lieuVisioUrl: "https://meet.google.com/abc-defg-hij" },
      IDENTITE,
    );
    expect(lieu).toContain("meet.google.com");
    expect(lieu).not.toContain("abc-defg-hij");
  });
});

describe("resolveLieuConvocation", () => {
  it("renvoie le lieu réel quand il existe", () => {
    expect(resolveLieuConvocation({ lieuVille: "Saint-Étienne" }, IDENTITE)).toContain(
      "Saint-Étienne",
    );
  });

  // « Lieu : — » sur une convocation est pire que pas de ligne du tout : le
  // stagiaire lit que l'information a été cherchée et qu'elle n'existe pas.
  it("renvoie undefined plutôt que « — » quand rien n'est connu", () => {
    expect(resolveLieuConvocation({}, {})).toBeUndefined();
  });

  it("conserve le repli sur l'adresse de l'organisme s'il y en a une", () => {
    expect(resolveLieuConvocation({}, IDENTITE)).toBe(IDENTITE.adresseExercice);
  });
});
