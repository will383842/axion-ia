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

      const corps = JSON.stringify({
        eventName,
        payload,
        eventTypeSlug,
        ...trackingContext,
      });

      /**
       * 🔑 LIRE `res.ok` — corrigé le 2026-08-31.
       *
       * Ce bloc ne lisait PAS le statut de la réponse et son `catch` était
       * vide : un 403 (garde d'origine), un 429 (débit) ou un 500 (base
       * indisponible) étaient traités exactement comme un succès. La
       * réservation existait chez Calendly, la ligne manquait chez nous, et
       * RIEN ne le disait — ni au visiteur, ni dans un journal, ni à Will.
       *
       * Le repli reste volontairement doux (on ne montre rien au visiteur :
       * sa réservation est bien prise côté Calendly, l'alarmer serait faux),
       * mais il n'est plus MUET, et il réessaie une fois — la plupart des
       * échecs ici sont transitoires.
       *
       * ⚠️ Ce chemin est inerte depuis l'ADR 0038 (2026-07-30) : la page ne
       * charge plus d'iframe Calendly, donc plus aucun `postMessage` ne lui
       * parvient et le sondage API porte seul la capture. Il reste atteignable
       * par le repli `CalendlyConsentGate`, d'où la correction plutôt que la
       * suppression.
       */
      const envoyer = async (): Promise<boolean> => {
        try {
          const res = await fetch("/api/calendly/client-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: corps,
            // keepalive : survit a un navigateClose immediat post-reservation.
            keepalive: true,
          });
          if (!res.ok) {
            console.error(`[calendly:capture] refus ${res.status} — reservation non enregistree`);
            return false;
          }
          return true;
        } catch (err) {
          const cause = err instanceof Error ? err.name : "inconnue";
          console.error(`[calendly:capture] envoi impossible (${cause})`);
          return false;
        }
      };

      if (await envoyer()) return;
      // Un seul réessai, décalé : un 429 se dissipe, une garde d'origine non.
      window.setTimeout(() => {
        void envoyer().then((ok) => {
          if (!ok) {
            console.error(
              "[calendly:capture] ABANDON — la reservation existe chez Calendly mais PAS en base ; " +
                "le sondage API (cron 1/min) devrait la rattraper, sinon la saisir en console.",
            );
          }
        });
      }, 2000);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [calendlyUrl, trackingContext]);

  return null;
}
