# 05 — Workers BullMQ

> **Pondération** : 80 pts | **Score** : **72/80** (90%) 🟢

---

## 5.1 Inventaire — ✅ 10/10

4 workers livrés (278 LOC total) :

- `src/server/queue/workers/image-bank-enrich-worker.ts` (58 LOC)
- `src/server/queue/workers/image-bank-import-worker.ts` (114 LOC)
- `src/server/queue/workers/image-bank-translate-worker.ts` (42 LOC)
- `src/server/queue/workers/image-bank-crons-worker.ts` (64 LOC)

## 5.2 Alignement pattern email-worker — ✅ 25/25

Tous 4 workers conformes :

| Check                                                  | enrich | import | translate | crons |
| ------------------------------------------------------ | :----: | :----: | :-------: | :---: |
| Export `function startImageBank*Worker(): Worker<...>` |   ✅   |   ✅   |    ✅     |  ✅   |
| `getBullConnectionOrThrow()`                           |   ✅   |   ✅   |    ✅     |  ✅   |
| Pas de `new Redis()`                                   |   ✅   |   ✅   |    ✅     |  ✅   |
| Concurrency adaptée                                    |   2    |   1    |     2     |   1   |
| `worker.on("ready"/"completed"/"failed")` listeners    |   ✅   |   ✅   |    ✅     |  ✅   |
| Logging préfixé `[image-bank-xxx-worker]`              |   ✅   |   ✅   |    ✅     |  ✅   |

**Exemple enrich-worker:46-55** :

```ts
{ connection: getBullConnectionOrThrow(), concurrency: 2 },
worker.on("ready", () => console.log("[image-bank-enrich-worker] ready"));
worker.on("completed", (job) => console.log(`[image-bank-enrich-worker] done: ${job.data.imageId}`));
worker.on("failed", (job, err) => console.error(`[image-bank-enrich-worker] failed: ${job?.data?.imageId}...`));
```

## 5.3 Idempotence — ✅ 10/10

- ✅ **Enrich** : re-run même `imageId` safe (upsert translation via `translateAndSave()`)
- ✅ **Import** : fail-soft unlink `.catch(() => undefined)` (import-worker:67)
- ✅ **Translate** : `if (sourceLang === targetLang) return` early-exit (translate-worker:21)

## 5.4 Retry / Failure handling — ⚠️ 5/10 (P1)

**ABSENCE config `attempts` / `backoff`** dans les workers ou centralisée dans `queues.ts` :

- ❌ Pas de `import.retry` dans les 4 workers
- ❌ Pas de déclaration `imageBankEnrichQueue`, `imageBankImportQueue`, etc. dans `src/server/queue/queues.ts` (grep 0)
- ⚠️ `src/server/image-bank/constants.ts:128-130` déclare bien `ENRICH_ATTEMPTS = 3` + `ENRICH_BACKOFF_DELAY_MS = 5000` MAIS aucun helper `enqueueXxx()` ne les consomme

**Impact** : jobs échouant seront perdus (pas de retry automatique).

**Status** : Acceptable V1 (workers prêts mais non activés), MAIS **P1 avant activation prod**.

**Patch proposé** : créer `src/server/image-bank/queues.ts` avec 4 enqueue helpers utilisant constants.ts. Voir `PATCHES-PROPOSES.md` §P1-4.

## 5.5 Activation prod — ⚠️ 5/10 (P1)

`grep "startImageBank" src/server/queue/worker.ts` → **0 matches**

**Workers NON activés en prod**. Documenté dans `docs/image-bank/README.md:52-67` :

> Les 4 workers exportent `startXxxWorker()`. Pour activation en prod, patcher `src/server/queue/worker.ts`…

**Intentionnel par design Sprint 5.x** (cf. ADR 0027). Pattern correct, deployment gate conforme.

**Impact** : Jobs s'empilent en DB si workers non démarrés (mais comme upload.action.ts ligne 96-99 a `enqueue` commenté → pas de jobs créés → pas d'accumulation).

**P1 avant prod activation** : 4 lignes import + 4 calls dans array `WORKERS_TO_START`.

## 5.6 image-bank-crons-worker — ✅ 10/10

- ✅ Dispatcher pattern booking-crons (switch sur `job.data.type` L33)
- ✅ Type exhaustiveness `const _exhaustive: never = type` L49
- ✅ 3 handlers TODO scaffolding (`seo-score-recalc`, `taxonomy-redetect-batch`, `watermark-backfill`) — acceptable V1
- ✅ Limit anti-blast-radius (`limit = 100` default)

## 5.7 Sentry capture — ⚠️ 7/15 (P1)

- ❌ Zéro `Sentry.captureException()` dans workers image-bank
- ⚠️ `email-worker.ts` (référence) : idem (pas de Sentry)
- ⚠️ Cohérence repo : pattern existant pas Sentry → pas régression, mais P1 doctrine

**Impact** : pas de monitoring erreurs workers production. Errors silencieuses (logs console uniquement).

**P1 cohérence** : harmoniser Sprint 5.x — patcher email-worker + content-gen-worker + image-bank workers en parallèle.

**Patch proposé** : voir `PATCHES-PROPOSES.md` §P1-5.

---

## 📋 Issues identifiées

### P1 (3)

- **P1-4** : Retry/backoff config absent (pas de `enqueueXxx()` helpers). Effort 1h (créer `src/server/image-bank/queues.ts` + 4 helpers).
- **P1-2** : Workers non activés `src/server/queue/worker.ts`. Effort 15min après QA staging.
- **P1-5** : Sentry capture absent dans workers (cohérence content-gen). Effort 30min.

### P2 (1)

- **P2-W-1** : Import-worker concurrency 1 → bottleneck potentiel si >1 bulk-import concurrent. Bump à 2 après QA.

---

## 🎯 Sous-pondération

| Check                       |    Pts |  Score |
| --------------------------- | -----: | -----: |
| 5.1 Inventaire 4 workers    |     10 |     10 |
| 5.2 Pattern email-worker    |     25 |     25 |
| 5.3 Idempotence             |     10 |     10 |
| 5.4 Retry/backoff config    |     10 |      5 |
| 5.5 Activation prod         |     10 |      5 |
| 5.6 crons-worker dispatcher |     10 |     10 |
| 5.7 Sentry capture          |     15 |      7 |
| **TOTAL**                   | **80** | **72** |

---

## ✅ Verdict Phase 5

**🟢 PASS 72/80 (90%)** — Workers alignés email-worker, idempotence solide, crons dispatcher type-safe.

3 P1 à boucler avant activation prod : retry config + activation + Sentry. Effort cumulé ~1h45.
