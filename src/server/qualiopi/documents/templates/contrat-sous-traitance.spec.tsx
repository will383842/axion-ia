/**
 * Tests unitaires — template PDF Contrat de sous-traitance (indicateur 27).
 *
 * Vérifie que le rendu produit un vrai fichier PDF (magic bytes %PDF) dans les
 * cas nominaux et dégradés (durée indéterminée, conformité non vérifiée,
 * identifiants manquants → rendus « Non renseigné » sans throw).
 *
 * Timeout généreux (30 s) : @react-pdf/renderer peut être lent sur CI.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { ContratSousTraitancePdf, type ContratSousTraitanceData } from "./contrat-sous-traitance";

// Filet de sécurité polices PDF (fallback built-in si vraies polices absentes).
beforeAll(() => {
  registerPdfTestFontsFallback();
});

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

async function expectPdf(element: React.ReactElement): Promise<void> {
  const { buffer } = await renderPdfToBuffer(element);
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.byteLength).toBeGreaterThan(100);
  expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
}

describe("ContratSousTraitancePdf", () => {
  const data: ContratSousTraitanceData = {
    numero: "AXI-FORM-2026-050",
    estCopie: false,
    sousTraitant: {
      nom: "Jean Dupont — Consultant IA",
      siret: "11122233344400",
      nda: "44000000044",
      adresse: "5 chemin du Formateur, 44000 Nantes",
      email: "jean.dupont@formateur.fr",
    },
    missions: [
      "Animer les modules « IA générative » du catalogue AXI-034.",
      "Concevoir les supports pédagogiques associés.",
    ],
    dateDebut: "01/09/2026",
    dateFin: "31/12/2026",
    remuneration: "850 € HT / jour, facturés à la mission.",
    conformiteVerifieeAt: "20/08/2026",
    dateContrat: "25/08/2026",
  };

  it("rend un PDF valide (%PDF)", async () => {
    await expectPdf(<ContratSousTraitancePdf data={data} identite={identite} />);
  }, 30_000);

  it("rend un PDF valide en durée indéterminée + conformité non vérifiée", async () => {
    const degrade: ContratSousTraitanceData = {
      ...data,
      dateFin: "",
      conformiteVerifieeAt: "",
      missions: [],
    };
    await expectPdf(<ContratSousTraitancePdf data={degrade} identite={identite} />);
  }, 30_000);

  it("rend un PDF valide même si SIRET du sous-traitant absent (flaggé, pas de throw)", async () => {
    const sansSiret: ContratSousTraitanceData = {
      ...data,
      sousTraitant: { nom: "Prestataire X" },
    };
    await expectPdf(<ContratSousTraitancePdf data={sansSiret} identite={identite} />);
  }, 30_000);
});
