// Section « avis clients » d'une page service — VRAIS avis publiés (DB), filtrés
// par service. Remplace les anciennes sections à avis fabriqués (Unsplash).
// Hide-if-empty : rend `null` tant qu'aucun avis publié n'existe pour ce service
// (et au build stub). Server Component async, 0 JS.
//
// Le balisage AggregateRating star-eligible vit sur la facette /avis/service/[…]
// (évite les nœuds Service dupliqués sur les pages service existantes).

import { Section } from "@/components/layout/Section";
import { Link } from "@/i18n/navigation";
import { ReviewCard } from "./ReviewCard";
import { StarRating } from "./StarRating";
import { getPublishedReviews, getAggregateRating } from "@/server/reviews/queries";
import { getServiceLine } from "@/lib/reviews/service-lines";
import { avisPublies } from "@/server/reviews/presence";
import { AGGREGATE_MIN_COUNT } from "@/lib/reviews/config";
import type { ServiceSector } from "../../../prisma/generated/client";

export async function ServiceReviewsSection({
  serviceLine,
  eyebrow = "Avis clients",
  title = "Ce que disent",
  titleEm = "nos clients",
}: {
  serviceLine: ServiceSector;
  eyebrow?: string;
  title?: string;
  titleEm?: string;
}) {
  // Règle automatique (src/content/preuves-sociales.ts) : rien sans avis publié.
  if (!(await avisPublies())) return null;

  const [{ items }, agg] = await Promise.all([
    getPublishedReviews({ serviceLine, pageSize: 3, sort: "featured" }),
    getAggregateRating({ serviceLine }),
  ]);
  if (items.length === 0) return null;

  const svc = getServiceLine(serviceLine);

  return (
    <Section eyebrow={eyebrow} title={title} titleEm={titleEm} tone="sand">
      {/* Note globale seulement à partir de AGGREGATE_MIN_COUNT (5) avis. */}
      {agg && agg.reviewCount >= AGGREGATE_MIN_COUNT ? (
        <div className="mb-6 flex items-center gap-3">
          <StarRating value={agg.ratingValue} size={20} showValue />
          <span className="text-fg-muted text-sm">{agg.reviewCount} avis clients</span>
        </div>
      ) : null}
      <ul className="grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <li key={r.id}>
            <ReviewCard review={r} />
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <Link
          href={
            svc
              ? { pathname: "/avis/service/[service]", params: { service: serviceLine } }
              : "/avis"
          }
          className="text-primary font-medium underline"
        >
          Voir tous les avis{svc ? ` — ${svc.labelFr}` : ""} →
        </Link>
      </p>
    </Section>
  );
}
