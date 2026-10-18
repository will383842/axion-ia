/**
 * Qualiopi ind. 21 — LECTURE des seuils de l'évaluation des compétences (réglages
 * modifiables en console, `/qualiopi/config`, clés `evaluation_competences_*`). Les
 * défauts, « à valider par Will », sont dans `reglages.ts` ; aucun lecteur ne les recopie.
 *
 * Ne lève jamais : un réglage illisible, hors bornes ou une base injoignable rend le
 * défaut (`reglagesEvaluation`).
 *
 * Module neutre (ni `server-only`, ni Next) : le worker peut le charger.
 */

import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

import { REGLAGES_EVALUATION, reglagesEvaluation, type ReglagesEvaluation } from "./reglages";

export async function lireReglagesEvaluation(): Promise<ReglagesEvaluation> {
  try {
    const [entretienMoyenneMin, entretienNoteCritereMin, miseEnSituationNoteBlocMin] =
      await Promise.all([
        getQualiopiConfig("evaluation_competences_entretien_moyenne_min"),
        getQualiopiConfig("evaluation_competences_entretien_note_critere_min"),
        getQualiopiConfig("evaluation_competences_mise_en_situation_note_bloc_min"),
      ]);
    return reglagesEvaluation({
      entretienMoyenneMin,
      entretienNoteCritereMin,
      miseEnSituationNoteBlocMin,
    });
  } catch {
    return REGLAGES_EVALUATION;
  }
}
