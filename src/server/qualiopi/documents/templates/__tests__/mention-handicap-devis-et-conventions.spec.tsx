/**
 * Mention handicap sur le devis et les deux conventions (L15, NC12, indicateur 26).
 *
 * Un futur stagiaire, ou son employeur, doit lire AVANT de signer : qu'un référent
 * handicap existe, comment le joindre, et qu'une adaptation est possible. La
 * mention est portée par la pièce que le client LIT et SIGNE.
 *
 * Les trois gabarits portent le MÊME texte, et l'adresse est celle du repli public
 * du référent (`REFERENT_HANDICAP_REPLI`) : une seule adresse, pas trois.
 *
 * Elle est imprimée dans le gabarit (donc verrouillée par `gabarit-empreinte.spec.ts`),
 * et sa version est incrémentée UNE fois, dans ce lot (cf. `gabarit-versions.ts`).
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";

import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { collectPdfTextNormalized } from "../../collect-pdf-text";
import type { OrganismeIdentite } from "../../organisme";
import { GABARIT_VERSIONS } from "../gabarit-versions";
import { ConventionPdf, type ConventionData } from "../convention";
import { ConventionTripartitePdf, type ConventionTripartiteData } from "../convention-tripartite";
import { DevisPdf, type DevisData } from "../devis";

// `referent-handicap-public` importe Prisma : on ne lit ici que la constante du repli.
vi.mock("@/lib/prisma", () => ({ prisma: { siteSetting: { findUnique: vi.fn() } } }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));

import { REFERENT_HANDICAP_REPLI } from "@/server/qualiopi/config/referent-handicap-public";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const identite: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2026-0001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const convention: ConventionData = {
  numero: "CONV-2026-001",
  estCopie: false,
  client: {
    raisonSociale: "ACME SAS",
    siret: "98765432100000",
    adresse: "10 avenue du Client, 69001 Lyon",
    contact: "Alice Martin — alice@acme.fr",
  },
  intitule: "Introduction à l'IA générative",
  objectifs: ["Comprendre les fondamentaux des LLM"],
  publicVise: "Managers et équipes métier",
  dureeHeures: 7,
  dateDebut: "15/09/2026",
  dateFin: "15/09/2026",
  modalite: "Présentiel",
  lieu: "Paris 75001",
  effectif: 12,
  prixHt: 2900,
  acomptePercent: 30,
  dateConvention: "01/09/2026",
};

const tripartite: ConventionTripartiteData = {
  numero: "CONV-TRI-2026-001",
  estCopie: false,
  client: convention.client,
  opco: {
    nom: "OPCO Entreprises",
    numeroPriseEnCharge: "PC-2026-12345",
    adresse: "50 boulevard de l'OPCO, 75009 Paris",
    contact: "opco@opco-entreprises.fr",
  },
  intitule: "Intelligence artificielle pour managers",
  objectifs: ["Piloter des projets IA"],
  publicVise: "Cadres dirigeants",
  dureeHeures: 14,
  dateDebut: "20/09/2026",
  dateFin: "21/09/2026",
  modalite: "Hybride (présentiel et distanciel)",
  lieu: "Lyon + Distanciel",
  effectif: 8,
  prixHt: 4200,
  montantPrisEnCharge: 3000,
  resteAChargeClient: 1200,
  dateConvention: "05/09/2026",
};

const devis: DevisData = {
  numero: "AXI-DEV-2026-001",
  dateEmission: "06/06/2026",
  dateValidite: "06/07/2026",
  refClient: "BC-2026-042",
  identite,
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
};

const MENTION =
  "Situation de handicap : notre référent handicap étudie avec vous, avant la formation, les adaptations possibles (supports, rythme, accès, modalités). Contact : handicap@axion-ia.com.";

const PIECES: ReadonlyArray<readonly [string, () => string]> = [
  ["devis", () => collectPdfTextNormalized(React.createElement(DevisPdf, { data: devis }))],
  [
    "convention",
    () =>
      collectPdfTextNormalized(React.createElement(ConventionPdf, { data: convention, identite })),
  ],
  [
    "convention tripartite",
    () =>
      collectPdfTextNormalized(
        React.createElement(ConventionTripartitePdf, { data: tripartite, identite }),
      ),
  ],
];

describe.each(PIECES)("%s — mention handicap", (_nom, texte) => {
  it("🔴 porte le référent handicap, le contact et la possibilité d'adaptation", () => {
    const t = texte();
    expect(t).toContain("référent handicap");
    expect(t).toContain("handicap@axion-ia.com");
    expect(t).toMatch(/adaptations? possibles?/);
  });

  it("porte le texte exact, identique sur les trois pièces", () => {
    expect(texte()).toContain(MENTION);
  });
});

describe("mention handicap — cohérence", () => {
  it("l'adresse imprimée est celle du repli public du référent (une seule adresse)", () => {
    expect(MENTION).toContain(REFERENT_HANDICAP_REPLI.email);
  });

  it("🔑 les versions de gabarit ont été incrémentées UNE fois dans ce lot", () => {
    expect(GABARIT_VERSIONS.devis).toBe(2);
    expect(GABARIT_VERSIONS.convention).toBe(6);
    expect(GABARIT_VERSIONS.convention_tripartite).toBe(6);
  });
});
