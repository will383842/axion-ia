"use client";
// use-client: scroll listener (window.scrollY) + state visible — interactif,
// ne peut pas être Server Component.

// Sticky CTA mobile — apparaît au scroll (>threshold px), masqué sur lg+.
// Augmente la conversion mobile sur les pages longues : le CTA principal
// reste accessible quel que soit le scroll.
//
// Honneur la safe-area iOS (env(safe-area-inset-bottom)) pour ne pas être
// recouvert par la home bar. Animation translateY pour entrer/sortir
// proprement, prefers-reduced-motion respecté.

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface StickyMobileCtaProps {
  /** Cible du CTA principal (path interne i18n). */
  href: string;
  /** Label visible sur le bouton. */
  label: string;
  /** Tracking analytics — émis comme data-cta. */
  track?: string;
  /** Scroll Y minimum avant apparition (px). Défaut 600 (~1 hero passé). */
  threshold?: number;
}

export function StickyMobileCta({ href, label, track, threshold = 600 }: StickyMobileCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // P-200 — rAF + dedup pour limiter les setState à 1/frame (60 Hz).
    // Avant : chaque event scroll déclenchait setVisible() même si la valeur
    // était identique → React schedule un re-render → INP +20-40 ms mobile
    // sur pages longues. Désormais on coalesce dans rAF et on ne setState
    // que si la valeur change réellement.
    let scheduled = false;
    let lastVisible = false;
    const compute = () => {
      const past = window.scrollY > threshold;
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 320;
      const next = past && !nearBottom;
      if (next !== lastVisible) {
        lastVisible = next;
        setVisible(next);
      }
      scheduled = false;
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [threshold]);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div
        className="bg-paper/90 border-border supports-[backdrop-filter]:bg-paper/75 pointer-events-auto border-t px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <Link
          href={href as never}
          {...(track ? { "data-cta": track } : {})}
          className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {label}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
