// Histogramme de répartition des notes (5★ → 1★). Server Component, 0 JS, 0 CLS.

import type { AggregateRatingData } from "@/server/reviews/queries";
import { StarRating } from "./StarRating";

export function RatingBreakdown({ agg }: { agg: AggregateRatingData }) {
  const total = agg.reviewCount || 1;
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
      <div className="text-center sm:text-left">
        <p className="font-serif text-5xl font-semibold tabular-nums">
          {agg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}
        </p>
        <StarRating
          value={agg.ratingValue}
          size={20}
          className="mt-1 justify-center sm:justify-start"
        />
        <p className="text-fg-muted mt-1 text-sm">
          {agg.reviewCount} avis vérifié{agg.reviewCount > 1 ? "s" : ""}
        </p>
      </div>
      <ul className="flex-1 space-y-1.5" aria-label="Répartition des notes">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = agg.breakdown[star as 1 | 2 | 3 | 4 | 5];
          const pct = Math.round((n / total) * 100);
          return (
            <li key={star} className="flex items-center gap-3 text-sm">
              <span className="text-fg-muted w-10 shrink-0 tabular-nums">{star} ★</span>
              <span className="bg-sand relative h-2.5 flex-1 overflow-hidden rounded-full">
                <span
                  className="bg-terracotta absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="text-fg-muted w-10 shrink-0 text-right tabular-nums">{n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
