/**
 * Relecture du lot 8A (suivi recommandé) — une relance formateur déjà garée dans la
 * corbeille de validation peut encore partir si un administrateur l'approuve après la
 * réponse du formateur. On ne bloque pas ce geste humain : on le renseigne. La corbeille
 * affiche « le formateur a répondu le … » quand une réponse humaine est arrivée APRÈS la
 * mise en attente de la relance.
 *
 * Interrupteur `formateurs.reponses_formateurs` coupé : aucune réponse n'est rangée, rien
 * n'est affiché. Base illisible : rien n'est affiché non plus (l'écran reste utilisable).
 */

import { reponsesFormateurs } from "./passer-campagnes";

export interface LigneGaree {
  readonly id: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly jobId: string | null;
  readonly createdAt: Date;
}

/** Une relance de campagne sur une fiche formateur (clé `fi-…`, cf. `cleRelance`). */
export const estRelanceFormateur = (l: LigneGaree): l is LigneGaree & { entityId: string } =>
  l.entityType === "Trainer" && l.entityId !== null && (l.jobId?.startsWith("fi-") ?? false);

/** La dernière réponse humaine arrivée après la mise en attente, par ligne de corbeille. */
export function reponsesApresMiseEnAttente(
  lignes: readonly LigneGaree[],
  reponses: ReadonlyMap<string, readonly Date[]> | null,
): Map<string, Date> {
  const sortie = new Map<string, Date>();
  if (reponses === null) return sortie;
  for (const l of lignes) {
    if (!estRelanceFormateur(l)) continue;
    const apres = (reponses.get(l.entityId) ?? []).filter(
      (r) => r.getTime() > l.createdAt.getTime(),
    );
    if (apres.length === 0) continue;
    sortie.set(l.id, new Date(Math.max(...apres.map((r) => r.getTime()))));
  }
  return sortie;
}

/** Lecture en lot pour la corbeille. */
export async function lireReponsesSurRelancesGarees(
  lignes: readonly LigneGaree[],
): Promise<Map<string, Date>> {
  const relances = lignes.filter(estRelanceFormateur);
  if (relances.length === 0) return new Map();
  const depuis = new Date(Math.min(...relances.map((l) => l.createdAt.getTime())));
  try {
    return reponsesApresMiseEnAttente(
      relances,
      await reponsesFormateurs(
        relances.map((l) => l.entityId),
        depuis,
      ),
    );
  } catch {
    return new Map();
  }
}
