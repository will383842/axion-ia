/**
 * Fiche A1 : tant que la certification n'est pas obtenue, le PDF du devis ne
 * contient aucune mention de certification ni de financement.
 */

import { beforeAll, describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("./organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/config/flag", () => ({ isQualiopiCertificationObtenue: vi.fn() }));

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { donneesPdfDevis, type DevisPourPdf } from "./donnees-pdf-devis";
import { DevisPdf } from "./templates/devis";
import { collectPdfTextNormalized } from "./collect-pdf-text";
import { registerPdfTestFontsFallback } from "./register-pdf-test-fonts";
import type { OrganismeIdentite } from "./organisme";

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

const DEVIS: DevisPourPdf = {
  conditionsParticulieres: null,
  numero: "AXI-DEV-2026-001",
  lignes: [{ designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 150000 }],
  activite: null,
  refClient: null,
  financementSuggere: "opco",
  montantOpcoEstimeCents: 100000,
  resteAChargeCents: 50000,
  dateValidite: new Date("2026-12-31T12:00:00Z"),
  client: {
    type: "entreprise",
    raisonSociale: "Acme SAS",
    siret: "98765432100011",
    adresse: null,
    adresseRue: "1 rue A",
    adresseCodePostal: "38000",
    adresseVille: "Lyon",
    contactEmail: "a@acme.fr",
  },
};

const maintenant = new Date("2026-11-04T10:00:00Z");

const MOTS_INTERDITS = [
  "qualiopi",
  "opco",
  "financ",
  "prise en charge",
  "reste à charge",
  "france travail",
];

function texte(certificationObtenue: boolean, aFormules = false): string {
  const data = donneesPdfDevis(
    aFormules ? { ...DEVIS, offre: offreFictive() } : DEVIS,
    {
      identite: IDENTITE,
      regimeTva: "assujetti",
      tauxStandard: 20,
      certificationObtenue,
      ...(aFormules ? { formulesActives: true } : {}),
    },
    maintenant,
  );
  return collectPdfTextNormalized(React.createElement(DevisPdf, { data }));
}

describe("devis sans mot interdit (A1)", () => {
  it("certification non obtenue : aucun mot de certification ni de financement", () => {
    const t = texte(false).toLowerCase();
    for (const mot of [
      "qualiopi",
      "opco",
      "financ",
      "prise en charge",
      "reste à charge",
      "france travail",
    ]) {
      expect(t, mot).not.toContain(mot);
    }
  });

  it("devis à formules, certification non obtenue : aucun mot interdit", () => {
    const data = donneesPdfDevis(
      { ...DEVIS, offre: offreFictive() },
      {
        identite: IDENTITE,
        regimeTva: "assujetti",
        tauxStandard: 20,
        certificationObtenue: false,
        formulesActives: true,
      },
      maintenant,
    );
    expect(data.formules?.formules.length ?? 0).toBeGreaterThan(0);
    const t = texte(false, true).toLowerCase();
    for (const mot of MOTS_INTERDITS) {
      expect(t, mot).not.toContain(mot);
    }
  });

  it("certification obtenue : comportement ancien conservé", () => {
    const t = texte(true).toLowerCase();
    expect(t).toContain("qualiopi");
    expect(t).toContain("opco");
  });
});
