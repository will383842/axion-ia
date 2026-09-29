/**
 * Relecture des pièces RÉELLES de `AXI-SESS-2026-001` (2026-09-30), lues comme
 * l'auditeur Qualiopi les lirait. Chaque bloc ferme un défaut constaté SUR LA
 * PIÈCE EN PRODUCTION, pas une hypothèse :
 *
 *  1. « Modalité presentiel » — la valeur brute de l'énumération, sans accent ;
 *  2. « Je soussigné AXION IA SAS certifie que… » — une personne morale ne
 *     soussigne pas ;
 *  3. « Document à conserver 5 ans — Article L.6353-9 » — L.6353-9 porte sur
 *     les informations demandées aux candidats, pas sur la conservation ;
 *  4. citations d'articles abrogés ou étrangers à l'objet de la pièce.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { AttestationPdf, type AttestationData } from "../attestation";
import { AttestationPartiellePdf, type AttestationPartielleData } from "../attestation-partielle";
import {
  CertificatRealisationPdf,
  type CertificatRealisationData,
} from "../certificat-realisation";
import { ConvocationPdf } from "../convocation";
import { EmargementPdf } from "../emargement";
import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import type { OrganismeIdentite } from "../../organisme";
import {
  libelleFinancement,
  libelleModalite,
  libelleModaliteMinuscule,
} from "../../libelles-enumerations";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "AXION IA SAS",
  nda: "84381100438",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "11 avenue Paul Verlaine, 38100 Grenoble",
  adresseExercice: "11 avenue Paul Verlaine, 38100 Grenoble",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
  rcsVille: "Grenoble",
  representantLegalNom: "Williams Jullin",
  representantLegalQualite: "Président",
};

const SANS_NOM: OrganismeIdentite = {
  ...IDENTITE,
  representantLegalNom: "",
  representantLegalQualite: "",
};

// Données telles que `attestation-service.ts` les passait : modalité BRUTE,
// aucun `dirigeant`.
const ATTESTATION: AttestationData = {
  numero: "AXI-ATT-2026-001",
  dateEmission: "30/09/2026",
  identite: IDENTITE,
  beneficiaire: { nom: "Martin", prenom: "Jean" },
  formation: {
    intitule: "IA pour l'immobilier",
    objectifs: "Utiliser l'IA générative",
    dureeHeures: 7,
    dateDebut: "15/09/2026",
    dateFin: "15/09/2026",
    modalite: "presentiel",
    formateur: "Williams Jullin",
  },
  resultats: { heuresSuivies: 7, heuresTotales: 7, competencesAcquises: "Prompt" },
};

const PARTIELLE: AttestationPartielleData = {
  numero: "AXI-ATT-2026-002",
  dateEmission: "30/09/2026",
  identite: IDENTITE,
  beneficiaire: { nom: "Blanc", prenom: "Simone" },
  formation: { ...ATTESTATION.formation, modalite: "hybride" },
  resultats: { heuresSuivies: 3, heuresTotales: 7, competencesPartiellesValidees: "Module 1" },
};

const CERTIFICAT: CertificatRealisationData = {
  numero: "AXI-CERT-2026-001",
  dateEmission: "30/09/2026",
  identite: IDENTITE,
  entreprise: { raisonSociale: "INVEST SUN" },
  stagiaire: { nom: "Martin", prenom: "Jean" },
  intituleAction: "IA pour l'immobilier",
  dateDebut: "15/09/2026",
  dateFin: "15/09/2026",
  dureeHeures: 7,
  modalite: "presentiel",
};

const texte = (el: React.ReactElement) => collectPdfTextNormalized(el);

describe("1. aucune valeur d'énumération brute sur les pièces", () => {
  it("les libellés sont idempotents et gardent l'inconnu visible", () => {
    expect(libelleModalite("presentiel")).toBe("Présentiel");
    expect(libelleModalite("distanciel")).toBe("Distanciel");
    expect(libelleModalite("hybride")).toBe("Mixte");
    expect(libelleModalite("Présentiel")).toBe("Présentiel");
    expect(libelleModaliteMinuscule("presentiel")).toBe("présentiel");
    expect(libelleFinancement("france_travail")).toBe("France Travail");
    expect(libelleFinancement("direct")).toBe("Financement direct (entreprise)");
    expect(libelleFinancement("valeur_inconnue")).toBe("valeur_inconnue");
  });

  it("🔴 l'attestation imprime « Présentiel », jamais « presentiel »", () => {
    const t = texte(<AttestationPdf data={ATTESTATION} />);
    expect(t).toContain("Présentiel");
    expect(t).not.toMatch(/\bpresentiel\b/);
  });

  it("l'attestation partielle imprime « Mixte », jamais « hybride »", () => {
    const t = texte(<AttestationPartiellePdf data={PARTIELLE} />);
    expect(t).toContain("Mixte");
    expect(t).not.toMatch(/\bhybride\b/);
  });

  it("la convocation imprime le financement en clair, jamais « france_travail »", () => {
    const t = texte(
      <ConvocationPdf
        data={{
          numero: "AXI-DOC-2026-010",
          intituleFormation: "IA pour l'immobilier",
          dateDebut: "15/09/2026",
          dateFin: "15/09/2026",
          horaires: "09:00–17:00",
          dureeHeures: 7,
          modalite: "présentiel",
          nomFormateur: "Williams Jullin",
          contactEmail: "contact@axion-ia.com",
          nomStagiaire: "Jean Martin",
          financement: "france_travail",
        }}
        identite={IDENTITE}
      />,
    );
    expect(t).toContain("France Travail");
    expect(t).not.toContain("france_travail");
  });
});

describe("2. une personne morale ne soussigne pas : le représentant légal est nommé", () => {
  it("🔴 attestation : « Je soussigné(e) Williams Jullin, Président d'AXION IA SAS, atteste que »", () => {
    const t = texte(<AttestationPdf data={ATTESTATION} />);
    expect(t).toContain(
      "Je soussigné(e) Williams Jullin, Président d'AXION IA SAS, atteste que Jean Martin",
    );
    expect(t).toContain("Williams Jullin, Président");
    expect(t).not.toContain("soussigné AXION IA SAS");
    expect(t).not.toContain("Le représentant légal : AXION IA SAS");
  });

  it("attestation partielle : même formule, jamais la raison sociale comme signataire", () => {
    const t = texte(<AttestationPartiellePdf data={PARTIELLE} />);
    expect(t).toContain("Je soussigné(e) Williams Jullin, Président d'AXION IA SAS, atteste que");
    expect(t).not.toContain("soussigné AXION IA SAS");
    expect(t).not.toContain("Le représentant légal : AXION IA SAS");
  });

  it("sans nom configuré : « Le représentant légal d'AXION IA SAS atteste », un cadre à compléter", () => {
    const t = texte(<AttestationPdf data={{ ...ATTESTATION, identite: SANS_NOM }} />);
    expect(t).toContain("Le représentant légal d'AXION IA SAS atteste que Jean Martin");
    expect(t).toContain("Nom et qualité du représentant légal");
    expect(t).not.toContain("soussigné AXION IA SAS");
  });

  it("un `dirigeant` égal à la raison sociale (ancien repli) n'est pas pris pour une personne", () => {
    const t = texte(
      <AttestationPdf data={{ ...ATTESTATION, identite: SANS_NOM, dirigeant: "AXION IA SAS" }} />,
    );
    expect(t).not.toContain("soussigné(e) AXION IA SAS");
    expect(t).toContain("Le représentant légal d'AXION IA SAS atteste");
  });

  it("🔴 certificat : la formule du modèle du ministère, signataire nommé avec sa qualité", () => {
    const t = texte(<CertificatRealisationPdf data={CERTIFICAT} />);
    expect(t).toContain(
      "Je soussigné(e) Williams Jullin, représentant légal du dispensateur de l'action concourant au développement des compétences AXION IA SAS, atteste que Jean Martin, salarié(e) de l'entreprise INVEST SUN, a suivi l'action « IA pour l'immobilier »",
    );
    // L'engagement de conservation que porte le modèle officiel.
    expect(t).toContain(
      "je m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement",
    );
    expect(t).toContain("Williams Jullin, Président");
    expect(t).not.toContain("Le représentant légal : AXION IA SAS");
  });
});

describe("3-4. chaque article cité porte bien sur l'objet de la pièce", () => {
  it("🔴 l'émargement ne cite plus L.6353-9 (informations demandées aux candidats)", () => {
    const t = texte(
      <EmargementPdf
        data={{
          numero: "AXI-DOC-2026-011",
          intituleFormation: "IA pour l'immobilier",
          numeroSession: "AXI-SESS-2026-001",
          lieu: "Grenoble",
          nda: "84381100438",
          journees: [],
          totalSignatures: 0,
        }}
        identite={IDENTITE}
      />,
    );
    expect(t).toContain("Document à conserver 5 ans");
    expect(t).not.toContain("L.6353-9");
  });

  it("l'attestation ne cite plus D.6353-1 (contenu de la convention) ni L.6353-1 (la convention)", () => {
    expect(LEGAL_MENTIONS.attestation).not.toContain("D.6353-1");
    expect(LEGAL_MENTIONS.attestation).not.toContain("L.6353-1");
    expect(LEGAL_MENTIONS.attestation).toContain("L.6313-7");
  });

  it("le certificat cite R.6332-26 et l'arrêté du 21 décembre 2018 (contrôle de service fait)", () => {
    expect(LEGAL_MENTIONS.certificatRealisation).toContain("R.6332-26");
    expect(LEGAL_MENTIONS.certificatRealisation).toContain("21 décembre 2018");
  });

  it("le référent handicap n'est plus rattaché à L.6352-3 (règlement intérieur)", () => {
    expect(LEGAL_MENTIONS.referentHandicap).not.toContain("L.6352-3");
    expect(LEGAL_MENTIONS.referentHandicap).toContain("indicateur");
  });
});
