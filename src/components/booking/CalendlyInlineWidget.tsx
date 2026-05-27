"use client";
// use-client: charge le script tiers Calendly via next/script + embed inline
// avec lien fallback pour les visiteurs dont le navigateur bloque les iframes
// cross-origin (cookies tiers stricts, extensions anti-tracking, etc.).

import Script from "next/script";

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

export function CalendlyInlineWidget({
  calendlyUrl,
  isFr,
  height = 720,
}: CalendlyInlineWidgetProps) {
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

  const finalUrl = buildCalendlyUrl(calendlyUrl);

  return (
    <>
      <link rel="preconnect" href="https://assets.calendly.com" />
      <link rel="preconnect" href="https://calendly.com" />
      <link rel="dns-prefetch" href="https://calendly.com" />
      <div
        className="calendly-inline-widget mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-lg"
        data-url={finalUrl}
        style={{ minWidth: "320px", height: `${height}px` }}
        aria-label={isFr ? "Calendrier de prise de rendez-vous" : "Booking calendar"}
      />
      <div className="mx-auto mt-4 max-w-xl text-center">
        <p className="text-fg-muted text-sm">
          {isFr
            ? "Le calendrier ne s’affiche pas ?"
            : "Calendar not showing?"}
          {" "}
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta font-medium underline underline-offset-2"
          >
            {isFr
              ? "Ouvrir Calendly directement →"
              : "Open Calendly directly →"}
          </a>
        </p>
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
      />
    </>
  );
}
