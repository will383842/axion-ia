/**
 * Règles commerciales du devis à formules — PUR, sans E/S, appelé côté SERVEUR (D4/D6).
 *
 * - D6 : aucun devis à formules (A ni B) pour un client particulier : il reçoit un devis à prix unique.
 * - D4 : formule B, l'indemnité de sortie anticipée est fixée à zéro pour tout NOUVEAU devis.
 *
 * Ne s'applique pas aux devis déjà émis (leur offre reste lisible telle quelle).
 */

import type { OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";

export const MSG_FORMULES_PARTICULIER =
  "Le devis à formules n'est pas proposé à un particulier : faites-lui un devis à prix unique (achat en une fois).";

export const MSG_INDEMNITE_SORTIE =
  "L'indemnité de sortie de la formule B est fixée à zéro : ouvrez ce brouillon et enregistrez-le de nouveau.";

/** Message de refus si l'offre viole une règle commerciale, sinon `null`. */
export function refusReglesFormules(
  offre: Pick<OffreDevisV1, "abonnement">,
  typeClient: "entreprise" | "particulier" | null,
): string | null {
  if (typeClient === "particulier") return MSG_FORMULES_PARTICULIER;
  if (offre.abonnement && offre.abonnement.indemniteSortieTauxBps !== 0) {
    return MSG_INDEMNITE_SORTIE;
  }
  return null;
}
