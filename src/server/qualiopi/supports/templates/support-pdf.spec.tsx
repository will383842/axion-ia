/**
 * Tests unitaires — templates/support-pdf.tsx (T13)
 *
 * Pour chacun des 7 types de supports : fixture → SupportPdf → renderPdfToBuffer
 * → buffer commence par "%PDF". Timeout généreux (30 s) car @react-pdf/renderer
 * peut être lent.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { SupportPdf } from "./support-pdf";
import { construireSupport, titreSupport } from "../support-builder";
import type { FormationInput } from "../types";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Fixtures
// ============================================================

const IDENTITE_FIXTURE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-TEST-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const FORMATION_FIXTURE: FormationInput = {
  titre: "IA Générative pour les entreprises",
  objectifsPedagogiques: [
    "Maîtriser les outils d'IA générative",
    "Automatiser des tâches répétitives",
    "Créer des prompts efficaces",
  ],
  programmeDetaille: [
    {
      moduleId: "M1",
      titre: "Panorama de l'IA générative",
      dureeMin: 60,
      sequences: [
        { titre: "Les modèles de langage (LLM)", dureeMin: 20, description: "GPT, Claude, Gemini" },
        { titre: "Les outils no-code", dureeMin: 20 },
        { titre: "Démonstration live", dureeMin: 20 },
      ],
    },
    {
      moduleId: "M2",
      titre: "Prompt Engineering",
      dureeMin: 90,
      sequences: [
        { titre: "Techniques de base", dureeMin: 30 },
        {
          titre: "Techniques avancées (chain-of-thought)",
          dureeMin: 30,
          description: "Raisonnement guidé",
        },
        { titre: "Atelier pratique", dureeMin: 30 },
      ],
    },
  ],
  methodesPedagogiques: ["Exposé interactif", "Exercices pratiques", "Jeux de rôle"],
  moyensTechniques: ["PC ou Mac avec navigateur moderne", "Connexion Internet"],
  ressourcesPedagogiques: ["Fiche mémo PDF", "Accès plateforme 6 mois"],
  dureeHeures: 7,
};

// ============================================================
// Helper
// ============================================================

async function expectValidPdf(element: React.ReactElement): Promise<void> {
  const result = await renderPdfToBuffer(element);
  expect(result.buffer).toBeInstanceOf(Buffer);
  expect(result.buffer.byteLength).toBeGreaterThan(100);
  const header = result.buffer.slice(0, 4).toString("utf8");
  expect(header).toBe("%PDF");
  expect(result.hashSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.sizeBytes).toBeGreaterThan(0);
  expect(result.sizeBytes).toBe(result.buffer.byteLength);
}

// ============================================================
// Tests — un par type de support
// ============================================================

const TYPES = [
  "slides_formateur",
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "guide_animation",
  "exercices",
  "grille_eval",
] as const;

describe("SupportPdf — rendu %PDF pour les 7 types", () => {
  for (const type of TYPES) {
    it(`${type} → buffer commence par %PDF`, async () => {
      const contenu = construireSupport(type, FORMATION_FIXTURE);
      const titre = titreSupport(type, FORMATION_FIXTURE.titre);
      const element = (
        <SupportPdf data={{ type, titre, contenu, version: 1 }} identite={IDENTITE_FIXTURE} />
      );
      await expectValidPdf(element);
    }, 30_000);
  }
});

// ============================================================
// Tests — propriétés spécifiques
// ============================================================

describe("SupportPdf — versions distinctes", () => {
  it("version 1 et version 2 génèrent des buffers différents (hash différents)", async () => {
    const contenu = construireSupport("memo", FORMATION_FIXTURE);
    const titre = titreSupport("memo", FORMATION_FIXTURE.titre);

    const r1 = await renderPdfToBuffer(
      <SupportPdf
        data={{ type: "memo", titre, contenu, version: 1 }}
        identite={IDENTITE_FIXTURE}
      />,
    );
    const r2 = await renderPdfToBuffer(
      <SupportPdf
        data={{ type: "memo", titre, contenu, version: 2 }}
        identite={IDENTITE_FIXTURE}
      />,
    );

    // Les deux sont des PDFs valides
    expect(r1.buffer.slice(0, 4).toString()).toBe("%PDF");
    expect(r2.buffer.slice(0, 4).toString()).toBe("%PDF");
    // Les hashes diffèrent (contenu version différent)
    expect(r1.hashSha256).not.toBe(r2.hashSha256);
  }, 60_000);
});

describe("SupportPdf — identité organisme dans le rendu", () => {
  it("le buffer produit ne lance pas d'erreur même avec identité vide", async () => {
    const identiteVide: OrganismeIdentite = {
      raisonSociale: "",
      nda: "",
      qualiopi: "",
      siret: "",
      adresseSiege: "",
      adresseExercice: "",
      email: "",
      telephone: "",
      site: "",
    };
    const contenu = construireSupport("livret_stagiaire", FORMATION_FIXTURE);
    const titre = titreSupport("livret_stagiaire", FORMATION_FIXTURE.titre);
    const element = (
      <SupportPdf
        data={{ type: "livret_stagiaire", titre, contenu, version: 1 }}
        identite={identiteVide}
      />
    );
    await expectValidPdf(element);
  }, 30_000);
});

describe("SupportPdf — grille_eval items inline", () => {
  it("grille_eval → buffer %PDF (présentation grille spéciale)", async () => {
    const contenu = construireSupport("grille_eval", FORMATION_FIXTURE);
    const titre = titreSupport("grille_eval", FORMATION_FIXTURE.titre);
    const element = (
      <SupportPdf
        data={{ type: "grille_eval", titre, contenu, version: 1 }}
        identite={IDENTITE_FIXTURE}
      />
    );
    await expectValidPdf(element);
  }, 30_000);
});
