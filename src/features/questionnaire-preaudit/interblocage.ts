/**
 * Interblocage Postgres (40P01) et conflit de sérialisation (40001, P2034 côté Prisma) : deux
 * transactions qui se croisent, Postgres en annule UNE. L'annulation est complète (rien n'est écrit) :
 * rejouer la transaction est sûr, et c'est ce qu'il faut faire plutôt que de renvoyer une erreur 500 à
 * un salarié qui vient de répondre, ou d'avaler en silence la complétion de la fiche.
 *
 * Module PUR, sans import : léger à charger dans les tests.
 */

/** Vrai si l'erreur est un interblocage ou un conflit de sérialisation (jamais une autre panne). */
export function estInterblocage(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const c = x as { code?: unknown; meta?: { code?: unknown }; message?: unknown };
  if (c.code === "P2034" || c.code === "40P01" || c.code === "40001") return true;
  if (c.meta?.code === "40P01" || c.meta?.code === "40001") return true;
  return typeof c.message === "string" && /deadlock detected|\b40P01\b|\b40001\b/i.test(c.message);
}

/** Essais au total (le premier compris) : un croisement se défait presque toujours au second. */
export const ESSAIS_INTERBLOCAGE = 3;

/**
 * Rejoue `f` si — et seulement si — Postgres l'a annulée pour interblocage. Toute autre erreur
 * remonte telle quelle, ainsi que la dernière si les essais sont épuisés. Attente courte et
 * décalée au hasard (les deux transactions croisées ne repartent pas au même instant).
 */
export async function reessayerSiInterblocage<T>(
  f: () => Promise<T>,
  options: {
    readonly essais?: number;
    readonly attendre?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const essais = options.essais ?? ESSAIS_INTERBLOCAGE;
  const attendre = options.attendre ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let n = 1; ; n++) {
    try {
      return await f();
    } catch (e) {
      if (n >= essais || !estInterblocage(e)) throw e;
      await attendre(30 * n + Math.floor(Math.random() * 40));
    }
  }
}
