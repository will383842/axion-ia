# B-04 — Redis + Queues BullMQ

**Score : 21/25**
**Verdict : GO — queues bien dimensionnées, INCR atomique câblé, retention bornée**

## Inventaire

`src/server/queue/queues.ts` (802 lignes) — déclaration centralisée des **30+ queues** BullMQ + helpers d'enqueue typés + `bootRepeatableJobs()` qui registre tous les crons.

### Queues content-gen

`contentGenQueue` `:94`, `contentOrchestratorQueue` `:102`, `contentQualityImproverQueue` `:110`, `contentRssFetchQueue` `:118`, `contentSimilarityMonitorQueue` `:126`, `contentNewsLifecycleQueue` `:134`, `contentPublishQueue` `:142`, `contentIndexNowQueue` `:150`, `contentQaExtractQueue` `:165`, `contentFactCheckQueue` `:179`, `contentTierLifecycleQueue` `:192`, `contentKeywordSyncQueue` `:205`, `contentWebVitalsMonitorQueue` `:219`, `contentPsiMonitorQueue` `:232`, `contentWeeklyReportQueue` `:244`, `contentSchedulerQueue` `:255`, `contentDeadlineCheckerQueue` `:266`, `embeddingsBackfillQueue` `:280`, `brandVoiceDriftMonitorQueue` `:292`, `keywordOpportunityDetectorQueue` `:303`, `contentMonitoringQueue` `:320`.

### Queues misc

`emailsQueue`, `optionExpirationQueue`, `optionReminderQueue`, `newsletterQueue`, `searchIndexerQueue`, `retentionPurgeQueue`, `bookingCronsQueue`, `imageBank*` (5).

## defaultJobOptions (`:31-36`)

```ts
{ attempts: 5, backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 7d, count: 1000 },
  removeOnFail: { age: 30d, count: 5000 } }
```

Bornage Redis OK : auto-purge à 7j complete / 30j failed + cap nombre. Anti-saturation long-terme acquis.

## Cost tracker INCR atomique

**`src/server/queue/workers/content-publish-worker.ts:160-188`** : cap quotidien `MAX_PUBLISH_PER_DAY` via Redis INCR atomique.

- `redis.incr('axion:pub:${today}')` `:163`
- TTL minuit UTC posé au 1er INCR `:164-171`
- Si > cap : `redis.decr` rollback `:174` + `job.moveToDelayed(nextWindowTs)` `:186`

Pattern atomic correct → race condition Sprint Correctif P0 (concurrency=3 publish workers) résolue. ✅

Cost tracker LLM : `src/server/content-gen/lib/cost-tracker.ts:258` `trackCost()` utilise `prisma.$transaction` pour incrémenter `ProviderConfig.currentMonthSpentUsd` atomiquement (pas Redis INCR, mais Postgres atomic suffit pour cap mensuel ; trade-off : latence DB vs Redis).

## Connection pooling

`src/server/queue/connection.ts` (non lu en détail) — `getBullConnection()` singleton via `globalThis`. `src/lib/redis.ts:9-13` similaire pour Redis général : `globalForRedis.redis` cache, `lazyConnect: true`, `maxRetriesPerRequest: 3`, `retryStrategy` exponential cap 5 s.

Build stub `:47-64` : si `REDIS_URL.includes("stub.invalid")` → Proxy no-op. Conforme ADR 0026.

## Cleanup jobs

`bootRepeatableJobs()` `:472` :

- Pattern préservant idempotence : `removeRepeatable` + `add` (anti-doublons en HA scaling, Sprint 15 Fork 1 W2)
- Cron RGPD `retention-purge` quotidienne 03:00 UTC `:506-514`
- Tous les crons content-gen + image-bank + booking listés ici

## Monitoring queue depth

`src/server/queue/workers/content-monitoring-worker.ts:1-80` :

- 4 queues monitored : `content-gen`, `content-publish`, `content-orchestrator`, `emails` `:45-50`
- Snapshot capturé toutes les heures dans Redis `axion:monitoring:queue-snapshot:*` (TTL 3 h) `:77-78`
- Si waiting count stable > 30 min `:53` → `alertQueueStuck()` Telegram

## Findings

### P0

Aucun.

### P1

1. **`content-monitoring` ne surveille que 4 queues sur 30+** (`content-monitoring-worker.ts:45-50`). Queues critiques omises : `content-fact-check` (Perplexity outage), `content-quality-improver` (Claude Sonnet outage), `content-rss-fetch`, `embeddings-backfill`. Risque : queue stuck silent sur ces 4 = stall pipeline non détecté.
2. **`emailsQueue` BullMQ defaults seulement** (`queues.ts:38-40`) : `attempts: 5` mais pas de cap remove fail → si SMTP down longuement, accumulation. Acceptable mais à surveiller.

### P2

3. `getXxxQueue()` lazy-load dans plusieurs workers (`content-gen-worker.ts:127-145`) — connection Redis ouverte par instance worker, pas réutilisée du module `queues.ts`. Doublonnage des connections (cosmétique, ioredis multiplexe les commandes).
4. Pas de visibility côté admin sur les queue depths en temps réel (admin V2 n'a pas de panel BullMQ board ; cf. M16 backlog).

## Verdict paragraphe

**Bien dimensionné** : 30+ queues nommément déclarées, `defaultJobOptions` cohérent, INCR atomique pour cap quotidien (résout race condition Sprint P0), bornage retention Redis acquis. Le monitoring queue depth est câblé mais sous-couvert (4/30+ queues). 21/25 — perte 4 points sur P1 #1 (monitoring incomplet) + P1 #2 (email queue retention) + P2 leak connections.
