/**
 * 🔴 QUAND RELANCER UN POSITIONNEMENT — module PUR.
 *
 * ## Le défaut
 *
 * Le questionnaire de positionnement (indicateur 8) est envoyé une fois, à la
 * conclusion de la pièce contractuelle. Ensuite, **plus rien** : aucune
 * relance, et l'étape de la checklist dit encore « Manuel — bloc Inscriptions,
 * “Envoyer le positionnement” ».
 *
 * Un stagiaire qui ne répond pas n'était donc jamais relancé, et le jour de la
 * formation arrivait sans que le besoin ait été recueilli. Devant un auditeur,
 * **une non-réponse du stagiaire n'est pas une faute de l'organisme ; l'absence
 * de tentative tracée, si.**
 *
 * ## ⚠️ PAS DE COMPTE À REBOURS — état, et rattrapage
 *
 * Le piège a déjà été payé sur la convocation, et il est documenté dans le cron
 * : une fenêtre « J-5 » ne retient que les sessions dont la date de début tombe
 * dans un intervalle étroit au passage du cron. Vérifié en production : **aucune
 * session réelle n'existait cinq jours avant son début** — celle du 31/07 a été
 * créée le 31/07 pour un début le jour même. Une session créée à l'intérieur de
 * sa propre fenêtre n'y entre jamais, et rien ne la rattrape.
 *
 * D'où : pas de plancher. Tant que l'état est « à faire », l'inscription reste
 * candidate à chaque passage. Une exécution manquée cesse d'être définitive.
 *
 * Le plafond haut, lui, demeure : on ne réclame pas un positionnement trois
 * mois à l'avance — il porte sur un besoin qui n'est pas encore formé.
 */

const MS_JOUR = 24 * 60 * 60 * 1000;

/**
 * Horizon d'envoi : on commence à réclamer le positionnement quand la session
 * approche.
 *
 * 15 jours plutôt que 5 : le positionnement doit être **exploité** avant la
 * formation (adapter le contenu), pas seulement recueilli. Le réclamer
 * l'avant-veille en fait une case à cocher.
 */
export const HORIZON_JOURS = 15;

/** Délai minimal entre deux relances. */
export const DELAI_ENTRE_RELANCES_JOURS = 4;

/**
 * Plafond de relances.
 *
 * ⚠️ Deux, pas plus. Au-delà, on ne relance plus : on harcèle. Et la trace des
 * deux tentatives suffit à démontrer la diligence — c'est le même plafond que
 * les questionnaires de satisfaction, déjà écrit au schéma.
 */
export const RELANCES_MAX = 2;

export type GestePositionnement = "envoyer" | "relancer" | "rien";

export interface EtatPositionnement {
  readonly envoyeAt: Date | null;
  readonly reponduAt: Date | null;
  readonly relanceCount: number;
  readonly derniereRelanceAt: Date | null;
  /** Début de la session rattachée. */
  readonly dateDebut: Date;
  readonly maintenant: Date;
}

/**
 * Que faire de ce positionnement, aujourd'hui ?
 *
 * @returns le geste, et `rien` quand il n'y a rien à faire — jamais `null` : un
 *   appelant qui doit distinguer « rien à faire » de « je ne sais pas » finit
 *   par confondre les deux.
 */
export function gestePositionnement(e: EtatPositionnement): GestePositionnement {
  // Répondu : c'est fini, quelle que soit la suite.
  if (e.reponduAt !== null) return "rien";

  // 🔴 La session a commencé. On n'envoie PAS.
  //
  // Un positionnement recueilli après le début ne mesure plus le besoin
  // d'entrée : il mesure ce que la formation vient d'apprendre. La pièce
  // existerait, datée, et serait FAUSSE. Ce cas relève d'un écart à consigner,
  // pas d'un envoi — exactement le raisonnement retenu pour la convocation.
  if (e.dateDebut.getTime() <= e.maintenant.getTime()) return "rien";

  // Trop tôt : le besoin n'est pas encore formé.
  if (e.dateDebut.getTime() - e.maintenant.getTime() > HORIZON_JOURS * MS_JOUR) return "rien";

  // Jamais parti — le cas le plus grave, et celui qu'aucun code ne rattrapait.
  if (e.envoyeAt === null) return "envoyer";

  if (e.relanceCount >= RELANCES_MAX) return "rien";

  // Le repère est la dernière ACTION, envoi initial compris : sans cela, la
  // première relance partirait le lendemain de l'envoi.
  const derniere = e.derniereRelanceAt ?? e.envoyeAt;
  if (e.maintenant.getTime() - derniere.getTime() < DELAI_ENTRE_RELANCES_JOURS * MS_JOUR) {
    return "rien";
  }

  return "relancer";
}
