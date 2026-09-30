/**
 * Constat du dossier ZIP du 2026-09-30 — les pièces satisfaction RÉPONDUE
 * (ind. 30) et évaluation finale RÉALISÉE (ind. 11) portent ce qui a été
 * enregistré, nominativement, avec leur date ; jamais un gabarit.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { SatisfactionRempliePdf, type SatisfactionRemplieData } from "./satisfaction-remplie";
import { EvaluationRealiseePdf, type EvaluationRealiseeData } from "./evaluation-realisee";
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

const SATISFACTION: SatisfactionRemplieData = {
  reference: "SAT-5e6f7a8b",
  moment: "chaud",
  nomStagiaire: "Camille Martin",
  intituleFormation: "IA générative pour l'immobilier",
  debutSession: "11 septembre 2026 à 09:00",
  finSession: "12 septembre 2026 à 17:00",
  reponduLe: "12 septembre 2026 à 17:20",
  tireeLe: "30 septembre 2026 à 00:53",
  saisieOrganisme: false,
  noteGlobale: 4,
  commentaire: "Très concret",
  objectifsAtteints: null,
  pointsForts: null,
  axesAmelioration: null,
};

describe("SatisfactionRempliePdf", () => {
  it("est nominative, datée de la réponse, porte la note et le commentaire", () => {
    const t = collectPdfTextNormalized(
      React.createElement(SatisfactionRempliePdf, { data: SATISFACTION, identite: IDENTITE }),
    );
    expect(t).toContain("Camille Martin");
    expect(t).toContain("12 septembre 2026 à 17:20");
    expect(t).toContain("4/5");
    expect(t).toContain("Très concret");
    expect(t).toContain("satisfaction à chaud");
    expect(t).toContain("Indicateur Qualiopi 30");
    expect(t).toContain("Pièce tirée le 30 septembre 2026 à 00:53");
  });

  it("une saisie de l'organisme le dit, et une question vide l'écrit", () => {
    const t = collectPdfTextNormalized(
      React.createElement(SatisfactionRempliePdf, {
        data: { ...SATISFACTION, moment: "froid", saisieOrganisme: true, noteGlobale: null },
        identite: IDENTITE,
      }),
    );
    expect(t).toContain("saisie par l'organisme");
    expect(t).toContain("ne valent pas réponse du stagiaire");
    expect(t).toContain("à froid");
    expect(t).toContain("Non renseigné");
  });
});

const EVALUATION: EvaluationRealiseeData = {
  reference: "EVA-9a8b7c6d",
  nomStagiaire: "Camille Martin",
  intituleFormation: "IA générative pour l'immobilier",
  evalueeLe: "12 septembre 2026 à 16:30",
  tireeLe: "30 septembre 2026 à 00:53",
  scoreObtenu: 8,
  scoreMax: 9,
  scorePct: 89,
  niveauGlobal: "acquis",
  reussite: true,
  competences: [{ libelle: "Rédiger un prompt", note: 3, observations: "Autonome" }],
  recommandations: null,
};

describe("EvaluationRealiseePdf", () => {
  it("porte le résultat enregistré, nominatif et daté", () => {
    const t = collectPdfTextNormalized(
      React.createElement(EvaluationRealiseePdf, { data: EVALUATION, identite: IDENTITE }),
    );
    expect(t).toContain("Camille Martin");
    expect(t).toContain("12 septembre 2026 à 16:30");
    expect(t).toContain("8 / 9 (89 %)");
    expect(t).toContain("Acquis");
    expect(t).toContain("Rédiger un prompt");
    expect(t).toContain("3 — Acquis");
    expect(t).toContain("Indicateur Qualiopi 11");
    expect(t).toContain("Non renseigné");
  });
});
