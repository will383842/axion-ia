/**
 * LE PRÉDICAT « PIÈCE DE COMPÉTENCE PROBANTE » — écrit une seule fois.
 *
 * Indicateur 21 (maîtrise des compétences des intervenants, super-indicateur) :
 * l'auditrice désigne un intervenant et OUVRE sa pièce de compétence. Une pièce
 * ne prouve donc quelque chose que si les quatre conditions tiennent ensemble :
 *
 *   1. son TYPE justifie une compétence : CV, diplôme ou certification ;
 *   2. un humain l'a VALIDÉE ;
 *   3. elle porte un FICHIER — une adresse non nulle, non vide, et pas faite
 *      d'espaces : c'est ce fichier que l'auditrice ouvre ;
 *   4. elle n'est pas EXPIRÉE, si elle porte une date d'expiration (même borne
 *      que `estValide` : expirée dès l'instant de l'échéance).
 *
 * ## 🔴 Pourquoi ce module existe (audit initial 2026-09-14, constat I21-02)
 *
 * Une pièce VALIDÉE sans fichier couvrait l'indicateur 21 et faisait imprimer
 * « CV joint » sur la fiche formateur. Le premier correctif (PR #1085) a posé
 * `fichierUrl: { not: null }` sur deux requêtes ; la relecture a alors compté
 * TROIS définitions de « fichier présent » dans le code (`trim()` d'un côté,
 * `not null` de l'autre, rien du tout ailleurs), et deux lecteurs sans aucun
 * filtre : la liste officielle des formateurs (« CV au dossier ») et
 * `trouverValide` (« Dossier complet », alerte « CV absent »).
 *
 * 🔑 Tout lecteur appelle CE prédicat, jamais n'en réécrit un. Les lecteurs SQL
 * rétrécissent d'abord par `prefiltrePieceCompetenceProbante` (qui ne peut
 * qu'ÉLARGIR : « pas fait d'espaces » ne s'exprime pas dans un `where` Prisma),
 * puis tranchent en mémoire avec `estPieceCompetenceProbante`.
 *
 * Module PUR : aucun I/O, aucun import runtime — appelable depuis le moteur de
 * conformité, les actions serveur et les tests.
 */

import type { TrainerDocumentTypeValue } from "./conformite";

/** L'UNIQUE liste des types de pièce qui justifient une compétence. */
export const TYPES_PIECE_COMPETENCE = [
  "cv",
  "diplome",
  "certification",
] as const satisfies readonly TrainerDocumentTypeValue[];

export type TypePieceCompetence = (typeof TYPES_PIECE_COMPETENCE)[number];

export function estTypePieceCompetence(type: string): type is TypePieceCompetence {
  return (TYPES_PIECE_COMPETENCE as readonly string[]).includes(type);
}

/** Une pièce porte-t-elle un fichier ? Adresse non nulle, non vide, pas faite d'espaces. */
export function aUnFichier(fichierUrl: string | null | undefined): boolean {
  return typeof fichierUrl === "string" && fichierUrl.trim() !== "";
}

/** Ce que le prédicat lit d'une pièce — pas plus. */
export interface PieceLue {
  type: string;
  statutValidation: string;
  fichierUrl: string | null;
  dateExpiration: Date | null;
}

export type MotifPieceNonProbante = "hors_competence" | "non_validee" | "sans_fichier" | "expiree";

/** Pourquoi une pièce ne prouve PAS une compétence ; `null` si elle la prouve. */
export function motifPieceNonProbante(piece: PieceLue, now: Date): MotifPieceNonProbante | null {
  if (!estTypePieceCompetence(piece.type)) return "hors_competence";
  if (piece.statutValidation !== "valide") return "non_validee";
  if (!aUnFichier(piece.fichierUrl)) return "sans_fichier";
  if (piece.dateExpiration !== null && piece.dateExpiration <= now) return "expiree";
  return null;
}

export function estPieceCompetenceProbante(piece: PieceLue, now: Date): boolean {
  return motifPieceNonProbante(piece, now) === null;
}

/** Une pièce de compétence VALIDÉE qui, pourtant, ne compte pas comme preuve. */
export type PieceValideeEcartee = "sans_fichier" | "expiree";

/**
 * Ce que l'écran doit signaler à côté de « Validé » : la pièce a été validée,
 * mais elle ne couvre plus rien. `null` pour une pièce probante, non validée ou
 * hors compétence (rien à nuancer).
 */
export function pieceValideeEcartee(piece: PieceLue, now: Date): PieceValideeEcartee | null {
  const motif = motifPieceNonProbante(piece, now);
  return motif === "sans_fichier" || motif === "expiree" ? motif : null;
}

/**
 * Rétrécissement SQL — un SUR-ENSEMBLE du prédicat, jamais un substitut. Le
 * résultat doit toujours repasser par `estPieceCompetenceProbante`.
 */
export function prefiltrePieceCompetenceProbante(now: Date) {
  return {
    type: { in: [...TYPES_PIECE_COMPETENCE] },
    statutValidation: "valide" as const,
    fichierUrl: { not: null },
    OR: [{ dateExpiration: null }, { dateExpiration: { gte: now } }],
  };
}

/** Les colonnes que le prédicat lit, à étaler dans un `select`. */
export const SELECT_PIECE_COMPETENCE = {
  type: true,
  statutValidation: true,
  fichierUrl: true,
  dateExpiration: true,
} as const;
