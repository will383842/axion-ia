import * as Sentry from "@sentry/nextjs";
import {
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "./lib/observability/sentry-pii-scrub";

const dsn = process.env["SENTRY_DSN"];

if (dsn) {
  Sentry.init({
    dsn,
    // V-04 P6 (Sprint Correctif suite 2026-05-22) — tracesSampleRate prod
    // 0.1 → 0.02 : overhead RUM/TTFB Caddy + RSC stream ramené de 10 % à 2 %.
    // -80 % requêtes tracées server-side, suffisant pour observabilité (cible
    // P1 audit V-04 : LCP server-side TTFB amélioré ~30-80 ms p75).
    // Dev reste 1.0 (full tracing local pour debug). Errors restent 100 %
    // (sampleRate par défaut, non changé — visibilité incidents préservée).
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.02 : 1.0,
    // Bruit non-actionnable : `controller[kState].transformAlgorithm is not a
    // function` (node:internal/webstreams/transformstream). Bug Next.js/Node 22
    // CONNU et non résolu (vercel/next.js#75995) : le contrôleur du TransformStream
    // que Next utilise pour streamer le RSC est corrompu quand une connexion se
    // FERME PRÉMATURÉMENT en plein stream (bot/crawler qui coupe, health-check,
    // buffer proxy). 100 % côté serveur Node, `handled = yes`, NON fatal : les
    // requêtes complètes ne sont pas affectées. Amplifié par notre runtime Alpine
    // (musl) + Node 22 — cf. AGENTS.md, runtime `node:22-alpine`. On NE swappe PAS
    // l'image de base (Dockerfile musl/Prisma trop couplé, ADR 0026) pour un event
    // cosmétique ; on le drop ici pour qu'il ne déclenche plus d'alerte high-priority.
    // Cf. _AUDIT/SENTRY-TRANSFORMSTREAM-2026-06-19/DECISION.md.
    ignoreErrors: [/transformAlgorithm is not a function/],
    environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
    // Méta-cert 2026-05-15 AGENT 17 P1 — release tracking explicite.
    // Source priorisée : SENTRY_RELEASE (CI/Coolify), npm_package_version (build),
    // sinon undefined (Sentry SDK skip release tag plutôt qu'agréger sous "unknown").
    release: process.env["SENTRY_RELEASE"] ?? process.env["npm_package_version"],
    // Audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32.
    sendDefaultPii: false,
    beforeSend: piiScrubBeforeSend,
    // Les transactions portent elles aussi `request.url` : sans ce hook, un
    // jeton partirait chez Sentry sans qu'aucune erreur ne se soit produite.
    beforeSendTransaction: piiScrubBeforeSendTransaction,
  });
}
