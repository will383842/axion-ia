"use client";
// use-client: IntersectionObserver du bouton collant et recopie des utm_* de l'adresse d'arrivée.

// Tour France IA — le SEUL composant client de la landing (2026-10-25).
//
// Il ne rend rien. Au montage, il :
//   1. recopie les `utm_*` de l'adresse d'arrivée sur chaque bouton de
//      rendez-vous (`a[data-tdf-cta]`) — la page reste statique une fois
//      ouverte. Ils sont relus par `/fr/appel/…` puis transmis à Calendly
//      (`avecUtmContent`). Rien d'autre n'est recopié : `/fr/appel/…` ne lit
//      que les `utm_*` et `depuis` (le `fbclid` de Meta n'y est lu par personne) ;
//   2. montre le bouton collant du bas d'écran (mobile) entre deux moments :
//      quand le bouton du héros a quitté l'écran par le haut, et jusqu'à ce que
//      l'appel final arrive à l'écran — il y a alors déjà un bouton sous le pouce.
//
// Sans JavaScript, la page reste complète : le bouton collant reste caché, les
// boutons de la page mènent au rendez-vous sans les `utm_*` (le cookie suffit).

import { useEffect } from "react";

const PARAMS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
/** Même forme que `lireSuiviArrivee` (`choix-rendez-vous.ts`) : sinon la valeur est abandonnée là-bas. */
const FORME_UTM = /^[A-Za-z0-9][A-Za-z0-9-]{0,59}$/;

export function PiloteCta({
  idHeros,
  idFinal,
  idCollant,
}: {
  idHeros: string;
  idFinal: string;
  idCollant: string;
}) {
  useEffect(() => {
    const arrivee = new URLSearchParams(window.location.search);
    const suivi: Array<[string, string]> = PARAMS_UTM.flatMap((cle) => {
      const v = arrivee.get(cle);
      return v && FORME_UTM.test(v) ? [[cle, v] as [string, string]] : [];
    });
    if (suivi.length > 0) {
      for (const lien of document.querySelectorAll<HTMLAnchorElement>("a[data-tdf-cta]")) {
        const url = new URL(lien.href, window.location.origin);
        for (const [cle, v] of suivi) url.searchParams.set(cle, v);
        lien.href = `${url.pathname}${url.search}`;
      }
    }

    const heros = document.getElementById(idHeros);
    const final = document.getElementById(idFinal);
    const collant = document.getElementById(idCollant);
    if (!heros || !final || !collant || typeof IntersectionObserver === "undefined") return;
    // L'observateur ne rend que les cibles qui ont CHANGÉ : on garde l'état des deux.
    let herosPasse = false;
    let finalAtteint = false;
    const observateur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        // Passé AU-DESSUS de l'écran (et non pas encore atteint en descendant).
        const audessus = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === heros) herosPasse = audessus;
        // Atteint : à l'écran, ou déjà dépassé (le pied de page est en dessous).
        if (e.target === final) finalAtteint = e.isIntersecting || audessus;
      }
      const visible = herosPasse && !finalAtteint;
      collant.dataset["visible"] = visible ? "true" : "false";
      collant.toggleAttribute("inert", !visible);
    });
    observateur.observe(heros);
    observateur.observe(final);
    return () => observateur.disconnect();
  }, [idHeros, idFinal, idCollant]);

  return null;
}
