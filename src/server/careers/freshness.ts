// Fraîcheur des offres d'emploi — requêtes serveur (DB + offres statiques).
//
// Consommé par : la pastille sidebar console (layout admin), le bandeau de la
// page /offres-emploi, et le cron hebdo `formation-crons.offres-fraicheur`.
// Fail-soft partout : une erreur DB rend 0 / [] (jamais de crash de layout).

import { prisma } from "@/lib/prisma";
import { JOB_OFFER_FRESHNESS_MAX_DAYS, STATIC_JOB_POSTINGS } from "@/content/recrutement/dates";
import { ageInDays, effectivePostedAt, isPostingStale } from "@/lib/careers/freshness";

export interface StaleJobPosting {
  /** id DB — null pour une offre statique (JobPosting inline dans une page). */
  id: string | null;
  /** Chemin console (offre DB) ou chemin public (offre statique). */
  slug: string;
  title: string;
  daysOld: number;
  kind: "db" | "statique";
}

/**
 * Offres publiées, indexables et non pourvues dont la date de publication
 * effective (celle que Google voit) dépasse le seuil — DB + statiques.
 * Triées de la plus ancienne à la plus récente.
 */
export async function listStaleJobPostings(now: Date = new Date()): Promise<StaleJobPosting[]> {
  const stale: StaleJobPosting[] = [];

  try {
    const offers = await prisma.jobOffer.findMany({
      where: {
        status: "published",
        filledAt: null,
        indexationTier: "tier_1_indexable",
        // validThrough passée = offre déjà close côté JSON-LD/noindex : hors périmètre.
        OR: [{ validThrough: null }, { validThrough: { gt: now } }],
      },
      select: { id: true, slug: true, titleFr: true, publishedAt: true, datePosted: true },
    });
    for (const o of offers) {
      const posted = effectivePostedAt(o);
      if (!isPostingStale(posted, now)) continue;
      stale.push({
        id: o.id,
        slug: o.slug,
        title: o.titleFr,
        daysOld: ageInDays(posted, now),
        kind: "db",
      });
    }
  } catch (err) {
    // Stub build GH Actions (findMany → []) ne passe pas ici ; vraie erreur DB → log.
    console.error("[careers-freshness] jobOffer.findMany a échoué:", err);
  }

  for (const s of STATIC_JOB_POSTINGS) {
    const posted = new Date(s.datePosted);
    if (!isPostingStale(posted, now)) continue;
    stale.push({
      id: null,
      slug: s.path,
      title: s.label,
      daysOld: ageInDays(posted, now),
      kind: "statique",
    });
  }

  return stale.sort((a, b) => b.daysOld - a.daysOld);
}

/** Compteur pour la pastille sidebar — même périmètre que la liste. */
export async function countStaleJobPostings(now: Date = new Date()): Promise<number> {
  return (await listStaleJobPostings(now)).length;
}

export { JOB_OFFER_FRESHNESS_MAX_DAYS };
