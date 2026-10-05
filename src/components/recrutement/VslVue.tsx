"use client";
// use-client: émet « Landing Viewed » à l'affichage et retient le fbclid selon le consentement — effets navigateur.

// Île invisible de la page VSL apporteurs : deux gestes, aucun rendu.
//
//  1. « Landing Viewed » — une fois par visite.
//  2. Prélèvement du `fbclid` de l'adresse d'arrivée, dans `sessionStorage` et
//     AVEC l'heure — SEULEMENT si le visiteur a accepté la bannière publicitaire
//     (voir `vsl-attribution.ts`). Si le choix vient APRÈS l'arrivée, l'effet se
//     relance au changement de consentement et prend l'heure d'arrivée de la page
//     (pas celle du clic sur la bannière).

import * as React from "react";
import { trackFunnel } from "@/lib/tracking";
import { useAnalyticsConsent } from "@/components/analytics/CookieConsent";
import { memoriserFbclid } from "@/lib/recrutement/vsl-attribution";

export function VslVue({ landing }: { landing: string }) {
  const consentement = useAnalyticsConsent();
  const arrivee = React.useRef(0);
  const vue = React.useRef(false);

  React.useEffect(() => {
    if (arrivee.current === 0) arrivee.current = Date.now();
    if (!vue.current) {
      vue.current = true;
      trackFunnel("Landing Viewed", { landing });
    }
  }, [landing]);

  React.useEffect(() => {
    memoriserFbclid(
      window.location.search,
      consentement === "accepted",
      arrivee.current || Date.now(),
    );
  }, [consentement]);

  return null;
}
