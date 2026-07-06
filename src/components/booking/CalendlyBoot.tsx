"use client";
// use-client: shim de secours pour l'embed Calendly natif de /appel.
//
// Contexte (audit 2026-07-06) : l'embed natif Calendly (markup statique
// `.calendly-inline-widget[data-url]` + widget.js `async` rendus en SSR par le
// Server Component `CalendlyInlineWidget`) s'auto-initialise au PARSE lors d'un
// chargement direct / F5 — sans dépendre de l'hydratation React (qui est
// instable sur /appel, cf. résidu React 418). Ce shim couvre les DEUX cas que
// l'auto-scan natif ne couvre pas :
//   1. Navigation SPA (next/link) : widget.js est déjà chargé, donc son
//      auto-scan (qui ne tourne qu'au `load` du script) ne se redéclenche pas
//      sur le nouveau conteneur → on ré-initialise manuellement.
//   2. Auto-guérison : si l'auto-init au parse a raté (échec/stall réseau de
//      widget.js sur le poste du visiteur — cause de l'écran blanc intermittent
//      « il faut F5 »), on (re)charge widget.js, on POLL `window.Calendly`, puis
//      on initialise dès qu'il est prêt.
//
// GARDE ANTI-DOUBLE-IFRAME (le vrai correctif de la course d'init) : on
// n'initialise JAMAIS si le conteneur porte déjà une <iframe>. Deux chemins
// d'init peuvent donc s'exécuter sans jamais créer deux iframes ni déclencher
// le « postMessage target origin mismatch » lié à un double handshake.
//
// Ce composant ne rend AUCUN hoistable (`<script>/<link>/...`) — il renvoie
// `null` — pour ne pas fragiliser l'hydratation de l'îlot (leçon PR 173).

import { useEffect } from "react";

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

export function CalendlyBoot({ url }: { readonly url: string }): null {
  useEffect(() => {
    const el = document.getElementById(CALENDLY_EMBED_ID);
    if (!el) return;

    // Idempotence bulletproof : une iframe présente = déjà initialisé.
    const alreadyEmbedded = () => el.querySelector("iframe") !== null;

    const tryInit = (): boolean => {
      if (alreadyEmbedded()) return true;
      const cal = window.Calendly;
      if (!cal?.initInlineWidget) return false;
      try {
        cal.initInlineWidget({ url, parentElement: el });
      } catch {
        // fail-soft : le lien « Ouvrir Calendly directement » reste visible.
      }
      return true;
    };

    // Cas rapide : auto-init parse déjà fait, ou Calendly déjà prêt (SPA nav).
    if (tryInit()) return;

    // widget.js pas (encore) prêt : s'assurer qu'il se charge, puis poll.
    let script = document.querySelector<HTMLScriptElement>("script[data-calendly-loader]");
    if (!script) {
      script = document.createElement("script");
      script.src = CALENDLY_WIDGET_JS;
      script.async = true;
      script.setAttribute("data-calendly-loader", "");
      document.head.appendChild(script);
    }

    let tries = 0;
    const interval = window.setInterval(() => {
      tries += 1;
      // ~10 s de fenêtre (40 × 250 ms) — couvre un réseau lent sans boucler.
      if (tryInit() || tries >= 40) {
        window.clearInterval(interval);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [url]);

  return null;
}
