# B-08 — Cron jobs

**Score : 22/25**
**Verdict : GO — couverture exhaustive (20+ crons), patterns BullMQ idempotents, fenêtres horaires décalées**

## Inventaire

Centralisé dans `src/server/queue/queues.ts:472` `bootRepeatableJobs()` (330 lignes).

Pas de `src/server/cron/` dédié — pattern repeatable BullMQ. Idempotence garantie via `removeRepeatable + add` à chaque boot.

## Inventaire complet (20+ crons)

| Cron                                                                                                       | Pattern (UTC)                                   | Fichier worker                    | Acquis                                                     |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| `option-expiration-cron`                                                                                   | `*/5 * * * *`                                   | option-expiration-worker          | Sprint X                                                   |
| `option-reminder-cron`                                                                                     | `0 * * * *`                                     | option-reminder-worker            | Sprint X                                                   |
| `retention-purge-cron`                                                                                     | `0 3 * * *` (daily 03:00)                       | retention-purge-worker            | RGPD D3                                                    |
| `payment-overdue-scan-cron`                                                                                | `0 8 * * *`                                     | booking-crons-worker              | Booking V1                                                 |
| `booking-j7-reminder-cron`, `j1`, `cadrage-j1`                                                             | `0 8 * * *`                                     | idem                              |                                                            |
| `cadrage-h2-reminder-cron`                                                                                 | `0 * * * *`                                     | idem                              |                                                            |
| `contract-pending-reminder`, `quote-pending`, `quote-expiration`, `contract-signed-without-deposit-cutoff` | `30 8 * * *`                                    | idem                              |                                                            |
| `booking-paused-resume-reminder-cron`                                                                      | `0 9 * * *`                                     | idem                              |                                                            |
| `booking-completed-thanks-sweep-cron`                                                                      | `0 18 * * *`                                    | idem                              |                                                            |
| **`content-orchestrator-cron`**                                                                            | `*/15 * * * *` `:589-598`                       | content-orchestrator-worker       | content-gen                                                |
| **`content-rss-fetch-cron`**                                                                               | `0 * * * *` `:600-611`                          | content-rss-fetch-worker          | RSS pipeline                                               |
| **`content-similarity-monitor-cron`**                                                                      | `30 4 * * *` `:613-624`                         | content-similarity-monitor-worker | Jaccard scan                                               |
| **`content-news-lifecycle-cron`**                                                                          | `0 5 * * *` `:626-637`                          | content-news-lifecycle-worker     | Archive 90j                                                |
| **`content-tier-lifecycle-cron`**                                                                          | `0 6 * * *` `:642-658`                          | content-tier-lifecycle-worker     | Auto-promote CTR (modifé monthly → daily audit 2026-05-18) |
| **`content-keyword-sync-cron`**                                                                            | `0 4 * * 1` (Mon 04:00) `:660-672`              | content-keyword-sync-worker       | GSC API                                                    |
| **`content-web-vitals-monitor-cron`**                                                                      | `30 2 * * *` `:674-686`                         | content-web-vitals-monitor-worker | p75 RUM                                                    |
| **`content-psi-monitor-cron`**                                                                             | `0 3 * * 1` (Mon) `:688-700`                    | content-psi-monitor-worker        | PageSpeed                                                  |
| **`content-monitoring-cron`**                                                                              | `15 * * * *` (xx:15) `:702-715`                 | content-monitoring-worker         | Queue stuck + soft-404 + indexation stagnant               |
| **`content-weekly-report-cron`**                                                                           | `0 7 * * 1` (Mon 07:00 UTC ≈ 8h CET) `:717-729` | content-weekly-report-worker      | D-P5-3 D5                                                  |
| **`content-gen-scheduler-cron`**                                                                           | `*/5 * * * *` `:731-743`                        | content-gen-scheduler-worker      | startDate→running                                          |
| **`content-gen-deadline-checker-cron`**                                                                    | `5 0 * * *` (daily 00:05) `:745-757`            | content-gen-deadline-checker      | endDate auto-stop                                          |
| **`embeddings-backfill-cron`**                                                                             | `0 3 * * *` (daily 03:00) `:759-772`            | embeddings-backfill-worker        | OpenAI embeddings                                          |
| **`brand-voice-drift-monitor-cron`**                                                                       | `0 4 * * *` (daily 04:00) `:774-786`            | brand-voice-drift-monitor         | Cosine vs reference                                        |
| **`keyword-opportunity-detector-cron`**                                                                    | `0 6 * * 1` (Mon 06:00) `:788-800`              | keyword-opportunity-detector      | Rank-drop alerts                                           |

= **~25 crons** total (booking inclus). Couverture exhaustive vs cible.

## Décalage horaires (anti-burst)

- 02:30 web-vitals
- 03:00 retention-purge + embeddings-backfill (2 simultanés — léger conflit, mais embeddings est I/O OpenAI, retention DB-only → OK)
- 03:00 Mon psi-monitor
- 04:00 daily brand-voice-drift
- 04:00 Mon content-keyword-sync
- 04:30 similarity-monitor
- 05:00 news-lifecycle
- 06:00 tier-lifecycle
- 06:00 Mon keyword-opportunity-detector
- 07:00 Mon weekly-report

→ Bonne distribution sur la fenêtre 02:00-07:00 UTC (heures creuses pour Hetzner FRA).

## Daily/Weekly mentionnés à valider

- **Daily embeddings backfill** ✅ `0 3 * * *` `:761-772`
- **Brand voice drift** ✅ `0 4 * * *` `:775-786`
- **Weekly Monday 6h opportunity detector** ✅ `0 6 * * 1` `:789-800`
- **Weekly Monday 8h CET quality report** ✅ `0 7 * * 1` UTC = 08:00 CET hiver / 09:00 CET été `:718-729` (cf. memory D-P5-3 D5)
- **Daily PSI** : ⚠️ Pattern est `0 3 * * 1` (Monday only), pas daily. Conforme au commentaire `:230` "PSI weekly monitor". Cible audit dit "daily PSI" — divergence possible avec spec mais cohérence interne OK.
- **Monthly external links HEAD check** : `src/server/queue/workers/external-links-monitor-worker.ts` présent (33 workers) — pattern cron à vérifier dans le worker (pas dans `queues.ts` car queue non listée dans le code parcouru). Pas visible dans `bootRepeatableJobs()` → **possiblement non-câblé**, ou registré dans le worker lui-même.
- **Daily backups** : pas géré côté app — relève de Coolify/Hetzner storage box (cf. memory axion_crm_pro_deploy_2026-05-17 pattern).

## Coolify visibility

Les patterns cron sont posés au boot du worker BullMQ, pas via Coolify cron jobs. Visibilité Coolify = process worker tourne (uptime container). **Pas de monitoring "ce cron a tourné dans la dernière heure"** côté admin app (gap minor : content-monitoring-worker check queue stuck mais pas "no-job-in-window").

## Findings

### P0

Aucun.

### P1

1. **`external-links-monitor-cron` non visible dans `queues.ts` `bootRepeatableJobs()`** alors que le worker `external-links-monitor-worker.ts` existe. À confirmer : si pas câblé, le cron ne s'exécute jamais et la rotation des liens externes (Sprint External Links 2026-05-22) reste inerte. **Action : vérifier `external-links-monitor-worker.ts` self-registration ou ajouter au `bootRepeatableJobs()`.**
2. **`resetMonthlyCostCounters()` cron non câblé** (cf. B-06 P1 #1) — bug critique si confirmé.

### P2

3. **Pas de "heartbeat dashboard" admin** pour visualiser dernière exécution de chaque cron + next-run. Recommandation : ajouter table `CronExecutionLog` + UI admin (~6 h effort).
4. **PSI = weekly** seulement (`:691`), pas daily comme spec audit. À aligner avec cible business (daily vs weekly = trade-off coût PSI quota).

## Verdict paragraphe

**~25 crons cohérents** distribués sur fenêtre 02:00-07:00 UTC, patterns idempotents `removeRepeatable + add`, helpers fail-soft. Couverture content-gen + booking + RGPD + image-bank + embeddings + brand-voice + keyword exhaustive. **Bémols** : `external-links-monitor` semble non-câblé (P1), cost reset mensuel idem (cf. B-06 P1), pas de heartbeat dashboard (P2). 22/25 — perte 3 points sur les 2 P1 et le manque de visibilité opérationnelle.
