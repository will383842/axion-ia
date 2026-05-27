"use client";
// use-client: bouton interactif + appel Calendly.initPopupWidget() côté browser.
//
// Fix 2026-05-27 : passage de iframe inline → popup widget.
// Raison : Chrome (et navigateurs modernes) bloquent les cookies tiers dans
// les iframes cross-origin par défaut (SameSite=Lax + Third-party cookie
// phaseout Chrome 2024+). Le widget inline Calendly dépend du cookie session
// `_calendly_session` (SameSite=Lax) → ne peut PAS être set dans une iframe
// cross-origin → spinner infini / page blanche pour ~30-40% des visiteurs.
//
// Le mode popup ouvre Calendly dans une nouvelle fenêtre top-level (= pas
// iframe = cookies normaux = 100% des visiteurs voient le calendrier).
// Compromis UX : le visiteur quitte visuellement la page pendant la réservation
// mais revient automatiquement après confirmation. Calendly redirige vers la
// page de confirmation.

import Script from "next/script";
import { useCallback, useState } from "react";

interface CalendlyInlineWidgetProps {
  readonly calendlyUrl: string | undefined;
  readonly isFr: boolean;
  readonly height?: number;
}

const CALENDLY_BRAND = {
  primary: "c2410c",
  text: "1c1917",
  background: "fef3e6",
} as const;

function buildCalendlyUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("hide_event_type_details", "1");
  url.searchParams.set("hide_gdpr_banner", "1");
  url.searchParams.set("primary_color", CALENDLY_BRAND.primary);
  url.searchParams.set("text_color", CALENDLY_BRAND.text);
  url.searchParams.set("background_color", CALENDLY_BRAND.background);
  return url.toString();
}

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (opts: { url: string }) => void;
    };
  }
}

export function CalendlyInlineWidget({
  calendlyUrl,
  isFr,
  height = 720,
}: CalendlyInlineWidgetProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const openCalendly = useCallback(() => {
    if (!calendlyUrl) return;
    const url = buildCalendlyUrl(calendlyUrl);
    if (window.Calendly) {
      window.Calendly.initPopupWidget({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [calendlyUrl]);

  if (!calendlyUrl) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-border bg-sand mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center"
      >
        <p className="text-fg text-base leading-relaxed">
          {isFr
            ? "Le calendrier en ligne est temporairement indisponible."
            : "The online calendar is temporarily unavailable."}
        </p>
        <a
          href={isFr ? "/fr/contact" : "/en/contact"}
          data-cta="appel_fallback_contact"
          className="bg-terracotta text-paper hover:bg-terracotta/90 focus-visible:ring-terracotta inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Nous écrire à la place" : "Contact us instead"}
        </a>
      </div>
    );
  }

  return (
    <>
      <link rel="preconnect" href="https://assets.calendly.com" />
      <link rel="preconnect" href="https://calendly.com" />
      <link rel="dns-prefetch" href="https://calendly.com" />
      {/* CSS requis par Calendly popup widget */}
      <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet" />
      <div
        className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl"
        style={{ minWidth: "320px", minHeight: `${Math.min(height, 400)}px` }}
        aria-label={isFr ? "Section de prise de rendez-vous" : "Booking section"}
      >
        <div className="text-center">
          <p className="text-fg-soft mb-4 text-base leading-relaxed">
            {isFr
              ? "Cliquez ci-dessous pour ouvrir le calendrier et choisir votre créneau."
              : "Click below to open the calendar and choose your slot."}
          </p>
          <button
            type="button"
            onClick={openCalendly}
            disabled={!scriptLoaded}
            data-cta="appel_calendly_popup"
            className="bg-terracotta text-paper hover:bg-terracotta/90 focus-visible:ring-terracotta inline-flex h-14 items-center gap-3 rounded-full px-8 text-lg font-semibold shadow-lg transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {isFr ? "Choisir un créneau" : "Pick a time slot"}
          </button>
          {!scriptLoaded && (
            <p className="text-fg-muted mt-3 animate-pulse text-sm">
              {isFr ? "Chargement du calendrier..." : "Loading calendar..."}
            </p>
          )}
        </div>
      </div>
      <noscript>
        <div className="bg-sand text-fg-soft mx-auto mt-4 max-w-xl rounded-xl px-6 py-4 text-center text-sm">
          {isFr
            ? "Activez JavaScript pour afficher le calendrier de réservation, ou contactez-nous directement."
            : "Enable JavaScript to display the booking calendar, or contact us directly."}
        </div>
      </noscript>
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
        async
        onLoad={() => setScriptLoaded(true)}
      />
    </>
  );
}
