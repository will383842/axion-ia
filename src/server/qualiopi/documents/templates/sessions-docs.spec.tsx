/**
 * Tests unitaires — templates de documents de session (T7).
 *
 * Pour chaque des 6 templates, fixture minimal → renderPdfToBuffer → buffer
 * commence par "%PDF". Timeout généreux (30 s) car @react-pdf/renderer est lent.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

/**
 * Filet de sécurité polices : enregistre les familles de marque sur les polices
 * built-in de @react-pdf UNIQUEMENT si elles ne sont pas déjà enregistrées
 * (vraies polices public/fonts/ ou fallback Geist). Voir register-pdf-test-fonts.
 */
beforeAll(() => {
  registerPdfTestFontsFallback();
});

// Templates
import { ConvocationPdf, type ConvocationData } from "./convocation";
import { EmargementPdf, type EmargementData } from "./emargement";
import { ReleveConnexionPdf, type ReleveConnexionData } from "./releve-connexion";
import { PositionnementPdf, type PositionnementData } from "./positionnement";
import { GrilleEvaluationPdf, type GrilleEvaluationData } from "./grille-evaluation";
import { SatisfactionPdf, type SatisfactionData } from "./satisfaction";

// ============================================================
// Fixture partagée
// ============================================================

const IDENTITE_FIXTURE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS (test)",
  nda: "11960000000",
  qualiopi: "FR-2024-0001",
  siret: "12345678900001",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "formation@axion-ia.fr",
  telephone: "+33 1 23 45 67 89",
  site: "https://axion-ia.fr",
};

/** Vérifie que le buffer est un PDF valide (commence par %PDF). */
function expectPdf(buffer: Buffer): void {
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.byteLength).toBeGreaterThan(100);
  expect(buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
}

// ============================================================
// 1. ConvocationPdf
// ============================================================

describe("ConvocationPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const data: ConvocationData = {
      numero: "CONV-2026-001",
      intituleFormation: "IA Générative pour professionnels",
      dateDebut: "10 juin 2026",
      dateFin: "10 juin 2026",
      horaires: "09h00–17h00",
      dureeHeures: 7,
      modalite: "distanciel",
      lienVisio: "https://zoom.us/j/123456789",
      idReunion: "123 456 789",
      nomFormateur: "Sophie Martin",
      contactEmail: "formation@axion-ia.fr",
      nomStagiaire: "Jean Dupont",
      entreprise: "Dupont & Associés",
      financement: "OPCO EP",
      numeroOrdrePriseEnCharge: "OPC-2026-0042",
    };

    const result = await renderPdfToBuffer(
      React.createElement(ConvocationPdf, { data, identite: IDENTITE_FIXTURE }),
    );
    expectPdf(result.buffer);
  }, 30_000);
});

// ============================================================
// 2. EmargementPdf
// ============================================================

describe("EmargementPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const data: EmargementData = {
      numero: "EMAR-2026-001",
      intituleFormation: "IA Générative pour professionnels",
      date: "10 juin 2026 (mercredi)",
      horaires: "09h00–17h00",
      lieu: "Paris — Salle Innovation",
      nomFormateur: "Sophie Martin",
      nda: "11960000000",
      participants: [
        { nom: "Jean Dupont", entreprise: "Dupont & Associés" },
        { nom: "Marie Lefebvre", entreprise: "Lefebvre SAS" },
      ],
      lignesVides: 2,
    };

    const result = await renderPdfToBuffer(
      React.createElement(EmargementPdf, { data, identite: IDENTITE_FIXTURE }),
    );
    expectPdf(result.buffer);
  }, 30_000);
});

// ============================================================
// 3. ReleveConnexionPdf
// ============================================================

describe("ReleveConnexionPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const data: ReleveConnexionData = {
      numero: "RELCO-2026-001",
      intituleFormation: "IA Générative pour professionnels",
      plateforme: "Zoom",
      idReunion: "123 456 789",
      date: "10 juin 2026",
      horairesSession: "09h00–17h00",
      nomFormateur: "Sophie Martin",
      dureeMinimaleRequisePercent: 80,
      participants: [
        {
          nomPrenom: "Jean Dupont",
          heureConnexion: "09h01",
          heureDeconnexion: "17h02",
          dureeEffective: "7h01",
          presenceValidee: true,
        },
        {
          nomPrenom: "Marie Lefebvre",
          heureConnexion: "09h05",
          heureDeconnexion: "16h30",
          dureeEffective: "6h25",
          presenceValidee: false,
        },
      ],
    };

    const result = await renderPdfToBuffer(
      React.createElement(ReleveConnexionPdf, { data, identite: IDENTITE_FIXTURE }),
    );
    expectPdf(result.buffer);
  }, 30_000);
});

// ============================================================
// 4. PositionnementPdf
// ============================================================

describe("PositionnementPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const data: PositionnementData = {
      numero: "POS-2026-001",
      intituleFormation: "IA Générative pour professionnels",
      dateSession: "10 juin 2026",
      nomStagiaire: "Jean Dupont",
      entreprise: "Dupont & Associés",
    };

    const result = await renderPdfToBuffer(
      React.createElement(PositionnementPdf, { data, identite: IDENTITE_FIXTURE }),
    );
    expectPdf(result.buffer);
  }, 30_000);
});

// ============================================================
// 5. GrilleEvaluationPdf
// ============================================================

describe("GrilleEvaluationPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const data: GrilleEvaluationData = {
      numero: "GREV-2026-001",
      intituleFormation: "IA Générative pour professionnels",
      dateEvaluation: "10 juin 2026",
      typeEvaluation: "finale",
      nomFormateur: "Sophie Martin",
      nomStagiaire: "Jean Dupont",
      competences: [
        { libelle: "Comprendre les concepts fondamentaux de l'IA générative", note: 3 },
        {
          libelle: "Utiliser un outil IA pour rédiger et synthétiser",
          note: 2,
          observations: "Progrès notables",
        },
        { libelle: "Identifier les risques et limites des outils IA", note: 3 },
      ],
      recommandations: "Stagiaire très impliqué. Poursuite recommandée vers niveau avancé.",
    };

    const result = await renderPdfToBuffer(
      React.createElement(GrilleEvaluationPdf, { data, identite: IDENTITE_FIXTURE }),
    );
    expectPdf(result.buffer);
  }, 30_000);
});

// ============================================================
// 6. SatisfactionPdf
// ============================================================

describe("SatisfactionPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const data: SatisfactionData = {
      numero: "SAT-2026-001",
      intituleFormation: "IA Générative pour professionnels",
      dateSession: "10 juin 2026",
      // nomStagiaire intentionnellement absent (champ optionnel)
    };

    const result = await renderPdfToBuffer(
      React.createElement(SatisfactionPdf, { data, identite: IDENTITE_FIXTURE }),
    );
    expectPdf(result.buffer);
  }, 30_000);
});
