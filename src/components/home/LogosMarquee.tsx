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

// Polish v9 (Will 2026-05-23) : flex-wrap + justify-center → dernière
// ligne centrée même si incomplète (visuellement balancé).
// Logos plus gros (max-h-16 vs max-h-12), gap réduit (gap-3 vs gap-x-4).
// Container fixe par logo (w-36 h-20) → normalisation taille visuelle stricte.
export function LogosMarquee({ logos, className }: LogosMarqueeProps) {
  return (
    <ul
      aria-label="Logos clients Axion-IA"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6",
        className,
      )}
    >
      {logos.map((logo) => (
        <li key={logo.slug} className="flex h-20 w-32 items-center justify-center sm:w-36">
          <Image
            src={logo.src}
            alt={`Logo ${logo.name} — client Axion-IA`}
            width={logo.width ?? 200}
            height={logo.height ?? 60}
            loading="lazy"
            decoding="async"
            className="max-h-14 max-w-full object-contain transition-transform duration-300 hover:scale-105 sm:max-h-16"
            data-client={logo.slug}
          />
        </li>
      ))}
    </ul>
  );
}
