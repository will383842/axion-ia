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
import { trackVsl } from "@/lib/analytics/vsl-apporteur-events";

/** Jalons de progression émis (en % de la durée). Un seul calcul par jalon. */
const JALONS = [25, 50, 75, 95] as const;

interface VslVideoProps {
  src: string;
  poster: string;
  /** Durée affichée sur l'affiche — « 2 min 40 ». Rassure avant le clic. */
  durationLabel: string;
  label: string;
  /** Slug de la page, pour l'analyse par variante. */
  landing: string;
  className?: string;
  /**
   * Cadrage. `"16:9"` (défaut, comportement historique de `/diagnostic`) ou
   * `"4:5-mobile"` : 4:5 sur téléphone (la publicité Facebook se regarde en
   * portrait), 16:9 dès `md`. En 4:5 le film n'est jamais rogné : sur grand
   * écran il est centré sur le fond de la boîte.
   */
  ratio?: "16:9" | "4:5-mobile";
  /** Piste de sous-titres WebVTT (même domaine). Ajoute `<track kind="captions">`. */
  sousTitres?: { src: string; langue?: string; libelle?: string };
  /** Répliques du film, pour la transcription repliable. Vide ou absent : pas de bloc. */
  transcription?: readonly string[];
  /** `"light"` : légende en encre sur fond clair (page apporteurs). Défaut `"dark"` : fond encre (`/diagnostic`). */
  tone?: "dark" | "light";
  /** Émet « Video Progress » à 25 / 50 / 75 / 95 %. Défaut : non (comportement historique). */
  suiviProgression?: boolean;
}

export function VslVideo({
  src,
  poster,
  durationLabel,
  label,
  landing,
  className,
  ratio = "16:9",
  sousTitres,
  transcription,
  suiviProgression = false,
  tone = "dark",
}: VslVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [started, setStarted] = React.useState(false);
  const jalonsEmis = React.useRef<Set<number>>(new Set());

  // Un calcul par `timeupdate` (≈ 4 fois par seconde), jamais par image : rien
  // de mesurable sur l'INP. Chaque jalon part UNE fois, même si l'on revient en arrière.
  const surProgression = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const pct = (video.currentTime / video.duration) * 100;
    for (const jalon of JALONS) {
      if (pct >= jalon && !jalonsEmis.current.has(jalon)) {
        jalonsEmis.current.add(jalon);
        trackVsl("Video Progress", { landing, step: `p${jalon}` });
      }
    }
  }, [landing]);

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
      <figcaption
        className={cn(
          "mb-3 text-center text-[14px] font-bold tracking-tight",
          tone === "light" ? "text-fg" : "text-mocha-fg",
        )}
      >
        {label}
      </figcaption>

      <div className="border-terracotta/30 bg-ink relative overflow-hidden rounded-2xl border">
        {/* `aspect-video` fige la place AVANT tout chargement : sans lui, l'affiche
            qui arrive pousse le contenu et coûte du CLS, dont le budget du dépôt
            exige zéro. */}
        <div
          className={cn(
            "relative w-full",
            ratio === "4:5-mobile" ? "aspect-[4/5] md:aspect-video" : "aspect-video",
          )}
        >
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            preload="none"
            playsInline
            controls={started}
            {...(suiviProgression ? { onTimeUpdate: surProgression } : {})}
            className={cn(
              "h-full w-full",
              ratio === "4:5-mobile" ? "object-contain" : "object-cover",
            )}
          >
            {sousTitres ? (
              <track
                kind="captions"
                src={sousTitres.src}
                srcLang={sousTitres.langue ?? "fr"}
                label={sousTitres.libelle ?? "Français"}
                default
              />
            ) : null}
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

      {transcription && transcription.length > 0 ? (
        <details className="border-border bg-paper mt-3 rounded-xl border px-4 py-3">
          <summary className="text-fg cursor-pointer text-sm font-semibold">
            Lire la transcription
          </summary>
          <div className="text-fg-soft mt-3 space-y-2 text-sm leading-relaxed">
            {transcription.map((ligne, i) => (
              <p key={i}>{ligne}</p>
            ))}
          </div>
        </details>
      ) : null}
    </figure>
  );
}
