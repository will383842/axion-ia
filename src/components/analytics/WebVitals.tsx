"use client";
// use-client: useReportWebVitals is a client-only hook by design — RUM
// metrics ship from the browser via navigator.sendBeacon.

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";

const VITALS_ENDPOINT = "/api/vitals";

interface VitalsPayload {
  id: string;
  name: string;
  value: number;
  rating: string;
  delta: number;
  navigationType: string;
  href: string;
  // P-304 / P-500 — payload enrichi pour analytics + dashboard Sprint 20
  // /admin/pseo-stats. Ces champs permettent d'agréger LCP/INP/CLS par route
  // (template Next, pas href absolu), par locale, par condition réseau et
  // par device pour piloter les patches perf data-driven.
  route: string;
  locale: string;
  effectiveType: string | null;
  deviceMemory: number | null;
}

// `Network Information API` shape — non typé par lib.dom.d.ts en 2026
// (Working Draft). On fait une narrowing manuelle.
interface NetworkInformation {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}
interface NavigatorWithExtras extends Navigator {
  connection?: NetworkInformation;
  deviceMemory?: number;
}

/**
 * Plausible Web Vitals plugin emission (audit 2026-05-15 P0 monitoring §8.8).
 *
 * Le script Plausible étend l'API `window.plausible(name, opts)` quand on
 * inclut `.web-vitals.js` (cf. `Plausible.tsx`). On émet un event canonique
 * "Web Vital" avec props ajustés pour pouvoir agréger en custom dashboard
 * Plausible (filter par metric, rating, page).
 *
 * Fail-soft : si `window.plausible` absent (script bloqué adblock, env dev
 * sans NEXT_PUBLIC_PLAUSIBLE_DOMAIN), on swallow silencieusement.
 */
interface PlausibleVitalProps {
  readonly metric: string;
  readonly value: number;
  readonly rating: string;
  readonly page: string;
}

function emitPlausibleVital(props: PlausibleVitalProps): void {
  if (typeof window === "undefined") return;
  const fn = (window as unknown as { plausible?: (n: string, o?: unknown) => void }).plausible;
  if (typeof fn !== "function") return;
  try {
    fn("Web Vital", { props });
  } catch {
    // swallow — analytics ne doit jamais affecter l'UX
  }
}

// Reports CLS / LCP / INP / FCP / TTFB to /api/vitals (Node.js runtime —
// Hetzner self-hosted, cf. P-303). Uses sendBeacon when available so payload
// survives page unload, falls back to fetch keepalive otherwise. Fail-silent
// — no UI surface, no console noise.
export function WebVitals() {
  const pathname = usePathname();
  const locale = useLocale();
  useReportWebVitals((metric) => {
    const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithExtras) : null;
    const payload: VitalsPayload = {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
      href: typeof window !== "undefined" ? window.location.href : "",
      route: pathname ?? "",
      locale,
      effectiveType: nav?.connection?.effectiveType ?? null,
      deviceMemory: nav?.deviceMemory ?? null,
    };
    const body = JSON.stringify(payload);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(VITALS_ENDPOINT, blob);
      } else {
        void fetch(VITALS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      // Swallow — beacon failures must never affect UX.
    }

    // Plausible Web Vitals plugin — émet "Web Vital" en parallèle du POST
    // /api/vitals. Pas bloquant : si window.plausible absent (adblock, env
    // dev sans plugin), swallow. Round value pour limiter cardinalité.
    emitPlausibleVital({
      metric: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
      page: pathname ?? "",
    });
  });
  return null;
}
