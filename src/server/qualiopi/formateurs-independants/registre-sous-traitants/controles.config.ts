/**
 * Qualiopi ind. 27 — la MÉTHODE DE CONTRÔLE des sous-traitants indépendants, en UN
 * fichier. Non-conformité majeure de l'audit du 16/10 : la procédure ne disait pas
 * comment on contrôle. L'outil le dit ici, et c'est ce fichier qu'il applique.
 *
 * ⚠️ PROVISOIRE : la procédure de sous-traitance v2 est réécrite à part. Changer un
 * contrôle se fait ici, et nulle part ailleurs : les échéances, l'écran, l'export et les
 * alertes lisent cette liste.
 *
 * 🔑 Aucun nombre neuf. Les durées sont celles qui existent déjà et que l'on nomme : la
 * validité légale de l'attestation URSSAF (`lib/vigilance.ts`), la fraîcheur d'un
 * contrôle du registre (`controle-regles.ts`), « annuelle » (un an). Seul le préavis des
 * alertes (J-30) est posé ici, comme demandé.
 *
 * Module pur : aucun import Prisma ni Next.
 */

import { VIGILANCE_VALIDITE_MOIS } from "@/lib/vigilance";
import type { TrainerDocumentTypeValue } from "@/server/qualiopi/trainers/conformite";

/** Une pièce à échéance l'est à J-30 : l'alerte part avant, pas le jour même. */
export const ALERTE_AVANT_ECHEANCE_JOURS = 30;

// ─── Seuils de l'indicateur 27 — RÉGLAGES (⚠️ à valider par Will) ────────────
//
// Ce sont des DÉFAUTS : la valeur appliquée est celle du réglage modifiable en console
// (`/qualiopi/config`, clés `sous_traitance_*` de `config/registry.ts`, lue par
// `reglages.ts`). Aucun lecteur ne les recopie en dur.

/** ⚠️ À valider par Will — défauts des réglages ind. 27. */
export const REGLAGES_IND27_DEFAUTS = {
  /** Un écart MINEUR ouvre un plan de correction à échéance J+15. */
  delaiCorrectionJours: 15,
  /** La revue COMPLÈTE revient tous les douze mois. */
  revueCompleteMois: 12,
} as const;

export interface ReglagesInd27 {
  readonly delaiCorrectionJours: number;
  readonly revueCompleteMois: number;
}

/**
 * Gravité d'une preuve manquante.
 * - `majeur` : le sous-traitant est SUSPENDU (nouvelles missions refusées par la garde
 *   de mission) jusqu'à une levée motivée en console ;
 * - `mineur` : un plan de correction s'ouvre, échéance J+`delaiCorrectionJours`, alerte
 *   à l'échéance.
 */
export type GraviteEcart = "majeur" | "mineur";

export interface PreuveAttendue {
  readonly code: string;
  readonly libelle: string;
  readonly gravite: GraviteEcart;
}

/**
 * ⚠️ À valider par Will — les preuves attendues à CHAQUE MISSION d'un sous-traitant
 * indépendant, cochées une à une et tracées. L'émargement absent est un écart majeur.
 */
export const PREUVES_MISSION = [
  {
    code: "lettre_mission_signee",
    libelle: "Lettre de mission signée par le formateur",
    gravite: "majeur",
  },
  {
    code: "emargement",
    libelle: "Émargements (ou relevé de connexion) complets pour chaque demi-journée",
    gravite: "majeur",
  },
  {
    code: "pieces_legales_a_jour",
    libelle: "Pièces légales exigées valables à la date de la mission",
    gravite: "majeur",
  },
  {
    code: "supports_remis",
    libelle: "Supports pédagogiques remis et conformes au programme",
    gravite: "mineur",
  },
  {
    code: "evaluations_recueillies",
    libelle: "Évaluations des stagiaires recueillies",
    gravite: "mineur",
  },
  {
    code: "bilan_formateur",
    libelle: "Bilan de fin de formation du formateur déposé",
    gravite: "mineur",
  },
] as const satisfies ReadonlyArray<PreuveAttendue>;

/** ⚠️ À valider par Will — les preuves de la REVUE COMPLÈTE annuelle. */
export const PREUVES_REVUE_COMPLETE = [
  {
    code: "pieces_legales_a_jour",
    libelle: "Toutes les pièces légales exigées sont valables",
    gravite: "majeur",
  },
  {
    code: "registre_public_actif",
    libelle: "Entreprise active et NDA présent sur la liste publique",
    gravite: "majeur",
  },
  {
    code: "emargements_de_l_annee",
    libelle: "Émargements de toutes les missions de l'année présents",
    gravite: "majeur",
  },
  {
    code: "incidents_traites",
    libelle: "Incidents et réclamations de l'année traités",
    gravite: "mineur",
  },
  {
    code: "appreciations_relues",
    libelle: "Appréciations des stagiaires relues",
    gravite: "mineur",
  },
  {
    code: "maintien_decide",
    libelle: "Maintien de la collaboration décidé et motivé",
    gravite: "mineur",
  },
] as const satisfies ReadonlyArray<PreuveAttendue>;

/** QUAND un contrôle est dû. */
export type QuandControle =
  /** Une fois, à l'entrée au registre ; fait seulement par un résultat conforme. */
  | { readonly sorte: "a_l_entree" }
  /** À l'échéance de chaque pièce exigée (les alertes de pièce portent le retard). */
  | { readonly sorte: "a_l_echeance_des_pieces" }
  /** À la fraîcheur d'un contrôle du registre public (celle de la garde de mission). */
  | { readonly sorte: "fraicheur_du_registre" }
  /** Un an après l'entrée, puis un an après la dernière revue (réglage `revueCompleteMois`). */
  | { readonly sorte: "annuelle" }
  /** À chaque mission, par la liste des preuves attendues (`PREUVES_MISSION`). */
  | { readonly sorte: "a_chaque_mission" };

export interface ControleSousTraitance {
  /** Code stable, écrit sur chaque trace (`controles_sous_traitants.code`). */
  readonly code: string;
  readonly libelle: string;
  readonly quoi: string;
  readonly quand: QuandControle;
  readonly qui: string;
  /**
   * Contrôle à PREUVES : il se trace par sa liste, cochée une à une, jamais par un
   * résultat saisi. Les preuves manquantes ouvrent des écarts (majeur, mineur).
   */
  readonly preuves?: ReadonlyArray<PreuveAttendue>;
}

export const CONTROLES_SOUS_TRAITANCE = [
  {
    code: "pieces_entree",
    libelle: "Pièces légales à l'entrée",
    quoi: "Avis de situation SIRENE ou KBIS, numéro de déclaration d'activité (pièce ou récépissé), attestation de vigilance URSSAF si le seuil est atteint, RC pro si elle est exigée.",
    quand: { sorte: "a_l_entree" },
    qui: "L'administrateur qui vérifie le dossier",
  },
  {
    code: "pieces_validite",
    libelle: "Pièces selon leur validité",
    quoi: "Chaque pièce exigée est renouvelée avant son échéance (date portée par la pièce ; six mois après émission pour l'attestation URSSAF).",
    quand: { sorte: "a_l_echeance_des_pieces" },
    qui: "L'administrateur, sur relance de l'outil",
  },
  {
    code: "registre_public",
    libelle: "Recontrôle du registre public",
    quoi: "Entreprise toujours active au registre des entreprises et numéro de déclaration d'activité toujours présent sur la liste publique des organismes de formation.",
    quand: { sorte: "fraicheur_du_registre" },
    qui: "La tâche de fond (contrôle registre périodique), à défaut l'administrateur",
  },
  {
    code: "revue_annuelle",
    libelle: "Revue complète annuelle",
    quoi: "Relecture complète du sous-traitant, preuve par preuve : pièces, registre public, émargements, incidents, appréciations et maintien de la collaboration.",
    quand: { sorte: "annuelle" },
    qui: "La direction",
    preuves: PREUVES_REVUE_COMPLETE,
  },
  {
    code: "controle_mission",
    libelle: "Contrôle de chaque mission",
    quoi: "Après chaque mission, les preuves attendues sont cochées une à une : lettre de mission, émargements, pièces légales, supports, évaluations, bilan.",
    quand: { sorte: "a_chaque_mission" },
    qui: "L'administrateur qui clôt la mission",
    preuves: PREUVES_MISSION,
  },
] as const satisfies ReadonlyArray<ControleSousTraitance>;

export type CodeControle = (typeof CONTROLES_SOUS_TRAITANCE)[number]["code"];

export function estCodeControle(x: string): x is CodeControle {
  return CONTROLES_SOUS_TRAITANCE.some((c) => c.code === x);
}

/** La liste des preuves d'un contrôle à preuves, ou `null` (contrôle à résultat saisi). */
export function preuvesDuControle(code: string): ReadonlyArray<PreuveAttendue> | null {
  const c: ControleSousTraitance | undefined = CONTROLES_SOUS_TRAITANCE.find(
    (x) => x.code === code,
  );
  return c?.preuves ?? null;
}

/** Validité d'une pièce. */
export type ValiditePiece =
  | { readonly sorte: "date_de_la_piece" }
  | { readonly sorte: "mois_apres_emission"; readonly mois: number };

/** Quand une pièce est exigée. */
export type ExigencePiece =
  /** Toujours, dès l'entrée. */
  | "toujours"
  /** À partir du seuil de vigilance (règle des apporteurs, lot G1). */
  | "au_seuil"
  /** Demandée, jamais exigée (décision de Will du 03/08 pour la RC pro). */
  | "non_exigee";

export interface PieceRegistre {
  readonly code: string;
  readonly libelle: string;
  /** Types de pièce qui la prouvent (la plus récente validée est retenue). */
  readonly types: ReadonlyArray<TrainerDocumentTypeValue>;
  readonly exigence: ExigencePiece;
  readonly validite: ValiditePiece;
  /**
   * La pièce a déjà ses alertes ailleurs : le registre ne les double pas.
   * (L'URSSAF : `vigilance_urssaf_absente`, `_perimee`, `_expire_j30`.)
   */
  readonly alertesAilleurs: boolean;
}

export const PIECES_REGISTRE = [
  {
    code: "urssaf",
    libelle: "Attestation de vigilance URSSAF",
    types: ["attestation_vigilance_urssaf"],
    exigence: "au_seuil",
    validite: { sorte: "mois_apres_emission", mois: VIGILANCE_VALIDITE_MOIS },
    alertesAilleurs: true,
  },
  {
    code: "rc_pro",
    libelle: "Attestation RC pro",
    types: ["assurance_rc_pro"],
    exigence: "non_exigee",
    validite: { sorte: "date_de_la_piece" },
    alertesAilleurs: false,
  },
  {
    code: "kbis_sirene",
    libelle: "KBIS ou avis SIRENE",
    types: ["kbis_avis_sirene"],
    exigence: "toujours",
    validite: { sorte: "date_de_la_piece" },
    alertesAilleurs: false,
  },
  {
    code: "nda",
    libelle: "Numéro de déclaration d'activité",
    types: ["nda_sous_traitant", "recepisse_declaration_activite"],
    exigence: "toujours",
    validite: { sorte: "date_de_la_piece" },
    alertesAilleurs: false,
  },
] as const satisfies ReadonlyArray<PieceRegistre>;
