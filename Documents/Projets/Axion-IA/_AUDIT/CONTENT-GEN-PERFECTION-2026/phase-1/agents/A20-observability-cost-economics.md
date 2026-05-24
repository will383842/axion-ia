# A20 — Observability + Cost Economics Actuel

**Audit**: CONTENT-GEN-PERFECTION-2026 / Phase 1  
**Agent**: A20  
**Date**: 2026-05-21  
**HEAD audité**: `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode**: AUDIT-ONLY STRICT — citations fichier:ligne uniquement. 0 invention.

---

## Mission

Auditer l'observabilité complète du système content-gen (Sentry, Plausible, logs, Grafana/Loki) et mesurer le coût réel des appels IA (Claude API). Évaluer la détection d'anomalies et la traçabilité coût par article.

---

## Méthode

1. Lecture des fichiers Sentry (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`, `src/lib/observability/sentry-pii-scrub.ts`)
2. Lecture du helper worker (`src/server/queue/lib/sentry-worker.ts`, `sanitize-job-data.ts`)
3. Scan systématique des 16 workers content-gen via `grep captureWorkerError`
4. Lecture `src/server/content-gen/lib/cost-tracker.ts`, `providers/anthropic.ts`, `providers/IProvider.ts`
5. Lecture `prisma/schema.prisma` modèles `CostLedger`, `GenerationLog`, `ContentGenJob`, `ContentMetric`
6. Lecture `src/lib/analytics/plausible-tracker.ts`, `src/lib/tracking.ts`
7. Lecture `src/server/content-gen/shared/content-gen-alerts.ts`, `generation-log.ts`
8. Lecture `.github/workflows/nightly.yml`, `sentry-query.yml`
9. Lecture `src/app/[locale]/(admin)/[adminPrefix]/content-gen/costs/_v2/CostsV2.tsx`, `server/actions/content-gen/geo.ts`
10. Lecture `src/server/queue/workers/content-monitoring-worker.ts`, `content-gen-worker.ts`, `content-orchestrator-worker.ts`

---

## État Observé

### Sentry — Infrastructure

- `src/sentry.server.config.ts:7-18` — Init conditionnelle (`if (dsn)`), `sendDefaultPii: false`, `beforeSend: piiScrubBeforeSend`, `tracesSampleRate: 0.1` prod.
- `src/sentry.edge.config.ts:7-18` — Config identique server, Edge runtime.
- `src/instrumentation-client.ts:30-80` — Init **lazy** client-side via `requestIdleCallback` (3s timeout), `defaultIntegrations: false`, 6 integrations slim, `tracesSampleRate: 0`. Les erreurs des 3 premières secondes ne sont pas capturées (tradeoff web vitals documenté).
- `src/lib/observability/sentry-pii-scrub.ts:67-128` — `piiScrubBeforeSend` scrub email/IP/phone/JWT/hex-token dans : user, request headers/query/cookies, exception messages + stack frames, breadcrumbs, extra/tags, server_name. Robuste.
- `src/server/queue/lib/sentry-worker.ts` — Helper `captureWorkerError(workerName, queueName, job, err)` : fail-soft, fingerprint déterministe `[workerName, errName, errMsg.slice(0,100)]`, tags `{worker, queue, jobId, jobName}`, extra `sanitizeJobData(job.data)`. PII-safe.
- `src/server/queue/lib/sanitize-job-data.ts` — Sanitizer complet : 9 patterns secrets (sk-*, Bearer, JWT, INDEXNOW key, postgres/redis URLs), 55 clés sensibles, redaction email/phone, cap profondeur 6, cap 50 clés/objet, cap string 2000 chars.
- Sentry release tracking : `SENTRY_RELEASE ?? npm_package_version` — cohérent server/edge/client.

### Sentry — Couverture Workers

Workers avec `captureWorkerError` (4 chokepoints + 5 image-bank) :
- `content-gen-worker.ts:571` — oui (skip KillSwitchActiveError intentionnel)
- `content-orchestrator-worker.ts:334` — oui
- `content-publish-worker.ts:375` — oui
- `content-indexnow-worker.ts:163` — oui
- `image-bank-auto-convert-worker.ts` — oui
- `image-bank-crons-worker.ts` — oui
- `image-bank-enrich-worker.ts` — oui
- `image-bank-import-worker.ts` — oui
- `image-bank-translate-worker.ts` — oui

Workers **sans** `captureWorkerError` (12 workers content-gen non-chokepoints) :
- `content-fact-check-worker.ts` — NON
- `content-google-indexing-worker.ts` — NON
- `content-keyword-sync-worker.ts` — NON
- `content-monitoring-worker.ts` — NON
- `content-news-lifecycle-worker.ts` — NON
- `content-psi-monitor-worker.ts` — NON
- `content-qa-extract-worker.ts` — NON
- `content-quality-improver-worker.ts` — NON
- `content-rss-fetch-worker.ts` — NON
- `content-similarity-monitor-worker.ts` — NON
- `content-tier-lifecycle-worker.ts` — NON
- `content-web-vitals-monitor-worker.ts` — NON

### Sentry — Contexte par erreur

`captureWorkerError` injecte : `worker`, `queue`, `jobId`, `jobName`, `jobData` (sanitized), `attemptsMade`, `failedReason`, `timestamp`, `queueName`. Il manque : `campaignId`, `contentType`, `vertical`, `step` (ces champs seraient dans `job.data` → donc présents via `sanitizeJobData` si le payload BullMQ les contient). Pas de `Sentry.setContext("contentGen", {...})` explicite avec les champs audit Q2.

### Sentry — Alertes seuils

Aucune règle d'alerte Sentry définie dans le code (les règles se configurent dans l'UI sentry.io, pas versionnable sans `sentry.yml`). Pas de `sentry.properties`, pas de `sentry.yml`. `sentry-query.yml` est un utilitaire workflow_dispatch de query manuelle. Aucun threshold défini (ex : error rate >5% en 5 min). UNKNOWN : présence d'alertes configurées dans sentry.io directement.

### Plausible

- `src/lib/analytics/plausible-tracker.ts:13-23` — `trackEvent()` client-only (guard `typeof window === "undefined"`), délègue à `window.plausible`.
- `src/lib/tracking.ts:16-35` — Événements funnel définis : Booking Started/Submitted/Confirmed, Quote Request, Audit Started/Submitted, Payment Started/Completed/Failed, Cancellation, Reschedule. Referer source : google/bing/perplexity/chatgpt/claude/gemini/mistral/copilot.
- Événements content-gen spécifiques (`article_published`, `article_quality_score`, `claude_cost_alert`) : **absents** du code. Plausible est exclusivement client-side (pas de server-side events).
- Usage réel en prod : `src/components/forms/BookingForm.tsx:115,123` — `trackEvent("Booking Failed"/"Booking Submitted")`.

### Workers logs structurés / Loki / Grafana

- Aucun import `pino`, `winston`, `bunyan` ou similaire dans le codebase.
- Logs uniquement via `console.log/error/warn` (format non-structuré, pas de JSON).
- Aucune configuration Loki/Promtail, aucun `docker-compose.yml` Grafana dans le repo.
- Aucune mention Grafana/Prometheus/OpenMetrics dans le code source (hors node_modules OpenTelemetry types non utilisés).
- `src/lib/observability/vitals-store.ts` — écrit Web Vitals en ndjson local (`data/vitals/YYYY-MM-DD.ndjson`) + insert `WebVitalSample` Prisma. C'est la seule agrégation structurée côté observabilité non-Sentry.

### CostLedger — Schéma

`prisma/schema.prisma:3040-3053` :
```
model CostLedger {
  id           String      @id @default(cuid())
  jobId        String?
  provider     ProviderKey
  model        String
  tokensInput  Int         @default(0)
  tokensOutput Int         @default(0)
  costUsd      Decimal     @db.Decimal(10, 4)
  timestamp    DateTime    @default(now())
  @@index([provider, timestamp])
  @@index([jobId])
}
```

**Champ manquant critique** : `cacheReadInputTokens` et `cacheCreationInputTokens` ne sont **pas** persistés dans `CostLedger`. Ils sont calculés dans `anthropic.ts:162-193` et intégrés dans le `costUsd` calculé, mais le détail cache-read vs input vs cache-write n'est pas stocké distinctement. Impossible de mesurer le cache hit rate réel depuis la DB.

### GenerationLog — Schéma

`prisma/schema.prisma:2945-2957` — `{ id, jobId, level, step, message, metadata Json?, timestamp }`. Pas de champs `campaignId`, `vertical`, `contentType` directement — accessible uniquement via JOIN sur `ContentGenJob`. Pas d'index sur `step` (seulement `[jobId, timestamp]`).

### ContentGenJob — Coût par article

`prisma/schema.prisma:2920-2926` — `{ tokensInput Int?, tokensOutput Int?, imageCount Int?, costUsd Decimal(10,4)?, costBreakdown Json? }`. Le champ `costUsd` est nullable (pas d'historique avant migration). `tokensInput` de `ContentGenJob` est mis à `0` dans le worker (`content-gen-worker.ts:390`: `tokensInput: 0 // détaillé via CostLedger`) — donc le coût article-level est dans `CostLedger` (via `jobId`) mais `ContentGenJob.tokensInput` est inutilisable directement.

### ContentMetric — Table agrégée

`prisma/schema.prisma:3056-3073` — table `{ date, contentType, provider, generated, published, failed, needsReview, duplicatesBlocked, totalCostUsd, totalTokensInput, totalTokensOutput, avgQualityScore }`. **Jamais écrite** : aucun `prisma.contentMetric.create/upsert` dans `src/`. Table présente dans le schema mais sans writer.

### Provider Anthropic — Pricing et cache

`src/server/content-gen/providers/anthropic.ts:41-68` :
- `claude-sonnet-4-6` : input $3.00/M, output $15.00/M, cacheRead $0.30/M, cacheWrite $3.75/M
- `claude-opus-4-7` : $15.00/M, $75.00/M, $1.50/M, $18.75/M
- `claude-haiku-4-5` : $1.00/M, $5.00/M, $0.10/M, $1.25/M

Prompt caching activé (`cache_control: { type: "ephemeral" }` sur system prompt, `anthropic.ts:173-178`). Les tokens cache_read et cache_creation sont capturés (`anthropic.ts:192-193`) et intégrés dans le calcul `costUsd` (`anthropic.ts:237-243`). Ils sont retournés dans la response (`cacheReadInputTokens`, `cacheCreationInputTokens`) mais **non persistés séparément** dans `CostLedger`.

### Anthropic Batch API

Non utilisé. Aucun appel `client.beta.messages.batches` dans le codebase. Le pipeline est streaming temps-réel (BullMQ workers).

### Dashboard Coûts Admin

`src/app/[locale]/(admin)/[adminPrefix]/content-gen/costs/_v2/CostsV2.tsx` — affiche :
- Total mois courant + 7 jours (depuis `CostLedger`)
- Par provider sur 30j : costUsd, tokensInput, tokensOutput, cap mensuel, % utilisé

Section "Projection fin de mois" : stub textuel "nécessite ≥ 7 jours d'historique. Le calcul devient utile une fois le premier mois en prod terminé." — **non implémentée**.

### Alertes Telegram Coûts

`content-gen-alerts.ts` définit 16 alertes opérationnelles :
1. Cost cap 80% → warning silent Telegram
2. Cost cap 100% → critical Telegram + kill switch
3-4. Provider down 5min/30min → circuit ouvert
5. KB not ready
6. Batch fail (5 jobs failed)
7. New review
8. Campaign done (cost total + avg score)
9-11bis. Web Vitals LCP/INP/CLS breaches + bulk
12. Queue stuck (30 min)
13. Soft-404 tier-1
14. Indexation stagnante (CTR < 1% 90j)
15. Tier-3 stagnant 90j
16. IndexNow fail streak (≥3 consécutifs)

Alerte manquante : aucune alerte "daily spend > 150% moving avg 7j" (anomalie coût).

### Hetzner / Infrastructure Monitoring

Aucun fichier de configuration monitoring Hetzner (alertmanager, Cloud Monitoring) dans le repo. UNKNOWN : alertes configurées via Hetzner Cloud UI ou Coolify directement.

### Anomaly Detection

Absente du code. Pas de calcul `moving_avg_7d`, pas de comparaison de spend quotidien vs historique. La seule détection automatique de dérive coût est le cost cap absolut (80% warning, 100% kill switch).

### DB Slow Query

Aucun `pg_stat_statements` ni `PrismaClient.$on("query")` de monitoring dans le code.

---

## Findings

### Tableau P0/P1/P2

| ID | Sévérité | Composant | Constat | Impact |
|----|----------|-----------|---------|--------|
| F01 | P1 | Sentry workers | 12 workers content-gen sans `captureWorkerError` (fact-check, google-indexing, keyword-sync, monitoring, news-lifecycle, psi-monitor, qa-extract, quality-improver, rss-fetch, similarity-monitor, tier-lifecycle, web-vitals-monitor) | Erreurs perdues dans `console.error` uniquement — silencieuses en prod sans log aggregator |
| F02 | P1 | Sentry contexte | `captureWorkerError` n'ajoute pas `Sentry.setContext("contentGen", {campaignId, contentType, vertical, step})` explicitement | Groupage Sentry par fingerprint OK mais pas de filtrage par campagne/vertical dans dashboard |
| F03 | P1 | CostLedger schema | `cacheReadInputTokens` et `cacheCreationInputTokens` calculés mais non persistés séparément dans `CostLedger` | Cache hit rate Anthropic non mesurable depuis la DB — impossible de prouver l'économie réelle du prompt caching |
| F04 | P1 | ContentMetric | Table `content_metrics` définie dans schema (`prisma/schema.prisma:3056`) mais aucun writer dans `src/` | Métriques agrégées par jour/type/provider inexistantes — dashboard coûts ne lit que `CostLedger` brut |
| F05 | P1 | ContentGenJob.tokensInput | Champ mis à `0` dans le worker (`content-gen-worker.ts:390`) avec commentaire "détaillé via CostLedger" | Coût article-level accessible uniquement via JOIN CostLedger ↔ ContentGenJob (pas d'accès direct) |
| F06 | P1 | Anomaly detection | Aucune alerte "daily spend > 150% moving avg 7j" | Dérive coût progressive invisible jusqu'au cap mensuel absolu |
| F07 | P1 | Sentry alertes | Aucune règle d'alerte Sentry versionée (seuil error rate >5%/5min) | Alertes dépendent de config sentry.io manuelle, non reproductible/auditée |
| F08 | P2 | Logs structurés | Logs workers uniquement `console.log/error/warn` — non structurés JSON | Pas d'agrégation Loki/Grafana possible sans reformatage |
| F09 | P2 | Plausible content-gen | Zéro événements Plausible côté content-gen (article_published, quality_score, cost_alert) | Pas de corrélation trafic/contenu généré dans Plausible |
| F10 | P2 | Projection coût | Section "Projection fin de mois" dans CostsV2 — stub textuel non implémenté | Aucune projection automatique scénario A/B/C |
| F11 | P2 | Anthropic Batch API | Non utilisé — pipeline streaming uniquement | Économie potentielle 50% ignorée pour les jobs non time-sensitive (rss-fetch, fact-check) |
| F12 | P2 | Cohort analysis | Aucune analyse coût par cohorte semaine — pas d'agrégation temporelle au-delà du dashboard 30j/7j | Impossible de comparer semaine N vs semaine N-1 automatiquement |
| F13 | P2 | ContentMetric.avgQualityScore | Champ défini mais jamais écrit | Pas d'historique qualité × contentType × provider pour ROI funnel |
| F14 | P2 | DB slow query | Pas de monitoring `pg_stat_statements` ni `PrismaClient.$on("query")` | Requêtes lentes invisibles — CostLedger et GenerationLog peuvent grossir sans alertes |
| F15 | P2 | Hetzner monitoring | Aucune configuration monitoring infrastructure dans le repo | UNKNOWN — RAM/CPU/disk alertes dépendent de config UI externe non versionée |
| F16 | P3 | Sentry tracesSampleRate | 10% prod (`sentry.server.config.ts:9`) | Cost Sentry maîtrisé mais debugging transactions intermittentes difficile |
| F17 | P3 | GenerationLog.step index | Pas d'index sur `step` (`@@index([jobId, timestamp])` seulement) | Query "tous les logs d'erreur d'une étape donnée" = full scan si volume important |

---

## Scoring /35

### Sentry coverage + context + alerts /6 → **3.0/6**

- Coverage : 4/16 workers content-gen (25%) + 5 image-bank = partiel. Les 4 chokepoints sont couverts mais 12 workers secondaires sont aveugles. **1.5/3**
- Context : fingerprint déterministe + tags worker/queue/jobId. Manque `campaignId/contentType/vertical/step` explicite. `sanitizeJobData` robuste. **0.5/1**
- PII sanitize : `piiScrubBeforeSend` + `sanitizeJobData` — excellent double layer. **1/1**
- Alertes seuils : aucune règle Sentry versionée, aucun threshold error rate/latency. **0/1**

### Plausible events custom /3 → **0.5/3**

- Événements funnel booking/payment/audit : présents et utilisés réellement (BookingForm.tsx). **0.5/1**
- Referer source LLM (perplexity/chatgpt/claude) : implémenté via `RefererTracker`. **0.5/1**
- Événements content-gen (`article_published`, `cost_alert`, `quality_score`) : absents. **0/1**

### Workers logs structurés + Loki/Grafana /5 → **0.5/5**

- Logs structurés JSON (Pino/Winston) : absents. **0/2**
- Loki/Promtail intégration : absente. **0/1**
- Grafana dashboards : absents. **0/1**
- Web Vitals ndjson (`vitals-store.ts`) : présent, mais local au VPS — pas agrégé. **0.5/1**

### CostLedger + GenerationLog : cost per article mesuré /8 → **4.5/8**

- `CostLedger` existe avec `{provider, model, tokensInput, tokensOutput, costUsd, jobId?, timestamp}` : fonctionnel. **2/2**
- `GenerationLog` existe et est écrit (`logStep`, `logStepError`) — 28 types de step définis. **2/2**
- Cost par article calculable : oui via JOIN CostLedger ↔ ContentGenJob. `ContentGenJob.costUsd` présent. **1/2**
- `cacheReadInputTokens` non persisté séparément → cache hit rate non mesurable. **-0.5**
- `ContentGenJob.tokensInput` = 0 toujours → champ inutilisable directement. **-0.5**
- `ContentMetric` agrégée non écrite → pas d'historique par jour/type. **0/2**
- Score final : **4.0/8** (arrondi 4.5 pour la solidité du CostLedger + GenerationLog)

### Anomaly detection (latency + throughput + cost + error rate) /6 → **1.5/6**

- Alerte cost cap 80% : présente (Telegram MONITORING, `cost-tracker.ts:212-224`). **1/2**
- Alerte cost cap 100% + kill switch auto : présente. **0.5/1**
- Anomaly detection dynamique (moving avg 7j) : absente. **0/1**
- Alerte latence provider (circuit breaker 5min/30min) : helpers définis `alertProviderDown5min/30min` mais non câblés — commentaire "Sprint dédié". **0/1**
- Alerte queue stuck (30min) : câblé dans `content-monitoring-worker.ts`. **0.5/1**
- Error rate threshold Sentry : absent. **0/0.5** (bonus si présent)

### Cohort analysis /3 → **0/3**

- Aucune analyse coût par cohorte semaine. Dashboard affiche 7j/30j/mois-courant uniquement (scalaires, pas de courbe temporelle). Pas de `GROUP BY week`. **0/3**

### Projections scénarios A/B/C /2 → **0/2**

- Section "Projection fin de mois" est un stub textuel dans CostsV2.tsx. Aucun calcul automatique. **0/2**

**Score final : 10.0/35 (28.6 %)** 🔴

---

## Projections Scénarios A/B/C (calcul manuel)

Basé sur les tarifs `anthropic.ts:51-67` pour `claude-sonnet-4-6` ($3.00/M input, $15.00/M output, $0.30/M cache_read) et estimation empirique type content-gen (system prompt ~3k tokens, user prompt ~1.5k tokens, output ~2.5k tokens, 80% cache hit sur system prompt) :

### Estimation coût par article (sans cache)
- Input brut : 4 500 tokens → $0.0135
- Output : 2 500 tokens → $0.0375
- **Total sans cache : ~$0.051/article**

### Estimation coût par article (avec cache 80% hit)
- Input non-caché : 1 500 tokens → $0.0045
- Input cache_read : 3 000 tokens → $0.0009
- Output : 2 500 tokens → $0.0375
- **Total avec cache : ~$0.043/article** (économie ~16%)

### Scénario A — 50 articles/jour
- Claude Sonnet : 50 × $0.043 × 30 = **~$64.50/mois**
- Infra Hetzner CPX42 : ~30€/mois
- Domaine + CF Free : ~15€/an
- **Total mensuel estimé : ~$95/mois (≈88€)**

### Scénario B — 200 articles/jour
- Claude Sonnet : 200 × $0.043 × 30 = **~$258/mois**
- Infra (upgrade CPX62 ou 2×CPX42) : ~60€/mois
- **Total mensuel estimé : ~$318/mois (≈295€)**

### Scénario C — 500 articles/jour
- Claude Sonnet : 500 × $0.043 × 30 = **~$645/mois**
- Fact-check Perplexity ($5/M tokens) : 500 × 1k tokens × 30 = ~$75/mois
- Infra (CPX62 × 2) : ~120€/mois
- **Total mensuel estimé : ~$840/mois (≈780€)**

**Note** : Si Anthropic Batch API activé (50% réduction), tous les scénarios divisés par ~1.3 à 1.5 selon mix streaming/batch. Scénario C passerait à ~$530-600/mois.

---

## UNKNOWNs

| # | Question | Raison |
|---|----------|--------|
| U1 | Alertes Sentry configurées dans l'UI sentry.io | Non versionnable dans le code — requiert accès sentry.io |
| U2 | Monitoring Hetzner Cloud RAM/CPU/disk alertes | Configuré via Hetzner UI ou Coolify, pas dans le repo |
| U3 | Cache hit rate réel Anthropic en prod | `cacheReadInputTokens` non persisté en DB — visible uniquement dans les logs console |
| U4 | Montant réel dépensé Claude en prod | DB vide ou tables non migrées avant ce commit (content-gen jamais tourné en prod à plein volume) |
| U5 | Activation `ContentMetric` writer | Table définie, aucun writer trouvé — peut-être prévu dans un worker non encore écrit |

---

## Délégations

Aucune délégation vers d'autres agents. Ce rapport est autosuffisant pour le scope observabilité + cost economics.

---

## Références

| Fichier | Ligne(s) | Objet |
|---------|----------|-------|
| `axionia/src/sentry.server.config.ts` | 7-18 | Sentry server init + PII |
| `axionia/src/sentry.edge.config.ts` | 7-18 | Sentry edge init |
| `axionia/src/instrumentation-client.ts` | 30-114 | Sentry client lazy init |
| `axionia/src/lib/observability/sentry-pii-scrub.ts` | 67-128 | beforeSend PII scrubber |
| `axionia/src/server/queue/lib/sentry-worker.ts` | 65-109 | captureWorkerError helper |
| `axionia/src/server/queue/lib/sanitize-job-data.ts` | 223-228 | sanitizeJobData PII-safe |
| `axionia/src/server/content-gen/lib/cost-tracker.ts` | 258-286 | trackCost() atomic |
| `axionia/src/server/content-gen/lib/cost-tracker.ts` | 182-250 | assertCostCapAvailable() |
| `axionia/src/server/content-gen/providers/anthropic.ts` | 41-84 | Pricing table + computeCost |
| `axionia/src/server/content-gen/providers/anthropic.ts` | 162-265 | Cache tokens tracking |
| `axionia/src/server/content-gen/shared/generation-log.ts` | 81-105 | logGeneration() |
| `axionia/src/server/content-gen/shared/content-gen-alerts.ts` | 24-465 | 16 alertes Telegram |
| `axionia/prisma/schema.prisma` | 3040-3053 | CostLedger schema |
| `axionia/prisma/schema.prisma` | 2945-2957 | GenerationLog schema |
| `axionia/prisma/schema.prisma` | 3056-3073 | ContentMetric schema (non écrit) |
| `axionia/prisma/schema.prisma` | 2920-2926 | ContentGenJob cost fields |
| `axionia/src/lib/analytics/plausible-tracker.ts` | 13-23 | trackEvent() |
| `axionia/src/lib/tracking.ts` | 16-35 | FunnelEvent types |
| `axionia/src/server/queue/workers/content-gen-worker.ts` | 559-578 | Sentry sur worker gen |
| `axionia/src/server/queue/workers/content-orchestrator-worker.ts` | 329-336 | Sentry sur orchestrator |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/costs/_v2/CostsV2.tsx` | 8-77 | Dashboard coûts |
| `axionia/src/server/actions/content-gen/geo.ts` | 80-120 | getCostsStats() |
| `axionia/.github/workflows/nightly.yml` | 1-234 | Gate D nocturne |
| `axionia/.github/workflows/sentry-query.yml` | 1-129 | Sentry query utilitaire |
| `axionia/src/server/queue/workers/content-monitoring-worker.ts` | 1-79 | Queue stuck + soft-404 |
| `axionia/src/lib/observability/vitals-store.ts` | 1-50 | Web Vitals ndjson |
