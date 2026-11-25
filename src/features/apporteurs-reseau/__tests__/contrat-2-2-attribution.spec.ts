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

  it("3.2 : plus de confirmation écrite ; validation par rendez-vous tenu ou commande signée", () => {
    // 2.8 : plus de confirmation écrite ni par le silence ; validation par le premier rendez-vous
    // qui a eu lieu (pris pendant la réservation) ou par la commande signée.
    expect(texte).not.toContain("dès que la Société la confirme par écrit à l'Apporteur");
    expect(texte).toContain("au **premier rendez-vous qui a eu lieu**");
    expect(texte).toContain("**vaut validation**");
    expect(texte).toContain("**Le silence de l'entreprise ne vaut jamais validation**");
  });

  it("3.4 : six mois à compter du rendez-vous (ou de la commande), sans fin anticipée à 90 jours", () => {
    // 2.8 : 60 jours de réservation provisoire, puis 6 mois à compter du rendez-vous ou de la commande.
    expect(texte).toContain("**6 mois à compter du jour où le rendez-vous a eu lieu**");
    expect(texte).toContain("pour une durée de **60 jours**");
    expect(texte).toContain("constaté par l'horodatage du serveur de la Société");
    expect(texte).not.toMatch(/90 jours/);
    expect(texte).not.toContain("expire par anticipation");
    // Gardés : prolongation unique, absence de reconduction, extinction (3.7).
    expect(texte).toContain("L'attribution définitive est prolongée de trois mois, une seule fois");
    expect(texte).toContain("3.4 bis — Absence de reconduction");
    expect(texte).toContain("l'attribution correspondante s'éteint");
    // Le terme tient compte de la prolongation, et l'exemple part de la déclaration.
    expect(texte).toContain(
      "À son terme, prolongé le cas échéant dans les conditions de l'alinéa suivant",
    );
    expect(texte).toContain(
      "une entreprise est déclarée le 10 janvier ; elle est réservée jusqu'au 10 mars inclus",
    );
  });

  it("3.5 : la prise en charge par la Société suit les mêmes bornes que l'Apporteur (60 jours puis 6 mois)", () => {
    expect(texte).toContain("Elle vaut pour **60 jours**, décomptés comme à l'article 3.2");
    expect(texte).toContain("elle ne se poursuit, pour **6 mois**, que si un rendez-vous");
    expect(texte).not.toContain("3.4 alinéa 2");
  });

  it("code : la protection court de la DÉCLARATION (six mois après recueAt)", () => {
    const declaree = new Date("2026-10-04T00:00:00Z");
    expect(finDeProtection(declaree)).toEqual(new Date("2027-04-04T00:00:00Z"));
  });
});
