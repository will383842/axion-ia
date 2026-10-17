/**
 * Chantier QNC, lot L04 — la question « les aménagements vous ont-ils été
 * utiles ? » : sa clé, son message, et quand elle se pose. Module PUR (tiré par
 * le formulaire du portail, le chargement de l'espace et la Server Action).
 */

import { estReponseAucuneAdaptation, reponseAdaptationConsignee } from "../reponse-organisme";

/** Clé de la réponse dans `Questionnaire.reponses` (satisfaction à chaud). */
export const CLE_AMENAGEMENTS_UTILES = "amenagementsUtiles";

export const MESSAGE_UTILITE_SANS_REPONSE =
  "Indiquez si les aménagements prévus pour vous ont été utiles (oui ou non). " +
  "Si la question ne s'affiche pas, rechargez la page.";

/** Pure : une réponse d'aménagement consignée, et autre que « aucune adaptation ». */
export function questionUtiliteApplicable(adaptationsRealisees: string | null): boolean {
  return (
    reponseAdaptationConsignee(adaptationsRealisees) &&
    !estReponseAucuneAdaptation(adaptationsRealisees)
  );
}
