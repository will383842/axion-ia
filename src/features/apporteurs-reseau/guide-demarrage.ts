/**
 * Le GUIDE DE DÉMARRAGE de l'apporteur (validé par le dirigeant le 25/11/2026).
 *
 * Un PDF A4 de 12 pages, gardé sous `private/apporteurs/` : Next ne sert jamais ce dossier,
 * le Dockerfile le copie dans l'image. Il sort par DEUX chemins seulement :
 *   · la route `…/[jeton]/guide`, qui vérifie le lien personnel et le contrat signé ;
 *   · l'e-mail « contrat signé » (annexe déclarée avec les autres documents joints).
 *
 * La source lisible est `docs/apporteurs/guide-demarrage-apporteur.html` (non servie).
 * Pour remplacer le guide : nouveau PDF à la même place, empreinte mise à jour dans
 * `__tests__/guide-demarrage.spec.ts`, puis `scripts/apporteurs/deposer-document-joint.ts`
 * pour la copie jointe aux e-mails.
 *
 * ⚠️ Aucun `server-only` : le script de dépôt (tsx, hors Next) importe ce module.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export const FICHIER_PRIVE_GUIDE = "private/apporteurs/guide-demarrage-apporteur.pdf";
export const NOM_FICHIER_GUIDE = "Guide-de-demarrage-apporteur-Axion-IA.pdf";

/** Le PDF du guide, ou `null` s'il est absent, vide ou n'est pas un PDF. Ne lève jamais. */
export async function lireGuideDemarrage(): Promise<Buffer | null> {
  try {
    const buf = await readFile(path.resolve(process.cwd(), FICHIER_PRIVE_GUIDE));
    if (buf.byteLength === 0 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
    return buf;
  } catch {
    return null;
  }
}
