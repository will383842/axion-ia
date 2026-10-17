/**
 * Qualiopi ind. 27 — LECTURE des seuils de contrôle (réglages modifiables en console,
 * `/qualiopi/config`, clés `sous_traitance_*`). Les défauts, « à valider par Will »,
 * sont dans `controles.config.ts` ; aucun lecteur ne les recopie.
 *
 * Ne lève jamais : un réglage illisible, hors bornes ou une base injoignable rend le
 * défaut (`reglagesInd27`).
 *
 * Module neutre (ni `server-only`, ni Next) : le moteur d'alertes tourne dans le worker.
 */

import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

import { REGLAGES_IND27_DEFAUTS, type ReglagesInd27 } from "./controles.config";
import { reglagesInd27 } from "./ecarts-regles";

export async function lireReglagesInd27(): Promise<ReglagesInd27> {
  try {
    const [delaiCorrectionJours, revueCompleteMois] = await Promise.all([
      getQualiopiConfig("sous_traitance_delai_correction_jours"),
      getQualiopiConfig("sous_traitance_revue_complete_mois"),
    ]);
    return reglagesInd27({ delaiCorrectionJours, revueCompleteMois });
  } catch {
    return REGLAGES_IND27_DEFAUTS;
  }
}
