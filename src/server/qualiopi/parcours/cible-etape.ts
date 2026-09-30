/**
 * Le lien qui MÈNE au geste d'une étape — en un clic. Module PUR.
 *
 * ## Le défaut (audit UX du 30/09/2026)
 *
 * « Où en est ce dossier » disait où aller (« bloc Documents, bouton … ») au
 * lieu d'y emmener, et sept étapes menaient au bloc « Sous-pages » : un
 * premier clic pour y descendre, un second pour choisir la bonne sous-page,
 * puis une recherche aux yeux sur une page de plusieurs écrans.
 *
 * ## La règle
 *
 * - une étape dont le geste vit sur la FICHE mène à la fiche, à l'onglet de sa
 *   phase (`?phase=`) et à sa section (`#fragment`) : la section est donc
 *   toujours déployée à l'arrivée, jamais repliée sous « Toutes les actions » ;
 * - une étape dont le geste vit sur une SOUS-PAGE mène directement à la
 *   section de cette sous-page — `/emargement#journees`, `/evaluations#insc-…`.
 *
 * Une seule fonction pour la checklist de la fiche ET pour « À traiter » : deux
 * constructions d'URL divergeraient au premier renommage.
 */

import type { CibleEtape, PhaseEtape } from "./session-parcours";

/**
 * @param sessionId       identifiant de la session.
 * @param etape           ce que l'étape déclare : sa phase et sa cible.
 * @param prefixeSessions préfixe de la liste des sessions dans la console,
 *                        p. ex. `/fr/admin/qualiopi/sessions` (sans « / » final).
 */
export function hrefEtape(
  sessionId: string,
  etape: { readonly phase: PhaseEtape; readonly cible: CibleEtape },
  prefixeSessions: string,
): string {
  const fiche = `${prefixeSessions}/${sessionId}`;
  const { sousPage, fragment } = etape.cible;
  if (sousPage !== undefined) return `${fiche}/${sousPage}#${fragment}`;
  return `${fiche}?phase=${etape.phase}#${fragment}`;
}
