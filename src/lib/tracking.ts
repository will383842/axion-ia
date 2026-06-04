// Tracking funnel typé — Sprint X.18 / Booking V1.
//
// Helpers TS au-dessus de trackEvent (components/analytics/Plausible.tsx) :
// types stables pour les événements funnel + props validées.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.18 § Plausible/PostHog events
//   - Doctrine privacy-first : pas de PII dans les props (juste IDs/buckets)

import { trackEvent } from "@/lib/analytics/plausible-tracker";

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
  | "Reschedule Completed"
  // Chatbot (T-22)
  | "Chat Started"
  | "Chat Qualified"
  | "Chat RDV"
  | "Chat Lead"
  | "Chat Escalated";

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
 * P1-19 audit indexation 2026-05-15 — détection du moteur de recherche source.
 *
 * Avant ce patch, Plausible dashboard montrait les referers raw (chat.openai.com,
 * google.fr, bing.com…). Pas de bucket distinguant `chatgpt-direct` (utilisateur
 * arrivant d'une réponse ChatGPT) vs `chatgpt-search` (depuis le module search
 * OAI), ni `perplexity` vs `claude` (citations LLM). Cette catégorisation est
 * critique pour mesurer l'AEO/GEO ROI (trafic depuis citations LLM vs SERP).
 *
 * Mapping simplifié — extensible :
 *   - google.fr / google.com / google.* → "google"
 *   - bing.com → "bing"
 *   - qwant.com → "qwant"
 *   - duckduckgo.com → "ddg"
 *   - ecosia.org → "ecosia"
 *   - lilo.org → "lilo"
 *   - perplexity.ai → "perplexity"
 *   - chat.openai.com / chatgpt.com → "chatgpt"
 *   - claude.ai → "claude"
 *   - gemini.google.com / bard.google.com → "gemini"
 *   - mistral.ai / chat.mistral.ai → "mistral"
 *   - copilot.microsoft.com → "copilot"
 *   - (vide / null) → "direct"
 *   - reste → "other"
 *
 * Pure function — aucune dépendance DOM. Test unitaires colocalisés.
 */
export type RefererSource =
  | "google"
  | "bing"
  | "qwant"
  | "ddg"
  | "ecosia"
  | "lilo"
  | "perplexity"
  | "chatgpt"
  | "claude"
  | "gemini"
  | "mistral"
  | "copilot"
  | "direct"
  | "other";

const REFERER_PATTERNS: ReadonlyArray<{ test: RegExp; source: RefererSource }> = [
  { test: /^https?:\/\/(?:www\.)?google\.[a-z.]+\//i, source: "google" },
  { test: /^https?:\/\/(?:www\.)?bing\.com\//i, source: "bing" },
  { test: /^https?:\/\/(?:www\.)?qwant\.com\//i, source: "qwant" },
  { test: /^https?:\/\/(?:duckduckgo\.com|html\.duckduckgo\.com)\//i, source: "ddg" },
  { test: /^https?:\/\/(?:www\.)?ecosia\.org\//i, source: "ecosia" },
  { test: /^https?:\/\/(?:www\.)?lilo\.org\//i, source: "lilo" },
  { test: /^https?:\/\/(?:www\.)?perplexity\.ai\//i, source: "perplexity" },
  { test: /^https?:\/\/(?:chat\.openai\.com|chatgpt\.com)\//i, source: "chatgpt" },
  { test: /^https?:\/\/(?:www\.)?claude\.ai\//i, source: "claude" },
  { test: /^https?:\/\/(?:gemini|bard)\.google\.com\//i, source: "gemini" },
  { test: /^https?:\/\/(?:chat\.)?mistral\.ai\//i, source: "mistral" },
  { test: /^https?:\/\/copilot\.microsoft\.com\//i, source: "copilot" },
];

export function detectSearchEngine(referrer: string | null | undefined): RefererSource {
  const ref = (referrer ?? "").trim();
  if (ref.length === 0) return "direct";
  for (const { test, source } of REFERER_PATTERNS) {
    if (test.test(ref)) return source;
  }
  return "other";
}

/**
 * Track un événement "Page Referer Source" Plausible avec la source LLM/SERP
 * détectée. À appeler au mount d'une page côté client (cf. `<RefererTracker />`).
 * No-op si window.plausible absent ou si la source est "direct" (bruit).
 */
export function trackRefererSource(referrer: string | null | undefined): void {
  const source = detectSearchEngine(referrer);
  if (source === "direct") return;
  trackEvent("Page Referer Source", { props: { source } });
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
