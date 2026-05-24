# PROMPT VÉRIFICATION SPRINT P2 — ARCHITECTURE & DATA PIPELINE
## AxionIA Content-Gen Perfection 2026 — Audit post-sprint P2

**Date création** : 2026-05-21
**Sprint vérifié** : commit `17c53bc` "fix(content-gen): sprint correctif P0/P1/P2 — 10 fixes audit P2" + 4 commits supports (`51fcbb9`, `c1bfa6e`, `56decf0`, `0947d9e`, `8d3d886`)
**Verdict de référence** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/PHASE-2-VERDICT.md` (10 P0 + 15 P1)
**Score baseline pré-sprint** : 726/1000 🔴 NO-GO
**Score cible post-sprint** : ≥ 790-810/1000 🟡 CONDITIONNEL (selon verdict P2 §"Condition de passage à GO")
**Mode** : **AUDIT-ONLY strict**
**Effort estimé** : 5-7h autopilot (10 sous-agents parallèles + tests fonctionnels backend intensifs)

---

## 0. PARTICULARITÉ DE CE SPRINT

Contrairement à P3/P4/P5, le sprint correctif P2 **n'a pas été pré-spécifié** par un prompt `PROMPT-SPRINT-P2-CORRECTIONS-...md`. Il a été exécuté de façon "freestyle" par une conversation Claude antérieure (probablement Manon ou autre instance) qui a poussé 5 commits sur origin/main :

| Commit | Description | P0 ciblé (probable) |
|---|---|---|
| `17c53bc` | "sprint correctif P0/P1/P2 — 10 fixes audit P2" | Multiple P0 |
| `51fcbb9` | "lockDuration 30s → 120s sur content-gen + quality-improver" | P0-2 |
| `c1bfa6e` | "lockDuration 30s → 120s sur content-quality-improver" | P0-2 (extension) |
| `56decf0` | "internalLinkCount regex markdown → HTML" | (probable P4, possiblement P2 transversal) |
| `0947d9e` | "quality loop re-génère avec feedback LLM-judge (BUG 4)" | (probable P4) |
| `8d3d886` | "module mapping image-bank audit/interventions" | (probable P4) |

Ta mission : **vérifier que les 10 P0 du verdict P2 initial ont été correctement résolus**, indépendamment de la qualité de l'exécution du sprint (qui n'avait pas de spec formelle).

---

## 1. CONTEXTE — À LIRE AVANT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **HEAD origin/main pré-sprint P2** : `37ca0147` (P1.5 livré + vérifié)
- **HEAD origin/main post-sprint P2** : `0906722` ou supérieur
- **Commits à auditer** (à lire via `git show <sha> --stat` et `git show <sha> -- <files>`) :
  - `17c53bc` (principal)
  - `51fcbb9`, `c1bfa6e` (lockDuration)
  - `56decf0`, `0947d9e`, `8d3d886` (peut-être P4 plutôt que P2 — à classifier)

### Fichiers à lire (ordre)
1. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/PHASE-2-VERDICT.md` (verdict initial 726/1000 — 10 P0 + 15 P1 documentés)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/CROSS-CUTTING.md`
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/agents/A2-01.md` à `A2-10.md`
4. Mémoire `axionia_content_gen_p1_5_livre_2026-05-21.md` (baseline)
5. Mémoire `axionia_p4_decisions_canoniques_2026-05-21.md` (pour distinguer ce qui est P4 vs P2 dans les commits)

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code, install dep
- ✅ Lecture, diagnostics (`pnpm typecheck/lint/test`, `git log/diff/show`, `prisma migrate status`, tests via `node -e`)
- ✅ Connexion DB locale en lecture seule pour vérifier schemas (`SELECT` only, `EXPLAIN ANALYZE`, `\d table` psql)
- ✅ Création de fichiers UNIQUEMENT dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/verification/`

---

## 2. SPAWN 10 SOUS-AGENTS PARALLÈLES

### V2-01 — P0-1 CASCADE DELETE → RESTRICT (AI Act) (/100)
**CRITIQUE compliance**.

- Lire `prisma/schema.prisma` : recherche `GenerationProvenance` modèle
- Vérifier FK `article` ou `articleId` : doit avoir `onDelete: Restrict` (pas `Cascade`)
- Vérifier migration appliquée : `git log origin/main --oneline -- prisma/migrations/ | head -30` → trouver migration "RESTRICT" ou "generation_provenance"
- Connexion DB : `psql -c "\d generation_provenance"` → vérifier `Foreign-key constraints: ... ON DELETE RESTRICT`
- Test fonctionnel : tenter `DELETE FROM articles WHERE id = '<test_article_id>'` ayant une trace `generation_provenance` → DOIT échouer avec erreur FK constraint
- Si CASCADE encore actif : -100 pts + alerte critique (deadline AI Act art. 50 = 2026-08-02)
- Score : 100 max

### V2-02 — P0-2 lockDuration BullMQ 120s (/80)
- Lire `src/server/queue/workers/content-gen-worker.ts` : `WorkerOptions` doit contenir `lockDuration: 120000`
- Lire `src/server/queue/workers/content-quality-improver-worker.ts` : idem
- Vérifier les commits `51fcbb9` et `c1bfa6e` : `git show 51fcbb9 -- src/server/queue/workers/` → doit montrer `lockDuration: 30000` → `lockDuration: 120000`
- Vérifier qu'il n'y a PAS d'autres workers content-gen avec `lockDuration` par défaut (30s) qui pourraient subir le même bug
- Test fonctionnel : simuler job content-gen qui dure 80s → vérifier que BullMQ ne le marque PAS `stalled` (pas de 2e worker qui prend le job)
- Score : 80 max

### V2-03 — P0-3 promptHash réel (/100)
**CRITIQUE compliance AI Act**.

- Lire `src/server/queue/workers/content-publish-worker.ts` ligne ~321 : calcul `promptHash`
- Avant fix : `SHA256(contentType:jobId:articleId)` (creux)
- Après fix attendu : `SHA256(prompt_LLM_complet)` ou similaire
- Vérifier que le prompt réel est passé depuis `content-gen-worker` vers `content-publish-worker` (via `job.data.promptUsed` ou similaire)
- Test fonctionnel : générer 1 article, lire `GenerationProvenance.promptHash` → calculer manuellement `SHA256(prompt)` du prompt utilisé → DOIT correspondre
- Si encore `SHA256(contentType:jobId:articleId)` : -100 pts (non-conforme AI Act art. 50 traçabilité)
- Score : 100 max

### V2-04 — P0-4 Race condition MAX_PUBLISH_PER_DAY (/120)
**CRITIQUE production**.

- Lire le code qui implémente le cap `MAX_PUBLISH_PER_DAY` dans `content-publish-worker.ts`
- Avant fix : `count → check → publish` non atomique
- Après fix attendu : Redis `INCR axion:pub:YYYYMMDD` + `EXPIRE` minuit UTC + `SETNX` guard
- Vérifier import `ioredis` ou client Redis utilisé
- Vérifier que `INCR` est exécuté AVANT publish et que la valeur retournée est comparée au cap
- Si valeur > cap → job re-enqueue ou skip (pas publish)
- Test fonctionnel : avec `concurrency=3` workers actifs simultanés, simuler 5 jobs de publish à cap=2 → seuls 2 articles doivent passer en published (pas 3 ou 4)
- Tester `EXPIRE` minuit : `TTL axion:pub:<today>` doit retourner secondes jusqu'à minuit UTC
- Si Redis INCR non implémenté : red flag → vérifier si autre approche atomique (Postgres advisory lock, transaction SERIALIZABLE)
- Score : 120 max

### V2-05 — P0-5 rollback keyword si crash worker (/80)
- Lire schema Prisma : `Keyword` model doit avoir `locked_until` (TIMESTAMPTZ) et `locked_by_job_id` (TEXT) ?
- Migration appliquée pour ces 2 colonnes ?
- Lire `src/server/content-gen/keyword-selector.ts` : SKIP LOCKED query met-elle bien `locked_until = NOW() + INTERVAL '15 minutes'` et `locked_by_job_id = <jobId>` ?
- Cron cleanup : worker ou script `cleanupExpiredKeywordLocks` qui fait `UPDATE keywords SET locked_until = NULL, locked_by_job_id = NULL WHERE locked_until < NOW()` ?
- Test fonctionnel : sélectionner 1 keyword via `selectKeyword()`, kill le worker (simuler crash), attendre 15 min ou trigger cleanup → keyword redevient disponible
- Si lock fields absents : keyword reste consommé définitivement → trou couverture → -80 pts
- Score : 80 max

### V2-06 — P0-6 Article.campaignId NOT NULL (/80)
- Lire schema Prisma : `Article` model doit avoir relation `campaign` (non-nullable) avec FK vers `CoverageCampaign` ?
- Migration appliquée pour ajouter colonne `campaign_id` NOT NULL + backfill ?
- Vérifier `content-gen-worker.ts` qui crée `Article` : passe-t-il bien `campaignId` ?
- Test fonctionnel : tenter INSERT `Article` sans `campaign_id` → DOIT échouer avec NOT NULL constraint
- Si nullable encore : -80 pts (bug routing campagne non détecté par contrainte DB)
- Score : 80 max

### V2-07 — P0-7 Rate limit workers image-bank (/40)
- Lire `src/server/queue/workers/image-bank-enrich-worker.ts` et `image-bank-translate-worker.ts`
- WorkerOptions doit contenir `limiter: { max: 10, duration: 60000 }` ?
- Test : si bulk import 100 images, doit prendre ≥ 10 minutes (rate limited à 10/min)
- Score : 40 max

### V2-08 — P0-8 3 index DB critiques (/100)
- Vérifier migrations contenant `CREATE INDEX CONCURRENTLY` pour :
  1. `articles (status, published_at DESC)`
  2. `generation_provenance (article_id, timestamp DESC)`
  3. `keywords (vertical, last_used_at ASC NULLS FIRST, usage_count ASC)`
- Connexion DB : `\di+ articles` et `\di+ generation_provenance` et `\di+ keywords` (psql) ou `SELECT indexname FROM pg_indexes WHERE tablename IN ('articles', 'generation_provenance', 'keywords')`
- Test performance : `EXPLAIN ANALYZE SELECT * FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 50;` → doit utiliser INDEX, pas Seq Scan
- Idem pour les 2 autres requêtes
- Score : 100 max (33/33/34)

### V2-09 — P0-9 .env.example exhaustif (/60)
- Lire `.env.example` (à la racine du repo)
- Doit contenir AU MINIMUM :
  - `IP_HASH_SALT`
  - `PII_ENCRYPTION_KEY`
  - `BACKUP_ENCRYPTION_PASSPHRASE`
  - `INDEXNOW_INTERNAL_HMAC_SECRET`
- Idéalement les 31 autres vars manquantes documentées avec commentaires
- Vérifier que ces vars sont aussi documentées dans le README ou docs/setup.md
- Cohérence avec env vars effectivement lues dans le code : grep `process.env.IP_HASH_SALT` etc → toutes les vars utilisées en prod sont dans .env.example
- Score : 60 max

### V2-10 — P0-10 Actions post-publish hors transaction (/80)
- Lire `content-publish-worker.ts` : `enqueueIndexingForTier1()` et `revalidateContent()` sont-ils :
  - Option A : intégrés dans une saga avec retry séparé (préféré)
  - Option B : documentés explicitement comme acceptant l'inconsistance + `indexnow-worker` capable de re-pinger les articles non indexés
- Vérifier idempotence : si `enqueueIndexingForTier1()` échoue 3 fois pour un article, est-ce qu'un mécanisme de re-tentative existe ?
- Test fonctionnel : simuler crash Redis pendant publish → article doit être marqué `published` MAIS aussi marqué comme `needsIndexingRetry=true` ou similaire
- Si pas de mécanisme : -40 pts (article orphelin)
- Si documenté + indexnow-worker re-pinge : 80 pts (acceptable)
- Score : 80 max

### Cross-cutting orchestrateur (/100)
- Cohérence inter-agents (V2-01 à V2-10) : 0 contradiction
- Tests effectués réels (queries DB, simulation race condition, EXPLAIN ANALYZE)
- Recommandations P1 résiduels priorisés
- Gates anti-régression vs baseline P1.5 (typecheck 0, vitest 1376+/1383, prisma migrate status)
- Classification des 5 commits "non-P2" (`56decf0`, `0947d9e`, `8d3d886`) : sont-ils du P4 ou P2 ? (Voir V4 verif aussi)
- Score : 100 max

#### Compliance régressions cross-sprint
- `GenerationProvenance` model : vérifier que P2 (CASCADE→RESTRICT) ne casse pas P1.5 (provenance-logger service)
- Si `Article.campaignId` ajouté NOT NULL : vérifier backfill OK pour articles pré-existants (pas de crash)
- Migrations cross-sprint Prisma : `prisma migrate status` no drift, `prisma validate` OK

**TOTAL : 1000 pts**

---

## 3. GATES ANTI-RÉGRESSION OBLIGATOIRES

```powershell
pnpm typecheck   # 0 erreur (baseline P1.5)
pnpm lint        # 0 erreur (1 warning hors scope OK)
pnpm test        # vitest XXXX/XXXX — DOIT être ≥ baseline 1376/1383
pnpm content-gen:isolation-check  # 0 violation
pnpm prisma migrate status  # no drift, all migrations applied
pnpm prisma validate  # schema valid
```

**Si typecheck/lint/test régressent vs baseline P1.5 → PÉNALITÉ -100 pts global**.

Vérifier aussi :
- pre-commit hooks ×8 verts
- pre-push hooks verts

---

## 4. TESTS FONCTIONNELS RÉELS (obligatoires)

### Test 1 — CASCADE DELETE → RESTRICT
```sql
-- Setup test article + provenance
INSERT INTO articles (id, slug, title, status) VALUES ('test-p2-01', 'test-p2-01', 'Test P2', 'published');
INSERT INTO generation_provenance (id, article_id, prompt_hash, ...) VALUES ('prov-p2-01', 'test-p2-01', 'abc', ...);

-- Test
DELETE FROM articles WHERE id = 'test-p2-01';
-- ATTENDU : ERROR foreign key constraint "generation_provenance_article_id_fkey" prevents

-- Cleanup
DELETE FROM generation_provenance WHERE id = 'prov-p2-01';
DELETE FROM articles WHERE id = 'test-p2-01';
```

### Test 2 — lockDuration 120s
```bash
# Lancer un job content-gen qui prend 80s (forcer via timeout artificiel)
# Vérifier dans BullMQ que le job ne devient PAS 'stalled' à 30s
# Vérifier qu'aucun autre worker ne reprend le job avant les 80s
```

### Test 3 — promptHash réel
```javascript
// Récupérer 1 article récent + sa provenance
const article = await prisma.article.findFirst({ orderBy: { createdAt: 'desc' }, include: { generationProvenance: true } });
const provenance = article.generationProvenance;
// Le prompt utilisé doit être stocké quelque part (logs, journal, ou champ DB)
// Calculer SHA256(prompt_réel) → DOIT correspondre à provenance.promptHash
```

### Test 4 — Race condition cap
```javascript
// Avec concurrency=3 workers actifs
// Cap = 2
// Soumettre 5 jobs publish quasi-simultanés
// Attendre 30s
// SELECT COUNT(*) FROM articles WHERE published_at::date = CURRENT_DATE → DOIT être ≤ 2
```

### Test 5 — Keyword lock + cleanup
```sql
-- Sélectionner 1 keyword
SELECT * FROM keywords WHERE vertical = 'audits' LIMIT 1; -- noter id et locked_until
-- Simuler crash worker (kill process)
-- Vérifier locked_until ≠ NULL et locked_by_job_id ≠ NULL
-- Attendre 15+1 min ou trigger cleanup manuellement
-- Vérifier locked_until = NULL après cleanup
```

### Test 6 — Article.campaignId NOT NULL
```sql
-- Tenter INSERT sans campaign_id
INSERT INTO articles (id, slug, title, status) VALUES ('test-p2-06', 'test-p2-06', 'Test', 'draft');
-- ATTENDU : ERROR null value in column "campaign_id" violates not-null constraint
```

### Test 7 — Rate limit image-bank
```bash
# Bulk import 50 images
# Mesurer durée totale
# DOIT être ≥ 5 minutes (rate limited 10/min × 5 min = 50 images)
```

### Test 8 — Index DB performance
```sql
EXPLAIN ANALYZE SELECT * FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 50;
-- DOIT contenir "Index Scan using idx_articles_status_published_at"

EXPLAIN ANALYZE SELECT * FROM generation_provenance WHERE article_id = '<some_id>' ORDER BY timestamp DESC;
-- DOIT contenir Index Scan

EXPLAIN ANALYZE SELECT id FROM keywords WHERE vertical = 'audits' ORDER BY last_used_at ASC NULLS FIRST, usage_count ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
-- DOIT contenir Index Scan
```

### Test 9 — .env.example complet
```bash
# Pour chaque process.env.X dans le code:
grep -rh "process\.env\.[A-Z_]*" src/ --include="*.ts" -o | sort -u > /tmp/env_used.txt
grep -oE "^[A-Z_]+" .env.example | sort -u > /tmp/env_documented.txt
diff /tmp/env_used.txt /tmp/env_documented.txt
# DOIT être empty (toutes les vars utilisées sont documentées)
```

### Test 10 — Actions post-publish saga
```bash
# Stopper Redis pendant 30s
# Soumettre 1 job publish
# Redémarrer Redis après 30s
# Vérifier que l'article est marqué published ET que l'indexing a été re-tenté avec succès
```

---

## 5. CLASSIFICATION COMMITS "INCONNUS"

Trois commits n'ont pas un nom évident P2 :
- `56decf0` "internalLinkCount regex markdown → HTML + markdown dual-mode"
- `0947d9e` "quality loop re-génère avec feedback LLM-judge (BUG 4)"
- `8d3d886` "module mapping image-bank audit/interventions/implementations/un-a-un"

**Tâche** : pour chacun, déterminer s'il appartient à :
- (A) Sprint correctif P2 (architecture/pipeline)
- (B) Sprint correctif P4 (qualité éditoriale) — vraisemblable pour les 3
- (C) Hors scope sprint (fix indépendant)

Documente la classification dans CROSS-CUTTING.md → cohérence avec vérif P4 (V4-02, V4-03, V4-04 référencent aussi ces commits).

---

## 6. DOCTRINE COMPLIANCE

### Zero régression baseline P1.5
- Migrations idempotentes : `prisma migrate diff` OK
- Vitest count ≥ 1376/1383 (baseline)
- Aucun composant ou Worker P1.5 cassé

### AI Act art. 50 (deadline 2026-08-02)
- CASCADE → RESTRICT effectif (P0-1)
- promptHash réel (P0-3)
- GenerationProvenance traces préservées même si Article supprimé
- Backfill historique : si articles pré-sprint sans promptHash réel, documenté dans verdict comme dette technique

### RGPD art. 17 (droit à l'oubli)
- Si CASCADE → RESTRICT, comment supprimer un Article pour conformité RGPD ?
- Vérifier qu'il existe un mécanisme alternative : soit soft-delete (`deletedAt`), soit `deleteArticleAndProvenance()` qui supprime explicitement les deux dans le bon ordre
- Si supprimer un Article devient impossible : red flag conflit AI Act × RGPD → documenter

### Sécurité
- Vars critiques (IP_HASH_SALT, etc.) dans .env.example mais avec valeurs PLACEHOLDER (jamais vraies clés)
- Pas de leak secret dans logs ou Sentry (sanitize-job-data appliqué)

---

## 7. PERFORMANCE & SCALE

### Scale à 500 art/j
- Monthly caps suffisants ? Verdict P2 mentionnait $100/mois insuffisant pour 500/j ($1411 nécessaire)
- Vérifier `ProviderConfig.monthlyCap` ou env var → ≥ $1500
- Si Will n'a pas augmenté → P1-14 reste pendant, noté dans verdict

### Index performance (P0-8)
- Couvert par Test 8
- Mesurer aussi : `pg_stat_user_indexes` pour vérifier que les nouveaux index sont utilisés (`idx_scan > 0`)

### Redis INCR atomique (P0-4)
- Mesurer latence INCR à p99 : doit être < 10ms en condition normale

---

## 8. LIVRABLES

### Structure
```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/verification/
├── VERDICT-VERIFICATION-SPRINT-P2.md
├── CROSS-CUTTING.md
└── agents/
    ├── V2-01.md  (P0-1 CASCADE → RESTRICT)
    ├── V2-02.md  (P0-2 lockDuration 120s)
    ├── V2-03.md  (P0-3 promptHash réel)
    ├── V2-04.md  (P0-4 Redis INCR atomique)
    ├── V2-05.md  (P0-5 keyword lock + cleanup)
    ├── V2-06.md  (P0-6 Article.campaignId NOT NULL)
    ├── V2-07.md  (P0-7 rate limit image-bank)
    ├── V2-08.md  (P0-8 3 index DB)
    ├── V2-09.md  (P0-9 .env.example)
    └── V2-10.md  (P0-10 actions post-publish saga)
```

### Format VERDICT-VERIFICATION-SPRINT-P2.md
```markdown
# VERDICT VÉRIFICATION SPRINT P2 — Architecture & Data Pipeline
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Score baseline pré-sprint : 726/1000
## **Score vérifié post-sprint : XXX/1000**

## Verdict global
✅ GO si ≥ 850
🟡 CONDITIONNEL si 790-849
🔴 INSUFFISANT si < 790 (verdict initial cible 790 minimum)

## 10 P0 — statut vérifié
| P0 | Spec | Implémenté ? | Test fonctionnel | Score |
|----|------|--------------|------------------|-------|
| P0-1 CASCADE→RESTRICT | ... | ✅/❌ | ✅/❌ | XX/100 |
| P0-2 lockDuration 120s | ... | ✅/❌ | ✅/❌ | XX/80 |
| P0-3 promptHash réel | ... | ✅/❌ | ✅/❌ | XX/100 |
| P0-4 Redis INCR atomique | ... | ✅/❌ | ✅/❌ | XX/120 |
| P0-5 keyword lock | ... | ✅/❌ | ✅/❌ | XX/80 |
| P0-6 Article.campaignId NOT NULL | ... | ✅/❌ | ✅/❌ | XX/80 |
| P0-7 rate limit image-bank | ... | ✅/❌ | ✅/❌ | XX/40 |
| P0-8 3 index DB | ... | ✅/❌ | ✅/❌ | XX/100 |
| P0-9 .env.example | ... | ✅/❌ | ✅/❌ | XX/60 |
| P0-10 saga post-publish | ... | ✅/❌ | ✅/❌ | XX/80 |
| **TOTAL P0** | | | | **XXX/840** |

## Cross-cutting score : XX/100

## P0 manquants ou partiels 🔴
| P0 | Issue | Impact |

## Régressions vs baseline P1.5
| Item | Cause | Sévérité |

## Compliance AI Act art. 50 (deadline 2026-08-02)
- P0-1 CASCADE → RESTRICT : ✅/❌
- P0-3 promptHash réel : ✅/❌
- Verdict compliance : 🟢 CONFORME / 🟡 GAPS / 🔴 NON-CONFORME

## Classification commits "inconnus"
- `56decf0` → P4 / P2 / hors scope
- `0947d9e` → P4 / P2 / hors scope
- `8d3d886` → P4 / P2 / hors scope

## Gates anti-régression
- typecheck : ✅/❌
- vitest : XXXX/XXXX passed
- prisma migrate status : ✅/❌
- prisma validate : ✅/❌

## Tests fonctionnels résultats (10 tests)
- Test 1 (CASCADE → RESTRICT) : ✅/❌
- Test 2 (lockDuration 120s) : ✅/❌
- Test 3 (promptHash réel) : ✅/❌
- Test 4 (race condition cap) : ✅/❌
- Test 5 (keyword lock cleanup) : ✅/❌
- Test 6 (Article.campaignId NOT NULL) : ✅/❌
- Test 7 (rate limit image-bank) : ✅/❌
- Test 8 (index performance) : ✅/❌
- Test 9 (.env.example complet) : ✅/❌
- Test 10 (saga post-publish) : ✅/❌

## P1 résiduels (depuis verdict P2 initial)
- P1-1 retry exponentiel : ✅ fait / ⏳ pending
- P1-3 captureWorkerError quality-improver : ✅/⏳
- P1-6 rampe 30→500 : ✅/⏳
- ... (15 P1 listés)

## Actions Will résiduelles
- W-1 DPA Anthropic : signed ?
- W-2 monthly cap → $1500 : done ?
- W-4 soft-delete arbitrage AI Act × RGPD : tranché ?

## Recommandations
## STOP & ASK Will
```

### Mémoire
Slug : `axionia_verif_sprint_p2_corrections_2026-05-21`

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Vérif Sprint P2 LIVRÉE 2026-05-21 — score XXX/1000](axionia_verif_sprint_p2_corrections_2026-05-21.md) — Audit post-sprint P2 architecture. 10 P0 vérifiés. AI Act compliance status. Régressions cross P1.5.
```

---

## 9. STOP & ASK FINAL

```
✅ Vérification Sprint P2 livrée.
- HEAD : <sha>
- Score vérifié : XXX/1000 (baseline 726)
- 10 P0 : X OK / Y partiels / Z manquants
- Tests fonctionnels : X/10 OK
- AI Act compliance : 🟢/🟡/🔴
- P1 résiduels : X/15 faits

📋 Régressions détectées :

📋 Actions Will pendantes :
- W-1 DPA Anthropic : ✅/⏳
- W-2 monthly cap : ✅/⏳
- W-4 soft-delete : ✅/⏳

🚀 Suite proposée :
[A] Sprint P2 follow-up (P0 manquants critiques avant deadline AI Act)
[B] Attendre vérifs P3+P4+P5 → consolider P6
[C] Sprint S+6 lancement (P1 résiduels + items P2 différés)
```

---

## 10. PHRASE DE LANCEMENT AUTOPILOT

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance la vérification décrite dans `_AUDIT/PROMPT-VERIF-SPRINT-P2-CORRECTIONS-2026-05-21.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code. Lis d'abord PHASE-2-VERDICT.md (10 P0 + 15 P1) + analyse les 6 commits du sprint (17c53bc principal + 51fcbb9 + c1bfa6e + 56decf0 + 0947d9e + 8d3d886). Spawn 10 sous-agents parallèles V2-01 à V2-10. Exécute TOUS les 10 tests fonctionnels obligatoires sans demander confirmation (CASCADE→RESTRICT, lockDuration 120s, promptHash réel SHA256, race condition cap concurrency=3, keyword lock cleanup, Article.campaignId NOT NULL, rate limit image-bank, EXPLAIN ANALYZE 3 index, .env.example diff vs code, saga post-publish Redis crash). Connexion DB locale en lecture seule autorisée. Gates anti-régression vs baseline P1.5 (typecheck 0, vitest 1376+/1383, prisma migrate status no drift, prisma validate OK). Classifier les 3 commits "inconnus" (56decf0/0947d9e/8d3d886) entre P2/P4/hors scope. Self-troubleshoot (si DB inaccessible : skip tests SQL et note dans verdict, si Redis indisponible : marquer Test 4 et Test 10 comme inconcluants). Produis VERDICT-VERIFICATION-SPRINT-P2.md scoré /1000 honnête + 10 rapports agents/V2-XX.md + CROSS-CUTTING.md + mémoire axionia_verif_sprint_p2_corrections_2026-05-21 + MEMORY.md update. Compliance AI Act art. 50 (deadline 2026-08-02) DOIT être un verdict tranché 🟢/🟡/🔴 dans la livraison. STOP & ASK Will UNIQUEMENT à la livraison finale. Go.
```

---

*Vérification Sprint P2 — 5-7h autopilot — AUDIT-ONLY — Tests backend intensifs*
