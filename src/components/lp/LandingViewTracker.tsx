"use client";
// use-client: émission d'un événement à l'affichage (effet, sessionStorage).

// « Landing Viewed » : une fois par visite, à l'affichage d'une page de tunnel.
//
// ── Pourquoi un composant et pas le simple affichage de page ───────────────
// Plausible compte déjà les pages vues, mais seule la BASE (`funnel_events`)
// permet de chaîner la visite aux étapes suivantes par `sessionId` et de lire
// un entonnoir « visites → étape 1 → étape 2 ». Sans cet événement, le haut de
// l'entonnoir n'existe pas en base.
//
// « Une fois par visite » : la clé vit dans `sessionStorage` (jamais un cookie,
// cf. `funnel-beacon.ts`). Un rechargement, ou un retour arrière depuis la page
// suivante, ne doit pas gonfler le nombre de visites. Si le stockage est
// interdit, on émet quand même — mieux vaut compter deux fois un visiteur
// rare que ne pas le compter.
//
// Ne rend rien : aucun impact sur la mise en page.

import * as React from "react";
import { trackFunnel } from "@/lib/tracking";

interface LandingViewTrackerProps {
  /** Identifiant de la page (`landing`), ex. `apporteur-court`. */
  landing: string;
}

export function LandingViewTracker({ landing }: LandingViewTrackerProps) {
  React.useEffect(() => {
    const cle = `axion-landing-viewed:${landing}`;
    try {
      if (window.sessionStorage.getItem(cle)) return;
      window.sessionStorage.setItem(cle, "1");
    } catch {
      // Stockage indisponible : on émet quand même (voir en-tête).
    }
    trackFunnel("Landing Viewed", { landing });
  }, [landing]);

  return null;
}
