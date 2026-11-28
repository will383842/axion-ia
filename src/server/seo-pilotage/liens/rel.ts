/**
 * S10-1 · Lecture de l'attribut `rel` d'un lien. Module PUR.
 *
 * Résultat : `suivi` (aucun jeton qui coupe le suivi), `nofollow`, `ugc`, `sponsored`, une liste
 * triée de ces jetons (`nofollow,ugc`), ou `inconnu` (le lien n'a pas été examiné).
 */
export type ValeurRel = string;

const JETONS_SIGNIFICATIFS: ReadonlySet<string> = new Set(["nofollow", "ugc", "sponsored"]);

/**
 * @param attribut valeur brute de `rel` ; `null` ou vide = lien examiné sans `rel` ;
 *                 `undefined` = lien non examiné.
 */
export function lireRel(attribut: string | null | undefined): ValeurRel {
  if (attribut === undefined) return "inconnu";
  const jetons = new Set<string>();
  for (const j of (attribut ?? "").toLowerCase().split(/\s+/)) {
    if (JETONS_SIGNIFICATIFS.has(j)) jetons.add(j);
  }
  return jetons.size === 0 ? "suivi" : [...jetons].sort().join(",");
}
