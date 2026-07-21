import * as Sentry from "@sentry/nextjs";
import {
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "./lib/observability/sentry-pii-scrub";

const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
    environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
    // Méta-cert 2026-05-15 AGENT 17 P1 — release tracking explicite cohérent
    // avec sentry.server.config.ts. Cf. doc dans server config.
    release: process.env["SENTRY_RELEASE"] ?? process.env["npm_package_version"],
    // Audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32.
    sendDefaultPii: false,
    beforeSend: piiScrubBeforeSend,
    // Les transactions portent elles aussi `request.url` : sans ce hook, un
    // jeton partirait chez Sentry sans qu'aucune erreur ne se soit produite.
    beforeSendTransaction: piiScrubBeforeSendTransaction,
  });
}
