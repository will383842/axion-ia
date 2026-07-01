"use client";
// use-client: listener postMessage Calendly iframe (browser-only).
//
// Capture les `calendly.event_scheduled` events emis par l'iframe Calendly
// embed inline sur `/appel`. POST notre endpoint serveur qui persiste
// CalendlyEvent + declenche notif Telegram via hub typé.
//
// Securite : check strict `e.origin.endsWith("calendly.com")` avant tout
// traitement. Pas de UI (component invisible). Aucun impact LCP (listener
// passif post-mount via useEffect).
//
// Documentation officielle Calendly :
//   https://help.calendly.com/hc/en-us/articles/360020052833-Advanced-embed-options

import { useEffect } from "react";

interface CalendlyEventCaptureProps {
  /** URL Calendly active (pour extraire eventTypeSlug). */
  readonly calendlyUrl: string;
  /** UTM/referrer pour tracking attribution. */
  readonly trackingContext: {
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    referrer?: string;
    pageUrl: string;
  };
}

function isCalendlyEvent(e: MessageEvent): boolean {
  return (
    typeof e.data === "object" &&
    e.data !== null &&
    "event" in e.data &&
    typeof (e.data as { event: unknown }).event === "string" &&
    (e.data as { event: string }).event.startsWith("calendly.")
  );
}

export function CalendlyEventCapture({
  calendlyUrl,
  trackingContext,
}: CalendlyEventCaptureProps): null {
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      // Origin check strict — Calendly publie depuis calendly.com (et
      // sous-domaines comme assets.calendly.com). On matche le domaine exact
      // ou un vrai sous-domaine, JAMAIS un suffixe (`endsWith("calendly.com")`
      // laisserait passer `https://evilcalendly.com`).
      if (e.origin !== "https://calendly.com" && !e.origin.endsWith(".calendly.com")) return;
      if (!isCalendlyEvent(e)) return;

      const eventName = (e.data as { event: string }).event;
      // On capte seulement event_scheduled (creation). Les autres events
      // (profile_page_viewed, event_type_viewed, date_and_time_selected)
      // sont purement analytics et ne sont pas persistes.
      if (eventName !== "calendly.event_scheduled") return;

      const payload = (e.data as { payload: unknown }).payload;
      // Extraire eventTypeSlug depuis l'URL Calendly (dernier segment path).
      let eventTypeSlug = "unknown";
      try {
        eventTypeSlug = new URL(calendlyUrl).pathname.split("/").pop() ?? "unknown";
      } catch {
        // calendlyUrl invalide (env var manquante) → fallback "unknown"
      }

      try {
        await fetch("/api/calendly/client-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName,
            payload,
            eventTypeSlug,
            ...trackingContext,
          }),
          // keepalive : survit a un navigateClose immediat post-reservation.
          keepalive: true,
        });
      } catch {
        // fail-soft : si POST echoue, Will recoit toujours l'email Calendly
        // direct dans sa boite Gmail (canal authoritaire de toute facon).
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [calendlyUrl, trackingContext]);

  return null;
}
