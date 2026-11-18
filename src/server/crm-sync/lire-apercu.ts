/**
 * Lecture de l'aperçu « Passer en entreprise » : la lecture de la synchro (`lireEntreeDossier`),
 * posée comme si la fiche était une entreprise, puis les fonctions pures de l'envoi. Lecture
 * seule : rien n'est écrit, rien n'est émis.
 */

import { apercuPourCrm, type ApercuCrmPro } from "./apercu-dossier";
import { lireEntreeDossier } from "./lire-dossier";

/** `null` : la fiche ne partirait pas (absorbée par une fusion) ou est introuvable. */
export async function lireApercuCrmPro(clientId: string): Promise<ApercuCrmPro | null> {
  const lu = await lireEntreeDossier(clientId, new Date(), { commeEntreprise: true });
  return lu === null ? null : apercuPourCrm(lu.entree);
}
