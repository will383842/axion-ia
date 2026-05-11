import * as Sentry from "@sentry/nextjs";
import { piiScrubBeforeSend } from "./lib/observability/sentry-pii-scrub";

const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
    environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
    // Audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32.
    sendDefaultPii: false,
    beforeSend: piiScrubBeforeSend,
  });
}
