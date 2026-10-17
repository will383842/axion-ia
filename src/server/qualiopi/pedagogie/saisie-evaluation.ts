/**
 * Lot L08 — la saisie de l'évaluation finale par le formateur. Module PUR.
 *
 * ## Pourquoi une observation par objectif
 *
 * La grille d'évaluation naît de cette saisie (O13) : elle n'est une preuve que
 * si elle dit, objectif par objectif, ce que le formateur a constaté. Une note
 * seule n'est pas un constat. Chaque objectif exige donc sa note (1, 2 ou 3 — la
 * même échelle que la console) ET son observation. Rien n'est complété à la
 * place du formateur : une note manquante n'est pas devinée.
 */

export const OBSERVATION_MIN = 5;
export const OBSERVATION_MAX = 1000;
export const RECOMMANDATIONS_MAX = 2000;

export interface CompetenceSaisie {
  libelle: string;
  note: 1 | 2 | 3;
  observations: string;
  objectifRef: string;
}

export type ResultatSaisie =
  | { ok: true; competences: CompetenceSaisie[]; recommandations?: string }
  | { ok: false; erreurs: string[] };

export function validerSaisieEvaluation(e: {
  objectifs: ReadonlyArray<string>;
  notes: ReadonlyArray<number>;
  observations: ReadonlyArray<string>;
  recommandations?: string;
}): ResultatSaisie {
  if (e.objectifs.length === 0) {
    return { ok: false, erreurs: ["Cette formation n'a aucun objectif à évaluer."] };
  }
  const erreurs: string[] = [];
  const competences: CompetenceSaisie[] = [];

  e.objectifs.forEach((libelle, k) => {
    const note = e.notes[k];
    const observation = (e.observations[k] ?? "").trim();
    let valide = true;
    if (note !== 1 && note !== 2 && note !== 3) {
      erreurs.push(`« ${libelle} » : choisissez une note (1, 2 ou 3).`);
      valide = false;
    }
    if (observation.length < OBSERVATION_MIN || observation.length > OBSERVATION_MAX) {
      erreurs.push(
        `« ${libelle} » : l'observation est obligatoire (${OBSERVATION_MIN} à ${OBSERVATION_MAX} caractères).`,
      );
      valide = false;
    }
    if (valide) {
      competences.push({
        libelle,
        note: note as 1 | 2 | 3,
        observations: observation,
        objectifRef: libelle,
      });
    }
  });

  const recommandations = e.recommandations?.trim() ?? "";
  if (recommandations.length > RECOMMANDATIONS_MAX) {
    erreurs.push(`Les recommandations dépassent ${RECOMMANDATIONS_MAX} caractères.`);
  }
  if (erreurs.length > 0) return { ok: false, erreurs };
  return { ok: true, competences, ...(recommandations !== "" ? { recommandations } : {}) };
}
