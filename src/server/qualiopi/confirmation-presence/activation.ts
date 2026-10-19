/**
 * Chantier QNC, NC6 (indicateur 12), lot présence — l'interrupteur
 * `qualiopi.presence.actif`.
 *
 * Une seule question, posée partout de la même façon : la confirmation de
 * présence avant la formation (P-12, étapes 3 et 4) agit-elle sur CETTE
 * session ? `eteint` (clé absente, défaut) = rien ne part ; `essai` = seulement
 * sur une session du banc d'essai (`estTestInterne`) ; `actif` = pour tous.
 *
 * Ne lève jamais : `lireInterrupteurQualiopi` rend `eteint` sur toute erreur de
 * lecture, et le build `stub.invalid` lit donc `eteint`.
 */

import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_PRESENCE = "presence" as const;

export function lireInterrupteurPresence(): Promise<EtatInterrupteur> {
  return lireInterrupteurQualiopi(LOT_PRESENCE);
}

/** La confirmation de présence agit-elle sur cette session ? */
export async function presencePour(session: {
  readonly estTestInterne?: boolean | null | undefined;
}): Promise<boolean> {
  const etat = await lireInterrupteurPresence();
  return estActifPour(etat, { estTestInterne: session.estTestInterne === true });
}
