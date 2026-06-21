/**
 * Tests CONTENU — documents contractuels (convention, contrat, tripartite).
 *
 * Vérifie la présence des mentions légales obligatoires + des identifiants OF,
 * et que l'absence d'un identifiant obligatoire est SIGNALÉE (« Non renseigné »)
 * au lieu d'être masquée. Extraction via collect-pdf-text (arbre React).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { ConventionPdf } from "./convention";
import type { ConventionData } from "./convention";
import { ContratFormationPdf } from "./contrat-formation";
import type { ContratFormationData } from "./contrat-formation";
import { ConventionTripartitePdf } from "./convention-tripartite";
import type { ConventionTripartiteData } from "./convention-tripartite";
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

const CONVENTION: ConventionData = {
  numero: "AXI-CONV-2026-001",
  client: {
    raisonSociale: "Acme SAS",
    siret: "98765432100011",
    adresse: "10 av.",
    contact: "Jean",
  },
  intitule: "IA appliquée",
  objectifs: ["Objectif A", "Objectif B"],
  publicVise: "Dirigeants",
  dureeHeures: 14,
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  modalite: "Présentiel",
  lieu: "Paris",
  effectif: 5,
  prixHt: 2800,
  dateConvention: "01/06/2026",
};

const CONTRAT: ContratFormationData = {
  numero: "AXI-CONV-2026-002",
  stagiaire: { nomPrenom: "Marie Durand" },
  intitule: "IA appliquée",
  objectifs: ["Objectif A"],
  dureeHeures: 14,
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  modalite: "Distanciel",
  lieu: "Distanciel",
  prixNet: 1500,
  dateContrat: "01/06/2026",
};

const TRIPARTITE: ConventionTripartiteData = {
  numero: "AXI-CONV-2026-003",
  client: {
    raisonSociale: "Acme SAS",
    siret: "98765432100011",
    adresse: "10 av.",
    contact: "Jean",
  },
  opco: { nom: "OPCO Atlas", numeroPriseEnCharge: "ATLAS-123" },
  intitule: "IA appliquée",
  objectifs: ["Objectif A"],
  publicVise: "Salariés",
  dureeHeures: 14,
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  modalite: "Mixte",
  lieu: "Paris",
  effectif: 5,
  prixHt: 2800,
  montantPrisEnCharge: 2000,
  resteAChargeClient: 800,
  dateConvention: "01/06/2026",
};

describe("ConventionPdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ConventionPdf, { data: CONVENTION, identite: IDENTITE }),
  );
  it("porte la mention L.6353-1/2", () => {
    expect(text).toContain(LEGAL_MENTIONS.convention);
  });
  it("affiche les identifiants OF + l'adresse du siège", () => {
    expect(text).toContain("12345678901234");
    expect(text).toContain("84691234567");
    expect(text).toContain("1 rue de la Paix, 75001 Paris");
  });
  it("signale un SIRET OF manquant au lieu de le masquer", () => {
    const t = collectPdfTextNormalized(
      React.createElement(ConventionPdf, {
        data: CONVENTION,
        identite: { ...IDENTITE, siret: "" },
      }),
    );
    expect(t).toContain("Non renseigné");
  });
});

describe("ContratFormationPdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ContratFormationPdf, { data: CONTRAT, identite: IDENTITE }),
  );
  it("porte la mention L.6353-3 à -7 (rétractation particuliers)", () => {
    expect(text).toContain(LEGAL_MENTIONS.contratParticulier);
  });
  it("mentionne le délai de rétractation de 10 jours", () => {
    expect(text).toContain("dix (10) jours");
  });
  it("affiche le stagiaire et les identifiants OF", () => {
    expect(text).toContain("Marie Durand");
    expect(text).toContain("12345678901234");
  });
});

describe("ConventionTripartitePdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ConventionTripartitePdf, { data: TRIPARTITE, identite: IDENTITE }),
  );
  it("porte la mention de convention + les 3 parties", () => {
    expect(text).toContain(LEGAL_MENTIONS.convention);
    expect(text).toContain("Pour l'organisme de formation");
    expect(text).toContain("Pour le client");
    expect(text).toContain("Pour l'OPCO");
  });
  it("affiche l'OPCO et la ventilation financière", () => {
    expect(text).toContain("OPCO Atlas");
    expect(text).toContain("ATLAS-123");
  });
});
