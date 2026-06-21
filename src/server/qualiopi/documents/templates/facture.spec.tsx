/**
 * Tests CONTENU — facture (conformité mentions obligatoires B2B / fiscales).
 *
 * Contrairement aux specs historiques (« le buffer est un %PDF »), on vérifie
 * la PRÉSENCE des mentions légales et identifiants exigés, via l'extraction de
 * texte de l'arbre React (collect-pdf-text).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { FacturePdf } from "./facture";
import type { FactureData } from "./facture";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
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

function makeFacture(overrides: Partial<FactureData> = {}): FactureData {
  return {
    numero: "AXI-FACT-2026-001",
    dateEmission: "06/06/2026",
    dateEcheance: "20/06/2026",
    periodePrestation: "du 01/06/2026 au 02/06/2026",
    identite: IDENTITE,
    client: {
      raisonSociale: "Acme SAS",
      siret: "98765432100011",
      adresse: "10 avenue des Champs, 75008 Paris",
    },
    lignes: [
      { designation: "Formation IA appliquée — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 },
    ],
    ...overrides,
  };
}

function factureText(data: FactureData): string {
  return collectPdfTextNormalized(React.createElement(FacturePdf, { data }));
}

describe("FacturePdf — mentions obligatoires", () => {
  const text = factureText(makeFacture());

  it("affiche l'identité + l'adresse du siège du vendeur", () => {
    expect(text).toContain("Axion-IA SAS");
    expect(text).toContain("1 rue de la Paix, 75001 Paris");
  });

  it("affiche SIRET et NDA de l'organisme", () => {
    expect(text).toContain("12345678901234");
    expect(text).toContain("84691234567");
  });

  it("affiche la date d'émission, d'échéance et de réalisation de la prestation", () => {
    expect(text).toContain("06/06/2026");
    expect(text).toContain("20/06/2026");
    expect(text).toContain("du 01/06/2026 au 02/06/2026");
    expect(text).toContain("Date de réalisation de la prestation");
  });

  it("porte la mention d'exonération de TVA (art. 261-4-4° CGI)", () => {
    expect(text).toContain(LEGAL_MENTIONS.factureExonerationTva);
  });

  it("porte les pénalités de retard (art. L.441-10 C. com.)", () => {
    expect(text).toContain(LEGAL_MENTIONS.facturePenalitesRetard);
    expect(text).toContain("trois fois le taux d'intérêt légal");
  });

  it("porte l'indemnité forfaitaire de 40 € (art. D.441-5 C. com.)", () => {
    expect(text).toContain(LEGAL_MENTIONS.factureIndemniteRecouvrement);
    expect(text).toContain("40 €");
  });

  it("porte la mention d'absence d'escompte (art. L.441-9 C. com.)", () => {
    expect(text).toContain(LEGAL_MENTIONS.factureEscompte);
  });

  it("affiche le total HT et le total TTC formatés", () => {
    // 280 000 centimes → 2 800,00 € (espace insécable normalisé).
    expect(text).toContain("Total HT");
    expect(text).toContain("Total TTC");
    expect(text.replace(/ | /g, " ")).toContain("2 800,00");
  });
});

describe("FacturePdf — identifiants vendeur manquants signalés (jamais masqués)", () => {
  it("SIRET vide → « Non renseigné » apparaît au lieu de disparaître", () => {
    const text = factureText(makeFacture({ identite: { ...IDENTITE, siret: "" } }));
    expect(text).toContain("Non renseigné");
    // Le libellé reste présent (la ligne n'est pas masquée).
    expect(text).toContain("SIRET de l'organisme");
  });
});
