/**
 * Emplacement du lot B2 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : onglet Activité ; rend null.
 */

import type { ContexteFiche } from "./contexte";

export async function ongletActivite(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  void ctx;
  return null;
}

/** Vrai quand l'onglet Activité est prêt à être affiché. */
export const ONGLET_ACTIVITE_PRET = false;
