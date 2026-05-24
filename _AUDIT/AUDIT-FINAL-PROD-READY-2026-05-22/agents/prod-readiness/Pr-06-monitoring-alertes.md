# Pr-06 — Monitoring & Alertes

**HEAD** : 81f6ea0e
**Score** : 21 / 25

## Évidence

### Sentry (frontend + backend + edge)

- `src/sentry.server.config.ts` (Node runtime) + `src/sentry.edge.config.ts` (Edge runtime) — séparés conformément Next 16.
- DSN gated par `SENTRY_DSN` env (ligne 4-6) — Sentry n'init que si DSN présent (fail-soft).
- `tracesSampleRate: production ? 0.02 : 1.0` (ligne 15) — overhead RUM/TTFB optimisé via V-04 P6 (2026-05-22).
- `sendDefaultPii: false` + `beforeSend: piiScrubBeforeSend` (ligne 22-23) — RGPD Art. 32.
- Release tracking explicite via `SENTRY_RELEASE` ou `npm_package_version` (ligne 20) — méta-cert 2026-05-15 AGENT 17.
- Wrapper `withSentryConfig` `next.config.ts:288-289` — sourcemaps prod uploadées (gate `SENTRY_AUTH_TOKEN`).
- Workflow `.github/workflows/sentry-query.yml` actif — auto observability query.
- Capture worker errors `_AUDIT/...` S+4 P1-C 2026-05-18 (memory) — helper `captureWorkerError` + sanitize-job-data PII.

### Telegram alerts

- `src/lib/telegram.ts` ✅ — fail-soft si `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` absent (ligne 49-53 console.warn skip).
- Usage observé :
  - `src/app/api/gdpr-erase/route.ts:96-99` → DPO RGPD Art. 17 trace
  - `scripts/backup-postgres.sh:51-60 + 84` → backup OK/KO + cascading-fail escalation
  - Worker incidents (mémoires Sprint S+4 / S+5)

### Web Vitals RUM

- `src/app/api/vitals/route.ts` ✅ endpoint INP/CLS/LCP collector RUM (Zod-validated d'après grep `z.object` ligne 13).
- `web-vitals@5.2.0` package installé (node_modules confirmed).
- LHCI `lighthouserc.json` 18 URLs (9 routes × FR+EN) avec assertions CWV strict (LCP ≤ 1800ms error, CLS ≤ 0.1 error, TBT ≤ 200ms error, FCP ≤ 1500ms error, SI ≤ 2500ms error).
- Workflow `gsc-crawl-stats-weekly.yml` actif (PSI weekly).

### Cost tracker

- `src/server/content-gen/lib/cost-tracker.ts` ✅ + tests `__tests__/cost-tracker.spec.ts`.
- DB `GenerationProvenance.cost` Decimal(10,6) (`prisma/schema.prisma:991`) — observabilité par génération.
- `cost_ledger` table évoquée commentaire `gdpr-erase/route.ts:23` (legal hold).

### Runbooks ops

- `scripts/ops/` 3 scripts : `coolify-cancel-stuck.sh`, `disk-cleanup.sh`, `hetzner-coolify-health.sh`.
- `_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-14-MONITORING-DR.md` ✅ (méta-cert monitoring + DR documenté).
- `_AUDIT/agent-6-monitoring-bp-securite.md` ✅.
- `_AUDIT/DEPLOY-RECOVERY-2026-05-17/` 11 livrables runbook (mémoire 2026-05-18).

### Healthz endpoint

- `src/app/api/healthz/route.ts:56-75` payload structuré `{status, timestamp, version, db, redis}`. Best-effort check + status 200 même en degraded (Caddy ne couperait que sur 5xx, ligne 66-67).

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (uptime monitoring externe)** : pas d'évidence UptimeRobot / BetterStack / Pingdom configuré côté plateforme. Healthz endpoint est prêt côté code, externe à câbler. Action humaine Will reco.
- **P1 (alert routing Sentry → Telegram/Email)** : Sentry capture, mais routing alertes critiques (P0 issue → Telegram canal Will) non confirmé en config Sentry (Alert Rules). À vérifier dashboard Sentry.
- **P2 (RUM endpoint scaling)** : `/api/vitals` peut être DOS-target. Rate limit non vérifié sur cette route — recommandation à confirmer.
- **P2 (dashboard live cost)** : Cost tracker DB-side OK, dashboard admin `/admin/.../analytics` ou `/content-gen/cost` à confirmer mode "live view monthly".

## Verdict (paragraphe)

Stack monitoring solide multi-couche : Sentry frontend+backend+edge avec PII scrubbing RGPD + release tracking + sourcemaps prod + sampling tuné 0.02 prod. Telegram canal alertes ops (RGPD/backup/worker incidents). Web Vitals RUM endpoint + 18 URLs LHCI gates CWV strict. Cost tracker DB-side avec Decimal(10,6) par génération IA. Healthz endpoint best-effort. 24 workflows GH Actions dont sentry-query/gsc-crawl-stats/cloudflare-purge cycliques. Runbooks ops documentés (`_AUDIT/DEPLOY-RECOVERY-2026-05-17/`, AGT-14-MONITORING-DR). Les gaps notables sont (1) absence visible d'uptime monitoring externe, (2) routing alertes Sentry → Telegram critique non auditable hors plateforme. Score 21/25 — production-ready côté code, polish externe à câbler.
