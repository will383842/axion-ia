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

// Hand server-side render errors to Sentry. Sprint 21 swaps this for the
// official `onRequestError` re-export once we confirm its presence in the
// installed @sentry/nextjs build.
export function onRequestError(err: unknown): void {
  Sentry.captureException(err);
}
