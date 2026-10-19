/**
 * Chantier QNC — l'état en base de chaque interrupteur de la liste
 * (`lots-interrupteurs.ts`), pour l'écran « Interrupteurs Qualiopi ».
 *
 * Ne lève jamais : `lireInterrupteurQualiopi` rend `eteint` sur toute erreur de
 * lecture, et le build `stub.invalid` lit donc `eteint`. Aucune lecture au
 * chargement du module : tout se passe à l'appel.
 */

import { LOTS_INTERRUPTEURS, type LotInterrupteur } from "./lots-interrupteurs";
import { lireInterrupteurQualiopi, type EtatInterrupteur } from "./interrupteurs";

export interface LigneInterrupteur extends LotInterrupteur {
  readonly etat: EtatInterrupteur;
}

export async function lireLignesInterrupteurs(): Promise<ReadonlyArray<LigneInterrupteur>> {
  return Promise.all(
    LOTS_INTERRUPTEURS.map(async (l) => ({ ...l, etat: await lireInterrupteurQualiopi(l.lot) })),
  );
}
