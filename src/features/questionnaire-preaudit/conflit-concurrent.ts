/**
 * Deux écritures croisées : Postgres lève un interblocage (40P01) ou un conflit de sérialisation
 * (40001) et ANNULE la transaction entière. Même reconnaissance que `dossier-client/trancher.ts`.
 *
 * Rejouer est sans risque seulement pour une transaction qui n'a AUCUN effet hors de la base
 * (pas d'e-mail, pas de file) : ses écritures ont disparu avec l'annulation, le nouvel essai ne
 * peut donc doubler ni une ligne ni un envoi. Ne pas envelopper un geste qui envoie.
 */

/** Nombre total d'essais (le premier compris) : borné, l'erreur remonte au dernier. */
export const ESSAIS_MAX_CONFLIT = 3;

export function estConflitConcurrent(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const c = x as { code?: unknown; meta?: { code?: unknown }; message?: unknown };
  if (c.code === "P2034" || c.code === "40P01" || c.code === "40001") return true;
  if (c.meta?.code === "40P01" || c.meta?.code === "40001") return true;
  return typeof c.message === "string" && /deadlock|40P01/i.test(c.message);
}

export async function avecNouvelEssaiSurConflit<T>(geste: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await geste();
    } catch (x) {
      if (essai >= ESSAIS_MAX_CONFLIT || !estConflitConcurrent(x)) throw x;
      // Petite pause croissante, pour que les deux écrivains ne se re-croisent pas aussitôt.
      await new Promise((r) => setTimeout(r, 25 * essai));
    }
  }
}
