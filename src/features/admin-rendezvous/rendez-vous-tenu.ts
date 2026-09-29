/**
 * « Ce rendez-vous a eu lieu ce mois-ci » — la règle UNIQUE (chantier visio,
 * PR 4, correction anti-doublon A3).
 *
 * Deux compteurs de la page Rendez-vous parlent des rendez-vous tenus du mois :
 * « ont eu lieu » du bilan (`bilanDuMois`, `suivi-queries.ts`) et « Visios
 * tenues » de l'état du circuit (`couvertureDuMois`, `balayage.ts`). Ils
 * lisent tous deux CETTE règle :
 *
 *   · tenu = le point fait après l'appel (`rendez_vous_suivis.issue`) dit
 *     « A eu lieu ». Ni le statut de la rencontre, ni l'horaire passé ;
 *   · le mois = celui du RENDEZ-VOUS (`calendly_events.start_time`), à l'heure
 *     de Paris, pas celui de la saisie.
 *
 * Conséquence voulue : « Visios tenues » est une PARTIE de « ont eu lieu ».
 * L'écart est fait des rendez-vous tenus qui ne sont pas des visios client du
 * dossier (échange apporteur, rendez-vous de test, reprise d'historique).
 * Une visio passée dont personne n'a fait le point n'est dans aucun des deux :
 * elle attend dans « À faire le point ».
 *
 * Module neutre (ni `server-only`, ni Prisma) : le worker l'importe.
 * Garde : `les-visios-tenues-sont-une-partie-du-bilan.spec.ts`.
 */

import { dayKeyInParis } from "@/lib/calendar-grid";
import type { IssueRdv } from "./suivi";

/** Assez large pour couvrir tout le mois courant, quel que soit le jour. */
export const JOURS_FENETRE_BILAN = 40;

/** Fenêtre de lecture des rendez-vous (sur `startTime`) avant le tri par mois. */
export function fenetreDuBilan(maintenant: Date): { gte: Date; lte: Date } {
  return {
    gte: new Date(maintenant.getTime() - JOURS_FENETRE_BILAN * 86_400_000),
    lte: maintenant,
  };
}

/** Le rendez-vous commence-t-il dans le mois (Paris) de `maintenant` ? */
export function estDuMoisDuBilan(debut: Date | null, maintenant: Date): debut is Date {
  if (!debut) return false;
  return dayKeyInParis(debut).slice(0, 7) === dayKeyInParis(maintenant).slice(0, 7);
}

/** Le point fait après l'appel dit-il qu'il a eu lieu ? */
export function aEuLieu(issue: IssueRdv | null | undefined): boolean {
  return issue === "eu_lieu";
}
