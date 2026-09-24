"use client";
// use-client: IntersectionObserver décide quand la barre collante apparaît ; aucun rendu.

/**
 * Montre la barre collante du guide (`BarreGuideCollante`, rendue par le
 * serveur) quand le premier formulaire est DÉPASSÉ et qu'aucun formulaire du
 * guide n'est à l'écran ; la cache sinon. Ne rend rien.
 */

import { useEffect } from "react";
import { ATTRIBUT_FORMULAIRE_GUIDE, ID_BARRE_GUIDE } from "./attribut-formulaire";

export function ObservateurBarreGuide(): null {
  useEffect(() => {
    const barre = document.getElementById(ID_BARRE_GUIDE);
    const formulaires = document.querySelectorAll(`[${ATTRIBUT_FORMULAIRE_GUIDE}]`);
    const premier = formulaires[0];
    if (!barre || !premier || !("IntersectionObserver" in window)) return;
    const aLEcran = new Set<Element>();
    const observateur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (e.isIntersecting) aLEcran.add(e.target);
        else aLEcran.delete(e.target);
      }
      // Jamais AU-DESSUS du premier formulaire : seulement une fois défilé.
      const visible = aLEcran.size === 0 && premier.getBoundingClientRect().bottom < 0;
      barre.dataset["visible"] = String(visible);
      barre.inert = !visible;
    });
    formulaires.forEach((f) => observateur.observe(f));
    return () => observateur.disconnect();
  }, []);
  return null;
}
