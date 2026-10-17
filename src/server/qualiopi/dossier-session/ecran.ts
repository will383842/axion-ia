/**
 * Ce que lisent les onglets « Dossier » et « E-mails » de la fiche session —
 * chantier QNC, L11. Le même chargement et le même rendu que le ZIP ; seule la
 * phrase qui dit ce que le ZIP porte dépend de l'interrupteur.
 */

import { chargerDossierSession, type LecteurDossier } from "./chargement";
import { dossierCompletActifPour, lireEtatDossierSession } from "./interrupteur";
import { rendreDossier, type DossierRendu } from "./rendu";

export interface DossierPourEcran {
  readonly rendu: DossierRendu;
  /** Version texte des copies d'e-mails, par clé d'entrée. */
  readonly copies: ReadonlyMap<string, string>;
  /** Le ZIP porte-t-il ce dossier ? (interrupteur, cible = la session) */
  readonly zipActif: boolean;
  readonly noteZip: string;
}

export const NOTE_ZIP_ACTIF =
  "Le ZIP « dossier de session » contient exactement ce dossier, sous dossier-complet/ : mêmes entrées, même ordre, mêmes contenus.";

export const NOTE_ZIP_ETEINT =
  "Lecture seule. L'interrupteur qualiopi.dossier_session.actif est éteint pour cette session : le ZIP ne contient pas encore ce dossier complet.";

export async function chargerDossierPourEcran(
  sessionId: string,
  lecteur: LecteurDossier,
): Promise<DossierPourEcran | null> {
  const [modele, etat] = await Promise.all([
    chargerDossierSession(sessionId, lecteur),
    lireEtatDossierSession(),
  ]);
  if (modele === null) return null;
  const zipActif = dossierCompletActifPour(etat, {
    estTestInterne: modele.session.estTestInterne,
  });
  const copies = new Map<string, string>();
  for (const e of modele.elements) if (e.copie) copies.set(e.cle, e.copie.texte);
  return {
    rendu: rendreDossier(modele),
    copies,
    zipActif,
    noteZip: zipActif ? NOTE_ZIP_ACTIF : NOTE_ZIP_ETEINT,
  };
}
