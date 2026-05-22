# B-01 — Workers BullMQ

**Score : 18/25**
**Verdict : CONDITIONAL — robust core path, retry/lockDuration coverage incomplet sur la périphérie**

## Inventaire (33 fichiers .ts, conforme à la cible 34)

`src/server/queue/workers/*.ts` (33 fichiers) :

- Content-gen pipeline : content-gen-worker, content-publish-worker, content-quality-improver-worker, content-orchestrator-worker, content-fact-check-worker, content-monitoring-worker, content-indexnow-worker, content-rss-fetch-worker, content-qa-extract-worker, content-similarity-monitor-worker, content-tier-lifecycle-worker, content-news-lifecycle-worker, content-keyword-sync-worker, content-google-indexing-worker, content-web-vitals-monitor-worker, content-psi-monitor-worker, content-weekly-report-worker, content-gen-scheduler-worker, content-gen-deadline-checker
- Image bank : image-bank-import-worker, image-bank-enrich-worker, image-bank-translate-worker, image-bank-auto-convert-worker, image-bank-crons-worker
- Misc : email-worker, option-expiration-worker, option-reminder-worker, retention-purge-worker, booking-crons-worker, embeddings-backfill-worker, brand-voice-drift-monitor, keyword-opportunity-detector, external-links-monitor-worker

## Critères audités (par worker)

### lockDuration : 120 000 ms

- ✅ `content-gen-worker.ts:703` — `lockDuration: 120_000`
- ✅ `content-publish-worker.ts:716` — `lockDuration: 120_000`
- ✅ `content-quality-improver-worker.ts:354` — `lockDuration: 120_000`
- ❌ **30 autres workers** : pas de `lockDuration` explicite → fallback BullMQ default = **30 s** (risque stall sur LLM/Perplexity calls > 30 s, fact-check Perplexity peut dépasser).

### captureWorkerError (Sentry) sur `worker.on("failed")`

Couverture : 12/33 workers (helper centralisé `src/server/queue/lib/sentry-worker.ts:83`). Workers couverts :
content-publish, content-gen, content-orchestrator, content-indexnow, content-quality-improver, content-fact-check (NON — voir P1 ci-dessous), content-weekly-report, embeddings-backfill, brand-voice-drift-monitor, content-gen-scheduler, content-gen-deadline-checker, keyword-opportunity-detector, external-links-monitor.

Manquants critiques : content-monitoring-worker, content-rss-fetch-worker, content-qa-extract-worker, content-similarity-monitor-worker, content-tier-lifecycle-worker, content-news-lifecycle-worker, content-keyword-sync-worker, content-google-indexing-worker, content-web-vitals-monitor-worker, content-psi-monitor-worker, email-worker, option-*-worker, retention-purge-worker, image-bank-*. Fact-check : capture absente dans le handler `on("failed")` (`content-fact-check-worker.ts:204-206` log console only).

### Retry 3 + backoff exponentiel

Définis au niveau **Queue** (`src/server/queue/queues.ts:31-36`) via `defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 5000 } }`. **Surchargés** par queue :
- `content-gen`, `content-publish` : attempts=3 (conforme cible)
- `content-quality-improver` : attempts=2
- `content-orchestrator`, `content-rss-fetch`, `content-similarity-monitor`, `content-news-lifecycle`, `content-tier-lifecycle`, `content-keyword-sync`, `content-web-vitals`, `content-psi-monitor`, `content-gen-scheduler`, `content-gen-deadline-checker`, `embeddings-backfill`, `brand-voice-drift-monitor`, `keyword-opportunity-detector`, `content-monitoring`, `option-expiration`, `option-reminder`, `retention-purge` : **attempts=1** (no retry — acceptable pour cron ticks idempotents).

Pas d'override `attempts:`/`backoff:` au niveau `Worker` (BullMQ standard : retry config porté par Queue.add()/Queue defaults).

### Dead-letter / quarantine

- Pas de queue dead-letter dédiée. Pattern utilisé : statut DB `quarantined_critical` ou `quarantined_factcheck` (`content-publish-worker.ts:223`, `content-quality-improver-worker.ts:252`).
- `removeOnComplete: { count: 1000 }`, `removeOnFail: { count: 5000 }` posé sur 4 workers chokepoint (content-gen `:707-708`, content-publish `:721-722`, content-fact-check `:201-202`, content-quality-improver). Bornage Redis OK.

### Rate limiter

11 workers ont `limiter: { max, duration }` (alignement OpenAI tier 5 / Perplexity). Notamment content-gen `:700` (10/min), content-publish `:717` (20/min), content-fact-check `:197` (60/min).

## Findings

### P0 (bloquant prod)
Aucun bloquant absolu : le core pipeline (gen/publish/quality/orchestrator) est complet.

### P1 (important)
1. **`content-fact-check-worker.ts:204` — pas de `captureWorkerError`** ; Perplexity outage = silent fail console only. Worker chokepoint Sentry-aveugle.
2. **30/33 workers sans `lockDuration` explicite** ; risque stall + double-exec sur tout worker dont processJob > 30 s (RSS fetch externe, Perplexity, GSC API). Cf. `content-rss-fetch-worker.ts`, `content-fact-check-worker.ts:194`, `content-keyword-sync-worker.ts`.
3. **`content-orchestrator-worker.ts:521-524` — pas de `removeOnComplete/Fail`** ; tick toutes les 15 min ⇒ ~96 jobs/jour qui s'accumulent indéfiniment dans Redis si BullMQ defaults ne s'appliquent pas (à vérifier ; ailleurs hardé). Risque saturation long-terme.

### P2 (mineur)
4. `content-publish-worker.ts:538` ; tokensInput hardcodé `0` (`content-gen-worker.ts:538`) — détail vrai stocké dans CostLedger mais `ContentGenJob.tokensInput` reste à 0 (UI admin ne montre que tokensOutput). Acquis P2 P1-4 (claim audit antérieur) n'a touché que les bonnes pratiques, le hardcode reste.
5. Pattern lazy `getXxxQueue()` (content-gen-worker `:127-145`, content-publish-worker `:48-69`) instancie une Queue par appel sans cleanup périodique ; OK car singleton module-scoped, mais nécessite `await queue.close()` symétrique au `stop*Worker()` (présent sur orchestrator `:540-542`, absent sur la plupart). Minor leak Redis connections au restart container.

## Verdict paragraphe

L'architecture workers est **mature côté core pipeline** (content-gen/publish/quality/orchestrator/indexnow) : retry + lockDuration + Sentry + Telegram + quarantine DB-driven. La périphérie (fact-check, RSS, GSC sync, image-bank, monitoring) est **partiellement instrumentée** : Sentry absent sur 21 workers et `lockDuration` absent sur 30 workers. Risque opérationnel = stall silencieux + double-exec sur calls externes lents. P1 #1 (fact-check Sentry) à fixer avant prod (Perplexity outage chiffrable). P1 #2 (lockDuration spread) recommandé en hotfix de suivi (1 ligne par worker, ~2 h). 18/25.
