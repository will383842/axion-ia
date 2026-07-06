// Avatar d'un avis : photo réelle (consentie) si fournie, sinon avatar de marque
// généré (motif orbital duotone, déterministe). Jamais d'initiales, jamais de stock.
// Server Component, 0 JS, 0 CLS (dimensions fixes).

import Image from "next/image";
import { avatarStyle, hashSeed } from "@/lib/reviews/avatar";

interface ReviewAvatarProps {
  /** Seed d'unicité + libellé a11y (ex. "Marie D. — Cabinet Dupont"). */
  name: string;
  photoUrl?: string | null;
  photoAlt?: string | null;
  size?: number;
  className?: string;
}

export function ReviewAvatar({
  name,
  photoUrl,
  photoAlt,
  size = 48,
  className,
}: ReviewAvatarProps) {
  const base = "flex-shrink-0 rounded-full";
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={photoAlt ?? name}
        width={size}
        height={size}
        sizes={`${size}px`}
        loading="lazy"
        decoding="async"
        className={`${base} object-cover ${className ?? ""}`}
      />
    );
  }

  const st = avatarStyle(name);
  const gradId = `avg-${hashSeed(name).toString(36)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Avatar ${name}`}
      className={`${base} ${className ?? ""}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={st.from} />
          <stop offset="100%" stopColor={st.to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      <g
        transform={`rotate(${st.rotation} 50 50)`}
        fill="none"
        stroke={st.accent}
        strokeOpacity="0.55"
      >
        <circle cx="50" cy="50" r="34" strokeWidth="2.5" />
        <ellipse cx="50" cy="50" rx="34" ry="14" strokeWidth="2" />
        <circle cx="84" cy="50" r="4.5" fill={st.accent} stroke="none" />
      </g>
    </svg>
  );
}
