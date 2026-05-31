/**
 * ClientLogosMarqueeBand — bandeau de logos clients en défilement infini sur
 * une seule ligne (Server Component).
 *
 * Refonte 2026-05-31 (Will) — preuve sociale avant la section méthodologie.
 * Réutilise les logos de la home (`CLIENT_LOGOS`) et l'animation `caseScrollX`
 * de globals.css (track dupliqué → translateX -50% pour boucler sans saut,
 * pause au hover, désactivée en `prefers-reduced-motion`).
 *
 * Zéro JS (animation 100 % CSS). FR canonique — EN = miroir (locale 301→FR).
 */

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { CLIENT_LOGOS } from "@/content/home-data";

export interface ClientLogosMarqueeBandProps {
  readonly isFr: boolean;
}

export function ClientLogosMarqueeBand({ isFr }: ClientLogosMarqueeBandProps): ReactNode {
  // Track dupliqué (items + items) pour une boucle sans saut visible.
  const tracks = [...CLIENT_LOGOS, ...CLIENT_LOGOS];

  return (
    <section
      aria-label={isFr ? "Nos clients" : "Our clients"}
      className="bg-paper border-border border-y py-10 sm:py-12"
    >
      <p className="text-fg-muted mb-7 text-center text-[12px] font-semibold tracking-[0.16em] uppercase">
        {isFr ? "Ils nous font confiance" : "They trust us"}
      </p>

      <div
        className="group relative overflow-hidden"
        aria-roledescription="marquee"
        aria-label={
          isFr ? "Logos clients — défile horizontalement" : "Client logos — scrolls horizontally"
        }
      >
        {/* Fades latéraux pour l'effet « continue à défiler » */}
        <div
          aria-hidden="true"
          className="from-paper pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r to-transparent sm:w-24"
        />
        <div
          aria-hidden="true"
          className="from-paper pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l to-transparent sm:w-24"
        />

        <ul
          className="case-marquee-track flex w-max items-center gap-12 motion-reduce:animate-none sm:gap-16"
          style={
            {
              "--marquee-duration": "45s",
              animation: "caseScrollX var(--marquee-duration) linear infinite",
            } as CSSProperties
          }
        >
          {tracks.map((logo, idx) => {
            const isClone = idx >= CLIENT_LOGOS.length;
            return (
              <li
                key={`${logo.slug}-${idx}`}
                className="flex h-12 shrink-0 items-center justify-center"
                aria-hidden={isClone ? "true" : undefined}
              >
                <Image
                  src={logo.src}
                  alt={isClone ? "" : `Logo ${logo.name} — client Axion-IA`}
                  width={logo.width ?? 180}
                  height={logo.height ?? 60}
                  loading="lazy"
                  decoding="async"
                  sizes="180px"
                  className="max-h-9 w-auto object-contain opacity-70 transition-opacity duration-200 hover:opacity-100 sm:max-h-11"
                  data-client={logo.slug}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
