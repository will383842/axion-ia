/**
 * Tests unitaires — render-support.ts (T13)
 *
 * Vérifie que renderSupportToStored :
 *  - produit un buffer PDF valide (hash SHA-256, sizeBytes > 0)
 *  - retourne pdfKey / pdfUrl null si R2 non configuré (fail-soft)
 *  - construit la clé R2 au bon format `supports/{year}/{type}/{hash}.pdf`
 *
 * R2 est simulé via vi.mock — deux variantes : non configuré (défaut) et
 * configuré (overridé par vi.mocked dans les tests concernés).
 * Aucun appel réseau, aucun mock Prisma.
 */

import { describe, it, expect, vi } from "vitest";
import { construireSupport, titreSupport } from "./support-builder";
import type { FormationInput, SupportRenderInput } from "./types";

// ============================================================
// Mock R2 — contrôlé via vi.mocked dans chaque test
// ============================================================

const mockIsR2Configured = vi.fn().mockReturnValue(false);
const mockUploadToR2 = vi.fn().mockResolvedValue({ key: "mock-key" });
const mockGetSignedUrlR2 = vi
  .fn()
  .mockImplementation((key: string) => Promise.resolve(`https://cdn.r2.dev/${key}?sig=test`));

vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: mockIsR2Configured,
  uploadToR2: mockUploadToR2,
  getSignedUrlR2: mockGetSignedUrlR2,
}));

// Import après le mock
const { renderSupportToStored } = await import("./render-support");

// ============================================================
// Fixtures
// ============================================================

const IDENTITE_FIXTURE: SupportRenderInput["identite"] = {
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
  titre: "Machine Learning Appliqué",
  objectifsPedagogiques: [
    "Comprendre les algorithmes de ML supervisé",
    "Entraîner et évaluer des modèles",
  ],
  programmeDetaille: [
    {
      moduleId: "M1",
      titre: "Fondamentaux ML",
      dureeMin: 120,
      sequences: [
        { titre: "Régression linéaire", dureeMin: 40 },
        { titre: "Classification", dureeMin: 40 },
        { titre: "Atelier", dureeMin: 40 },
      ],
    },
  ],
  methodesPedagogiques: ["Cours magistral", "TP Python"],
  moyensTechniques: ["Jupyter Notebook", "Google Colab"],
  ressourcesPedagogiques: ["Notebooks fournis"],
  dureeHeures: 14,
};

const TYPES = [
  "slides_formateur",
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "guide_animation",
  "exercices",
  "grille_eval",
] as const;

// ============================================================
// Tests — fail-soft R2 (pdfKey/pdfUrl null)
// ============================================================

describe("renderSupportToStored — R2 non configuré (fail-soft)", () => {
  for (const type of TYPES) {
    it(`${type} : pdfKey et pdfUrl sont null si R2 absent`, async () => {
      mockIsR2Configured.mockReturnValue(false);

      const contenu = construireSupport(type, FORMATION_FIXTURE);
      const titre = titreSupport(type, FORMATION_FIXTURE.titre);

      const result = await renderSupportToStored({
        type,
        titre,
        contenu,
        version: 1,
        identite: IDENTITE_FIXTURE,
      });

      expect(result.pdfKey).toBeNull();
      expect(result.pdfUrl).toBeNull();
    }, 30_000);

    it(`${type} : hashSha256 et sizeBytes toujours renseignés`, async () => {
      mockIsR2Configured.mockReturnValue(false);

      const contenu = construireSupport(type, FORMATION_FIXTURE);
      const titre = titreSupport(type, FORMATION_FIXTURE.titre);

      const result = await renderSupportToStored({
        type,
        titre,
        contenu,
        version: 1,
        identite: IDENTITE_FIXTURE,
      });

      expect(result.hashSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.sizeBytes).toBeGreaterThan(0);
    }, 30_000);
  }
});

// ============================================================
// Tests — clé R2 format (avec R2 configuré)
// ============================================================

describe("renderSupportToStored — clé R2 format correct", () => {
  it("pdfKey = supports/{year}/{type}/{hash}.pdf", async () => {
    mockIsR2Configured.mockReturnValue(true);

    const type = "memo" as const;
    const contenu = construireSupport(type, FORMATION_FIXTURE);
    const titre = titreSupport(type, FORMATION_FIXTURE.titre);

    const result = await renderSupportToStored({
      type,
      titre,
      contenu,
      version: 1,
      identite: IDENTITE_FIXTURE,
    });

    const year = new Date().getFullYear();
    expect(result.pdfKey).toBe(`supports/${year}/memo/${result.hashSha256}.pdf`);
    expect(result.pdfUrl).not.toBeNull();

    // Reset
    mockIsR2Configured.mockReturnValue(false);
  }, 30_000);

  it("pdfUrl correspond à la clé R2 retournée par getSignedUrlR2", async () => {
    mockIsR2Configured.mockReturnValue(true);

    const type = "grille_eval" as const;
    const contenu = construireSupport(type, FORMATION_FIXTURE);
    const titre = titreSupport(type, FORMATION_FIXTURE.titre);

    const result = await renderSupportToStored({
      type,
      titre,
      contenu,
      version: 1,
      identite: IDENTITE_FIXTURE,
    });

    const year = new Date().getFullYear();
    const expectedKey = `supports/${year}/grille_eval/${result.hashSha256}.pdf`;
    expect(result.pdfUrl).toContain(expectedKey);

    // Reset
    mockIsR2Configured.mockReturnValue(false);
  }, 30_000);
});
