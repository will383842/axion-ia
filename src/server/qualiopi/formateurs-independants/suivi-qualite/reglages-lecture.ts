/**
 * Qualiopi ind. 21 — LECTURE des seuils et délais du suivi de la qualité pédagogique
 * (réglages modifiables en console, `/qualiopi/config`, clés `suivi_qualite_*`). Les
 * défauts, « à valider par Will », sont dans `reglages.ts` ; aucun lecteur ne les recopie.
 *
 * Ne lève jamais : un réglage illisible, hors bornes ou une base injoignable rend le
 * défaut (`reglagesSuiviQualite`).
 *
 * Module neutre (ni `server-only`, ni Next) : le moteur d'alertes tourne dans le worker.
 */

import type { QualiopiConfigKey } from "@/server/qualiopi/config/registry";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

import {
  REGLAGES_SUIVI_QUALITE,
  reglagesSuiviQualite,
  type ReglagesSuiviQualite,
} from "./reglages";

/** La clé de configuration de chaque réglage. */
export const CLES_SUIVI_QUALITE = {
  observationMoyenneMin: "suivi_qualite_observation_moyenne_min",
  reevaluationMoyenneMin: "suivi_qualite_reevaluation_moyenne_min",
  evaluationMoyenneMin: "suivi_qualite_evaluation_moyenne_min",
  observationAlerteJours: "suivi_qualite_observation_alerte_jours",
  evaluationRelanceJours: "suivi_qualite_evaluation_relance_jours",
  evaluationAlerteJours: "suivi_qualite_evaluation_alerte_jours",
  satisfactionEntretienSous: "suivi_qualite_satisfaction_entretien_sous",
  satisfactionSuspensionSous: "suivi_qualite_satisfaction_suspension_sous",
  reevaluationMois: "suivi_qualite_reevaluation_mois",
  reevaluationRappelJours: "suivi_qualite_reevaluation_rappel_jours",
  reevaluationGraceAllumageJours: "suivi_qualite_reevaluation_grace_allumage_jours",
  cvDeclareMaxMois: "suivi_qualite_cv_declare_max_mois",
  texteMinCaracteres: "suivi_qualite_texte_min_caracteres",
} as const satisfies Record<keyof ReglagesSuiviQualite, QualiopiConfigKey>;

export async function lireReglagesSuiviQualite(): Promise<ReglagesSuiviQualite> {
  try {
    const noms = Object.keys(CLES_SUIVI_QUALITE) as Array<keyof ReglagesSuiviQualite>;
    const valeurs = await Promise.all(noms.map((n) => getQualiopiConfig(CLES_SUIVI_QUALITE[n])));
    return reglagesSuiviQualite(
      Object.fromEntries(noms.map((n, i) => [n, valeurs[i]])) as {
        [K in keyof ReglagesSuiviQualite]: unknown;
      },
    );
  } catch {
    return REGLAGES_SUIVI_QUALITE;
  }
}
