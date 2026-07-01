"use client";
// use-client: embed Calendly inline — chargement ROBUSTE, indépendant de
// l'hydratation (useEffect voie 2 + preuve d'exécution client).
//
// Contexte (audit 2026-07-01, 3 passes) : sur /appel, le contenu de page
// n'était pas hydraté de façon fiable (l'îlot client n'obtenait aucun fiber
// React), donc TOUT mécanisme reposant sur un useEffect au chargement initial
// échouait — c'est pourquoi ni <Script afterInteractive> (PR 171) ni l'injection
// useEffect (PR 173) n'affichaient le calendrier. Preuve que l'environnement est
// sain : injecter widget.js à la main + Calendly.initInlineWidget crée l'iframe.
//
// Solution DOUBLE VOIE, idempotente (drapeau data-cal-init) :
//   1. Script INLINE rendu dans le HTML SSR → s'exécute au PARSE du navigateur,
//      sans dépendre de React/hydratation. Couvre le chargement direct (SEO,
//      lien direct, refresh) = le cas du bug d'origine.
//   2. useEffect → couvre la navigation SPA (next/link), où le script inline
//      n'est pas ré-exécuté par React mais où le composant se rend côté client.
// Le conteneur porte suppressHydrationWarning : React ne réconcilie pas l'iframe
// injectée avant l'hydratation. CSP : script-src autorise 'unsafe-inline' (les
// <script> JSON-LD de la page fonctionnent déjà ainsi ; aucun nonce).

import { useEffect, useRef } from "react";

const CALENDLY_WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_EMBED_ID = "calendly-inline-embed";

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
 * Bootstrap inline (voie 1). Sérialisé dans le HTML SSR, exécuté au parse.
 * Idempotent via l'attribut data-cal-init. L'URL est lue depuis data-cal-url
 * (jamais interpolée dans le code JS → aucun risque d'injection).
 */
const CALENDLY_BOOTSTRAP = `(function(){
  var id=${JSON.stringify(CALENDLY_EMBED_ID)};
  var src=${JSON.stringify(CALENDLY_WIDGET_JS)};
  var el=document.getElementById(id);
  if(!el||el.getAttribute("data-cal-init")==="1")return;
  var url=el.getAttribute("data-cal-url");
  if(!url)return;
  function init(){
    if(!window.Calendly)return;
    el.setAttribute("data-cal-init","1");
    try{window.Calendly.initInlineWidget({url:url,parentElement:el});}catch(e){}
  }
  if(window.Calendly){init();return;}
  var ex=document.querySelector('script[data-calendly-loader]');
  if(ex){ex.addEventListener("load",init);return;}
  var s=document.createElement("script");
  s.src=src;s.async=true;s.setAttribute("data-calendly-loader","");s.onload=init;
  document.head.appendChild(s);
})();`;

export function CalendlyInlineWidget({
  calendlyUrl,
  isFr,
  height = 720,
}: CalendlyInlineWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const finalUrl = calendlyUrl ? buildCalendlyUrl(calendlyUrl) : null;

  // Voie 2 : navigation SPA (client). Idempotent avec la voie 1 (data-cal-init).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.getAttribute("data-cal-init") === "1") return;
    const url = el.getAttribute("data-cal-url");
    if (!url) return;

    let cancelled = false;
    const init = () => {
      if (cancelled || !window.Calendly) return;
      if (el.getAttribute("data-cal-init") === "1") return;
      el.setAttribute("data-cal-init", "1");
      try {
        window.Calendly.initInlineWidget({ url, parentElement: el });
      } catch {
        // fail-soft : le lien « Ouvrir Calendly directement » reste visible.
      }
    };

    if (window.Calendly) {
      init();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-calendly-loader]");
    if (existing) {
      existing.addEventListener("load", init);
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = CALENDLY_WIDGET_JS;
    script.async = true;
    script.setAttribute("data-calendly-loader", "");
    script.addEventListener("load", init);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!calendlyUrl || !finalUrl) {
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
    <div>
      <div
        id={CALENDLY_EMBED_ID}
        ref={containerRef}
        data-cal-url={finalUrl}
        suppressHydrationWarning
        className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-lg"
        style={{ minWidth: "320px", height: `${height}px` }}
        aria-label={isFr ? "Calendrier de prise de rendez-vous" : "Booking calendar"}
      />
      {/* Voie 1 : bootstrap inline exécuté au parse (indépendant de l'hydratation). */}
      <script data-calendly-bootstrap dangerouslySetInnerHTML={{ __html: CALENDLY_BOOTSTRAP }} />
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
