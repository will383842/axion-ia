"use client";
// use-client: useEffect mount-once tracker — lit document.referrer côté client
// pour bucketiser la source LLM/SERP (Plausible custom property). Pure
// client-side : Server Component ne peut pas accéder document.referrer.

/**
 * RefererTracker — émet 1 événement Plausible "Page Referer Source" au mount.
 *
 * Audit indexation 2026-05-15 P1-19. Bucket le referrer document.referrer
 * dans 14 sources canoniques (google, bing, qwant, ddg, perplexity, chatgpt,
 * claude, gemini…) pour mesurer l'AEO/GEO ROI dans Plausible dashboard.
 *
 * Mount idempotent : useRef garde-fou contre double-track en StrictMode dev.
 * Bundle impact : < 0.5 KB gz (helper detectSearchEngine pur + 1 useEffect).
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackRefererSource } from "@/lib/tracking";
import { urlPorteUnSecret } from "@/lib/analytics/routes-privees";

export function RefererTracker() {
  const tracked = useRef(false);
  const pathname = usePathname();
  const secret = urlPorteUnSecret(pathname);
  useEffect(() => {
    // Un événement Plausible émis depuis le portail y attache la page courante,
    // donc le jeton. Aucune mesure sur ces pages.
    if (secret) return;
    if (tracked.current) return;
    tracked.current = true;
    // document.referrer est défini au premier paint client. Plausible script
    // est chargé en `afterInteractive` donc window.plausible peut ne pas être
    // prêt — trackEvent fait un guard typeof === "function".
    trackRefererSource(typeof document !== "undefined" ? document.referrer : null);
  }, [secret]);
  return null;
}
