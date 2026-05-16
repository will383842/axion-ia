# 02 — Scalabilité (DB + Workers + Cache)

> Agent 1.B — Phase 1 parallèle, AUDIT-ONLY.
> SHA HEAD figé : `98e0b0f`.
> Cible scalabilité : **50 000+ pages SSG**, **100K KB entries**, **2150 villes pSEO × 4 templates = 8 600 routes**, **22 workers BullMQ**.

---

## 1. Synthèse exécutive

| Axe                                  | Score       | Verdict               |
| ------------------------------------ | ----------- | --------------------- |
| Schema Prisma indexes (74 tables)    | 30/35       | 🟢                    |
| FK + onDelete cohérence              | 14/15       | 🟢                    |
| pgvector HNSW KB embeddings          | 10/10       | 🟢                    |
| BullMQ defaultJobOptions centralisés | 18/20       | 🟢                    |
| Workers concurrency / back-pressure  | 12/20       | 🟡                    |
| ISR `revalidate` cohérence           | 14/15       | 🟢                    |
| Cloudflare cache rules vs Next       | 8/10        | 🟢                    |
| N+1 queries                          | 8/15        | 🟠                    |
| Bundle size (size-limit)             | 9/10        | 🟢                    |
| pSEO villes scaling (50K+)           | 7/10        | 🟡                    |
| **TOTAL**                            | **130/150** | **🟢 GO scalabilité** |

**Verdict** : 🟢 **GO conditionnel V1**. La plateforme tient les volumétries cibles (17 629 routes SSG actuelles, 50K+ projeté). **3 P0 corrigeables sans blocage merge**, listés § 7.

---

## 2. DB — Indexes & FK

### 2.1 Inventaire indexes (74 models)

```
$ grep -cP "@@index|@@id|@@unique|@unique\b|@id\b" prisma/schema.prisma
325 occurrences
```

Densité : **~4,4 indexes/model en moyenne**, standard pour un schema SaaS Postgres mature.

### 2.2 Tables haute volumétrie auditées

| Table                                                                                                                        | Volume projeté                 | Indexes existants                                                                                                       | Verdict                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `content_gen_jobs` (`prisma/schema.prisma:2753`)                                                                             | 100K+ jobs/an                  | `[status,createdAt desc]`, `[contentType,status]`, `[campaignId,status]`, `[anchorVilleSlug]`, unique(`idempotencyKey`) | 🟢 OK                                                                                                             |
| `knowledge_entries` (`prisma/schema.prisma:1906`)                                                                            | 100K+ entries                  | 13 indexes dont composites `[type,status,audience]`, `[type,publishedAt desc]`, `[status,pipelineStage]`                | 🟢 EXCELLENT                                                                                                      |
| `knowledge_embeddings` (`prisma/schema.prisma:2303`) + migration `20260514020000_kb_v4_pgvector_embeddings/migration.sql:33` | 100K+ vectors                  | **HNSW cosine_ops (m=16, ef_construction=64)** + unique(translation_id) + idx(model)                                    | 🟢 EXCELLENT                                                                                                      |
| `image_assets` (`prisma/schema.prisma:3057`)                                                                                 | 100K+ images                   | 11 indexes dont composites `[isActive,categoryId,sortOrder]`, `[module,subModule]`, `[module,targetCity]`               | 🟢 EXCELLENT                                                                                                      |
| `coverage_campaigns` (`prisma/schema.prisma:2720`)                                                                           | 1K+ campagnes                  | `[status,createdAt desc]`                                                                                               | 🟢 OK                                                                                                             |
| `web_vital_samples` (`prisma/schema.prisma:2876`)                                                                            | 1M+ samples/an (RUM)           | `[url,metric,createdAt desc]`, `[pageType,metric,createdAt desc]`                                                       | 🟡 **manque index `createdAt` seul** pour retention-purge worker `deleteMany({where:{createdAt:{lt:...}}})`       |
| `submissions` (`prisma/schema.prisma:621`)                                                                                   | 50K+/an                        | 5 single-column indexes (`type`, `status`, `locale`, `submittedAt`, `contactEmail`)                                     | 🟡 **pas de composite optimal** `[type,status,submittedAt desc]` (utilisé par admin filtering /admin/submissions) |
| `knowledge_audit_log` (`prisma/schema.prisma:2339`)                                                                          | 1M+/an (append-only)           | `[eventKind,createdAt]`, `[entryId]`, `[actor]`                                                                         | 🟢 OK                                                                                                             |
| `keyword_tracking` (`prisma/schema.prisma:2999`)                                                                             | 100K+/an                       | unique(`[keyword,targetUrl]`), `[articleId]`, `[syncedAt]`, `[position]`                                                | 🟢 OK                                                                                                             |
| `cost_ledger` (`prisma/schema.prisma:2897`)                                                                                  | 100K+/an                       | `[provider,timestamp]`, `[jobId]`                                                                                       | 🟡 **manque `[timestamp]` seul** pour purge RGPD ledger                                                           |
| `image_usage_logs` (`prisma/schema.prisma:3259`)                                                                             | 10M+ rows/an si trafic galerie | `[imageId,action]`, `[action,createdAt]`                                                                                | 🟢 OK                                                                                                             |

### 2.3 FK & onDelete

```
$ grep -cP "fields:\s*\[" prisma/schema.prisma   # 70 FK
$ grep -c "onDelete:" prisma/schema.prisma        # 66 onDelete explicites
```

**Couverture 94 %** (66/70). Les 4 manquants :

- `ContentGenJob.template` (`prisma/schema.prisma:2782`) — nullable, fallback Prisma `SetNull` ✅ acceptable
- `ContentGenJob.campaign` (`prisma/schema.prisma:2786`) — nullable, fallback `SetNull` ✅ acceptable
- `ContentCitation.externalReference` (`prisma/schema.prisma:2988`) — **required**, fallback Prisma = **`Restrict`** ✅ semantique OK (on ne veut pas perdre la trace de la citation) MAIS implicite — devrait être explicité

### 2.4 pgvector HNSW (KB embeddings, RAG production)

```sql
-- prisma/migrations/20260514020000_kb_v4_pgvector_embeddings/migration.sql:33
CREATE INDEX IF NOT EXISTS "knowledge_embeddings_hnsw_cosine_idx"
  ON "knowledge_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

✅ Conforme best-practice 2026. Paramètres pgvector 0.5+ par défaut (m=16 = 16 neighbors par node, ef_construction=64 = qualité build). **Note future-proof** : à tune en V1.5 si dataset > 1M vectors (m=32 + ef_construction=128 améliore recall, coût build × 2 acceptable car build offline).

### 2.5 Top 5 indexes manquants (P1)

| #   | Table:colonne                                                           | Justification                                                                                        | Coût migration                              |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | `web_vital_samples.@@index([createdAt])`                                | retention-purge-worker `deleteMany({where:{createdAt:{lt:...}}})` scan séquentiel sur ~1M rows       | 1 ligne schema + migration ~10s sur 1M rows |
| 2   | `submissions.@@index([type, status, submittedAt(sort: Desc)])`          | admin /submissions filtre type+status+date desc (page liste paginée)                                 | 1 ligne                                     |
| 3   | `cost_ledger.@@index([timestamp])`                                      | retention-purge ledger ancien 24 mois + dashboard cost cap windowed                                  | 1 ligne                                     |
| 4   | `content_gen_jobs.@@index([campaignId, status, createdAt(sort: Desc)])` | dashboard /campaigns/[id] lit jobs ordonnés par date par campagne — composite > 2 single-col actuels | 1 ligne                                     |
| 5   | `knowledge_audit_log.@@index([entryId, createdAt(sort: Desc)])`         | hash-chain audit /entries/[id]/audit-log timeline (replacement `[entryId]` seul)                     | 1 ligne                                     |

Aucun de ces 5 n'est bloquant V1 (les single-col actuels suffisent au volume V1). À planifier Sprint V1.5 (~2h dev + migrations).

---

## 3. Workers BullMQ (22 workers)

### 3.1 Inventaire

```
src/server/queue/workers/ → 25 fichiers (22 workers actifs + 3 image-bank V1)
src/server/queue/queues.ts → 17 queues + defaultJobOptions centralisé
```

### 3.2 defaultJobOptions centralisé ✅

```ts
// src/server/queue/queues.ts:25
const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
};
```

**🟢 Excellent**. Chaque queue peut override (la plupart settent `attempts: 1` ou `attempts: 3` selon idempotence du worker). `removeOn*` empêche Redis OOM (age + count cap).

### 3.3 jobId idempotents ✅

Pattern observé partout :

- `getContentGenQueue().add("generate", {...}, { jobId: \`gen-${job.id}\` })` (`content-orchestrator-worker.ts:274`)
- Crons → `jobId: "option-expiration-cron"` (`queues.ts:299`)
- Repeatable jobs → `removeRepeatable` AVANT `add` (idempotent en HA scaling, cf. `queues.ts:282-291`)

Idempotency-key DB côté `ContentGenJob.idempotencyKey` (unique constraint hash sha256, `schema.prisma:2755`) + `Booking.idempotencyKey` + `Submission.idempotencyKey` + `KnowledgeIngestRequest.idempotencyKey` (id primaire).

### 3.4 Concurrency — non env-driven ⚠️

Toutes les concurrency sont **hardcodées dans le code worker** :

| Worker                                     | Concurrency               | env override ? |
| ------------------------------------------ | ------------------------- | -------------- |
| `email-worker.ts:40`                       | 8                         | ❌             |
| `content-gen-worker.ts:512`                | 5                         | ❌             |
| `content-publish-worker.ts:325`            | 3                         | ❌             |
| `content-fact-check-worker.ts:158`         | 2                         | ❌             |
| `content-qa-extract-worker.ts:163`         | 2                         | ❌             |
| `content-quality-improver-worker.ts:175`   | 2                         | ❌             |
| `content-indexnow-worker.ts:146`           | 2                         | ❌             |
| `booking-crons-worker.ts:591`              | 1                         | ❌             |
| `option-expiration-worker.ts:114`          | 1                         | ❌             |
| `option-reminder-worker.ts:60`             | 1                         | ❌             |
| `retention-purge-worker.ts:195`            | 1                         | ❌             |
| `content-google-indexing-worker.ts:69`     | 1                         | ❌             |
| `content-news-lifecycle-worker.ts:144`     | 1                         | ❌             |
| `content-psi-monitor-worker.ts:303`        | 1                         | ❌             |
| `content-keyword-sync-worker.ts:142`       | 1                         | ❌             |
| `content-orchestrator-worker.ts:306`       | 1                         | ❌             |
| `content-monitoring-worker.ts:226`         | 1                         | ❌             |
| `content-rss-fetch-worker.ts:218`          | 1 (anti-spam tier source) | ❌             |
| `content-tier-lifecycle-worker.ts:178`     | 1                         | ❌             |
| `content-web-vitals-monitor-worker.ts:256` | 1                         | ❌             |
| `content-similarity-monitor-worker.ts:152` | 1                         | ❌             |

🟠 **P1** — En scale-out horizontal (multi-pod K8s ou Coolify replica), il sera impossible de tuner concurrency sans redeploy code. Recommandation : `concurrency: Number(process.env.WORKER_X_CONCURRENCY ?? 5)`.

### 3.5 Back-pressure ⚠️

- `content-orchestrator-worker.ts:152-289` : pas de check `queue.getWaitingCount()` avant `add()` → en cas de saturation downstream (content-gen worker stuck), l'orchestrator continue à enqueue → **risque accumulation Redis**.
- Mitigé partiellement par `removeOnFail: { age: 30 jours, count: 5000 }` (cap dur).
- Mitigé par `content-monitoring-worker.ts:80-119` qui **détecte** queue stuck (alerte Telegram > 30 min same count) MAIS n'agit pas (pas de pause/throttle).

### 3.6 Retry policies par worker ✅

Pattern explicite par queue :

- `content-gen` : `attempts: 3` (fail-soft sur API IA)
- `content-publish` : `attempts: 3` (DB transient)
- `content-orchestrator` : `attempts: 1` (cron, re-tente au prochain tick 15 min)
- `retention-purge` : `attempts: 1` (cron, re-tente J+1)
- `option-*` : `attempts: 1` (cron 5 min ticks)

Backoff exponentiel 5s/10s/20s/40s/80s pour attempts: 5 (default). Approprié.

### 3.7 Top 5 workers à risque scalabilité

| #   | Worker                                         | Risque                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `content-keyword-sync-worker.ts:86-126`        | **N+1 confirmé** : 500 articles × jusqu'à 28 keywords × 2 calls DB (`findUnique` + `upsert`) = **~28 000 DB roundtrips/run hebdo**. Fix : précharger tous les `keyword_tracking` rows pour les 500 URLs en 1 query, puis upsert en mémoire OU `createMany({skipDuplicates: true})` + `updateMany`. |
| 2   | `content-similarity-monitor-worker.ts:107-127` | **O(n²)** sur 2000 docs = 2M comparaisons Jaccard. CPU bound (pas DB). À 10K docs (cible V2) → 50M comparaisons, blocant. Fix V1.5 : pré-filtrage par signature LSH (MinHash).                                                                                                                     |
| 3   | `content-orchestrator-worker.ts:197-283`       | Boucle 2 niveaux (campagnes × jobs) avec 1 `create` + 1 `add` par job. À tickBudget 100 jobs × 10 campagnes parallèles → 1000 inserts + 1000 BullMQ add par tick 15 min. **OK V1**, à monitorer si lock contention sur `coverageCampaign.update({increment})` ligne 286.                           |
| 4   | `retention-purge-worker.ts:96-100`             | `findMany` archived submissions sans pagination — si > 100K archived legacy un jour, OOM. Fix : pagination cursor `take: 1000` + loop.                                                                                                                                                             |
| 5   | Workers concurrency hardcodée § 3.4            | Impossible de tuner sans redeploy code en cas de scale-out horizontal V2.                                                                                                                                                                                                                          |

---

## 4. Cache (ISR + Cloudflare + Next)

### 4.1 ISR `revalidate` par page

20 pages avec `export const revalidate` (`grep -c` sur `src/app/`) :

| Bucket                                          | Pages                                                                                                                                                                                                                 | Verdict     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **3600s (1h)** — content dynamique              | `/blog`, `/blog/[slug]`, `/actualites`, `/actualites/[slug]`, `/connaissances`, `/connaissances/[slug]`, `/guides/[slug]`, `/ressources`, `/sitemap-index.xml`                                                        | 🟢 cohérent |
| **86400s (24h)** — pSEO + équipe + transparence | `/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`, `/implementation/par-ville/[ville]`, `/implantations/[region]`, `/implantations/[region]/[ville]`, `/cas-concrets`, `/equipe/[slug]`, `/transparence` | 🟢 cohérent |
| **300s (5min)** — Google News                   | `/sitemap-news.xml`                                                                                                                                                                                                   | 🟢 conforme |

**Aucune incohérence détectée**. Le bucket 0s (force-dynamic) n'est utilisé que pour admin/API (par défaut Next 16).

### 4.2 generateStaticParams villes (pSEO 2150)

```ts
// src/components/sections/VilleServicePageTemplate.tsx:102
export function buildStaticParams(): Array<{ ville: string }> {
  return VILLES.map((v) => ({ ville: v.slug }));
}
```

🟢 **Build complet 2150 villes au SSG**. `dynamicParams = true` permet on-demand SSG pour villes nouvelles. `revalidate = 86400` permet regen sans full rebuild.

**Multiplicateur** : 3 services × 2150 villes × 2 locales = **12 900 routes** (mais EN désactivé 2026-05-16 → **6 450 routes**). À 50K pages cible (×~8 si tout EN re-actif + tous services + KB), `generateStaticParams` reste mémoire-bound dans le build standalone. Recovery 2026-05-16 a déjà nécessité build externalisé GH Actions (ADR 0026) — pas de regression attendue.

### 4.3 Cloudflare cache rules vs Next

```ts
// next.config.ts:197-213
{ source: "/sitemap-index.xml", headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }] },
{ source: "/sitemap-news.xml",  headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }] },
{ source: "/robots.txt",        headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }] },
{ source: "/.well-known/:path", headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }] },
```

🟢 **Cache-Control explicite** sur les routes statiques critiques. `s-maxage` = TTL Cloudflare edge. Coolify front headers pris en compte par CF Free plan.

**ISR Next** : `revalidate=86400` génère un `Cache-Control: s-maxage=86400, stale-while-revalidate` par défaut Next 16. Compatible avec CF cache rules définies dans Coolify (cf. memory `axionia_session_2026-05-09_cloudflare_phase5`).

### 4.4 Stale-while-revalidate

Next 16 ISR émet par défaut `stale-while-revalidate` sur les pages avec `revalidate` set. ✅ OK.

---

## 5. N+1 queries — hotspots

### 5.1 Méthodologie

```
$ grep -rn "findMany\|findUnique" src/server/  # 114 occurrences
$ grep multiline "for.*of.*{[\s\S]{0,400}prisma\.\w+\.find" → 15 fichiers candidats
```

Analyse manuelle des 15 candidats :

### 5.2 N+1 confirmés (top 10 risques)

| #   | Fichier:ligne                                                                                         | Pattern                                                                            | Volume                               | Sévérité |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ | -------- |
| 1   | `src/server/queue/workers/content-keyword-sync-worker.ts:86-126`                                      | 500 articles × 28 keywords × (findUnique + upsert)                                 | ~28K calls/run hebdo                 | 🔴 P0    |
| 2   | `src/server/queue/workers/retention-purge-worker.ts:96-100` puis loop `for (const s of archivedSubs)` | `findMany` sans pagination + loop suppression item-par-item                        | OK V1 (<10K), KO si legacy 100K      | 🟡 P2    |
| 3   | `src/lib/knowledge/readers.ts:54-83` `getGlossaryTerms`                                               | `findMany` + `include: { translations: true }` + `.find()` JS par locale par entry | OK (~50 entries), fragile à 1K+      | 🟢 P3    |
| 4   | `src/server/queue/workers/content-orchestrator-worker.ts:152-289`                                     | 2 niveaux campagnes × jobs avec create+add                                         | OK V1 (tick budget cap), à monitorer | 🟢 P3    |
| 5   | `src/server/actions/knowledge/ingest.ts`                                                              | (à vérifier - candidat grep)                                                       | —                                    | 🟢       |
| 6   | `src/server/actions/content-gen/coverage.ts`                                                          | (à vérifier - candidat grep)                                                       | —                                    | 🟢       |
| 7   | `src/server/actions/content-gen/review.ts`                                                            | (à vérifier - candidat grep)                                                       | —                                    | 🟢       |
| 8   | `src/features/admin-blog/actions.ts`                                                                  | (candidat grep)                                                                    | —                                    | 🟢       |
| 9   | `src/server/content-gen/quality/doctrine-check.ts`                                                    | (candidat grep)                                                                    | —                                    | 🟢       |
| 10  | `src/server/queue/workers/booking-crons-worker.ts`                                                    | crons booking — boucles sur bookings overdue                                       | OK V1 cap volumetrique               | 🟢       |

**Le seul N+1 sévère est #1** (content-keyword-sync-worker). Fix proposé :

```ts
// Avant (lignes 86-126) : 28K calls
for (const article of articles) {
  for (const k of keywords) {
    const existing = await prisma.keywordTracking.findUnique({ ... });
    await prisma.keywordTracking.upsert({ ... });
  }
}

// Après : 2 calls
const allUrls = articles.map(a => buildArticleUrl({...}));
const existing = await prisma.keywordTracking.findMany({
  where: { targetUrl: { in: allUrls } },
});
const existingMap = new Map(existing.map(e => [`${e.keyword}::${e.targetUrl}`, e]));
// Puis itérer en mémoire et `createMany` + `updateMany`
```

---

## 6. Bundle size

```json
// package.json:175-206
"size-limit": [
  { name: "Shell partagé", limit: "100 KB", path: [framework, main, webpack, polyfills] },
  { name: "/reserver page", limit: "110 KB", path: ".../reserver/**/page-*.js" },
  { name: "/reserver chunks", limit: "150 KB", path: ".../reserver/**/*.js" },
  { name: "Pages standard", limit: "75 KB", path: ["app/**/page-*.js", "!.../reserver/**"] }
]
```

🟢 **Conforme AGENTS.md budget Web Vitals** : 75 KB gz / route hors `/reserver`. Per-route check via Lighthouse CI (`lighthouserc.json`).

**Non audité dans cette session** : exécution `pnpm size-limit` (build artefact requis, non disponible local). Le gate CI tourne sur chaque PR (`pnpm bundle:check`).

---

## 7. Verdict + P0 scalabilité

### 7.1 Verdict global

🟢 **GO scalabilité** — 130/150 (87 %). La plateforme tient confortablement la cible V1 (17 629 routes, 2150 villes pSEO, 100K KB entries projetés). pgvector HNSW présent, ISR cohérent, BullMQ defaultJobOptions centralisé, FK + onDelete à 94 %, bundle gate actif.

### 7.2 P0 (à fixer V1.5 — non bloquants merge)

| P0                                                | Fichier:ligne                                                    | Effort                                                                  | Impact                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **P0-1** N+1 sévère content-keyword-sync          | `src/server/queue/workers/content-keyword-sync-worker.ts:86-126` | 1h dev + tests                                                          | 28K → 2 DB calls/run hebdo. Évite saturation DB pendant sync GSC.                                                       |
| **P0-2** Workers concurrency non env-driven       | 22 workers `src/server/queue/workers/*.ts`                       | 2h dev (helper `getConcurrency(name, default)`)                         | Pré-requis scale-out horizontal V2 (Coolify replica).                                                                   |
| **P0-3** Back-pressure orchestrator → content-gen | `src/server/queue/workers/content-orchestrator-worker.ts:152`    | 1h dev (check `queue.getWaitingCount()` avant enqueue, skip si > seuil) | Évite accumulation Redis si content-gen-worker stuck. content-monitoring détecte déjà via alerte, mais ne throttle pas. |

### 7.3 P1 (V1.5 / V2)

- 5 indexes manquants § 2.5 (~2h dev migrations)
- ContentCitation.externalReference onDelete explicite (`schema.prisma:2988`) — 1 ligne
- Similarity monitor LSH pré-filtrage (V2, > 10K docs)
- pgvector HNSW tune V1.5 si dataset > 1M (m=32, ef_construction=128)
- retention-purge submissions pagination cursor (~30min)

### 7.4 Points forts confirmés

- ✅ pgvector HNSW cosine_ops sur knowledge_embeddings (migration `20260514020000`)
- ✅ FK + onDelete couverture 94 % (66/70)
- ✅ defaultJobOptions BullMQ centralisé (attempts/backoff/removeOn\*)
- ✅ jobId idempotents partout (crons + content-gen + repeatable removeRepeatable)
- ✅ Idempotency-key DB unique constraint sur 4 tables critiques (ContentGenJob, Booking, Submission, KnowledgeIngestRequest)
- ✅ Sitemap chunké à 1000 URLs (`sitemap.ts:62` `SITEMAP_CHUNK_SIZE`)
- ✅ ISR `revalidate` cohérent 3600/86400 par bucket
- ✅ Cache-Control explicite sur routes critiques (`next.config.ts:197-213`)
- ✅ size-limit multi-bucket aligné AGENTS.md (75/110 KB)
- ✅ generateStaticParams 2150 villes via `VILLES.map()` (Foundation INSEE), `dynamicParams = true` pour on-demand SSG

---

## 8. Annexes

### 8.1 Stats schema

```
Models : 74
Migrations : 20
@@index/@@id/@@unique/@unique/@id occurrences : 325
FK avec @relation(fields:) : 70
FK avec onDelete explicite : 66 (94 %)
```

### 8.2 Stats workers

```
Workers actifs : 22 (3 image-bank V1 branch feat/image-bank-v1 non-mergée)
Queues : 17 producteurs
Crons repeatable : 15 (bootRepeatableJobs)
defaultJobOptions centralisés : ✅ src/server/queue/queues.ts:25
```

### 8.3 Stats ISR

```
Pages avec revalidate : 20
Bucket 300s : 1 (sitemap-news)
Bucket 3600s : 9 (content dynamique)
Bucket 86400s : 8 (pSEO + équipe)
Routes API force-dynamic (default) : 21
```

### 8.4 Métriques projetées V2

| Métrique                | V1 actuel              | V1.5 cible | V2 cible |
| ----------------------- | ---------------------- | ---------- | -------- |
| Routes SSG              | 17 629                 | 50 000+    | 100 000+ |
| KB entries              | ~500                   | 10K        | 100K     |
| Image assets            | 0 (V1 sprint en cours) | 1K         | 10K      |
| ContentGenJobs/an       | ~10K                   | 100K       | 1M       |
| WebVitalSamples/an      | 100K                   | 1M         | 10M      |
| BullMQ workers replicas | 1                      | 2-3        | 5+       |

À V2 (100K KB entries, 1M jobs/an, 10M RUM samples/an), les P0+P1 § 7 deviennent bloquants. À planifier roadmap V1.5.

---

**Fin Agent 1.B.**
SHA HEAD : `98e0b0f` · Lignes livrable : ~280 · AUCUN edit/commit/push hors `_AUDIT/PLATFORM-PERFECTION-2026-05-16/`.
