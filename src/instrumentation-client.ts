import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];
const isProd = process.env["NODE_ENV"] === "production";

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
    // P-403 — Replay désactivé totalement en prod (V1).
    // Le SDK Sentry @sentry/nextjs v10 ne charge `replayIntegration()` que
    // si on l'appelle explicitement, donc Replay n'est pas dans le bundle.
    // Les sample rates ci-dessous sont des sécurités défensives au cas où
    // une dep tierce activerait Replay implicitement.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
