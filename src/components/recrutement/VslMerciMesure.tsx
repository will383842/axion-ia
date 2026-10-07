"use client";
// use-client: tire l'étape « Call Booking Viewed » de l'entonnoir apporteurs à l'affichage — navigateur seulement.

// Mesure de la page « C'est noté » des apporteurs (2026-10-07).
//
// Avant, l'île `VslMerciCalendly` portait le calendrier Calendly intégré, son
// préremplissage et l'écoute de la réservation. La page montre désormais la
// réservation du SITE (créneaux en HTML, formulaire sans JavaScript) : il ne
// reste au navigateur que cette mesure. L'étape `merci` de l'entonnoir de la
// console (`apporteurs-entonnoir.ts`) la lit sous ce nom exact.
//
// Le `Schedule` Meta et le `Call Booked` Plausible de la réservation ne partent
// plus d'ici : l'enrichissement Calendly les émet côté serveur pour toute
// réservation d'échange apporteur (`server/calendly/enrich.ts`), avec le même
// `event_id` qu'avant.
//
// Ne rend rien.

import * as React from "react";
import { trackFunnel } from "@/lib/tracking";

export function VslMerciMesure({ landing }: { readonly landing: string }) {
  React.useEffect(() => {
    trackFunnel("Call Booking Viewed", { landing });
  }, [landing]);
  return null;
}
