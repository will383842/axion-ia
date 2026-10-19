/**
 * Chantier QNC, L05 — le texte v2 de la convocation et du livret.
 * Sans `versionTexte: 2`, le rendu est celui d'AUJOURD'HUI, mot pour mot.
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { ConvocationPdf, type ConvocationData } from "./convocation";
import { LivretAccueilPdf, type LivretAccueilData } from "./livret-accueil";
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
};

const CONVOCATION: ConvocationData = {
  numero: "AXI-DOC-2026-010",
  intituleFormation: "IA au quotidien",
  dateDebut: "10/11/2026",
  dateFin: "11/11/2026",
  horaires: "09h00–12h30, 13h30–17h00",
  dureeHeures: 14,
  modalite: "distanciel",
  nomFormateur: "Jeanne Formatrice",
  contactEmail: "contact@axion-ia.fr",
  nomStagiaire: "Alice Durand",
};

const LIVRET: LivretAccueilData = {
  numero: "AXI-DOC-2026-013",
  contactPedagogique: { nomPrenom: "Jeanne Formatrice", email: "contact@axion-ia.fr" },
  dateVersion: "3 novembre 2026",
};

const rendreConvocation = (over: Partial<ConvocationData> = {}) =>
  collectPdfTextNormalized(
    React.createElement(ConvocationPdf, { data: { ...CONVOCATION, ...over }, identite: IDENTITE }),
  );
const rendreLivret = (over: Partial<LivretAccueilData> = {}) =>
  collectPdfTextNormalized(
    React.createElement(LivretAccueilPdf, { data: { ...LIVRET, ...over }, identite: IDENTITE }),
  );

describe("convocation — sans versionTexte : le texte actuel", () => {
  const t = rendreConvocation();
  it("garde la formule « mis à votre disposition » et n'ajoute rien de v2", () => {
    expect(t).toContain("Documents mis à votre disposition");
    expect(t).not.toContain("Documents joints à cette convocation");
    expect(t).not.toContain("Déroulement de la formation");
    expect(t).not.toContain("2 à 15");
    expect(t).not.toContain("/reclamations");
  });
});

describe("convocation v2", () => {
  const t = rendreConvocation({
    versionTexte: 2,
    outilVisio: "Zoom",
    mentionLienVisio: "Lien envoyé avant la formation",
  });
  it("dit que les pièces sont jointes en PDF", () => {
    expect(t).toContain("Documents joints à cette convocation");
    expect(t).toContain("joints en PDF");
    expect(t).not.toContain("Documents mis à votre disposition");
  });
  it("émargement signé pendant chaque demi-journée, en salle comme en visio", () => {
    expect(t).toContain("pendant chaque demi-journée");
    expect(t).toContain("en salle comme en visioconférence");
  });
  it("effectif 2 à 15 et « présentiel ou distanciel »", () => {
    expect(t).toContain("2 à 15 participants");
    expect(t).toContain("présentiel ou en distanciel");
  });
  it("lien vers /reclamations", () => {
    expect(t).toContain("https://www.axion-ia.fr/reclamations");
  });
  it("distanciel : l'outil est nommé, le champ vide dit « Lien envoyé avant la formation »", () => {
    expect(t).toContain("Zoom");
    expect(t).toContain("Lien envoyé avant la formation");
  });
  it("présentiel : aucune ligne de visioconférence", () => {
    const p = rendreConvocation({ versionTexte: 2, modalite: "présentiel", lieu: "Lyon" });
    expect(p).not.toContain("Outil de visioconférence");
  });
});

describe("livret — sans versionTexte : le texte actuel", () => {
  const t = rendreLivret();
  it("garde le relevé de connexion comme émargement, sans QR ni nouvelle phrase", () => {
    expect(t).toContain("le relevé de connexion ne le remplace pas");
    expect(t).toContain("L'émargement est obligatoire à chaque demi-journée.");
    expect(t).not.toContain("2 à 15");
    expect(t).not.toContain("Scannez");
  });
});

describe("livret v2", () => {
  it("émargement signé pendant chaque demi-journée (salle et visio), effectif, modalités", () => {
    const t = rendreLivret({ versionTexte: 2 });
    expect(t).toContain("se signe pendant chaque demi-journée, en salle");
    expect(t).toContain("se signe pendant chaque demi-journée, en visioconférence");
    expect(t).not.toContain("fait office d'émargement");
    expect(t).toContain("2 à 15 participants");
    expect(t).toContain("présentiel ou en distanciel");
  });
  it("formulaire éteint : le repli e-mail et courrier, et le lien /reclamations", () => {
    const t = rendreLivret({ versionTexte: 2, formulaireReclamationActif: false });
    expect(t).toContain("formulaire en ligne n'est pas encore ouvert");
    expect(t).toContain("par courrier");
    expect(t).toContain("https://www.axion-ia.fr/reclamations");
  });
  it("formulaire ouvert : on l'annonce, sans repli", () => {
    const t = rendreLivret({ versionTexte: 2, formulaireReclamationActif: true });
    expect(t).toContain("déposer votre réclamation en ligne");
    expect(t).not.toContain("n'est pas encore ouvert");
  });
  it("le QR code vers /reclamations est imprimé quand il est fourni", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const t = rendreLivret({ versionTexte: 2, qrReclamationsDataUrl: png });
    expect(t).toContain("Scannez pour ouvrir la page Réclamations.");
  });
});

describe("séminaire v2 : son effectif propre, présentiel seul", () => {
  it("convocation : « jusqu'à 50 », jamais « 2 à 15 »", () => {
    const t = rendreConvocation({ versionTexte: 2, seminaire: true, modalite: "présentiel" });
    expect(t).toContain("jusqu'à 50 participants");
    expect(t).toContain("en présentiel");
    expect(t).not.toContain("2 à 15");
  });
  it("livret : « jusqu'à 50 », jamais « 2 à 15 » ni « distanciel » dans la phrase d'effectif", () => {
    const t = rendreLivret({ versionTexte: 2, seminaire: true });
    expect(t).toContain("jusqu'à 50 participants");
    expect(t).not.toContain("2 à 15");
    expect(t).not.toContain("Nos formations se déroulent en présentiel ou en distanciel");
  });
  it("une formation garde « 2 à 15 »", () => {
    expect(rendreLivret({ versionTexte: 2 })).toContain("2 à 15 participants");
  });
});
