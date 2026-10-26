"use client";
// use-client: IntersectionObserver du bouton collant et recopie des utm_* de l'adresse d'arrivée.

// Tour de France IA — le SEUL composant client de la landing (2026-10-25).
//
// Il ne rend rien. Au montage, il :
//   1. recopie les `utm_*` de l'adresse d'arrivée sur chaque bouton de rendez-vous
//      (`a[data-tdf-cta]`) — la page reste statique une fois ouverte, et le
//      cookie `axion_utm` (posé par le proxy) garde l'attribution en double ;
//   2. montre le bouton collant du bas d'écran (mobile) dès que le bouton du
//      héros a quitté l'écran (IntersectionObserver), et le cache à nouveau
//      quand il revient.
//
// Sans JavaScript, la page reste complète : le bouton collant reste caché, les
// boutons de la page mènent au rendez-vous sans les `utm_*` (le cookie suffit).

import { useEffect } from "react";

const PARAMS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
/** Même forme que `lireSuiviArrivee` (`choix-rendez-vous.ts`) : sinon la valeur est abandonnée là-bas. */
const FORME_UTM = /^[A-Za-z0-9][A-Za-z0-9-]{0,59}$/;

export function PiloteCta({ idHeros, idCollant }: { idHeros: string; idCollant: string }) {
  useEffect(() => {
    const arrivee = new URLSearchParams(window.location.search);
    const utm = PARAMS_UTM.flatMap((cle) => {
      const v = arrivee.get(cle);
      return v && FORME_UTM.test(v) ? [[cle, v] as const] : [];
    });
    if (utm.length > 0) {
      for (const lien of document.querySelectorAll<HTMLAnchorElement>("a[data-tdf-cta]")) {
        const url = new URL(lien.href, window.location.origin);
        for (const [cle, v] of utm) url.searchParams.set(cle, v);
        lien.href = `${url.pathname}${url.search}`;
      }
    }

    const heros = document.getElementById(idHeros);
    const collant = document.getElementById(idCollant);
    if (!heros || !collant || typeof IntersectionObserver === "undefined") return;
    const observateur = new IntersectionObserver(([entree]) => {
      // Visible seulement quand le bouton du héros est passé AU-DESSUS de l'écran.
      const passe = !!entree && !entree.isIntersecting && entree.boundingClientRect.top < 0;
      collant.dataset["visible"] = passe ? "true" : "false";
      collant.toggleAttribute("inert", !passe);
    });
    observateur.observe(heros);
    return () => observateur.disconnect();
  }, [idHeros, idCollant]);

  return null;
}
