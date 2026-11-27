/**
 * Changement d'IBAN d'un apporteur : l'INTERRUPTEUR et le SECRET (plan §8).
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEUR_CHANGEMENT_IBAN_ENABLED` vaut exactement
 * « true ». Lu à CHAQUE appel, jamais figé à l'import. Côté serveur seulement (conteneur de
 * l'application) : la variable n'est pas `NEXT_PUBLIC_`.
 *
 * GARDE : tant que le gel des virements (lot 7) n'est pas en ligne (`GEL_VIREMENTS_DISPONIBLE`),
 * l'interrupteur reste éteint même si la variable vaut « true ».
 */

import { empreinteIban } from "@/lib/iban-empreinte";

import { GEL_VIREMENTS_DISPONIBLE } from "./gel-virements";

export function changementIbanActif(): boolean {
  if (!GEL_VIREMENTS_DISPONIBLE) return false;
  return process.env.APPORTEUR_CHANGEMENT_IBAN_ENABLED === "true";
}

/** Sans `IBAN_EMPREINTE_SECRET`, aucune empreinte : toute demande est refusée (plan §8). */
export function secretEmpreinteDisponible(): boolean {
  return empreinteIban("FR00") !== null;
}
