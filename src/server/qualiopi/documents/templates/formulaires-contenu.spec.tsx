/**
 * Tests CONTENU — documents de suivi / formulaires migrés vers les composants
 * partagés (LegalCallout, BulletList, DataTable).
 *
 * Verrouille la présence des mentions RGPD / indicateurs Qualiopi : la migration
 * vers LegalCallout avait initialement laissé du texte composé HORS d'un <Text>
 * (rejeté par @react-pdf, texte perdu) sans que les tests « %PDF » le voient.
 * Ces assertions de contenu empêchent toute régression silencieuse.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { ConvocationPdf, type ConvocationData } from "./convocation";
import { LivretAccueilPdf, type LivretAccueilData } from "./livret-accueil";
import { PositionnementPdf, type PositionnementData } from "./positionnement";
import { GrilleEvaluationPdf, type GrilleEvaluationData } from "./grille-evaluation";
import { SatisfactionPdf, type SatisfactionData } from "./satisfaction";
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
  referentHandicapEmail: "handicap@axion-ia.fr",
  dpoEmail: "dpo@axion-ia.fr",
};

describe("PositionnementPdf — contenu", () => {
  const data: PositionnementData = {
    numero: "POS-2026-001",
    intituleFormation: "IA Générative",
    dateSession: "10 juin 2026",
    nomStagiaire: "Jean Dupont",
    entreprise: "Dupont & Associés",
  };
  const text = collectPdfTextNormalized(
    React.createElement(PositionnementPdf, { data, identite: IDENTITE }),
  );
  it("conserve la mention RGPD + l'email DPO (texte non perdu par LegalCallout)", () => {
    expect(text).toContain("RGPD");
    expect(text).toContain("dpo@axion-ia.fr");
  });
});

describe("SatisfactionPdf — contenu", () => {
  const data: SatisfactionData = {
    numero: "SAT-2026-001",
    intituleFormation: "IA Générative",
    dateSession: "10 juin 2026",
  };
  const text = collectPdfTextNormalized(
    React.createElement(SatisfactionPdf, { data, identite: IDENTITE }),
  );
  // 🔴 L'assertion était `toContain("31")` — et le pied de page porte le
  // téléphone « +33743331201 », qui contient « 31 ». Le test passait donc sans
  // rien vérifier, et n'a pas vu que le questionnaire citait l'indicateur 31
  // (traitement des réclamations) au lieu du 30 (recueil des appréciations).
  // On asserte désormais la mention ENTIÈRE, et l'absence de l'ancienne.
  it("cite l'indicateur 30 — recueil des appréciations — et pas le 31", () => {
    expect(text).toContain("Indicateur Qualiopi n°30");
    expect(text).toContain("Indicateur 30");
    expect(text).not.toContain("Indicateur Qualiopi n°31");
    expect(text).toContain("RGPD");
  });
});

describe("ConvocationPdf — contenu", () => {
  const data: ConvocationData = {
    numero: "CONV-2026-001",
    intituleFormation: "IA Générative",
    dateDebut: "10 juin 2026",
    dateFin: "10 juin 2026",
    horaires: "09h00–17h00",
    dureeHeures: 7,
    modalite: "distanciel",
    lienVisio: "https://zoom.us/j/1",
    idReunion: "1",
    nomFormateur: "Sophie Martin",
    contactEmail: "formation@axion-ia.fr",
    nomStagiaire: "Jean Dupont",
    entreprise: "Dupont & Associés",
    financement: "OPCO EP",
    numeroOrdrePriseEnCharge: "OPC-1",
  };
  const text = collectPdfTextNormalized(
    React.createElement(ConvocationPdf, { data, identite: IDENTITE }),
  );
  it("conserve les mentions référent handicap + déclaration d'activité", () => {
    expect(text).toContain(LEGAL_MENTIONS.referentHandicap);
    expect(text).toContain(LEGAL_MENTIONS.declarationActivite);
  });

  it("avant le NDA : ne prétend JAMAIS que la déclaration est enregistrée", () => {
    // L'en-tête dit « non encore enregistrée » ; imprimer en pied de page
    // « enregistrée auprès du préfet » était contradictoire et faux.
    const t = collectPdfTextNormalized(
      React.createElement(ConvocationPdf, { data, identite: { ...IDENTITE, nda: "" } }),
    );
    expect(t).not.toContain(LEGAL_MENTIONS.declarationActivite);
  });
});

describe("LivretAccueilPdf — véracité des mentions qualité", () => {
  const data: LivretAccueilData = {
    numero: "LA-2026-001",
    estCopie: false,
    contactPedagogique: {
      nomPrenom: "Sophie Lambert",
      email: "sophie@axion-ia.fr",
      telephone: "+33 1 00 00 00 01",
    },
    contactAdministratif: { nomPrenom: "Marc Leblanc", email: "admin@axion-ia.fr" },
    dateVersion: "01/01/2026",
  };

  it("certifié Qualiopi UNIQUEMENT si le numéro est configuré", () => {
    const certifie = collectPdfTextNormalized(
      React.createElement(LivretAccueilPdf, { data, identite: IDENTITE }),
    );
    expect(certifie).toContain("certifié Qualiopi");
  });

  it("sans certification : jamais de fausse revendication", () => {
    // Constaté sur AXI-DOC-2026-006 : « Notre organisme est certifié Qualiopi »
    // imprimé en dur alors que l'organisme ne l'est pas — fausse revendication
    // de certification sur une pièce remise au stagiaire.
    const nonCertifie = collectPdfTextNormalized(
      React.createElement(LivretAccueilPdf, { data, identite: { ...IDENTITE, qualiopi: "" } }),
    );
    expect(nonCertifie).not.toContain("certifié Qualiopi");
    expect(nonCertifie).toContain("référentiel national qualité");
  });
});

describe("GrilleEvaluationPdf — contenu", () => {
  const data: GrilleEvaluationData = {
    numero: "GREV-2026-001",
    intituleFormation: "IA Générative",
    dateEvaluation: "10 juin 2026",
    typeEvaluation: "finale",
    nomFormateur: "Sophie Martin",
    nomStagiaire: "Jean Dupont",
    competences: [
      { libelle: "Comprendre les concepts de l'IA générative", note: 3 },
      { libelle: "Utiliser un outil IA", note: 2, observations: "Progrès notables" },
    ],
    recommandations: "Poursuite recommandée.",
  };
  const text = collectPdfTextNormalized(
    React.createElement(GrilleEvaluationPdf, { data, identite: IDENTITE }),
  );
  it("conserve les compétences, observations et recommandations (DataTable)", () => {
    expect(text).toContain("Comprendre les concepts de l'IA générative");
    expect(text).toContain("Progrès notables");
    expect(text).toContain("Poursuite recommandée.");
  });
});
