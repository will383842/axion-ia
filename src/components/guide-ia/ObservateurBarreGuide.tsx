"use client";
// use-client: IntersectionObserver décide quand la barre collante apparaît ; aucun rendu.

/**
 * Montre la barre collante du guide (`BarreGuideCollante`, rendue par le
 * serveur) quand le premier formulaire est DÉPASSÉ et qu'aucun formulaire du
 * guide n'est à l'écran ; la cache sinon. Ne rend rien.
 *
 * Elle se cache aussi :
 *   · devant le pied de page — elle en recouvrirait les dernières lignes
 *     (liens légaux) ;
 *   · pour de bon, dès qu'une demande du guide est ACCEPTÉE : elle n'a plus
 *     rien à proposer.
 */

import { useEffect } from "react";
import {
  ATTRIBUT_FORMULAIRE_GUIDE,
  EVENEMENT_GUIDE_ENVOYE,
  ID_BARRE_GUIDE,
} from "./attribut-formulaire";

export function ObservateurBarreGuide(): null {
  useEffect(() => {
    const barre = document.getElementById(ID_BARRE_GUIDE);
    const formulaires = document.querySelectorAll(`[${ATTRIBUT_FORMULAIRE_GUIDE}]`);
    const premier = formulaires[0];
    if (!barre || !premier || !("IntersectionObserver" in window)) return;
    const pied = document.querySelector("footer");
    const aLEcran = new Set<Element>();
    let envoye = false;
    const appliquer = () => {
      // Jamais AU-DESSUS du premier formulaire : seulement une fois défilé.
      const visible = !envoye && aLEcran.size === 0 && premier.getBoundingClientRect().bottom < 0;
      barre.dataset["visible"] = String(visible);
      barre.inert = !visible;
    };
    const observateur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (e.isIntersecting) aLEcran.add(e.target);
        else aLEcran.delete(e.target);
      }
      appliquer();
    });
    formulaires.forEach((f) => observateur.observe(f));
    if (pied) observateur.observe(pied);
    const surEnvoi = () => {
      envoye = true;
      appliquer();
    };
    window.addEventListener(EVENEMENT_GUIDE_ENVOYE, surEnvoi);
    return () => {
      observateur.disconnect();
      window.removeEventListener(EVENEMENT_GUIDE_ENVOYE, surEnvoi);
    };
  }, []);
  return null;
}
