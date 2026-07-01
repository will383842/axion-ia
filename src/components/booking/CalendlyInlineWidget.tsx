"use client";
// use-client: charge le script tiers Calendly + init programmatique de l'embed
// inline, avec lien fallback pour les visiteurs dont le navigateur bloque les
// iframes cross-origin (cookies tiers stricts, extensions anti-tracking, etc.).
//
// Pourquoi injection manuelle plutôt que <Script strategy="afterInteractive"> ?
// Audit 2026-07-01 : en App Router (Next 16 + React 19), le <Script async> était
// hoisté en `<link rel=preload>` mais le <script> exécutable n'était jamais
// injecté au runtime → `window.Calendly` restait undefined → le widget ne
// s'initialisait jamais (grand cadre gris vide en prod). On charge donc le
// script nous-mêmes dans un useEffect puis on appelle l'API programmatique
// `Calendly.initInlineWidget`, ce qui est déterministe et indépendant du
// timing d'auto-scan du DOM et du ScriptLoader de Next.

import { useEffect, useRef } from "react";

const CALENDLY_WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";

interface CalendlyGlobal {
  initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
}

declare global {
  interface Window {
    Calendly?: CalendlyGlobal;
  }
}

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

/**
 * Charge (une seule fois) le script widget.js de Calendly et résout quand
 * `window.Calendly` est disponible. Idempotent : réutilise le tag existant si
 * déjà présent (navigations client, remontage StrictMode en dev).
 */
function loadCalendlyScript(): Promise<CalendlyGlobal> {
  return new Promise((resolve, reject) => {
    if (window.Calendly) {
      resolve(window.Calendly);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CALENDLY_WIDGET_JS}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Calendly) resolve(window.Calendly);
        else reject(new Error("Calendly global manquant après chargement du script"));
      });
      existing.addEventListener("error", () => reject(new Error("Échec chargement widget.js")));
      return;
    }

    const script = document.createElement("script");
    script.src = CALENDLY_WIDGET_JS;
    script.async = true;
    script.addEventListener("load", () => {
      if (window.Calendly) resolve(window.Calendly);
      else reject(new Error("Calendly global manquant après chargement du script"));
    });
    script.addEventListener("error", () => reject(new Error("Échec chargement widget.js")));
    document.head.appendChild(script);
  });
}

export function CalendlyInlineWidget({
  calendlyUrl,
  isFr,
  height = 720,
}: CalendlyInlineWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const finalUrl = calendlyUrl ? buildCalendlyUrl(calendlyUrl) : null;

  useEffect(() => {
    if (!finalUrl) return;
    const parent = containerRef.current;
    if (!parent) return;

    let cancelled = false;

    void loadCalendlyScript()
      .then((calendly) => {
        if (cancelled || !containerRef.current) return;
        // Nettoyage défensif : évite un double-embed si l'effet se rejoue
        // (remontage StrictMode en dev, changement d'URL).
        containerRef.current.replaceChildren();
        calendly.initInlineWidget({ url: finalUrl, parentElement: containerRef.current });
      })
      .catch(() => {
        // fail-soft : le lien « Ouvrir Calendly directement » reste visible.
      });

    return () => {
      cancelled = true;
      parent.replaceChildren();
    };
  }, [finalUrl]);

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
      <div
        ref={containerRef}
        className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-lg"
        style={{ minWidth: "320px", height: `${height}px` }}
        aria-label={isFr ? "Calendrier de prise de rendez-vous" : "Booking calendar"}
      />
      <div className="mx-auto mt-4 max-w-xl text-center">
        <p className="text-fg-muted text-sm">
          {isFr ? "Le calendrier ne s’affiche pas ?" : "Calendar not showing?"}{" "}
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta font-medium underline underline-offset-2"
          >
            {isFr ? "Ouvrir Calendly directement →" : "Open Calendly directly →"}
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
    </>
  );
}
