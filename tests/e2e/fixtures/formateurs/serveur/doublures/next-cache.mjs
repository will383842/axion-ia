// Doublure de `next/cache` : hors d'un rendu Next, l'invalidation n'a rien à
// invalider. Les lectures mises en cache s'exécutent telles quelles.
export function revalidatePath() {}
export function revalidateTag() {}
export function updateTag() {}
export function refresh() {}
export function unstable_noStore() {}
export function noStore() {}
export function cacheTag() {}
export function cacheLife() {}
export function unstable_cache(fn) {
  return fn;
}
