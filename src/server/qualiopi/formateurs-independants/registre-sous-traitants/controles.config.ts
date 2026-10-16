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
export const PREAVIS_ECHEANCE_JOURS = 30;

/** QUAND un contrôle est dû. */
export type QuandControle =
  /** Une fois, à l'entrée au registre ; fait seulement par un résultat conforme. */
  | { readonly sorte: "a_l_entree" }
  /** À l'échéance de chaque pièce exigée (les alertes de pièce portent le retard). */
  | { readonly sorte: "a_l_echeance_des_pieces" }
  /** À la fraîcheur d'un contrôle du registre public (celle de la garde de mission). */
  | { readonly sorte: "fraicheur_du_registre" }
  /** Un an après l'entrée, puis un an après la dernière revue. */
  | { readonly sorte: "annuelle" };

export interface ControleSousTraitance {
  /** Code stable, écrit sur chaque trace (`controles_sous_traitants.code`). */
  readonly code: string;
  readonly libelle: string;
  readonly quoi: string;
  readonly quand: QuandControle;
  readonly qui: string;
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
    libelle: "Revue annuelle",
    quoi: "Relecture du sous-traitant : pièces, incidents, appréciations et maintien de la collaboration.",
    quand: { sorte: "annuelle" },
    qui: "La direction",
  },
] as const satisfies ReadonlyArray<ControleSousTraitance>;

export type CodeControle = (typeof CONTROLES_SOUS_TRAITANCE)[number]["code"];

export function estCodeControle(x: string): x is CodeControle {
  return CONTROLES_SOUS_TRAITANCE.some((c) => c.code === x);
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
