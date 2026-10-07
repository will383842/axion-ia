import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import { finDeProtection } from "../regles";

// Contrat 2.2 (décision de Will, 07/10/2026) : déclaration par le SEUL formulaire, attribution
// définitive aussi sur confirmation écrite de la Société, six mois À COMPTER DE LA DÉCLARATION,
// plus de fin anticipée à 90 jours, prise en charge de la Société alignée.
const texte = CONTRAT_V2_MARKDOWN.replace(/\s+/g, " ");

describe("contrat 2.2 : déclaration et durée de l'attribution", () => {
  it("version 2.2", () => {
    expect(Number(CONTRAT_VERSION)).toBeGreaterThanOrEqual(2.2);
  });

  it("3.2 : seul le formulaire du lien personnel vaut déclaration ; l'e-mail est sans effet", () => {
    expect(texte).toContain("au moyen du seul formulaire");
    expect(texte).toContain(
      "Une déclaration adressée par tout autre moyen, notamment par courrier électronique, est sans effet",
    );
    expect(texte).toContain("la Société invite alors l'Apporteur à utiliser le formulaire");
    expect(texte).not.toContain("adressée par l'Apporteur par courrier électronique");
    expect(texte).not.toContain("horodatée à sa réception par le serveur de messagerie");
    // La période de démarrage (2.8) ne rouvre pas la voie e-mail.
    expect(texte).toContain("les déclarations de l'article 3.2 sont faites par le seul formulaire");
  });

  it("3.2 : l'attribution devient aussi définitive sur confirmation écrite de la Société", () => {
    expect(texte).toContain("dès que la Société la confirme par écrit à l'Apporteur");
  });

  it("3.4 : six mois à compter de la déclaration, sans fin anticipée à 90 jours", () => {
    expect(texte).toContain("6 mois à compter de la déclaration");
    expect(texte).toContain("horodatage, par le serveur de la Société, de son enregistrement");
    expect(texte).not.toMatch(/90 jours/);
    expect(texte).not.toContain("expire par anticipation");
    // Gardés : prolongation unique, absence de reconduction, extinction (3.7).
    expect(texte).toContain("L'attribution est prolongée de trois mois, une seule fois");
    expect(texte).toContain("3.4 bis — Absence de reconduction");
    expect(texte).toContain("l'attribution correspondante s'éteint");
    // Le terme tient compte de la prolongation, et l'exemple part de la déclaration.
    expect(texte).toContain(
      "À son terme, prolongé le cas échéant dans les conditions de l'alinéa suivant",
    );
    expect(texte).toContain(
      "une entreprise déclarée le 30 décembre, dont l'attribution expire donc le 30 juin",
    );
  });

  it("3.5 : la prise en charge par la Société court six mois depuis la prise en charge", () => {
    expect(texte).toContain("la durée de **6 mois** court de la prise en charge");
    expect(texte).not.toContain("3.4 alinéa 2");
  });

  it("code : la protection court de la DÉCLARATION (six mois après recueAt)", () => {
    const declaree = new Date("2026-10-04T00:00:00Z");
    expect(finDeProtection(declaree)).toEqual(new Date("2027-04-04T00:00:00Z"));
  });
});
