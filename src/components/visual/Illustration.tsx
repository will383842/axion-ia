// Server Component — wrapper d'illustration Sprint Visual Rhythm 2026.
//
// Comportement :
// - Si `src` est fourni → rend `next/image` avec `figure` + `figcaption`
//   optionnel, AVIF/WebP/JPG selon extension, sizes responsive.
// - Si `src` est omis → rend `IllustrationPlaceholder` avec slot ID +
//   filename target. Will n'a qu'à drop l'image générée GPT-image dans
//   `public/illustrations/` et ajouter `src` ici pour basculer.
//
// Convention naming : `public/illustrations/[page]-[slot].avif`.
// Le placeholder reste on-brand (palette terracotta soft + grille subtile).
//
// Pour les images bitmap, on utilise `next/image` (CDN, sizing,
// AVIF/WebP fallback). Les sizes sont calculées par défaut selon l'aspect
// ratio fourni — paramétrable si besoin.

import Image from "next/image";
import type { ReactNode } from "react";
import {
  IllustrationPlaceholder,
  type IllustrationPlaceholderProps,
} from "./IllustrationPlaceholder";

export interface IllustrationProps extends Omit<
  IllustrationPlaceholderProps,
  "ariaLabel" | "className"
> {
  /** Source de l'image (chemin public). Si omis → mode placeholder. */
  src?: string;
  /** Alt text — descriptif riche pour SEO/AEO + a11y. */
  alt: string;
  /** Légende affichée sous l'image (figcaption). Optionnel. */
  figcaption?: string;
  /** Charger avec priority (LCP hero only). Défaut : false. */
  priority?: boolean;
  /** Sizes Tailwind-style override. Défaut calculé selon aspectRatio. */
  sizes?: string;
  className?: string;
}

const ratioToWidthHeight: Record<
  IllustrationPlaceholderProps["aspectRatio"],
  { width: number; height: number }
> = {
  "16:9": { width: 1600, height: 900 },
  "3:2": { width: 1500, height: 1000 },
  "4:5": { width: 1000, height: 1250 },
  "1:1": { width: 1200, height: 1200 },
  "1200x630": { width: 1200, height: 630 },
};

const defaultSizes: Record<IllustrationPlaceholderProps["aspectRatio"], string> = {
  "16:9": "(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px",
  "3:2": "(max-width: 1024px) 100vw, 600px",
  "4:5": "(max-width: 768px) 100vw, 600px",
  "1:1": "(max-width: 768px) 100vw, 600px",
  "1200x630": "1200px",
};

export function Illustration({
  src,
  alt,
  figcaption,
  priority = false,
  sizes,
  slot,
  aspectRatio,
  filenameTarget,
  caption,
  className,
}: IllustrationProps): ReactNode {
  // Mode placeholder — pas encore d'image générée.
  if (!src) {
    return (
      <IllustrationPlaceholder
        slot={slot}
        aspectRatio={aspectRatio}
        filenameTarget={filenameTarget}
        caption={caption}
        ariaLabel={alt}
        {...(className ? { className } : {})}
      />
    );
  }

  // Mode image — l'image existe dans public/.
  const { width, height } = ratioToWidthHeight[aspectRatio];

  return (
    <figure className={className ?? "relative w-full overflow-hidden rounded-2xl"}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes ?? defaultSizes[aspectRatio]}
        className="h-auto w-full"
      />
      {figcaption ? (
        <figcaption className="text-fg-muted mt-3 text-[13px] leading-snug">
          {figcaption}
        </figcaption>
      ) : null}
    </figure>
  );
}
