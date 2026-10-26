"use client";
// use-client: émission d'un événement à l'affichage (effet, sessionStorage).

// « Call Booking Viewed » à l'arrivée sur une page de RÉSERVATION (2026-10-26).
//
// Sert le Tour de France IA : sa landing (`/tourdefrance-ia`) ne porte aucune
// mesure — choix verrouillé par `le-tour-est-ouvert.spec.ts` et écrit dans la
// politique de confidentialité. Le clic « Participer » se mesure donc là où il
// arrive : `/fr/appel/tour-de-france-ia?depuis=tdf-…`. `placement` reprend le
// `depuis` du bouton (`tdf-heros`, `tdf-final`…), le même repère que
// l'`utm_content` posé chez Calendly : la console relie ainsi les arrivées et
// les rendez-vous bouton par bouton.
//
// Même nom d'étape que la page « C'est noté » des apporteurs (`VslMerciMesure`).
// Une fois par visite (`sessionStorage`, comme `LandingViewTracker`) : un
// rechargement ou un retour depuis le formulaire ne compte pas deux arrivées.
//
// Ne rend rien.

import * as React from "react";
import { trackFunnel } from "@/lib/tracking";

export function ArriveeReservationMesure({
  landing,
  placement,
}: {
  readonly landing: string;
  readonly placement: string | null;
}) {
  React.useEffect(() => {
    const cle = `axion-reservation-vue:${landing}`;
    try {
      if (window.sessionStorage.getItem(cle)) return;
      window.sessionStorage.setItem(cle, "1");
    } catch {
      // Stockage indisponible : on émet quand même (même règle que `LandingViewTracker`).
    }
    trackFunnel("Call Booking Viewed", { landing, ...(placement ? { placement } : {}) });
  }, [landing, placement]);
  return null;
}
