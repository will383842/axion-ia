import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ClientLogo } from "@/content/home-data";

export type { ClientLogo };

interface LogosMarqueeProps {
  logos: ClientLogo[];
  /** Conservé pour compat API — non utilisé en mode grille statique. */
  speedSec?: number;
  className?: string;
}

// Polish v8 (Will 2026-05-23) : NORMALISATION VISUELLE STRICTE des logos.
// Chaque logo est dans un container fixe de même dimension (h-16 w-32),
// avec `object-contain` → l'image est centrée et redimensionnée pour
// rentrer en respectant son ratio. Tous les logos paraissent à la même
// "grosseur visuelle" malgré leurs ratios SVG différents (carré Wikimedia
// vs wordmark allongé).
//
// Avant : `h-9 w-auto` faisait que les logos carrés (Wikimedia avec fond
// blanc 192x192) paraissaient minuscules à côté des wordmarks allongés.
// Maintenant : tous occupent la même boîte 128×64 px.
//
// Grille responsive : 3 col mobile / 4 sm / 5 md / 6 lg / 9 xl (9 = ligne
// unique sur 1280+ avec 17 logos = 9+8 sur 2 lignes).
export function LogosMarquee({ logos, className }: LogosMarqueeProps) {
  return (
    <ul
      aria-label="Logos clients Axion-IA"
      className={cn(
        "grid items-center justify-items-center gap-x-4 gap-y-6 sm:gap-x-8 sm:gap-y-8",
        "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-9",
        className,
      )}
    >
      {logos.map((logo) => (
        <li key={logo.slug} className="flex h-16 w-full max-w-[128px] items-center justify-center">
          <Image
            src={logo.src}
            alt={`Logo ${logo.name} — client Axion-IA`}
            width={logo.width ?? 200}
            height={logo.height ?? 60}
            loading="lazy"
            decoding="async"
            className="max-h-12 max-w-full object-contain transition-transform duration-300 hover:scale-105"
            data-client={logo.slug}
          />
        </li>
      ))}
    </ul>
  );
}
