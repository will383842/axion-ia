// Planning unifié — détection des conflits d'un formateur.
//
// Un CONFLIT = deux prestations qui se chevauchent pour le MÊME formateur.
// À distinguer d'une SURCHARGE (charge > capacité cible) : le conflit empêche
// l'exécution, la surcharge est un signal de pilotage.
//
// Granularité : si l'une des deux prestations n'a pas d'heure de fin (séance de
// coaching legacy à minuit → « journée entière »), la comparaison se fait au
// JOUR. Sinon elle se fait à l'instant près. Deux créneaux qui se touchent
// (fin de l'un = début de l'autre) ne sont PAS en conflit.

import { expandEventDayKeys } from "./expand";
import type { PlanningEvent, PlanningStatut } from "./types";

/** Statuts qui ne mobilisent plus le formateur → jamais en conflit. */
const STATUTS_INACTIFS: ReadonlySet<PlanningStatut> = new Set<PlanningStatut>([
  "annulee",
  "reportee",
]);

/** Une prestation annulée ou reportée ne bloque pas le formateur. */
export function mobiliseLeFormateur(e: Pick<PlanningEvent, "statut">): boolean {
  return !STATUTS_INACTIFS.has(e.statut);
}

type Intervalle = Pick<PlanningEvent, "debut" | "fin">;

/**
 * Deux prestations se chevauchent-elles ?
 * - l'une sans fin connue → comparaison au jour (Europe/Paris) ;
 * - sinon → comparaison à l'instant, bornes exclusives (créneaux jointifs OK).
 */
export function eventsOverlap(a: Intervalle, b: Intervalle): boolean {
  if (a.fin === null || b.fin === null) {
    const joursA = new Set(expandEventDayKeys(a.debut, a.fin));
    return expandEventDayKeys(b.debut, b.fin).some((j) => joursA.has(j));
  }
  return a.debut < b.fin && b.debut < a.fin;
}

/** Forme minimale suffisante pour détecter un conflit (la fiche 360° la fournit). */
export type ConflictTarget = Pick<PlanningEvent, "key" | "debut" | "fin" | "statut">;

/**
 * Prestations du formateur qui entrent en conflit avec `cible`.
 * Exclut la cible elle-même (par `key`) et les prestations annulées/reportées.
 * Le résultat est trié par date de début (déterministe).
 */
export function findConflicts(cible: ConflictTarget, candidats: PlanningEvent[]): PlanningEvent[] {
  if (!mobiliseLeFormateur(cible)) return [];
  return candidats
    .filter((c) => c.key !== cible.key && mobiliseLeFormateur(c) && eventsOverlap(cible, c))
    .sort((x, y) => x.debut.getTime() - y.debut.getTime());
}
