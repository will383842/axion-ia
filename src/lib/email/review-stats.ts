// Stats avis clients pour les emails (bandeau de confiance) — valeurs RÉELLES
// lues depuis `customer_reviews` (status=published), via le helper unique
// `statsAvisPublies()` (src/server/reviews/presence.ts, cache 5 min).
//
// Règle automatique : 0 avis publié → `{ count: 0, avg: 0 }` → le bandeau masque
// la ligne avis ; elle n'apparaît qu'à partir de 5 avis (seuil dans `_layout.tsx`).
// Build-safety (ADR 0026) : au build, le helper renvoie 0 sans appel à la base.

import { statsAvisPublies, type StatsAvisPublies } from "@/server/reviews/presence";

export type ReviewStats = StatsAvisPublies;

export async function getPublishedReviewStats(): Promise<ReviewStats> {
  return statsAvisPublies();
}
