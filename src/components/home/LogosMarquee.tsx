import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ClientLogo } from "@/content/home-data";

export type { ClientLogo };

interface LogosMarqueeProps {
  logos: ClientLogo[];
  /** Conservé pour compat API — non utilisé. */
  speedSec?: number;
  className?: string;
}

// Polish v10 (Will 2026-05-23) : grid à colonnes fixes (4/5/5) pour que
// chaque ligne soit toujours complète (20 logos ÷ 4 = 5 lignes, ÷ 5 = 4).
// Normalisation stricte max-h-9 → tous les logos ont la même hauteur
// maximale (~36 px) indépendamment de leur aspect ratio (wordmark large vs
// icône carrée). Gap réduit (gap-4 → gap-6 sm) pour densité visuelle.
export function LogosMarquee({ logos, className }: LogosMarqueeProps) {
  return (
    <ul
      aria-label="Logos clients Axion-IA"
      className={cn(
        "grid items-center justify-items-center gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5",
        "grid-cols-4 sm:grid-cols-5",
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
            className="max-h-12 max-w-[150px] object-contain opacity-75 transition-opacity duration-200 hover:opacity-100 sm:max-h-14 sm:max-w-[180px]"
            data-client={logo.slug}
          />
        </li>
      ))}
    </ul>
  );
}
