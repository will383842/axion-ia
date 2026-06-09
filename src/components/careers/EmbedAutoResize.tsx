"use client";
// use-client: ResizeObserver + postMessage — communique la hauteur réelle du
// contenu à la fenêtre parente pour que le loader script redimensionne l'iframe
// (auto-resize, pas de scrollbar interne). Aucun rendu visuel.

import { useEffect } from "react";

const MESSAGE_TYPE = "axion-offers-widget:height";

/**
 * Monté dans la page d'embed `/[locale]/carrieres/widget`. Mesure la hauteur du
 * document et l'envoie au parent (`window.parent.postMessage`) au montage puis à
 * chaque changement de taille. Le script public `/widget/offres-emploi.js`
 * écoute ce message et ajuste la hauteur de l'iframe.
 *
 * `targetOrigin: "*"` est volontaire : le widget est conçu pour être embarqué sur
 * n'importe quel domaine tiers (CSP `frame-ancestors *`). Le message ne contient
 * qu'un entier (hauteur) — aucune donnée sensible.
 */
export function EmbedAutoResize() {
  useEffect(() => {
    if (window.parent === window) return; // pas dans un iframe → no-op

    const post = () => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      window.parent.postMessage({ type: MESSAGE_TYPE, height }, "*");
    };

    post();

    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);

    // Le parent peut redemander la hauteur (ex. après changement de viewport).
    const onMessage = (e: MessageEvent) => {
      if (e.data === "axion-offers-widget:request-height") post();
    };
    window.addEventListener("message", onMessage);

    return () => {
      ro.disconnect();
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
