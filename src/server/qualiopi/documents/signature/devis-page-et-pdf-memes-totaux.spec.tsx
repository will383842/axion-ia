/**
 * Parité directe page de signature / PDF du devis.
 *
 * Pour une même PHOTO, les totaux HT et TTC que la page de signature affiche
 * (`lireDevisASigner`) doivent se retrouver à l'identique dans le texte du PDF
 * rendu par le gabarit (`DevisPdf`). Toute divergence future rougit ici.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: { devis: { findFirst } } }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import { lireDevisASigner } from "./devis-signature-queries";
import { DevisPdf, type DevisData } from "../templates/devis";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import { registerPdfTestFontsFallback } from "../register-pdf-test-fonts";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

beforeEach(() => {
  findFirst.mockReset();
});

const IDENTITE: DevisData["identite"] = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

function photo(over: Pick<DevisData, "lignes" | "regimeTva"> & Partial<DevisData>): DevisData {
  return {
    numero: "AXI-DEV-2026-001",
    dateEmission: "04/11/2026",
    dateValidite: "31/12/2026",
    identite: IDENTITE,
    client: { raisonSociale: "Acme SAS" },
    ...over,
  };
}

/** Espaces insécables et fines compris : les deux rendus ne les emploient pas forcément pareil. */
function norm(s: string): string {
  return s.replace(/[\s  ]+/g, " ");
}

const JEUX: Array<{ nom: string; data: DevisData }> = [
  {
    nom: "assujetti 20 %",
    data: photo({
      regimeTva: "assujetti",
      tauxTvaStandardPercent: 20,
      lignes: [{ designation: "Formation IA", quantite: 2, prixUnitaireHtCents: 50000 }],
    }),
  },
  {
    nom: "exonéré",
    data: photo({
      regimeTva: "exoneration_261",
      lignes: [{ designation: "Formation IA", quantite: 3, prixUnitaireHtCents: 45000 }],
    }),
  },
  {
    nom: "mixte par ligne, quantité décimale",
    data: photo({
      regimeTva: "assujetti",
      lignes: [
        { designation: "A", quantite: 1.5, prixUnitaireHtCents: 66667, tauxTvaPercent: 0 },
        { designation: "B", quantite: 2.25, prixUnitaireHtCents: 12345 },
        { designation: "C", quantite: 1, prixUnitaireHtCents: 9999, tauxTvaPercent: 5.5 },
      ],
    }),
  },
];

describe("page de signature et PDF du devis : mêmes totaux pour une même photo", () => {
  for (const { nom, data } of JEUX) {
    it(`${nom} : total HT et total TTC de la page présents dans le texte du PDF`, async () => {
      findFirst.mockResolvedValue({
        id: "d1",
        numero: data.numero,
        statut: "envoye",
        offre: null,
        dateValidite: new Date("2026-12-31T00:00:00Z"),
        montantTotalHtCents: 0,
        client: { raisonSociale: "Acme SAS" },
        documentGenere: { metadata: { renderData: { data } } },
      });
      const page = await lireDevisASigner("doc1");
      expect(page?.chiffrageIndisponible).toBe(false);

      const pdf = norm(collectPdfTextNormalized(React.createElement(DevisPdf, { data })));
      const ht = norm(page?.totalHtLisible ?? "");
      const ttc = norm(page?.totalTtcLisible ?? "");
      expect(ht).not.toBe("");
      expect(ttc).not.toBe("");
      expect(pdf).toContain(`Total HT ${ht}`);
      expect(pdf).toContain(`Total TTC ${ttc}`);
    });
  }
});
