"use client";
// use-client: useReportWebVitals is a client-only hook by design — RUM
// metrics ship from the browser via navigator.sendBeacon.

import { useReportWebVitals } from "next/web-vitals";

const VITALS_ENDPOINT = "/api/vitals";

interface VitalsPayload {
  id: string;
  name: string;
  value: number;
  rating: string;
  delta: number;
  navigationType: string;
  href: string;
}

// Reports CLS / LCP / INP / FCP / TTFB to /api/vitals (Edge route).
// Uses sendBeacon when available so payload survives page unload, falls back
// to fetch keepalive otherwise. Fail-silent — no UI surface, no console noise.
export function WebVitals() {
  useReportWebVitals((metric) => {
    const payload: VitalsPayload = {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
      href: typeof window !== "undefined" ? window.location.href : "",
    };
    const body = JSON.stringify(payload);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(VITALS_ENDPOINT, blob);
        return;
      }
      void fetch(VITALS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // Swallow — beacon failures must never affect UX.
    }
  });
  return null;
}
