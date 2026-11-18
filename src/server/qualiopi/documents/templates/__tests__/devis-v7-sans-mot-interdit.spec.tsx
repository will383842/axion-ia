// @vitest-environment node

/**
 * Devis v7 — décision du fondateur : AUCUNE mention visible de certification, de Qualiopi,
 * d'OPCO, de financement ni de prise en charge sur le devis courant.
 *
 * Le rendu est RÉEL (le vrai `DevisPdf` courant) avec toutes les données qui, en v6, faisaient
 * imprimer la carte d'estimation et le champ « Certification Qualiopi ».
 */

import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { DevisPdf, type DevisData } from "../devis";
import type { OrganismeIdentite } from "../../organisme";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "B-2026-XXXXXXXXXXXX",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const DATA: DevisData = {
  numero: "AXI-DEV-2026-014",
  dateEmission: "05/11/2026",
  dateValidite: "05/12/2026",
  identite: IDENTITE,
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
  },
  lignes: [{ designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 }],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
  financementSuggere: "OPCO",
  montantOpcoEstimeCents: 150000,
  resteAChargeCents: 130000,
};

const MOTS = [
  "qualiopi",
  "opco",
  "financ",
  "prise en charge",
  "reste à charge",
  "france travail",
  "certif",
];

function verifie(data: DevisData): void {
  const t = collectPdfTextNormalized(React.createElement(DevisPdf, { data })).toLowerCase();
  expect(t).toContain("total ttc");
  for (const mot of MOTS) expect(t, `mot interdit : ${mot}`).not.toContain(mot);
}

describe("devis v7 — aucun mot interdit, même avec toutes les données de financement", () => {
  it("montants d'estimation + financement suggéré + identité Qualiopi remplis", () => {
    verifie(DATA);
  });

  it("mention d'estimation indisponible renseignée", () => {
    verifie({
      ...DATA,
      mentionEstimationIndisponible:
        "Financement mutualisé (OPCO, CPF, France Travail) : aucune estimation de prise en charge.",
    });
  });
});
