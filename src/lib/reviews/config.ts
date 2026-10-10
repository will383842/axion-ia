// Seuils centralisés du système d'avis clients (SSOT).
// Fichier PUR — importable client ET serveur.

/**
 * Nombre minimum d'avis PUBLIÉS requis pour émettre un `AggregateRating` JSON-LD.
 * Règle E-E-A-T / Google : ne jamais baliser une note agrégée sur un échantillon
 * trop faible (risque « données factices »). Aligné sur la décision figée à la
 * home (audit perfection mai 2026 : « réactiver quand ≥ 5 vrais avis datés »).
 */
export const AGGREGATE_MIN_COUNT = 5;

/**
 * Note globale (étoiles, moyenne, AggregateRating) affichable ? Seulement à partir
 * de AGGREGATE_MIN_COUNT avis publiés dans la portée ; en dessous → `null`, et les
 * avis s'affichent sans note. Règle unique pour toutes les pages (2026-10-09).
 */
export function noteGlobaleAffichable<T extends { reviewCount: number }>(
  agg: T | null | undefined,
): T | null {
  return agg && agg.reviewCount >= AGGREGATE_MIN_COUNT ? agg : null;
}

/**
 * Nombre minimum d'avis publiés pour qu'une page facette (ville / secteur /
 * service / département) soit rendue + indexée. En-dessous → `notFound()` :
 * évite les pages thin / doorway (crawl budget préservé).
 */
export const FACET_MIN_COUNT = 3;

/** Taille de page par défaut pour la grille d'avis du hub. */
export const REVIEWS_PAGE_SIZE = 12;

/** Note maximale (échelle sur 5). */
export const RATING_BEST = 5;
