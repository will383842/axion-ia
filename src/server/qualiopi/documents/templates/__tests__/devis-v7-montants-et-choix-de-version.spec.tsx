// @vitest-environment node

/**
 * Devis v7 — (c) choix de la version rendue ; (d) montants identiques à ceux de la v6 archivée.
 */

import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { composantGabarit } from "../../signature/exemplaire-signe";
import { DevisPdf, type DevisData } from "../devis";
import { DevisPdf as DevisPdfV5 } from "../archives/devis.v5";
import { DevisPdf as DevisPdfV6 } from "../archives/devis.v6";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";
import type { OrganismeIdentite } from "../../organisme";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const BASE: DevisData = {
  numero: "AXI-DEV-2026-014",
  dateEmission: "05/11/2026",
  dateValidite: "05/12/2026",
  identite: IDENTITE,
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
  },
  lignes: [
    { designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 280000, tauxTvaPercent: 0 },
    { designation: "Conseil", quantite: 2, prixUnitaireHtCents: 90000, tauxTvaPercent: 20 },
  ],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
};

const offre = () => {
  const o = offreFictive();
  o.achat!.lignes = [{ libelle: "Ligne A", quantite: 1, prixHtCents: 100000, tauxTvaBps: 2000 }];
  return o;
};

describe("choix de la version du gabarit devis", () => {
  it("6 = archive v6, 7 = courant, 5 = archive v5", () => {
    expect(composantGabarit("devis", 6)).toBe(DevisPdfV6);
    expect(composantGabarit("devis", 7)).toBe(DevisPdf);
    expect(composantGabarit("devis", 5)).toBe(DevisPdfV5);
    expect(DevisPdfV6).not.toBe(DevisPdf);
  });
});

/** Lignes de totaux : Total HT, TVA…, Total TTC (libellé + montant qui suit). */
function totaux(t: string): string[] {
  return (t.match(/(Total HT|TVA[^€]*?|Total TTC)\s*\d[\d\s]*,\d{2}\s*€/g) ?? []).map((m) =>
    m.replace(/\s+/g, " "),
  );
}

const CAS: ReadonlyArray<readonly [string, DevisData]> = [
  ["classique TVA 0 % + 20 %", BASE],
  ["à formules", { ...BASE, lignes: [], formules: vueFormules(offre()) }],
];

describe("devis v7 — montants identiques à ceux de la v6 archivée", () => {
  for (const [nom, data] of CAS) {
    it(`${nom} : Total HT, TVA, Total TTC égaux`, () => {
      const v6 = collectPdfTextNormalized(React.createElement(DevisPdfV6, { data }));
      const v7 = collectPdfTextNormalized(React.createElement(DevisPdf, { data }));
      const a = totaux(v6);
      expect(a.length).toBeGreaterThanOrEqual(3);
      expect(totaux(v7)).toEqual(a);
    });
  }
});
