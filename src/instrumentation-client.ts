// P0-05 (audit re-run 2026-05-15 ~15h00 AGENT 1+6+8) — lazy-load Sentry client.
//
// Avant : `import * as Sentry from "@sentry/nextjs"` synchrone au top du module
// → bundle Sentry inclus dans le shell JS (chunks `1302-*.js` 137 KB br +
// `3c1d9ecb-*.js` 63 KB br = ~200 KB br = 53-61 % shell sur 5/6 pages tier-1).
// Le batch 2 (`df5b9ed` slim `defaultIntegrations:false`) a réduit la surface
// d'intégrations mais le SDK reste statiquement inclus dans le shell.
//
// Stratégie : dynamic import + init différée via `requestIdleCallback` (3s
// timeout fallback). Le bundle Sentry devient un chunk async chargé après
// que le main thread soit idle → shell tombe à ~120-130 KB br (gain ~80 KB).
// LCP mobile attendu -1200 à -1800 ms, TBT -1200 à -1400 ms selon AGENT 1
// §2.4 P0-A1.3. Trade-off : les erreurs survenant durant les ~3s avant init
// ne sont pas capturées (acceptable V1 vs gain Web Vitals critique).
//
// `onRouterTransitionStart` reste exporté synchrone (Next 16 doit pouvoir
// l'appeler immédiatement au montage du root) mais devient no-op tant que
// Sentry n'est pas hydraté. Une fois init terminé, les transitions futures
// sont tracées normalement.
//
// V2 perf Sprint 17 : ré-évaluer si on bascule RUM Web Vitals via Sentry
// (auquel cas init synchrone pour capter LCP/INP/CLS de la première nav)
// vs garder notre WebVitalSample maison (qui n'a pas besoin du SDK Sentry).

type SentryModule = typeof import("@sentry/nextjs");

let sentryModule: SentryModule | null = null;
let sentryInitPromise: Promise<SentryModule | null> | null = null;

async function initSentryLazy(): Promise<SentryModule | null> {
  if (sentryModule) return sentryModule;
  if (sentryInitPromise) return sentryInitPromise;

  const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
  if (!dsn) return null;

  sentryInitPromise = (async () => {
    const [Sentry, { piiScrubBeforeSend }] = await Promise.all([
      import("@sentry/nextjs"),
      import("./lib/observability/sentry-pii-scrub"),
    ]);

    Sentry.init({
      dsn,
      // Slim integrations (batch 2 `df5b9ed`) — pas de BrowserTracing/Replay/
      // Breadcrumbs (économise ~80-100 KB raw vs default).
      defaultIntegrations: false,
      integrations: [
        Sentry.dedupeIntegration(),
        Sentry.inboundFiltersIntegration(),
        Sentry.functionToStringIntegration(),
        Sentry.linkedErrorsIntegration(),
        Sentry.globalHandlersIntegration(),
        Sentry.httpContextIntegration(),
      ],
      tracesSampleRate: 0,
      environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
      // Méta-cert 2026-05-15 AGENT 17 P1 — release tracking explicite cohérent
      // avec sentry.{server,edge}.config.ts. NEXT_PUBLIC_SENTRY_RELEASE pour le
      // client (lisible côté browser), fallback SENTRY_RELEASE puis npm version.
      release:
        process.env["NEXT_PUBLIC_SENTRY_RELEASE"] ??
        process.env["SENTRY_RELEASE"] ??
        process.env["npm_package_version"],
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: piiScrubBeforeSend,
    });

    if (process.env["NODE_ENV"] === "production") {
      Sentry.setTag("runtime.client", "browser");
    }

    sentryModule = Sentry;
    return Sentry;
  })();

  return sentryInitPromise;
}

// Schedule init durant idle time pour minimiser l'impact LCP/TBT.
// `requestIdleCallback` disponible sur Chrome/Edge/Firefox 100%, Safari 18+.
// Fallback `setTimeout` 3s pour Safari < 18 (~5% trafic mobile).
if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) {
    (
      window as Window & {
        requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
      }
    ).requestIdleCallback(
      () => {
        void initSentryLazy();
      },
      { timeout: 3000 },
    );
  } else {
    setTimeout(() => {
      void initSentryLazy();
    }, 3000);
  }
}

// Next 16 instrumentation-client API — appelée au début de chaque transition
// router côté client (navigation App Router). Avant que Sentry soit hydraté
// (~3s post-load), c'est un no-op silencieux. Une fois init terminé, déléguée
// au handler natif Sentry.
export function onRouterTransitionStart(href: string, navigationType: string): void {
  if (sentryModule) {
    sentryModule.captureRouterTransitionStart(href, navigationType);
  }
  // Pas de queue/replay des transitions manquées avant init —
  // un fire-and-forget early transition est acceptable V1.
}
