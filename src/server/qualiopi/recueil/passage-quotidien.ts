/**
 * Chantier QNC, L03 — le PASSAGE QUOTIDIEN du recueil : renvoi d'un premier
 * envoi qui n'est pas parti, relances (J+3, J+6 au plus), et retours rangés
 * dans le dossier de la session. 08:xx Paris, jours ouvrés
 * (`estLHeureDuPassage`, comme le suivi OPCO).
 *
 * Éteint (`qualiopi.recueil.actif`) : une lecture, rien d'autre. Import
 * PARESSEUX de la file d'e-mails par l'appelant (le worker).
 */

import { prisma } from "@/lib/prisma";
import { estLHeureDuPassage } from "@/server/qualiopi/financements/suivi-entreprise/passage-quotidien";

import { relancerRecueils, tracerRetours, type PortEnvoi } from "./lancement";

export { estLHeureDuPassage };

export async function passerRecueil(envoi: PortEnvoi, maintenant: Date = new Date()) {
  const relances = await relancerRecueils(prisma, envoi, maintenant);
  const retours = await tracerRetours(prisma);
  return { ...relances, retoursTraces: retours.traces };
}
