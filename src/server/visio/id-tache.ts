/**
 * L'identifiant d'une tâche du circuit visio — SEULE fonction qui le fabrique
 * (chantier visio, PR 4 ; `LOTS-EXECUTION.md` §1.4).
 *
 * `visio-<étape>-<rencontreId>-<exécution>`. Il sert deux fois :
 *   · `jobId` BullMQ : une même étape d'une même exécution n'est jamais mise
 *     deux fois en file ;
 *   · `cost_ledger.jobId` (PR 6) : un coût OpenAI se rattache à un rendez-vous.
 *
 * ⚠️ BullMQ 5 REFUSE un identifiant personnalisé qui contient « : » (sauf la
 * forme héritée à trois segments des tâches répétées) ou qui n'est qu'un
 * entier. Le tiret est donc le seul séparateur. Garde, contre la VRAIE
 * validation de BullMQ :
 * `src/server/visio/__tests__/un-identifiant-de-tache-visio-est-accepte-par-bullmq.spec.ts`.
 *
 * Module PUR.
 */

/** Préfixe de tout identifiant de tâche du circuit (et de ses coûts). */
export const PREFIXE_TACHE_VISIO = "visio";

const ETAPE_VALIDE = /^[a-z][a-z0-9_]*$/;

export function idTacheVisio(etape: string, rencontreId: string, execution: number): string {
  if (!ETAPE_VALIDE.test(etape)) {
    throw new Error(`identifiant de tâche visio : étape invalide (${JSON.stringify(etape)})`);
  }
  if (!/^[0-9a-f-]{8,}$/i.test(rencontreId)) {
    throw new Error("identifiant de tâche visio : identifiant de rencontre invalide");
  }
  if (!Number.isInteger(execution) || execution < 0) {
    throw new Error("identifiant de tâche visio : numéro d'exécution invalide");
  }
  return `${PREFIXE_TACHE_VISIO}-${etape}-${rencontreId}-${execution}`;
}

/** Identifiant d'un passage du balayage (une fenêtre de 5 minutes). */
export function idPassageBalayage(maintenant: Date): string {
  const tranche = Math.floor(maintenant.getTime() / (5 * 60_000));
  return `${PREFIXE_TACHE_VISIO}-balayage-${tranche}`;
}
