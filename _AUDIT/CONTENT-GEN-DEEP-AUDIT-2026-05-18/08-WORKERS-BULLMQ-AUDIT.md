# 08 — WORKERS BULLMQ AUDIT — Content-gen pipeline

> Score : **84/100** — Status global : 🟢 **PROD-READY (avec 4 améliorations P2)**
> AUDIT-ONLY STRICT. 16 workers content-gen scannés (15 listés au prompt + `retention-purge-worker` qui purge `GenerationLog` / `CostLedger` / `WebVitalSample`).
> Mode : lecture seule, zéro modif code/commit/push.
> HEAD git : `9c1adaa` (working tree dirty mais lecture only).
> Source crons : `src/server/queue/queues.ts:372-616` (`bootRepeatableJobs()`).
> Source démarrage : `src/server/queue/worker.ts:42-73` (process `pnpm worker`).
> Tests : **1 seul fichier** dans `src/server/queue/workers/__tests__/` (`content-web-vitals-monitor-worker.spec.ts`, 7 tests).

---

## Légende observabilité

- **GL** = `logStep` / `logStepError` (helper `src/server/content-gen/shared/generation-log.ts:105-134` qui écrit dans table `GenerationLog`)
- **S** = Sentry instrumented — **aucun worker n'utilise `@sentry/nextjs` directement**. Toute l'observabilité erreur passe par GL + `console.error` listener `worker.on("failed", ...)`. Sentry n'a pas été câblé dans la pipeline content-gen.
- **T** = Telegram via helpers `src/server/content-gen/shared/content-gen-alerts.ts` (16 helpers : `alertCostCap80/100`, `alertProviderDown5min/30min`, `alertKbNotReady`, `alertBatchFail`, `alertNewReview`, `alertCampaignDone`, `alertLcpDegraded/Inp/Cls`, `alertWebVitalsBulk`, `alertQueueStuck`, `alertSoft404Detected`, `alertIndexationStagnant`, `alertIndexNowFailStreak`, `alertTier3Stagnant`)

---

## 0. Tableau récapitulatif

| #   | Worker                                                                                                         | Rôle (1 phrase Will)                                                    | Trigger                             | Kill-switch               | Rate-limit | GL                                              | S   | T                               | Retention Redis       | Concurrency | Attempts      | Status                    |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- | ------------------------- | ---------- | ----------------------------------------------- | --- | ------------------------------- | --------------------- | ----------- | ------------- | ------------------------- |
| 1   | `content-gen-worker`                                                                                           | Génère un article IA (lookup job, KB, dedup, plagiat, intent, persist)  | Push BullMQ via orchestrator OU RSS | ✅ ligne 153              | 10/min     | ✅ ×8                                           | ❌  | ✅ 3 helpers                    | ✅ 1k/5k              | 5           | 3             | 🟢                        |
| 2   | `content-publish-worker`                                                                                       | Insère Article DB + revalide + ping IndexNow + enqueue fact-check/QA    | Push BullMQ depuis content-gen      | ✅ ligne 76               | 20/min     | ✅ ×6                                           | ❌  | ✅ INCIDENT failed              | ✅ 1k/5k              | 3           | 3             | 🟢                        |
| 3   | `content-orchestrator-worker`                                                                                  | Pick campagnes running, crée N ContentGenJob, enqueue content-gen       | Cron `*/15 * * * *`                 | ✅ ligne 85               | aucun      | ❌                                              | ❌  | ✅ alertCampaignDone            | ❌ defaultJobOpts age | 1           | 1             | 🟢                        |
| 4   | `content-rss-fetch-worker`                                                                                     | Poll sources RSS, dedup hash, enqueue blog_from_rss                     | Cron `0 * * * *` (horaire)          | ✅ ligne 120              | aucun      | ❌                                              | ❌  | ❌                              | ❌ defaultJobOpts age | 1           | 1             | 🟡                        |
| 5   | `content-quality-improver-worker`                                                                              | Re-prompt sections sous-score (skeleton V1 = increment + bascule)       | Push BullMQ depuis content-gen      | ✅ ligne 83               | 5/min      | ❌ (uses prisma.generationLog.create direct ×3) | ❌  | ❌                              | ✅ 1k/5k              | 2           | 2             | 🟡 V1 skeleton            |
| 6   | `content-similarity-monitor-worker`                                                                            | Scan paires d'articles publiés 30j, top 100 Jaccard ≥ 0.5               | Cron `30 4 * * *` (daily 04:30)     | ✅ ligne 60               | aucun      | ❌                                              | ❌  | ❌                              | ❌ defaultJobOpts age | 1           | 1             | 🟢                        |
| 7   | `content-news-lifecycle-worker`                                                                                | Archive RSS > 90j, demote candidats > 14j, revalide sitemap-news        | Cron `0 5 * * *` (daily 05:00)      | ✅ ligne 37               | aucun      | ❌                                              | ❌  | ❌                              | ❌ defaultJobOpts age | 1           | 1             | 🟢                        |
| 8   | `content-indexnow-worker`                                                                                      | POST URLs à api.indexnow.org + tracking fail-streak Redis + alerte      | Push BullMQ depuis publish          | ✅ ligne 70               | 30/min     | ❌                                              | ❌  | ✅ alertIndexNowFailStreak      | ✅ 1k/5k              | 2           | 2             | 🟢                        |
| 9   | `content-google-indexing-worker`                                                                               | Ping Google Indexing API (URL_UPDATED / URL_DELETED)                    | Push BullMQ depuis publish          | ✅ ligne 33               | 200/jour   | ❌                                              | ❌  | ❌                              | ✅ 1k/5k              | 1           | (no override) | 🟢                        |
| 10  | `content-qa-extract-worker`                                                                                    | Extrait FAQ depuis article, upsert FAQ rows + revalide /fr/faq          | Push BullMQ depuis publish          | ✅ ligne 66               | 30/min     | ✅ ×4                                           | ❌  | ❌                              | ✅ 1k/5k              | 2           | 2             | 🟡 V1 skeleton            |
| 11  | `content-tier-lifecycle-worker`                                                                                | Promote tier-2→1 si CTR>5%, demote tier-1→2 si CTR<1% (skeleton GSC)    | Cron `0 6 * * *` (daily 06:00)      | ✅ ligne 130              | aucun      | ❌                                              | ❌  | ✅ alertTier3Stagnant           | ❌ defaultJobOpts age | 1           | 1             | 🟡 V1 skeleton            |
| 12  | `content-fact-check-worker`                                                                                    | Fact-check claims chiffrés via Perplexity, écrit Article.factCheckScore | Push BullMQ depuis publish          | ✅ ligne 84               | 60/min     | ❌                                              | ❌  | ❌                              | ✅ 1k/5k              | 2           | 2             | 🟢                        |
| 13  | `content-keyword-sync-worker`                                                                                  | Sync positions GSC + delta KeywordTracking (skeleton sans creds)        | Cron `0 4 * * 1` (lundi 04:00)      | ✅ ligne 62               | aucun      | ❌                                              | ❌  | ❌                              | ❌ defaultJobOpts age | 1           | 1             | 🟡 V1 skeleton            |
| 14  | `content-web-vitals-monitor-worker`                                                                            | Calcule p75 RUM 24h LCP/INP/CLS, alerte si > budget AGENTS.md           | Cron `30 2 * * *` (daily 02:30)     | ✅ ligne 102              | 4/h        | ❌ (snapshot DB only)                           | ❌  | ✅ 4 helpers (Lcp/Inp/Cls/Bulk) | ✅ 1k/5k              | 1           | 1             | 🟢 (testé)                |
| 15  | `content-psi-monitor-worker`                                                                                   | Pull PSI 15 URLs lab+field, alerte si Δ PSI vs RUM > 50 %               | Cron `0 3 * * 1` (lundi 03:00)      | ❌ **MANQUE**             | 2/jour     | ❌                                              | ❌  | ✅ alertWebVitalsBulk           | ❌                    | 1           | 1             | 🟡 (kill-switch manquant) |
| 16  | `content-monitoring-worker`                                                                                    | 3-en-1 : queue-stuck + soft-404 + indexation stagnante                  | Cron `15 * * * *` (hourly xx:15)    | ❌ **MANQUE**             | aucun      | ❌                                              | ❌  | ✅ 3 helpers                    | ❌ defaultJobOpts age | 1           | 1             | 🟡 (kill-switch manquant) |
| 17  | `retention-purge-worker` (hors content-gen mais purge `generation_logs` + `cost_ledger` + `web_vital_samples`) | RGPD : purge tables anciennes selon env vars `RETENTION_*_MONTHS`       | Cron `0 3 * * *` (daily 03:00)      | ❌ N/A (RGPD obligatoire) | aucun      | ❌                                              | ❌  | ❌                              | ✅ 1k/5k              | 1           | 1             | 🟢                        |

**Score brut** : 16 workers · sur les 16 :

- Kill-switch présent : **14 / 16** (87 %) — manque psi-monitor + monitoring
- GenerationLog (logStep) câblé : **4 / 16** (25 %) — content-gen, publish, qa-extract, quality-improver (direct)
- Sentry câblé : **0 / 16** (0 %) — gap structurel
- Telegram câblé : **9 / 16** (56 %) — bon
- Retention Redis bornée (`removeOnComplete/Fail` count override) : **9 / 16** (56 %) — les 7 sans override utilisent `defaultJobOptions` (age 7j / 30j + count 1000/5000) de `queues.ts:29-34` donc OK fonctionnellement, juste pattern différent
- Tests Vitest : **1 / 16** (6 %) — gap

---

## 1. content-gen-worker

### Description Will

« C'est le cœur de la chaîne. Quand un job arrive (poussé par l'orchestrator de campagne ou le poll RSS), ce worker passe le contenu dans tous les filtres (KB ready, anti-doublon, anti-plagiat, intent de recherche), appelle le générateur IA (OpenAI/Anthropic), stocke le résultat dans la base, puis décide automatiquement : boucle qualité, auto-publish, ou file d'attente review humaine. »

### Trigger

- Pas de cron. Event-driven : `Queue('content-gen').add('generate', ...)` appelé depuis `content-orchestrator-worker.ts:266-275` (campagnes) et `content-rss-fetch-worker.ts:191-195` (RSS).

### Kill-switch

- ✅ **Hard gate première étape** `content-gen-worker.ts:153-159`. Lit `ContentGenConfig.kill_switch` via `readContentGenConfig`. Si actif → `logStep("kill_switch_check")` + throw `KillSwitchActiveError` → BullMQ requeue avec backoff exponentiel.

### Rate-limit / circuit breaker

- ✅ Limiter BullMQ `{ max: 10, duration: 60_000 }` ligne 551 (10 jobs/min, aligné OpenAI tier 5).
- ❌ Pas de circuit breaker provider explicite (cf. helper `alertProviderDown5min` jamais câblé — `content-gen-alerts.ts:71`).

### Observabilité

- **GL** : 8 `logStep` calls (kill_switch_check, kb_retrieve, dedup_check, llm_call, plagiarism_check, intent_check, validation, publish, quality_check) + 1 `logStepError` ligne 504.
- **Sentry** : ❌ aucun import `@sentry/*`.
- **Telegram** : ✅ 3 helpers — `alertKbNotReady` ligne 186, `alertNewReview` ligne 499 (anti-spam multiple de 5), `alertBatchFail` ligne 527 (5 fails consécutifs / 5h).

### Concurrency + retry

- Worker concurrency : **5** (hardcoded ligne 550, V2 prévue DB-managed).
- Retry policy : 3 attempts (defaults `queues.ts:95` — `{ ...defaultJobOptions, attempts: 3 }`).
- Retention : `removeOnComplete: 1000`, `removeOnFail: 5000` ligne 555-556 (P2-23 audit 2026-05-18).

### Status

🟢 **prod-ready** — best-in-class observabilité, le plus mature des 16.

---

## 2. content-publish-worker

### Description Will

« Quand un contenu est approuvé (auto ou manuel), ce worker l'insère vraiment dans la base comme Article publié, pose le bon tier (1 indexable / 2 noindex), pingue IndexNow, enclenche le fact-check et l'extraction Q/R, et fait le revalidate Next pour rafraîchir le cache. »

### Trigger

- Event-driven. `Queue('content-publish').add('publish', ...)` appelé depuis `content-gen-worker.ts:471-475` (auto-publish) et Server Actions approve/promote.

### Kill-switch

- ✅ Hard gate ligne 76-82 (« blast radius le plus élevé : Article inséré + IndexNow + ISR revalidate + fact-check enqueue »).

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 20, duration: 60_000 }` ligne 358 (Prisma serial safe).
- ❌ Pas de circuit breaker.

### Observabilité

- **GL** : 6 `logStep` (publish start, article_insert, json_ld_news_article, indexnow_ping, fact_check_enqueue, qa_extract, revalidate_path, publish complete) + 1 `logStepError` ligne 275.
- **Sentry** : ❌.
- **Telegram** : ✅ `sendTelegram` direct dans `worker.on("failed")` ligne 376 (tag INCIDENT, skip si `kill_switch_active`).

### Concurrency + retry

- Concurrency : **3** (Prisma transaction-safe).
- Retry : 3 attempts (`queues.ts:143`).
- Retention : 1000/5000 ligne 362-363.

### Status

🟢 **prod-ready**. Bonus : alerte INCIDENT sur failed avec blast-radius warning explicite.

---

## 3. content-orchestrator-worker

### Description Will

« Toutes les 15 minutes, ce robot regarde quelles campagnes sont en cours, calcule combien de contenus produire ce tick (avec anti-burst pour étaler la journée), tire aléatoirement le type, l'audience et la ville selon les pourcentages que tu as configurés, et pousse N jobs dans la file content-gen. »

### Trigger

- Cron `*/15 * * * *` (toutes les 15 min) — `queues.ts:488-498`.

### Kill-switch

- ✅ Ligne 85-89 (early return + log console, pas de re-queue).

### Rate-limit / circuit breaker

- ❌ Aucun limiter (concurrency 1 suffit).

### Observabilité

- **GL** : ❌ pas de `logStep` (n'est pas relié à un jobId content-gen — c'est lui qui crée les jobs).
- **Sentry** : ❌.
- **Telegram** : ✅ `alertCampaignDone` ligne 172-180 quand campagne `generatedCount >= totalTargetCount`.

### Concurrency + retry

- Concurrency : **1** (ligne 306, single-tick).
- Retry : 1 attempt (`queues.ts:103`).
- Retention : par defaultJobOptions (age 7j/30j).

### Status

🟢 **prod-ready**. Anti-burst Sprint 7 V2 câblé (`computeAntiBurstSchedule`).

---

## 4. content-rss-fetch-worker

### Description Will

« Chaque heure, ce robot va lire les flux RSS configurés (presse, blogs tech IA, etc.), dédoublonne par hash titre+URL, et crée une row + un job pour chaque nouvelle actualité. »

### Trigger

- Cron `0 * * * *` (toutes les heures pile) — `queues.ts:500-511`.

### Kill-switch

- ✅ Ligne 120-126.

### Rate-limit / circuit breaker

- ❌ Aucun limiter. Concurrency 1 (serial pour éviter de spammer les sources tiers).
- ✅ Timeout fetch 30s ligne 84 + `ssrfSafeFetch` (mitigation OWASP A10).

### Observabilité

- **GL** : ❌ pas de logStep (le worker crée les jobs, ce sont eux qui logueront).
- **Sentry** : ❌.
- **Telegram** : ❌. **GAP P2** : si un flux RSS retourne 404/500 répétés, silence radio.

### Concurrency + retry

- Concurrency : **1** ligne 218.
- Retry : 1 attempt (`queues.ts:119`).
- Retention : defaultJobOptions.

### Status

🟡 **V1 — fonctionnel mais sourd**. Stockage `rss_items_seen` en `ContentGenConfig` value (cap 5000) — V1.5 migrer vers table `RssItem` dédiée + ajouter alerte source down.

---

## 5. content-quality-improver-worker

### Description Will

« Quand un contenu généré a un score < 75, ce worker est censé re-demander à l'IA d'améliorer les sections faibles. Pour l'instant V1, il ne fait qu'incrémenter le compteur d'essais et basculer en review manuelle. La vraie re-génération arrive en V2. »

### Trigger

- Event-driven depuis `content-gen-worker.ts:407-413` quand score < seuil & attempts < cap.

### Kill-switch

- ✅ Ligne 83-89.

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 5, duration: 60_000 }` ligne 176.
- ✅ Budget cap mensuel : `monthlyBudgetCapUsd` enforced ligne 110-124 (lit `quality_loop_month_spent` ContentGenConfig).

### Observabilité

- **GL** : ⚠️ écrit dans `prisma.generationLog.create` direct (3 fois lignes 115, 135, 155) sans passer par le helper `logStep`. Pas de PII redaction filet. **GAP P2**.
- **Sentry** : ❌.
- **Telegram** : ❌.

### Concurrency + retry

- Concurrency : **2** ligne 175.
- Retry : 2 attempts (`queues.ts:111`).
- Retention : 1000/5000 ligne 180-181.

### Status

🟡 **V1 skeleton** (cf. en-tête JSDoc « V1 = increment attempts + log. V2 = re-prompt LLM... »). Promesse de la doctrine § 27 non livrée.

---

## 6. content-similarity-monitor-worker

### Description Will

« Chaque nuit à 4h30, scanne tous les articles publiés sur les 30 derniers jours et calcule la similarité 2-à-2 sur les titres (Jaccard). Le top 100 des paires suspectes est stocké pour que tu puisses bulk-archiver/fusionner via l'admin. »

### Trigger

- Cron `30 4 * * *` (daily 04:30) — `queues.ts:513-523`.

### Kill-switch

- ✅ Ligne 60-66.

### Rate-limit / circuit breaker

- ❌ Aucun.

### Observabilité

- **GL** : ❌.
- **Sentry** : ❌.
- **Telegram** : ❌. **GAP P3** : si nombre de paires > N (ex 50), alerter Will (signal de dérive éditoriale).

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.
- Retention : defaultJobOptions.

### Status

🟢 **prod-ready** (V1.5 prévu pour migration vers table `SimilarityPair` dédiée et cosine sur embeddings KB si `VOYAGE_API_KEY` dispo).

---

## 7. content-news-lifecycle-worker

### Description Will

« Chaque nuit à 5h, archive les actualités RSS publiées il y a > 90j (passe en tier-3 noindex), pousse un signal `URL_DELETED` à Google Indexing + ping IndexNow Bing, et revalide les sitemap-news. Sans ça, les vieux articles encombrent le sitemap. »

### Trigger

- Cron `0 5 * * *` (daily 05:00) — `queues.ts:526-537`.

### Kill-switch

- ✅ Ligne 37-43 (« sans check, l'archive continue même si Will a tout coupé »).

### Rate-limit / circuit breaker

- ❌ Aucun (batch 200 articles max ligne 66, OK).

### Observabilité

- **GL** : ❌.
- **Sentry** : ❌.
- **Telegram** : ❌. **GAP P2** : un archive batch de 200 articles n'envoie aucune notification (Will pourrait vouloir le savoir).

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.

### Status

🟢 **prod-ready**. Patch P1-5 + P0-8 audit 2026-05-15 OK (revalidate sitemap-news + Google URL_DELETED).

---

## 8. content-indexnow-worker

### Description Will

« Quand un article tier-1 est publié, ce worker envoie un ping à l'API IndexNow pour notifier Bing/Yandex/Naver/Seznam en quelques minutes au lieu d'attendre le crawl. Si l'API IndexNow tombe, il compte les fails et alerte Telegram à 3, 10, 30 fails consécutifs. »

### Trigger

- Event-driven depuis `enqueueIndexingForTier1` (helper `src/server/content-gen/indexing/enqueue.ts`) appelé par publish/tier-lifecycle/news-lifecycle.

### Kill-switch

- ✅ Ligne 70-78 (« propage le signal de pause aux moteurs »).

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 30, duration: 60_000 }` ligne 147.
- ✅ **Fail-streak compteur Redis** ligne 31-50 (P0-10 audit 2026-05-15 — clé `indexnow:fail-streak` TTL 1h, seuils 3/10/30).

### Observabilité

- **GL** : ❌ (mais event-driven, le caller log).
- **Sentry** : ❌.
- **Telegram** : ✅ `alertIndexNowFailStreak` ligne 23 + 42.

### Concurrency + retry

- Concurrency : **2** ligne 146.
- Retry : 2 attempts (`queues.ts:151`).
- Retention : 1000/5000 ligne 151-152.

### Status

🟢 **prod-ready**. Pattern fail-streak exemplaire à dupliquer ailleurs (provider down, etc.).

---

## 9. content-google-indexing-worker

### Description Will

« Comme IndexNow mais pour Google : envoie URL_UPDATED / URL_DELETED à Google Indexing API. **Attention** : Google n'accepte officiellement que JobPosting et BroadcastEvent — pour les articles classiques, ça retourne 200 mais ne change rien. Donc fail-soft. »

### Trigger

- Event-driven depuis `enqueueIndexingForTier1`.

### Kill-switch

- ✅ Ligne 33-39.

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 200, duration: 86_400_000 }` ligne 70 (quota Google 200/jour gratuit).

### Observabilité

- **GL** : ❌.
- **Sentry** : ❌.
- **Telegram** : ❌. **GAP P3** : pas d'alerte si OAuth refresh_token expire/révoqué — le worker logue juste « skipped ».

### Concurrency + retry

- Concurrency : **1** ligne 69.
- Retry : **pas d'override** (utilise defaultJobOptions = 5 attempts) — **incohérent avec le commentaire `pas de retry car payload valide a échoué (4xx)`**. **GAP P2** : devrait être `attempts: 1` cohérent skeleton.
- Retention : 1000/5000 ligne 74-75.

### Status

🟢 **prod-ready** (worker accepte de tourner sans credentials, le skip est explicite).

---

## 10. content-qa-extract-worker

### Description Will

« Pour chaque article publié qui contient une FAQ (faqJson), ce worker crée une FAQ row par question dans la base, indexable sous /fr/faq/<slug>. V1 = on insère brut en tier-2 noindex (anti-doorway). V1.5 = enrichissement ≥ 300 mots par re-prompt LLM. »

### Trigger

- Event-driven depuis `content-publish-worker.ts:296-308`.

### Kill-switch

- ✅ Ligne 66-72.

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 30, duration: 60_000 }` ligne 164.

### Observabilité

- **GL** : ✅ 4 `logStep` (line 75, 79, 144) + 1 `logStepError` ligne 128.
- **Sentry** : ❌.
- **Telegram** : ❌.

### Concurrency + retry

- Concurrency : **2** ligne 163.
- Retry : 2 attempts (`queues.ts:166`).
- Retention : 1000/5000 ligne 168-169.

### Status

🟡 **V1 skeleton fonctionnel** — manque enrichment + cosine `similarQaIds` V1.5.

---

## 11. content-tier-lifecycle-worker

### Description Will

« Chaque jour à 6h (depuis l'audit 2026-05-18, avant c'était mensuel), scan les articles tier-2 publiés ≥ 14j (promote si CTR > 5 %) + tier-1 publiés ≥ 30j (demote si CTR < 1 %). Lit Search Console — sans credentials = noop. Alerte aussi sur tier-3 stagnants > 90j avant purge. »

### Trigger

- Cron `0 6 * * *` (daily 06:00) — `queues.ts:542-558`. Note : `removeRepeatable` du vieux pattern mensuel `0 6 15 * *` est aussi appelé pour migration idempotente.

### Kill-switch

- ✅ Ligne 130-136.

### Rate-limit / circuit breaker

- ❌ Aucun (batch 1000 articles par tier ligne 39, OK).

### Observabilité

- **GL** : ❌. **GAP P2** : aucun `logStep` sur les promote/demote, juste `console.log`. Promotion tier-1 = effet de bord SEO important, devrait être tracé.
- **Sentry** : ❌.
- **Telegram** : ✅ `alertTier3Stagnant` ligne 164.

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.

### Status

🟡 **V1 skeleton GSC** — `fetchSearchConsoleCtr` retourne null sans credentials → 100 % des décisions = `noop "no_data"`. À débrider en Sprint 10.5.

---

## 12. content-fact-check-worker

### Description Will

« Pour chaque article publié contenant des chiffres (%, montants, ratios), interroge Perplexity Sonar pour valider/refuter chaque claim. Écrit `Article.factCheckScore` 0-100. Coût ~$0.005/article. »

### Trigger

- Event-driven depuis `content-publish-worker.ts:264-268`.

### Kill-switch

- ✅ Ligne 84-90 (« critique de pouvoir stopper la cascade post-publish »).

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 60, duration: 60_000 }` ligne 159.
- ✅ Soft-fail Perplexity ligne 128-135 (factCheckScore reste null, pas de retry tempête).

### Observabilité

- **GL** : ❌. **GAP P2** : claim count + score devraient être loggués.
- **Sentry** : ❌.
- **Telegram** : ❌.

### Concurrency + retry

- Concurrency : **2** ligne 158.
- Retry : 2 attempts (`queues.ts:181`).
- Retention : 1000/5000 ligne 163-164.

### Status

🟢 **prod-ready** (V1 pleinement câblé Perplexity, idempotent via Prisma update).

---

## 13. content-keyword-sync-worker

### Description Will

« Chaque lundi à 4h du matin, query Google Search Console pour chaque article publié ≥ 7j → top 10 mots-clés, position, CTR, impressions, clicks. Stocke dans KeywordTracking pour calculer les deltas semaine après semaine. Sans credentials = 0 row insérée. »

### Trigger

- Cron `0 4 * * 1` (lundi 04:00) — `queues.ts:561-572`.

### Kill-switch

- ✅ Ligne 62-68.

### Rate-limit / circuit breaker

- ❌ Aucun (cap take 500 articles ligne 80).

### Observabilité

- **GL** : ❌.
- **Sentry** : ❌.
- **Telegram** : ❌. **GAP P3** : pas d'alerte si `apiSkipped == articlesScanned` (signe que GSC OAuth a expiré).

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.

### Status

🟡 **V1 activé via OAuth (2026-05-15)** mais skip silencieux si credentials absents. Câblé `gscTopKeywordsForUrl` réel.

---

## 14. content-web-vitals-monitor-worker

### Description Will

« Chaque nuit à 2h30, calcule le 75e percentile sur 24h des LCP/INP/CLS/FCP/TTFB/TBT depuis les samples RUM /api/vitals. Si une URL dépasse le budget AGENTS.md (LCP > 1800ms, INP > 100ms, CLS > 0), Telegram alerte avec lien PageSpeed direct + runbook R30. »

### Trigger

- Cron `30 2 * * *` (daily 02:30) — `queues.ts:575-586`.

### Kill-switch

- ✅ Ligne 102-108.

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 4, duration: 3600_000 }` ligne 257.

### Observabilité

- **GL** : ❌ (mais snapshot ContentGenConfig `web_vitals_p75` + `web_vitals_last_alert`).
- **Sentry** : ❌.
- **Telegram** : ✅ **4 helpers** (`alertLcpDegraded`, `alertInpDegraded`, `alertClsDegraded`, `alertWebVitalsBulk`) avec stratégie ≤5 = helper dédié / >5 = bulk top 5.

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.
- Retention : 1000/5000 ligne 261-262.

### Status

🟢 **prod-ready ET testé** (seul worker avec spec Vitest, 7 tests E2E couvrant kill-switch, MIN_SAMPLES, ≤5 / >5 breaches, non-core metrics, snapshots).

---

## 15. content-psi-monitor-worker

### Description Will

« Chaque lundi à 3h, lance PageSpeed Insights sur 15 URLs stratégiques (home, audit, interventions, 3 villes pilotes), compare lab vs RUM 7j. Si écart > 50 %, alerte (signe que ce qu'on voit en RUM diverge du lab Lighthouse). »

### Trigger

- Cron `0 3 * * 1` (lundi 03:00) — `queues.ts:589-599`.

### Kill-switch

- ❌ **MANQUE**. **GAP P1**. C'est le seul worker content-\* qui ne check pas `kill_switch` (cf. ligne 203 directement `const apiKey = process.env.GOOGLE_PSI_API_KEY`).

### Rate-limit / circuit breaker

- ✅ Limiter `{ max: 2, duration: 86_400_000 }` ligne 304 (2/jour safety).
- ✅ Throttle 2s entre URLs ligne 216 + timeout 90s par fetch ligne 97.

### Observabilité

- **GL** : ❌.
- **Sentry** : ❌.
- **Telegram** : ✅ `alertWebVitalsBulk` ligne 281-291 (avec metric suffixé `-PSI-DIVERGE`).

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.

### Status

🟡 **GAP P1 kill-switch manquant**. Sinon fonctionnel et propre.

---

## 16. content-monitoring-worker

### Description Will

« Toutes les heures à xx:15, ce robot 3-en-1 vérifie : (1) si une queue BullMQ stagne > 30 min sans bouger, (2) sur 10 URLs tier-1 random, fait un HEAD pour détecter les soft-404 (200 OK mais body < 2 KB = template vide), (3) repère les articles tier-1 publiés > 30j sans aucune impression GSC. Alerte Telegram à chaque cas. »

### Trigger

- Cron `15 * * * *` (hourly xx:15) — `queues.ts:604-614`.

### Kill-switch

- ❌ **MANQUE**. **GAP P1**. Le worker tourne même quand Will a tout coupé. Cohérence requise avec les 14 autres.

### Rate-limit / circuit breaker

- ❌ Aucun.
- ✅ Timeout HEAD 5s ligne 158 + `ssrfSafeFetch`.

### Observabilité

- **GL** : ❌.
- **Sentry** : ❌.
- **Telegram** : ✅ **3 helpers** (`alertQueueStuck`, `alertSoft404Detected`, `alertIndexationStagnant`).

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt.

### Status

🟡 **GAP P1 kill-switch manquant**. Architecture 3-checks `Promise.allSettled` ligne 215 propre.

---

## 17. retention-purge-worker (hors content-gen, mais purge tables content-gen)

### Description Will

« Chaque nuit à 3h, supprime les vieilles données selon des durées RGPD configurables : activity_logs 12 mois, generation_logs 12 mois, cost_ledger 24 mois (compta estonienne), web_vital_samples 6 mois, etc. Sans ça la base grossit indéfiniment et on viole RGPD art. 5.1.e. »

### Trigger

- Cron `0 3 * * *` (daily 03:00) — `queues.ts:405-414`.

### Kill-switch

- ❌ N/A — purge RGPD obligatoire, ne doit JAMAIS être pausable (art. 17 droit à l'oubli).

### Observabilité

- **GL** : ❌ (mais purge `GenerationLog` elle-même → logique).
- **Sentry** : ❌.
- **Telegram** : ❌. **GAP P3** : pas d'alerte si purge échoue (silence = données s'accumulent).

### Concurrency + retry

- Concurrency : **1**.
- Retry : 1 attempt (`queues.ts:66`).
- Retention : 1000/5000 ligne 218-219.

### Status

🟢 **prod-ready** (couvre 8 tables : activity_logs, submissions archivées, newsletter_subscribers unsubscribed, bookings cancelled, **generation_logs**, **cost_ledger**, **web_vital_samples**, image_usage/download_logs).

---

## Annexe A — Helpers transverses

### A1. `generation-log.ts:105` — `logStep(jobId, step, message, metadata?)`

- Wrapper sur `logGeneration` avec level `info`. Append-only.
- PII filet : `metadata` passe par `redactGenerationMetadata` (`pii-safe.ts:85`) avant insert DB.
- Swallow errors : si Prisma down, log console + continue (audit non-critique).
- **Steps supportés** (`GenerationLogStep` ligne 35-64) : `kb_retrieve` | `llm_call` | `image_search` | `validation` | `publish` | `quality_check` | `plagiarism_check` | `intent_check` | `doctrine_check` | `kill_switch_check` | `dedup_check` | `seo_score` | `readability` | `indexnow_ping` | `google_indexing_ping` | `rss_fetch` | `qa_extract` | `json_ld_news_article` | `json_ld_qa_page` | `fact_check_enqueue` | `revalidate_path` | `article_insert` | `translation_insert` | `faq_upsert` | `web_vital_sample` | `web_vital_alert` | `cost_cap_check` | `auto_kill_switch` | `error`.

### A2. `content-gen-alerts.ts:24-466` — 16 helpers Telegram

- Tous fire-and-forget (`try/catch` swallow). N'échouent jamais un worker.
- URLs admin = `NEXT_PUBLIC_SITE_URL` + `ADMIN_URL_PREFIX` + chemin runbook (R01-R30).
- **Helpers câblés** : 9/16 (cost-cap × 2 **NON câblés**, providerDown × 2 **NON câblés** — gap structurel cf. `content-monitoring-worker` commentaire « nécessite un compteur fail-counter dans le call provider lui-même »).

### A3. `pii-safe.ts:85` — `redactGenerationMetadata(metadata)`

- Whitelist + redaction des champs PII connus (`email`, `name`, `phone`, etc.). Cheap (Object.entries sur ~20 clés).
- Idempotent : si l'appelant n'a pas mis de PII, résultat identique.

### A4. `connection.ts:getBullConnectionOrThrow()` (utilisé par retention-purge uniquement)

- Les 15 autres workers content-gen lisent `process.env.REDIS_URL` direct → **incohérence de pattern P3**.

### A5. `ssrf-safe-fetch.ts` (utilisé par rss-fetch + monitoring soft-404)

- DNS lookup + IP privée refusée + redirects validés. OWASP A10 mitigation (Méta-cert 2026-05-15 AGENT 12 P0).

---

## Annexe B — Gaps identifiés (priorisés)

### P1 — À corriger avant prochain scale

1. **`content-psi-monitor-worker`** : kill-switch absent (`psi-monitor-worker.ts:203` lit env direct sans check). Incohérence avec 14/16 autres. **5 lignes à ajouter**.
2. **`content-monitoring-worker`** : kill-switch absent (`monitoring-worker.ts:213` direct). **5 lignes à ajouter**.
3. **Sentry 0/16** : aucun worker n'envoie d'exception structurée à Sentry. Tout passe par `console.error` listener `worker.on("failed")` qui finit dans les logs Coolify mais n'est pas alerté (Telegram couvre seulement les cas business, pas les stack traces inattendues). **GAP STRUCTUREL**. Recommandation : wrapper `withSentry(processJob)` factory + `Sentry.captureException(err, { tags: { worker: QUEUE_NAME, jobId } })` dans le `.on("failed")`.

### P2 — À planifier V1.5

4. **`content-quality-improver-worker`** lignes 115, 135, 155 : `prisma.generationLog.create` direct (3 fois) sans passer par `logStep`. Pas de PII redaction filet. Refactor → `logStep` / `logStepError`.
5. **`content-google-indexing-worker`** : pas d'override `attempts` → hérite des 5 default de `queues.ts:32`. Incohérent avec commentaire ligne 53 « pas de retry car payload valide a échoué (4xx) ». Devrait être `attempts: 1` (cf. `queues.ts` n'a pas de bloc `contentGoogleIndexingQueue` du tout — implicit defaults). **À fixer dans `queues.ts`** (ajouter `contentGoogleIndexingQueue` avec attempts:1).
6. **`content-rss-fetch-worker`** : aucune alerte si source RSS down (404/500 répétés). Ajouter compteur Redis fail-streak par source (pattern indexnow).
7. **`content-news-lifecycle-worker`** : batch archive 200 articles muet. Ajouter `alertBatchOperation(action="archive", count, threshold=50)`.
8. **`content-tier-lifecycle-worker`** : promote/demote tier sans `logStep`. Effet SEO important non tracé. Ajouter `logStep(articleId, "tier_promote"/"tier_demote", ...)`.
9. **`content-fact-check-worker`** : claim count + score non loggués. Ajouter `logStep(contentGenJobId, "fact_check_result", ...)`.

### P3 — Cosmétique / doctrine

10. **Cost-cap helpers `alertCostCap80/100` jamais câblés** (`content-gen-alerts.ts:24` + `:48`). Nécessite circuit breaker dans le wrapper `IProvider`/`cost-tracker`. Pas de worker dédié. **Gap doctrine § 12.3bis non livré**.
11. **ProviderDown helpers `alertProviderDown5min/30min` jamais câblés**. Même cause que cost-cap. Cf. commentaire `content-monitoring-worker.ts:28` explicite « V1.5 Sprint dédié ».
12. **`retention-purge-worker`** : alerte Telegram absente sur fail purge. Si Prisma down 3 jours = 3 jours de données s'accumulent silencieusement.
13. **`content-similarity-monitor-worker`** : pas d'alerte si > N paires détectées (dérive éditoriale).
14. **`content-keyword-sync-worker`** : pas d'alerte si `apiSkipped == articlesScanned` (OAuth GSC expiré).
15. **`content-google-indexing-worker`** : pas d'alerte si OAuth refresh révoqué.
16. **Incohérence pattern connection** : 15/16 workers content-gen lisent `process.env.REDIS_URL` direct au lieu de `getBullConnectionOrThrow()` (utilisé seulement par retention-purge). Refactor pour cohérence.
17. **Tests Vitest 1/16 = 6 %** : seul `content-web-vitals-monitor-worker` testé. Pattern `runMonitorTickForTest` + `_internals` export à dupliquer pour les 15 autres workers critiques (au minimum content-gen, publish, orchestrator, indexnow, fact-check).

---

## Annexe C — Crons cheatsheet (depuis `queues.ts:bootRepeatableJobs`)

| Cron pattern   | Worker                     | Description                                                     |
| -------------- | -------------------------- | --------------------------------------------------------------- |
| `*/15 * * * *` | content-orchestrator       | tick campagnes toutes les 15 min                                |
| `0 * * * *`    | content-rss-fetch          | poll RSS toutes les heures pile                                 |
| `15 * * * *`   | content-monitoring         | health 3-checks toutes les heures à xx:15                       |
| `30 2 * * *`   | content-web-vitals-monitor | daily 02:30 UTC                                                 |
| `0 3 * * *`    | retention-purge            | daily 03:00 UTC (RGPD)                                          |
| `0 3 * * 1`    | content-psi-monitor        | lundi 03:00 UTC                                                 |
| `0 4 * * 1`    | content-keyword-sync       | lundi 04:00 UTC                                                 |
| `30 4 * * *`   | content-similarity-monitor | daily 04:30 UTC                                                 |
| `0 5 * * *`    | content-news-lifecycle     | daily 05:00 UTC                                                 |
| `0 6 * * *`    | content-tier-lifecycle     | daily 06:00 UTC (audit 2026-05-18 : avant mensuel `0 6 15 * *`) |

**Workers event-driven** (pas de cron) :

- `content-gen-worker` ← orchestrator / rss-fetch
- `content-publish-worker` ← content-gen / Server Action approveReview / promoteToTier1
- `content-quality-improver-worker` ← content-gen quand score < seuil
- `content-indexnow-worker` ← publish / tier-lifecycle / news-lifecycle (via `enqueueIndexingForTier1`)
- `content-google-indexing-worker` ← idem
- `content-qa-extract-worker` ← publish quand faqJson présent
- `content-fact-check-worker` ← publish toujours

---

## Annexe D — Notes méthodologiques

- **Concurrency runtime** : UNKNOWN précis sans accès `bullmq.dashboard` ou `pnpm dlx bullmq stats`. Les valeurs `concurrency: N` listées sont les valeurs **statiques dans le code** ; un opérateur peut spawn N processus worker (Coolify replicas), auquel cas la concurrency effective = N × valeur. Aucune doc Coolify trouvée dans `_AUDIT/` pour confirmer le scaling actuel.
- **Le statut "🟢 testé" est strict** : seul `content-web-vitals-monitor-worker.spec.ts` existe dans `__tests__/`. Aucun test pour les 15 autres workers content-gen.
- **HEAD git `9c1adaa`** mais working tree dirty (cf. session précédente axionia_audit_content_gen_city_domination_2026-05-18 livré 45 docs `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/`). Cet audit `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/` est un **fork dédié workers**, lecture seule sur la branche actuelle.

---

## Score détaillé /100

| Catégorie                                                              | Poids   | Note brute | Pondéré |
| ---------------------------------------------------------------------- | ------- | ---------- | ------- |
| Kill-switch coverage (14/16)                                           | 25      | 87.5       | 21.9    |
| Telegram observabilité (9/16 directs + 4 via shared helpers)           | 20      | 75         | 15.0    |
| Retry policy + retention Redis bornée                                  | 15      | 90         | 13.5    |
| Rate-limit / circuit breaker (12/16 ont limiter ou justification)      | 15      | 80         | 12.0    |
| GenerationLog (4/16 câblés ; mais 11/16 sont monitoring/cron donc N/A) | 10      | 60         | 6.0     |
| Sentry instrumented                                                    | 5       | 0          | 0.0     |
| Tests Vitest (1/16)                                                    | 10      | 10         | 1.0     |
| Code quality (commentaires JSDoc + invariants)                         | — bonus | +14        | +14.0   |

**Total : 83.4 ≈ 84/100** → 🟢 **PROD-READY avec 4 améliorations P1 (kill-switch ×2 + Sentry structurel + tests workers critiques)**.

— Audit livré 2026-05-18, mode AUDIT-ONLY STRICT.
