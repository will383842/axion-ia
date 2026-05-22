# Test 09 — Sentry alert test
## Date : 2026-05-22 — mode AUDIT-ONLY

## Sentry configs présents
./src/sentry.edge.config.ts
./src/sentry.server.config.ts

## SENTRY_DSN env
60:NEXT_PUBLIC_SENTRY_DSN=
61:SENTRY_DSN=
62:SENTRY_AUTH_TOKEN=

## tracesSampleRate
src/sentry.server.config.ts:9:    // V-04 P6 (Sprint Correctif suite 2026-05-22) — tracesSampleRate prod
src/sentry.server.config.ts:15:    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.02 : 1.0,
src/sentry.edge.config.ts:9:    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,

## captureWorkerError helper
src/lib/observability/sentry-pii-scrub.ts
src/server/queue/lib/sentry-worker.ts
src/server/queue/lib/__tests__/sentry-worker.spec.ts

## Workers avec capture
24
## Workflow Sentry query
.github/workflows/sentry-query.yml
