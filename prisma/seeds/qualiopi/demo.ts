#!/usr/bin/env tsx
/**
 * Qualiopi — Dossier d'audit de démonstration (T16 · Agent A).
 *
 * Crée un cycle complet de preuves Qualiopi réalistes, idempotent et stub-aware.
 * Toutes les données sont clairement identifiées "DEMO" (numéros AXI-*-DEMO-*,
 * emails @demo.axion-ia.invalid) pour ne jamais polluer la production réelle.
 *
 * Cycle : Client → Devis accepté → Formation publiée → Session réalisée →
 * 2 Stagiaires inscrits + présences → Évaluations finales acquis →
 * Questionnaire satisfaction_chaud + positionnement → Attestation (DocumentGenere) →
 * FactureFormation émise → Réclamation résolue → 3 Veilles →
 * Partenariat actif → Sous-traitant vérifié → Revue direction validée →
 * Appréciations (stagiaire + entreprise).
 *
 * Indicateurs couverts : 5, 8, 11⭐, 12, 17, 19, 21, 22, 23, 24, 25, 27, 30, 31, 32.
 *
 * Usage : `pnpm qualiopi:seed-demo`
 */

import type { PrismaClient } from "../../generated/client";

// ─── Types d'identification stables ─────────────────────────────────────────

/** Données pures construites par buildDemoData() — aucune dépendance DB. */
export interface DemoData {
  client: ClientDemo;
  devis: DevisDemo;
  formation: FormationDemo;
  session: SessionDemo;
  stagiaires: [StagiaireDemo, StagiaireDemo];
  enrollments: [EnrollmentDemo, EnrollmentDemo];
  presences: PresenceDemo[];
  evaluations: EvaluationDemo[];
  questionnaires: QuestionnaireDemo[];
  attestation: AttestationDemo;
  facture: FactureDemo;
  reclamation: ReclamationDemo;
  veilles: [VeilleDemo, VeilleDemo, VeilleDemo];
  partenariat: PartenariatDemo;
  sousTraitant: SousTraitantDemo;
  revueDirection: RevueDirectionDemo;
  appreciations: [AppreciationDemo, AppreciationDemo];
}

export interface ClientDemo {
  numero: string;
  raisonSociale: string;
  siret: string;
  nafCode: string;
  secteur: string;
  taille: "PME";
  contactNom: string;
  contactEmail: string;
  contactTelephone: string;
  contactFonction: string;
  opcoIdentifie: string;
  statut: "client_actif";
}

export interface DevisDemo {
  numero: string;
  lignes: Array<{
    designation: string;
    quantite: number;
    prixUnitaireHtCents: number;
    offreTierId: string;
  }>;
  montantTotalHtCents: number;
  mentionTva: string;
  financementSuggere: string;
  statut: "accepte";
  dateValidite: Date;
  acceptedAt: Date;
}

export interface FormationDemo {
  numero: string;
  titre: string;
  slug: string;
  /** tierId de l'offre à laquelle se rattache la formation. */
  offreTierId: string;
  dureeHeures: number;
  modalite: "presentiel";
  objectifsPedagogiques: Array<{
    id: string;
    verbe: string;
    description: string;
    niveauBloom: string;
  }>;
  programmeDetaille: Array<{
    moduleId: string;
    titre: string;
    dureeMin: number;
    sequences: string[];
  }>;
  methodesPedagogiques: string;
  moyensTechniques: string;
  ressourcesPedagogiques: Array<{ type: string; libelle: string }>;
  seuilReussitePct: number;
  ratioPratiquePct: number;
  statutGeneration: "publie";
  statut: "publie";
  typesActionQualiopi: Array<"classique" | "opco">;
}

export interface SessionDemo {
  numero: string;
  titreSession: string;
  dateDebut: Date;
  dateFin: Date;
  dureeReelleHeures: number;
  modalite: "presentiel";
  financementType: "opco";
  montantHtCents: number;
  opcoStatut: "paiement_recu";
  opcoSubrogation: boolean;
  nbParticipantsPrevus: number;
  nbParticipantsReels: number;
  statut: "realisee";
}

export interface StagiaireDemo {
  nom: string;
  prenom: string;
  email: string;
  entreprise: string;
  fonction: string;
  consentementFormation: boolean;
}

export interface EnrollmentDemo {
  statut: "presente";
  tauxPresencePct: number;
  attestationResultat: "complete";
}

export interface PresenceDemo {
  /** index du stagiaire (0 ou 1) */
  stagiaireIndex: 0 | 1;
  date: Date;
  demiJournee: "matin" | "apres_midi";
  libelle: string;
  dureePrevueMinutes: number;
  dureeRealiseeMinutes: number;
  present: boolean;
  source: "emargement_presentiel";
}

export interface EvaluationDemo {
  stagiaireIndex: 0 | 1;
  type: "initiale" | "finale";
  dateEvaluation: Date;
  scoreObtenu: number;
  scoreMax: number;
  scorePct: number;
  niveauGlobal: "acquis" | "partiellement_acquis" | "non_acquis";
  reussite: boolean;
  competences: Array<{ libelle: string; note: number }>;
}

export interface QuestionnaireDemo {
  stagiaireIndex: 0 | 1;
  type: "positionnement" | "satisfaction_chaud";
  token: string;
  reponses: Record<string, unknown>;
  noteGlobale: number | null;
  reponduAt: Date | null;
}

export interface AttestationDemo {
  numero: string;
  /** index stagiaire pour lequel l'attestation principale est créée (stagiaire 0) */
  stagiaireIndex: 0;
  type: "attestation";
  qrToken: string;
  hashSha256: string;
}

export interface FactureDemo {
  numero: string;
  destinataire: "opco";
  destinataireNom: string;
  montantHtCents: number;
  lignes: Array<{ designation: string; quantite: number; prixUnitaireHtCents: number }>;
  subrogation: boolean;
  statut: "emise";
  emiseAt: Date;
}

export interface ReclamationDemo {
  numero: string;
  source: "stagiaire";
  reclamantNom: string;
  reclamantEmail: string;
  objet: string;
  description: string;
  gravite: string;
  statut: "resolue";
  dateReception: Date;
  dateReponse: Date;
  reponse: string;
  actionsCorrectives: string;
}

export interface VeilleDemo {
  type: "legale" | "metiers" | "pedagogique";
  source: string;
  titre: string;
  contenu: string;
  dateVeille: Date;
  impact: string;
  actionDecidee: string;
}

export interface PartenariatDemo {
  nom: string;
  type: string;
  objet: string;
  dateDebut: Date;
  actif: boolean;
}

export interface SousTraitantDemo {
  nom: string;
  siret: string;
  nda: string;
  objetPrestation: string;
  verifieDataGouvAt: Date;
  contratSigneAt: Date;
  actif: boolean;
}

export interface RevueDirectionDemo {
  annee: number;
  dateRevue: Date;
  participants: Array<{ nom: string; role: string }>;
  indicateursSnapshot: Record<string, unknown>;
  decisions: Array<{ decision: string; echeance: string }>;
  planActions: Array<{ action: string; responsable: string; echeance: string; statut: string }>;
  statut: string;
}

export interface AppreciationDemo {
  source: "stagiaire" | "entreprise";
  note: number;
  commentaire: string;
  dateAppreciation: Date;
}

// ─── Numéros stables (idempotence) ───────────────────────────────────────────

const DEMO = {
  CLIENT: "AXI-CLI-DEMO-001",
  DEVIS: "AXI-DEV-2026-DEMO-001",
  FORMATION: "AXI-FOR-DEMO-001",
  SESSION: "AXI-SES-DEMO-001",
  STAGIAIRE_1_EMAIL: "marie.martin@demo.axion-ia.invalid",
  STAGIAIRE_2_EMAIL: "thomas.dubois@demo.axion-ia.invalid",
  ATTESTATION: "AXI-ATT-DEMO-001",
  ATTESTATION_QR: "DEMO-QR-TOKEN-AXION-IA-2026-001-STABLE-HASH-CHECK-OK",
  FACTURE: "AXI-FAC-2026-DEMO-001",
  RECLAMATION: "AXI-REC-DEMO-001",
  QUESTIONNAIRE_SAT_1: "DEMO-QST-SAT-001-TOKEN-STABLE-AXION",
  QUESTIONNAIRE_SAT_2: "DEMO-QST-SAT-002-TOKEN-STABLE-AXION",
  QUESTIONNAIRE_POS_1: "DEMO-QST-POS-001-TOKEN-STABLE-AXION",
  QUESTIONNAIRE_POS_2: "DEMO-QST-POS-002-TOKEN-STABLE-AXION",
  /** tierId de l'offre « Essentielle » à laquelle se rattache la formation démo */
  OFFRE_TIER_ID: "intervention-essentielle",
} as const;

// ─── Dates passées stables ────────────────────────────────────────────────────

const SESSION_DATE_DEBUT = new Date("2026-03-10T09:00:00.000Z");
const SESSION_DATE_FIN = new Date("2026-03-10T17:00:00.000Z");
const PRESENCE_DATE = new Date("2026-03-10");

// ─── Construction pure (sans DB) ─────────────────────────────────────────────

/**
 * Construit le jeu de données de démonstration de manière PURE (sans I/O).
 * Testable unitairement sans mock Prisma.
 */
export function buildDemoData(): DemoData {
  // --- Client ------------------------------------------------------------------
  const client: ClientDemo = {
    numero: DEMO.CLIENT,
    raisonSociale: "[DEMO] Innovatech Solutions SAS",
    siret: "12345678901234",
    nafCode: "6201Z",
    secteur: "Informatique et édition de logiciels",
    taille: "PME",
    contactNom: "Legrand",
    contactEmail: "demo.contact@demo.axion-ia.invalid",
    contactTelephone: "0600000001",
    contactFonction: "Directrice des Ressources Humaines",
    opcoIdentifie: "ATLAS",
    statut: "client_actif",
  };

  // --- Devis -------------------------------------------------------------------
  const devis: DevisDemo = {
    numero: DEMO.DEVIS,
    lignes: [
      {
        designation: "[DEMO] Formation IA opérationnelle – Essentielle (7 h) × 8 stagiaires",
        quantite: 1,
        prixUnitaireHtCents: 290000,
        offreTierId: DEMO.OFFRE_TIER_ID,
      },
    ],
    montantTotalHtCents: 290000,
    mentionTva:
      "Exonération de TVA – Article 261-4-4° du CGI (prestation de formation professionnelle continue).",
    financementSuggere: "opco",
    statut: "accepte",
    dateValidite: new Date("2026-02-15T23:59:59.000Z"),
    acceptedAt: new Date("2026-02-10T14:22:00.000Z"),
  };

  // --- Formation ---------------------------------------------------------------
  const formation: FormationDemo = {
    numero: DEMO.FORMATION,
    titre: "[DEMO] Formation IA Opérationnelle — Essentielle",
    slug: "demo-ia-operationnelle-essentielle",
    offreTierId: DEMO.OFFRE_TIER_ID,
    dureeHeures: 7,
    modalite: "presentiel",
    objectifsPedagogiques: [
      {
        id: "obj-1",
        verbe: "Identifier",
        description:
          "Identifier les cas d'usage IA pertinents pour son poste et son secteur d'activité.",
        niveauBloom: "connaissance",
      },
      {
        id: "obj-2",
        verbe: "Utiliser",
        description:
          "Utiliser un modèle de langage (LLM) pour automatiser une tâche récurrente de son quotidien.",
        niveauBloom: "application",
      },
      {
        id: "obj-3",
        verbe: "Évaluer",
        description:
          "Évaluer la pertinence et les limites d'une réponse IA avant intégration dans un processus métier.",
        niveauBloom: "évaluation",
      },
    ],
    programmeDetaille: [
      {
        moduleId: "mod-1",
        titre: "Panorama IA et LLM (1 h 30)",
        dureeMin: 90,
        sequences: [
          "Définitions : IA, ML, GenAI, LLM",
          "Démonstration live : ChatGPT, Claude, Gemini",
          "Quiz repositionnement à chaud",
        ],
      },
      {
        moduleId: "mod-2",
        titre: "Cas d'usage métier par secteur (2 h)",
        dureeMin: 120,
        sequences: [
          "Bibliothèque de 30 cas d'usage filtrée par secteur",
          "Atelier : identification de 3 cas prioritaires",
          "Grille d'évaluation ROI simplifié",
        ],
      },
      {
        moduleId: "mod-3",
        titre: "Prompting efficace et limites (2 h 30)",
        dureeMin: 150,
        sequences: [
          "Technique APE : Acte, Précisions, Enrichissements",
          "Ateliers pratiques supervisés",
          "Discussion éthique, hallucinations et vérification",
        ],
      },
      {
        moduleId: "mod-4",
        titre: "Plan d'action individuel (1 h)",
        dureeMin: 60,
        sequences: [
          "Rédaction fiche action × stagiaire",
          "Revue collective et engagement",
          "Évaluation finale des acquis",
        ],
      },
    ],
    methodesPedagogiques:
      "Pédagogie active alternant exposés courts (≤ 20 min), démonstrations en conditions réelles, " +
      "ateliers pratiques sur cas métier du client, quiz de repositionnement, débriefing collectif. " +
      "Ratio pratique ≥ 60 % du temps.",
    moyensTechniques:
      "Salle équipée vidéoprojecteur Full-HD, connexion Wi-Fi haut-débit, poste stagiaire (PC/Mac), " +
      "accès aux plateformes IA (Claude, ChatGPT) via navigateur. Support numérique remis J+1.",
    ressourcesPedagogiques: [
      { type: "livret_stagiaire", libelle: "Livret stagiaire PDF — Formation IA Essentielle v2.1" },
      { type: "slides", libelle: "Diaporama formateur 64 diapositives" },
      { type: "fiche_action", libelle: "Fiche action individuelle post-formation" },
    ],
    seuilReussitePct: 70,
    ratioPratiquePct: 65,
    statutGeneration: "publie",
    statut: "publie",
    typesActionQualiopi: ["classique", "opco"],
  };

  // --- Session -----------------------------------------------------------------
  const session: SessionDemo = {
    numero: DEMO.SESSION,
    titreSession: "[DEMO] Formation IA Essentielle – Innovatech Solutions – 10 mars 2026",
    dateDebut: SESSION_DATE_DEBUT,
    dateFin: SESSION_DATE_FIN,
    dureeReelleHeures: 7,
    modalite: "presentiel",
    financementType: "opco",
    montantHtCents: 290000,
    opcoStatut: "paiement_recu",
    opcoSubrogation: true,
    nbParticipantsPrevus: 8,
    nbParticipantsReels: 2,
    statut: "realisee",
  };

  // --- Stagiaires --------------------------------------------------------------
  const stagiaires: [StagiaireDemo, StagiaireDemo] = [
    {
      nom: "Martin",
      prenom: "Marie",
      email: DEMO.STAGIAIRE_1_EMAIL,
      entreprise: "[DEMO] Innovatech Solutions SAS",
      fonction: "Chargée de projet digital",
      consentementFormation: true,
    },
    {
      nom: "Dubois",
      prenom: "Thomas",
      email: DEMO.STAGIAIRE_2_EMAIL,
      entreprise: "[DEMO] Innovatech Solutions SAS",
      fonction: "Responsable marketing",
      consentementFormation: true,
    },
  ];

  // --- Enrollments -------------------------------------------------------------
  const enrollments: [EnrollmentDemo, EnrollmentDemo] = [
    {
      statut: "presente",
      tauxPresencePct: 100,
      attestationResultat: "complete",
    },
    {
      statut: "presente",
      tauxPresencePct: 100,
      attestationResultat: "complete",
    },
  ];

  // --- Présences (matin + après-midi pour chaque stagiaire) -------------------
  const presences: PresenceDemo[] = [
    {
      stagiaireIndex: 0,
      date: PRESENCE_DATE,
      demiJournee: "matin",
      libelle: "2026-03-10 matin",
      dureePrevueMinutes: 210,
      dureeRealiseeMinutes: 210,
      present: true,
      source: "emargement_presentiel",
    },
    {
      stagiaireIndex: 0,
      date: PRESENCE_DATE,
      demiJournee: "apres_midi",
      libelle: "2026-03-10 après-midi",
      dureePrevueMinutes: 210,
      dureeRealiseeMinutes: 210,
      present: true,
      source: "emargement_presentiel",
    },
    {
      stagiaireIndex: 1,
      date: PRESENCE_DATE,
      demiJournee: "matin",
      libelle: "2026-03-10 matin",
      dureePrevueMinutes: 210,
      dureeRealiseeMinutes: 210,
      present: true,
      source: "emargement_presentiel",
    },
    {
      stagiaireIndex: 1,
      date: PRESENCE_DATE,
      demiJournee: "apres_midi",
      libelle: "2026-03-10 après-midi",
      dureePrevueMinutes: 210,
      dureeRealiseeMinutes: 210,
      present: true,
      source: "emargement_presentiel",
    },
  ];

  // --- Évaluations des acquis (positionnement initial + éval finale) ----------
  const evaluations: EvaluationDemo[] = [
    // Positionnement initial stagiaire 0
    {
      stagiaireIndex: 0,
      type: "initiale",
      dateEvaluation: new Date("2026-03-10T09:05:00.000Z"),
      scoreObtenu: 4,
      scoreMax: 12,
      scorePct: 33,
      niveauGlobal: "non_acquis",
      reussite: false,
      competences: [
        { libelle: "Identification cas d'usage", note: 1 },
        { libelle: "Utilisation LLM", note: 2 },
        { libelle: "Évaluation réponse IA", note: 1 },
      ],
    },
    // Éval finale stagiaire 0
    {
      stagiaireIndex: 0,
      type: "finale",
      dateEvaluation: new Date("2026-03-10T16:30:00.000Z"),
      scoreObtenu: 11,
      scoreMax: 12,
      scorePct: 92,
      niveauGlobal: "acquis",
      reussite: true,
      competences: [
        { libelle: "Identification cas d'usage", note: 4 },
        { libelle: "Utilisation LLM", note: 4 },
        { libelle: "Évaluation réponse IA", note: 3 },
      ],
    },
    // Positionnement initial stagiaire 1
    {
      stagiaireIndex: 1,
      type: "initiale",
      dateEvaluation: new Date("2026-03-10T09:05:00.000Z"),
      scoreObtenu: 5,
      scoreMax: 12,
      scorePct: 42,
      niveauGlobal: "non_acquis",
      reussite: false,
      competences: [
        { libelle: "Identification cas d'usage", note: 2 },
        { libelle: "Utilisation LLM", note: 2 },
        { libelle: "Évaluation réponse IA", note: 1 },
      ],
    },
    // Éval finale stagiaire 1
    {
      stagiaireIndex: 1,
      type: "finale",
      dateEvaluation: new Date("2026-03-10T16:30:00.000Z"),
      scoreObtenu: 10,
      scoreMax: 12,
      scorePct: 83,
      niveauGlobal: "acquis",
      reussite: true,
      competences: [
        { libelle: "Identification cas d'usage", note: 4 },
        { libelle: "Utilisation LLM", note: 3 },
        { libelle: "Évaluation réponse IA", note: 3 },
      ],
    },
  ];

  // --- Questionnaires ----------------------------------------------------------
  const questionnaires: QuestionnaireDemo[] = [
    {
      stagiaireIndex: 0,
      type: "positionnement",
      token: DEMO.QUESTIONNAIRE_POS_1,
      reponses: {
        attentes: "Automatiser mes comptes-rendus de réunion et ma veille concurrentielle.",
        niveauInitial: "débutant",
        objectifPrioritaire: "gain de temps sur tâches récurrentes",
      },
      noteGlobale: null,
      reponduAt: new Date("2026-03-10T08:50:00.000Z"),
    },
    {
      stagiaireIndex: 0,
      type: "satisfaction_chaud",
      token: DEMO.QUESTIONNAIRE_SAT_1,
      reponses: {
        qualiteContenu: 5,
        pedagogieFormateur: 5,
        rythmePedagogique: 4,
        pertinenceCasUsage: 5,
        commentaireLibre:
          "[DEMO] Formation très opérationnelle, je repars avec un plan d'action concret.",
        recommanderAxion: "oui",
      },
      noteGlobale: 5,
      reponduAt: new Date("2026-03-10T17:10:00.000Z"),
    },
    {
      stagiaireIndex: 1,
      type: "positionnement",
      token: DEMO.QUESTIONNAIRE_POS_2,
      reponses: {
        attentes: "Créer des contenus marketing plus rapidement avec l'IA.",
        niveauInitial: "débutant",
        objectifPrioritaire: "création de contenus",
      },
      noteGlobale: null,
      reponduAt: new Date("2026-03-10T08:52:00.000Z"),
    },
    {
      stagiaireIndex: 1,
      type: "satisfaction_chaud",
      token: DEMO.QUESTIONNAIRE_SAT_2,
      reponses: {
        qualiteContenu: 4,
        pedagogieFormateur: 5,
        rythmePedagogique: 4,
        pertinenceCasUsage: 4,
        commentaireLibre:
          "[DEMO] Bonne progression, j'aurais aimé plus de temps sur le prompting avancé.",
        recommanderAxion: "oui",
      },
      noteGlobale: 4,
      reponduAt: new Date("2026-03-10T17:15:00.000Z"),
    },
  ];

  // --- Attestation (stagiaire 0) -----------------------------------------------
  const attestation: AttestationDemo = {
    numero: DEMO.ATTESTATION,
    stagiaireIndex: 0,
    type: "attestation",
    qrToken: DEMO.ATTESTATION_QR,
    hashSha256: "a".repeat(64), // hash fictif stable pour la démo
  };

  // --- Facture -----------------------------------------------------------------
  const facture: FactureDemo = {
    numero: DEMO.FACTURE,
    destinataire: "opco",
    destinataireNom: "[DEMO] ATLAS – OPCO des entreprises de croissance",
    montantHtCents: 290000,
    lignes: [
      {
        designation:
          "[DEMO] Formation IA Opérationnelle Essentielle – 7 h × 8 stagiaires – Session 10/03/2026",
        quantite: 1,
        prixUnitaireHtCents: 290000,
      },
    ],
    subrogation: true,
    statut: "emise",
    emiseAt: new Date("2026-03-11T09:00:00.000Z"),
  };

  // --- Réclamation (résolue) ---------------------------------------------------
  const reclamation: ReclamationDemo = {
    numero: DEMO.RECLAMATION,
    source: "stagiaire",
    reclamantNom: "Petit Jean-Claude",
    reclamantEmail: "jean-claude.petit@demo.axion-ia.invalid",
    objet: "[DEMO] Support de formation non reçu à l'issue de la session",
    description:
      "Le livret stagiaire promis en J+1 n'a pas été reçu à J+3. " +
      "Le stagiaire n'a pas reçu le lien de téléchargement par email.",
    gravite: "mineure",
    statut: "resolue",
    dateReception: new Date("2026-03-13T10:00:00.000Z"),
    dateReponse: new Date("2026-03-13T15:30:00.000Z"),
    reponse:
      "[DEMO] Nous présentons nos excuses pour ce manquement. " +
      "Le livret stagiaire a été transmis manuellement le 13/03/2026 à 15h30. " +
      "Le stagiaire a confirmé réception.",
    actionsCorrectives:
      "[DEMO] Action corrective : automatisation de l'envoi du livret via BullMQ job " +
      "déclenché à la clôture de la session. Mise en place d'une alerte J+1 si pièce jointe non envoyée.",
  };

  // --- Veilles (légale / métiers / pédagogique) --------------------------------
  const veilles: [VeilleDemo, VeilleDemo, VeilleDemo] = [
    {
      type: "legale",
      source: "[DEMO] DREETS – Décret n°2026-000 du 05/01/2026",
      titre: "[DEMO] Mise à jour du référentiel national qualité Qualiopi V3",
      contenu:
        "Publication du décret d'application actualisant les 22 indicateurs du référentiel " +
        "qualité Qualiopi, avec introduction d'un indicateur 33 sur la traçabilité IA. " +
        "Entrée en vigueur : 01/07/2026.",
      dateVeille: new Date("2026-01-07T00:00:00.000Z"),
      impact:
        "Nécessité de réviser nos formulaires de collecte et d'intégrer la mention IA Act " +
        "dans les supports de formation générés par IA.",
      actionDecidee:
        "[DEMO] Mise à jour du registre IA Act (ADR 0024) et des templates DocumentGenere. " +
        "Revue de direction Q1 informée. Délai : 01/04/2026.",
    },
    {
      type: "metiers",
      source: "[DEMO] Étude France Compétences – Évolution des métiers numériques 2026",
      titre: "[DEMO] IA générative : adoption accélérée dans les PME françaises",
      contenu:
        "75 % des PME de moins de 50 salariés envisagent un programme de formation IA en 2026. " +
        "Les fonctions RH, marketing et direction sont les plus demandeuses. " +
        "Budget formation moyen alloué : 4 200 € / salarié / an (+35 % vs 2025).",
      dateVeille: new Date("2026-02-14T00:00:00.000Z"),
      impact:
        "Opportunité de renforcer notre catalogue sur les usages RH et marketing IA. " +
        "Cibler les ETI pour des formations sur-mesure multi-sites.",
      actionDecidee:
        "[DEMO] Création d'une offre spécialisée « IA & RH » et « IA & Marketing » planifiée " +
        "pour Q3 2026. Portée au catalogue officiel après validation Formation Engine.",
    },
    {
      type: "pedagogique",
      source: "[DEMO] Revue Ingénierie Pédagogique n°42 – Mars 2026",
      titre: "[DEMO] Méthode Feynman appliquée à la formation IA : retours d'expérience",
      contenu:
        "Étude sur 12 OF : l'intégration de la technique Feynman (expliquer pour apprendre) " +
        "dans les ateliers IA augmente de 28 % le score de mémorisation J+30. " +
        "Recommande l'ajout d'une séquence « je réexplique » en fin de module.",
      dateVeille: new Date("2026-03-01T00:00:00.000Z"),
      impact:
        "Notre ratio pratique actuel (65 %) pourrait être enrichi d'une séquence Feynman " +
        "en fin de module 3 (prompting) sans allonger la durée.",
      actionDecidee:
        "[DEMO] Intégration d'une séquence Feynman 10 min dans le module 3 dès la prochaine " +
        "version du programme (v2.2). Validé par le formateur référent.",
    },
  ];

  // --- Partenariat -------------------------------------------------------------
  const partenariat: PartenariatDemo = {
    nom: "[DEMO] Association Numérique Inclusif Île-de-France",
    type: "réseau handicap / inclusion numérique",
    objet:
      "[DEMO] Convention de partenariat pour l'orientation et l'accompagnement des stagiaires " +
      "en situation de handicap vers des formations numériques adaptées. " +
      "Mise en réseau avec notre référent handicap.",
    dateDebut: new Date("2026-01-01T00:00:00.000Z"),
    actif: true,
  };

  // --- Sous-traitant -----------------------------------------------------------
  const sousTraitant: SousTraitantDemo = {
    nom: "[DEMO] Expertia Formation SARL",
    siret: "98765432100018",
    nda: "BJ-2025-12345",
    objetPrestation:
      "[DEMO] Prestation d'animation ponctuelle pour les formations IA avancées " +
      "(spécialité Data Science et MLOps). Contrat de sous-traitance cadre signé 15/01/2026.",
    verifieDataGouvAt: new Date("2026-01-16T10:00:00.000Z"),
    contratSigneAt: new Date("2026-01-15T14:00:00.000Z"),
    actif: true,
  };

  // --- Revue de direction ------------------------------------------------------
  const revueDirection: RevueDirectionDemo = {
    annee: 2026,
    dateRevue: new Date("2026-01-20T09:00:00.000Z"),
    participants: [
      { nom: "Will Axion", role: "Direction générale" },
      { nom: "Référent qualité", role: "Responsable qualité Qualiopi" },
      { nom: "Formateur principal", role: "Formateur référent" },
    ],
    indicateursSnapshot: {
      tauxSatisfaction: 4.6,
      tauxReussite: 87,
      tauxPresenceMoyen: 96,
      nbSessionsRealisees: 24,
      nbReclamationsAnnee: 3,
      nbReclamationsResolues: 3,
      nbVeillesAnnee: 12,
      niveauConformiteQualiopi: "conforme",
    },
    decisions: [
      {
        decision:
          "[DEMO] Renforcement du catalogue : création de 2 nouvelles formations spécialisées (IA & RH, IA & Marketing) pour Q3 2026.",
        echeance: "2026-09-01",
      },
      {
        decision:
          "[DEMO] Mise à jour du référentiel pédagogique suite à la veille Feynman : intégration séquence 10 min dans module 3.",
        echeance: "2026-04-15",
      },
      {
        decision:
          "[DEMO] Déploiement du portail stagiaire en ligne (attestations, satisfaction, RGPD) : objectif T2 2026.",
        echeance: "2026-06-30",
      },
    ],
    planActions: [
      {
        action: "[DEMO] Réviser les templates DocumentGenere pour mention IA Act",
        responsable: "Référent qualité",
        echeance: "2026-04-01",
        statut: "en_cours",
      },
      {
        action: "[DEMO] Publier 2 nouvelles offres Formation Engine",
        responsable: "Formateur principal",
        echeance: "2026-09-01",
        statut: "planifiee",
      },
      {
        action: "[DEMO] Déployer portail stagiaire",
        responsable: "Direction générale",
        echeance: "2026-06-30",
        statut: "planifiee",
      },
    ],
    statut: "valide",
  };

  // --- Appréciations -----------------------------------------------------------
  const appreciations: [AppreciationDemo, AppreciationDemo] = [
    {
      source: "stagiaire",
      note: 5,
      commentaire:
        "[DEMO] Formation remarquable. Je repars avec un plan d'action concret et des outils que j'utilise dès le lendemain.",
      dateAppreciation: new Date("2026-03-10T17:30:00.000Z"),
    },
    {
      source: "entreprise",
      note: 5,
      commentaire:
        "[DEMO] Excellent retour de nos collaborateurs. Le formateur Axion-IA a su adapter le contenu à nos enjeux métier spécifiques.",
      dateAppreciation: new Date("2026-03-17T10:00:00.000Z"),
    },
  ];

  return {
    client,
    devis,
    formation,
    session,
    stagiaires,
    enrollments,
    presences,
    evaluations,
    questionnaires,
    attestation,
    facture,
    reclamation,
    veilles,
    partenariat,
    sousTraitant,
    revueDirection,
    appreciations,
  };
}

// ─── Persistance DB (idempotente) ─────────────────────────────────────────────

/**
 * Persiste le jeu de données démo en base.
 * Idempotent : tous les upserts se basent sur des identifiants stables.
 * Stub-aware : no-op si DATABASE_URL contient "stub.invalid".
 */
export async function persistDemo(prisma: PrismaClient): Promise<void> {
  // Guard stub-aware
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[qualiopi:seed-demo] Environnement stub détecté — no-op.");
    return;
  }

  const data = buildDemoData();

  // 1. Upsert OffreSite si absente (la formation démo doit pouvoir se rattacher)
  //    On tente un findFirst — si l'offre n'existe pas, on en crée une minimale DEMO.
  let offreSite = await prisma.offreSite.findUnique({
    where: { tierId: data.formation.offreTierId },
  });
  if (!offreSite) {
    offreSite = await prisma.offreSite.upsert({
      where: { tierId: data.formation.offreTierId },
      update: {},
      create: {
        code: "AXI-OFF-DEMO-001",
        tierId: data.formation.offreTierId,
        titreFr: "[DEMO] Essentielle",
        slug: "demo-essentielle",
        categorie: "intervention",
        formatPedagogique: "collectif_1jour",
        publicViseFr: "[DEMO] Équipes découvrant l'IA opérationnelle.",
        dureeHeuresMin: 6,
        dureeHeuresMax: 8,
        modalites: ["presentiel", "distanciel", "hybride"],
        tarifType: "a_partir_de",
        promessePrincipaleFr: "[DEMO] Maîtriser les usages IA opérationnels en une journée.",
        nbModulesMin: 3,
        nbModulesMax: 5,
        anglePedagogiqueFr: "pratique_immersive",
      },
    });
  }

  // 2. Client
  const client = await prisma.client.upsert({
    where: { numero: data.client.numero },
    update: {},
    create: {
      numero: data.client.numero,
      raisonSociale: data.client.raisonSociale,
      siret: data.client.siret,
      nafCode: data.client.nafCode,
      secteur: data.client.secteur,
      taille: data.client.taille,
      contactNom: data.client.contactNom,
      contactEmail: data.client.contactEmail,
      contactTelephone: data.client.contactTelephone,
      contactFonction: data.client.contactFonction,
      opcoIdentifie: data.client.opcoIdentifie,
      statut: data.client.statut,
    },
  });

  // 3. Devis
  const devis = await prisma.devis.upsert({
    where: { numero: data.devis.numero },
    update: {},
    create: {
      numero: data.devis.numero,
      clientId: client.id,
      lignes: data.devis.lignes,
      montantTotalHtCents: data.devis.montantTotalHtCents,
      mentionTva: data.devis.mentionTva,
      financementSuggere: data.devis.financementSuggere,
      statut: data.devis.statut,
      dateValidite: data.devis.dateValidite,
      acceptedAt: data.devis.acceptedAt,
    },
  });

  // 4. Formation
  const formation = await prisma.formation.upsert({
    where: { numero: data.formation.numero },
    update: {},
    create: {
      numero: data.formation.numero,
      titre: data.formation.titre,
      slug: data.formation.slug,
      offreSiteId: offreSite.id,
      clientId: client.id,
      estSurMesure: true,
      dureeHeures: data.formation.dureeHeures,
      modalite: data.formation.modalite,
      objectifsPedagogiques: data.formation.objectifsPedagogiques,
      programmeDetaille: data.formation.programmeDetaille,
      methodesPedagogiques: data.formation.methodesPedagogiques,
      moyensTechniques: data.formation.moyensTechniques,
      ressourcesPedagogiques: data.formation.ressourcesPedagogiques,
      seuilReussitePct: data.formation.seuilReussitePct,
      ratioPratiquePct: data.formation.ratioPratiquePct,
      statutGeneration: data.formation.statutGeneration,
      statut: data.formation.statut,
      typesActionQualiopi: data.formation.typesActionQualiopi,
    },
  });

  // 5. Session
  const session = await prisma.trainingSession.upsert({
    where: { numero: data.session.numero },
    update: {},
    create: {
      numero: data.session.numero,
      titreSession: data.session.titreSession,
      formationId: formation.id,
      clientId: client.id,
      devisId: devis.id,
      dateDebut: data.session.dateDebut,
      dateFin: data.session.dateFin,
      dureeReelleHeures: data.session.dureeReelleHeures,
      modalite: data.session.modalite,
      financementType: data.session.financementType,
      montantHtCents: data.session.montantHtCents,
      opcoStatut: data.session.opcoStatut,
      opcoSubrogation: data.session.opcoSubrogation,
      nbParticipantsPrevus: data.session.nbParticipantsPrevus,
      nbParticipantsReels: data.session.nbParticipantsReels,
      statut: data.session.statut,
    },
  });

  // 6. Stagiaires + Enrollments
  const traineeIds: [string, string] = ["", ""];
  const enrollmentIds: [string, string] = ["", ""];

  for (let i = 0; i < 2; i++) {
    const s = data.stagiaires[i as 0 | 1]!;
    const trainee = await prisma.trainee.upsert({
      where: { email: s.email },
      update: {},
      create: {
        nom: s.nom,
        prenom: s.prenom,
        email: s.email,
        entreprise: s.entreprise,
        fonction: s.fonction,
        consentementFormation: s.consentementFormation,
        consentementAt: new Date("2026-03-05T10:00:00.000Z"),
        consentementVersion: "v1.0",
      },
    });
    traineeIds[i as 0 | 1] = trainee.id;

    const e = data.enrollments[i as 0 | 1]!;
    const enrollment = await prisma.enrollment.upsert({
      where: { sessionId_traineeId: { sessionId: session.id, traineeId: trainee.id } },
      update: {},
      create: {
        sessionId: session.id,
        traineeId: trainee.id,
        statut: e.statut,
        tauxPresencePct: e.tauxPresencePct,
        attestationResultat: e.attestationResultat,
        emargementSigneAt: new Date("2026-03-10T17:05:00.000Z"),
      },
    });
    enrollmentIds[i as 0 | 1] = enrollment.id;
  }

  // 7. Présences
  for (const p of data.presences) {
    const enrollmentId = enrollmentIds[p.stagiaireIndex]!;
    await prisma.presenceCreneau.upsert({
      where: {
        enrollmentId_date_demiJournee: {
          enrollmentId,
          date: p.date,
          demiJournee: p.demiJournee,
        },
      },
      update: {},
      create: {
        enrollmentId,
        date: p.date,
        demiJournee: p.demiJournee,
        libelle: p.libelle,
        dureePrevueMinutes: p.dureePrevueMinutes,
        dureeRealiseeMinutes: p.dureeRealiseeMinutes,
        present: p.present,
        source: p.source,
      },
    });
  }

  // 8. Évaluations des acquis
  // EvaluationAcquis n'a pas d'unique constraint stable → findFirst + create
  for (const ev of data.evaluations) {
    const enrollmentId = enrollmentIds[ev.stagiaireIndex]!;
    const existing = await prisma.evaluationAcquis.findFirst({
      where: {
        enrollmentId,
        type: ev.type,
        dateEvaluation: ev.dateEvaluation,
      },
    });
    if (!existing) {
      await prisma.evaluationAcquis.create({
        data: {
          enrollmentId,
          type: ev.type,
          dateEvaluation: ev.dateEvaluation,
          scoreObtenu: ev.scoreObtenu,
          scoreMax: ev.scoreMax,
          scorePct: ev.scorePct,
          niveauGlobal: ev.niveauGlobal,
          reussite: ev.reussite,
          competences: ev.competences,
        },
      });
    }
  }

  // 9. Questionnaires
  for (const q of data.questionnaires) {
    const enrollmentId = enrollmentIds[q.stagiaireIndex]!;
    await prisma.questionnaire.upsert({
      where: { token: q.token },
      update: {},
      create: {
        enrollmentId,
        type: q.type,
        token: q.token,
        reponses: q.reponses as never,
        ...(q.noteGlobale !== null ? { noteGlobale: q.noteGlobale } : {}),
        ...(q.reponduAt !== null ? { reponduAt: q.reponduAt } : {}),
        envoyeAt: new Date("2026-03-10T17:00:00.000Z"),
      },
    });
  }

  // 10. Attestation (DocumentGenere — stagiaire 0)
  const attestationDoc = await prisma.documentGenere.upsert({
    where: { numero: data.attestation.numero },
    update: {},
    create: {
      numero: data.attestation.numero,
      type: data.attestation.type,
      formationId: formation.id,
      sessionId: session.id,
      traineeId: traineeIds[data.attestation.stagiaireIndex],
      clientId: client.id,
      hashSha256: data.attestation.hashSha256,
      qrToken: data.attestation.qrToken,
      qrTokenCreatedAt: new Date("2026-03-11T09:05:00.000Z"),
      suppressionPrevueAt: new Date("2031-03-11T09:05:00.000Z"),
      metadata: { demo: true, sessionNumero: DEMO.SESSION },
    },
  });

  // Lier l'attestation à l'enrollment du stagiaire 0
  await prisma.enrollment.update({
    where: { id: enrollmentIds[0] },
    data: {
      attestationDocumentId: attestationDoc.id,
      attestationGenereeAt: new Date("2026-03-11T09:05:00.000Z"),
    },
  });

  // 11. Facture
  await prisma.factureFormation.upsert({
    where: { numero: data.facture.numero },
    update: {},
    create: {
      numero: data.facture.numero,
      sessionId: session.id,
      destinataire: data.facture.destinataire,
      destinataireNom: data.facture.destinataireNom,
      montantHtCents: data.facture.montantHtCents,
      tvaExoneree: true,
      lignes: data.facture.lignes,
      subrogation: data.facture.subrogation,
      statut: data.facture.statut,
      emiseAt: data.facture.emiseAt,
      echeanceAt: new Date("2026-04-11T00:00:00.000Z"),
    },
  });

  // 12. Réclamation
  await prisma.reclamation.upsert({
    where: { numero: data.reclamation.numero },
    update: {},
    create: {
      numero: data.reclamation.numero,
      source: data.reclamation.source,
      reclamantNom: data.reclamation.reclamantNom,
      reclamantEmail: data.reclamation.reclamantEmail,
      objet: data.reclamation.objet,
      description: data.reclamation.description,
      gravite: data.reclamation.gravite,
      statut: data.reclamation.statut,
      dateReception: data.reclamation.dateReception,
      dateReponse: data.reclamation.dateReponse,
      reponse: data.reclamation.reponse,
      actionsCorrectives: data.reclamation.actionsCorrectives,
    },
  });

  // 13. Veilles
  for (const v of data.veilles) {
    const existing = await prisma.veille.findFirst({
      where: { titre: v.titre, type: v.type },
    });
    if (!existing) {
      await prisma.veille.create({
        data: {
          type: v.type,
          source: v.source,
          titre: v.titre,
          contenu: v.contenu,
          dateVeille: v.dateVeille,
          impact: v.impact,
          actionDecidee: v.actionDecidee,
        },
      });
    }
  }

  // 14. Partenariat
  const existingPartenariat = await prisma.partenariat.findFirst({
    where: { nom: data.partenariat.nom },
  });
  if (!existingPartenariat) {
    await prisma.partenariat.create({
      data: {
        nom: data.partenariat.nom,
        type: data.partenariat.type,
        objet: data.partenariat.objet,
        dateDebut: data.partenariat.dateDebut,
        actif: data.partenariat.actif,
      },
    });
  }

  // 15. Sous-traitant
  const existingST = await prisma.sousTraitant.findFirst({
    where: { nom: data.sousTraitant.nom },
  });
  if (!existingST) {
    await prisma.sousTraitant.create({
      data: {
        nom: data.sousTraitant.nom,
        siret: data.sousTraitant.siret,
        nda: data.sousTraitant.nda,
        objetPrestation: data.sousTraitant.objetPrestation,
        verifieDataGouvAt: data.sousTraitant.verifieDataGouvAt,
        contratSigneAt: data.sousTraitant.contratSigneAt,
        actif: data.sousTraitant.actif,
      },
    });
  }

  // 16. Revue de direction
  await prisma.revueDirection.upsert({
    where: { annee: data.revueDirection.annee },
    update: {},
    create: {
      annee: data.revueDirection.annee,
      dateRevue: data.revueDirection.dateRevue,
      participants: data.revueDirection.participants as never,
      indicateursSnapshot: data.revueDirection.indicateursSnapshot as never,
      decisions: data.revueDirection.decisions as never,
      planActions: data.revueDirection.planActions as never,
      statut: data.revueDirection.statut,
    },
  });

  // 17. Appréciations
  for (const a of data.appreciations) {
    const traineeId = a.source === "stagiaire" ? traineeIds[0] : undefined;
    const existing = await prisma.appreciation.findFirst({
      where: {
        source: a.source,
        clientId: client.id,
        dateAppreciation: a.dateAppreciation,
      },
    });
    if (!existing) {
      await prisma.appreciation.create({
        data: {
          source: a.source,
          note: a.note,
          commentaire: a.commentaire,
          dateAppreciation: a.dateAppreciation,
          clientId: client.id,
          ...(a.source === "stagiaire" ? { enrollmentId: enrollmentIds[0] } : {}),
          ...(traineeId !== undefined ? { traineeId } : {}),
        },
      });
    }
  }

  console.log(
    "✅ [qualiopi:seed-demo] Cycle complet persité avec succès. " +
      `Client=${DEMO.CLIENT} | Devis=${DEMO.DEVIS} | Formation=${DEMO.FORMATION} | ` +
      `Session=${DEMO.SESSION} | Stagiaires=2 | Attestation=${DEMO.ATTESTATION} | ` +
      `Facture=${DEMO.FACTURE} | Réclamation=${DEMO.RECLAMATION}`,
  );
}

// ─── Point d'entrée CLI ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { PrismaClient } = await import("../../generated/client");
  const prisma = new PrismaClient();
  try {
    await persistDemo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[qualiopi:seed-demo] FATAL:", err);
  process.exitCode = 1;
});
