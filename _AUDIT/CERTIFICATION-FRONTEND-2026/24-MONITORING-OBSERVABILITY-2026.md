# 24 — MONITORING & OBSERVABILITY 2026

> Audit observabilité : RUM, uptime, errors, logs, alerting, dashboard, AEO drift, competitor monitoring.
> Référence thresholds : `README.md` § Thresholds canoniques.

## Audit en 7 chapitres × 10 critères = 70 points

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

### 6. AEO/GEO drift detection (LLM ranking)

6.1 20 prompts canoniques définis (« cabinet IA opérationnel France », « audit IA flash entreprise », « consultant IA Paris », etc.)
6.2 Test mensuel automatisé sur ChatGPT (via OpenAI API ou OpenRouter) : Axion-IA cité ?
6.3 Test mensuel sur Claude (Anthropic API) : Axion-IA cité ?
6.4 Test mensuel sur Perplexity (API ou scrape) : Axion-IA cité ?
6.5 Test mensuel sur Google AI Overviews (manuel ou tool) : Axion-IA présent ?
6.6 Tracker cite-rate par prompt (% présence sur 20 queries)
6.7 Alert si cite-rate drop > 30 % vs baseline
6.8 Sample positions (1er cité, 2e, 3e+) tracké
6.9 Logs dans dashboard `/admin/pseo-stats` Sprint 20
6.10 Reporting trimestriel à Will (top 5 prompts gagnants/perdants)

### 7. Competitor & brand monitoring

7.1 Top 10 concurrents listés (Hexa, Theodo, Octo, Datatist, Ekimetrics, etc.)
7.2 Sitemap diff hebdo (concurrents publient quoi de nouveau ?)
7.3 Brand mentions monitoring (Google Alerts gratuit + Mention.com free tier)
7.4 Search Console : impressions sur mots-clés concurrents ?
7.5 Comparaison Lighthouse trimestrielle (Top 5 concurrents)
7.6 Backlinks tracking (Search Console links report) — qui nous lie ?
7.7 Press mentions tracking (page presse refresh trimestriel)
7.8 Social mentions LinkedIn/Twitter (manuel ou tool free)
7.9 Customer feedback loop (NPS, formulaire feedback, témoignages collectés)
7.10 Reporting trimestriel : positionnement vs concurrents

## Méthode

- Phase A : Audit existant
- Phase B : Diagnostic /70
- Phase C : Plan (incl. choix outils AEO/competitor monitoring gratuits)
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant ajout outil tiers (Sentry, etc.)
2. Avant intégration alerting (token Telegram)
3. Avant ajout API key tier (OpenAI/Anthropic pour AEO drift) — coût $$
4. Avant scraping concurrents (légal + rate limit)
5. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ AEO drift testé manuellement (oublié au bout de 2 mois)
- ❌ Competitor monitoring sans sample size suffisant
- ❌ Brand mentions sans triage (faux positifs noient les vrais signaux)
- ❌ Feedback loop sans action (collecte vain si non analysé)
- ❌ Alerting trop bruyant (alertes ignorées au bout d'un mois)
- ❌ Dashboard data sans owner (qui regarde ?)

## Cible

> RUM opérationnel, uptime > 99.9 %, errors trackées, alerting Telegram actif. AEO drift mensuel sur 20 prompts × 3 LLMs avec cite-rate tracké. Competitor monitoring trimestriel Top 10. Customer feedback loop actif.

## Livrables

```
audit-24-monitoring-SYNTHESE.md
audit-24-monitoring-DIAGNOSTIC.md
audit-24-monitoring-PLAN.md
audit-24-monitoring-ALERTING-RULES.md
audit-24-monitoring-AEO-PROMPTS-CANONIQUES.md  (20 prompts test)
audit-24-monitoring-COMPETITORS.md  (top 10 + sources)
```
