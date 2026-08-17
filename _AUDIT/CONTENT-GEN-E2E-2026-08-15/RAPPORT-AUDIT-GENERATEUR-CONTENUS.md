# Audit end-to-end — Générateur de contenus (2026-08-15)

**Verdict : NON, pas « à la perfection ».** Le générateur est **à l'arrêt complet depuis le 24/07** (kill switch actif + crédit OpenAI à zéro, confirmé par sonde live), et l'audit code (6 agents, ~200 fichiers) relève **8 bloquants**, ~15 majeurs et une vingtaine de mineurs. Les fondations (sanitization, idempotence publish, dedup, fixes de juillet) sont saines ; les défauts se concentrent sur le pacing, le cycle de vie des jobs et des gardes devenues muettes ou mortes.

Méthode : 6 agents d'audit en parallèle (orchestrateur, worker génération/qualité, actions/admin, publication/indexation, KB/RAG/providers, config/monitoring/tests) + vérification prod en lecture seule (Postgres, sondes API OpenAI/Anthropic, site live, sitemaps) + typecheck.

---

## 1. État prod constaté (2026-08-15, lecture seule)

| Signal | État |
|---|---|
| Kill switch global | **ACTIF depuis le 22/07** (« Quota OpenAI toujours épuisé - régel manuel ») — effectif le 24/07 21h (derniers jobs créés) |
| Crédit OpenAI | **0** — sonde live : HTTP 429 `credit_balance_exhausted` |
| Anthropic | **OK** — sonde live : HTTP 200 |
| Jobs | 1 532 `failed` · **56 `quality_improving` bloqués depuis le 20/07** · 377 `needs_review` · 173 `published` · 169 `cancelled` · 2 `quarantined_critical` · 1 `approved` |
| Campagne « AURA + IdF » | toujours `running` en base (neutralisée par le kill switch) — **repartira dès la levée du switch** |
| Pacing réel mesuré | **~88 jobs/jour créés les 23-24/07** pour une campagne configurée à 20/jour → confirme le bug de pacing (voir B3) |
| Dernier appel LLM facturé | 20/07 (OpenAI) · 09/07 (Anthropic) |
| Chaîne publication | ✅ dernier article publié (20/07) répond 200 sur `/fr/blog/…` et figure dans `sitemap-blog.xml` |
| KB / embeddings | ✅ 507 embeddings **réels** (model_version `2026-06`, aucun stub) · 100 faits villes seedés |
| Typecheck | ✅ vert (l'échec initial = client Prisma périmé, résolu par `pnpm prisma:generate`) |

---

## 2. Bloquants (à corriger AVANT toute relance)

**B0 — Opérationnel : crédit OpenAI à zéro** (reste Will). C'est la 3ᵉ fois (09/07, 18/07, ~21/07). Chaque rechargement sans correction du pacing (B3) se fait re-brûler.

**B1 — Le publish force `tier_1_indexable` : toutes les gardes de tier en amont sont mortes.**
`content-publish-worker.ts:618` force le tier quel que soit `promoteToTier1`. Le gen-worker (`content-gen-worker.ts:1216-1222`) et l'improver (`content-quality-improver-worker.ts:402-407`) croient encore déclasser en tier_2/tier_3 (soft-404, score < 50, doctrine CPF) et le **logguent** — mais l'article naît indexable, entre au sitemap sous ~10 min. `promoteToTier1=false` ne coupe plus que le ping IndexNow. Le garde-fou anti-doorway HCU n'existe plus ; le log admin ment. Confirmé indépendamment par 2 agents.

**B2 — Boucle qualité : une seule passe possible + la console strande les jobs.**
(a) `content-gen-worker.ts:1157-1161` enqueue l'improver avec `jobId: quality-<id>` **fixe** → la passe 2 est silencieusement dédupliquée par BullMQ (job passe 1 retenu `removeOnComplete count:1000`) → statut `quality_improving` à jamais. (b) `requestEdits` (`review.ts:373-415`) pose le statut `quality_improving` **sans rien enqueuer** (le seul producteur de la queue improver est le gen-worker). Aucun sweeper ne balaie ce statut. **→ Explique les 56 jobs bloqués en prod depuis le 20/07.**

**B3 — Pacing orchestrateur : ~96 jobs/jour quel que soit `dailyArticles`.**
`content-orchestrator-worker.ts:773-775` : `perCampaignTick = max(1, ceil(dailyArticles/96))` sans aucun comptage des jobs déjà créés le jour même (mode per-campaign, le défaut). `dailyArticles=20` → 1 job/tick × 96 ticks = **4,8× la cible**. Confirmé en prod (~88/j les 23-24/07). Brûle le crédit API 5× plus vite que configuré. Seul le mode `dailyTargetByType` (anti-burst) est sain.

**B4 — Kill switch × attempts=1 : des jobs meurent définitivement pendant une pause.**
Les enqueues inter-workers passent par des Queue ad-hoc **sans `defaultJobOptions`** (`content-gen-worker.ts:176-194`, improver:40-56) → `attempts=1` au lieu de 3. Un job publish qui rencontre le kill switch (throw « requeue », `content-publish-worker.ts:148-154`) échoue une fois, définitivement ; le ContentGenJob reste `approved` fantôme. Même avec attempts=3, une pause > ~35 s brûle tout (backoff expo 5 s). Aucun sweeper de réconciliation.

**B5 — Livelock d'idempotence orchestrateur : une campagne peut geler en silence.**
`createJobForSlot` : create DB (`content-orchestrator-worker.ts:267`) → `queue.add` (:303) → incrément `generatedCount` (:807) non atomiques. Crash/blip Redis entre les deux → au tick suivant, même slotIndex → violation `idempotencyKey` → `return false` → pas d'incrément → **boucle infinie**, campagne gelée + job `queued` orphelin. La collision unique est explicitement non loggée (:316).

**B6 — Keyword lock sans propriétaire : le pipeline s'auto-cancelle.**
Lock acquis au gen (`content-gen-worker.ts:429-460`), relâché **uniquement** au publish (`content-publish-worker.ts:1196-1210`), sans token de propriété ni release sur échec/needs_review/regen. Une regen de boucle qualité (< 30 min) ou un retry BullMQ retombe sur son propre lock → `cancelled` « Keyword lock held by another worker ». La boucle qualité tue le job qu'elle devait améliorer.

**B7 — Cost-cap : le reset mensuel ne réactive rien, et le kill switch auto ne peut pas se déclencher pour le texte.**
(a) `cost-cap-reset-worker.ts:32` remet le compteur à 0 mais ne ré-enable pas les providers ni ne lève le kill switch → cap atteint le 20 = génération morte à perpétuité (l'alerte Telegram promet le contraire). (b) `cost-tracker.ts:77-80` compte les ProviderConfig `role=text enabled` : `anthropic` est seedé enabled mais **hors de la chaîne réelle** (`provider-router.ts:118` = openai seul) → cap OpenAI atteint = churn de jobs `auth_failed` sans jamais flipper le kill switch.

**B8 — Revalidation ISR : peut être cassée en prod sans AUCUN signal.**
`revalidate-content.ts` ne throw jamais et tous ses warn sont gatés `NODE_ENV !== "production"` (:28,51,55). Le catch du publish worker (:1166-1188) est du code mort ; le GenerationLog écrit « Revalidate paths ✓ » inconditionnellement. Un `REVALIDATE_SECRET` désynchronisé = plus aucune invalidation, invisible. Même classe : `enqueueIndexingForTier1` retourne des booléens ignorés (log « Indexing enqueued ✓ » même si rien n'est parti).

---

## 3. Majeurs

1. **Perplexity : le bug quota de juillet, à l'identique** — `perplexity.ts:78-80` mappe tout 429 en `rate_limited` retryable (pas de détection `insufficient_quota`). Compte à sec = retries infinis, cause invisible. (OpenAI et Anthropic sont corrigés.)
2. **Retry d'un job `landing_ville` = zombie garanti** — `jobs.ts:274-291` + :129-134 : DB passée à `queued` puis `enqueueGenJob` refuse (CLI-only) et return silencieux. Le compteur de `retryAllFailed` compte ces skips comme succès.
3. **~20 Server Actions de lecture non authentifiées** — `listJobs`, `getJob` (output complet + logs), `listReview`, `getKillSwitch`, `readContentGenConfig` (dépenses $, similarity_pairs)… endpoints POST publics. Les pages admin ne vérifient que la présence de session, pas le rôle.
4. **Cap 100 $/mois de la boucle qualité = garde morte** — `quality_loop_month_spent` lu/resetté mais **jamais incrémenté** (improver:86-120).
5. **Doctrine hors SIREN (CPF, partenariats fabriqués) peut finir indexée** — le déclassement tier_3 du generator est écrasé par B1 ; le chemin juge→approved ignore la doctrine interne (`content-gen-worker.ts:823-827`).
6. **Correction fact-check peut publier un article tronqué** — réécriture full-HTML `maxTokens: 4096`, `finish_reason=length` non propagé, seule garde < 50 % (`content-fact-check-worker.ts:50-77`).
7. **`moveToDelayed` sans `throw DelayedError`** (BullMQ v5) — `content-publish-worker.ts:170,206` → erreurs de lock parasites sur chaque throttle drip/cap. Confirmé par 2 agents.
8. **Le compteur du cap journalier fuit** — INCR avant décision, pas de DECR sur les returns review/quarantaine/skip (`content-publish-worker.ts:183-191`) → le cap peut être mangé à vide.
9. **Statut `running` fantôme** — passage à running + dedup pré-IA HORS du try/catch (`content-gen-worker.ts:309-341`) : une erreur DB y laisse le job `running` à vie et bloque un slot.
10. **Mode séquentiel campagne : n'attend jamais puis s'éteint en silence** — `currentCityIndex` avancé à l'enqueue (orchestrator:486-489) ; après N ticks = N villes, la campagne n'enfile plus rien mais reste `running`. Le test C3 encode le bug.
11. **Campagne `fixed` marquée `completed` sur le seul compteur d'enqueue** (orchestrator:739-770) — une panne provider transforme une campagne en « terminée » avec une fraction publiée, sans reprise possible (slots consommés à vie — toujours vrai, jamais décrémentés).
12. **IndexNow : re-ping refresh dédupliqué à vie** (`enqueue.ts:110`, jobId `indexnow-<articleId>-publish` fixe) ; **pings KB non canoniques** (URLs sans `/fr` → 308, URLs EN → 301) ; **guides pingés/revalidés sous `/fr/blog/…`** (308, jamais revalidés, métriques GSC nulles).
13. **`revalidatePath` no-op silencieux dans 2 workers BullMQ** — news-lifecycle (archivage > 90 j) et qa-extract (`/fr/faq`) : exactement le bug P1-16 déjà corrigé dans le publish worker.
14. **Monitoring aveugle sur lui-même** — `content-monitoring-worker.ts:474-480` : `Promise.allSettled` résultats ignorés ; `readContentGenConfig` avale toute erreur → kill switch retombe à `{active:false}` sur erreur DB (fail-open d'un arrêt d'urgence) ; bandeau `cost_cap_80` jamais résolu.
15. **UI/actions** : `deleteFailedJobs` (destructif à vie, slots perdus) sans confirmation ni rôle élevé, accessible à un `editor` ; « Approuver (en ligne, non indexé) » ment (publie tier-1 indexable depuis le 16/06) ; `retryJob`/`cancelJob` acceptent un job `published` ; les quarantainés n'ont AUCUN bouton retry, seulement la suppression définitive.
16. **Ingest HMAC peut empoisonner les embeddings** — écrit sans la garde anti-stub du seed (`ingest.ts:167,230-240`) et `search-vector.ts` ne filtre pas `model_version LIKE '%-stub'`. (Prod actuellement saine : 507 vrais vecteurs.)
17. **PSI monitor : lockDuration 120 s < durée réelle du job** (jusqu'à ~23 min) → jobs stalled rejoués en parallèle, quota consommé 2×.

## 4. Mineurs (sélection)

- Doc-drift systémique sur les seuils : commentaires « 60 » vs réel 75, « 75 » vs réel 60, « Default 75 » vs `?? 50` (`content-gen-worker.ts:1089-1111`, :96-99).
- `outline-validator.ts` : code mort (jamais branché). Phasage villes (`phased-coverage.ts`) : garde morte, jamais lue par l'orchestrateur.
- Dedup pré-IA inerte sur les flux dominants (gardé par `if (title)` — campagnes et RSS le sautent).
- `/fr/blog` absent des listes du job `warm` (le mécanisme qui a mordu `/fr/diagnostic` le 08-14).
- Health checks providers = vrais appels payants non trackés au ledger, à chaque affichage admin (cache Redis 60 s documenté, jamais implémenté).
- `GenerationRequest.timeoutMs` mort ; pricing `gpt-4.1` surestimé ; anti-burst compte les jobs RSS dans le budget campagne ; fenêtres journalières en UTC vs `recurringSchedule` en Europe/Paris.
- Alerte « rank-drop Telegram » annoncée en commentaire : n'existe pas. Rapport hebdo → `contact@axion-ia.com` (le commentaire dit gmail).
- Démotion manuelle admin envoie `URL_DELETED` sur une page qui reste 200 (contraire à la doctrine anti-yoyo du tier-lifecycle).
- Entrypoint FTS : pas de fallback npx + échec non-fatal silencieux (le SQL FTS est bien appliqué au boot depuis le fix — piège de juin résolu).
- Tests : le cœur (`content-gen-worker`, monitoring, improver, fact-check réel, indexnow, cost-cap cascade) n'a aucun spec dédié ; `factcheck-gate.test.ts` teste une copie locale de la logique.

## 5. Ce qui est sain (vérifié)

- **Les fixes de juillet tiennent tous** : #342 retry anti-zombie (remove→add, 4 call-sites intacts, testé) ; sync-counters (#353) bien câblé avant l'early-return ; mapping `insufficient_quota` OpenAI/Anthropic non-retryable ; verdict juge `publish` → auto-publish pour TOUS les types (`judge-outcome.ts`, testé).
- Sanitization HTML stricte (DOMPurify isolé, whitelist, anti-tabnabbing) ; anti-injection prompt (`escapeLlmInput` partout, y compris RSS externe).
- Idempotence publish (lookup par jobId, anti-collision slug, rename historisé 301) ; `markPublishJobFailed` auto-réparant + Sentry + Telegram.
- LLM-judge : verdict recalculé déterministiquement (anti-hallucination), score recalculé depuis les dimensions.
- Keyword-selector : réservation atomique `FOR UPDATE SKIP LOCKED`, rotation anti-cannibalisation.
- Sitemaps : filtre tier_1 partout, Route Handlers runtime (jamais bakés vides), gates EN cohérents ; contrat stub.invalid (ADR 0026) respecté sur tous les loaders SSG.
- Kill switch : SSOT DB sans cache, flip admin gardé + audité, auto-trigger cost-cap (dans sa portée, cf. B7).
- 50 workers tous démarrés (aucun orphelin), crons repeatable idempotents ; alertes Telegram centralisées avec throttling réel.
- Prod : chaîne publication → page 200 → sitemap vérifiée vivante ; embeddings réels ; KB seedée 5 verticales + villes.

## 6. Séquence de reprise recommandée (ordre impératif)

1. **Patcher B3 (pacing)** — sinon le crédit rechargé se fait re-brûler à ~96 jobs/jour (déjà arrivé 2×).
2. **Patcher B1 (tier forcé)** — décision Will : restaurer le gating tier_2/tier_3 OU assumer tout-tier-1 et retirer les logs mensongers.
3. **Patcher B2 (boucle qualité)** — jobId par tentative + `requestEdits` qui enqueue réellement ; puis débloquer les 56 `quality_improving`.
4. **Recharger le crédit OpenAI** (platform.openai.com) — et envisager un spending cap plus haut ou une alerte de solde.
5. **Lever le kill switch** (console admin) — la campagne « AURA + IdF » repartira seule (status `running`).
6. **Relance sélective des 1 532 failed** : via le retry sûr (#342), par lots pacés — l'essentiel est constitué d'échecs de quota transitoires, mais ~40 % se fera légitimement rejeter en doublon (rendement structurel ~30 %). JAMAIS `deleteFailedJobs` (perte définitive, slots consommés à vie).

---

*Audit réalisé le 2026-08-15 : 6 agents (orchestrateur · génération/qualité · actions/admin · publication/indexation · KB/RAG/providers · config/monitoring/tests), état prod sondé en lecture seule, typecheck vert. Rapports détaillés des agents : voir la session Claude Code du 15/08.*
