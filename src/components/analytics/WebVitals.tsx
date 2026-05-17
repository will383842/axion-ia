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
  // P2-30 (audit re-run 2026-05-15 AGENT 8) — enrichissement client.
  // Permet au dashboard /admin/web-vitals d'agréger p75 par device
  // (mobile vs desktop vs tablet), par session anonyme (regrouper les samples
  // d'un même utilisateur sans cookie tracker), et par pageType (template
  // de page : "blog", "ville", "audit", "home" etc.). Tous optionnels —
  // backward-compatible avec les anciens clients en cache.
  deviceType: string | null;
  userAgent: string | null;
  sessionId: string | null;
  pageType: string | null;
}

/**
 * P2-30 — Classification simple device type via matchMedia + UA hints.
 * Cohérent avec les conventions Google CrUX `formFactor` (PHONE / TABLET / DESKTOP).
 */
function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  // matchMedia hover/pointer = signal le plus fiable mobile-first.
  // - coarse pointer + no-hover = touch device (mobile/tablet)
  // - fine pointer = mouse (desktop) OU stylet tablet (cas rare ignoré)
  const coarsePointer = window.matchMedia("(pointer:coarse)").matches;
  const noHover = window.matchMedia("(hover:none)").matches;
  if (coarsePointer && noHover) {
    // Tablet vs mobile : largeur écran. 768px breakpoint Tailwind `md`.
    return window.innerWidth >= 768 ? "tablet" : "mobile";
  }
  return "desktop";
}

/**
 * P2-30 — Session ID éphémère (sessionStorage UUID v4). Permet d'agréger
 * les Web Vitals d'un même utilisateur dans le dashboard sans cookie tracker
 * (RGPD-friendly). Reset à chaque nouvelle tab/window.
 */
function getOrCreateSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const KEY = "_axion_wv_sid";
    let id = window.sessionStorage.getItem(KEY);
    if (!id) {
      // crypto.randomUUID disponible Chrome 92+/Safari 15.4+/FF 95+ (~98% trafic).
      const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : fallback;
      window.sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // sessionStorage peut throw (mode privé Safari historique, quotas).
    return null;
  }
}

/**
 * P2-30 — Classification pageType depuis le pathname Next 16. Cohérent
 * avec les sections de doctrine et utilisé pour agrégation dashboard p75
 * par type de template (mesure les régressions perf par template, pas par
 * page individuelle).
 */
function inferPageType(pathname: string): string {
  if (!pathname || pathname === "/" || /^\/(fr|en)\/?$/.test(pathname)) return "home";
  const segments = pathname
    .replace(/^\/(fr|en)\//, "")
    .split("/")
    .filter(Boolean);
  if (segments.length === 0) return "home";
  const head = segments[0] ?? "other";
  // Templates pSEO villes — distincts pour mesurer la régression sur 12 942 routes.
  if (head === "implantations") return "pseo-ville";
  if (["audit", "interventions", "implementation"].includes(head) && segments[1] === "par-ville") {
    return `pseo-${head}`;
  }
  // Templates content factory.
  if (head === "blog") return "blog";
  if (head === "actualites") return "news";
  if (head === "cas-concrets") return "case-study";
  if (head === "faq") return "faq";
  if (head === "aide" || head === "centre-aide") return "help";
  if (head === "connaissances") return "knowledge";
  if (head === "equipe") return "team";
  if (head === "tarifs") return "pricing";
  if (head === "reserver") return "booking";
  return head;
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
  // P2-30 — enrichissement client réutilisé entre observers.
  const deviceType = detectDeviceType();
  const ua =
    typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
      ? navigator.userAgent.slice(0, 200)
      : null;
  const sessionId = getOrCreateSessionId();
  const pageType = inferPageType(pathname);

  // LoAF (Chrome 123+). Test via supportedEntryTypes pour éviter throw.
  if (PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration <= 250) continue;
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
            deviceType,
            userAgent: ua,
            sessionId,
            pageType,
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
          if (entry.duration <= 250) continue;
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
            deviceType,
            userAgent: ua,
            sessionId,
            pageType,
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
//
// Sprint Web Vitals fix 2026-05-17 — skip routes admin (`/admin/*` quelle
// que soit la locale) car la console admin n'a pas besoin de RUM publique
// (private app, déjà loguée Sentry), génère du bruit /api/vitals 429
// (re-renders fréquents tables/forms → LoAF observer spam) et pollue la
// console DevTools utilisateur admin (vu incident Will 2026-05-17).
function isAdminRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/(fr|en)?\/?[^/]*admin/i.test(pathname);
}

export function WebVitals() {
  const pathname = usePathname();
  const locale = useLocale();
  const adminRoute = isAdminRoute(pathname);

  // P1-21 (audit re-run 2026-05-15) — INP attribution Chrome 124+.
  // `useReportWebVitals` ne supporte pas la prop `attribution` ; on appelle
  // donc directement `onINP` du package `web-vitals/attribution` (déjà
  // dep transitive de next/web-vitals). Permet de classer INP par
  // élément ciblé (button#submit, link.cta, etc.) + event type (click,
  // keydown, pointerdown). Le dashboard /admin/web-vitals peut ensuite
  // agréger les INP > 200 ms par élément pour diagnostic ciblé.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (adminRoute) return; // skip admin
    onINP(
      (metric) => {
        const nav = navigator as NavigatorWithExtras;
        const attribution = metric.attribution ?? {};
        const interactionTarget =
          (attribution as { interactionTarget?: string }).interactionTarget ?? null;
        const interactionType =
          (attribution as { interactionType?: string }).interactionType ?? null;
        const ua =
          typeof navigator.userAgent === "string" ? navigator.userAgent.slice(0, 200) : null;
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
          // P2-30 — enrichissement client.
          deviceType: detectDeviceType(),
          userAgent: ua,
          sessionId: getOrCreateSessionId(),
          pageType: inferPageType(pathname ?? ""),
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
  }, [pathname, locale, adminRoute]);

  // P1-20 — LoAF + Long Tasks observation post-mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (adminRoute) return; // skip admin
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
  }, [pathname, locale, adminRoute]);

  useReportWebVitals((metric) => {
    if (adminRoute) return; // skip admin
    const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithExtras) : null;
    const ua =
      typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
        ? navigator.userAgent.slice(0, 200)
        : null;
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
      // P2-30 — enrichissement client.
      deviceType: typeof window !== "undefined" ? detectDeviceType() : null,
      userAgent: ua,
      sessionId: getOrCreateSessionId(),
      pageType: inferPageType(pathname ?? ""),
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
