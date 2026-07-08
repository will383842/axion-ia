/**
 * Qualiopi — Supports : REGROUPEMENT PAR JOUR des formations multi-jours (pur).
 *
 * Une formation de plusieurs jours doit être structurée « Jour 1 / Jour 2 / … »
 * (best practice 2026 : ouverture de journée avec objectifs, rappel de la veille,
 * bilan de fin de journée). Ce module répartit DÉTERMINISTIQUEMENT les modules du
 * contenu détaillé en journées de ~7h, sans dépendre d'une consigne suivie par l'IA.
 *
 * Règle : on empile les modules dans la journée courante tant qu'on reste sous le
 * quota horaire ; dès qu'un module ferait dépasser (et que la journée n'est pas
 * vide), on ouvre une nouvelle journée. Un module plus long qu'une journée occupe
 * sa journée seul.
 */

import type { ModuleContenu } from "../../engine/content-schema";

/** Minutes par jour de formation (7h = journée standard OF). */
export const MINUTES_PAR_JOUR = 420;

/** Durée d'un module = somme des durées de ses séquences (min). */
export function dureeModuleMin(mod: ModuleContenu): number {
  return mod.sequences.reduce((acc, s) => acc + (s.dureeMin || 0), 0);
}

export interface JourGroupe {
  /** Numéro de journée (1-based). */
  numero: number;
  modules: ModuleContenu[];
  /** Durée cumulée de la journée (min). */
  dureeMin: number;
}

/**
 * Répartit les modules en journées de ~`minutesParJour`. Retourne 1 seule journée
 * si le total tient dans une journée (formation mono-jour → pas de structuration
 * « Jour 1/2/3 » superflue).
 */
export function grouperParJour(
  modules: ModuleContenu[],
  minutesParJour: number = MINUTES_PAR_JOUR,
): JourGroupe[] {
  const total = modules.reduce((acc, m) => acc + dureeModuleMin(m), 0);
  // Mono-jour : une seule journée, pas de découpage.
  if (total <= minutesParJour || modules.length <= 1) {
    return [{ numero: 1, modules: [...modules], dureeMin: total }];
  }

  const jours: JourGroupe[] = [];
  let courant: JourGroupe = { numero: 1, modules: [], dureeMin: 0 };
  for (const mod of modules) {
    const d = dureeModuleMin(mod);
    if (courant.modules.length > 0 && courant.dureeMin + d > minutesParJour) {
      jours.push(courant);
      courant = { numero: courant.numero + 1, modules: [], dureeMin: 0 };
    }
    courant.modules.push(mod);
    courant.dureeMin += d;
  }
  if (courant.modules.length > 0) jours.push(courant);
  return jours;
}

/** True si la formation s'étale sur plusieurs jours. */
export function estMultiJours(
  modules: ModuleContenu[],
  minutesParJour = MINUTES_PAR_JOUR,
): boolean {
  return grouperParJour(modules, minutesParJour).length > 1;
}

/** Libellé « Jour N » / « Jour N — matin/après-midi » selon la durée. */
export function libelleJour(numero: number): string {
  return `Jour ${numero}`;
}
