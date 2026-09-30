/**
 * Rafraîchissement du jeton de session admin (callback `jwt` de `src/auth.ts`).
 *
 * Sprint 24 / B3 : à chaque rafraîchissement, le compte est relu en base sous
 * un cache de 60 s ; suspendu ou supprimé → `null`, Auth.js détruit la session.
 *
 * S1 (vérification finale du chantier visio, 30/09) : le RÔLE est relu avec le
 * statut et réécrit dans le jeton. Il n'était écrit qu'à la connexion : un
 * administrateur rétrogradé gardait, jusqu'à 30 jours, les droits de son
 * ancien rôle — dont la lecture des échanges clients (décision A2), que
 * `exigerAccesEchanges` et `gardeLectureEchanges` décident sur ce rôle.
 *
 * Module Node (Prisma) : jamais importé par la config Edge (`auth.config.ts`).
 */

import { prisma } from "./prisma";

/** Borne de révocation : un changement de statut ou de rôle vaut sous 60 s. */
export const CACHE_COMPTE_ADMIN_MS = 60_000;

interface CompteLu {
  readonly status: string;
  readonly role: string;
  readonly lu: number;
}

// Map de module : survit aux requêtes du runtime Node, bornée par les redémarrages.
const cache = new Map<string, CompteLu>();

/** Vide le cache (tests). */
export function oublierCacheAdmin(): void {
  cache.clear();
}

async function lireCompte(id: string, maintenant: number): Promise<CompteLu | null> {
  const enCache = cache.get(id);
  if (enCache && maintenant - enCache.lu < CACHE_COMPTE_ADMIN_MS) return enCache;
  const ligne = await prisma.adminUser.findUnique({
    where: { id },
    select: { status: true, role: true },
  });
  if (!ligne) {
    cache.delete(id);
    return null;
  }
  const lu: CompteLu = { status: ligne.status, role: ligne.role, lu: maintenant };
  cache.set(id, lu);
  return lu;
}

/**
 * Le callback `jwt` : copie l'identifiant à la connexion, puis relit statut
 * ET rôle. Rend `null` si le compte n'est plus actif.
 */
export async function rafraichirJetonAdmin<T extends Record<string, unknown>>(
  entree: {
    readonly token: T;
    readonly user?: { readonly id?: string | undefined; readonly role?: unknown } | undefined;
  },
  maintenant: number = Date.now(),
): Promise<T | null> {
  const token: Record<string, unknown> = entree.token;
  if (entree.user) {
    token["id"] = entree.user.id;
    token["role"] = entree.user.role;
  }
  const id = typeof token["id"] === "string" ? token["id"] : null;
  if (!id) return entree.token;
  const compte = await lireCompte(id, maintenant);
  if (!compte || compte.status !== "active") return null;
  token["role"] = compte.role;
  return entree.token;
}
