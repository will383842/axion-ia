/**
 * Ce que la page de réservation et l'écran de fin d'un ÉCHANGE FORMATEUR annoncent
 * (lot B, M25) : nos propres e-mails (confirmation F3, rappels F4) ne sont annoncés que
 * s'ils partent vraiment — suivi des échanges formateurs allumé ET les deux textes
 * validés (même règle que l'adaptateur d'envoi `texteValide`, relue ici sans tirer la
 * file d'envoi dans la page publique). Sinon, comme avant : seule l'invitation d'agenda.
 *
 * Ne lève jamais : une lecture en échec vaut « rien d'annoncé ».
 */

import { estTexteValide } from "@/server/email/textes-valides";
import { lireTextesValides } from "@/server/email/textes-valides-lecture";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { lireDrapeauEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";

export const GABARITS_ANNONCES = [
  "formateur-echange-confirme",
  "formateur-echange-rappel",
] as const;

export async function nosEmailsPourEchangeFormateur(): Promise<boolean> {
  try {
    if ((await lireEtatsEntree()).suivi_echange !== true) return false;
    if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "textes_valides")) return false;
    const registre = await lireTextesValides();
    return GABARITS_ANNONCES.every((g) => estTexteValide(registre, g));
  } catch {
    return false;
  }
}
