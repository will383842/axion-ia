#!/usr/bin/env tsx
/**
 * Qualiopi — Dossier d'audit de démonstration (T16 · Agent A + T17 · CLUSTER 5 + T18 · Certification + OPCO dossier).
 *
 * Crée un cycle complet de preuves Qualiopi réalistes, idempotent et stub-aware.
 * Toutes les données sont clairement identifiées "DEMO" (numéros AXI-*-DEMO-*,
 * emails @demo.axion-ia.invalid) pour ne jamais polluer la production réelle.
 *
 * Cycle : Client (idcc Syntec) → Devis accepté → Formation publiée certifiante RS
 * (cpfEligible=true, blocsCompétences, edofVerifieAt) → Session réalisée (coFormateur
 * Trainer salarié, barème OPCO PAR DOSSIER) →
 * 2 Stagiaires inscrits + présences → Évaluations finales acquis →
 * Questionnaire satisfaction_chaud + positionnement → Attestation (DocumentGenere) →
 * FactureFormation émise → Réclamation résolue → 3 Veilles →
 * Partenariat actif → Sous-traitant vérifié (screenshotUrl) → Revue direction validée →
 * Appréciations (stagiaire + entreprise + financeur + formateur) →
 * SiteSetting référent handicap → 1 BpfDepense.
 *
 * Indicateurs couverts : 1/2, 5, 8, 10, 11⭐, 12, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32.
 * T18 — Certification RS/RNCP + prise en charge OPCO par dossier.
 *
 * Usage : `pnpm qualiopi:seed-demo`
 */

import type { PrismaClient } from "../../generated/client";
import { hacherToken } from "../../../src/server/qualiopi/tokens/hacher-token";
import {
  STATUT_REVUE_COUVRANTE,
  type StatutRevue,
} from "../../../src/server/qualiopi/registres/statuts-revue";
import { seedGrilleV2 } from "./grille-v2";

// ─── Types d'identification stables ─────────────────────────────────────────

/** Données pures construites par buildDemoData() — aucune dépendance DB. */
export interface DemoData {
  client: ClientDemo;
  devis: DevisDemo;
  formation: FormationDemo;
  session: SessionDemo;
  trainer: TrainerDemo;
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
  appreciations: [AppreciationDemo, AppreciationDemo, AppreciationDemo, AppreciationDemo];
  siteSettings: SiteSettingDemo[];
  moyens: MoyenPedagogiqueDemo[];
  bpfDepense: BpfDepenseDemo;
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
  /** Code IDCC de la convention collective (T18). Ex. 1486 = Syntec / bureaux d'études. */
  idcc: string;
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
  /// "actif" = condition de publication publique (statut !== archive) — cf. getPublicFormationBySlug.
  statut: "actif";
  typesActionQualiopi: Array<"classique" | "opco">;
  /** Indicateurs publiés off.1/2 (T17). */
  indicateursPublies: Array<{ libelle: string; valeur: number; unite: string; annee: number }>;
  methodeCalculIndicateurs: string;
  indicateursPubliesAt: Date;
  // ── T18 — Certification RS/RNCP ───────────────────────────────────────────
  /** Type de certification : "rs" pour Répertoire Spécifique France Compétences. */
  certificationType: "rs";
  /** Code RS (numéro DEMO — jamais un vrai identifiant FC). */
  codeRs: string;
  /** Dénomination du certificateur partenaire (marqué DEMO). */
  certificateurNom: string;
  /** Numéro d'enregistrement France Compétences (marqué DEMO). */
  numeroEnregistrementFc: string;
  /** L'organisme est-il lui-même certificateur ? Non — il est habilité. */
  estCertificateur: false;
  /** Numéro d'habilitation délivré par le certificateur partenaire (DEMO). */
  numeroHabilitation: string;
  /** Date d'enregistrement officielle au RS (passée). */
  dateEnregistrementCertif: Date;
  /** Date d'échéance de l'enregistrement (future — doit rester valide). */
  dateEcheanceCertif: Date;
  /** Blocs de compétences évalués (≥ 1 pour satisfaire computeCpfEligible). */
  blocsCompetences: Array<{ code: string; libelle: string }>;
  /** Date de vérification EDOF (non null → cpfEligible = true). */
  edofVerifieAt: Date;
  /** Calculé via computeCpfEligible — doit être true pour la démo. */
  cpfEligible: true;
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
  // ── T18 — Barème OPCO PAR DOSSIER ─────────────────────────────────────────
  /** Montant de prise en charge relevé : 3 500 centimes = 35,00 €/h (barème ATLAS Syntec). */
  priseEnChargeMontantCents: number;
  /** Unité du barème : euro_heure = €/heure/stagiaire. */
  priseEnChargeUnite: "euro_heure";
  /** Plafond OPCO par formation (centimes). 25 200 = 252,00 € pour 7 h × 2 stag. */
  priseEnChargePlafondFormationCents: number;
  /** Plafond OPCO annuel par salarié (centimes). 350 000 = 3 500,00 €/an. */
  priseEnChargePlafondAnnuelCents: number;
  /** URL source du barème relevé (portail OPCO DEMO). */
  priseEnChargeSourceUrl: string;
  /** Date à laquelle le barème a été relevé sur le portail OPCO. */
  priseEnChargeReleveLe: Date;
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
  /** off.10 : accompagnement/adaptation réalisé au fil de la formation (texte libre, non null → indicateur couvert). */
  adaptationsRealisees?: string;
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
  /** Capture data.gouv.fr archivée (preuve off.27 — T17). */
  screenshotUrl: string;
  screenshotDate: Date;
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
  /**
   * 🔴 2026-09-02 (audit certificateur) — ce champ était `string`, et le seed y
   * écrivait « valide » quand toute l'application lit « validee ». La revue de
   * démonstration existait donc, complète, et ne couvrait RIEN : l'indicateur
   * 32 ⭐ restait rouge et l'écran affichait « Validées 0 » au-dessus d'une
   * ligne « valide ». Le TYPE est désormais la garde — un statut hors liste ne
   * compile plus. C'est la seule garde qu'on ne peut pas oublier d'écrire.
   */
  statut: StatutRevue;
}

export interface AppreciationDemo {
  source: "stagiaire" | "entreprise" | "financeur" | "formateur";
  note: number;
  commentaire: string;
  dateAppreciation: Date;
}

export interface TrainerDemo {
  nom: string;
  prenom: string;
  email: string;
  statut: "salarie";
  cvUrl: string;
  cvUploadedAt: Date;
  actif: boolean;
}

export interface SiteSettingDemo {
  key: string;
  value: string;
  description: string;
  category: "qualiopi";
}

export interface MoyenPedagogiqueDemo {
  categorie: "salle" | "materiel" | "plateforme";
  libelle: string;
  description: string;
  localisation: string;
  actif: boolean;
  /** off.17/18 : dernière vérification d'adéquation/disponibilité (non null → moyen vérifié). */
  dateVerification: Date;
}

export interface BpfDepenseDemo {
  annee: number;
  categorie: string;
  libelle: string;
  montantHtCents: number;
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
  /** Formateur salarié co-animateur (T17 · off.21) */
  TRAINER_EMAIL: "formateur.demo@demo.axion-ia.invalid",
  /** Clés SiteSetting référent handicap (T17 · off.26) */
  SETTING_REFERENT_NOM: "referent_handicap_nom",
  SETTING_REFERENT_EMAIL: "referent_handicap_email",
  SETTING_REFERENT_TEL: "referent_handicap_telephone",
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
    // T18 — IDCC 1486 : Syntec / bureaux d'études (cohérent avec NAF 6201Z + OPCO ATLAS)
    idcc: "1486",
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
    statut: "actif",
    typesActionQualiopi: ["classique", "opco"],
    indicateursPublies: [
      { libelle: "Taux de satisfaction stagiaires", valeur: 92, unite: "%", annee: 2025 },
      { libelle: "Taux de réussite (score ≥ 70 %)", valeur: 87, unite: "%", annee: 2025 },
      { libelle: "Taux de complétion (présence ≥ 80 %)", valeur: 96, unite: "%", annee: 2025 },
    ],
    methodeCalculIndicateurs:
      "[DEMO] Indicateurs calculés sur l'ensemble des sessions réalisées en 2025. " +
      "Satisfaction : moyenne des notes /5 des questionnaires satisfaction_chaud (réponses ≥ 4/5 = satisfait). " +
      "Réussite : proportion de stagiaires ayant obtenu un score ≥ 70 % à l'évaluation finale des acquis. " +
      "Complétion : proportion d'enrollments avec tauxPresencePct ≥ 80 %.",
    indicateursPubliesAt: new Date("2026-01-20T10:00:00.000Z"),
    // ── T18 — Certification RS (France Compétences) ──────────────────────────
    // Numéros DEMO : ne correspondent à aucune certification réelle enregistrée.
    certificationType: "rs",
    codeRs: "RS6203-DEMO",
    certificateurNom: "[DEMO] France Compétences — Certificateur partenaire",
    numeroEnregistrementFc: "FC-DEMO-2026-RS6203",
    estCertificateur: false,
    numeroHabilitation: "HAB-DEMO-AXION-IA-RS6203-001",
    dateEnregistrementCertif: new Date("2024-09-01T00:00:00.000Z"),
    dateEcheanceCertif: new Date("2028-08-31T23:59:59.000Z"),
    blocsCompetences: [
      {
        code: "BC-DEMO-01",
        libelle:
          "[DEMO] Bloc 1 — Identifier et qualifier des cas d'usage IA en contexte professionnel",
      },
      {
        code: "BC-DEMO-02",
        libelle: "[DEMO] Bloc 2 — Concevoir et évaluer des prompts adaptés à des tâches métier",
      },
    ],
    // edofVerifieAt non null + codeRs renseigné + certificationType=rs → computeCpfEligible = true
    edofVerifieAt: new Date("2026-01-15T10:00:00.000Z"),
    cpfEligible: true,
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
    // ── T18 — Barème OPCO PAR DOSSIER (ATLAS · convention Syntec IDCC 1486) ──
    // Source DEMO : portail ATLAS « Numérique & Formation » — relevé fictif.
    priseEnChargeMontantCents: 3500, // 35,00 €/h/stagiaire
    priseEnChargeUnite: "euro_heure",
    // 7 h × 2 stagiaires × 35 €/h = 490 € → plafond formation = 49 000 centimes
    priseEnChargePlafondFormationCents: 49000,
    // Plafond annuel individuel ATLAS Syntec (DEMO) : 3 500 € = 350 000 centimes
    priseEnChargePlafondAnnuelCents: 350000,
    priseEnChargeSourceUrl:
      "https://demo.axion-ia.invalid/preuves/bareme-opco-atlas-syntec-idcc1486-2026-DEMO.pdf",
    priseEnChargeReleveLe: new Date("2026-02-01T09:00:00.000Z"),
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
      // off.10 — adaptation de la prestation aux besoins du stagiaire (accompagnement).
      adaptationsRealisees:
        "[DEMO] Supports remis en amont et rythme adapté au niveau débutant ; " +
        "exercices du module 3 recentrés sur les cas d'usage RH/marketing du stagiaire ; " +
        "temps supplémentaire accordé sur l'atelier prompting.",
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
    screenshotUrl:
      "https://demo.axion-ia.invalid/preuves/data-gouv-screenshot-expertia-20260116.png",
    screenshotDate: new Date("2026-01-16T10:00:00.000Z"),
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
    // 🔴 2026-09-02 (audit certificateur) — ce littéral valait « valide ».
    // Toute l'application lit « validee » : la revue de démonstration existait,
    // portait ses trois décisions et ses trois actions, et ne couvrait RIEN.
    // L'écran affichait « Validées 0 » au-dessus d'une ligne « valide », et
    // l'indicateur 32 ⭐ restait rouge. La valeur est désormais IMPORTÉE.
    statut: STATUT_REVUE_COUVRANTE,
  };

  // --- Appréciations (off.30 : multi-parties) ----------------------------------
  const appreciations: [AppreciationDemo, AppreciationDemo, AppreciationDemo, AppreciationDemo] = [
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
    {
      source: "financeur",
      note: 5,
      commentaire:
        "[DEMO] L'OPCO ATLAS confirme la qualité de la prestation financée. " +
        "Le dossier de subrogation était complet et la facture conforme. " +
        "Partenaire de confiance pour les financements collectifs 2026.",
      dateAppreciation: new Date("2026-03-25T09:00:00.000Z"),
    },
    {
      source: "formateur",
      note: 4,
      commentaire:
        "[DEMO] Animation fluide, groupe très réactif. " +
        "Les supports pédagogiques sont bien adaptés au niveau débutant. " +
        "Suggestion : ajouter 15 min sur l'évaluation des risques IA en module 3.",
      dateAppreciation: new Date("2026-03-11T08:30:00.000Z"),
    },
  ];

  // --- Formateur salarié co-animateur (off.21) ---------------------------------
  const trainer: TrainerDemo = {
    nom: "Durand",
    prenom: "Sophie",
    email: DEMO.TRAINER_EMAIL,
    statut: "salarie",
    cvUrl: "https://demo.axion-ia.invalid/preuves/cv-sophie-durand-formateur-ia-demo.pdf",
    cvUploadedAt: new Date("2026-01-10T09:00:00.000Z"),
    actif: true,
  };

  // --- SiteSettings référent handicap (off.26) ---------------------------------
  const siteSettings: SiteSettingDemo[] = [
    {
      key: DEMO.SETTING_REFERENT_NOM,
      value: "[DEMO] Marie Lambert",
      description: "Nom du référent handicap de l'organisme de formation (off.26 Qualiopi).",
      category: "qualiopi",
    },
    {
      key: DEMO.SETTING_REFERENT_EMAIL,
      value: "referent.handicap@demo.axion-ia.invalid",
      description: "Email du référent handicap (off.26 Qualiopi).",
      category: "qualiopi",
    },
    {
      key: DEMO.SETTING_REFERENT_TEL,
      value: "0600000002",
      description: "Téléphone du référent handicap (off.26 Qualiopi).",
      category: "qualiopi",
    },
  ];

  // --- Inventaire des moyens pédagogiques (off.17/18) --------------------------
  // Une catégorie technique par ligne (salle / matériel / plateforme), toutes
  // ACTIVES et VÉRIFIÉES (dateVerification non null) pour que chaque catégorie
  // utilisée porte au moins un moyen vérifié.
  const MOYEN_VERIF_DATE = new Date("2026-02-20T09:00:00.000Z");
  const moyens: MoyenPedagogiqueDemo[] = [
    {
      categorie: "salle",
      libelle: "[DEMO] Salle de formation équipée — Centre d'affaires Lyon Part-Dieu",
      description: "Salle 25 m², vidéoprojecteur Full-HD, paperboard, mobilier modulable.",
      localisation: "Lyon Part-Dieu (69)",
      actif: true,
      dateVerification: MOYEN_VERIF_DATE,
    },
    {
      categorie: "materiel",
      libelle: "[DEMO] Parc de postes stagiaires (PC/Mac) + Wi-Fi haut-débit",
      description: "8 postes portables, connexion fibre dédiée, casques audio.",
      localisation: "Lyon Part-Dieu (69)",
      actif: true,
      dateVerification: MOYEN_VERIF_DATE,
    },
    {
      categorie: "plateforme",
      libelle: "[DEMO] Accès plateformes IA (Claude, ChatGPT) via navigateur",
      description: "Comptes de démonstration provisionnés pour la durée de la session.",
      localisation: "SaaS",
      actif: true,
      dateVerification: MOYEN_VERIF_DATE,
    },
  ];

  // --- Dépense BPF (T17 · CLUSTER 5) ------------------------------------------
  const bpfDepense: BpfDepenseDemo = {
    annee: 2026,
    categorie: "Locations de salles",
    libelle: "[DEMO] Location salle de formation — Centre d'affaires Lyon Part-Dieu — 10/03/2026",
    montantHtCents: 35000, // 350,00 €
  };

  return {
    client,
    devis,
    formation,
    session,
    trainer,
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
    siteSettings,
    moyens,
    bpfDepense,
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

  // [T17.1 — S8] Auto-suffisance : si aucune grille qualité active (le seed de base
  // `qualiopi:seed` n'a pas été lancé), on la seede pour que le Formation Engine soit
  // opérationnel même si seed-demo est exécuté sur une DB fraîche.
  const grilleActive = await prisma.grilleQualiteConfig.findFirst({ where: { actif: true } });
  if (!grilleActive) {
    console.log("[qualiopi:seed-demo] Aucune grille active — seed de la grille v2…");
    await seedGrilleV2(prisma);
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

  // 2. Client (T18 : idcc ajouté)
  const client = await prisma.client.upsert({
    where: { numero: data.client.numero },
    update: { idcc: data.client.idcc },
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
      idcc: data.client.idcc,
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

  // 4. Formation (avec indicateurs publiés off.1/2 — T17 + certification RS — T18)
  const formation = await prisma.formation.upsert({
    where: { numero: data.formation.numero },
    update: {
      // 🔴 2026-08-21 — CES DEUX CHAMPS MANQUAIENT, ET LE DOSSIER DE
      // DÉMONSTRATION DEVENAIT INVISIBLE.
      //
      // Le wizard de vente ne liste que les formations `statut: "actif"` +
      // `statutGeneration: "publie"` — comme le compteur de conformité et le
      // catalogue. Or la formation de démonstration peut dériver vers
      // `statut: "publie"` (le moteur de génération l'y met), et la branche
      // `update` ne la ramenait pas : relancer `pnpm qualiopi:seed-demo`
      // laissait le dossier en place mais introuvable depuis l'écran de vente.
      //
      // Constaté en base : `AXI-FOR-DEMO-001` en `statut=publie` APRÈS un seed
      // réussi. Le parcours e2e de vente s'en tirait par un `test.skip`
      // silencieux (« Aucune formation publiée — seed incomplet »), donc
      // personne ne l'a jamais vu.
      //
      // 🔑 Un seed idempotent doit ramener À L'ÉTAT VOULU, pas seulement
      // « ne pas échouer ». Ce qu'il omet, il le laisse dériver.
      statut: data.formation.statut,
      statutGeneration: data.formation.statutGeneration,
      indicateursPublies: data.formation.indicateursPublies,
      methodeCalculIndicateurs: data.formation.methodeCalculIndicateurs,
      indicateursPubliesAt: data.formation.indicateursPubliesAt,
      // T18 — certification RS
      certificationType: data.formation.certificationType,
      codeRs: data.formation.codeRs,
      certificateurNom: data.formation.certificateurNom,
      numeroEnregistrementFc: data.formation.numeroEnregistrementFc,
      estCertificateur: data.formation.estCertificateur,
      numeroHabilitation: data.formation.numeroHabilitation,
      dateEnregistrementCertif: data.formation.dateEnregistrementCertif,
      dateEcheanceCertif: data.formation.dateEcheanceCertif,
      blocsCompetences: data.formation.blocsCompetences,
      edofVerifieAt: data.formation.edofVerifieAt,
      cpfEligible: data.formation.cpfEligible,
    },
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
      indicateursPublies: data.formation.indicateursPublies,
      methodeCalculIndicateurs: data.formation.methodeCalculIndicateurs,
      indicateursPubliesAt: data.formation.indicateursPubliesAt,
      // T18 — certification RS (France Compétences — numéros DEMO)
      certificationType: data.formation.certificationType,
      codeRs: data.formation.codeRs,
      certificateurNom: data.formation.certificateurNom,
      numeroEnregistrementFc: data.formation.numeroEnregistrementFc,
      estCertificateur: data.formation.estCertificateur,
      numeroHabilitation: data.formation.numeroHabilitation,
      dateEnregistrementCertif: data.formation.dateEnregistrementCertif,
      dateEcheanceCertif: data.formation.dateEcheanceCertif,
      blocsCompetences: data.formation.blocsCompetences,
      edofVerifieAt: data.formation.edofVerifieAt,
      cpfEligible: data.formation.cpfEligible,
    },
  });

  // 4b. Trainer salarié co-animateur (off.21 — T17)
  const trainer = await prisma.trainer.upsert({
    where: { email: data.trainer.email },
    update: {
      cvUrl: data.trainer.cvUrl,
      cvUploadedAt: data.trainer.cvUploadedAt,
      formationsHabilitees: [formation.id],
    },
    create: {
      nom: data.trainer.nom,
      prenom: data.trainer.prenom,
      email: data.trainer.email,
      statut: data.trainer.statut,
      cvUrl: data.trainer.cvUrl,
      cvUploadedAt: data.trainer.cvUploadedAt,
      formationsHabilitees: [formation.id],
      actif: data.trainer.actif,
    },
  });

  // 5. Session (avec coFormateurs — T17 + barème OPCO par dossier — T18)
  const session = await prisma.trainingSession.upsert({
    where: { numero: data.session.numero },
    update: {
      coFormateurs: [{ trainerId: trainer.id, role: "co_animateur", heuresAnimees: 3.5 }],
      // T18 — barème PAR DOSSIER
      priseEnChargeMontantCents: data.session.priseEnChargeMontantCents,
      priseEnChargeUnite: data.session.priseEnChargeUnite,
      priseEnChargePlafondFormationCents: data.session.priseEnChargePlafondFormationCents,
      priseEnChargePlafondAnnuelCents: data.session.priseEnChargePlafondAnnuelCents,
      priseEnChargeSourceUrl: data.session.priseEnChargeSourceUrl,
      priseEnChargeReleveLe: data.session.priseEnChargeReleveLe,
    },
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
      coFormateurs: [{ trainerId: trainer.id, role: "co_animateur", heuresAnimees: 3.5 }],
      // T18 — barème OPCO PAR DOSSIER (portail ATLAS Syntec IDCC 1486 — DEMO)
      priseEnChargeMontantCents: data.session.priseEnChargeMontantCents,
      priseEnChargeUnite: data.session.priseEnChargeUnite,
      priseEnChargePlafondFormationCents: data.session.priseEnChargePlafondFormationCents,
      priseEnChargePlafondAnnuelCents: data.session.priseEnChargePlafondAnnuelCents,
      priseEnChargeSourceUrl: data.session.priseEnChargeSourceUrl,
      priseEnChargeReleveLe: data.session.priseEnChargeReleveLe,
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
      // off.10 : (re)poser l'adaptation même sur un enrollment démo déjà créé.
      update: {
        ...(e.adaptationsRealisees ? { adaptationsRealisees: e.adaptationsRealisees } : {}),
      },
      create: {
        sessionId: session.id,
        traineeId: trainee.id,
        statut: e.statut,
        tauxPresencePct: e.tauxPresencePct,
        attestationResultat: e.attestationResultat,
        emargementSigneAt: new Date("2026-03-10T17:05:00.000Z"),
        ...(e.adaptationsRealisees ? { adaptationsRealisees: e.adaptationsRealisees } : {}),
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
      // 🔴 `D4-5-S1` — la table ne stocke plus le jeton en clair. Le jeu de
      // démonstration garde ses jetons LISIBLES dans `DEMO.QUESTIONNAIRE_TOKENS`
      // (c'est leur intérêt : on ouvre le lien à la main pour montrer le
      // parcours), et c'est leur EMPREINTE qui va en base — exactement comme un
      // jeton réel.
      where: { tokenHash: hacherToken(q.token) },
      update: {},
      create: {
        enrollmentId,
        type: q.type,
        tokenHash: hacherToken(q.token),
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

  // 15. Sous-traitant (avec screenshotUrl/screenshotDate — T17)
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
        screenshotUrl: data.sousTraitant.screenshotUrl,
        screenshotDate: data.sousTraitant.screenshotDate,
        contratSigneAt: data.sousTraitant.contratSigneAt,
        actif: data.sousTraitant.actif,
      },
    });
  } else {
    // Mettre à jour les champs screenshot si absents (idempotent)
    if (!existingST.screenshotUrl) {
      await prisma.sousTraitant.update({
        where: { id: existingST.id },
        data: {
          screenshotUrl: data.sousTraitant.screenshotUrl,
          screenshotDate: data.sousTraitant.screenshotDate,
        },
      });
    }
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

  // 17. Appréciations (off.30 multi-parties : stagiaire, entreprise, financeur, formateur — T17)
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

  // 18. SiteSettings référent handicap (off.26 — T17)
  for (const s of data.siteSettings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description, category: s.category },
      create: {
        key: s.key,
        value: s.value,
        description: s.description,
        category: s.category,
      },
    });
  }

  // 18b. Inventaire des moyens pédagogiques (off.17/18) — MoyenPedagogique n'a
  //      pas de contrainte unique → findFirst(categorie+libelle) puis create.
  for (const m of data.moyens) {
    const existingMoyen = await prisma.moyenPedagogique.findFirst({
      where: { categorie: m.categorie, libelle: m.libelle },
    });
    if (!existingMoyen) {
      await prisma.moyenPedagogique.create({
        data: {
          categorie: m.categorie,
          libelle: m.libelle,
          description: m.description,
          localisation: m.localisation,
          actif: m.actif,
          dateVerification: m.dateVerification,
        },
      });
    } else if (existingMoyen.dateVerification == null) {
      // Idempotent : garantir un moyen vérifié même si créé auparavant sans date.
      await prisma.moyenPedagogique.update({
        where: { id: existingMoyen.id },
        data: { dateVerification: m.dateVerification },
      });
    }
  }

  // 19. Dépense BPF (T17 · CLUSTER 5) — idempotent par libellé + annee
  const existingDepense = await prisma.bpfDepense.findFirst({
    where: {
      annee: data.bpfDepense.annee,
      libelle: data.bpfDepense.libelle,
    },
  });
  if (!existingDepense) {
    await prisma.bpfDepense.create({
      data: {
        annee: data.bpfDepense.annee,
        categorie: data.bpfDepense.categorie,
        libelle: data.bpfDepense.libelle,
        montantHtCents: data.bpfDepense.montantHtCents,
      },
    });
  }

  // ── L'offre 1-à-1 du dossier de démonstration ───────────────────────────────
  //
  // 🔴 SANS CE BLOC, LE PARCOURS 04 NE MESURE RIEN — et il le déclare en vert.
  //
  // Chaîne mesurée le 2026-08-23. `seedOffresSite` crée les dix offres legacy
  // sans champ `actif`, donc toutes naissent actives (schema.prisma:5426,
  // `@default(true)`). Puis `main()` appelle `runCatalogueCleanup()`
  // (seeds/qualiopi/index.ts:97 pour l'invocation, l'appel à `cleanupCatalogue`
  // étant en :63-64), SANS `includeLegacyOffres`, donc `includeLegacy` vaut
  // `true` (catalogue-cleanup.ts:118) et la garde qui aurait pu les épargner est
  // court-circuitée (:159). Toute offre active dont le slug est hors de
  // `FORMATIONS_V2` — lequel ne contient QUE des formats collectifs
  // (catalog-v2.ts:6949-6976) — et qu'aucune formation vivante ne porte est
  // désactivée (:156-165).
  //
  // Résultat : `pnpm qualiopi:seed` crée les trois offres 1-à-1 puis les éteint
  // dans la même commande. En CI, le tunnel de vente n'en propose donc AUCUNE,
  // et le parcours 04 — « une offre 1-à-1 retire le sélecteur de formation et
  // renvoie vers le parcours de coaching » — s'annonce « non couvert » à chaque
  // exécution. Ses quatre assertions n'ont jamais tourné.
  //
  // 🔑 On répare par la DONNÉE DE DÉMONSTRATION, pas par le nettoyage. Rendre le
  // cleanup indulgent envers les offres legacy en épargnerait DIX — `conference`,
  // `sur-demande` et six collectives redeviendraient vendables au wizard. Ce
  // serait une décision produit, pas un correctif de test.
  //
  // ⚠️ ON NE TOUCHE PAS À `intervention-dirigeants` (AXI-OFF-006) : son extinction
  // est VOULUE, décidée le 2026-06-11 (migration
  // `20260611170000_deactivate_orphan_dirigeants_offre`).
  //
  // ⚠️ On cible par `tierId`, JAMAIS par code `AXI-OFF-NNN` : `offreCode()` alloue
  // par index de tableau (offres.ts:191-193) et `seedOffresSite` ne met jamais à
  // jour une ligne existante (:205-209). Retirer une entrée du milieu décale donc
  // tous les codes suivants d'une base fraîche, sans renuméroter les bases déjà
  // semées — `AXI-OFF-010` ne désigne pas la même offre partout.
  //
  // Ce bloc ne s'exécute QUE dans `qualiopi:seed-demo`, jamais en production :
  // la production ne sème pas.
  const offreUnAUn = await prisma.offreSite.findUnique({
    where: { tierId: "intervention-membre-equipe" },
    select: { id: true, actif: true },
  });
  if (offreUnAUn === null) {
    console.warn(
      "[qualiopi:seed-demo] ⚠️ offre `intervention-membre-equipe` introuvable : " +
        "jouer `pnpm qualiopi:seed` avant. Le parcours 04 se déclarera non couvert.",
    );
  } else if (!offreUnAUn.actif) {
    await prisma.offreSite.update({ where: { id: offreUnAUn.id }, data: { actif: true } });
  }

  console.log(
    "✅ [qualiopi:seed-demo] Cycle complet persité avec succès. " +
      `Client=${DEMO.CLIENT} (IDCC=${data.client.idcc}) | Devis=${DEMO.DEVIS} | ` +
      `Formation=${DEMO.FORMATION} (Certification RS=${data.formation.codeRs} cpfEligible=${data.formation.cpfEligible}) | ` +
      `Session=${DEMO.SESSION} (Barème dossier=${data.session.priseEnChargeMontantCents / 100}€/${data.session.priseEnChargeUnite}) | ` +
      `Stagiaires=2 | Attestation=${DEMO.ATTESTATION} | ` +
      `Facture=${DEMO.FACTURE} | Réclamation=${DEMO.RECLAMATION} | ` +
      `Trainer=${DEMO.TRAINER_EMAIL} | SiteSettings=3 | Moyens=${data.moyens.length} | BpfDepense=1 | Appréciations=4 | ` +
      `Offre1a1=${offreUnAUn === null ? "ABSENTE" : "active"}`,
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
