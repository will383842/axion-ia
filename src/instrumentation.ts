// Next.js 16 instrumentation hook — runs once per runtime (node + edge).
// Sentry server/edge init lives here per @sentry/nextjs v10 conventions.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("./sentry.edge.config");
  }
}

// Hand server-side render errors to Sentry. Le scrub PII est appliqué par
// `beforeSend` posé dans `sentry.server.config.ts` et `sentry.edge.config.ts`
// (audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32).
export function onRequestError(err: unknown): void {
  Sentry.captureException(err);
}
