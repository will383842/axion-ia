// Construction du JSON-LD des avis (Review par fiche + AggregateRating gaté).
//
// Règle E-E-A-T / Google : l'AggregateRating n'est émis que si le nombre d'avis
// publiés atteint AGGREGATE_MIN_COUNT (≥ 5). En-dessous → aucun balisage de note
// agrégée (évite le « données factices »). L'AggregateRating est NICHÉ sur l'entité
// notée (Organization / Service / Course) — forme correcte schema.org.

import "server-only";
import { buildReviewJsonLd, SITE_URL } from "@/lib/seo";
import { getServiceLine } from "@/lib/reviews/service-lines";
import { AGGREGATE_MIN_COUNT } from "@/lib/reviews/config";
import { reviewAuthorName } from "@/lib/reviews/display";
import type { ReviewItemType } from "@/lib/reviews/service-lines";
import type { PublicReview, AggregateRatingData } from "./queries";

export type ItemReviewed = { type: ReviewItemType | "Organization"; name: string };

/** Entité notée par un avis : le service concerné, sinon l'Organization. */
export function reviewItemReviewed(r: PublicReview): ItemReviewed {
  const svc = r.serviceLine ? getServiceLine(r.serviceLine) : undefined;
  return svc
    ? { type: svc.itemType, name: svc.schemaName }
    : { type: "Organization", name: "Axion-IA" };
}

/** JSON-LD `Review` d'un avis (pour la fiche `/avis/[slug]`). */
export function reviewToJsonLd(r: PublicReview) {
  return buildReviewJsonLd({
    authorName: reviewAuthorName(r),
    ratingValue: r.rating,
    reviewBody: r.comment,
    itemReviewed: reviewItemReviewed(r),
    datePublished: (r.publishedAt ?? r.createdAt).toISOString(),
  });
}

/** Objet `AggregateRating` niché (null si sous le seuil de publication). */
export function aggregateRatingNode(agg: AggregateRatingData | null) {
  if (!agg || agg.reviewCount < AGGREGATE_MIN_COUNT) return null;
  return {
    "@type": "AggregateRating" as const,
    ratingValue: agg.ratingValue,
    reviewCount: agg.reviewCount,
    bestRating: agg.bestRating,
    worstRating: 1,
  };
}

/** Organization + aggregateRating pour le hub /avis (null si sous le seuil). */
export function orgAggregateJsonLd(agg: AggregateRatingData | null) {
  const ar = aggregateRatingNode(agg);
  if (!ar) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Axion-IA",
    aggregateRating: ar,
  } as const;
}

/** Entité (Service/Course/Product) + aggregateRating pour une facette service (null si sous seuil). */
export function serviceAggregateJsonLd(
  item: ItemReviewed,
  agg: AggregateRatingData | null,
  url: string,
) {
  const ar = aggregateRatingNode(agg);
  if (!ar) return null;
  return {
    "@context": "https://schema.org",
    "@type": item.type,
    name: item.name,
    url,
    ...(item.type === "Course" ? { provider: { "@type": "Organization", name: "Axion-IA" } } : {}),
    aggregateRating: ar,
  } as const;
}
