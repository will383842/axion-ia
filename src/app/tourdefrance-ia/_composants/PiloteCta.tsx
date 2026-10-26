"use client";
// use-client: IntersectionObserver du bouton collant et recopie des utm_* / fbclid de l'adresse d'arrivée.

// Tour de France IA — le SEUL composant client de la landing (2026-10-25).
//
// Il ne rend rien. Au montage, il :
//   1. recopie les `utm_*` et le `fbclid` de l'adresse d'arrivée sur chaque
//      bouton de rendez-vous (`a[data-tdf-cta]`) — la page reste statique une
//      fois ouverte. Les `utm_*` sont relus par `/fr/appel/…` puis transmis à
//      Calendly (`avecUtmContent`) ; le `fbclid` (ajouté par Facebook et
//      Instagram à tout lien sortant) n'est relu par personne AUJOURD'HUI :
//      il est gardé dans l'adresse pour qu'un futur relais (API de conversions
//      de Meta) puisse le lire sans retoucher la page ;
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
/** L'identifiant de clic de Meta : lettres, chiffres, `_` et `-`, borné. */
const FORME_FBCLID = /^[A-Za-z0-9_-]{1,500}$/;

export function PiloteCta({ idHeros, idCollant }: { idHeros: string; idCollant: string }) {
  useEffect(() => {
    const arrivee = new URLSearchParams(window.location.search);
    const suivi: Array<[string, string]> = PARAMS_UTM.flatMap((cle) => {
      const v = arrivee.get(cle);
      return v && FORME_UTM.test(v) ? [[cle, v] as [string, string]] : [];
    });
    const fbclid = arrivee.get("fbclid");
    if (fbclid && FORME_FBCLID.test(fbclid)) suivi.push(["fbclid", fbclid]);
    if (suivi.length > 0) {
      for (const lien of document.querySelectorAll<HTMLAnchorElement>("a[data-tdf-cta]")) {
        const url = new URL(lien.href, window.location.origin);
        for (const [cle, v] of suivi) url.searchParams.set(cle, v);
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
