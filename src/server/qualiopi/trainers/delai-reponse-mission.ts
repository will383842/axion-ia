/**
 * Combien de temps un formateur a-t-il pour répondre — et qui doit répondre.
 *
 * ## Le défaut que ce module ferme
 *
 * Il n'existait qu'un seul délai : **jusqu'au démarrage de la session**. Avec,
 * autour, deux mécanismes calés sur une constante fixe de trois jours — la
 * relance (`solliciteAt <= J-3`) et l'alerte `formateur_mission_sans_reponse`
 * (même condition). Conséquence mécanique : pour une session qui démarre dans
 * moins de trois jours, **aucune relance ne partait et aucune alerte ne se
 * levait**. Le silence du formateur n'était signalé nulle part, jusqu'au
 * démarrage — c'est-à-dire précisément quand il coûte le plus cher et qu'il
 * n'est plus réparable.
 *
 * Vérifié sur AXI-SESS-2026-001 le 2026-09-04 : proposition envoyée à 16h30
 * pour une session le lendemain 9h. Relance prévue trois jours plus tard, soit
 * deux jours APRÈS la formation.
 *
 * ## Pourquoi un module à part, et pur
 *
 * Ces règles sont lues par quatre endroits qui ne peuvent pas s'appeler entre
 * eux : le service de mission, le cron, le moteur d'alertes et l'écran de
 * réponse. Recopiées, elles divergeraient au premier changement — c'est le
 * motif dominant des défauts de ce dépôt. Pures, elles se testent sans base et
 * sans Next.
 */

import type { TrainerStatut } from "../../../../prisma/generated/client";

/** Plafond : au-delà, attendre n'apporte plus rien. */
export const DELAI_REPONSE_MAX_MS = 48 * 60 * 60 * 1000;

/**
 * Marge qu'on se garde AVANT le démarrage pour réaffecter quelqu'un d'autre.
 *
 * C'est la vraie raison d'être de l'échéance : elle n'est pas là pour presser
 * le formateur, elle est là pour que l'organisme ait encore le temps d'agir.
 * Une réponse qui arrive la veille au soir ne sert à rien.
 */
export const MARGE_REAFFECTATION_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Plancher : on ne demande jamais une réponse en moins de deux heures.
 *
 * Sans lui, une session créée pour le lendemain produirait une échéance déjà
 * dépassée à l'instant de l'envoi — le formateur recevrait un message dont le
 * lien est mort avant d'avoir été lu.
 */
export const DELAI_REPONSE_MIN_MS = 2 * 60 * 60 * 1000;

/**
 * L'accord du formateur est-il requis pour cette affectation ?
 *
 * 🔴 Rien ne posait cette question. `proposerMissionFormateur` ne LISAIT même
 * pas `trainer.statut` : le dirigeant de l'organisme a reçu, le 2026-09-04, un
 * e-mail lui demandant s'il acceptait d'animer la session de sa propre société.
 *
 * Un salarié ne « refuse » pas une affectation — c'est le contrat de travail
 * qui règle la question, et lui proposer un lien « Refuser » lui offre un droit
 * qu'il n'a pas et qui n'engage pas l'organisme. Le dirigeant-formateur EST
 * l'organisme : se demander son propre accord n'a pas de sens.
 *
 * Le sous-traitant, lui, est un tiers indépendant : son accord est le contrat.
 */
export function accordRequis(statut: TrainerStatut): boolean {
  return statut === "sous_traitant";
}

/**
 * L'instant au-delà duquel le silence vaut `sans_reponse`.
 *
 * PROPORTIONNEL au temps réellement disponible :
 *
 * - session lointaine → 48 h, le plafond ;
 * - session proche → on coupe à J-3, pour garder de quoi réaffecter ;
 * - session très proche → le plancher de 2 h prend le relais ;
 * - session imminente → l'échéance ne dépasse jamais le démarrage, qui reste
 *   la borne dure : après lui, la question ne se pose plus.
 *
 * Rendue en UTC comme tout le reste ; l'appelant formate.
 */
export function echeanceReponse(dateDebut: Date, now: Date): Date {
  const plafond = now.getTime() + DELAI_REPONSE_MAX_MS;
  const avantDemarrage = dateDebut.getTime() - MARGE_REAFFECTATION_MS;
  const plancher = now.getTime() + DELAI_REPONSE_MIN_MS;

  const brut = Math.min(plafond, avantDemarrage);
  // Le plancher relève une échéance trop serrée ; le démarrage la rabat. Dans
  // cet ordre : sur une session dans une heure, le plancher voudrait 2 h, et
  // c'est le démarrage qui doit gagner.
  return new Date(Math.min(Math.max(brut, plancher), dateDebut.getTime()));
}

/**
 * Quand relancer : à MI-CHEMIN entre la sollicitation et l'échéance.
 *
 * 🔴 La relance était fixée à trois jours après la sollicitation, quelle que
 * soit l'échéance. Sur une session à J-1, elle tombait après la formation ; sur
 * une session à J-60, elle tombait quarante-cinq jours avant qu'on en ait
 * besoin. Une relance ne sert que si elle laisse encore le temps de répondre —
 * la moitié du délai est le seul point qui garantit les deux.
 */
export function instantRelance(solliciteAt: Date, echeance: Date): Date {
  return new Date(solliciteAt.getTime() + (echeance.getTime() - solliciteAt.getTime()) / 2);
}

/**
 * Le délai tel qu'on l'écrit au formateur.
 *
 * 🔴 L'e-mail de proposition annonçait, EN DUR, que les informations pratiques
 * arriveraient « une semaine avant le démarrage ». Pour une session le
 * lendemain, c'est une promesse qui ne peut pas être tenue — et le formateur a
 * reçu, dix minutes plus tard, le rappel « votre session de demain ». Deux
 * messages du même expéditeur qui se contredisent le même quart d'heure.
 *
 * Même famille que le « demain » codé en dur du rappel J-1, corrigé le
 * 2026-09-04 : ce qui est vrai du délai doit se DÉRIVER du délai.
 */
export function libelleEcheance(echeance: Date, now: Date): string {
  const restant = echeance.getTime() - now.getTime();
  if (restant <= 0) return "le délai est dépassé";
  const heures = Math.floor(restant / (60 * 60 * 1000));
  if (heures < 1) return "dans moins d'une heure";
  if (heures < 24) return `sous ${heures} heure${heures > 1 ? "s" : ""}`;
  const jours = Math.floor(heures / 24);
  return `sous ${jours} jour${jours > 1 ? "s" : ""}`;
}

/**
 * Quand les informations pratiques partiront réellement.
 *
 * La convocation du formateur part sept jours avant le démarrage ; passé ce
 * point, c'est le rappel de la veille qui les porte — et si la session est dans
 * moins de 36 h, elles sont déjà parties ou partent dans l'heure. Le message
 * doit dire lequel des trois cas s'applique, pas réciter le cas général.
 */
export function libelleInfosPratiques(dateDebut: Date, now: Date): string {
  const restantMs = dateDebut.getTime() - now.getTime();
  const jours = restantMs / (24 * 60 * 60 * 1000);
  if (jours > 7) return "vous seront envoyées une semaine avant le démarrage";
  if (jours > 1.5) return "vous seront envoyées la veille de la session";
  return "vous parviennent dans la foulée de ce message";
}
