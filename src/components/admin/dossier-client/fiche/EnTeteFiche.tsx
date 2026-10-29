/**
 * Emplacement du lot B1 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : l'en-tête de la fiche (prochaine action, tuiles, frise) ; rend null.
 */

import type { ContexteFiche } from "./contexte";

export async function enTeteFiche(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  void ctx;
  return null;
}

/** Vrai quand l'en-tête remplace le bandeau « Où en est ce client ». */
export const EN_TETE_REMPLACE_LE_BANDEAU = false;
