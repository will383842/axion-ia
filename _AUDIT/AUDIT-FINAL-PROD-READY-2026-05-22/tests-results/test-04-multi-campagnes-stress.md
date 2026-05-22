# Test 04 — Multi-campagnes parallèles (audit code BullMQ)
## Date : 2026-05-22 — mode AUDIT-ONLY (pas de stress test live)

## BullMQ workers concurrency
src/server/queue/workers/content-gen-worker.ts:697:  workerInstance = new Worker<ContentGenJobPayload>(QUEUE_NAME, processJob, {
src/server/queue/workers/content-gen-worker.ts:699:    concurrency: 5,
src/server/queue/workers/content-publish-worker.ts:713:  workerInstance = new Worker<PublishJobPayload>(QUEUE_NAME, processJob, {
src/server/queue/workers/content-publish-worker.ts:715:    concurrency: 3,

## MAX_PUBLISH_PER_DAY cap Redis INCR (P2 P0-4)
src/server/queue/workers/content-indexnow-worker.ts:30:// Clé : `indexnow:fail-streak` (TTL 1h). À chaque fail upstream → INCR + TTL refresh.
src/server/queue/workers/content-publish-worker.ts:75:// MAX_PUBLISH_PER_DAY : cap journalier publications. Env override possible.
src/server/queue/workers/content-publish-worker.ts:85:// Si MAX_PUBLISH_PER_DAY env var définie → override direct (compatibilité).
src/server/queue/workers/content-publish-worker.ts:87:  const envCap = process.env.MAX_PUBLISH_PER_DAY;
src/server/queue/workers/content-publish-worker.ts:90:  const dbCap = await readContentGenConfig<number>("MAX_PUBLISH_PER_DAY", 0);
src/server/queue/workers/content-publish-worker.ts:154:  // P0-4 — Daily cap check atomique via Redis INCR (P1.5 QW-2).
src/server/queue/workers/content-publish-worker.ts:157:  // et tous publier, dépassant le cap). Redis INCR est atomique : un seul worker
src/server/queue/workers/content-publish-worker.ts:160:  const maxPublishPerDay = await getEffectivePublishCap();
src/server/queue/workers/content-publish-worker.ts:172:  if (countAfterIncr > maxPublishPerDay) {
src/server/queue/workers/content-publish-worker.ts:181:        cap: maxPublishPerDay,
src/server/queue/workers/__tests__/content-publish-worker-throttle.spec.ts:144:    process.env.MAX_PUBLISH_PER_DAY = "30";
src/server/queue/workers/__tests__/content-publish-worker-throttle.spec.ts:179:    // Redis INCR retourne 31 → cap (30) dépassé → moveToDelayed
src/server/queue/workers/__tests__/content-publish-worker-throttle.spec.ts:197:    // Redis INCR retourne 10 → sous le cap (30) → passe le gate

## Isolation campaignId
src/server/content-gen/keyword-selector.ts:78:   * P1-8 — ID de la campagne appelante (ContentGenJob.campaignId).
src/server/content-gen/keyword-selector.ts:83:   * activer le filtre AND campaign_id = <campaignId> dans la requete SKIP LOCKED
src/server/content-gen/keyword-selector.ts:87:  readonly campaignId?: string;
src/server/content-gen/keyword-selector.ts:105:  const { vertical, campaignId, city } = options;
src/server/content-gen/keyword-selector.ts:149:        campaignId: campaignId ?? null,
src/server/queue/workers/content-orchestrator-worker.ts:149:        campaignId: campaign.id,
src/server/queue/workers/content-orchestrator-worker.ts:234:      campaignId: campaign.id,
src/server/queue/workers/content-orchestrator-worker.ts:457:          where: { campaignId: campaign.id },
src/server/queue/workers/content-orchestrator-worker.ts:462:          where: { campaignId: campaign.id, status: "published" },
src/server/queue/workers/content-orchestrator-worker.ts:465:          where: { campaignId: campaign.id, status: "failed" },

## lockDuration 120s
src/server/queue/workers/content-gen-worker.ts:703:    lockDuration: 120_000,
src/server/queue/workers/content-publish-worker.ts:716:    lockDuration: 120_000, // évite stall → double-ping IndexNow si opération réseau lente
src/server/queue/workers/content-quality-improver-worker.ts:352:    // P0-2 — lockDuration 2min : reviewArticle() (Claude Sonnet) peut dépasser 30s.
src/server/queue/workers/content-quality-improver-worker.ts:353:    // Sans lockDuration, BullMQ marque le job stalled → double review possible.
src/server/queue/workers/content-quality-improver-worker.ts:354:    lockDuration: 120_000,
