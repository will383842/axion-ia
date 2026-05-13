// Helper CTA booking — Sprint X.18 / Booking V1.
//
// Décide à quelle URL un CTA « Réserver » doit pointer selon l'intervention :
//   - Si requiresQuote(intervention) === true → /demande-devis (parcours B)
//   - Sinon → /reserver (parcours A direct)
//
// Permet d'éliminer les CTAs nus vers /reserver qui faisaient atterrir des
// visiteurs sur un calendrier qu'ils ne pouvaient pas réserver (formats Sur
// devis sans slot calendrier).
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.18 § Mapping CTAs parcours B
//   - Sprint X.7 helper requiresQuote (lib/quote-helpers.ts)
//   - Agent 9 P0-1 à P0-4 (CTAs nus à corriger)

import type { InterventionType } from "../../prisma/generated/client";
import { requiresQuote } from "./quote-helpers";

export type BookingPath = "/reserver" | "/demande-devis";

export interface BookingCtaPathOptions {
  /** Slug UI kebab-case (ex. "essentielle") OU enum DB snake_case (ex. "essentielle"). */
  intervention?: InterventionType | null;
  /** Prix de base centimes — utile pour seuil > 5 000 € HT. */
  basePriceHtCents?: number | null;
  /** Locale — affecte l'URL EN (/request-quote, /book). */
  locale?: "fr" | "en";
  /** UTM params à propager (forwardés via query string). */
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  /** Ville pSEO pour préfill `?city=`. */
  city?: string;
}

const PATH_MAP: Record<BookingPath, { fr: string; en: string }> = {
  "/reserver": { fr: "/reserver", en: "/book" },
  "/demande-devis": { fr: "/demande-devis", en: "/request-quote" },
};

/**
 * Retourne le chemin localisé du CTA + ses query params.
 *
 * Exemples :
 *   getBookingCtaPath({ intervention: "essentielle" }) → "/reserver?intervention=essentielle"
 *   getBookingCtaPath({ intervention: "conference" }) → "/demande-devis?intervention=conference"
 *   getBookingCtaPath({ intervention: "essentielle", basePriceHtCents: 600000 })
 *     → "/demande-devis?intervention=essentielle" (au-delà seuil 5k€)
 */
export function getBookingCtaPath(opts: BookingCtaPathOptions = {}): string {
  const locale = opts.locale ?? "fr";
  const wantsQuote = opts.intervention
    ? requiresQuote(opts.intervention, opts.basePriceHtCents ?? null)
    : false;
  const base: BookingPath = wantsQuote ? "/demande-devis" : "/reserver";
  const path = PATH_MAP[base][locale];

  const params = new URLSearchParams();
  if (opts.intervention) params.set("intervention", opts.intervention.replace(/_/g, "-"));
  if (opts.city) params.set("city", opts.city);
  if (opts.utm?.utm_source) params.set("utm_source", opts.utm.utm_source);
  if (opts.utm?.utm_medium) params.set("utm_medium", opts.utm.utm_medium);
  if (opts.utm?.utm_campaign) params.set("utm_campaign", opts.utm.utm_campaign);

  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
