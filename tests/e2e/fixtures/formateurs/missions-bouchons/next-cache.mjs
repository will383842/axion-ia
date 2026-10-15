// Banc @formateurs — `next/cache` remplacé : il n'y a aucune page à revalider.
export function revalidatePath() {}
export function revalidateTag() {}
export function updateTag() {}
export function refresh() {}
export function unstable_noStore() {}
export function unstable_cache(fn) {
  return fn;
}
export function cacheLife() {}
export function cacheTag() {}
