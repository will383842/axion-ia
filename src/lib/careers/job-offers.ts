// Reader public des offres d'emploi (hub /carrieres + détail + sitemap).
// Stub-safe au build : sous DATABASE_URL=stub.invalid, le singleton Prisma
// renvoie [] / null → pages rendues vides, repeuplées par ISR revalidate=3600.
import { prisma } from "@/lib/prisma";
import type { JobOffer } from "../../../prisma/generated/client";

/** Offres publiées pour le hub (triées : ordre manuel, puis plus récentes). */
export async function listPublishedJobOffers(): Promise<JobOffer[]> {
  return prisma.jobOffer.findMany({
    where: { status: "published" },
    orderBy: [{ displayOrder: "asc" }, { datePosted: "desc" }],
  });
}

/** Une offre par slug (toutes statuts — la page gère noindex/404 selon l'état). */
export async function getJobOfferBySlug(slug: string): Promise<JobOffer | null> {
  return prisma.jobOffer.findUnique({ where: { slug } });
}

/**
 * Indexable ssi : publiée, non pourvue, tier_1, et non expirée (validThrough).
 * Sert au robots meta (C2), au sitemap et à generateStaticParams.
 */
export function isJobOfferIndexable(
  o: Pick<JobOffer, "status" | "filledAt" | "indexationTier" | "validThrough">,
  now: Date = new Date(),
): boolean {
  if (o.status !== "published") return false;
  if (o.filledAt) return false;
  if (o.indexationTier !== "tier_1_indexable") return false;
  if (o.validThrough && o.validThrough.getTime() < now.getTime()) return false;
  return true;
}

/** Slugs indexables (sitemap-carrieres + generateStaticParams). */
export async function listIndexableJobOfferSlugs(): Promise<string[]> {
  const rows = await prisma.jobOffer.findMany({
    where: { status: "published", filledAt: null, indexationTier: "tier_1_indexable" },
    select: { slug: true, validThrough: true },
  });
  const now = Date.now();
  return rows
    .filter((r) => !r.validThrough || r.validThrough.getTime() >= now)
    .map((r) => r.slug);
}

/**
 * Offres suggérées pour une page détail (maillage) : priorité même catégorie,
 * puis même ville, puis récentes. Exclut l'offre courante et les pourvues.
 * Renvoie [] si rien — la page masque le bloc si < 2 (anti-bloc maigre, D.1).
 */
export async function listSuggestedOffers(current: JobOffer, limit = 4): Promise<JobOffer[]> {
  const pool = await prisma.jobOffer.findMany({
    where: { status: "published", filledAt: null, id: { not: current.id } },
    orderBy: [{ datePosted: "desc" }],
    take: 24,
  });
  const score = (o: JobOffer): number =>
    (o.category === current.category ? 0 : 2) + (o.city && o.city === current.city ? -1 : 0);
  return [...pool].sort((a, b) => score(a) - score(b)).slice(0, limit);
}
