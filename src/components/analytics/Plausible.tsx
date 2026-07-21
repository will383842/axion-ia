// Plausible analytics integration (Sprint 23 / M11).
//
// Self-hosted privacy-first analytics, GDPR-compliant sans cookies (CNIL OK
// sans bandeau consentement). Script servi depuis plausible.axion-ia.com.
//
// Usage : <Plausible /> dans le root layout. No-op si NEXT_PUBLIC_PLAUSIBLE_DOMAIN
// pas defini (preserve dev sans appel reseau parasite).

import Script from "next/script";
import { env } from "@/env";

// Re-export pour préserver l'API publique historique. La SSOT est dans
// `src/lib/analytics/plausible-tracker.ts` (helper pur). Voir A3.2.
export { trackEvent } from "@/lib/analytics/plausible-tracker";

export function Plausible() {
  const domain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const apiUrl = env.NEXT_PUBLIC_PLAUSIBLE_API_URL ?? "https://plausible.axion-ia.com";

  if (!domain) return null;

  // strategy="afterInteractive" → script chargé après hydration (n'impacte pas LCP).
  // Script étendu (ordre alphabétique requis par Plausible) :
  //   file-downloads — clics sur .pdf/.docx/.csv (mentions, sous-processeurs)
  //   outbound-links — clics vers domaines externes
  //   tagged-events  — Custom events via window.plausible(name, opts)
  //                    Requis pour trackEvent("Booking Submitted") etc.
  //
  // ⚠️ AUDIT 2026-07-21 — NE PAS réintroduire `404.` ni `.web-vitals` :
  // ces deux extensions N'EXISTENT PAS dans plausible/community-edition:v3.0.1.
  // L'URL précédente (`script.404.file-downloads.outbound-links.tagged-events.web-vitals.js`)
  // renvoyait un **404**, donc aucun event n'a jamais été émis depuis la mise en
  // ligne (11 events en base ClickHouse, tous datés du 2026-05-13, 0 sur 30 j).
  // Vérifié en live : seules `script.js`, `script.tagged-events.js`,
  // `script.file-downloads.outbound-links.tagged-events.js` (et variantes) → 200.
  // La collecte Web Vitals reste assurée par le RUM maison `/api/vitals`
  // (table `web_vital_samples`, ~65 000 échantillons) — aucune perte.
  return (
    <Script
      defer
      data-domain={domain}
      src={`${apiUrl}/js/script.file-downloads.outbound-links.tagged-events.js`}
      strategy="afterInteractive"
    />
  );
}
