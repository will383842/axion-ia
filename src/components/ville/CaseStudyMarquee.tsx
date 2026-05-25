/**
 * CaseStudyMarquee — Carousel infini de réalisations Axion-IA.
 *
 * Sprint Quality 2026 — Will 2026-05-25.
 *
 * Effet "volume" par défilement horizontal continu (pause au hover).
 * Implémentation 100% CSS (zero JS client) — pattern double-track pour boucle infinie.
 * Mobile-first : scroll natif si JS désactivé, animation au-dessus de 640px.
 *
 * Server Component — performance + SEO (HTML statique).
 */

import type { CSSProperties } from "react";

import Image from "next/image";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

export interface CaseStudyImage {
  readonly src: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly industryFr: string;
  readonly industryEn: string;
  readonly metric: string;
  readonly titleFr: string;
  readonly titleEn: string;
}

interface CaseStudyMarqueeProps {
  readonly items: ReadonlyArray<CaseStudyImage>;
  readonly isFr: boolean;
  /** Durée d'un cycle complet en secondes (défaut 50s — assez lent pour lire). */
  readonly durationSec?: number;
  /** Désactive lightbox sur mobile (perf) — défaut true. */
  readonly lightboxEnabled?: boolean;
}

/**
 * Marquee animé via CSS `@keyframes scrollX` défini dans globals.css.
 * Le track contient les items DEUX FOIS pour boucle sans saut.
 * `prefers-reduced-motion` désactive automatiquement l'animation (a11y).
 */
export function CaseStudyMarquee({
  items,
  isFr,
  durationSec = 50,
  lightboxEnabled = true,
}: CaseStudyMarqueeProps) {
  if (items.length === 0) return null;
  // Pour boucler sans saut, on duplique la liste : track = items + items.
  const tracks = [...items, ...items];

  return (
    <div
      className="group relative overflow-hidden"
      aria-roledescription="carousel"
      aria-label={
        isFr
          ? "Carousel de réalisations Axion-IA — défile horizontalement"
          : "Axion-IA case studies carousel — scrolls horizontally"
      }
    >
      {/* Fade gauche/droite pour effet "continue à scroller" */}
      <div
        aria-hidden="true"
        className="from-paper pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r to-transparent sm:w-20"
      />
      <div
        aria-hidden="true"
        className="from-paper pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l to-transparent sm:w-20"
      />
      <ul
        className="case-marquee-track flex w-max gap-3 motion-reduce:animate-none sm:gap-4"
        style={
          {
            "--marquee-duration": `${durationSec}s`,
            animation: `caseScrollX var(--marquee-duration) linear infinite`,
          } as CSSProperties
        }
      >
        {tracks.map((demo, idx) => (
          <li
            key={`${demo.src}-${idx}`}
            className="bg-bg border-border w-[220px] shrink-0 overflow-hidden rounded-2xl border sm:w-[260px] md:w-[280px]"
          >
            {lightboxEnabled ? (
              <ImageLightbox
                src={demo.src}
                alt={isFr ? demo.altFr : demo.altEn}
                width={1280}
                height={720}
                sizes="(max-width: 640px) 220px, (max-width: 768px) 260px, 280px"
                className="rounded-none rounded-t-2xl [&_figure]:aspect-[16/9] [&_figure]:overflow-hidden [&_figure>img]:!h-full [&_figure>img]:!w-full [&_figure>img]:!object-cover"
              />
            ) : (
              <figure className="aspect-[16/9] overflow-hidden">
                <Image
                  src={demo.src}
                  alt={isFr ? demo.altFr : demo.altEn}
                  width={1280}
                  height={720}
                  sizes="(max-width: 640px) 220px, (max-width: 768px) 260px, 280px"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </figure>
            )}
            <div className="flex flex-col gap-1.5 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-sand text-fg-soft inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {isFr ? demo.industryFr : demo.industryEn}
                </span>
                <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  {demo.metric}
                </span>
              </div>
              <h3
                className="text-fg text-sm leading-tight font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? demo.titleFr : demo.titleEn}
              </h3>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
