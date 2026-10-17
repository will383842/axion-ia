/**
 * Formateurs indépendants — RÉGLAGES de l'évaluation des compétences (Qualiopi ind. 21).
 *
 * 🔑 LE SEUL FICHIER DES DÉFAUTS. Les seuils sont des RÉGLAGES modifiables en console
 * (`/qualiopi/config`, clés `evaluation_competences_*`), lus par `reglages-lecture.ts` ;
 * les constantes ci-dessous en sont les DÉFAUTS. Aucune règle, aucun écran, aucun test
 * ne recopie un de ces nombres. Réglage absent, illisible ou hors bornes : le défaut.
 *
 * ⚠️ TOUS LES SEUILS CI-DESSOUS SONT À VALIDER PAR WILL (valeurs de travail du
 * 2026-10-17, après la non-conformité majeure de l'indicateur 21 à l'audit du 16/10).
 *
 * Ce que ces seuils décident, et ce qu'ils ne décident pas : l'outil AFFICHE s'ils sont
 * atteints, et REFUSE une décision « habilité » qui ne les atteint pas. Toute décision
 * reste prise par un humain, avec un motif. Chaque décision versée garde une copie des
 * seuils appliqués ce jour-là : changer un seuil demain ne réécrit aucune décision passée.
 *
 * Module PUR, sans base (l'écran client le lit pour ses types).
 */

export interface ReglagesEvaluation {
  /** Entretien : moyenne des cinq critères à partir de laquelle l'habilitation est possible. */
  readonly entretienMoyenneMin: number;
  /** Entretien : aucun critère ne doit être noté sous cette note. */
  readonly entretienNoteCritereMin: number;
  /** Mise en situation : chaque bloc doit atteindre au moins cette note (sur 5). */
  readonly miseEnSituationNoteBlocMin: number;
}

/** Les DÉFAUTS des réglages. ⚠️ À valider par Will. */
export const REGLAGES_EVALUATION: ReglagesEvaluation = {
  /** ⚠️ À valider par Will. */
  entretienMoyenneMin: 3.5,
  /** ⚠️ À valider par Will. */
  entretienNoteCritereMin: 2,
  /** ⚠️ À valider par Will. */
  miseEnSituationNoteBlocMin: 3,
};

/**
 * Bornes d'un réglage lisible : [min, max, pas]. Les notes sont des entiers de 1 à 5 ;
 * une moyenne se compare au centième. Hors bornes, hors pas ou illisible : le défaut.
 */
export const BORNES_EVALUATION = {
  entretienMoyenneMin: [1, 5, 0.01],
  entretienNoteCritereMin: [1, 5, 1],
  miseEnSituationNoteBlocMin: [1, 5, 1],
} as const satisfies Record<keyof ReglagesEvaluation, readonly [number, number, number]>;

function borne(k: keyof ReglagesEvaluation, v: unknown): number {
  const [min, max, pas] = BORNES_EVALUATION[k];
  return typeof v === "number" &&
    Number.isFinite(v) &&
    v >= min &&
    v <= max &&
    Math.abs(v / pas - Math.round(v / pas)) < 1e-9
    ? v
    : REGLAGES_EVALUATION[k];
}

/** Les réglages lus, ramenés au défaut s'ils sont illisibles ou hors bornes. */
export function reglagesEvaluation(lus: {
  readonly [K in keyof ReglagesEvaluation]: unknown;
}): ReglagesEvaluation {
  return {
    entretienMoyenneMin: borne("entretienMoyenneMin", lus.entretienMoyenneMin),
    entretienNoteCritereMin: borne("entretienNoteCritereMin", lus.entretienNoteCritereMin),
    miseEnSituationNoteBlocMin: borne("miseEnSituationNoteBlocMin", lus.miseEnSituationNoteBlocMin),
  };
}
