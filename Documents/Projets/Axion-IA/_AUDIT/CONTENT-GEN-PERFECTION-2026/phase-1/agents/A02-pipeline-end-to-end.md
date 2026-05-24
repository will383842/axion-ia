# A02 — Pipeline End-to-End · Audit Forensique

**Date :** 2026-05-21
**HEAD audité :** `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
**Mode :** AUDIT-ONLY STRICT — 0 modification code
**Auditeur :** Agent A02 (Claude Sonnet 4.6)

---

## Mission

Tracer 1 article depuis le clic admin « générer » jusqu'à l'apparition dans `sitemap.xml`. Mesurer chaque étape du pipeline, identifier les failure modes, évaluer l'observabilité.

---

## Méthode

Lecture exhaustive des fichiers suivants (0 exécution) :

| Fichier | Rôle |
|---|---|
| `src/server/actions/content-gen/enqueue.ts` | Server Action — déclencheur admin direct |
| `src/server/actions/content-gen/review.ts` | Server Actions — approve / promote |
| `src/server/queue/workers/content-orchestrator-worker.ts` | Worker cron campagnes |
| `src/server/queue/workers/content-gen-worker.ts` | Worker primaire génération |
| `src/server/queue/workers/content-publish-worker.ts` | Worker publication DB |
| `src/server/queue/workers/content-quality-improver-worker.ts` | Worker boucle qualité |
| `src/server/queue/workers/content-indexnow-worker.ts` | Worker IndexNow |
| `src/server/content-gen/indexing/enqueue.ts` | Helper centralisation pings indexing |
| `src/server/content-gen/shared/generation-log.ts` | Audit trail GenerationLog |
| `src/server/content-gen/shared/revalidate-content.ts` | Revalidation ISR via API interne |
| `src/server/content-gen/providers/anthropic.ts` | Provider LLM avec retry |
| `src/server/content-gen/lib/retry.ts` | Logique retry exponentiel |
| `src/server/queue/queues.ts` | Déclarations queues + crons |
| `src/server/queue/worker.ts` | Point d'entrée workers |
| `src/server/queue/lib/sentry-worker.ts` | Capture Sentry workers |
| `src/app/sitemap.ts` | Sitemap Next 16 generateSitemaps |
| `src/app/sitemap-news.xml/route.ts` | Route Handler sitemap Google News |
| `src/server/content-gen/generators/types.ts` | Contrat Generator |
| `src/server/content-gen/generators/blog-article.ts` (extrait) | Exemple generator concret |

---

## État observé — Trace complète du pipeline

### Chemin 1 : Déclenchement direct admin (quick action)

```
[Admin UI] clic "Générer article…"
     ↓  Server Action (Next.js "use server")
[1] enqueueDirectGen()                        src/server/actions/content-gen/enqueue.ts:56
     • requireAdmin() — auth check session
     • idempotencyKey = sha256(type::ville::keyword::intent::slot60s)
     • prisma.contentGenJob.create(status="queued", priority=3)
     • contentGenQueue.add("generate", payload, { jobId: `gen-${job.id}` })
     • revalidatePath("/fr/admin/content-gen")
     ↓  Redis BullMQ queue "content-gen"
```

### Chemin 2 : Déclenchement via campagne (orchestrateur cron)

```
[Cron BullMQ] */15 * * * *  → queue "content-orchestrator"
     ↓
[1] content-orchestrator-worker.processJob()  content-orchestrator-worker.ts:99
     • readContentGenConfig("kill_switch") — hard gate
     • readContentGenConfig("batches") — dailyBatchSize + workersConcurrency
     • prisma.coverageCampaign.findMany(status="running")
     • Pour chaque campagne :
         — computeAntiBurstSchedule() si mode per-type
         — sampleWeighted(typeDist) → contentType
         — sampleAudienceMix() → { size, org }
         — idempotencyKey = sha256(campaignId::slotIndex::contentType::anchor)
         — prisma.contentGenJob.create(status="queued", priority=5)
         — contentGenQueue.add("generate", payload, { jobId: `gen-${job.id}` })
     • prisma.coverageCampaign.update(generatedCount++)
     ↓  Redis BullMQ queue "content-gen"
```

### Étapes 2–10 : Worker primaire content-gen

```
[2] content-gen-worker.processJob()           content-gen-worker.ts:148
     concurrency=5, limiter=10req/min

     STEP A  — readContentGenConfig("kill_switch")           → abort if active
     STEP B  — prisma.contentGenJob.findUnique()             → 404 → UnrecoverableError
     STEP C  — logStep("kb_retrieve", "Job found…")          → GenerationLog (append-only)
     STEP D  — assertKbReady()                               → KbNotReadyError → status=failed
     STEP E  — prisma.contentGenJob.update(status="running", startedAt)
     STEP F  — checkDedup(title) si title présent            → cancelled si doublon
     STEP G  — logStep("dedup_check", …)
     STEP H  — getGenerator(contentType).generate(input)
               → kbRetrieve RAG (k=8 chunks)
               → withRetry(anthropicProvider.generate) × 3
                   delays [10s, 30s, 60s]
                   prompt cache ephemeral system prompt
               → computeReadabilityFr() + computeSeoScore()
               → checkDoctrine() + evaluateSoft404()
               → GeneratorOutput { title, bodyHtml, slug, faq, qualityScore… }
     STEP I  — logStep("llm_call", metadata: { duration_ms, quality_score, total_tokens… })
               *** SEULE MESURE LATENCE INSTRUMENTÉE ***
     STEP J  — loadPlagiarismCorpus() (50 articles DB)
     STEP K  — checkPlagiarism(Jaccard) + logStep("plagiarism_check")
     STEP L  — validateIntentAlignment() + logStep("intent_check")
     STEP M  — Décision routing :
               blockingFail ? tier_3_noindex_nofollow : output.indexationTier
     STEP N  — prisma.contentGenJob.update(
                  status = "quality_improving"|"approved"|"needs_review",
                  outputJsonRaw = persistedOutput,    ← SOURCE DE VÉRITÉ publish
                  qualityScore, seoScore, costUsd…
               )
     STEP O  — if eligibleQualityLoop → queue "content-quality-improver"
     STEP P  — prisma.reviewQueue.create(status="pending"|"approved")
     STEP Q  — if approved → queue.add("publish", { reviewQueueId, promoteToTier1 })
```

### Étape 11 : Approbation manuelle (chemin principal « needs_review »)

```
[Admin UI] /content-gen/review-queue → clic "Approve"
     ↓
[11] approveReview(id)                        review.ts:153
      • prisma.reviewQueue.updateMany(status="approved") — atomic race protection
      • enqueuePublish(id, promoteToTier1=false)          → queue "content-publish"
     OU
[11b] promoteToTier1(id)                      review.ts:338
      • prisma.reviewQueue.updateMany(status="promoted_t1")
      • prisma.contentGenJob.update(status="publishing")
      • enqueuePublish(id, promoteToTier1=true)
```

### Étapes 12–18 : Worker content-publish

```
[12] content-publish-worker.processJob()      content-publish-worker.ts:71
     concurrency=3, limiter=20req/min

     STEP A  — readContentGenConfig("kill_switch")
     STEP B  — prisma.reviewQueue.findUnique({ include: { job } })
     STEP C  — vérif status "approved"|"promoted_t1"
     STEP D  — cgJob.outputJsonRaw → titre, slug, bodyHtml, faqJson…
     STEP E  — logStep("publish", "Publish pipeline start")
     STEP F  — prisma.$transaction([
                  tx.article.create({ status:"published", indexationTier, qualityScore… })
                  tx.articleTranslation.create(locale:"fr", slug, title, body, bodyText)
                  tx.contentGenJob.update(status:"published", outputBlogPostId)
               ])
     STEP G  — logStep("article_insert")
     STEP H  — if isNews → logStep("json_ld_news_article")
     STEP I  — if promoteToTier1 → enqueueIndexingForTier1()
                   → contentIndexNowQueue.add("ping", { urls:[url], origin:"content-gen" })
                     jobId=`indexnow-${articleId}-publish`
                   → if GOOGLE_INDEXING_API_ENABLED → contentGoogleIndexingQueue.add()
               logStep("indexnow_ping")
     STEP J  — contentFactCheckQueue.add("check", { articleId, contentGenJobId })
               logStep("fact_check_enqueue")
     STEP K  — if faqJson → contentQaExtractQueue.add("extract", { faqs })
               logStep("qa_extract")
     STEP L  — revalidateContent({ paths: ["/fr/blog/{slug}", "/sitemap.xml", "/sitemap-index.xml"…] })
               → POST /api/internal/revalidate (REVALIDATE_SECRET)
               logStep("revalidate_path")
```

### Étapes 19–20 : IndexNow + sitemap

```
[19] content-indexnow-worker.processJob()     content-indexnow-worker.ts:66
     concurrency=2, limiter=30req/min

     • readContentGenConfig("kill_switch")
     • check INDEXNOW_KEY + NEXT_PUBLIC_SITE_URL
     • filter URLs par host
     • POST https://api.indexnow.org/indexnow  timeout=20s
     • si fail → redis INCR "indexnow:fail-streak" + alertIndexNowFailStreak à 3/10/30

[20] sitemap.xml (src/app/sitemap.ts) — revalidé via ISR
     • buildBlogSitemap() lit prisma.article(tier_1_indexable, status:published, isNews:false)
       take: 5000, select: publishedAt, slug (via translations)
     • Merge slugs DB avec slugs FS (FS prioritaire)
     • Expose /sitemap/<chunkId>.xml via Next 16 generateSitemaps()
     • revalidate: 3600s (ISR 1h) sauf si revalidatePath déclenché post-publish
     • sitemap-news.xml : force-dynamic, revalidate=300s, fenêtre 48h
```

---

## Diagramme de séquence condensé

```
Admin → enqueueDirectGen() → ContentGenJob(queued) → BullMQ "content-gen"
                                                            ↓
                                          content-gen-worker (concurrency=5)
                                          KB retrieve → LLM (retry×3 10/30/60s)
                                          Dedup → Plagiarism → Intent checks
                                          ContentGenJob(needs_review) + ReviewQueue(pending)
                                                            ↓
Admin → approveReview() / promoteToTier1() → BullMQ "content-publish"
                                                            ↓
                                          content-publish-worker (concurrency=3)
                                          Article + ArticleTranslation (prisma.$transaction)
                                          ContentGenJob(published)
                                                  ↓           ↓           ↓
                              IndexNow queue   FactCheck q   QaExtract q   revalidateContent
                                    ↓
                          indexnow-worker → POST api.indexnow.org
                                    ↓
                          sitemap.xml ISR revalidé (~1h max ou immédiat si revalidate POST)
```

---

## Findings

### Tableau P0 (bloquants)

| ID | Sévérité | Fichier:ligne | Description |
|---|---|---|---|
| F-01 | **P0** | `content-gen-worker.ts:231` | **Latence LLM non mesurée au niveau pipeline** : `duration_ms` est logué dans `logStep("llm_call")` mais uniquement pour l'appel `generator.generate()` global. Les sous-étapes KB retrieve, plagiarism corpus load (50 articles DB), intent check n'ont pas de `duration_ms`. Il n'existe **aucun p50/p95 par étape** — seul un timestamp par job existe dans `ContentGenJob.durationMs`. **P0 observabilité** : impossible de savoir si le bottleneck est le RAG, le LLM, ou le plagiat sans instrumenter chacun. |
| F-02 | **P0** | `content-gen-worker.ts:549` | **Concurrence hardcodée `concurrency: 5`** mais le commentaire indique « V2 DB-managed ». `readContentGenConfig("batches").workersConcurrency` est lu par l'orchestrateur pour planifier (orchestrator-worker.ts:108) mais **le worker content-gen ignore ce paramètre** — il est toujours démarré à concurrency=5 fixe. Paradoxe : l'orchestrateur enfile N jobs selon `workersConcurrency` mais le worker consomme à 5 quelle que soit la config DB. |
| F-03 | **P0** | `content-publish-worker.ts:326` | **Revalidation sitemap lacunaire** : les paths revalidés sont `["/fr/blog/{slug}", "/fr/actualites/{slug}", "/fr/blog", "/sitemap.xml", "/sitemap-index.xml", "/sitemap-news.xml"]`. Le sub-sitemap `knowledge-<n>` n'est **pas inclus**. Un article factory publié apparaît dans `sitemap/knowledge-<n>.xml` (via `buildKnowledgeSitemapChunk`) mais ce chunk n'est pas revalidé → latence jusqu'à 1h ISR avant que Googlebot le découvre. |

### Tableau P1 (importants)

| ID | Sévérité | Fichier:ligne | Description |
|---|---|---|---|
| F-04 | **P1** | `content-gen-worker.ts:231` | **Aucun timeout global job** : le LLM call a `withRetry(3)` avec delays 10/30/60s = max 100s par tentative (timeout SDK 60s) + overhead = ~3-4min max par job. Mais aucun `timeout` BullMQ configuré sur le worker. Un job bloqué en `running` ne sera pas requeue — il reste en `running` indéfiniment si le worker process crash après `status=running`. Récupération manuelle requise. |
| F-05 | **P1** | `content-gen-worker.ts:378-394` | **outputJsonRaw persiste avant status=approved** : c'est correct et voulu (le publish worker le lit). Mais si un job passe `needs_review` puis est reject + re-généré (nouvelle run), l'ancien `outputJsonRaw` reste visible en DB jusqu'à la 2e run. Pas de lien ReviewQueue → Article pour le tracking "quelle version a été publiée". |
| F-06 | **P1** | `content-quality-improver-worker.ts:144` | **Quality improver V1 = skeleton** : ne re-prompte pas le LLM. Incrémente `qualityImprovementAttempts` et bascule en `needs_review`. La boucle qualité § 27 est marquée V1 — **non fonctionnelle** pour améliorer le score. Tout article sous 75 passe en review manuelle après 1 "tentative" fictive. |
| F-07 | **P1** | `review.ts:204` | **Bulk approve** : `for (const r of candidates) await enqueuePublish(r.id, false)` — séquentiel. Pour 100 reviews approuvées en bulk, chaque `enqueuePublish` est attendu. Peut bloquer la Server Action plusieurs secondes si Redis lag. Devrait être `await Promise.all(candidates.map(...))`. |
| F-08 | **P1** | `sitemap.ts:501-532` | **Sitemap blog DB-aware prend `take: 5000`** : si la DB contient > 5 000 articles tier-1, les plus anciens sont silencieusement exclus du sitemap sans pagination ni log. À 500 articles/jour (scale cible), seuil atteint en 10 jours. |
| F-09 | **P1** | `enqueue.ts:56` | **Pas d'endpoint HTTP dédié** : le déclenchement admin passe par une Server Action Next.js (POST en body JSON encodé), pas une route API REST typée. Impossible de l'appeler depuis un script ou CLI externe sans simuler le contexte Next. |
| F-10 | **P1** | `content-gen-worker.ts:503-534` | **Catch global relance `throw err`** → BullMQ retente le job jusqu'à `attempts=3`. Mais le job est déjà passé à `status=failed` en DB (ligne 511). Au retry BullMQ, le worker refait `findUnique` (OK) mais `status=running` est re-appliqué (ligne 197) puis échoue à nouveau → **3 updates status=failed** pour 1 job. Double-comptage potentiel des fails dans les alertes Telegram (ligne 527 : `recentFails % 5 === 0`). |

### Tableau P2 (améliorations)

| ID | Sévérité | Fichier:ligne | Description |
|---|---|---|---|
| F-11 | **P2** | `content-gen-worker.ts:81-110` | **Corpus plagiarism hardcodé à 50** (`PLAGIARISM_CORPUS_SIZE=50`). À 500 articles/jour, la fenêtre anti-plagiat = 6h de production. Articles produits il y a > 6h ne sont pas comparés → risque duplicats interjour. |
| F-12 | **P2** | `content-publish-worker.ts:297-314` | **QA extract fire-and-forget non protégé** : si `getQaExtractQueue()` throw (REDIS_URL absent), le publish échoue complètement. Devrait être wrappé dans try/catch comme `getFactCheckQueue`. |
| F-13 | **P2** | `content-orchestrator-worker.ts:307` | **generatedCount incrémenté de `toEnqueue` même si certains inserts ont échoué** (P2002 unique constraint = skip silencieux). Dérive possible entre generatedCount réel et compteur DB. |
| F-14 | **P2** | `sitemap.ts:317-323` | **`lastModified = BUILD_TIME`** pour toutes les pages statiques. Un article publié après le dernier deploy a `lastModified` à la date du dernier deploy dans `pages.xml` — moins précis qu'une date réelle. |
| F-15 | **P2** | `revalidate-content.ts:51` | **Erreur revalidation silencieuse en production** : `if (!res.ok && process.env.NODE_ENV !== "production") console.warn(...)` — les erreurs HTTP de revalidation sont swallowées silencieusement en prod. Aucun log, aucune alerte Sentry. |

---

## Scoring /45

### 1. Trace complète documentée — /20

**Score : 17/20**

La trace complète est reconstituée (20 étapes identifiées, 2 chemins déclenchement). Chaque worker est identifié avec concurrency, queue name, payload typé. Les sous-étapes internes du content-gen-worker sont documentées step by step (A→Q). Points retirés :

- (-2) Le sous-pipeline du generator (`blog-article.ts`) n'est pas instrumenté étape par étape (KB retrieve → LLM call → scores — tout dans `generate()` sans logStep intermédiaire)
- (-1) Le chemin "quality_improving → quality-improver-worker" n'est pas complètement tracé (V1 skeleton = ne re-prompte pas)

### 2. Mesures latence ou flag absence instrumentation — /10

**Score : 4/10**

**P0 confirmé.** Seule la latence LLM globale est instrumentée (`duration_ms` dans `logStep("llm_call")`). Les étapes suivantes ne sont pas chronométrées :

- KB retrieve (RAG Postgres)
- Chargement corpus plagiarism (50 articles DB)
- Checks qualité (readability, SEO score, doctrine, soft-404)
- Intent alignment
- Transaction Prisma publish (article + translation + job update)
- Revalidation ISR (HTTP interne)

Le champ `ContentGenJob.durationMs` mesure le temps total worker mais ne décompose pas par étape. Aucun p50/p95 observable — **pas de SLA par étape**. La latence totale p50 d'un article (génération + publish) est estimable à 30-90s mais non mesurée en production.

### 3. Failure modes audités — /10

**Score : 8/10**

| Failure mode | Couverture code |
|---|---|
| Claude API down | withRetry × 3 (10/30/60s), ProviderError.retryable, BullMQ attempts=3 |
| KB not ready | KbNotReadyError → status=failed, alertKbNotReady Telegram |
| Plagiarism/intent fail | blockingFail → tier_3_noindex_nofollow (pas fail, downgrade) |
| Cost cap dépassé | assertCostCapAvailable → ProviderError(retryable=false) → provider auto-disable |
| Slug duplicate | Prisma P2002 → publish-worker throw → BullMQ retry |
| Kill switch | Hard gate sur tous les workers (gen, publish, indexnow, quality) |
| IndexNow down | try/catch interne → recordIndexNowFail + fail streak Redis + alertIndexNowFailStreak |
| Worker crash mi-job | **LACUNE** : status=running persisté, pas de recovery auto si process crash |
| 1000 jobs backpressure | BullMQ limiter (10/min gen, 20/min publish) + anti-burst orchestrateur — mais pas de dead-letter visible admin |
| DLQ | **LACUNE** : `removeOnFail: { count: 5000 }` = Redis DLQ soft. Pas d'interface admin pour inspecter les failed jobs BullMQ. |

(-2) : Worker crash laisse les jobs en `status=running` indéfiniment. Pas de stale-job detection/recovery.

### 4. Observability state — /5

**Score : 3/5**

| Outil | État |
|---|---|
| GenerationLog (Prisma, append-only) | ACTIF — logStep sur ~14 étapes clés |
| Sentry workers | ACTIF sur 4 workers chokepoint (gen, publish, orchestrator, indexnow) |
| Telegram alerts | ACTIF (KB not ready, batch fail, IndexNow streak, campaign done, publish fail) |
| Logs structurés (pino/winston) | ABSENT — uniquement `console.log/error` |
| p50/p95 latence par étape | ABSENT — P0 |
| BullMQ board admin | INCONNU — non vu dans le code admin (`/infra` ou `/queue` ?) |
| Dashboard coûts | PARTIEL — `CostLedger` + `ProviderConfig.currentMonthSpentUsd` lisibles via admin |

(-1) : `console.log` non structuré = non queryable en production (Coolify logs en texte brut).
(-1) : Aucun tracing distribué (pas d'OpenTelemetry, pas de corrélation entre BullMQ job ID et Sentry trace ID).

### **Total : 32/45** (🟡 CONDITIONAL)

---

## Réponses aux 15 questions critiques

| Q | Réponse | Refs |
|---|---|---|
| Q1. Endpoint admin | Server Action `enqueueDirectGen()` appelée depuis `/fr/{adminPrefix}/content-gen` (dashboard) ou `/fr/{adminPrefix}/content-gen/geo/[villeSlug]/generate` | `enqueue.ts:56` |
| Q2. Job BullMQ + payload | Queue `"content-gen"`, jobName `"generate"`, payload `{ contentGenJobId, contentType, targetSearchIntent, inputPayload }` | `enqueue.ts:116`, `orchestrator-worker.ts:287` |
| Q3. Worker + concurrence | `content-gen-worker`, `concurrency: 5` (hardcodé), `limiter: { max: 10, duration: 60_000 }` | `content-gen-worker.ts:549-557` |
| Q4. Sub-jobs enchaînés | Gen → (quality-improving OU approved+publish) → publish → (indexnow + fact-check + qa-extract) | workers respectifs |
| Q5. Reprise après crash | **NON**. `status=running` en DB + job BullMQ en "active" mais process mort = job bloqué pour toujours. BullMQ `lockDuration` default (30s) devrait stale-lock le job mais pas vérifié dans le code. | UNKNOWN |
| Q6. Drafts sauvegardés | **OUI**. `ContentGenJob.outputJsonRaw` = sortie complète du generator persistée avant review. Survit à un crash post-génération. | `content-gen-worker.ts:392` |
| Q7. Étapes pipeline | **20 étapes** identifiées (A→Q en gen-worker + publish pipeline + indexnow). | cf. trace ci-dessus |
| Q8. Latence p50/p95 | **ABSENT — P0**. Seul `duration_ms` global dans `logStep("llm_call")`. Pas de p50/p95 instrumenté ni stocké. | `content-gen-worker.ts:251` |
| Q9. Draft → Published | **Majoritairement manuel** : `approveReview()` (tier-2) ou `promoteToTier1()`. Auto-publish possible si `factoryAutoPublishAllBlogTypes=true` ET `autoPublish=true` dans inputPayload ET score ≥ seuil. | `review.ts`, `content-gen-worker.ts:366-374` |
| Q10. Sitemap regen | **ISR 1h** (`revalidate=3600` implicite) + revalidation immédiate via `revalidateContent(["/sitemap.xml", "/sitemap-index.xml"])` post-publish. | `revalidate-content.ts:24`, `content-publish-worker.ts:326` |
| Q11. IndexNow ping | **Auto sur publish tier-1**. `enqueueIndexingForTier1()` → `contentIndexNowQueue.add("ping")` → `indexnow-worker` → POST `https://api.indexnow.org/indexnow`. | `enqueue.ts:91-119` |
| Q12. ISR Next.js | **OUI** via `revalidateContent()` qui POST `/api/internal/revalidate` avec secret. Paths `/fr/blog/{slug}`, `/sitemap.xml`, `/sitemap-index.xml`, `/fr/actualites` (si isNews). | `revalidate-content.ts:36` |
| Q13. Claude API down | `withRetry(fn, { maxAttempts:3, delays:[10s,30s,60s] })`. Après 3 échecs → `ProviderError` → BullMQ retry (attempts=3, backoff=exp 5s). Total max ~7 minutes. Fallback provider: `anthropic` → si OpenAI down, fallback configuré en `primaryProvider/fallbackProvider` mais la route de fallback est dans `provider-router.ts` (non lu dans cet audit). | `retry.ts:26`, `queues.ts:96` |
| Q14. Backpressure 1000 jobs | `limiter: { max: 10, duration: 60_000 }` sur content-gen-worker = 10 jobs/min max. 1000 jobs ≈ 100 minutes de traitement séquentiel. Anti-burst orchestrateur évite le pic mais si 1000 jobs sont déjà en queue, pas de rejection — ils attendent. | `content-gen-worker.ts:553`, `anti-burst.ts` |
| Q15. Logs structurés | **PARTIEL**. `GenerationLog` (Prisma, append-only, PII-safe) = structured. `console.log/error` = non structuré (texte). Sentry = structuré pour erreurs. Aucun pino/winston. | `generation-log.ts`, `sentry-worker.ts` |

---

## Délégations recommandées

| Agent cible | Périmètre |
|---|---|
| A03 — Providers & LLM | Audit complet `provider-router.ts` (failover OpenAI→Anthropic), circuit breaker `providers/__tests__/circuit-breaker.spec.ts`, cache hit rate prompt caching |
| A04 — Qualité & Scoring | Audit `blog-article.ts` complet, `guide-pilier.ts`, `landing-ville.ts`, précision scores quality/SEO/readability, doctrine-check |
| A05 — DB Schema & Migrations | Audit `ContentGenJob`, `Article`, `ReviewQueue`, `GenerationLog` — index manquants, scale plan |
| A06 — Admin UI | Audit pages `/review-queue`, `/jobs`, `/orchestrator` — UX review flow, BullMQ board présence |
| A07 — Sitemap Deep | Audit complet `sitemap.ts` + `sitemap-index.xml/route.ts` + tous les chunks knowledge — validation scale 5000+ articles |

---

## UNKNOWNs (non tranchés faute de fichiers)

| UNKNOWN | Fichier non lu |
|---|---|
| U1 — Comportement exact du failover OpenAI → Anthropic (provider-router.ts) | `src/server/content-gen/providers/provider-router.ts` |
| U2 — BullMQ lock duration et récupération stale active jobs | Configuration BullMQ avancée non visible dans les workers |
| U3 — Interface admin BullMQ board (présence `/infra` ou `/queue`) | `src/app/[locale]/(admin)/[adminPrefix]/infra/` non lu |
| U4 — Contenu complet du generator `blog-article.ts` (étapes RAG → scores) | Lu partiellement (80 lignes sur ~300) |
| U5 — `revalidate-content.ts` : comportement si REVALIDATE_SECRET absent en prod | Silencieux (no-op) selon le code — mais pas confirmé e2e |
| U6 — DLQ visible admin | Aucune interface admin pour BullMQ failed jobs trouvée dans ce scope |

---

## Références fichiers (chemins absolus)

- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\actions\content-gen\enqueue.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\actions\content-gen\review.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\workers\content-orchestrator-worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\workers\content-gen-worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\workers\content-publish-worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\workers\content-quality-improver-worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\workers\content-indexnow-worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\content-gen\indexing\enqueue.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\content-gen\shared\generation-log.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\content-gen\shared\revalidate-content.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\content-gen\providers\anthropic.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\content-gen\lib\retry.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\queues.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\server\queue\lib\sentry-worker.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\sitemap.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\sitemap-news.xml\route.ts`
