// Carte d’un avis client (grille du hub + facettes + « avis liés »).
// Server Component. Affiche : étoiles, badge « Vérifié », titre, extrait, réponse
// Axion-IA repliée, auteur (avatar de marque ou photo), méta secteur/ville.

import { BadgeCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StarRating } from "./StarRating";
import { ReviewAvatar } from "./ReviewAvatar";
import type { PublicReview } from "@/server/reviews/queries";
import { serviceLineLabel } from "@/lib/reviews/service-lines";
import { reviewAuthorName, reviewMetaLine } from "@/lib/reviews/display";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

interface ReviewCardProps {
  review: PublicReview;
  className?: string;
}

export function ReviewCard({ review, className }: ReviewCardProps) {
  const author = reviewAuthorName(review);
  const meta = reviewMetaLine(review);
  const date = review.publishedAt ?? review.createdAt;
  const detailHref = { pathname: "/avis/[slug]" as const, params: { slug: review.slug } };

  return (
    <article
      className={`bg-paper border-border shadow-card flex h-full flex-col rounded-2xl border p-6 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <StarRating value={review.rating} size={16} />
        {review.isVerified ? (
          <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
            <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.25} />
            Vérifié
          </span>
        ) : null}
      </div>

      {review.title ? (
        <h3 className="mt-3 font-serif text-lg leading-snug font-semibold">
          <Link href={detailHref} className="hover:text-terracotta">
            {review.title}
          </Link>
        </h3>
      ) : null}

      <p className="text-fg-soft mt-2 line-clamp-5 text-sm leading-relaxed">{review.comment}</p>

      {review.serviceLine ? (
        <p className="text-fg-muted mt-3 text-xs">
          Service : {serviceLineLabel(review.serviceLine)}
        </p>
      ) : null}

      {review.replyBody ? (
        <div className="border-border bg-sand/60 border-l-terracotta mt-4 rounded-lg border-l-2 p-3">
          <p className="text-terracotta-deep text-xs font-semibold">Réponse d’Axion-IA</p>
          <p className="text-fg-soft mt-1 line-clamp-3 text-xs leading-relaxed">
            {review.replyBody}
          </p>
        </div>
      ) : null}

      <footer className="border-border mt-5 flex items-center gap-3 border-t pt-4">
        <ReviewAvatar
          name={author}
          photoUrl={review.photoUrl}
          photoAlt={review.photoAlt}
          size={44}
        />
        <div className="min-w-0">
          <p className="text-fg truncate font-medium">{author}</p>
          {meta ? <p className="text-terracotta truncate text-xs">{meta}</p> : null}
          <p className="text-fg-muted text-xs">
            <time dateTime={date.toISOString()}>{DATE_FMT.format(date)}</time>
          </p>
        </div>
        <Link
          href={detailHref}
          className="text-primary ml-auto self-start text-xs whitespace-nowrap hover:underline"
          aria-label={`Lire l’avis de ${author}`}
        >
          Lire →
        </Link>
      </footer>
    </article>
  );
}
