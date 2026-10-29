"use client";
// use-client: recopie des utm_* de l'adresse d'arrivée sur les boutons de rendez-vous.

// Tour France IA — le SEUL composant client de la landing (2026-10-25).
//
// Il ne rend rien. Au montage, il recopie les `utm_*` de l'adresse d'arrivée sur
// chaque bouton de rendez-vous (`a[data-tdf-cta]`) — la page reste statique une
// fois ouverte. Ils sont relus par `/fr/appel/…` puis transmis à Calendly
// (`avecUtmContent`). Rien d'autre n'est recopié : `/fr/appel/…` ne lit que les
// `utm_*` et `depuis` (le `fbclid` de Meta n'y est lu par personne).
//
// La barre collante du bas d'écran ne passe PLUS par lui (2026-10-27) : elle est
// en CSS seul (`position: sticky`, `tour.module.css`), sans observateur.
//
// Sans JavaScript, la page reste complète : les boutons mènent au rendez-vous sans
// les `utm_*` (le cookie suffit).

import { useEffect } from "react";

const PARAMS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
/** Même forme que `lireSuiviArrivee` (`choix-rendez-vous.ts`) : sinon la valeur est abandonnée là-bas. */
const FORME_UTM = /^[A-Za-z0-9][A-Za-z0-9-]{0,59}$/;

export function PiloteCta() {
  useEffect(() => {
    const arrivee = new URLSearchParams(window.location.search);
    const suivi: Array<[string, string]> = PARAMS_UTM.flatMap((cle) => {
      const v = arrivee.get(cle);
      return v && FORME_UTM.test(v) ? [[cle, v] as [string, string]] : [];
    });
    if (suivi.length === 0) return;
    for (const lien of document.querySelectorAll<HTMLAnchorElement>("a[data-tdf-cta]")) {
      const url = new URL(lien.href, window.location.origin);
      for (const [cle, v] of suivi) url.searchParams.set(cle, v);
      lien.href = `${url.pathname}${url.search}`;
    }
  }, []);

  return null;
}
