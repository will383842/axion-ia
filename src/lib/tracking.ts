// Tracking funnel typé — Sprint X.18 / Booking V1.
//
// Helpers TS au-dessus de trackEvent (components/analytics/Plausible.tsx) :
// types stables pour les événements funnel + props validées.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.18 § Plausible/PostHog events
//   - Doctrine privacy-first : pas de PII dans les props (juste IDs/buckets)

import { trackEvent } from "@/components/analytics/Plausible";

/**
 * Événements funnel V1. Tout nouvel événement DOIT être ajouté ici (et pas
 * inline avec une string magique) pour éviter la dérive nom/typo.
 */
export type FunnelEvent =
  // Parcours visiteur
  | "Booking Started"
  | "Booking Submitted"
  | "Booking Confirmed"
  // Parcours B devis qualifié
  | "Quote Request Started"
  | "Quote Request Submitted"
  // Audit hub /audit
  | "Audit Started"
  | "Audit Submitted"
  // Paiement
  | "Payment Started"
  | "Payment Completed"
  | "Payment Failed"
  // Self-service magic-link
  | "Cancellation Started"
  | "Cancellation Completed"
  | "Reschedule Started"
  | "Reschedule Completed";

/**
 * Props standard validées (clés stables, valeurs string/number uniquement).
 * Plausible exige des chaînes scalaires côté props (pas de nested object).
 */
export interface FunnelProps {
  /** Slug intervention kebab-case (essentielle, intervention-claude, etc.). */
  intervention?: string;
  /** Service source (audit, interventions, implementation). */
  fromService?: string;
  /** Ville pSEO d'origine (lowercased). */
  fromCity?: string;
  /** Région pSEO d'origine (lowercased). */
  fromRegion?: string;
  /** Phase pSEO d'origine (paris-pilote, tier1, tier2). */
  fromPhase?: string;
  /** UTM source/medium/campaign. */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Drapeaux flow conditionnel. */
  hasCadrage?: "yes" | "no";
  requiresQuote?: "yes" | "no";
  requiresNda?: "yes" | "no";
  /** Bucket prix (ne PAS envoyer prix exact pour anonymat). */
  priceBucket?: "lt-500" | "500-1000" | "1000-2000" | "2000-5000" | "gt-5000";
}

/**
 * Track un événement funnel typé. No-op si window.plausible absent.
 *
 * Exemples :
 *   trackFunnel("Booking Submitted", { intervention: "essentielle", utmSource: "google" });
 *   trackFunnel("Payment Completed", { intervention: "approfondie", priceBucket: "1000-2000" });
 */
export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): void {
  // Build props sanitized : que des chaînes/nombres non-vides.
  const cleaned: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string" || typeof v === "number") cleaned[k] = v;
  }
  trackEvent(event, Object.keys(cleaned).length > 0 ? { props: cleaned } : undefined);
}

/**
 * Helper pour bucketiser un prix HT (cents) en plage d'analyse.
 * Évite d'envoyer le montant exact en clair sur Plausible.
 */
export function priceBucketFromCents(
  cents: number | null | undefined,
): FunnelProps["priceBucket"] | undefined {
  if (typeof cents !== "number" || cents < 0) return undefined;
  const eur = cents / 100;
  if (eur < 500) return "lt-500";
  if (eur < 1000) return "500-1000";
  if (eur < 2000) return "1000-2000";
  if (eur < 5000) return "2000-5000";
  return "gt-5000";
}
