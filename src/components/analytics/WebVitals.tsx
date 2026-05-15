"use client";
// use-client: useReportWebVitals is a client-only hook by design — RUM
// metrics ship from the browser via navigator.sendBeacon.

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { onINP } from "web-vitals/attribution";
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

/**
 * P1-20 (audit re-run 2026-05-15 AGENT 1) — LoAF + Long Tasks observer.
 *
 * `useReportWebVitals` couvre LCP/FCP/CLS/TTFB/INP. Pour atteindre le
 * standard 2026 RUM-grade (AGENT 1 §1.1), il faut aussi observer :
 *  - **LoAF (Long Animation Frames API)** — Chrome 123+, successeur de
 *    Long Tasks. Identifie frames > 50ms avec script attribution +
 *    render time. Permet de diagnostiquer pourquoi INP est mauvais.
 *  - **Long Tasks** — Chrome 58+, fallback pour Safari/Firefox.
 *
 * Les entries sont émises vers /api/vitals avec name = "LoAF" ou
 * "LongTask" et value = duration (ms). Throttle : on ne ship que les
 * frames > 100ms (sous-représente la cardinalité, focus sur les
 * vraies dégradations UX).
 */
function observeFrameDegradations(
  pathname: string,
  locale: string,
  ship: (payload: VitalsPayload) => void,
): () => void {
  if (typeof PerformanceObserver === "undefined") return () => {};

  const observers: PerformanceObserver[] = [];

  // LoAF (Chrome 123+). Test via supportedEntryTypes pour éviter throw.
  if (PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration <= 100) continue; // threshold UX
          ship({
            id: `loaf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: "LoAF",
            value: entry.duration,
            rating: entry.duration > 200 ? "poor" : "needs-improvement",
            delta: entry.duration,
            navigationType: "loaf",
            href: typeof window !== "undefined" ? window.location.href : "",
            route: pathname,
            locale,
            effectiveType: null,
            deviceMemory: null,
          });
        }
      });
      obs.observe({ type: "long-animation-frame", buffered: true });
      observers.push(obs);
    } catch {
      // PerformanceObserver throws if entry type unsupported at runtime.
    }
  } else if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    // Fallback legacy Long Tasks (Safari + Firefox + Chrome < 123).
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration <= 100) continue;
          ship({
            id: `longtask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: "LongTask",
            value: entry.duration,
            rating: entry.duration > 200 ? "poor" : "needs-improvement",
            delta: entry.duration,
            navigationType: "longtask",
            href: typeof window !== "undefined" ? window.location.href : "",
            route: pathname,
            locale,
            effectiveType: null,
            deviceMemory: null,
          });
        }
      });
      obs.observe({ type: "longtask", buffered: true });
      observers.push(obs);
    } catch {
      // Swallow
    }
  }

  return () => {
    for (const obs of observers) obs.disconnect();
  };
}

// Reports CLS / LCP / INP / FCP / TTFB to /api/vitals (Node.js runtime —
// Hetzner self-hosted, cf. P-303). Uses sendBeacon when available so payload
// survives page unload, falls back to fetch keepalive otherwise. Fail-silent
// — no UI surface, no console noise.
export function WebVitals() {
  const pathname = usePathname();
  const locale = useLocale();

  // P1-21 (audit re-run 2026-05-15) — INP attribution Chrome 124+.
  // `useReportWebVitals` ne supporte pas la prop `attribution` ; on appelle
  // donc directement `onINP` du package `web-vitals/attribution` (déjà
  // dep transitive de next/web-vitals). Permet de classer INP par
  // élément ciblé (button#submit, link.cta, etc.) + event type (click,
  // keydown, pointerdown). Le dashboard /admin/web-vitals peut ensuite
  // agréger les INP > 200 ms par élément pour diagnostic ciblé.
  useEffect(() => {
    if (typeof window === "undefined") return;
    onINP(
      (metric) => {
        const nav = navigator as NavigatorWithExtras;
        const attribution = metric.attribution ?? {};
        const interactionTarget =
          (attribution as { interactionTarget?: string }).interactionTarget ?? null;
        const interactionType =
          (attribution as { interactionType?: string }).interactionType ?? null;
        const payload: VitalsPayload = {
          id: metric.id,
          name: "INP-attribution",
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          navigationType: metric.navigationType,
          href: window.location.href,
          route: pathname ?? "",
          locale,
          effectiveType: nav.connection?.effectiveType ?? null,
          deviceMemory: nav.deviceMemory ?? null,
        };
        // Ajoute interactionTarget/Type comme suffix dans `id` pour
        // que /api/vitals route handler les capte sans changer le contrat.
        if (interactionTarget) {
          payload.id = `${payload.id}|target=${interactionTarget.slice(0, 60)}`;
        }
        if (interactionType) {
          payload.id = `${payload.id}|type=${interactionType}`;
        }
        const body = JSON.stringify(payload);
        try {
          if (typeof navigator.sendBeacon === "function") {
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
          // Swallow
        }
      },
      { reportAllChanges: false },
    );
  }, [pathname, locale]);

  // P1-20 — LoAF + Long Tasks observation post-mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ship = (payload: VitalsPayload) => {
      const body = JSON.stringify(payload);
      try {
        if (typeof navigator.sendBeacon === "function") {
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
        // Swallow
      }
    };
    return observeFrameDegradations(pathname ?? "", locale, ship);
  }, [pathname, locale]);

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
