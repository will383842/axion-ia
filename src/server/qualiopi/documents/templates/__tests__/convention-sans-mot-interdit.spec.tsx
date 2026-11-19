// @vitest-environment node

/**
 * Convention bipartite v8 — la clause financeur (§ 5, 2e paragraphe), la clause « 5 bis »
 * et la ligne « Certification Qualiopi » ne s'impriment QUE si la certification est obtenue
 * à la génération (`data.certificationObtenue === true`, photo du réglage).
 *
 * Avant la certification, une convention qui nommerait un financeur, un opérateur de
 * compétences ou « Qualiopi » affirmerait ce que l'organisme n'a pas le droit d'affirmer.
 * Le texte de ces clauses est GARDÉ dans le gabarit, mot pour mot, pour le jour J.
 */
import React from "react";
import { beforeAll, describe, expect, it } from "vitest";

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";

import { ConventionPdf, type ConventionData } from "../convention";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const identite: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "XX00000000000",
  qualiopi: "FR-2024-001",
  siret: "12345678900000",
  adresseSiege: "1 rue de la Formation, 75001 Paris",
  adresseExercice: "1 rue de la Formation, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://axion-ia.fr",
};

const base: ConventionData = {
  numero: "AXI-DOC-2026-910",
  estCopie: false,
  client: {
    raisonSociale: "ACME SAS",
    siret: "98765432100000",
    adresse: "10 avenue du Client, 69001 Lyon",
    contact: "Alice Martin",
  },
  intitule: "Introduction à l'IA générative",
  objectifs: ["Comprendre les fondamentaux des LLM"],
  publicVise: "Managers",
  dureeHeures: 7,
  dateDebut: "15/01/2027",
  dateFin: "15/01/2027",
  modalite: "Présentiel",
  lieu: "Lyon",
  effectif: 8,
  prixHt: 10000,
  dateConvention: "05/10/2026",
  conditionSuspensiveOpco: {
    opco: "OPCO Atlas",
    dateLimite: "15/12/2026",
    seuil: { type: "pourcentage", bps: 5000 },
  },
};

/** Variables (et non littéraux) : le champ est ajouté par la v8, sans réécrire le type ici. */
const sansReglage = { ...base };
const reglageFaux = { ...base, certificationObtenue: false };
const reglageVrai = { ...base, certificationObtenue: true };

const MOTS_INTERDITS = [
  "financeur",
  "financement",
  "opérateur de compétences",
  "opco",
  "subrogation",
  "prise en charge",
  "france travail",
  "qualiopi",
  "certification",
];

function texte(data: ConventionData): string {
  return collectPdfTextNormalized(
    React.createElement(ConventionPdf, { data, identite }),
  ).toLowerCase();
}

describe("🔴 convention v8 — rien de financeur ni de Qualiopi sans certification obtenue", () => {
  for (const [nom, data] of [
    ["sans réglage (absent = faux)", sansReglage],
    ["réglage faux", reglageFaux],
  ] as const) {
    it(`${nom} : aucun mot interdit, même avec un numéro Qualiopi et une condition posés`, () => {
      const t = texte(data as ConventionData);
      for (const mot of MOTS_INTERDITS) {
        expect(t, `mot interdit imprimé : « ${mot} »`).not.toContain(mot);
      }
      // Garde-fou de la garde : la convention est bien rendue, « Conditions financières » reste.
      expect(t).toContain("conditions financières");
    });
  }

  it("réglage vrai : la clause financeur, la 5 bis et la ligne Qualiopi sont imprimées", () => {
    const t = texte(reglageVrai as ConventionData);
    expect(t).toContain("financeur");
    expect(t).toContain("5 bis");
    expect(t).toContain("qualiopi");
  });
});
