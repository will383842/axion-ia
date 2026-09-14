/**
 * Constat C2-03 (audit initial 2026-09-14) — la seule pièce « positionnement »
 * que l'outil savait produire était le GABARIT VIERGE : cases à cocher et
 * lignes vides, sans nom ni réponse. Le dossier d'audit la présentait aux
 * indicateurs 4 et 8. Cette pièce-ci est nominative, porte les réponses réelles
 * et l'instant de la réponse.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { PositionnementRempliPdf, type PositionnementRempliData } from "./positionnement-rempli";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "../organisme";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
  referentHandicapEmail: "handicap@axion-ia.fr",
  dpoEmail: "dpo@axion-ia.fr",
};

const DATA: PositionnementRempliData = {
  reference: "POS-1a2b3c4d",
  nomStagiaire: "Camille Martin",
  intituleFormation: "IA générative pour l'immobilier",
  debutSession: "5 septembre 2026 à 09:00",
  reponduLe: "4 septembre 2026 à 23:12",
  chronologie: "avant le début de la session",
  reponduAvantDebut: true,
  tireeLe: "14 septembre 2026 à 14:30",
  precisionSurFicheStagiaire: false,
  positionnement: {
    fonction: "Assistante de direction",
    secteur: "Immobilier",
    outilsUtilises: null,
    frequenceUsage: "Jamais",
    attentes: "Gagner du temps sur les annonces",
    tacheVisee: "Les comptes rendus de visite",
    niveaux: [{ objectif: "Rédiger des annonces", niveau: 2, libelle: "Quelques notions" }],
    besoinAdaptation: true,
    precisionDansLaReponse: false,
    saisieAdmin: false,
    saisieOrganisme: {
      objectifsAtteints: null,
      pointsForts: null,
      axesAmelioration: null,
      commentaire: null,
    },
  },
};

function texte(data: PositionnementRempliData): string {
  return collectPdfTextNormalized(
    React.createElement(PositionnementRempliPdf, { data, identite: IDENTITE }),
  );
}

describe("PositionnementRempliPdf — une pièce REMPLIE, jamais le gabarit", () => {
  const text = texte(DATA);

  it("est nominative et datée de la réponse", () => {
    expect(text).toContain("Camille Martin");
    expect(text).toContain("4 septembre 2026 à 23:12");
    expect(text).toContain("5 septembre 2026 à 09:00");
  });

  it("porte les réponses réelles", () => {
    expect(text).toContain("Gagner du temps sur les annonces");
    expect(text).toContain("Les comptes rendus de visite");
    expect(text).toContain("Rédiger des annonces");
    expect(text).toContain("Quelques notions");
    // Une question sans réponse le DIT.
    expect(text).toContain("Non renseigné");
  });

  it("dit si la réponse précède le début, et porte sa date de tirage", () => {
    expect(text).toContain("avant le début de la session");
    expect(text).toContain("Pièce tirée le 14 septembre 2026 à 14:30");
  });

  it("réponse du portail AVANT le début : indicateurs 4, 8 et 10", () => {
    expect(text).toContain("Indicateurs Qualiopi 4, 8 et 10");
  });

  // ── Relectures de la PR 1090 ─────────────────────────────────────────────

  it("🔴 besoin coché sans précision, fiche portant un détail venu d'ailleurs : aucune précision n'est attribuée au questionnaire", () => {
    const t = texte({ ...DATA, precisionSurFicheStagiaire: true });
    expect(t).not.toContain("Précision fournie");
    expect(t).not.toContain("Aucune précision");
    // La fiche est signalée hors des réponses, sans rien affirmer au nom du questionnaire.
    expect(t).toContain("peut figurer sur la fiche du stagiaire");
    expect(t).toContain("Oui");
  });

  it("sans détail sur la fiche, la mention de la fiche n'apparaît pas", () => {
    expect(text).not.toContain("peut figurer sur la fiche du stagiaire");
    expect(text).not.toContain("Précision fournie");
  });

  it("détail ancien présent DANS la réponse : la présence se dit, jamais le contenu", () => {
    const t = texte({
      ...DATA,
      positionnement: { ...DATA.positionnement, precisionDansLaReponse: true },
    });
    expect(t).toContain("Précision fournie dans la réponse — non reproduite ici (donnée de santé)");
  });

  it("réponse du portail APRÈS le début : ne se réclame pas de l'indicateur 10 (règle de la PR 1083)", () => {
    const t = texte({
      ...DATA,
      reponduLe: "5 septembre 2026 à 10:00",
      chronologie: "après le début de la session",
      reponduAvantDebut: false,
    });
    expect(t).toContain("après le début de la session");
    expect(t).not.toContain("4, 8 et 10");
    expect(t).toContain("Indicateurs Qualiopi 4 et 8");
  });

  it("une saisie par l'organisme n'affiche pas de réponse au besoin d'adaptation", () => {
    const saisie = texte({
      ...DATA,
      positionnement: {
        ...DATA.positionnement,
        fonction: null,
        secteur: null,
        frequenceUsage: null,
        attentes: null,
        tacheVisee: null,
        niveaux: [],
        besoinAdaptation: null,
        precisionDansLaReponse: false,
        saisieAdmin: true,
        saisieOrganisme: {
          objectifsAtteints: "Objectifs recueillis par téléphone",
          pointsForts: "Déjà à l'aise avec ChatGPT",
          axesAmelioration: "Rédaction des annonces",
          commentaire: "Appel téléphonique",
        },
      },
    });
    expect(saisie).toContain("Non posée (saisie par l'organisme)");
    expect(saisie).not.toMatch(/Besoin d'adaptation déclaré (Oui|Non)(?! posée)/);
    // Titrée comme une saisie de l'organisme, jamais comme des réponses du stagiaire.
    expect(saisie).toContain("Positionnement — saisie par l'organisme");
    expect(saisie).not.toContain("Positionnement à l'entrée — réponses");
    // Ce que l'organisme a réellement saisi est restitué.
    expect(saisie).toContain("Objectifs recueillis par téléphone");
    expect(saisie).toContain("Déjà à l'aise avec ChatGPT");
    expect(saisie).toContain("Rédaction des annonces");
    expect(saisie).toContain("Appel téléphonique");
    // Règle de l'indicateur 10 (PR 1083) : une saisie de l'organisme ne le couvre pas.
    expect(saisie).not.toContain("4, 8 et 10");
    expect(saisie).toContain("Indicateurs Qualiopi 4 et 8");
  });

  it("ne reprend aucune case du formulaire vierge", () => {
    expect(text).not.toContain("Débutant(e)");
    expect(text).not.toContain("À remplir avant la formation");
  });
});
