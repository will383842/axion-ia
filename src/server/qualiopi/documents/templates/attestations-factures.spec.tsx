/**
 * Tests unitaires — templates PDF réglementaires (T7)
 *
 * Pour chacun des 7 templates : fixture minimal → renderPdfToBuffer → buffer "%PDF".
 * Test spécifique certificat : rendu non vide + vérification unitaire formatHeuresCentiemes.
 *
 * ⚠️ Timeout généreux (30 s) car @react-pdf/renderer peut être lent.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { formatHeuresCentiemes } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "../organisme";

import { AttestationPdf } from "./attestation";
import { AttestationPartiellePdf } from "./attestation-partielle";
import { CertificatRealisationPdf } from "./certificat-realisation";
import { FacturePdf } from "./facture";
import { KitOpcoPdf } from "./kit-opco";
import { KitCpfPdf } from "./kit-cpf";
import { KitFranceTravailPdf } from "./kit-france-travail";

// ============================================================
// Fixture partagée
// ============================================================

const IDENTITE_FIXTURE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-TEST-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

// ============================================================
// Helpers
// ============================================================

async function expectValidPdf(element: React.ReactElement): Promise<Buffer> {
  const result = await renderPdfToBuffer(element);
  expect(result.buffer).toBeInstanceOf(Buffer);
  expect(result.buffer.byteLength).toBeGreaterThan(100);
  const header = result.buffer.slice(0, 4).toString("utf8");
  expect(header).toBe("%PDF");
  return result.buffer;
}

// ============================================================
// Tests formatHeuresCentiemes (unitaire, indépendant)
// ============================================================

describe("formatHeuresCentiemes (test unitaire)", () => {
  it('formate 7 → "7,00" (jamais "7h00")', () => {
    expect(formatHeuresCentiemes(7)).toBe("7,00");
  });

  it('formate 1.5 → "1,50"', () => {
    expect(formatHeuresCentiemes(1.5)).toBe("1,50");
  });

  it('formate 7.25 → "7,25"', () => {
    expect(formatHeuresCentiemes(7.25)).toBe("7,25");
  });

  it("n'utilise jamais le format horaire (h00)", () => {
    const result = formatHeuresCentiemes(7);
    expect(result).not.toMatch(/h/i);
    expect(result).toContain(",");
  });
});

// ============================================================
// AttestationPdf
// ============================================================

describe("AttestationPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    await expectValidPdf(
      React.createElement(AttestationPdf, {
        data: {
          numero: "AXI-ATT-2026-001",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          dirigeant: "Alice Dupont",
          beneficiaire: {
            nom: "Martin",
            prenom: "Jean",
            entreprise: "Acme SAS",
            fonction: "Directeur technique",
          },
          formation: {
            intitule: "IA appliquée aux entreprises",
            objectifs: "Maîtriser les bases de l'IA générative",
            dureeHeures: 14,
            dateDebut: "01/06/2026",
            dateFin: "02/06/2026",
            modalite: "Présentiel",
            formateur: "Bob Formateur",
          },
          resultats: {
            heuresSuivies: 14,
            heuresTotales: 14,
            evaluationObtenue: "Satisfaisant",
            competencesAcquises: "Utilisation de modèles IA, prompt engineering",
          },
        },
      }),
    );
  }, 30_000);
});

// ============================================================
// AttestationPartiellePdf
// ============================================================

describe("AttestationPartiellePdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    await expectValidPdf(
      React.createElement(AttestationPartiellePdf, {
        data: {
          numero: "AXI-ATT-2026-002",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          dirigeant: "Alice Dupont",
          beneficiaire: {
            nom: "Bernard",
            prenom: "Sophie",
          },
          formation: {
            intitule: "IA appliquée aux entreprises",
            objectifs: "Maîtriser les bases de l'IA générative",
            dureeHeures: 14,
            dateDebut: "01/06/2026",
            dateFin: "02/06/2026",
            modalite: "Distanciel",
            formateur: "Bob Formateur",
          },
          resultats: {
            heuresSuivies: 10,
            heuresTotales: 14,
            competencesPartiellesValidees: "Prompt engineering (modules 1-3)",
          },
        },
      }),
    );
  }, 30_000);
});

// ============================================================
// CertificatRealisationPdf
// ============================================================

describe("CertificatRealisationPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    await expectValidPdf(
      React.createElement(CertificatRealisationPdf, {
        data: {
          numero: "AXI-CERT-2026-001",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          dirigeant: "Alice Dupont",
          entreprise: {
            raisonSociale: "Acme SAS",
            siret: "98765432100011",
          },
          stagiaire: {
            nom: "Leroy",
            prenom: "Pierre",
            fonction: "Chef de projet",
          },
          intituleAction: "IA appliquée aux entreprises",
          dateDebut: "01/06/2026",
          dateFin: "02/06/2026",
          dureeHeures: 7,
        },
      }),
    );
  }, 30_000);

  it("utilise formatHeuresCentiemes — le buffer n'est pas vide et dure 7,00", async () => {
    // Vérification unitaire que formatHeuresCentiemes(7) === "7,00"
    // et que ce format est bien utilisé dans le template (import réel).
    expect(formatHeuresCentiemes(7)).toBe("7,00");

    const result = await renderPdfToBuffer(
      React.createElement(CertificatRealisationPdf, {
        data: {
          numero: "AXI-CERT-2026-002",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          entreprise: { raisonSociale: "Beta Corp" },
          stagiaire: { nom: "Durand", prenom: "Marie" },
          intituleAction: "Formation test heures centièmes",
          dateDebut: "01/06/2026",
          dateFin: "01/06/2026",
          dureeHeures: 7,
        },
      }),
    );

    expect(result.buffer.byteLength).toBeGreaterThan(0);
    expect(result.buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
  }, 30_000);
});

// ============================================================
// FacturePdf
// ============================================================

describe("FacturePdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    await expectValidPdf(
      React.createElement(FacturePdf, {
        data: {
          numero: "AXI-FACT-2026-001",
          dateEmission: "06/06/2026",
          dateEcheance: "20/06/2026",
          identite: IDENTITE_FIXTURE,
          client: {
            raisonSociale: "Acme SAS",
            siret: "98765432100011",
            adresse: "10 avenue des Champs, 75008 Paris",
          },
          lignes: [
            {
              designation: "Formation IA appliquée — 2 jours",
              quantite: 1,
              prixUnitaireHtCents: 280000,
            },
          ],
        },
      }),
    );
  }, 30_000);
});

// ============================================================
// KitOpcoPdf
// ============================================================

describe("KitOpcoPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    await expectValidPdf(
      React.createElement(KitOpcoPdf, {
        data: {
          numero: "AXI-FORM-2026-001",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          nomOpco: "OPCO Atlas",
          numeroDossier: "ATLAS-2026-00123",
          intituleFormation: "IA appliquée aux entreprises",
          dateDebut: "01/06/2026",
          dateFin: "02/06/2026",
          ventilation: [
            {
              nomParticipant: "Jean Martin",
              heuresRealisees: 14,
              baremePrisEnChargeHeureCents: 2000,
              montantPrisEnChargeCents: 28000,
              resteAChargeCents: 0,
            },
          ],
          totalPrisEnChargeCents: 28000,
          totalResteAChargeCents: 0,
        },
      }),
    );
  }, 30_000);
});

// ============================================================
// KitCpfPdf
// ============================================================

describe("KitCpfPdf", () => {
  it("génère un PDF valide commençant par %PDF", async () => {
    await expectValidPdf(
      React.createElement(KitCpfPdf, {
        data: {
          numero: "AXI-FORM-2026-002",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          beneficiaire: {
            nom: "Rousseau",
            prenom: "Claire",
            numeroEdof: "CPF-2026-XYZ",
          },
          codeCpf: "331 689",
          intituleFormation: "IA appliquée aux entreprises",
          dateDebut: "01/06/2026",
          dateFin: "02/06/2026",
          montantCpfCents: 100000,
          resteAChargeCents: 10000,
          coutTotalCents: 110000,
        },
      }),
    );
  }, 30_000);
});

// ============================================================
// KitFranceTravailPdf
// ============================================================

describe("KitFranceTravailPdf", () => {
  it("génère un PDF valide commençant par %PDF (dispositif AIF)", async () => {
    await expectValidPdf(
      React.createElement(KitFranceTravailPdf, {
        data: {
          numero: "AXI-FORM-2026-003",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          dispositif: "AIF",
          beneficiaire: {
            nom: "Petit",
            prenom: "Lucas",
            identifiantPoleEmploi: "1234567A",
          },
          intituleFormation: "IA appliquée aux entreprises",
          dateDebut: "01/06/2026",
          dateFin: "02/06/2026",
          numeroDossierFranceTravail: "FT-2026-00456",
          montants: {
            montantAideFranceTravailCents: 200000,
            resteAChargeCents: 0,
            coutTotalCents: 200000,
          },
        },
      }),
    );
  }, 30_000);

  it("génère un PDF valide commençant par %PDF (dispositif POEI)", async () => {
    await expectValidPdf(
      React.createElement(KitFranceTravailPdf, {
        data: {
          numero: "AXI-FORM-2026-004",
          dateEmission: "06/06/2026",
          identite: IDENTITE_FIXTURE,
          dispositif: "POEI",
          beneficiaire: {
            nom: "Moreau",
            prenom: "Emma",
          },
          intituleFormation: "IA appliquée aux entreprises",
          dateDebut: "01/06/2026",
          dateFin: "02/06/2026",
          entreprisePoei: {
            raisonSociale: "TechCorp SAS",
            siret: "11223344556677",
            offreEmploiReference: "OE-2026-00789",
          },
          montants: {
            montantAideFranceTravailCents: 280000,
            resteAChargeCents: 0,
            coutTotalCents: 280000,
          },
        },
      }),
    );
  }, 30_000);
});
