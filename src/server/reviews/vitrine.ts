// Avis à montrer dans un bloc « vitrine » (accueil, pages service) — règle
// automatique de src/content/preuves-sociales.ts, en un seul endroit :
// - aucun avis publié → aucune lecture, liste vide (le bloc ne s'affiche pas) ;
// - avis publiés → les avis, et la note globale seulement à partir de
//   AGGREGATE_MIN_COUNT (5) avis dans la portée (sinon `agg: null`).
// Stub-aware : `avisPublies()` rend 0 au build, donc rien n'est lu.

import "server-only";
import { avisPublies } from "./presence";
import {
  getAggregateRating,
  getPublishedReviews,
  type AggregateRatingData,
  type AggregateScope,
  type PublicReview,
  type ReviewSort,
} from "./queries";
import { noteGlobaleAffichable } from "@/lib/reviews/config";

export interface AvisVitrine {
  items: PublicReview[];
  /** Note globale de la portée, `null` sous 5 avis. */
  agg: AggregateRatingData | null;
}

export async function avisPourVitrine({
  scope = {},
  pageSize,
  sort = "featured",
}: {
  scope?: AggregateScope;
  pageSize: number;
  sort?: ReviewSort;
}): Promise<AvisVitrine> {
  if (!(await avisPublies())) return { items: [], agg: null };
  const [{ items }, agg] = await Promise.all([
    getPublishedReviews({ ...scope, sort, pageSize }),
    getAggregateRating(scope),
  ]);
  if (items.length === 0) return { items: [], agg: null };
  return { items, agg: noteGlobaleAffichable(agg) };
}
