/**
 * Slug d'un NOUVEL article généré — refus des doublons (2026-09-26).
 *
 * Avant : un slug déjà pris était suffixé `-2`, `-3`, … (anti-collision du
 * 2026-07-01, pour éviter le crash sur `@@unique([locale, slug])`). Mesuré le
 * 2026-09-26 via Search Console : ces suffixes publiaient de VRAIS doublons —
 * `meilleures-certifications-ia-france-2026-comparatif` existait en 5 versions
 * au titre quasi identique, `formation-ia-dirigeants-pme` en 3. Le keyword-lock
 * n'empêche que la génération CONCURRENTE : une fois le premier article publié,
 * le lock est relâché et le même sujet peut revenir des semaines plus tard.
 * Google n'indexe pas ces quasi-doublons et ils diluent la confiance du site.
 *
 * Désormais : un slug déjà pris = sujet déjà couvert → on refuse de publier
 * (retour `null`), l'appelant marque le job en échec avec la raison.
 */
export async function resolveNewArticleSlug(
  candidate: string,
  slugTaken: (slug: string) => Promise<boolean>,
): Promise<string | null> {
  return (await slugTaken(candidate)) ? null : candidate;
}
