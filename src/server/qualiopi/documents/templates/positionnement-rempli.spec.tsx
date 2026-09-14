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
  tireeLe: "14 septembre 2026 à 14:30",
  positionnement: {
    fonction: "Assistante de direction",
    secteur: "Immobilier",
    outilsUtilises: null,
    frequenceUsage: "Jamais",
    attentes: "Gagner du temps sur les annonces",
    tacheVisee: "Les comptes rendus de visite",
    niveaux: [{ objectif: "Rédiger des annonces", niveau: 2, libelle: "Quelques notions" }],
    besoinAdaptation: true,
    detailAdaptation: "Salle accessible en fauteuil",
    saisieAdmin: false,
  },
};

describe("PositionnementRempliPdf — une pièce REMPLIE, jamais le gabarit", () => {
  const text = collectPdfTextNormalized(
    React.createElement(PositionnementRempliPdf, { data: DATA, identite: IDENTITE }),
  );

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
    expect(text).toContain("Salle accessible en fauteuil");
    // Une question sans réponse le DIT.
    expect(text).toContain("Non renseigné");
  });

  it("dit si la réponse précède le début, et porte sa date de tirage", () => {
    expect(text).toContain("avant le début de la session");
    expect(text).toContain("Pièce tirée le 14 septembre 2026 à 14:30");
  });

  it("une saisie par l'organisme n'affiche pas de réponse au besoin d'adaptation", () => {
    const saisie = collectPdfTextNormalized(
      React.createElement(PositionnementRempliPdf, {
        data: {
          ...DATA,
          positionnement: {
            ...DATA.positionnement,
            besoinAdaptation: null,
            detailAdaptation: null,
            saisieAdmin: true,
          },
        },
        identite: IDENTITE,
      }),
    );
    expect(saisie).toContain("Non posée (saisie par l'organisme)");
    expect(saisie).not.toMatch(/Besoin d'adaptation déclaré (Oui|Non)(?! posée)/);
  });

  it("ne reprend aucune case du formulaire vierge", () => {
    expect(text).not.toContain("Débutant(e)");
    expect(text).not.toContain("À remplir avant la formation");
  });
});
