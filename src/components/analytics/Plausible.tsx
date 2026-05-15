// Plausible analytics integration (Sprint 23 / M11).
//
// Self-hosted privacy-first analytics, GDPR-compliant sans cookies (CNIL OK
// sans bandeau consentement). Script servi depuis plausible.axion-ia.com.
//
// Usage : <Plausible /> dans le root layout. No-op si NEXT_PUBLIC_PLAUSIBLE_DOMAIN
// pas defini (preserve dev sans appel reseau parasite).

import Script from "next/script";
import { env } from "@/env";

export function Plausible() {
  const domain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const apiUrl = env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.axion-ia.com";

  if (!domain) return null;

  // strategy="afterInteractive" → script chargé après hydration (n'impacte pas LCP).
  // Script étendu (ordre alphabétique requis par Plausible) :
  //   404            — 404 error pages tracking
  //   file-downloads — clics sur .pdf/.docx/.csv (mentions, sous-processeurs)
  //   outbound-links — clics vers domaines externes
  //   tagged-events  — Custom events via window.plausible(name, opts)
  //                    Requis pour trackEvent("Booking Submitted") etc.
  //   web-vitals     — Active la collecte LCP/INP/CLS côté Plausible (Audit
  //                    2026-05-15 P0 §8.8). Émet un event "Web Vital" custom
  //                    auto + accepte les emit manuels via WebVitals.tsx.
  //                    Permet un dashboard Plausible séparé du RUM /api/vitals.
  return (
    <Script
      defer
      data-domain={domain}
      src={`${apiUrl}/js/script.404.file-downloads.outbound-links.tagged-events.web-vitals.js`}
      strategy="afterInteractive"
    />
  );
}

/**
 * Track event custom Plausible côté client.
 * Usage : await trackEvent("Booking Submitted", { props: { intervention: "audit" } });
 */
export function trackEvent(
  name: string,
  options?: { props?: Record<string, string | number> },
): void {
  if (typeof window === "undefined") return;
  const plausible = (window as unknown as { plausible?: (n: string, o?: unknown) => void })
    .plausible;
  if (typeof plausible === "function") {
    plausible(name, options);
  }
}
