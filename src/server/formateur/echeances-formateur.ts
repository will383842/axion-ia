/**
 * Espace formateur — CE QUI PRESSE SUR SES SESSIONS.
 *
 * ## Le défaut
 *
 * L'accueil du formateur ne réclamait que les **lettres de mission**. Tout le
 * reste de ce qui presse sur ses sessions — un émargement resté vide, des
 * journées jamais confirmées — n'apparaissait nulle part : il fallait ouvrir
 * chaque formation, une par une, pour le découvrir. Côté console, la page « À
 * traiter » avait exactement le même trou avant le Lot 1 §1.4, et c'est la cause
 * racine des défauts du premier dossier réel.
 *
 * ## Un seul calcul
 *
 * On ne recalcule rien : `prochainesEcheances` est le SSOT, partagé avec la page
 * « À traiter », la pastille de navigation et le moteur d'alertes. Deux calculs
 * concurrents diraient un jour deux chiffres pour la même chose — et un compteur
 * qui ment une fois n'est plus jamais regardé.
 *
 * ## 🔴 Le cloisonnement
 *
 * Les identifiants passés au service viennent EXCLUSIVEMENT de
 * `listMyTrainingSessions(trainerId)`, qui est scopée par
 * `whereSessionsDuFormateur` (FK principal OU ligne `SessionFormateur`). Aucun
 * paramètre d'URL, aucune lecture non scopée, aucun identifiant fourni par
 * l'appelant : **cette fonction ne prend qu'un `trainerId`**, et il n'y a donc
 * aucune surface par laquelle un formateur pourrait désigner la session d'un
 * autre. C'est volontaire — une signature qui accepterait des `sessionIds`
 * serait, tôt ou tard, appelée avec ceux de quelqu'un d'autre.
 *
 * ## 🔴 Aucune donnée de stagiaire
 *
 * Le service ne rend que le libellé de l'étape, sa mention d'état, son geste, un
 * avancement `n/m` et l'identité de la SESSION (numéro, titre). Jamais un nom.
 * On ne rend pas non plus `avertissement` : ces phrases sont écrites pour le
 * registre de l'organisme (« annuler l'ancienne pièce ») et citent des numéros
 * de pièces qui ne concernent pas le formateur.
 */

import { listMyTrainingSessions } from "./collectif-queries";
import {
  filtrerEtapesFormateur,
  sessionsDansLePerimetre,
  GESTE_FORMATEUR,
} from "./etapes-formateur";
import {
  prochainesEcheances,
  type EcheanceSession,
} from "@/server/qualiopi/parcours/echeances-service";

/** Une ligne de l'accueil formateur. Volontairement plate et sans stagiaire. */
export interface EcheanceFormateur {
  readonly sessionId: string;
  readonly numero: string;
  readonly titre: string;
  readonly cle: EcheanceSession["etape"]["cle"];
  readonly libelle: string;
  /** L'état est dans le TEXTE, jamais dans la seule couleur (WCAG 1.4.1). */
  readonly mention: string;
  /** Le geste, réécrit pour le formateur — jamais celui de la console. */
  readonly geste: string;
  readonly etat: EcheanceSession["etape"]["etat"];
  readonly avancement?: { readonly fait: number; readonly total: number };
}

/**
 * Ce qui presse sur les sessions de CE formateur, et rien d'autre.
 *
 * @param trainerId identité déjà établie par `requireFormateur()`. Cette
 *   fonction ne la vérifie pas : elle n'a aucun moyen de le faire, et l'appeler
 *   avant la garde serait le défaut.
 */
export async function echeancesDuFormateur(
  trainerId: string,
  maintenant: Date = new Date(),
): Promise<ReadonlyArray<EcheanceFormateur>> {
  // 🔴 La SEULE source d'identifiants. Scopée par `whereSessionsDuFormateur`.
  const mesSessions = await listMyTrainingSessions(trainerId);

  // `prochainesEcheances` n'applique AUCUNE borne de date quand on lui passe des
  // identifiants — voir `sessionsDansLePerimetre`, qui la remet à la main.
  const sessionIds = sessionsDansLePerimetre(mesSessions, maintenant);
  if (sessionIds.length === 0) return [];

  const { echeances } = await prochainesEcheances({ sessionIds, maintenant });

  return filtrerEtapesFormateur(echeances).map((e) => ({
    sessionId: e.sessionId,
    numero: e.numero,
    titre: e.titre,
    cle: e.etape.cle,
    libelle: e.etape.libelle,
    mention: e.etape.mention,
    // Le geste de la console nomme des boutons que le formateur n'a pas ; sa
    // réécriture est obligatoire pour les étapes retenues, et le repli n'existe
    // que pour ne pas planter si l'une des deux tables prenait de l'avance.
    geste: GESTE_FORMATEUR[e.etape.cle] ?? e.etape.geste,
    etat: e.etape.etat,
    ...(e.etape.avancement !== undefined ? { avancement: e.etape.avancement } : {}),
  }));
}
