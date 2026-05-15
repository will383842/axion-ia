/**
 * Content Generator — Review queue errors (déplacés hors "use server").
 *
 * Next.js 16 (strict mode v16.2+) interdit l'export de symboles non-async
 * dans un fichier marqué `"use server"`. Cette classe d'erreur était
 * historiquement co-localisée dans `review.ts` ; isolée ici pour permettre
 * le build webpack production.
 */

import type { ReviewStatus } from "../../../../prisma/generated/client";

/**
 * Erreur transition review déjà appliquée (race multi-admin).
 *
 * Throw quand Will A et Will B (ou Will + onglet dupliqué) cliquent
 * "Approuver" simultanément. L'`updateMany` atomique avec where status='pending'
 * garantit qu'un seul winner update la row → l'autre obtient count=0 et
 * récupère cette exception pour afficher un toast "déjà traité".
 */
export class ReviewAlreadyTransitionedError extends Error {
  readonly code = "review_already_transitioned";
  constructor(public readonly currentStatus?: ReviewStatus) {
    super("review_already_transitioned");
    this.name = "ReviewAlreadyTransitionedError";
  }
}
