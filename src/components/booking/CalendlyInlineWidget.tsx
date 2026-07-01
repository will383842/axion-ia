"use client";
// use-client: charge le script tiers Calendly + init programmatique de l'embed
// inline, avec lien fallback pour les visiteurs dont le navigateur bloque les
// iframes cross-origin (cookies tiers stricts, extensions anti-tracking, etc.).
//
// ⚠️ NE PAS rendre d'éléments « hoistables » (<link>, <script>, <noscript>,
// <meta>, <title>) dans le JSX de CE composant. Audit 2026-07-01 (2e passe) :
// vérifié en prod que le rendu de <link rel="preconnect"> + <noscript> dans le
// fragment de ce Client Component FAISAIT ÉCHOUER l'hydratation de l'îlot en
// React 19 / Next 16 — le conteneur n'obtenait aucun fiber React, donc le
// useEffect ne s'exécutait JAMAIS (fiber ancêtre le plus proche = <body>, alors
// que le reste de la page s'hydratait normalement). C'est la cause RACINE du
// « grand cadre gris vide » : l'ancien <Script strategy="afterInteractive">
// était lui aussi rendu par ce composant → jamais hydraté → seul le preload
// était émis. On charge donc script + preconnect PROGRAMMATIQUEMENT dans le
// useEffect, et le JSX ne contient que des éléments plats (div/p/a).

import { useEffect, useRef } from "react";

const CALENDLY_WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_PRECONNECT = ["https://assets.calendly.com", "https://calendly.com"] as const;

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
 * Ajoute les hints preconnect côté client (idempotent). Fait ici plutôt qu'en
 * JSX pour éviter les <link> hoistables qui cassent l'hydratation (cf. en-tête).
 */
function ensurePreconnect(): void {
  for (const href of CALENDLY_PRECONNECT) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
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
    ensurePreconnect();

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

  // ⚠️ Uniquement des éléments plats ici (div/p/a) — voir en-tête de fichier.
  return (
    <div>
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
    </div>
  );
}
