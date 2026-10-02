/**
 * Qualiopi — la grille du référentiel appliquée AUJOURD'HUI par la console.
 *
 * Une seule lecture, partagée par tout ce qui juge ou affiche un indicateur :
 * la matrice (`evaluerConformite`), la garde de validation de la revue de
 * direction et le PDF de pilotage. Une date relue de son côté par chacun
 * divergerait : la matrice dirait « 33 indicateurs » pendant que la garde
 * jugerait sur 32.
 *
 * La date d'audit configurée (`date_audit_referentiel`) choisit la grille ;
 * vide ou illisible, c'est le jour de Paris (`choisirReferentiel`).
 */

import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { choisirReferentiel, type ReferentielApplique } from "./indicateurs-registre";

export async function lireReferentielApplique(maintenant: Date): Promise<ReferentielApplique> {
  // Une valeur non textuelle (double de test, ligne corrompue) vaut « pas de date ».
  const brut: unknown = await getQualiopiConfig("date_audit_referentiel").catch(() => "");
  return choisirReferentiel(typeof brut === "string" ? brut : "", maintenant);
}
