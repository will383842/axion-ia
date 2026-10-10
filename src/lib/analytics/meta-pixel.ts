// Helpers CLIENT du pixel Meta — purs, sans React, sûrs au SSR.
//
// Le pixel n'est chargé que par `<MetaPixel />` (consentement + route du
// tunnel). Ces helpers ne font donc RIEN tant que `window.fbq` n'existe pas :
// pas de consentement, pas de pixel, pas d'événement — et pas d'erreur.

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const f = (window as unknown as { fbq?: unknown }).fbq;
  return typeof f === "function" ? (f as Fbq) : null;
}

/**
 * Événement standard `Lead`, avec l'`eventID` = identifiant de la Submission.
 * L'API Conversions envoie le même identifiant côté serveur : Meta ne compte
 * qu'une conversion, quel que soit celui des deux tirs qui arrive en premier.
 */
export function trackMetaLead(eventId: string): void {
  const f = fbq();
  if (!f) return;
  f("track", "Lead", {}, { eventID: eventId });
}

/**
 * Événement standard `Schedule` (réservation du créneau), `eventID` =
 * `schedule:<identifiant de la réservation Calendly>` — le serveur envoie le même
 * `event_id` (enrichissement Calendly) : Meta ne compte qu'une conversion.
 */
export function trackMetaSchedule(eventId: string): void {
  const f = fbq();
  if (!f) return;
  f("track", "Schedule", {}, { eventID: eventId });
}

/**
 * Événement standard `SubmitApplication` (étape 2 de la page vidéo validée),
 * `eventID` = `candidature:<identifiant de la ligne>` — le serveur envoie le même
 * `event_id` : Meta ne compte qu'une conversion.
 */
export function trackMetaSubmitApplication(eventId: string): void {
  const f = fbq();
  if (!f) return;
  f("track", "SubmitApplication", {}, { eventID: eventId });
}

/** Cookie `_fbp` posé par le pixel — transmis à l'API Conversions pour l'appariement. */
export function lireCookieFbp(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = /(?:^|;\s*)_fbp=([^;]+)/.exec(document.cookie);
  const v = m?.[1];
  return v && /^fb\.1\.\d{6,20}\.\d{1,25}$/.test(v) ? v : undefined;
}
