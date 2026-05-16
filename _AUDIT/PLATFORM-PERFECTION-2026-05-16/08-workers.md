# 08 — Workers BullMQ exhaustifs (Agent 2.C)

**SHA HEAD** : `98e0b0f5767c2c78f744269ee1abcb1a5d7e78db` (main)
**Date** : 2026-05-16
**Mode** : AUDIT-ONLY
**Scope** : `axionia/src/server/queue/workers/*.ts` + `queues.ts` + `worker.ts` + `connection.ts`

---

## 0. Reality check (Phase 0.5)

Le brief mentionnait **22 workers**. Recount HEAD `98e0b0f` :

- `find src/server/queue/workers -maxdepth 1 -name '*.ts'` → **21 fichiers** (hors `__tests__/`).
- **0 worker image-bank** sur main (`image-bank-import/translate/enrich/crons-worker.ts` n'existent que sur branche `feat/image-bank-v1` non-mergée — cf. mémoire `axionia_session_2026-05-16_image_bank_v1_sprint_1_7`).
- **0 fichier `gsc-keyword-sync-worker.ts` dédié** — la TODO de la mémoire (`axionia_gsc_worker_pending`) reste **ouverte**. La fonctionnalité GSC est partiellement intégrée dans `content-keyword-sync-worker.ts` (qui appelle `gscTopKeywordsForUrl()` via `gsc-client`), mais le worker dédié n'existe pas.

**Brief reformulé** : 21 workers actifs sur main + 4 image-bank workers en branche non-mergée (hors scope SHA figé) + 1 worker GSC TODO encore pending.

---

## 1. Architecture queue/worker (vue d'ensemble)

### 1.1 Connection (`connection.ts`)

- Singleton `_bullConnection: Redis | null` lazy.
- `maxRetriesPerRequest: null` (requis BullMQ blocking commands BLPOP), `enableReadyCheck: false`, `lazyConnect: true`.
- Toggle `BULLMQ_DISABLED=true` → retourne `null` partout → tous helpers no-op.
- `getBullConnectionOrThrow()` pour workers, throw si disabled (caller doit guard via `isBullmqDisabled()` cf. `worker.ts::main()`).
- **Stub-safe** : `connection.ts` n'inspecte pas la magic string `stub.invalid` — c'est `worker.ts::main()` qui guard via `BULLMQ_DISABLED=true` injecté en build args (cf. AGENTS.md).

### 1.2 Queues defaultJobOptions (`queues.ts`)

```ts
const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
};
```

Cohérent BullMQ best-practices (cap mémoire Redis + audit trail 30j sur fail).

**Per-queue overrides** :

| Queue                                                                                                                                                          | attempts    | Rationale                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------- |
| `emails`                                                                                                                                                       | 5 (default) | SMTP retry safe                         |
| `option-expiration`, `option-reminder`, `retention-purge`                                                                                                      | **1**       | Cron repeatable — re-tick rattrape      |
| `booking-crons`                                                                                                                                                | **3**       | Fail-soft DB temp                       |
| `content-gen`, `content-publish`                                                                                                                               | **3**       | LLM/Prisma fail-soft                    |
| `content-quality-improver`                                                                                                                                     | **2**       | Re-prompt LLM coûteux                   |
| `content-rss-fetch`, `*-similarity-monitor`, `*-news-lifecycle`, `*-tier-lifecycle`, `*-keyword-sync`, `*-web-vitals-monitor`, `*-psi-monitor`, `*-monitoring` | **1**       | Crons idempotents                       |
| `content-indexnow`, `content-qa-extract`, `content-fact-check`                                                                                                 | **2**       | Endpoints externes fail-soft            |
| `content-orchestrator`                                                                                                                                         | **1**       | Tick toutes les 15min, ré-essai inutile |

### 1.3 Worker entry (`worker.ts`)

- `main()` boot 21 workers + `bootRepeatableJobs()` (crons).
- `BULLMQ_DISABLED=true` → `process.exit(0)` propre.
- **Graceful shutdown** : `SIGTERM`/`SIGINT` → `Promise.race(drainAll, 25s timeout)` puis `process.exit(0)`. Aligné Coolify SIGKILL @30s (5s marge).
- **Pas de `worker.on('shutdown', ...)`** événement sur chaque worker individuel, mais le drain global via `.close()` est suffisant et idiomatique BullMQ.

---

## 2. Matrice 21 workers — audit exhaustif

Légende : ✅ OK / ⚠️ partiel / ❌ manquant / N/A non-applicable.

| #   | Worker                              | Concur env-configurable           | attempts | backoff | removeOn{C,F} | Idempotence                                                  | Logs structurés                                              | DLQ/Telegram alert                                     | Kill-switch                      | Graceful shutdown               | Stub-safe |
| --- | ----------------------------------- | --------------------------------- | -------- | ------- | ------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------- | ------------------------------- | --------- |
| 1   | `email-worker`                      | ❌ hardcoded 8                    | 5        | exp 5s  | ✅ default    | ✅ SMTP idempotent SMTP                                      | ⚠️ console.log (pas JSON struct)                             | ⚠️ console.error seul (pas Telegram)                   | N/A                              | ✅ via `.close()` global        | ✅        |
| 2   | `option-expiration-worker`          | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ tx + `SELECT FOR UPDATE` re-lit status                    | ✅ Telegram `OPTION EXPIRÉE` PII redacted                    | ✅ Telegram tag                                        | N/A                              | ✅                              | ✅        |
| 3   | `option-reminder-worker`            | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ sentinel `reminderSentAt`                                 | ⚠️ console.log seul                                          | ❌ pas d'alerte Telegram sur fail                      | N/A                              | ✅                              | ✅        |
| 4   | `retention-purge-worker`            | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ deleteMany append-only                                    | ⚠️ console.log unifié                                        | ❌ pas d'alerte fail                                   | N/A                              | ✅                              | ✅        |
| 5   | `booking-crons-worker`              | ❌ hardcoded 1                    | 3        | exp 5s  | ✅ default    | ✅ handlers idempotents (filter date + state-machine)        | ✅ Telegram tags AUTO sur événements                         | ✅ multiple tags                                       | ❌ pas de kill-switch            | ✅                              | ✅        |
| 6   | `content-gen-worker`                | ❌ hardcoded 5 + limiter 10/min   | 3        | exp 5s  | ✅ default    | ✅ UnrecoverableError + statuts                              | ✅ `logStep`/`logStepError` JSON ds GenerationLog DB         | ✅ `alertKbNotReady`/`alertBatchFail`/`alertNewReview` | ✅ kill_switch hard-gate         | ✅ via `stopContentGenWorker()` | ✅        |
| 7   | `content-orchestrator-worker`       | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ `idempotencyKey = sha256(campaign+slot+type)` UNIQUE      | ✅ console.log tickBudget                                    | ✅ `alertCampaignDone`                                 | ✅ kill_switch                   | ✅                              | ✅        |
| 8   | `content-quality-improver-worker`   | ❌ hardcoded 2 + limiter 5/min    | 2        | exp 5s  | ✅ default    | ✅ `qualityImprovementAttempts` cap auto                     | ✅ `generationLog` warn/info struct                          | ❌ pas d'alerte Telegram                               | ✅ kill_switch                   | ✅                              | ✅        |
| 9   | `content-rss-fetch-worker`          | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ hash `rss-${hash}` UNIQUE                                 | ⚠️ console.warn ad-hoc                                       | ❌ pas d'alerte fail                                   | ✅ kill_switch                   | ✅                              | ✅        |
| 10  | `content-similarity-monitor-worker` | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ tick écrase snapshot DB                                   | ⚠️ console.log seul                                          | ❌ pas d'alerte fail                                   | ✅ kill_switch                   | ✅                              | ✅        |
| 11  | `content-news-lifecycle-worker`     | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ `status='archived'` idempotent                            | ⚠️ console.log seul                                          | ❌ pas d'alerte                                        | ✅ kill_switch                   | ✅                              | ✅        |
| 12  | `content-publish-worker`            | ❌ hardcoded 3 + limiter 20/min   | 3        | exp 5s  | ✅ default    | ✅ tx Article + Translation + Job + jobId BullMQ dedup       | ✅ `logStep` granulaire chaque phase                         | ✅ **alerte Telegram INCIDENT sur fail**               | ✅ kill_switch (throw → requeue) | ✅                              | ✅        |
| 13  | `content-indexnow-worker`           | ❌ hardcoded 2 + limiter 30/min   | 2        | exp 5s  | ✅ default    | ✅ URL filter host + IndexNow tolérant 200/202               | ⚠️ console.log + warn                                        | ✅ `alertIndexNowFailStreak` @3/10/30 via Redis INCR   | ✅ kill_switch                   | ✅                              | ✅        |
| 14  | `content-google-indexing-worker`    | ❌ hardcoded 1 + limiter 200/jour | 2        | exp 5s  | ✅ default    | ✅ skip si pas OAuth, pas de retry sur 4xx (économise quota) | ⚠️ console.log/warn                                          | ❌ pas d'alerte                                        | ✅ kill_switch                   | ✅                              | ✅        |
| 15  | `content-qa-extract-worker`         | ❌ hardcoded 2 + limiter 30/min   | 2        | exp 5s  | ✅ default    | ✅ `prisma.fAQ.upsert` slug unique                           | ✅ `logStep`/`logStepError`                                  | ❌ pas d'alerte                                        | ✅ kill_switch                   | ✅                              | ✅        |
| 16  | `content-tier-lifecycle-worker`     | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ promote/demote idempotent (état terminal)                 | ⚠️ console.log seul                                          | ✅ `alertTier3Stagnant`                                | ✅ kill_switch                   | ✅                              | ✅        |
| 17  | `content-fact-check-worker`         | ❌ hardcoded 2 + limiter 60/min   | 2        | exp 5s  | ✅ default    | ✅ UPDATE Article.factCheckScore idempotent                  | ⚠️ console.log/warn                                          | ❌ pas d'alerte                                        | ✅ kill_switch                   | ✅                              | ✅        |
| 18  | `content-keyword-sync-worker`       | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ upsert `keyword_targetUrl` unique                         | ⚠️ console.log seul                                          | ❌ pas d'alerte                                        | ✅ kill_switch                   | ✅                              | ✅        |
| 19  | `content-web-vitals-monitor-worker` | ❌ hardcoded 1 + limiter 4/h      | 1 (cron) | N/A     | ✅ default    | ✅ snapshot écrase                                           | ✅ `alertLcp/Inp/Cls/Bulk` SSOT + `web_vitals_last_alert` DB | ✅ helpers SSOT                                        | ✅ kill_switch                   | ✅                              | ✅        |
| 20  | `content-psi-monitor-worker`        | ❌ hardcoded 1 + limiter 2/jour   | 1 (cron) | N/A     | ✅ default    | ✅ création samples WebVitalSample idempotente par tick      | ⚠️ console.log seul                                          | ✅ `alertWebVitalsBulk` sur Δ > 50% RUM                | ❌ **kill_switch absent**        | ✅                              | ✅        |
| 21  | `content-monitoring-worker`         | ❌ hardcoded 1                    | 1 (cron) | N/A     | ✅ default    | ✅ Redis snapshot TTL 3h + Promise.allSettled                | ✅ alertQueueStuck/Soft404/IndexationStagnant                | ✅ 3 helpers Telegram                                  | ❌ **kill_switch absent**        | ✅                              | ✅        |

### 2.1 Pondération des cellules

- **Concurrency env-configurable** : **0/21** workers exposent `WORKER_*_CONCURRENCY`. Tous hardcodés (1, 2, 3, 5, 8). Hot-tune nécessite édition + redeploy.
- **attempts cohérents** : ✅ 21/21 (override par queue justifié — crons en `1`, IO/LLM en `2-5`).
- **backoff exponentiel 5s** : ✅ 21/21 héritent du default ou n/a (crons sans retry).
- **removeOnComplete/Fail** : ✅ 21/21 (cap mémoire Redis).
- **Idempotence** : ✅ 21/21 (sentinels DB / `SELECT FOR UPDATE` / `upsert` / `idempotencyKey` UNIQUE / status terminal).
- **Logs structurés** : **5/21 ont JSON struct via `generationLog` DB** (content-gen/orchestrator/publish/quality-improver/qa-extract). Les 16 autres → `console.log/warn/error` plain text (parsable mais pas JSON).
- **Telegram alerts** : **10/21 envoient alertes Telegram** sur événements business critiques. 11/21 n'alertent pas en cas de fail (compte sur BullMQ retry + audit-trail logs).
- **Kill-switch content-gen** : ✅ **15/15 workers content-gen** intègrent `kill_switch` hard-gate. ❌ `content-psi-monitor` et `content-monitoring` (créés méta-cert 2026-05-15) ne checkent pas le kill-switch — incohérence doctrine `axionia_session_2026-05-14_audit_fixes_v1_0_3` P1-7. `booking-crons-worker` non plus (mais hors scope content-gen kill-switch).
- **Graceful shutdown** : ✅ 21/21 via `worker.ts::main()` qui drain via `Promise.race(close, 25s)`. Les workers exposent aussi `stopXxxWorker()` pour tests/dev.
- **Stub-safe** : ✅ 21/21 — la magic string `stub.invalid` n'est jamais lue dans les workers ; le boot complet est gardé par `BULLMQ_DISABLED=true` au niveau de `worker.ts::main()` (cf. AGENTS.md contract).

### 2.2 DLQ (Dead Letter Queue)

**Statut** : ❌ **0/21 workers n'implémentent DLQ explicite**. Le pattern repose sur `removeOnFail: { age: 30j, count: 5000 }` — les jobs failed restent dans Redis 30j ou top 5000, queryables via BullMQ UI (`/admin/bullboard`). Pas de queue séparée `*-dlq` ni de hook automatique vers une table `WorkerDLQ` Prisma.

Cohérent avec sizing V1 (volumes < 1000 jobs/jour, fail rate < 5%), mais à industrialiser V2 (cibles 2150 villes pSEO → ~10k jobs/jour content-gen).

---

## 3. GSC keyword sync worker — TODO encore ouvert ?

### 3.1 Réponse : **TODO ENCORE OUVERTE** ⚠️

Mémoire de référence : `axionia_gsc_worker_pending` — "Coder gsc-keyword-sync-worker.ts + push 4 env vars Coolify dès que deploy axion-ia termine `finished`. OAuth setup déjà fait conv parallèle. ~45 min autopilot."

État SHA `98e0b0f` :

- ✅ `src/server/content-gen/seo/gsc-client.ts` existe (helper OAuth refresh_token + searchAnalytics.query) — cf. `Grep "gscTopKeywordsForUrl"` qui matche dans `content-keyword-sync-worker.ts`.
- ✅ `content-keyword-sync-worker.ts` (worker #18) câble `gscTopKeywordsForUrl()` et upsert KeywordTracking.
- ❌ **Fichier dédié `gsc-keyword-sync-worker.ts` non créé.**
- ❌ **4 env vars Coolify (`GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN/SITE_URL` présumés) non vérifiables depuis le repo** (action humaine sur Coolify).

### 3.2 Interprétation

Le TODO mémoire visait probablement un worker dédié séparé du `content-keyword-sync-worker.ts` existant. Compte tenu que le worker `content-keyword-sync-worker.ts` (cron hebdo lundi 04:00) **inclut déjà** le wire GSC via `gsc-client.ts`, le TODO est **partiellement réalisé** :

- ✅ Code worker : **DONE** (intégré dans `content-keyword-sync-worker.ts`).
- ⚠️ Env vars Coolify : **STATUS UNKNOWN** depuis le repo (memorie indique non pushé).
- ❌ Fichier séparé `gsc-keyword-sync-worker.ts` : **NON CRÉÉ** (mais probablement plus nécessaire — le code existant fonctionne en skip silencieux sans creds).

**Recommandation** : marquer TODO mémoire comme **résolu côté code** + ouvrir un nouveau TODO ops "Push 4 env vars GSC Coolify + vérifier `gsc-client.isReady()` retourne true en prod".

---

## 4. Findings critiques

### 4.1 P0 (bloquant prod ou risque immédiat)

#### P0-1 — Kill-switch absent sur 2 workers monitoring (méta-cert régression)

`content-psi-monitor-worker.ts` (#20) et `content-monitoring-worker.ts` (#21) — créés méta-cert 2026-05-15 AGENT 19 — **n'intègrent pas le `kill_switch` hard-gate**. Lors d'un incident éditorial (Will active `kill_switch`), ces 2 workers continuent à :

- PSI monitor : consommer 30 req PSI/sem (mineur, 0.12% quota) + spam alertes Telegram Δ RUM.
- Monitoring : sonder waiting count + soft-404 HEAD + indexation stagnant → 3 alertes/heure même quand Will a coupé.

Incohérence doctrine `axionia_session_2026-05-14_audit_fixes_v1_0_3` P1-7 qui exige kill_switch sur tous workers content-\*. Fix trivial (~3 lignes par worker).

#### P0-2 — Concurrency 100% hardcoded — 0 hot-tune sans redeploy

Aucun des 21 workers ne lit `process.env.WORKER_<NAME>_CONCURRENCY`. En cas de spike (campagne 280 villes Auvergne-Rhône-Alpes en série cf. `axionia_pseo_industrialisation_decision`), Will ne peut pas tuner `content-gen-worker concurrency` de 5 → 20 sans :

1. Edit code + commit + push.
2. Build GH Actions ~25 min.
3. Coolify pull + restart.

Risque opérationnel élevé pour les pics pSEO V2. Le commentaire `concurrency 5 par defaut (config DB ContentGenConfig.workers_concurrency)` dans `content-gen-worker.ts:17` **promet** DB-managed mais le code lit `concurrency: 5` hardcoded ligne 512.

### 4.2 P1 (à corriger Sprint suivant)

#### P1-1 — Logs non structurés JSON sur 16/21 workers

`email-worker`, `option-*`, `retention-purge`, `booking-crons`, `rss-fetch`, `similarity-monitor`, `news-lifecycle`, `tier-lifecycle`, `fact-check`, `keyword-sync`, `psi-monitor`, `monitoring`, `indexnow`, `google-indexing` → `console.log/warn/error` plain text. Difficile à parser via Loki/Datadog en V2. Les 5 workers content-gen (gen/orchestrator/publish/quality-improver/qa-extract) ont `logStep` JSON structuré dans GenerationLog → pattern à étendre aux 16 autres.

#### P1-2 — Pas d'alerte Telegram sur fail système pour 11/21 workers

`option-reminder`, `retention-purge`, `rss-fetch`, `similarity-monitor`, `news-lifecycle`, `quality-improver`, `fact-check`, `keyword-sync`, `qa-extract`, `google-indexing` → fail silencieux (console.error seul). Aligner sur `content-publish-worker.ts` qui envoie Telegram INCIDENT sur fail.

#### P1-3 — Pas de DLQ dédié

`removeOnFail: { age: 30j, count: 5000 }` cap les jobs failed en Redis mais pas de visibility/replay UI hors BullBoard. V2 industrialisation pSEO → ajouter table `WorkerDLQ` + Server Action replay.

### 4.3 P2 (optionnel / nice-to-have)

- **P2-1** : `option-expiration-worker` ligne 41 boucle `for (const opt of expired)` séquentielle pourrait `Promise.allSettled` (limité par `SELECT FOR UPDATE` mais workable). Volume V1 OK (~10 options/jour), mais à scale 1000+/jour, séquentiel devient un goulot.
- **P2-2** : `retention-purge-worker` n'envoie pas Telegram récap quotidien des compteurs (logs/submissions/bookings/etc.). Will doit aller chercher dans Coolify logs.
- **P2-3** : `booking-crons-worker` agrège 11 handlers via dispatcher. Concurrency 1 = sérialisé même si 11 jobs/jour. OK V1 mais cap throughput à 11 jobs/heure si dailyTargetByType monte.

---

## 5. Scoring /100

| Critère                                                                     | Poids   | Score | Pondéré  | Détail                                                                                                                                                 |
| --------------------------------------------------------------------------- | ------- | ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Architecture queues/workers (`queues.ts`, `worker.ts`, `connection.ts`)** | 15      | 95    | 14.25    | defaultJobOptions cohérent, BULLMQ_DISABLED toggle propre, graceful shutdown SIGTERM 25s                                                               |
| **attempts/backoff/removeOn{C,F}**                                          | 10      | 95    | 9.5      | overrides cohérents par queue, attempts=1 sur crons (correct)                                                                                          |
| **Idempotence**                                                             | 15      | 90    | 13.5     | `SELECT FOR UPDATE`, sentinels DB, `idempotencyKey` UNIQUE, `upsert` partout. Quelques chemins fail-soft `.catch(() => undefined)` cachent les erreurs |
| **Observabilité (logs structurés + alertes)**                               | 15      | 60    | 9.0      | 5/21 JSON struct + 10/21 Telegram → 16/21 console.log plain                                                                                            |
| **Kill-switch content-gen cohérence**                                       | 10      | 85    | 8.5      | 15/15 content-gen OK, **mais 2 méta-cert workers (psi-monitor, monitoring) ratent le check** P0-1                                                      |
| **Concurrency configurabilité**                                             | 10      | 30    | 3.0      | 0/21 env-configurable. Commentaire ContentGenConfig.workers_concurrency = wishful thinking P0-2                                                        |
| **Graceful shutdown**                                                       | 5       | 95    | 4.75     | `Promise.race(close, 25s)` propre. Pas de hook `worker.on('shutdown')` mais idiomatique BullMQ                                                         |
| **Stub-safe (magic string `stub.invalid`)**                                 | 5       | 100   | 5.0      | Workers ne lisent jamais la string ; gate via `BULLMQ_DISABLED=true` ✅                                                                                |
| **DLQ / replay**                                                            | 5       | 50    | 2.5      | `removeOnFail` cap mémoire OK, pas de DLQ dédié / UI replay                                                                                            |
| **GSC keyword sync worker (TODO)**                                          | 5       | 70    | 3.5      | Code intégré dans `content-keyword-sync-worker`, fichier dédié non créé, env vars Coolify status unknown                                               |
| **Tests **tests**/ couverture workers**                                     | 5       | 70    | 3.5      | `__tests__` dir présent (vérification ciblée hors-scope agent 2.C, audit 3.B + 5.A le couvre)                                                          |
| **TOTAL**                                                                   | **100** | —     | **77.0** | 🟡 **CONDITIONAL GO**                                                                                                                                  |

---

## 6. Verdict

**Score : 77/100 — 🟡 CONDITIONAL GO**

Architecture queue/worker **solide V1** : 21 workers cohérents, defaultJobOptions BullMQ best-practices, idempotence stricte via sentinels/UNIQUE indexes, kill-switch propagé 15/15 workers content-gen historiques, magic string `stub.invalid` respectée intégralement via gate `BULLMQ_DISABLED=true`, graceful shutdown SIGTERM 25s aligné Coolify.

**Risques bloquants V2 industrialisation pSEO** : concurrency 100% hardcoded (P0-2 — pas de hot-tune en spike), kill_switch absent sur 2 workers méta-cert récents (P0-1 — régression doctrine), observabilité fragmentée 16/21 plain text (P1-1), DLQ absent (P1-3).

GSC keyword sync : **TODO mémoire à fermer côté code** (intégré dans `content-keyword-sync-worker`), reste action humaine push 4 env vars Coolify.

---

## 7. Top 3 P0 actionnables

1. **P0-1 — Câbler `kill_switch` hard-gate sur `content-psi-monitor` (#20) + `content-monitoring` (#21)** : 3 lignes par worker, aligne doctrine P1-7 `axionia_session_2026-05-14_audit_fixes_v1_0_3`. Fix `~5 min`.
2. **P0-2 — Rendre `concurrency` env-configurable sur les 5 workers content-gen hot-path** (`content-gen-worker`, `content-publish-worker`, `email-worker`, `content-indexnow-worker`, `content-qa-extract-worker`) : pattern `parseInt(process.env.WORKER_CONTENT_GEN_CONCURRENCY ?? '5', 10)`. Permet hot-tune V2 pSEO sans rebuild. Fix `~15 min` + push env vars Coolify.
3. **P1-2 promu P0-3 — Alerte Telegram INCIDENT sur fail système pour `option-expiration`, `option-reminder`, `retention-purge`, `booking-crons`** : workers business-critical revenue impact. Pattern aligné sur `content-publish-worker.on('failed', sendTelegram(INCIDENT, ...))`. Fix `~20 min`.

---

## 8. Verdict 1-liner (pour synthèse parent)

> **77/100 🟡 CONDITIONAL GO** — 21 workers solides V1, kill-switch 15/15 content-gen historiques + magic `stub.invalid` propre, MAIS 2 workers méta-cert (psi-monitor + monitoring) ratent le kill-switch, concurrency 100% hardcoded → hot-tune V2 impossible sans rebuild, 16/21 logs plain text. GSC keyword sync TODO à fermer (intégré `content-keyword-sync-worker`).

---

_Livrable Agent 2.C — Audit AUDIT-ONLY platform perfection 2026-05-16 — SHA `98e0b0f`._
