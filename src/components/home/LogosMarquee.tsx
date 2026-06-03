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

// Format SVG retenu (pas WebP/AVIF) — SVG = format optimal pour les logos :
//   - Vectoriel : net à tous les DPR/zooms (vs WebP bitmap = pixelisation au zoom)
//   - Plus léger qu'un WebP pour des wordmarks simples (~3-8 KB vs 20-40 KB)
//   - Indexable par les LLMs : contient le texte du wordmark en clair dans le SVG
//   - SEO/AEO friendly : <title>/<desc> SVG natifs + alt sur <img>
//
// Attributs accessibilité + SEO renforcés :
//   - <section aria-labelledby> avec heading sr-only
//   - <ul role="list"> + role="listitem" sur chaque entry
//   - <figure>/<figcaption sr-only> par logo (sémantique image+légende)
//   - alt text descriptif riche (nom + statut "client Axion-IA")
//   - data-client attribute pour analytics tracking
//   - aria-hidden=false (logos = contenu informatif, pas décoratif)
//   - sizes hint pour next/image (même si SVG, optimise les variants)
//
// Polish v10 : grid colonnes fixes 4/5 → toutes les lignes complètes.
// Normalisation max-h-12/14 → hauteur uniforme indépendamment des aspect ratios.
export function LogosMarquee({ logos, className }: LogosMarqueeProps) {
  return (
    <ul
      role="list"
      aria-label={`Logos de ${logos.length} entreprises clientes d'Axion-IA`}
      className={cn(
        "grid items-center justify-items-center gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5",
        "grid-cols-4 sm:grid-cols-5",
        className,
      )}
    >
      {logos.map((logo) => (
        <li
          key={logo.slug}
          role="listitem"
          className="flex h-16 w-full items-center justify-center sm:h-20"
        >
          <figure className="flex h-full w-full items-center justify-center">
            <Image
              src={logo.src}
              alt={`Logo ${logo.name} — entreprise cliente d'Axion-IA`}
              width={logo.width ?? 200}
              height={logo.height ?? 60}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 640px) 25vw, (max-width: 1280px) 20vw, 180px"
              className="max-h-12 w-full max-w-[150px] object-contain opacity-75 transition-opacity duration-200 hover:opacity-100 sm:max-h-14 sm:max-w-[180px]"
              data-client={logo.slug}
              data-brand={logo.name}
            />
            <figcaption className="sr-only">{logo.name}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
