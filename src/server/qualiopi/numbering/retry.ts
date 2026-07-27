/**
 * Qualiopi — Retry atomique de numérotation séquentielle (R7 audit E2E 2026-06-06).
 *
 * Les numéros (AXI-CLI/DEV/FORM/SESS/FACT…) sont alloués par `nextNumero`
 * (MAX(séquence) + 1) puis insérés. Sous création concurrente, deux requêtes
 * peuvent lire le même maximum et générer le même numéro : la contrainte
 * `@unique` en DB garantit qu'AUCUN doublon n'est inséré (la 2ᵉ insertion reçoit
 * P2002), mais l'erreur remontait jusqu'à l'appelant. Ce helper ré-alloue et
 * réessaie sur P2002 (jusqu'à `attempts` fois).
 *
 * ⚠️ CE HELPER N'A ÉTÉ RÉELLEMENT UTILE QU'À PARTIR DU CORRECTIF V20. Tant que
 * l'allocation reposait sur `count + 1`, relancer la closure recalculait un
 * résultat DÉTERMINISTE : les cinq tentatives produisaient le même numéro et
 * l'opération échouait durement. C'était un placebo, et six modules l'ont
 * pourtant documenté comme « garde-fou final ». Avec la borne haute, le MAX
 * progresse dès qu'une insertion concurrente a abouti : la reprise converge.
 *
 * COROLLAIRE : ne jamais remettre un `count()` dans une closure passée ici.
 *
 * Modèle pur (aucun import Prisma) : l'appelant fournit l'opération
 * « allouer le numéro + insérer » ; on relance la closure entière sur P2002.
 */

/** Code d'erreur Prisma pour violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = "P2002";

/**
 * Exécute `op` (allocation du numéro + insertion) et la relance si une collision
 * d'unicité (P2002) survient — utile pour la numérotation séquentielle `count+1`.
 *
 * @param op       Closure qui (ré)alloue le numéro ET insère, retournant le résultat.
 * @param attempts Nombre maximal de tentatives (défaut 5).
 * @throws La dernière erreur P2002 si toutes les tentatives échouent, ou toute
 *         autre erreur immédiatement (non liée à l'unicité).
 */
export async function withNumberRetry<T>(op: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await op();
    } catch (err) {
      if ((err as { code?: string })?.code === UNIQUE_VIOLATION) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
