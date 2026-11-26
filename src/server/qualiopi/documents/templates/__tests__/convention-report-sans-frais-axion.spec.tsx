// @vitest-environment node

/**
 * Conventions v12 (bipartite) / v10 (tripartite) — § 4 : l'organisme REPORTE au lieu d'annuler
 * (CGV 46.4). Au moins 2 nouvelles dates dans les 6 mois, sans frais, 1re date réputée acceptée sans réponse, acompte reporté
 * ou bon d'achat 12 mois ; remboursement et indemnité égale (personne morale non professionnelle seule) en dernier recours.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { GABARIT_VERSIONS } from "../gabarit-versions";
import { gabaritArchive } from "../archives";
import { ConventionPdf, type ConventionData } from "../convention";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const identite: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "XX00000000000",
  qualiopi: "",
  siret: "12345678900000",
  adresseSiege: "1 rue de la Formation, 75001 Paris",
  adresseExercice: "1 rue de la Formation, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://axion-ia.fr",
};

const data: ConventionData = {
  numero: "AXI-DOC-2026-921",
  estCopie: false,
  client: {
    raisonSociale: "ACME SAS",
    siret: "98765432100000",
    adresse: "10 avenue du Client, 69001 Lyon",
    contact: "Alice Martin",
  },
  intitule: "Formation IA",
  objectifs: ["Identifier les tâches à automatiser"],
  publicVise: "Dirigeants",
  dureeHeures: 7,
  dateDebut: "15/01/2027",
  dateFin: "15/01/2027",
  modalite: "Présentiel",
  lieu: "Lyon",
  effectif: 4,
  prixHt: 1000,
  acompte: 300,
  dateConvention: "26/11/2026",
} as ConventionData;

const FRAGMENTS = [
  "n'annule pas",
  "reporte la prestation sans frais pour le client",
  "dans les 30 jours suivant cette information, au moins 2 nouvelles dates situées dans les 6 mois suivant la date initialement convenue",
  "délai de réponse raisonnable d'au moins 10 jours ouvrés",
  "réputé accepter la première date proposée",
  "rien n'est remboursé",
  "qui suit les mêmes règles de réponse, de rappel, de relance et de silence que la première",
  "sans prolonger le délai de 6 mois",
  "par écrit et jamais par son silence",
  "la part non utilisée à l'expiration lui est remboursée dans les 30 jours",
  "les sommes réglées par un tiers pour son compte en sont exclues",
  "bon d'achat (avoir) du montant des sommes qu'il a lui-même versées, valable 12 mois",
  "Ce report n'est pas une annulation par le client",
  "Le remboursement n'intervient qu'en dernier recours",
  "Pour la seule personne morale non professionnelle",
  "client professionnel ne reçoit jamais d'indemnité en plus",
];

describe("conventions : report sans frais à l'initiative de l'organisme (§ 4)", () => {
  it("versions : convention 12 (v11 archivée), tripartite 10 (v9 archivée)", () => {
    expect(GABARIT_VERSIONS.convention).toBe(12);
    expect(GABARIT_VERSIONS.convention_tripartite).toBe(10);
    expect(gabaritArchive("convention", 11)).toBeDefined();
    expect(gabaritArchive("convention_tripartite", 9)).toBeDefined();
  });

  it("bipartite rendue : les mêmes engagements que l'article 46.4 des CGV", async () => {
    const t = (await collectPdfTextNormalized(
      React.createElement(ConventionPdf as never, { data, identite }),
    )) as string;
    const plat = t.replace(/\s+/g, " ").replace(/’/g, "'");
    for (const f of FRAGMENTS) expect(plat).toContain(f);
    expect(plat).not.toContain("renonce à l'exécuter");
    expect(plat).not.toContain("n'accepte pas le report proposé");
    expect(plat).not.toContain("son silence valant refus");
  });

  it("tripartite (source) : mêmes engagements, sans ancienne formule d'annulation par l'organisme", () => {
    const src = readFileSync(join(__dirname, "..", "convention-tripartite.tsx"), "utf8")
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, " ");
    for (const f of FRAGMENTS) expect(src).toContain(f);
    expect(src).not.toContain("n'accepte pas le report proposé");
  });
});
