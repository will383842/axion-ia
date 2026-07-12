/**
 * Tests CONTENU + RENDU — devis (CRM).
 *
 * Comme facture.spec.tsx : la PRÉSENCE des mentions est vérifiée via
 * l'extraction de texte de l'arbre React (collect-pdf-text), plus un test de
 * rendu binaire (%PDF) — timeout généreux, @react-pdf/renderer est lent.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { DevisPdf } from "./devis";
import type { DevisData } from "./devis";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "../organisme";

// Filet de sécurité polices PDF (fallback built-in si vraies polices absentes).
beforeAll(() => {
  registerPdfTestFontsFallback();
});

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

function makeDevis(overrides: Partial<DevisData> = {}): DevisData {
  return {
    numero: "AXI-DEV-2026-001",
    dateEmission: "06/06/2026",
    dateValidite: "06/07/2026",
    refClient: "BC-2026-042",
    identite: IDENTITE,
    client: {
      raisonSociale: "Acme SAS",
      siret: "98765432100011",
      adresse: "10 avenue des Champs, 75008 Paris",
      email: "achats@acme.fr",
    },
    lignes: [
      { designation: "Formation IA appliquée — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 },
    ],
    regimeTva: "exoneration_261",
    ...overrides,
  };
}

function devisText(data: DevisData): string {
  return collectPdfTextNormalized(React.createElement(DevisPdf, { data }));
}

describe("DevisPdf — rendu binaire", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    const result = await renderPdfToBuffer(React.createElement(DevisPdf, { data: makeDevis() }));
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.byteLength).toBeGreaterThan(100);
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
  }, 30_000);
});

describe("DevisPdf — mentions obligatoires", () => {
  const text = devisText(makeDevis());

  it("affiche l'identité + l'adresse du siège de l'émetteur", () => {
    expect(text).toContain("Axion-IA SAS");
    expect(text).toContain("1 rue de la Paix, 75001 Paris");
  });

  it("affiche SIRET et NDA de l'organisme", () => {
    expect(text).toContain("12345678901234");
    expect(text).toContain("84691234567");
  });

  it("affiche le n° de devis, la date d'émission, la validité et la réf client", () => {
    expect(text).toContain("AXI-DEV-2026-001");
    expect(text).toContain("06/06/2026");
    expect(text).toContain("06/07/2026");
    expect(text).toContain("BC-2026-042");
  });

  it("porte la mention « Devis gratuit, valable jusqu'au … »", () => {
    expect(text).toContain("Devis gratuit, valable jusqu'au 06/07/2026");
  });

  it("porte la mention d'exonération TVA (régime exoneration_261)", () => {
    expect(text).toContain(LEGAL_MENTIONS.factureExonerationTva);
  });

  it("porte le bloc signature « Bon pour accord » (nom/fonction, date, signature)", () => {
    expect(text).toContain("Bon pour accord");
    expect(text).toContain("Nom et fonction du signataire");
    expect(text).toContain("Date :");
    expect(text).toContain("Signature :");
  });
});

describe("DevisPdf — totaux TVA mixte (formation 0 % + conseil 20 %)", () => {
  const text = devisText(
    makeDevis({
      regimeTva: "exoneration_261",
      lignes: [
        { designation: "Formation IA — 2 jours", quantite: 1, prixUnitaireHtCents: 200000 },
        {
          designation: "Audit IA (conseil)",
          quantite: 1,
          prixUnitaireHtCents: 100000,
          tauxTvaPercent: 20,
        },
      ],
    }),
  );

  it("ventile les 2 taux (0 % et 20 %)", () => {
    expect(text).toContain("0 %");
    expect(text).toContain("20 %");
  });

  it("totalise HT 3 000, TVA 200 et TTC 3 200", () => {
    expect(text.replace(/ | /g, " ")).toContain("3 000,00"); // Total HT
    expect(text.replace(/ | /g, " ")).toContain("200,00"); // TVA 20 % sur 1 000
    expect(text.replace(/ | /g, " ")).toContain("3 200,00"); // Total TTC
  });
});

describe("DevisPdf — estimation de financement", () => {
  it("affiche prise en charge OPCO + reste à charge quand présents", () => {
    const text = devisText(
      makeDevis({
        financementSuggere: "OPCO",
        montantOpcoEstimeCents: 150000,
        resteAChargeCents: 130000,
      }),
    );
    expect(text).toContain("Estimation de financement");
    expect(text.replace(/ | /g, " ")).toContain("1 500,00");
    expect(text.replace(/ | /g, " ")).toContain("1 300,00");
    expect(text).toContain("non contractuelle");
  });

  it("masque le bloc estimation quand aucun montant n'est fourni", () => {
    const text = devisText(makeDevis());
    expect(text).not.toContain("Estimation de financement");
  });
});

describe("DevisPdf — identifiants émetteur manquants signalés (jamais masqués)", () => {
  it("SIRET vide → « Non renseigné » apparaît au lieu de disparaître", () => {
    const text = devisText(makeDevis({ identite: { ...IDENTITE, siret: "" } }));
    expect(text).toContain("Non renseigné");
    expect(text).toContain("SIRET de l'organisme");
  });
});
