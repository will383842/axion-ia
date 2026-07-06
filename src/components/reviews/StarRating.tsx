// Affichage d'une note en étoiles (supporte les valeurs fractionnaires, ex. 4,7/5).
// Server Component pur, 0 JS, 0 CLS (dimensions fixes). Technique 2 couches :
// une rangée « vide » + une rangée « pleine » clippée à `value/best %`.

import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  bestRating?: number;
  /** Taille d'une étoile en px. */
  size?: number;
  /** Affiche « 4,7 / 5 » à côté. */
  showValue?: boolean;
  className?: string;
}

function Row({ size, filled }: { size: number; filled: boolean }) {
  return (
    <span className="inline-flex" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          strokeWidth={1.5}
          className={
            filled ? "text-terracotta fill-current" : "text-border-strong fill-transparent"
          }
        />
      ))}
    </span>
  );
}

export function StarRating({
  value,
  bestRating = 5,
  size = 18,
  showValue = false,
  className,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(bestRating, value));
  const pct = (clamped / bestRating) * 100;
  const label = `Note : ${clamped.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} sur ${bestRating}`;
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <span role="img" aria-label={label} className="relative inline-flex">
        <Row size={size} filled={false} />
        <span
          className="absolute inset-0 inline-flex overflow-hidden"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          <Row size={size} filled />
        </span>
      </span>
      {showValue ? (
        <span className="text-fg text-sm font-semibold tabular-nums">
          {clamped.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          <span className="text-fg-muted font-normal"> / {bestRating}</span>
        </span>
      ) : null}
    </span>
  );
}
