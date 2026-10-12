/**
 * Refus d'une pièce de formateur indépendant par MOTIF FERMÉ (lot E, M13 ; plan 08,
 * F41 variante « Pièce refusée »).
 *
 * Le motif libre de la console reste possible (salariés, cas particuliers) : il n'envoie
 * rien. Seul un motif de cette liste part dans F41, mot pour mot, entre les crochets du
 * texte soumis à Will. Aucun nom, aucun numéro : la liste est fermée.
 *
 * Pur : aucun import (le panneau console et le worker peuvent le lire).
 */

export const MOTIFS_REFUS_PIECE = {
  illisible: "illisible",
  perimee: "périmée",
  autre_nom: "ne correspond pas à votre nom",
  incomplete: "incomplète",
} as const;

export type MotifRefusPiece = keyof typeof MOTIFS_REFUS_PIECE;

export const CLES_MOTIF_REFUS_PIECE = Object.keys(MOTIFS_REFUS_PIECE) as [
  MotifRefusPiece,
  ...MotifRefusPiece[],
];

export function estMotifRefusPiece(x: unknown): x is MotifRefusPiece {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(MOTIFS_REFUS_PIECE, x);
}

/** Le motif tel qu'il est enregistré sur la pièce (et relu par « À renvoyer : … »). */
export function libelleMotifRefus(m: MotifRefusPiece): string {
  return MOTIFS_REFUS_PIECE[m];
}
