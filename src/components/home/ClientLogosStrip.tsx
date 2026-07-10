/**
 * ClientLogosStrip — bandeau de logos clients en défilement infini sur UNE
 * seule ligne, suivi d'un badge de note terracotta façon Trustpilot avec le
 * nombre d'avis dynamique (Server Component, zéro JS).
 *
 * Demande Will 2026-07-10 :
 *   - Logos sur une ligne qui défilent (au lieu de la grille multi-lignes).
 *   - Sous les logos : « Excellent ★★★★★ {N} avis » — étoiles en terracotta,
 *     N = nombre d'avis publiés dynamique (voir `reviewCount`).
 *
 * Réutilise l'animation `caseScrollX` de globals.css (track dupliqué →
 * translateX -50 % pour boucler sans saut, pause au hover du `.group`,
 * désactivée en `prefers-reduced-motion`). FR canonique — EN = miroir.
 */

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { CLIENT_LOGOS } from "@/content/home-data";

export interface ClientLogosStripProps {
  readonly isFr: boolean;
  /**
   * Nombre d'avis à afficher dans le badge — déjà filtré (avis « top », note
   * ≥ 4★) par l'appelant. `null` → badge masqué (aucun avis publié / build stub).
   */
  readonly reviewCount: number | null;
}

export function ClientLogosStrip({ isFr, reviewCount }: ClientLogosStripProps): ReactNode {
  // Track dupliqué (items + items) pour une boucle sans saut visible.
  const tracks = [...CLIENT_LOGOS, ...CLIENT_LOGOS];

  return (
    <div>
      {/* ── Logos : défilement infini sur une ligne ── */}
      <div
        className="group relative overflow-hidden"
        aria-roledescription="marquee"
        aria-label={
          isFr
            ? `Logos de ${CLIENT_LOGOS.length} entreprises clientes — défile horizontalement`
            : `Logos of ${CLIENT_LOGOS.length} client companies — scrolls horizontally`
        }
      >
        {/* Fades latéraux pour l'effet « continue à défiler ». */}
        <div
          aria-hidden="true"
          className="from-bg pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r to-transparent sm:w-24"
        />
        <div
          aria-hidden="true"
          className="from-bg pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l to-transparent sm:w-24"
        />

        <ul
          className="case-marquee-track flex w-max items-center gap-8 motion-reduce:animate-none sm:gap-10"
          style={
            {
              "--marquee-duration": "65s",
              animation: "caseScrollX var(--marquee-duration) linear infinite",
            } as CSSProperties
          }
        >
          {tracks.map((logo, idx) => {
            const isClone = idx >= CLIENT_LOGOS.length;
            return (
              <li
                key={`${logo.slug}-${idx}`}
                // Slot de taille fixe → tous les logos occupent la même emprise
                // visuelle (object-contain + max-h/max-w bornés), quel que soit
                // leur ratio natif.
                className="flex h-14 w-[152px] shrink-0 items-center justify-center sm:w-[176px]"
                aria-hidden={isClone ? "true" : undefined}
              >
                <Image
                  src={logo.src}
                  alt={isClone ? "" : `Logo ${logo.name} — entreprise cliente d'Axion-IA`}
                  width={logo.width ?? 180}
                  height={logo.height ?? 60}
                  loading="lazy"
                  decoding="async"
                  sizes="176px"
                  className="max-h-9 max-w-[132px] object-contain opacity-75 transition-opacity duration-200 hover:opacity-100 sm:max-h-10 sm:max-w-[150px]"
                  data-client={logo.slug}
                  data-brand={logo.name}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Badge de note terracotta + nombre d'avis dynamique ── */}
      {reviewCount && reviewCount > 0 ? (
        <div className="mt-8 flex items-center justify-center gap-2.5 sm:mt-9">
          <span className="text-fg text-sm font-semibold sm:text-base">
            {isFr ? "Excellent" : "Excellent"}
          </span>
          <span
            role="img"
            aria-label={
              isFr
                ? `Note 5 sur 5, basée sur ${reviewCount} avis clients`
                : `Rated 5 out of 5, based on ${reviewCount} customer reviews`
            }
            className="flex items-center gap-0.5"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="bg-terracotta flex h-5 w-5 items-center justify-center rounded-[3px] sm:h-[22px] sm:w-[22px]"
              >
                <Star className="text-paper h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
              </span>
            ))}
          </span>
          <span className="text-fg-soft text-sm sm:text-base">
            <span className="text-fg font-bold">{reviewCount}</span> {isFr ? "avis" : "reviews"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
