// Fraîcheur des offres d'emploi — logique PURE (sans Prisma), testable.
//
// Google for Jobs privilégie les offres récentes (filtres « 3 derniers jours /
// dernière semaine ») : une offre dont le datePosted vieillit devient invisible.
// On ne rafraîchit JAMAIS une date automatiquement (fausse fraîcheur = violation
// des règles Google) — on DÉTECTE les offres qui vieillissent et on demande à
// l'admin une republication humaine (bouton « Republier » console, cron Telegram).

import { JOB_OFFER_FRESHNESS_MAX_DAYS } from "@/content/recrutement/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Âge en jours ENTIERS d'une date de publication (0 si dans le futur). */
export function ageInDays(posted: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - posted.getTime()) / DAY_MS));
}

/**
 * Date effective de publication d'une offre DB — même règle que le JSON-LD
 * (`job-posting.ts` : `publishedAt ?? datePosted`), sinon la pastille compterait
 * une offre que Google, lui, voit fraîche (ou l'inverse).
 */
export function effectivePostedAt(offer: { publishedAt: Date | null; datePosted: Date }): Date {
  return offer.publishedAt ?? offer.datePosted;
}

/** Vrai si l'offre a dépassé le seuil de republication. */
export function isPostingStale(
  posted: Date,
  now: Date,
  maxDays: number = JOB_OFFER_FRESHNESS_MAX_DAYS,
): boolean {
  return ageInDays(posted, now) > maxDays;
}
