/**
 * Qualiopi ind. 21 — GARDE DE MISSION : aucune mission confiée à un indépendant sur une
 * formation sans décision d'habilitation EN VIGUEUR pour CETTE formation (la dernière
 * décision versée est « habilité » ou « avec réserve »).
 *
 * Composée par `controlerGardeMission` (garde-mission-portes.ts) avec les autres manques :
 * elle suit donc le même interrupteur (`formateurs.garde_mission_portes`, coupé = rien
 * n'est lu ni refusé) et le même mode (avertir / refuser).
 *
 * 🔴 Module PUR, garde FERMÉE : lignes non lues ou formation inconnue = manque.
 */

import {
  MANQUE_MISSION_FORMATION_INCONNUE,
  MANQUE_MISSION_HABILITATION,
  decisionEnVigueur,
  etatEvaluation,
  type LigneEvaluationLue,
} from "./regles";

/**
 * `formationId` :
 *  - une chaîne : la formation de la mission, elle doit avoir sa décision en vigueur ;
 *  - `null` : la mission est en jeu mais sa formation est illisible : refus ;
 *  - `undefined` : aucune mission précise (contrôle général) : au moins une formation
 *    avec une décision en vigueur.
 */
export function manqueHabilitationMission(
  statut: string,
  evaluations: ReadonlyArray<LigneEvaluationLue> | undefined,
  formationId: string | null | undefined,
): string | null {
  if (statut === "salarie" || statut === "dirigeant") return null;
  if (formationId === null) return MANQUE_MISSION_FORMATION_INCONNUE;
  const lignes = evaluations ?? [];
  if (formationId === undefined) {
    return etatEvaluation(lignes).formationsHabilitees.length > 0
      ? null
      : MANQUE_MISSION_HABILITATION;
  }
  return decisionEnVigueur(lignes, formationId) ? null : MANQUE_MISSION_HABILITATION;
}
