/**
 * Prospection — Pilotage autonome de la complétion d'une campagne (production).
 *
 * Le coverage-worker (cron horaire) appelle ceci pour chaque campagne `active` :
 * décide s'il faut RÉ-ORCHESTRER (reste des cellules jamais lancées — quota
 * throttlé ou crash avant enfilage), MARQUER TERMINÉE (toutes les cellules ont
 * été traitées : `fait` ou `erreur`), ou ATTENDRE (collecte en vol). Combiné au
 * reclaimer stale (en_cours→erreur), une campagne converge toujours → « tous les
 * départements faits » sans intervention. Pur → testable sans DB.
 *
 * Note : les cellules `erreur` (exhaustivité : moins d'entreprises trouvées que
 * le dénominateur Stock) sont des LACUNES de couverture enregistrées, pas des
 * échecs à réessayer en boucle — elles se résorbent au prochain delta Sirene.
 */

export type CampaignAction = "reorchestrate" | "complete" | "wait";

export interface CampaignCellCounts {
  /** Cellules jamais lancées (à collecter). */
  aFaire: number;
  /** Cellules en cours de collecte (job en vol). */
  enCours: number;
}

export function decideCampaignAction(c: CampaignCellCounts): CampaignAction {
  if (c.aFaire > 0) return "reorchestrate"; // draine le reste (quota/crash)
  if (c.enCours === 0) return "complete"; // tout traité (fait ou erreur)
  return "wait"; // collecte encore en vol
}
