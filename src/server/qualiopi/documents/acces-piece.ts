/**
 * Qui peut ouvrir le PDF d'une pièce (devis, aperçu, exemplaire signé) ? Module pur.
 * Même règle que les routes documents/[id], devis/[id]/apercu, pieces/[id]/exemplaire-signe.
 */

export const ROLES_PIECE_PDF = ["super_admin", "admin"] as const;

export function peutOuvrirPiecePdf(role: string | null | undefined): boolean {
  return typeof role === "string" && (ROLES_PIECE_PDF as readonly string[]).includes(role);
}
