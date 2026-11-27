/**
 * Règle d'indexation d'une page galerie `/galerie/[slug]`, partagée entre la
 * page (`generateMetadata`) et les plans du site d'images.
 *
 * Source unique : si la page est en `noindex`, le plan du site ne doit pas
 * l'annoncer (audit S2-1, `docs/pilotage-seo-geo/S2-TRI-INDEXATION.md`).
 */

/**
 * Vrai si la traduction porte assez de contenu unique pour mériter l'indexation
 * (anti-doorway). Bar volontairement basse : toute image correctement enrichie
 * la franchit ; seules les images encore au stade placeholder sont exclues.
 */
export function hasSubstantiveContent(tr: {
  description?: string | null;
  aiSummary?: string | null;
}): boolean {
  return (tr.description?.trim().length ?? 0) >= 100 || (tr.aiSummary?.trim().length ?? 0) >= 100;
}

/**
 * Vrai si la page galerie de cette locale est indexable : seul le FR l'est
 * (l'EN est désactivé, 301 → FR) ET la traduction doit être substantielle.
 */
export function isGalleryPageIndexable(
  locale: string,
  tr: { description?: string | null; aiSummary?: string | null },
): boolean {
  return locale === "fr" && hasSubstantiveContent(tr);
}
