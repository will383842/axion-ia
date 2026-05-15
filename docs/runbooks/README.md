# Runbooks ops Axion-IA

> Index des procédures ops post-V1+V2 content-gen. Créé 2026-05-15 suite à
> l'audit A5 (`_AUDIT/CONTENT-GEN-AUDIT-A5-RUNBOOKS-2026-05-15.md`).
>
> Chaque runbook respecte le template **9 critères** :
> Titre+version+date / Trigger / Sévérité / Prérequis / Étapes / Vérif / Rollback / Escalation / Lien ADR.

## Convention de nommage

- Chaque runbook a un code court `RX` cité dans les alertes Telegram (`src/server/content-gen/shared/content-gen-alerts.ts`).
- Format fichier : `R{NN}-{slug}.md` (ex : `R01-kill-switch.md`).
- Sévérité : 🔴 P0 (critique, ack 15 min) · 🟡 P1 (important, ack 30 min) · 🟢 P2 (routine).

## Inventaire 30 runbooks

### 🔴 P0 — Incidents critiques (10)

| Code                                 | Titre                                          | Trigger principal                                   |
| ------------------------------------ | ---------------------------------------------- | --------------------------------------------------- |
| [R01](./R01-kill-switch.md)          | Kill switch d'urgence content-gen              | Hack provider IA / coût explosif / doctrine massive |
| [R02](./R02-cost-cap-provider.md)    | Cost cap provider IA atteint                   | Telegram `[🔴 COÛT 100 %]`                          |
| [R03](./R03-postgres-down.md)        | Postgres down (DB indisponible)                | Healthz `db: error` / Sentry 5xx spike              |
| [R04](./R04-redis-down.md)           | Redis down (queue indispo)                     | Workers crash loop / BullMQ inaccessible            |
| [R05](./R05-workers-down.md)         | Workers Coolify down                           | Aucun job ne se traite > 5 min                      |
| [R06](./R06-migration-sql-failed.md) | Migration SQL ratée prod                       | `prisma migrate deploy` exit ≠ 0                    |
| [R07](./R07-kb-not-ready.md)         | KB not ready (< 300 chunks / canonical < 60 %) | Telegram `[🔴 KB NOT READY]`                        |
| [R08](./R08-xss-published.md)        | XSS détecté dans Article publié                | Sentry Content-Security-Policy report / user report |
| [R09](./R09-doctrine-violation.md)   | Doctrine violation post-publi                  | Audit manuel / scan SIREN / phrase interdite        |
| [R10](./R10-coolify-deploy-fail.md)  | Coolify deploy fail                            | GitHub Actions rouge / Coolify webhook 5xx          |

### 🟡 P1 — Incidents importants (10)

| Code                                     | Titre                                                | Trigger principal                                |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| [R11](./R11-provider-circuit-breaker.md) | Provider IA circuit breaker open                     | Telegram `[⚠️ PROVIDER DOWN]` 5 fails/30s        |
| [R12](./R12-quality-loop-runaway.md)     | Quality loop runaway (`maxAttempts` dépassé)         | Sentry / boucle infinie content-quality-improver |
| [R13](./R13-rss-source-down.md)          | RSS source down 24h+                                 | Aucun item ingest / `rss-fetch-worker` logs      |
| [R14](./R14-indexnow-rejected.md)        | IndexNow ping rejected (key invalide)                | api.indexnow.org 403                             |
| [R15](./R15-google-indexing-quota.md)    | Google Indexing API quota dépassé (V1.5)             | 200/jour limite gratuite                         |
| [R16](./R16-telegram-bot-revoked.md)     | Telegram bot token révoqué                           | Aucune alerte ne part / 401 API Telegram         |
| [R17](./R17-sentry-capture-failed.md)    | Sentry capture failed (DSN invalide / quota)         | Pas d'events Sentry > 1h ou 429 quota            |
| [R18](./R18-plausible-events-missing.md) | Plausible events ne remontent pas                    | Dashboard vide / proxy CSP bloqué                |
| R19                                      | Stripe webhook fail content-gen                      | **N/A V1** (pas de trigger gen par Stripe)       |
| [R20](./R20-cf-cache-stale.md)           | Cloudflare cache stale (article modifié pas visible) | User report / vérif sitemap vs prod URL          |

### 🟢 P2 — Maintenance routine (10)

| Code                                    | Titre                                          | Fréquence                                                          |
| --------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| [R21](./R21-cost-cap-monthly-reset.md)  | Reset cost cap mensuel                         | 1er du mois 00:01 UTC                                              |
| [R22](./R22-pg-restore-drill.md)        | Backup Postgres restore drill                  | Trimestriel                                                        |
| [R23](./R23-indexnow-key-rotation.md)   | Rotation `INDEXNOW_KEY`                        | Annuel ou si leak                                                  |
| [R24](./R24-telegram-token-rotation.md) | Rotation Telegram bot token                    | Si leak / suspicion                                                |
| R25                                     | Migration upgrade Next 16 → 17                 | Quand stable (ADR dédié futur)                                     |
| [R26](./R26-retention-tier3-cleanup.md) | Cleanup retention tier-3 (90j+)                | Quotidien cron 03:00                                               |
| [R27](./R27-postgres-vacuum.md)         | Vacuum analyze Postgres                        | Mensuel                                                            |
| [R28](./R28-dpa-renewal.md)             | Renouvellement DPA providers IA + infra        | Annuel T1 (cycles 12-24 mois selon provider)                       |
| [R29](./R29-rgpd-subprocessor-audit.md) | Audit RGPD sous-processeurs                    | Annuel T2 (cohérence legal.ts ↔ actif ↔ DPA signé)                 |
| [R30](./R30-lighthouse-weekly.md)       | Lighthouse CI prod hebdo                       | Hebdo (lundi 04:00)                                                |
| [R31](./R31-disaster-region-down.md)    | Disaster total région Hetzner (Nuremberg down) | Sur incident très rare — bascule Falkenstein/Helsinki via snapshot |

## Procédures transverses

- [`coolify-procedures.md`](./coolify-procedures.md) — Coolify dashboard + API token + cURL templates + snapshot Hetzner + App UUID + service UUIDs.
- [`review-sop.md`](./review-sop.md) — SOP trimestriel relecture + datation runbooks (review 1er du trimestre).

## Runbooks legacy (infra générale)

Conservés dans `axionia/docs/ops/` car non content-gen-spécifiques :

- `runbook-deploy.md` (Sprint 22) — setup deploy + DNS + Coolify + healthcheck
- `runbook-incident.md` (Sprint 23) — index 12 sections triage / DOWN / lent / DB / BullMQ / email / brute-force / Sentry / CF / SSL / disque / 2FA
- `runbook-monitoring.md` (Sprint 23) — Sentry SaaS + Plausible + Uptime Kuma + Telegram hub

Ces runbooks restent valides mais les sections spécifiques (DB, BullMQ, Sentry, CF) sont **dupliquées + précisées** dans les runbooks dédiés ci-dessus pour usage content-gen.

## Convention "lien admin"

Toutes les URLs admin dans ces runbooks utilisent la notation :

```
/fr/{ADMIN_URL_PREFIX}/content-gen/...
```

`ADMIN_URL_PREFIX` est secret (cf. mémoire `axionia_infra_tokens_pointer` → `.secrets/api-tokens.env`). Will substitue à l'usage.
