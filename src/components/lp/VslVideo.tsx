"use client";
// use-client: lecture au clic, suivi de l'événement de lecture, état de l'affiche.

// Lecteur vidéo des pages d'atterrissage publicitaires.
//
// ── Pourquoi un lecteur natif et non un embed YouTube ou Vimeo ────────────
// Un embed tiers dépose ses cookies au moment du parse, donc AVANT tout
// consentement : c'est exactement le problème résolu par l'ADR 0034 pour
// Calendly, au prix d'un écran de consentement intercalé. Sur une page qui
// reçoit du trafic payant, intercaler un pavé juridique entre la publicité et
// la vidéo tue le tunnel.
//
// La balise `<video>` native, servie depuis notre propre domaine, ne dépose
// rien, n'appelle personne, ne demande aucun consentement — et se charge plus
// vite qu'un iframe de lecteur tiers.
//
// ── Pourquoi `preload="none"` et une affiche ──────────────────────────────
// Sans cela, le navigateur télécharge la vidéo dès l'ouverture de la page :
// plusieurs mégaoctets consommés sur le forfait mobile de quelqu'un qui n'a
// peut-être pas l'intention de regarder, et un LCP dégradé. L'affiche est une
// image légère ; la vidéo ne part qu'au clic.

import * as React from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackFunnel } from "@/lib/tracking";

interface VslVideoProps {
  src: string;
  poster: string;
  /** Durée affichée sur l'affiche — « 2 min 40 ». Rassure avant le clic. */
  durationLabel: string;
  label: string;
  /** Slug de la page, pour l'analyse par variante. */
  landing: string;
  className?: string;
}

export function VslVideo({ src, poster, durationLabel, label, landing, className }: VslVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [started, setStarted] = React.useState(false);

  const play = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    trackFunnel("Landing Video Played", { landing });
    // `play()` renvoie une promesse rejetée si le navigateur refuse (économie
    // de données, politique d'autoplay). On l'avale : les contrôles natifs
    // restent affichés, l'utilisateur relance lui-même.
    void video.play().catch(() => undefined);
  }, [landing]);

  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="text-mocha-fg mb-3 text-center text-[14px] font-bold tracking-tight">
        {label}
      </figcaption>

      <div className="border-terracotta/30 bg-ink relative overflow-hidden rounded-2xl border">
        {/* `aspect-video` fige la place AVANT tout chargement : sans lui, l'affiche
            qui arrive pousse le contenu et coûte du CLS, dont le budget du dépôt
            exige zéro. */}
        <div className="relative aspect-video w-full">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            preload="none"
            playsInline
            controls={started}
            className="h-full w-full object-cover"
          >
            {/* Repli pour les navigateurs sans balise vidéo — rarissime, mais un
                lien mort à la place d'une vidéo serait pire. */}
            <a href={src}>Télécharger la vidéo</a>
          </video>

          {!started ? (
            <button
              type="button"
              onClick={play}
              className="group focus-visible:ring-terracotta absolute inset-0 flex items-center justify-center focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              aria-label={`Lire la vidéo (${durationLabel})`}
            >
              {/* L'affiche est rendue par `next/image` plutôt que par l'attribut
                  `poster` : on obtient l'AVIF, le dimensionnement et la priorité
                  de chargement, ce que `poster` ne sait pas faire. */}
              <Image
                src={poster}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                priority
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="bg-terracotta text-paper shadow-elevated relative flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
              >
                <Play className="ml-0.5 h-7 w-7" fill="currentColor" strokeWidth={0} />
              </span>
              <span className="bg-ink/80 text-mocha-fg absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums">
                {durationLabel}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
