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

// Grille statique 2 lignes — refonte « polish v2 » Will 2026-05-23 :
// (1) logos en COULEUR (pas grayscale) pour pep's visuel
// (2) plus GROS (hauteur effective ~56-64 px vs 40 px avant)
// (3) STABLES, ne bougent pas (suppression du marquee défilant)
// (4) responsive : 4 col mobile / 5 sm / 6 md / 8 lg / 9 xl
//
// SSR pure, 0 JS shipped. Aspect ratio préservé via width/height intrinsèques
// → 0 CLS. Hover subtil (scale 1.05) sans casser la lecture.
export function LogosMarquee({ logos, className }: LogosMarqueeProps) {
  return (
    <ul
      aria-label="Logos clients Axion-IA"
      className={cn(
        "grid items-center justify-items-center gap-x-8 gap-y-10 sm:gap-x-12 sm:gap-y-12",
        "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-9",
        className,
      )}
    >
      {logos.map((logo) => (
        <li key={logo.slug} className="flex h-16 w-full items-center justify-center sm:h-20">
          <Image
            src={logo.src}
            alt={`Logo ${logo.name} — client Axion-IA`}
            width={logo.width ?? 200}
            height={logo.height ?? 60}
            loading="lazy"
            decoding="async"
            className="h-12 w-auto max-w-full object-contain transition-transform duration-300 hover:scale-105 sm:h-14"
            data-client={logo.slug}
          />
        </li>
      ))}
    </ul>
  );
}
