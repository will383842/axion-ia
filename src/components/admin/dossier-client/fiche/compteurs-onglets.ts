/**
 * Emplacement du lot B1 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : compteurs des onglets ; rend {}.
 */

import type { ContexteFiche } from "./contexte";

export interface CompteurOnglet {
  readonly count?: number;
}

export async function compteursOnglets(
  ctx: ContexteFiche,
): Promise<Readonly<Record<string, CompteurOnglet>>> {
  void ctx;
  return {};
}
