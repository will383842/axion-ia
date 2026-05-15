import * as Sentry from "@sentry/nextjs";
import { piiScrubBeforeSend } from "./lib/observability/sentry-pii-scrub";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
const isProd = process.env["NODE_ENV"] === "production";

if (dsn) {
  Sentry.init({
    dsn,
    // P-WV-01 (audit 2026-05-15 AGENT 1+6+8) — slimming Sentry client.
    // Avant : ~234 KB brotli sur 2 chunks (1302-*.js 137 KB + 3c1d9ecb-*.js
    // 63 KB) = 53 % du shell JS. Default integrations charge ~10 modules
    // dont BrowserTracing (~60 KB), BrowserApiErrors (~30 KB),
    // Breadcrumbs (~25 KB) — coûteux pour la valeur en prod.
    //
    // Stratégie : on garde Sentry error capture (le besoin essentiel V1),
    // on coupe les intégrations heavy. Gain attendu LCP -1200-1800 ms +
    // TBT -1200-1400 ms sur les pages tier-1 selon AGENT 1 §1.10 P0-1.
    //
    // À ré-évaluer Sprint perf V2 si on veut RUM via Sentry plutôt que
    // notre WebVitalSample maison.
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
    // P-403 — Replay désactivé totalement en prod (V1).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32.
    sendDefaultPii: false,
    beforeSend: piiScrubBeforeSend,
  });

  // Tag prod-only — utile pour filtrer en cas de pollution dev.
  if (isProd) {
    Sentry.setTag("runtime.client", "browser");
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
