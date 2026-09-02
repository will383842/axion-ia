"use client";
// use-client: un effet de défilement, rien d'autre. Le formulaire et les pages
// de fin restent sans JavaScript propre ; ce composant n'ajoute qu'un geste
// que le navigateur faisait de lui-même avant que l'action serveur ne l'en
// empêche.

import { useEffect } from "react";

/**
 * Après une action serveur, ramener l'écran sur ce qui vient de changer.
 *
 * ## Le défaut, mesuré en prod le 2026-09-02
 *
 * Nos formulaires (réserver, annuler, reporter) postent vers une action
 * serveur qui répond par `redirect()`. Avec JavaScript, Next enchaîne une
 * navigation CLIENT — et une navigation client conserve la position de
 * défilement. Le bouton d'envoi est en bas d'un formulaire de ~1 400 px :
 * - après « Confirmer », `/appel/confirme` s'ouvrait à scrollY = 526, le titre
 *   « C'est réservé » 325 px au-dessus de l'écran ; au téléphone, le prospect
 *   voyait le pied de page ;
 * - après un refus, le bandeau « N points à corriger » était 990 px au-dessus
 *   de l'écran : le prospect restait devant le bouton, sans rien voir changer.
 *
 * Sans JavaScript, le navigateur suit un 303 et repart du haut : le défaut
 * n'existe pas. Ce composant ne fait donc que restituer ce comportement là où
 * l'hydratation l'a retiré.
 *
 * ## Ce qu'il fait, et ne fait pas
 *
 * Il remonte en haut de page une seule fois, au montage, et donne le focus au
 * message visé (`vers`, l'identifiant d'un élément) pour que les lecteurs
 * d'écran l'annoncent. Il n'anime rien : un défilement animé après une action
 * donne l'impression que la page bouge toute seule.
 */
export function RemonterAuMessage({ vers }: { vers?: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    if (vers) {
      const cible = document.getElementById(vers);
      if (cible instanceof HTMLElement) {
        if (!cible.hasAttribute("tabindex")) cible.setAttribute("tabindex", "-1");
        cible.focus({ preventScroll: true });
      }
    }
  }, [vers]);
  return null;
}
