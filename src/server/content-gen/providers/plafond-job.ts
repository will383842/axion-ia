/**
 * Garde de plafond par job (équipe éditoriale, PR 12).
 *
 * Le worker inscrit, pour un `jobId`, une fonction qui lève quand le plafond de coût du job
 * est atteint. Le routeur de fournisseurs l'attend AVANT chaque appel payant : ainsi les
 * appels internes du générateur et l'appel court de réparation de la réponse directe sont
 * couverts, sans modifier chaque générateur. Aucun job inscrit (équipe éteinte) = aucun effet.
 */

type Garde = () => Promise<unknown>;

const gardes = new Map<string, Garde>();

/** Inscrit la garde d'un job ; rend la fonction qui la retire (à appeler dans un `finally`). */
export function inscrirePlafondJob(jobId: string, garde: Garde): () => void {
  gardes.set(jobId, garde);
  return () => {
    if (gardes.get(jobId) === garde) gardes.delete(jobId);
  };
}

/** Attend la garde du job, s'il y en a une. Lève ce que la garde lève (plafond, lecture en échec). */
export async function verifierPlafondJob(jobId: string | undefined): Promise<void> {
  if (!jobId) return;
  const garde = gardes.get(jobId);
  if (garde) await garde();
}
