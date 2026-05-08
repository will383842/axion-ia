# 24 — MONITORING & OBSERVABILITY 2026

> Audit observabilité : RUM, uptime, errors, logs, alerting, dashboard.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. RUM (Real User Monitoring)

1.1 `/api/vitals` opérationnel (déjà ✅)
1.2 LCP / INP / CLS / FCP / TTFB capturés
1.3 Payload enrichi (route, locale, viewport, connection)
1.4 Sample rate configurable (100 % en V1, peut baisser à 10 % à scale)
1.5 sendBeacon utilisé (déjà ✅)
1.6 Endpoint < 50 ms
1.7 Persistance (Postgres TimescaleDB ou rollup)
1.8 Retention 90 jours minimum
1.9 Aggregation per route (p75 / p95)
1.10 Dashboard accessible (`/admin/pseo-stats` Sprint 20)

### 2. Uptime & health

2.1 Coolify health checks tous services
2.2 Caddy upstream health monitoring
2.3 Postgres health (`pg_isready`)
2.4 Redis health (`PING`)
2.5 Disk usage monitoring (`> 80 %` alert)
2.6 RAM usage monitoring
2.7 CPU usage monitoring
2.8 Smoke tests post-deploy automatiques
2.9 External uptime monitor (UptimeRobot free 50 monitors / 5 min)
2.10 Status page (optionnel V1)

### 3. Error tracking

3.1 Next.js error boundary opérationnel (déjà ✅ `error.tsx`)
3.2 Server errors loggés (Coolify logs ou Sentry free)
3.3 Client errors capturés (window.onerror handler)
3.4 Source maps prod désactivées (sécu) MAIS uploadées Sentry si utilisé
3.5 Error grouping (similar errors merged)
3.6 Error rate monitoring (alert si > 1 %)
3.7 4xx vs 5xx distinction
3.8 404 specifically tracked (signal pages perdues)
3.9 Build errors capturés (CI logs)
3.10 Stack trace anonymisée (no user data)

### 4. Logs aggregation

4.1 Logs centralisés (Coolify ou Loki self-hosted)
4.2 JSON structured logs
4.3 Log levels cohérents (error, warn, info, debug)
4.4 No `console.log` en prod (debug seulement)
4.5 Sensitive data jamais loggée (secrets, PII)
4.6 Log retention 30 jours minimum
4.7 Log rotation configurée
4.8 Search logs facilement
4.9 Audit log critique actions (Sprint 16)
4.10 Logs query mensuel (anomalies)

### 5. Alerting

5.1 Alerting Telegram (channel privé)
5.2 Alert : uptime < 99.9 %
5.3 Alert : error rate > 1 %
5.4 Alert : disk > 80 %
5.5 Alert : RAM > 85 %
5.6 Alert : CPU > 80 % sustained
5.7 Alert : LCP p75 > 2 500 ms (24h moyenne)
5.8 Alert : INP p75 > 200 ms
5.9 Alert : indexation rate drop > 10 %
5.10 Alert : nouvelle dépendance avec CVE critical

## Méthode

- Phase A : Audit existant
- Phase B : Diagnostic /50
- Phase C : Plan
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant ajout outil tiers (Sentry, etc.)
2. Avant intégration alerting (token Telegram)
3. Avant tout commit

## Cible

> RUM opérationnel, uptime > 99.9 %, errors trackées, alerting Telegram actif.

## Livrables

```
audit-24-monitoring-SYNTHESE.md
audit-24-monitoring-DIAGNOSTIC.md
audit-24-monitoring-PLAN.md
audit-24-monitoring-ALERTING-RULES.md
```
