import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ClientLogo } from "@/content/home-data";

export type { ClientLogo };

interface LogosMarqueeProps {
  logos: ClientLogo[];
  /** Vitesse de défilement en secondes pour un cycle complet. Plus haut = plus lent. */
  speedSec?: number;
  className?: string;
}

// Marquee CSS pur — pas de JS, pas de framer-motion. Server component.
// Hauteur logos = 40 px (centre du range 32-48 du blueprint §8). Grayscale
// par défaut, retour couleur réelle au hover sur le track entier (transition
// 300 ms). prefers-reduced-motion : animation suspendue (rule globale dans
// globals.css forçant animation-duration: 0ms).
//
// Pattern double-track : on duplique la liste 2x pour créer un loop parfait.
// translateX(-50%) à la fin = remise à zéro invisible car la 2e moitié est
// identique à la 1re visible à l'instant 0.
export function LogosMarquee({ logos, speedSec = 50, className }: LogosMarqueeProps) {
  const items = [...logos, ...logos];
  return (
    <div
      className={cn(
        "logos-marquee-mask group relative w-full overflow-hidden",
        // Fade sur les bords gauche/droite pour éviter le "pop-in" visuel
        "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        className,
      )}
      aria-label="Logos clients Axion-IA"
    >
      <ul
        className="logos-marquee-track flex w-max items-center gap-12 hover:[animation-play-state:paused] motion-reduce:!animate-none sm:gap-16"
        style={{
          animation: `logos-marquee ${speedSec}s linear infinite`,
        }}
      >
        {items.map((logo, idx) => (
          <li
            key={`${logo.slug}-${idx}`}
            className="flex shrink-0 items-center"
            aria-hidden={idx >= logos.length ? "true" : undefined}
          >
            <Image
              src={logo.src}
              alt={idx < logos.length ? `Logo ${logo.name} — client Axion-IA` : ""}
              width={logo.width ?? 160}
              height={logo.height ?? 40}
              loading="lazy"
              decoding="async"
              className="h-10 w-auto opacity-70 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0"
              data-client={logo.slug}
            />
          </li>
        ))}
      </ul>
      <style>{`
        @keyframes logos-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
