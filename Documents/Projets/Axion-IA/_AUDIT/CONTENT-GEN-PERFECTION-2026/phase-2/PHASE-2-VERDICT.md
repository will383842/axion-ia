# PHASE 2 — VERDICT ARCHITECTURE & DATA PIPELINE
# AxionIA Content-Gen Perfection 2026

**Date audit** : 2026-05-21
**Commit HEAD** : 2b98a70 (baseline déclaré P1.5 : 37ca0147 — HEAD actuel au-dessus)
**Auditeur** : Claude Sonnet 4.6 — 10 sous-agents parallèles (AUDIT-ONLY)
**Score P2** : 581/800 brut → **726/1000 normalisé**
**Verdict** : 🔴 **NO-GO**

---

## Scores par agent

| Agent | Domaine | Score | Max | % |
|-------|---------|-------|-----|---|
| A2-01 | Architecture BullMQ queues | 50 | 70 | 71% |
| A2-02 | Prisma schema cohérence | 65 | 80 | 81% |
| A2-03 | Rate limiting & cost control | 63 | 90 | 70% |
| A2-04 | Observability | 53 | 80 | 66% |
| A2-05 | Configuration management | 49 | 70 | 70% |
| A2-06 | Error handling & resilience | 52 | 80 | 65% |
| A2-07 | Performance DB | 63 | 80 | 79% |
| A2-08 | Multi-campagnes concurrence | 43 | 70 | 61% |
| A2-09 | Sécurité & conformité pipeline | 59 | 80 | 74% |
| A2-10 | Sprint S+6 roadmap différés | 84 | 100 | 84% |
| **TOTAL** | | **581** | **800** | **72.6%** |

**Score normalisé** : round(581 / 800 × 1000) = **726 / 1000**

---

## Top P0 — Bloquants absolus (10 items, ordonnés par criticité)

### P0-1 — [A2-09] CASCADE DELETE détruit traces AI Act (deadline 2026-08-02)
`generation_provenance` FK → `articles.id ON DELETE CASCADE`. L'action admin `deleteArticle()` (double-confirm) détruit légalement les traces IA après suppression d'un article. Non-conforme AI Act art. 50.
**Fix** : `ALTER TABLE generation_provenance DROP CONSTRAINT ...; ADD CONSTRAINT ... FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT;`
**Effort** : 15 min + 1 migration.

### P0-2 — [A2-06 + A2-01] lockDuration BullMQ non configuré → double publication
`lockDuration` par défaut = 30 000ms. Un job content-gen peut durer jusqu'à 100s (3 retries × 10s+30s+60s). BullMQ marque le job `stalled` à 30s → autre worker reprend → 2 appels LLM → 2 `Article.create` pour le même keyword.
**Fix** : `lockDuration: 120000` dans les `WorkerOptions` de `content-gen-worker.ts`.
**Effort** : 10 min.

### P0-3 — [A2-09] promptHash sémantiquement creux (hash jobId, pas prompt réel)
`content-publish-worker.ts:321` calcule `promptHash = SHA256(contentType:jobId:articleId)`. La chaîne AI Act ne permet pas de reconstituer ni vérifier le prompt LLM original utilisé pour générer l'article.
**Fix** : Passer le prompt réel (ou son hash) depuis `content-gen-worker` vers `GenerationProvenance.promptHash`.
**Effort** : 2-3h.

### P0-4 — [A2-03] Race condition MAX_PUBLISH_PER_DAY avec concurrency=3
Séquence count→check→publish non atomique. 3 workers peuvent lire `count=29` simultanément pour `cap=30` → publient 3 articles → total 32.
**Fix** : Compteur Redis `INCR axion:pub:YYYYMMDD` + `EXPIRE` minuit UTC + `SETNX` guard.
**Effort** : 1-2h.

### P0-5 — [A2-08] Absence rollback keyword si crash worker
La requête SKIP LOCKED (`UPDATE keywords SET ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)`) s'exécute correctement mais sans champ `lockedUntil` ni `lockedBy` sur la table `Keyword`. Si le worker crash après sélection → keyword consommé définitivement → trou dans la couverture de contenu.
**Fix** : Ajouter `locked_until TIMESTAMPTZ`, `locked_by_job_id TEXT` sur `Keyword` + cron cleanup `WHERE locked_until < NOW()`.
**Effort** : 1.5h + migration.

### P0-6 — [A2-08] Article sans campaignId NOT NULL en DB
`Article` n'a pas de champ `campaignId` direct — la traçabilité passe par `Article.generatedByJobId → ContentGenJob.campaignId` (nullable). Un bug de routing ne serait pas détecté par contrainte DB.
**Fix** : Migration + relation `Article.campaign` non-nullable.
**Effort** : 2h + migration + backfill.

### P0-7 — [A2-01 + A2-03] Workers image-bank sans rate limit Claude
`image-bank-enrich-worker` et `image-bank-translate-worker` instancient et appellent le client Anthropic sans `limiter` BullMQ ni rate limit applicatif. En bulk import (> 100 images), ces workers peuvent déclencher un burst Anthropic et atteindre les limites de tier.
**Fix** : Ajouter `limiter: { max: 10, duration: 60000 }` dans les WorkerOptions des 2 workers.
**Effort** : 30 min.

### P0-8 — [A2-02] 3 index DB critiques manquants → seq scan à l'échelle
Index manquants confirmés sur les tables les plus requêtées du pipeline :
1. `articles (status, published_at DESC)` — toutes les pages blog
2. `generation_provenance (article_id, timestamp DESC)` — lookup AI Act par article
3. `keywords (vertical, last_used_at ASC NULLS FIRST, usage_count ASC)` — SKIP LOCKED efficace
**Fix** : 3 migrations `CREATE INDEX CONCURRENTLY`.
**Effort** : 1h.

### P0-9 — [A2-05] Vars critiques absentes de .env.example
`IP_HASH_SALT`, `PII_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`, `INDEXNOW_INTERNAL_HMAC_SECRET` absents du `.env.example`. Un nouvel environnement déployé sans ces vars démarre mais avec RGPD/sécurité cassée silencieusement.
**Fix** : Ajouter ces 4 vars + les 31 autres vars manquantes dans `.env.example` avec commentaires.
**Effort** : 45 min.

### P0-10 — [A2-06] Actions post-publish hors transaction → articles orphelins
`enqueueIndexingForTier1()` et `revalidateContent()` s'exécutent **après** `prisma.$transaction()` dans `content-publish-worker`. Si Redis/réseau fail après la transaction DB, l'article est `PUBLISHED` en DB mais jamais pingué IndexNow ni revalidé CDN.
**Fix** : Wrapper dans une saga (retry séparé), ou accepter l'inconsistance et documenter le comportement (IndexNow-worker peut re-pinger les articles non indexés).
**Effort** : 2-3h.

---

## Top P1 — Importants non-bloquants (15 items)

| # | Agent | Description | Effort |
|---|-------|-------------|--------|
| P1-1 | A2-06 | `withRetry()` linéaire → exponentiel réel + jitter (thundering herd protection) | 1h |
| P1-2 | A2-06 | Circuit breakers état in-memory non partagé entre process workers | 2-3h |
| P1-3 | A2-04 | `captureWorkerError` manquant dans `content-quality-improver-worker` | 30 min |
| P1-4 | A2-04 | Champ `tokensInput` hardcodé à 0 dans ContentGenJob (content-gen-worker:491) | 1h |
| P1-5 | A2-04 | Aucun `correlationId`/`traceId` propagé entre workers | 2h |
| P1-6 | A2-03 | Rampe progressive 30→500 non codée (D-W1 décision Will non implémentée) | 2h |
| P1-7 | A2-01 | `campaignId` absent du payload BullMQ (job.data) → filtrage impossible a posteriori | 1h |
| P1-8 | A2-08 | Filtrage keywords par `vertical` seulement → pool partagé entre campagnes de même verticale | 1h |
| P1-9 | A2-07 | Incohérence commentaire "3072 dim" vs constante 1536 → risque "correction" future | 15 min |
| P1-10 | A2-07 | Aucun script backfill embeddings — activation OPENAI=true sans backfill = dedup aveugle | 3h |
| P1-11 | A2-05 | `JUDGE_THRESHOLDS` promesse DB-managed non implémentée — hardcoded `as const` | 4-5h |
| P1-12 | A2-01 | `pauseCampaign()` : fenêtre ~1-5s race condition avec tick orchestrateur | 1.5h |
| P1-13 | A2-09 | `sanitize-job-data` appliqué uniquement pour Sentry, pas sur `ContentGenJob.inputPayload` en DB | 1h |
| P1-14 | A2-03 | Monthly caps actuels ($100/mois) insuffisants pour scale 500 art/j ($1 411/mois) | 0h (décision Will) |
| P1-15 | A2-02 | N+1 `checkDedup` : charge 5000 ContentGenJob + boucle JS Levenshtein → déléguer à `pg_trgm` | 4-6h |

---

## Synthèse par dimension

### Architecture BullMQ (A2-01 + A2-08) — 93/140 → 66%
La topologie des queues est bien pensée (8 queues séparées, nommage cohérent) et `pauseCampaign()` fonctionne correctement pour le cas nominal. Les deux faiblesses majeures sont : (1) `lockDuration` non configuré (P0-2, risque double-article), (2) absence de filtre `campaignId` dans le SKIP LOCKED (P1-8, isolation imparfaite si deux campagnes partagent une verticale). La concurrence multi-campagnes est fonctionnelle dans 80% des cas mais fragile dans les cas limites.

### Data Model (A2-02 + A2-07) — 128/160 → 80%
Le schéma Prisma est le point le plus solide de l'audit — 9 modèles content-gen présents, HNSW correctement configuré (1536 dims, pas IVFFlat), migrations P1.5 idempotentes. Les lacunes sont les 3 index composites manquants (P0-8) qui deviendront critiques à 10K+ articles, et l'absence d'un script de backfill embeddings (P1-10). La décision 1536 vs 3072 dims est correcte et délibérée.

### Contrôle coûts & resilience (A2-03 + A2-06) — 115/170 → 68%
Les fondations existent (monthly caps DB-managed, alertes Telegram 80%+100%, circuit breaker maison) mais présentent des failles à l'échelle : caps insuffisants pour 500 art/j (P1-14), race condition publish cap (P0-4), retry linéaire non exponentiel (P1-1), circuit breakers in-memory non partagés (P1-2). La résilience est acceptable pour 30 art/j, fragile pour la rampe progressive.

### Conformité & sécurité (A2-09) — 59/80 → 74%
L'architecture `GenerationProvenance` est bien conçue (16 champs, hash SHA-256 chaîné) mais deux P0 la rendent non-conforme AI Act : le `ON DELETE CASCADE` qui détruit les traces (P0-1) et le `promptHash` qui ne hash pas le prompt réel (P0-3). La deadline AI Act art. 50 est à < 3 mois (2026-08-02). Sans correction urgente de P0-1 et P0-3, le système ne peut pas prétendre à la conformité.

### Observabilité & config (A2-04 + A2-05) — 102/150 → 68%
Le socle `logStep()` → `GenerationLog` Prisma est bien architecturé mais partiellement implémenté (40 `console.log` bruts, `tokensInput=0` hardcodé, 0 `correlationId`). La configuration est partiellement documentée — 31 vars manquantes dans `.env.example` dont 4 critiques sécurité (P0-9). Le point fort est l'architecture feature flags hybride (env + DB hot-reload) qui fonctionne bien.

### Roadmap S+6 (A2-10) — 84/100 → 84%
L'analyse des 7 items P2 différés est précise et ancrée dans le code réel. 4 items ont un Go clair (P2-1, P2-3, P2-4, et partiellement P2-2 si DPA signé). P2-6 (Voyage AI) reste NO-GO — stub permanent confirmé dans `topic-fingerprint.ts`. Budget S+6 réaliste : ~4h GO fermes + ~8h conditionnels. L'estimation d'impact (+28 pts → 840-870/1000) est cohérente avec les fixes P0 inclus.

---

## Verdict final

**Score normalisé** : **726/1000**

**Verdict** : 🔴 **NO-GO**

**Raison principale** : 10 P0 identifiés dont 2 non-conformités légales à deadline < 3 mois (AI Act art. 50), 1 risque de double-publication en production (lockDuration), et 1 race condition sur le cap journalier. Le système est fonctionnel pour 30 articles/jour mais fragile pour la montée en charge visée (500/jour).

---

## Condition de passage à GO

Les 5 P0 suivants doivent être corrigés pour atteindre le seuil CONDITIONNEL (750+) :

- [ ] **P0-1** : `ON DELETE RESTRICT` sur `generation_provenance.article_id` (15 min + migration) — deadline AI Act
- [ ] **P0-2** : `lockDuration: 120000` dans WorkerOptions de `content-gen-worker` (10 min) — double-article
- [ ] **P0-4** : MAX_PUBLISH_PER_DAY via Redis INCR atomique (1-2h) — race condition publish
- [ ] **P0-8** : 3 index DB manquants via `CREATE INDEX CONCURRENTLY` (1h) — perf à l'échelle
- [ ] **P0-9** : Vars critiques dans `.env.example` (45 min) — sécurité déploiement

**Effort total pour passer CONDITIONNEL** : ~4-5h Claude autopilot
**Score projeté après 5 P0 corrigés** : ~790-810/1000 → 🟡 CONDITIONNEL

Pour atteindre GO (≥ 900), corriger en plus P0-3, P0-5, P0-6, P0-10 + les P1 prioritaires (P1-1, P1-3, P1-6, P1-7, P1-8) : effort total ~15-18h supplémentaires.

---

## Recommandation séquencement S+6

**Sprint S+6 Phase A — P0 urgents (4-5h) :**
1. P0-1 : `ON DELETE RESTRICT` GenerationProvenance (migration)
2. P0-2 : `lockDuration: 120000` content-gen-worker
3. P0-4 : Redis INCR atomique MAX_PUBLISH_PER_DAY
4. P0-8 : 3 index DB CONCURRENTLY
5. P0-9 : `.env.example` exhaustif

**Sprint S+6 Phase B — Items P2 GO (4h) :**
6. P2-4 : Log `keyword_select_exhausted` (30 min)
7. P2-1 : `.env.example` complet (45 min, inclus dans P0-9)
8. P2-3 : Frontend `<Image>` Article.featuredImage (2-3h)
9. P0-7 : Rate limit workers image-bank (30 min)
10. P1-3 : `captureWorkerError` quality-improver-worker (30 min)

**Sprint S+6 Phase C — Conditionnels (8h) :**
11. P0-3 : promptHash réel depuis prompt LLM (2-3h)
12. P0-5 : `lockedUntil` sur Keyword + cron cleanup (1.5h)
13. P2-2 : Couche 4 embeddings pre-publish câblé (3-4h, si DPA Anthropic signé)
14. P1-6 : Rampe progressive 30→500 codée (2h)

---

## Actions Will requises

| # | Décision | Bloque |
|---|----------|--------|
| W-1 | Signer DPA Anthropic (https://privacy.anthropic.com/en/dpa) | P2-2 embeddings couche 4 + mitigation P0-3 |
| W-2 | Augmenter monthly caps Anthropic → $1 500/mois avant scale 500 art/j | P0 coût runaway |
| W-3 | Confirmer qu'EN locale reste désactivée — P2-7 hero bilingue reste NO-GO sinon | P2-7 |
| W-4 | Valider soft-delete sur Article vs hard-delete (arbitrage RGPD art.17 × AI Act 6 ans) | P0-1 + P0-6 design |
| W-5 | Autoriser sprint correctif P0 avant S+6 (~4-5h) pour passer de NO-GO à CONDITIONNEL | Débloque tout |
