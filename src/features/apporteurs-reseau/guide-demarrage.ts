/**
 * Le GUIDE DE DÉMARRAGE de l'apporteur (validé par le dirigeant le 25/11/2026).
 *
 * 🔒 Un PDF A4 de 12 pages qui porte des montants : il n'est PLUS dans le dépôt public. Il vit
 * sur le stockage privé R2 (`CLE_R2_GUIDE`), lu par `documents-prives.ts` comme la fiche et le
 * livret. Il sort par DEUX chemins seulement :
 *   · la route `…/[jeton]/guide`, qui vérifie le lien personnel et le contrat signé ;
 *   · l'e-mail « contrat signé » (annexe déclarée avec les autres documents joints).
 *
 * Pour le déposer ou le remplacer : `scripts/apporteurs/deposer-document-joint.ts guide-demarrage`.
 *
 * ⚠️ Aucun `server-only` : le script de dépôt (tsx, hors Next) importe ce module.
 */

import { versionCourante } from "./annexes-versions";
import { CLE_R2_GUIDE, lirePdfPrive } from "./documents-prives";

export const NOM_FICHIER_GUIDE = "Guide-de-demarrage-apporteur-Axion-IA.pdf";

/** Le PDF du guide, ou `null` s'il est absent de R2, vide ou n'est pas un PDF. Ne lève jamais. */
export async function lireGuideDemarrage(): Promise<Buffer | null> {
  const v = await versionCourante("guide-demarrage");
  return lirePdfPrive(v?.cleR2 ?? CLE_R2_GUIDE, "guide de démarrage");
}
