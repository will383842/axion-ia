/**
 * Règle d'indexation d'un communiqué `/presse/[slug]`, partagée entre la page
 * (`generateMetadata`) et le plan du site `buildPresseSitemap`.
 *
 * Source unique : un communiqué en `noindex` n'est pas annoncé au plan du site
 * (audit S2-2, `docs/pilotage-seo-geo/S2-TRI-INDEXATION.md`).
 */

/**
 * Seuil anti-doorway (HCU 2024) : un communiqué sans PDF doit faire au moins
 * 60 mots de corps pour être indexé.
 */
export const MIN_BODY_WORDS = 60;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Vrai si le communiqué est indexable : un PDF embarqué (le fichier EST le
 * contenu, corps vide) l'est toujours ; sinon le corps doit atteindre le seuil.
 */
export function communiqueIndexable(release: {
  pdfUrl?: string | null;
  body?: string | null;
}): boolean {
  if (release.pdfUrl) return true;
  return countWords(release.body ?? "") >= MIN_BODY_WORDS;
}
