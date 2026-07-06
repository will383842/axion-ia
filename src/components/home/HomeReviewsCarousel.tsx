"use client";

// Carrousel d'avis clients pour la home — enveloppe CLIENT légère autour de cartes
// SSR (les <ReviewCard> sont rendues côté serveur et passées en children, donc
// crawlables + présentes sans JS). Le JS ne fait que : (1) démarrer sur un avis
// aléatoire → contenu différent à chaque visite, (2) faire défiler automatiquement.
//
// Web Vitals : progressive enhancement (scroll-snap natif fonctionne sans JS),
// 0 dépendance, CLS 0 (hauteur/largeur des cartes fixes), respecte
// prefers-reduced-motion (pas d'auto-défilement si l'utilisateur le refuse).

import { Children, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HomeReviewsCarouselProps {
  children: ReactNode;
  /** Intervalle d'auto-défilement en ms (défaut 5000). */
  intervalMs?: number;
}

export function HomeReviewsCarousel({ children, intervalMs = 5000 }: HomeReviewsCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const count = Children.count(children);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || count <= 1) return;

    const cards = () => Array.from(track.children) as HTMLElement[];
    const scrollToIdx = (i: number, smooth: boolean) => {
      const el = cards()[i];
      if (el)
        track.scrollTo({
          left: el.offsetLeft - track.offsetLeft,
          behavior: smooth ? "smooth" : "auto",
        });
    };

    // Départ aléatoire (contenu différent à chaque visite).
    let idx = Math.floor(Math.random() * count);
    scrollToIdx(idx, false);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    track.addEventListener("pointerenter", pause);
    track.addEventListener("pointerleave", resume);
    track.addEventListener("focusin", pause);
    track.addEventListener("focusout", resume);

    const id = window.setInterval(() => {
      if (paused) return;
      idx = (idx + 1) % count;
      scrollToIdx(idx, true);
    }, intervalMs);

    return () => {
      window.clearInterval(id);
      track.removeEventListener("pointerenter", pause);
      track.removeEventListener("pointerleave", resume);
      track.removeEventListener("focusin", pause);
      track.removeEventListener("focusout", resume);
    };
  }, [count, intervalMs]);

  const nudge = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const w = cards[0]?.offsetWidth ?? track.clientWidth;
    track.scrollBy({ left: dir * (w + 24), behavior: "smooth" });
  };

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carrousel"
      aria-label="Avis clients récents"
    >
      <ul
        ref={trackRef}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-6 overflow-x-auto pb-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <li className="min-w-0 shrink-0 basis-[86%] snap-start sm:basis-[47%] lg:basis-[31.5%]">
            {child}
          </li>
        ))}
      </ul>
      {count > 1 ? (
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Avis précédents"
            className="border-border bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex h-10 w-10 items-center justify-center rounded-full border transition"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Avis suivants"
            className="border-border bg-paper text-fg hover:border-terracotta hover:text-terracotta inline-flex h-10 w-10 items-center justify-center rounded-full border transition"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
