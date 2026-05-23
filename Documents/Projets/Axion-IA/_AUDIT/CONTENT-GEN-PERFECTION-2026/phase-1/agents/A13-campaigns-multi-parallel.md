# A13 — Campagnes Multi-Parallèles : Audit Forensique

**Date** : 2026-05-21  
**HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode** : AUDIT-ONLY STRICT — citations fichier:ligne  
**Score** : 30/45

---

## Mission

Auditer si le système supporte plusieurs campagnes en parallèle : model Campaign, workers namespacing, quotas, locks keywords, pause/resume, failure isolation.

---

## Méthode

Lecture directe des fichiers suivants :

- `axionia/prisma/schema.prisma` lignes 2815–2851 (model CoverageCampaign) et 2853–2941 (model ContentGenJob)
- `axionia/src/server/queue/workers/content-orchestrator-worker.ts` (intégral)
- `axionia/src/server/queue/workers/content-gen-worker.ts` (intégral)
- `axionia/src/server/actions/content-gen/coverage.ts` (intégral)
- `axionia/src/server/content-gen/lib/cost-tracker.ts` (intégral)
- `axionia/src/server/content-gen/providers/anthropic.ts` et `openai.ts`
- `axionia/src/server/queue/queues.ts` lignes 85–200 et 490–590
- `axionia/src/server/content-gen/scheduler/anti-burst.ts` (intégral)
- `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/[id]/_v2/CoverageDetailV2.tsx`
- `axionia/src/server/actions/content-gen/__tests__/coverage.spec.ts`

Grep patterns : `Campaign`, `CoverageCampaign`, `campaign`, `pause`, `resume`, `clone`, `bottleneck`, `rate.limit`, `costCap`, `keyword.*lock`, `failedCount`, `publishedCount`, `transaction`, `limiter`.

---

## État Observé

### Q1. Model Campaign existe ? Champs complets ?

**OUI** — `CoverageCampaign` existe dans `axionia/prisma/schema.prisma:2817`.

Champs présents :

| Champ | Type | Présence |
|---|---|---|
| id | String CUID | ✅ |
| name | String | ✅ |
| status | CoverageStatus enum | ✅ |
| scope | CoverageScope enum | ✅ |
| serviceSector | ServiceSector? | ✅ |
| anchorVilleSlugs / anchorDepartementCodes / anchorRegionSlugs | String[] | ✅ |
| totalTargetCount | Int | ✅ |
| typeDistribution | Json | ✅ |
| audienceMix | Json | ✅ |
| searchIntentMix | Json? | ✅ |
| estimatedCostUsd | Decimal? | ✅ (estimation pre-lancement uniquement) |
| estimatedDurationMinutes | Int? | ✅ (estimation statique pre-lancement) |
| generatedCount | Int default 0 | ✅ |
| publishedCount | Int default 0 | ✅ |
| failedCount | Int default 0 | ✅ |
| qualityImprovedCount | Int default 0 | ✅ |
| startedAt / pausedAt / completedAt | DateTime? | ✅ |
| createdAt | DateTime | ✅ |
| createdBy | String? | ✅ |

**Champs ABSENTS demandés** :

| Champ | Absence |
|---|---|
| dailyTarget (per-campaign) | ABSENT — global uniquement via `ContentGenConfig.batches.dailyBatchSize` |
| costCap per-campaign | ABSENT — cost cap uniquement per-provider via `ProviderConfig.monthlyCapUsd` |
| budgetCapUsd per-campaign | ABSENT |
| priority per-campaign | ABSENT (pas de pondération relative entre campagnes) |

**Enum CoverageStatus** (`schema.prisma:2540`) : `draft`, `queued`, `running`, `paused`, `completed`, `failed`, `cancelled` — 7 états, complet.

---

### Q2. Workers : namespacing par campagne ?

**NON** — worker partagé unique.

`content-orchestrator-worker.ts:36` : `const QUEUE_NAME = "content-orchestrator"` — 1 seule queue orchestrateur.

`content-gen-worker.ts:119` : `const QUEUE_NAME = "content-gen"` — 1 seule queue primaire, concurrence 5 (`content-gen-worker.ts:549`).

BullMQ job ID pattern : `gen-${job.id}` (`content-orchestrator-worker.ts:295`) — namespacing au niveau du job individuel, pas de queue dédiée par campagne.

Il n'existe **aucune** queue `gen:<campaignId>`. 2 campagnes parallèles partagent la même queue `content-gen`.

---

### Q3. Race condition sur 2 campagnes parallèles ?

**RISQUE PARTIEL** — architecture sérielle de l'orchestrateur mais compteur non atomique.

L'orchestrateur tourne en `concurrency: 1` (`content-orchestrator-worker.ts:327`). Un seul tick actif à la fois. Au sein du tick, la boucle `for (const campaign of runningCampaigns)` est séquentielle (`content-orchestrator-worker.ts:168`).

Mais `generatedCount` est incrémenté sans transaction englobant la création des jobs :

```ts
// content-orchestrator-worker.ts:258–304
const job = await prisma.contentGenJob.create({ data: {...} });
await getContentGenQueue().add("generate", {...});
totalEnqueued++;
// ... (boucle continue)

// content-orchestrator-worker.ts:307–309
await prisma.coverageCampaign.update({
  data: { generatedCount: { increment: toEnqueue } },
});
```

**Problem** : `toEnqueue` est incrémenté même si `prisma.contentGenJob.create` a levé une erreur et été silenced (la catch bloc à `content-orchestrator-worker.ts:298–303` absorbe les erreurs `Unique constraint` silencieusement). Dans ce cas `generatedCount` est surestimé.

**Risque réel avec 2+ campagnes** : faible dans la pratique car orchestrateur `concurrency: 1` garantit qu'il n'y a pas deux ticks simultanés. En revanche si l'orchestrateur crash au milieu de la boucle (entre `contentGenJob.create` d'une campagne et `coverageCampaign.update`), `generatedCount` peut rester à 0 alors que les jobs sont en queue.

---

### Q4. Répartition équitable budget entre campagnes

**IMPLÉMENTÉ** — fair-share simple par division.

`content-orchestrator-worker.ts:158` :
```ts
const perCampaignTick = Math.max(1, Math.floor(tickBudget / runningCampaigns.length));
```

Puis `content-orchestrator-worker.ts:202` : `const toEnqueue = Math.min(perCampaignTick, remaining)`.

Stratégie = division égale du `tickBudget` entre toutes les campagnes running. **Pas de priorité pondérée** (toutes les campagnes reçoivent le même quota de slots). Le mode `per-type-antiburst` (Sprint 7 V2) répartit le budget residuel par type entre campagnes (`content-orchestrator-worker.ts:215–222`) mais ne pondère pas les campagnes entre elles.

---

### Q5. Quotas Claude API / cost cap

**GLOBAL UNIQUEMENT — pas de per-campaign cap**.

`cost-tracker.ts:182–250` : `assertCostCapAvailable(provider, estimatedCostUsd)` vérifie `ProviderConfig.monthlyCapUsd` vs `currentMonthSpentUsd`. Niveau de granularité = provider (openai / anthropic / perplexity). Aucun cap par campagne.

`anthropic.ts:156` : `await assertCostCapAvailable("anthropic", 0.15)` — estimation fixe 0.15$/call.  
`openai.ts:124` : `await assertCostCapAvailable("openai", 0.1)` — estimation fixe 0.10$/call.

Alert 80% : `cost-tracker.ts:212–225`.  
Kill-switch global auto-trigger si tous providers épuisés : `cost-tracker.ts:77–119`.

**Conséquence pour multi-parallèle** : si une campagne grosse consomme le cap mensuel OpenAI, toutes les autres campagnes running sont également bloquées.

---

### Q6. RPM throttling

**IMPLÉMENTÉ** — BullMQ limiter niveau worker.

`content-gen-worker.ts:552` : `limiter: { max: 10, duration: 60_000 }` → 10 jobs/min toutes campagnes confondues.

Il n'existe pas de lib `bottleneck` ou `p-limit` dans `axionia/src/server/content-gen/` (grep confirme absent). Le throttling est délégué entièrement à BullMQ `limiter`.

**Conséquence** : avec 3 campagnes parallèles, toutes partagent le quota 10 RPM. Throughput total ≠ somme (voir Q14).

---

### Q7. Lock keywords entre campagnes

**ABSENT** — pas de mécanisme de lock keyword inter-campagnes.

Grep de `keyword.*lock`, `lock.*keyword`, `keyword.*assign`, `lockKeyword` dans `axionia/src/server/` → 0 résultat.

L'idempotency key (`content-orchestrator-worker.ts:247–255`) est `hash(campaign.id + slotIndex + contentType + anchorVilleSlug)` — elle isole les doublons **au sein d'une même campagne**, mais deux campagnes différentes peuvent enqueue des jobs avec le même `primaryKeyword` (e.g. "formation intelligence artificielle paris").

La couche de dédup (`checkDedup` dans `content-gen-worker.ts:200–224`) opère au niveau title/keyword APRÈS création du job. Elle bloquerait les doublons si le titre est identique, mais n'empêche pas deux campagnes de générer du contenu très proche sur le même keyword.

---

### Q8. Priorité campagnes

**ROUND-ROBIN ÉQUITABLE UNIQUEMENT** — pas de priorité pondérée.

L'algorithme est un round-robin implicite par division entière : `perCampaignTick = floor(tickBudget / N)`. Aucun champ `priority` sur `CoverageCampaign`. Si Will veut prioriser une campagne, il n'y a pas d'interface pour le faire.

---

### Q9. Pause / Resume campagne

**IMPLÉMENTÉ** côté DB et UI.

`coverage.ts:219–231` : `pauseCampaign(id)` → `status: "paused", pausedAt: new Date()`.  
`coverage.ts:234–288` : `resumeCampaign(id)` → `status: "running", pausedAt: null` + archivage SOC2 dans `ContentGenConfig.campaign_pause_history` via `writeContentGenConfig`.

**Effet sur BullMQ** : la pause ne retire PAS les jobs déjà enqueués dans la queue BullMQ `content-gen`. Le worker continuera à les traiter. L'orchestrateur vérifie `status: "running"` au prochain tick — une campagne paused ne recevra pas de nouveaux slots, mais les jobs déjà en queue sont exécutés jusqu'à completion.

Pas de mécanisme `queue.pause()` BullMQ appelé lors d'un `pauseCampaign`. Les jobs `active` continuent. Seule la création de nouveaux jobs est stoppée côté orchestrateur.

UI : boutons présents dans `CoverageDetailV2.tsx:92–99` (Pause si `running`, Reprendre si `paused`, + slots si `running|paused`).

---

### Q10. Clone campagne

**ABSENT** — pas de fonction `cloneCampaign` ou `duplicateCampaign`.

Grep `clone`, `duplicate`, `copyCampaign` dans `axionia/src/server/actions/` → 0 résultat sur les fichiers coverage.ts. L'UI `CoverageDetailV2.tsx` ne propose pas de bouton clone.

---

### Q11. Status workflow

7 états définis : `draft → queued → running → paused → completed / failed / cancelled`.

Transitions observées dans le code :
- `draft → running` : `launchCampaign()` `coverage.ts:203`
- `running → paused` : `pauseCampaign()` `coverage.ts:219`
- `paused → running` : `resumeCampaign()` `coverage.ts:234`
- `running → completed` : orchestrateur auto quand `generatedCount >= totalTargetCount` `content-orchestrator-worker.ts:171`
- `* → cancelled` : `cancelCampaign()` `coverage.ts:307`

État `queued` : défini dans l'enum mais aucune transition observée dans le code. Potentiellement inutilisé (UNKNOWN — voir section UNKNOWNs).

---

### Q12. Tracking par campagne

**PARTIELLEMENT IMPLÉMENTÉ**.

Champs DB : `generatedCount`, `publishedCount`, `failedCount`, `qualityImprovedCount` sur `CoverageCampaign`.

`generatedCount` : incrémenté par l'orchestrateur à chaque tick (`content-orchestrator-worker.ts:307`).

`publishedCount`, `failedCount`, `qualityImprovedCount` : présents dans le schema mais **aucun `increment` trouvé dans les workers**. Grep de `publishedCount.*increment` et `increment.*published` dans `axionia/src/server/queue/workers/` → 0 résultat. Ces compteurs semblent figés à 0 en production.

`estimatedCostUsd` : estimation statique pre-lancement (`coverage.ts:183`), pas mis à jour en live (coût réel via `CostLedger` non agrégé par campagne en temps réel).

---

### Q13. Estimation time-to-complete affichée

**STATIQUE UNIQUEMENT**.

`coverage.ts:474–503` : `estimateCampaign()` calcule `estimatedDurationMinutes` = `totalSec / concurrency(5) / 60` avant lancement. Valeur hardcodée.

En live, l'UI `CoverageDetailV2.tsx:193` affiche `campaign.estimatedDurationMinutes` — la valeur initiale, non recalculée selon jobs restants ou throughput observé.

Pas de calcul de ETA dynamique (jobs restants × SLO p50 / workers actifs).

---

### Q14. 3 campagnes parallèles : throughput total ?

**THROTTLED — pas de somme**.

1 worker partagé `concurrency: 5`, `limiter: { max: 10, duration: 60_000 }`.

Avec 3 campagnes :
- `tickBudget = 20` (default `dailyBatchSize`) → `perCampaignTick = floor(20/3) = 6` par campagne.
- Tous les jobs vont dans la même queue `content-gen`.
- Le worker consomme 10 jobs/min indépendamment du nombre de campagnes.
- Throughput = 10 jobs/min total, quelle que soit N.

Il n'y a pas de scaling horizontal par campagne. 3 campagnes ≠ 30 RPM.

---

### Q15. Failure isolation : campagne A crash → B continue ?

**OUI — isolation correcte au niveau job, PARTIELLE au niveau orchestrateur**.

Au niveau du worker `content-gen-worker.ts:503–533` : si un job de la campagne A throw, il marque `status: "failed"` et re-throw. BullMQ marque le job `failed` et le retire de la queue. Le prochain job (peut être campagne B) est traité normalement.

Au niveau de l'orchestrateur : la boucle `for (const campaign of runningCampaigns)` à `content-orchestrator-worker.ts:168` n'a PAS de try/catch par campagne. Si la création d'un job DB pour la campagne A provoque une exception non-absorbée, le tick entier échoue — les campagnes suivantes dans la boucle ne reçoivent pas leurs slots pour ce tick.

Mitigation : les erreurs `Unique constraint` (P2002) sont catchées silencieusement (`content-orchestrator-worker.ts:298–303`). Les autres erreurs DB peuvent propager.

---

### Q16. Tests Vitest sur multi-campagne

**ABSENTS**.

`axionia/src/server/content-gen/__tests__/audit-log.spec.ts` — 1 seul test file dans content-gen/__tests__/.

`axionia/src/server/actions/content-gen/__tests__/coverage.spec.ts` : couvre uniquement `resumeCampaign` (audit SOC2, 3 tests). Pas de test pour la logique multi-campagne de l'orchestrateur, pas de test de `createCampaign`, `launchCampaign`, `cancelCampaign`.

`content-orchestrator-worker.ts` : 0 test unit.

---

### Q17. Backpressure global queue >1000

**NON GÉRÉ** — pas de mécanisme de backpressure explicite.

Grep `backpressure`, `maxJobsActive`, `queueSize`, `overflow` dans `axionia/src/server/queue/` → 0 résultat pertinent.

`removeOnComplete: { count: 1000 }` et `removeOnFail: { count: 5000 }` (`content-gen-worker.ts:556–557`) limitent la rétention Redis des jobs terminés, mais ne bloquent pas l'ingestion de nouveaux jobs.

Si l'orchestrateur enqueue 1000 jobs/tick sans que le worker ne les consomme (ex: worker arrêté), les jobs s'accumulent en Redis sans cap. Pas de `maxSize` sur la queue.

---

### Q18. Cron auto-launch campagnes ?

**INEXISTANT** — l'orchestrateur tick toutes les 15 min mais ne lance pas de nouvelles campagnes.

`queues.ts:516–527` : cron `*/15 * * * *` enqueue un tick `content-orchestrator-cron`. Ce tick scanne les campagnes `WHERE status='running'` et enqueue des jobs. Il ne change pas le `status` de `draft` → `running`.

Le lancement est manuel uniquement via `launchCampaign()` depuis l'UI (`CoverageDetailV2.tsx:49–51`).

---

## Findings — Tableau P0/P1/P2

| ID | Sévérité | Finding | Fichier:ligne | Impact multi-parallèle |
|---|---|---|---|---|
| F-01 | **P0** | `failedCount`, `publishedCount`, `qualityImprovedCount` jamais incrémentés par les workers — figés à 0 | schema.prisma:2838–2839, workers: aucun `increment` | Dashboard campagne mensonger |
| F-02 | **P0** | Pas de lock/reservation keyword inter-campagnes — 2 campagnes peuvent générer même contenu sur même keyword | content-orchestrator-worker.ts:247 | Contenu dupliqué inter-campagnes, pénalité SEO |
| F-03 | **P0** | Pause campagne n'évacue pas les jobs BullMQ déjà enqueués — le worker continue à les exécuter | coverage.ts:219, content-gen-worker.ts:549 | Comportement trompeur pour Will : pause = plus de coût |
| F-04 | **P1** | Pas de cost cap per-campaign — une campagne peut épuiser le quota mensuel global et bloquer toutes les autres | cost-tracker.ts:182, schema.prisma:2834 | Budget explosion silencieux si campagne trop agressive |
| F-05 | **P1** | `generatedCount` incrémenté de `toEnqueue` même si certains jobs ont échoué (P2002 silenced) — drift compteur | content-orchestrator-worker.ts:307–309 | Campagne peut sembler terminée avant d'avoir généré le bon volume |
| F-06 | **P1** | Pas de try/catch par campagne dans la boucle orchestrateur — une exception non-P2002 arrête le tick pour toutes les campagnes suivantes | content-orchestrator-worker.ts:168 | Failure partielle isolation défaillante |
| F-07 | **P1** | Pas de priorité pondérée entre campagnes — round-robin équitable uniquement | content-orchestrator-worker.ts:158 | Impossible de prioriser une campagne urgente |
| F-08 | **P1** | Clone campagne absent — recréation manuelle fastidieuse | coverage.ts intégral | Friction UX forte |
| F-09 | **P1** | ETA dynamique absent — `estimatedDurationMinutes` figé à la valeur pre-lancement | coverage.ts:494, CoverageDetailV2.tsx:193 | Will ne sait pas quand une campagne se terminera |
| F-10 | **P1** | 0 test sur orchestrateur multi-campagne — régression invisible | content-gen/__tests__/ | Toute modif orchestrateur sans filet |
| F-11 | **P1** | Pas de backpressure queue — si worker arrêté, jobs s'accumulent sans cap en Redis | queues.ts, content-gen-worker.ts | OOM Redis potentiel sur 3+ campagnes volumineuses |
| F-12 | **P2** | État `queued` dans l'enum CoverageStatus mais aucune transition observée — dead code | schema.prisma:2542 | Confusion admin |
| F-13 | **P2** | RPM 10/min partagé entre toutes campagnes — throughput ne scale pas linéairement | content-gen-worker.ts:552 | Will attend x3 throughput, obtient le même |
| F-14 | **P2** | `estimateCampaign()` hardcode `concurrency = 5` au lieu de lire la valeur DB | coverage.ts:495 | Estimation incorrecte si Will change la concurrence |
| F-15 | **P2** | Cron auto-launch absent — lancement toujours manuel | queues.ts:516 | Pas de scheduling automatique de campagnes |

---

## Scoring /45

| Critère | Max | Score | Justification |
|---|---|---|---|
| Model Campaign existe + champs complets | 15 | **11** | Model complet (id, name, status, scope, sectors, anchors, distributions, counters, timestamps). -4 : costCap per-campaign absent, dailyTarget per-campaign absent, priority per-campaign absent, publishedCount/failedCount non maintenus (F-01) |
| Workers namespacing + anti-race | 12 | **7** | Orchestrateur concurrency:1 protège les ticks. Idempotency key par campaign+slot. -5 : queue partagée unique (pas de namespace gen:<campaignId>), generatedCount non atomique avec les inserts (F-05), pas de try/catch par campagne dans la boucle (F-06) |
| Quotas + locks + RPM throttling | 10 | **5** | BullMQ limiter 10/min implémenté. Cost cap provider avec kill-switch auto. -5 : 0 lock keyword inter-campagnes (F-02 P0), 0 cost cap per-campaign (F-04), RPM partagé non documenté (F-13) |
| Pause/resume/clone UX | 5 | **4** | pause/resume DB + UI complets. Audit SOC2 pauseHistory. -1 : pause ne purge pas BullMQ (F-03), clone absent (F-08) |
| Failure isolation | 3 | **3** | Isolation correcte au niveau job individuel (try/catch, status:failed, throw → BullMQ retry). Note: isolation partielle au niveau tick orchestrateur (F-06) mais impact mineur |

**TOTAL : 30/45 (66.7%) — ORANGE : SPRINT CORRECTIF REQUIS**

---

## Délégations

- **A02 Pipeline E2E** : Vérifier si `publishedCount` / `failedCount` sont mis à jour en aval de `content-publish-worker.ts` ou `review.ts` (non trouvé dans ce périmètre).
- **A12 Admin Console** : Vérifier si le dashboard `/coverage` affiche le coût réel agrégé depuis `CostLedger` ou la valeur `estimatedCostUsd` statique.
- **A16 Auto-review** : La boucle qualité `quality_improving` devrait incrémenter `qualityImprovedCount` — vérifier dans `content-quality-improver-worker.ts`.

---

## UNKNOWNs

- **U1** : L'état `CoverageStatus.queued` est défini (`schema.prisma:2542`) mais aucune transition vers `queued` n'est observée dans le code. Usage prévu ou dead code ?
- **U2** : `publishedCount` / `failedCount` / `qualityImprovedCount` sur `CoverageCampaign` — aucun `increment` trouvé dans les workers audités. Peut-être mis à jour par `content-publish-worker.ts` (lecture partielle) ou `review.ts` (non audité en détail) → à confirmer.
- **U3** : Le mode `per-type-antiburst` (Sprint 7 V2) distribue le budget par type entre campagnes (`content-orchestrator-worker.ts:215–222`) mais la logique de `remainingByType` est un counter global qui décroît à travers toutes les campagnes dans une même boucle — si campagne A épuise le residuel d'un type, campagne B ne reçoit rien pour ce type. Comportement intentionnel ou bug ?

---

## Références

| Fichier | Lignes clés |
|---|---|
| `axionia/prisma/schema.prisma` | 2540–2548 (CoverageStatus), 2817–2851 (CoverageCampaign), 2856–2941 (ContentGenJob) |
| `axionia/src/server/queue/workers/content-orchestrator-worker.ts` | 99–317 (processJob), 112 (findMany running), 158 (perCampaignTick), 247 (idempotencyKey), 307 (generatedCount increment), 321–337 (startOrchestratorWorker, concurrency:1) |
| `axionia/src/server/queue/workers/content-gen-worker.ts` | 549–558 (Worker config, concurrency:5, limiter:10/min) |
| `axionia/src/server/actions/content-gen/coverage.ts` | 219–231 (pauseCampaign), 234–288 (resumeCampaign), 307–393 (cancelCampaign + BullMQ purge), 450–503 (estimateCampaign) |
| `axionia/src/server/content-gen/lib/cost-tracker.ts` | 182–250 (assertCostCapAvailable per-provider, pas per-campaign) |
| `axionia/src/server/queue/queues.ts` | 94–107 (content-gen + content-orchestrator queues), 516–527 (cron orchestrator 15min) |
| `axionia/src/server/content-gen/scheduler/anti-burst.ts` | 45–70 (computeAntiBurstSchedule — distribution par type, pas par campagne) |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/[id]/_v2/CoverageDetailV2.tsx` | 49–73 (actions UI launch/pause/resume/cancel/addSlots), 89–136 (boutons UI) |
| `axionia/src/server/actions/content-gen/__tests__/coverage.spec.ts` | 150–228 (3 tests resumeCampaign uniquement) |
