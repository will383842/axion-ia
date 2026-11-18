/**
 * Jeux de données FIGÉS des cinq gabarits de formation (programme, convocation, attestation,
 * attestation partielle, certificat de réalisation), partagés par :
 *   - `documents-formation-v1-reproductibles.spec.tsx` (la v1 archivée se re-rend à l'octet près) ;
 *   - `documents-formation-v2-charte.spec.tsx` (la v2 courante garde le même texte que la v1).
 *
 * ⛔ Ne JAMAIS modifier une donnée ici : les empreintes de la v1 ont été relevées avec elles.
 * Pour un nouveau cas, en AJOUTER un.
 */

import React from "react";
import type { DocumentProps } from "@react-pdf/renderer";

import type { OrganismeIdentite } from "../../organisme";

export const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "+33 4 00 00 00 00",
  site: "https://www.axion-ia.com",
  referentHandicapNom: "Camille Référent",
  referentHandicapEmail: "handicap@axion-ia.com",
  referentHandicapTelephone: "+33 4 00 00 00 01",
  rcsVille: "Saint-Étienne",
  representantLegalNom: "Alex Dirigeant",
  representantLegalQualite: "Président",
} as OrganismeIdentite;

type Composant = React.ComponentType<never>;
type Fabrique = (C: Composant) => React.ReactElement<DocumentProps>;

const el = (C: Composant, props: Record<string, unknown>): React.ReactElement<DocumentProps> =>
  React.createElement(
    C as unknown as React.ComponentType<Record<string, unknown>>,
    props,
  ) as unknown as React.ReactElement<DocumentProps>;

export interface CasDocument {
  readonly nom: string;
  readonly gabarit:
    "programme" | "convocation" | "attestation" | "attestation_partielle" | "certificat";
  readonly rendre: Fabrique;
}

const PROGRAMME = {
  numero: "AXI-DOC-2026-042",
  intitule: "IA pour bien commencer",
  versionProgramme: "v3",
  dateEdition: "18/11/2026",
  dureeHeures: 14,
  modalite: "Présentiel",
  lieu: "Sur site — 5 rue des Docks, 42000 Saint-Étienne",
  publicVise: "Tout collaborateur, toutes fonctions",
  prerequis: "",
  niveau: "Tous niveaux",
  accessibleHandicap: true,
  objectifs: ["Identifier les cas d'usage de l'IA générative", "Rédiger un prompt efficace"],
  modules: [
    {
      titre: "Module 1 — Comprendre l'IA générative",
      dureeMin: 210,
      sequences: [
        { titre: "Ce que l'IA fait et ne fait pas", dureeMin: 90 },
        { titre: "Cas d'usage du métier", dureeMin: 120 },
      ],
    },
    {
      titre: "Rédiger un prompt efficace",
      dureeMin: null,
      sequences: [{ titre: "Atelier pratique", dureeMin: null }],
    },
  ],
  methodesPedagogiques: "Apports courts, ateliers pratiques et mises en situation.",
  moyensTechniques: "Un ordinateur portable par stagiaire.",
  ressourcesPedagogiques: ["Support de formation remis en PDF", "Grille de prompts"],
  modalitesEvaluation: "Quiz final et mise en situation notée.",
  sanction: "Attestation de fin de formation",
  referentHandicapEmail: "handicap@axion-ia.com",
};

const CONVOCATION = {
  numero: "AXI-DOC-2026-043",
  intituleFormation: "IA pour bien commencer",
  dateDebut: "02/12/2026",
  dateFin: "03/12/2026",
  horaires: "09h00–12h30, 13h30–17h00",
  dureeHeures: 14,
  modalite: "présentiel",
  lieu: "5 rue des Docks, 42000 Saint-Étienne",
  nomFormateur: "Sam Formateur",
  contactEmail: "contact@axion-ia.com",
  contactTelephone: "+33 4 00 00 00 00",
  nomStagiaire: "Dominique Stagiaire",
  entreprise: "SCI Invest Sun",
  financement: "opco",
  numeroOrdrePriseEnCharge: "PC-2026-0042",
  materielAPrevoir: "Un ordinateur portable et son chargeur.",
};

const ATTESTATION = {
  numero: "AXI-ATT-2026-007",
  dateEmission: "04/12/2026",
  identite: IDENTITE,
  beneficiaire: {
    nom: "Stagiaire",
    prenom: "Dominique",
    entreprise: "SCI Invest Sun",
    fonction: "Gérant",
  },
  formation: {
    intitule: "IA pour bien commencer",
    objectifs: "Identifier les cas d'usage ; rédiger un prompt efficace.",
    dureeHeures: 14,
    dateDebut: "02/12/2026",
    dateFin: "03/12/2026",
    modalite: "presentiel",
    formateur: "Sam Formateur",
  },
  resultats: {
    heuresSuivies: 13.5,
    heuresTotales: 14,
    evaluationObtenue: "Acquis",
    competencesAcquises: "Rédiger un prompt efficace ; identifier les cas d'usage.",
    competencesReserves: "Évaluation du module 2 : partiellement acquis.",
  },
  qrToken: "tok_0123456789abcdef",
};

const PARTIELLE = {
  ...ATTESTATION,
  numero: "AXI-ATT-2026-008",
  resultats: {
    heuresSuivies: 9,
    heuresTotales: 14,
    evaluationObtenue: "Partiellement acquis",
    competencesPartiellesValidees: "Identifier les cas d'usage.",
    competencesReserves: "Rédiger un prompt efficace : non évalué.",
  },
};

const CERTIFICAT = {
  numero: "AXI-CERT-2026-003",
  dateEmission: "04/12/2026",
  identite: IDENTITE,
  entreprise: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
  },
  stagiaire: { nom: "Stagiaire", prenom: "Dominique", fonction: "Gérant" },
  intituleAction: "IA pour bien commencer",
  dateDebut: "02/12/2026",
  dateFin: "03/12/2026",
  dureeHeures: 13.5,
  natureAction: "action_formation",
  modalite: "presentiel",
  qrToken: "tok_0123456789abcdef",
};

export const CAS_DOCUMENTS: readonly CasDocument[] = [
  {
    nom: "programme",
    gabarit: "programme",
    rendre: (C) => el(C, { data: PROGRAMME, identite: IDENTITE }),
  },
  {
    nom: "programme sans module ni ressource",
    gabarit: "programme",
    rendre: (C) =>
      el(C, {
        data: {
          ...PROGRAMME,
          numero: "AXI-DOC-2026-044",
          modules: [],
          ressourcesPedagogiques: undefined,
          accessibleHandicap: false,
          objectifs: [],
        },
        identite: IDENTITE,
      }),
  },
  {
    nom: "convocation présentiel",
    gabarit: "convocation",
    rendre: (C) => el(C, { data: CONVOCATION, identite: IDENTITE }),
  },
  {
    nom: "convocation distanciel v2",
    gabarit: "convocation",
    rendre: (C) =>
      el(C, {
        data: {
          ...CONVOCATION,
          numero: "AXI-DOC-2026-045",
          modalite: "distanciel",
          lienVisio: "https://visio.example.org/salle-42",
          idReunion: "123 456 789",
          versionTexte: 2,
          outilVisio: "Visioconférence",
          mentionLienVisio: "Lien envoyé avant la formation",
        },
        identite: IDENTITE,
      }),
  },
  { nom: "attestation", gabarit: "attestation", rendre: (C) => el(C, { data: ATTESTATION }) },
  {
    nom: "attestation partielle",
    gabarit: "attestation_partielle",
    rendre: (C) => el(C, { data: PARTIELLE }),
  },
  {
    nom: "attestation partielle sans heure suivie",
    gabarit: "attestation_partielle",
    rendre: (C) =>
      el(C, {
        data: {
          ...PARTIELLE,
          numero: "AXI-ATT-2026-009",
          resultats: { ...PARTIELLE.resultats, heuresSuivies: 0 },
        },
      }),
  },
  {
    nom: "certificat de réalisation",
    gabarit: "certificat",
    rendre: (C) => el(C, { data: CERTIFICAT }),
  },
];
