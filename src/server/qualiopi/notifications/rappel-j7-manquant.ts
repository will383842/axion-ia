/**
 * LES SESSIONS PARTIES SANS RAPPEL J-7 — un seul prédicat, deux lecteurs.
 *
 * ## Le constat (2026-08-24, cahier D5)
 *
 * 🔴 `TrainingSession.rappelJ7EnvoyeAt` est écrite par un seul service et lue
 * par un seul lecteur : le cron, qui comptait les sessions parties sans rappel
 * et sortait le résultat en **`console.error`**. Pas de ligne d'alerte, pas
 * d'écran, rien dans le parcours de session.
 *
 * Le worker le disait lui-même : « *Ce cron n'écrit aucune trace en base (c'est
 * le constat `D5-1-C2`, à traiter à part) : le journal est donc le SEUL endroit
 * où l'échec peut se voir.* » **Ce n'était pas une décision, c'était un reste.**
 *
 * Or un journal de conteneur n'est lu par personne le lendemain matin. Le rappel
 * J-7 porte les informations logistiques finales — lieu, horaires, accès — et le
 * certificateur vérifie que le stagiaire a bien été informé.
 *
 * ## Pourquoi ce module existe
 *
 * 🔑 **La mesure existait déjà**, dans le cron. Écrire une seconde requête dans
 * la règle d'alerte aurait recréé la divergence que ce dépôt paie sans arrêt :
 * deux prédicats jumeaux qui s'éloignent au premier changement de borne. Le cron
 * et la règle lisent donc la MÊME fonction — le cron en prend le compte, la
 * règle en mappe les lignes.
 *
 * C'est exactement le geste de `CONF-01` sur la trace de clôture, et de
 * `lignes-de-chaine.ts` sur l'ordre des maillons.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";

/**
 * Profondeur du constat, en jours.
 *
 * ⚠️ Sans borne basse, le premier balayage remonterait **tout l'historique** et
 * noierait le signal utile sous des sessions closes depuis des mois. Même garde
 * que `regleSessionSansDispositifEmargement`.
 */
export const FENETRE_CONSTAT_JOURS = 30;

export interface SessionSansRappelJ7 {
  readonly id: string;
  readonly numero: string;
  readonly titreSession: string;
  readonly dateDebut: Date;
}

/**
 * Les sessions qui ont COMMENCÉ sans qu'aucun rappel J-7 n'ait été envoyé.
 *
 * Bornes, et pourquoi chacune :
 *
 * - **`dateDebut <= now`** — borne haute dure. Après le début, rappeler
 *   n'informe plus personne : le geste n'est plus posable, c'est un écart à
 *   constater. C'est la borne que le cron d'envoi s'impose déjà.
 * - **`dateDebut >= now - 30 j`** — borne basse, cf. `FENETRE_CONSTAT_JOURS`.
 * - **`rappelJ7EnvoyeAt: null`** — la trace n'est écrite que si TOUS les
 *   inscrits ont été servis ; une session partiellement servie compte donc
 *   comme non rappelée, ce qui est le comportement voulu.
 * - **au moins un inscrit actif** — une session sans personne à rappeler n'est
 *   pas en faute. Sans ce filtre, toute session vide crierait.
 *
 * ⚠️ Le prédicat d'inscription vient du SSOT `inscriptionsActives()`, jamais
 * recopié : un abandon n'est pas quelqu'un qu'on a oublié d'informer.
 */
export async function sessionsSansRappelJ7(now: Date): Promise<SessionSansRappelJ7[]> {
  const depuis = new Date(now.getTime() - FENETRE_CONSTAT_JOURS * 24 * 60 * 60 * 1000);
  return prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      rappelJ7EnvoyeAt: null,
      dateDebut: { lte: now, gte: depuis },
      enrollments: { some: { ...inscriptionsActives() } },
    },
    select: { id: true, numero: true, titreSession: true, dateDebut: true },
    orderBy: { dateDebut: "desc" },
    take: 100,
  });
}
