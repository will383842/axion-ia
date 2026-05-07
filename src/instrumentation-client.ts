import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
    environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
    replaysSessionSampleRate: 0,
    // Replays add ~30 KB to the client bundle and capture overhead on errors.
    // 1% on errors is enough to debug regressions without weighing nav perf.
    replaysOnErrorSampleRate: 0.01,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
