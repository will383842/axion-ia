/**
 * Tests unitaires — 5 templates PDF Qualiopi (T7).
 *
 * Pour chaque template, vérifie que le rendu produit un vrai fichier PDF
 * (magic bytes %PDF en tête de buffer).
 *
 * Timeout généreux (30 s) : @react-pdf/renderer peut être lent sur CI.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// Filet de sécurité polices PDF (fallback built-in si vraies polices absentes).
beforeAll(() => {
  registerPdfTestFontsFallback();
});

import { ConventionPdf, type ConventionData } from "./convention";
import { ConventionTripartitePdf, type ConventionTripartiteData } from "./convention-tripartite";
import { LettreMissionPdf, type LettreMissionData } from "./lettre-mission";
import { ReglementInterieurPdf, type ReglementInterieurData } from "./reglement-interieur";
import { LivretAccueilPdf, type LivretAccueilData } from "./livret-accueil";

// ============================================================
// Fixtures partagées
// ============================================================

const identite: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "XX00000000000",
  qualiopi: "FR-2024-00000",
  siret: "12345678900000",
  adresseSiege: "1 rue de la Formation, 75001 Paris",
  adresseExercice: "1 rue de la Formation, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://axion-ia.fr",
};

// ============================================================
// Helper
// ============================================================

async function expectPdf(element: React.ReactElement): Promise<void> {
  const { buffer } = await renderPdfToBuffer(element);
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.byteLength).toBeGreaterThan(100);
  expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
}

// ============================================================
// Convention bipartite
// ============================================================

describe("ConventionPdf", () => {
  const data: ConventionData = {
    numero: "CONV-2024-001",
    estCopie: false,
    client: {
      raisonSociale: "ACME SAS",
      siret: "98765432100000",
      adresse: "10 avenue du Client, 69001 Lyon",
      contact: "Alice Martin — alice@acme.fr",
    },
    intitule: "Introduction à l'IA générative",
    objectifs: [
      "Comprendre les fondamentaux des LLM",
      "Utiliser des outils IA en contexte professionnel",
    ],
    publicVise: "Managers et équipes métier",
    dureeHeures: 7,
    dateDebut: "15/09/2024",
    dateFin: "15/09/2024",
    modalite: "Présentiel",
    lieu: "Paris 75001",
    effectif: 12,
    prixHt: 2900,
    acomptePercent: 30,
    dateConvention: "01/09/2024",
  };

  it("rend un PDF valide (%PDF)", async () => {
    await expectPdf(<ConventionPdf data={data} identite={identite} />);
  }, 30_000);
});

// ============================================================
// Convention tripartite
// ============================================================

describe("ConventionTripartitePdf", () => {
  const data: ConventionTripartiteData = {
    numero: "CONV-TRI-2024-001",
    estCopie: false,
    client: {
      raisonSociale: "ACME SAS",
      siret: "98765432100000",
      adresse: "10 avenue du Client, 69001 Lyon",
      contact: "Alice Martin",
    },
    opco: {
      nom: "OPCO Entreprises",
      numeroPriseEnCharge: "PC-2024-12345",
      adresse: "50 boulevard de l'OPCO, 75009 Paris",
      contact: "opco@opco-entreprises.fr",
    },
    intitule: "Intelligence artificielle pour managers",
    objectifs: ["Piloter des projets IA", "Évaluer les risques éthiques"],
    publicVise: "Cadres dirigeants",
    dureeHeures: 14,
    dateDebut: "20/09/2024",
    dateFin: "21/09/2024",
    modalite: "Mixte",
    lieu: "Lyon + Distanciel",
    effectif: 8,
    prixHt: 4200,
    montantPrisEnCharge: 3000,
    resteAChargeClient: 1200,
    dateConvention: "05/09/2024",
  };

  it("rend un PDF valide (%PDF)", async () => {
    await expectPdf(<ConventionTripartitePdf data={data} identite={identite} />);
  }, 30_000);
});

// ============================================================
// Lettre de mission
// ============================================================

describe("LettreMissionPdf", () => {
  const data: LettreMissionData = {
    numero: "LM-2024-001",
    estCopie: false,
    formateur: {
      nomPrenom: "Jean Dupont",
      siretOuSirenOuNaf: "11122233344400",
      adresse: "5 chemin du Formateur, 44000 Nantes",
      email: "jean.dupont@formateur.fr",
      telephone: "+33 6 12 34 56 78",
      specialite: "IA générative et LLM",
    },
    objetMission:
      "Animation de formations en intelligence artificielle pour le compte d'Axion-IA SAS.",
    formations: [
      {
        intitule: "Introduction à l'IA générative",
        dateDebut: "15/09/2024",
        dateFin: "15/09/2024",
        lieuOuModalite: "Paris / Présentiel",
        dureeHeures: 7,
      },
    ],
    tarifJourHt: 850,
    dateMission: "01/09/2024",
  };

  it("rend un PDF valide (%PDF)", async () => {
    await expectPdf(<LettreMissionPdf data={data} identite={identite} />);
  }, 30_000);
});

// ============================================================
// Règlement intérieur
// ============================================================

describe("ReglementInterieurPdf", () => {
  const data: ReglementInterieurData = {
    numero: "RI-2024-001",
    estCopie: false,
    dateVersion: "01/01/2024",
  };

  it("rend un PDF valide (%PDF)", async () => {
    await expectPdf(<ReglementInterieurPdf data={data} identite={identite} />);
  }, 30_000);
});

// ============================================================
// Livret d'accueil
// ============================================================

describe("LivretAccueilPdf", () => {
  const data: LivretAccueilData = {
    numero: "LA-2024-001",
    estCopie: false,
    contactPedagogique: {
      nomPrenom: "Sophie Lambert",
      email: "sophie.lambert@axion-ia.fr",
      telephone: "+33 1 00 00 00 01",
    },
    contactAdministratif: {
      nomPrenom: "Marc Leblanc",
      email: "admin@axion-ia.fr",
    },
    dateVersion: "01/01/2024",
  };

  it("rend un PDF valide (%PDF)", async () => {
    await expectPdf(<LivretAccueilPdf data={data} identite={identite} />);
  }, 30_000);
});
