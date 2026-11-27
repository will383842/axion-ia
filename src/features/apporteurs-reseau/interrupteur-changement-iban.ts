/**
 * Changement d'IBAN d'un apporteur : l'INTERRUPTEUR et le SECRET (plan §8).
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEUR_CHANGEMENT_IBAN_ENABLED` vaut exactement
 * « true ». Lu à CHAQUE appel, jamais figé à l'import. Côté serveur seulement (conteneur de
 * l'application) : la variable n'est pas `NEXT_PUBLIC_`.
 */

import { empreinteIban } from "@/lib/iban-empreinte";

export function changementIbanActif(): boolean {
  return process.env.APPORTEUR_CHANGEMENT_IBAN_ENABLED === "true";
}

/** Sans `IBAN_EMPREINTE_SECRET`, aucune empreinte : toute demande est refusée (plan §8). */
export function secretEmpreinteDisponible(): boolean {
  return empreinteIban("FR00") !== null;
}
