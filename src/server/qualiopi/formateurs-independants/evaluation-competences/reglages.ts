/**
 * Formateurs indépendants — RÉGLAGES de l'évaluation des compétences (Qualiopi ind. 21).
 *
 * 🔑 LE SEUL FICHIER DES SEUILS. Aucune règle, aucun écran, aucun test ne recopie un de
 * ces nombres : ils le lisent ici. Modifier un seuil = modifier ce fichier.
 *
 * ⚠️ TOUS LES SEUILS CI-DESSOUS SONT À VALIDER PAR WILL (valeurs de travail du
 * 2026-10-17, après la non-conformité majeure de l'indicateur 21 à l'audit du 16/10).
 *
 * Ce que ces seuils décident, et ce qu'ils ne décident pas : l'outil AFFICHE s'ils sont
 * atteints, et REFUSE une décision « habilité » qui ne les atteint pas. Toute décision
 * reste prise par un humain, avec un motif. Chaque décision versée garde une copie des
 * seuils appliqués ce jour-là : changer un seuil demain ne réécrit aucune décision passée.
 *
 * Module PUR, sans base.
 */

export interface ReglagesEvaluation {
  /** Entretien : moyenne des cinq critères à partir de laquelle l'habilitation est possible. */
  readonly entretienMoyenneMin: number;
  /** Entretien : aucun critère ne doit être noté sous cette note. */
  readonly entretienNoteCritereMin: number;
  /** Mise en situation : chaque bloc doit atteindre au moins cette note (sur 5). */
  readonly miseEnSituationNoteBlocMin: number;
}

/** ⚠️ À valider par Will. */
export const REGLAGES_EVALUATION: ReglagesEvaluation = {
  entretienMoyenneMin: 3.5,
  entretienNoteCritereMin: 2,
  miseEnSituationNoteBlocMin: 3,
};
