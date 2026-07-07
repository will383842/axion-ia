"use client";
// use-client: Radix Dialog (zoom image plein écran) — portal + focus-trap navigateur.

import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * ZoomableImage — image cliquable qui s'ouvre en grand dans une popup (lightbox).
 *
 * La vignette utilise next/image (responsive + lazy). La vue agrandie est servie
 * `unoptimized` (résolution source intégrale, pas de recompression → netteté
 * maximale). Réutilise le Dialog Radix déjà chargé sur la page (coût JS
 * marginal). Server-safe : importable depuis un Server Component.
 */
export interface ZoomableImageProps {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly sizes?: string;
  readonly quality?: number;
  /** Sert la vignette non optimisée (graphiques texte → pas de flou de recompression). */
  readonly unoptimized?: boolean;
  readonly loading?: "lazy" | "eager";
  readonly priority?: boolean;
  /** Classes sur l'`<Image>` vignette. */
  readonly className?: string;
  /** Classes sur le `<figure>` conteneur. */
  readonly figureClassName?: string;
  readonly caption?: string;
  /** Libellé accessible du bouton d'agrandissement. */
  readonly zoomLabel: string;
}

export function ZoomableImage({
  src,
  alt,
  width,
  height,
  sizes,
  quality,
  unoptimized,
  loading = "lazy",
  priority,
  className,
  figureClassName,
  caption,
  zoomLabel,
}: ZoomableImageProps): ReactNode {
  // `exactOptionalPropertyTypes` : on n'injecte les props optionnelles que si
  // elles sont définies (jamais `undefined` explicite).
  const thumbProps: ComponentProps<typeof Image> = {
    src,
    alt,
    width,
    height,
    decoding: "async",
    className: cn("h-auto w-full", className),
    ...(sizes !== undefined ? { sizes } : {}),
    ...(quality !== undefined ? { quality } : {}),
    ...(unoptimized !== undefined ? { unoptimized } : {}),
    ...(priority ? { priority: true } : { loading }),
  };
  const zoomProps: ComponentProps<typeof Image> = {
    src,
    alt,
    width,
    height,
    sizes: "96vw",
    unoptimized: true,
    className: "h-auto w-full rounded-md",
    ...(quality !== undefined ? { quality } : {}),
  };

  return (
    <figure className={cn("group relative m-0", figureClassName)}>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={zoomLabel}
            className="focus-visible:ring-terracotta relative block w-full cursor-zoom-in overflow-hidden rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
          >
            <Image {...thumbProps} />
            {/* Indice de zoom — visible au survol / focus (zéro JS, CSS pur) */}
            <span
              aria-hidden="true"
              className="bg-fg/70 text-bg pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold opacity-0 backdrop-blur-sm transition group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <ZoomIn className="h-3.5 w-3.5" strokeWidth={2.25} />
              {zoomLabel}
            </span>
          </button>
        </DialogTrigger>

        {/* aria-describedby={undefined} = opt-out explicite Radix : une lightbox
            d'image n'a pas de description séparée (le DialogTitle = alt la nomme
            déjà). Sans ça, Radix logue « Missing Description or aria-describedby
            for {DialogContent} » en console (audit 2026-07-07). */}
        <DialogContent
          aria-describedby={undefined}
          className="w-auto max-w-[96vw] overflow-hidden rounded-xl p-2 sm:max-w-5xl sm:p-3"
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="max-h-[88vh] overflow-auto">
            <Image {...zoomProps} />
          </div>
        </DialogContent>
      </Dialog>
      {caption ? <figcaption className="sr-only">{caption}</figcaption> : null}
    </figure>
  );
}
