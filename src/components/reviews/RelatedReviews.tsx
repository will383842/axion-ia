// « Avis suggérés » (même service / secteur / région). Hide-if-empty.

import { ReviewCard } from "./ReviewCard";
import type { PublicReview } from "@/server/reviews/queries";

export function RelatedReviews({
  reviews,
  title = "Avis similaires",
}: {
  reviews: ReadonlyArray<PublicReview>;
  title?: string;
}) {
  if (reviews.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <ul className="mt-6 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id}>
            <ReviewCard review={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
