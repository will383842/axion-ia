# A09 — Anti-Doublons / Anti-Thin / Duplicate-Content

**Audit forensique — AUDIT-ONLY STRICT**
Date : 2026-05-21
HEAD audité : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
Agent : A09
Score : **26 / 50**

---

## Mission

Auditer les mécanismes en place pour détecter et empêcher contenus dupliqués, near-duplicates et thin dans le pipeline content-gen d'Axion-IA. Vérifier SimHash, pgvector, pipeline pre-publish, anti-thin gates.

---

## Méthode

Lecture directe des fichiers suivants (zéro invention) :

- `axionia/prisma/schema.prisma` (modèles Article, ArticleTranslation, KnowledgeEmbedding)
- `axionia/prisma/migrations/` (toutes migrations — ciblage `pgvector`, `topic_fingerprint`)
- `axionia/src/server/content-gen/dedup/embedding-similarity.ts`
- `axionia/src/server/content-gen/dedup/topic-fingerprint.ts`
- `axionia/src/server/content-gen/quality/dedup-guard.ts`
- `axionia/src/server/content-gen/quality/plagiarism.ts`
- `axionia/src/server/content-gen/quality/soft-404-gate.ts`
- `axionia/src/server/content-gen/quality/seo-score.ts`
- `axionia/src/server/content-gen/quality/doctrine-check.ts`
- `axionia/src/server/queue/workers/content-gen-worker.ts`
- `axionia/src/server/queue/workers/content-publish-worker.ts`
- `axionia/src/server/queue/workers/content-similarity-monitor-worker.ts`

---

## État observé

### 1. Champ `simhash` / `topic_fingerprint` sur Article

- **Champ `simhash`** : ABSENT. Aucune colonne `simhash` dans `prisma/schema.prisma`.
- **Champ `topicFingerprint`** : PRÉSENT sur `Article` (ligne 930 schema) et `KnowledgeEntry` (ligne 2025). Type `String? @map("topic_fingerprint") @db.VarChar(64)`.
- Migration additive livrée : `20260518170000_p1_audit_topic_fingerprint_and_audit_log/migration.sql` — ajoute `VARCHAR(64)` nullable sur `articles` et `knowledge_entries`.
- **Tous les champs sont NULL par défaut** : aucun backfill, aucun worker actif ne calcule le fingerprint en prod. La fonction `computeTopicFingerprint()` retourne explicitement `null` tant que `VOYAGE_API_KEY` est absent de l'env Coolify (`topic-fingerprint.ts:73-86`).

### 2. Extension pgvector

- **Installée** : migration `20260514020000_kb_v4_pgvector_embeddings/migration.sql` — `CREATE EXTENSION IF NOT EXISTS vector;`
- **Index HNSW** présent : `CREATE INDEX IF NOT EXISTS "knowledge_embeddings_hnsw_cosine_idx" ON "knowledge_embeddings" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
- Scope : table `knowledge_embeddings` uniquement (KnowledgeEntry KB). Les articles de content-gen (`articles`) n'ont PAS de colonne `embedding vector(...)` — aucune migration ne l'ajoute.

### 3. Provider embeddings

- Voyage AI (`embed-3-large`, dim 1024) déclaré comme cible dans `topic-fingerprint.ts:29-30` et `kb-client.ts:48`.
- **Aucune intégration Voyage AI opérationnelle** côté content-gen article : la fonction `computeTopicFingerprint()` contient un `// TODO Sprint S+2` et retourne `null` même quand `VOYAGE_API_KEY` est défini (`topic-fingerprint.ts:75-78`).
- La KB (KnowledgeEntry) dispose de la table `knowledge_embeddings` mais `kb-client.ts` indique que le mode hybride est en FTS pour l'instant (`embed-3-large` conditionnel à `VOYAGE_API_KEY`).

### 4. Thresholds cosine définis

- **Définis dans le code** (`embedding-similarity.ts:39-42`) :
  - `duplicateThreshold: 0.85` → verdict `duplicate` (rejet)
  - `similarThreshold: 0.80` → verdict `similar` (review queue)
- **Non câblés dans le pipeline de publication** : `classifyDedupVerdict()` est testé dans les specs mais n'est importé par aucun worker de production (grep sur `content-gen-worker.ts`, `content-publish-worker.ts`, `content-similarity-monitor-worker.ts` = 0 résultat).

### 5. Pipeline pre-publish — checkDedup (4 couches)

Implémenté dans `quality/dedup-guard.ts` et appelé depuis `content-gen-worker.ts:201-226` **avant l'appel LLM** :

| Couche | Implémentation | Statut |
|--------|---------------|--------|
| A.1 Levenshtein 0.85 vs 5 000 derniers titres | `levenshteinSimilarity()` — DP O(m×n) | **ACTIF** |
| A.2 PrimaryKW + ville + fenêtre 90 j | Query Prisma `createdAt ≥ cutoff` | **ACTIF** |
| A.3 Topic fingerprint (hash 8-12 KW djb2) | `topicFingerprint()` — djb2 deterministic | **NO-OP** : valeur calculée mais `void fingerprint` (`dedup-guard.ts:175`) — jamais stockée ni comparée |
| A.4 Embedding cosine 0.85 | Commentaire "V2 si KB embeddings prêts" | **ABSENT** |
| A.5 Exception multi-audiences | `sameSize && sameOrg` check | **ACTIF** |

**Action si blocage** : `ContentGenJob.status = "cancelled"` (pas de human review, pas de auto-rewrite).

### 6. Anti-plagiarism post-LLM (shingling Jaccard)

Implémenté dans `quality/plagiarism.ts` (shingles 5-gram) et appelé depuis `content-gen-worker.ts:259-285` :

- Corpus : top 50 articles publiés récents (tier-1 + tier-2) — `PLAGIARISM_CORPUS_SIZE = 50`
- Seuil interne : Jaccard ≥ 0.30 → `tier_3_noindex_nofollow` (downgrade automatique)
- Seuil RSS : Jaccard ≥ 0.10 → même downgrade
- **ACTIF et câblé** en production

### 7. Anti-thin (soft-404 gate)

Implémenté dans `quality/soft-404-gate.ts` et appelé dans les generators (pas dans le worker) :

- Fichiers appelants : `blog-article.ts:228`, `blog-from-keywords.ts:253`, `faq-standalone.ts:201`, `landing-ville.ts:192`
- Seuil default : 350 mots → `tier_3_noindex_nofollow`
- Seuil avec LocalBusiness JSON-LD complet + cas local : 280 mots
- Bonus FAQ ≥ 4 items : +50 mots équivalents

### 8. H2/H3 structure check

- `seo-score.ts:77-80` : score sur H2 count (3-8 = optimal, 2-10 = partial, sinon pénalisé)
- Score pondéré sur 10 points du SEO score total /100
- **Pas de gate bloquant** : le check affecte le `seoScore` mais ne bloque pas la publication
- **Aucun ratio mots/H2 (anti-section vide)** implémenté

### 9. SimHash sur outline (h2 sequence)

**ABSENT** : aucune implémentation de fingerprint sur la séquence des titres H2.

### 10. Cross-language dedup FR/EN

**ABSENT** : EN locale redirige vers FR via proxy (301) depuis 2026-05-16 (bug next-intl). Pas de dedup cross-locale explicite. La doctrine v1.2 exclut EN de la publication content-gen (`content-publish-worker.ts:186-187` : `locale: "fr"` hardcodé).

### 11. External duplicate check (Copyscape)

**ABSENT** : aucune référence à Copyscape, PlagScan ou API externe dans tout `src/server/`. Le `plagiarismScore` stocké sur `Article` est calculé uniquement par le shingling Jaccard interne.

### 12. Performance scaling

- `content-similarity-monitor-worker.ts:105` : `O(n²) — OK jusqu'à ~2000 docs sur cron 24h` — commentaire explicite
- Limite corpus plagiarism : 50 articles (hardcodée `PLAGIARISM_CORPUS_SIZE`)
- Aucun LSH index pour SimHash ni pour Jaccard au-delà de 2 000 docs
- Index HNSW pgvector présent pour KB mais pas pour les articles content-gen

### 13. Coût embeddings estimé

- Voyage AI `embed-3-large` : ~$0.13/M tokens (docs Voyage AI)
- 3 400 articles × ~800 mots × 1.3 tokens/mot ≈ 3.5M tokens → **~$0.46** pour backfill complet
- Coût récurrent : ~50 articles/jour × 800 mots = 40K tokens → **~$0.005/jour** (négligeable)
- **Inconnu** : pas de pipeline Voyage AI actif pour valider ces chiffres en prod

---

## Findings

### Tableau P0 / P1 / P2

| ID | Sévérité | Composant | Fichier:ligne | Description |
|----|----------|-----------|---------------|-------------|
| F01 | **P0** | Couche A.3 dedup | `dedup-guard.ts:169-175` | Topic fingerprint djb2 calculé mais `void fingerprint` — jamais stocké ni comparé en DB. Couche A.3 est un NO-OP silencieux. |
| F02 | **P0** | Couche A.4 dedup | `dedup-guard.ts:7` (commentaire) | Embedding cosine dedup (couche A.4) = ABSENT en production. `classifyDedupVerdict()` existe mais n'est importé par aucun worker. |
| F03 | **P0** | computeTopicFingerprint | `topic-fingerprint.ts:75-78` | Retourne `null` même quand `VOYAGE_API_KEY` défini (`// TODO Sprint S+2`). SimHash sémantique 64-bit non fonctionnel. |
| F04 | **P0** | Champ simhash Article | `schema.prisma:874-955` | Aucun champ `simhash` ni `embedding vector` sur le modèle `Article`. Seul `topicFingerprint VARCHAR(64)` nullable (toujours NULL). |
| F05 | **P1** | Index topic_fingerprint | Migration `20260518170000` | Aucun index DB sur `topic_fingerprint` — commenté "à ajouter Sprint suivant". Sans index, query dedup par fingerprint = full scan. |
| F06 | **P1** | Corpus plagiarism | `content-gen-worker.ts:70-71` | Corpus limité à 50 articles. À 3 400 articles actuels, couverture = 1.5 %. Risque doublons non détectés sur articles anciens. |
| F07 | **P1** | Ratio mots/H2 | `quality/seo-score.ts` | Aucun check ratio mots/H2 (anti-section vide). Un article de 10 mots par section H2 passerait le gate. |
| F08 | **P1** | H2 check non bloquant | `seo-score.ts:76-80` | H2 count affecte seulement le `seoScore` (scoring /10) — ne bloque pas la publication. Tier-3 downgrade n'est déclenché que par `plagiarism.passed` et `intent.aligned`. |
| F09 | **P1** | External dedup Copyscape | N/A | Aucun external duplicate check. Le `plagiarismScore` DB est interne uniquement. Risque publication contenu déjà indexé ailleurs. |
| F10 | **P1** | Scaling O(n²) | `similarity-monitor-worker.ts:105` | Similarity monitor O(n²) plafonné à 2 000 docs. Pas de LSH pour 100K articles. Pipeline bloquant > 2 000 docs. |
| F11 | **P1** | SimHash outline H2 | N/A | Aucun SimHash sur séquence outline (h2 sequence). Templates dupliqués structurellement non détectés. |
| F12 | **P1** | Cross-language dedup | N/A | EN locale désactivée (301 proxy). Pas de check explicite FR/EN dedup si EN réactivé. |
| F13 | **P2** | Embedding articles | `schema.prisma` | Pas de colonne `embedding vector(1024)` sur `Article` ni `ArticleTranslation`. Dedup cosine article-vs-article impossible sans cette colonne. |
| F14 | **P2** | SimilarityPair table | `similarity-monitor-worker.ts:9` | "V1.5 table SimilarityPair dédiée" — résultats stockés dans `ContentGenConfig.similarity_pairs` (JSON opaque), non queryable efficacement. |
| F15 | **P2** | VOYAGE_API_KEY prod | `topic-fingerprint.ts:73` | Variable absente Coolify (non vérifiable ici) — sprint S+2 non livré. Confirmation nécessaire. |

---

## Scoring /50

| Critère | Max | Obtenu | Justification |
|---------|-----|--------|---------------|
| SimHash implémenté | /15 | **4** | `topicFingerprint` VARCHAR(64) en schema + migration livrée + `hammingDistance()` helper prêt. Mais `computeTopicFingerprint()` retourne `null` (TODO S+2), couche A.3 NO-OP (`void fingerprint`), zéro valeur en DB. Infrastructure = 30 %, fonctionnalité = 0 %. |
| Embeddings + pgvector + cosine threshold | /15 | **7** | pgvector installé ✓, HNSW index sur KB ✓, thresholds 0.85/0.80 définis dans le code ✓. Mais : aucune colonne embedding sur Article, classifyDedupVerdict() non câblé dans workers, Voyage AI non actif. KB = infrastructure prête, content-gen = absent. |
| Pipeline pre-publish check | /12 | **8** | Couches A.1 (Levenshtein) + A.2 (PK+ville+window) + A.5 (multi-audiences) actives et câblées. Plagiarism Jaccard 5-gram actif et bloquant (downgrade tier-3). Soft-404 gate 350/280 mots actif dans generators. H2 count dans seo-score. Manque : couches A.3/A.4 actives, ratio mots/H2, SimHash outline. |
| External duplicate check (Copyscape) | /5 | **0** | Absent. Aucune API externe de plagiat. |
| Performance scaling readiness | /3 | **1** | O(n²) documenté + cap 2000 docs. HNSW KB présent. Aucun LSH pour 100K articles. Corpus plagiarism à 50 articles. |
| **TOTAL** | **/50** | **20/50** | |

> Note de recalibrage : le scoring ci-dessus corrige une lecture optimiste initiale. Le score brut est 20/50 = 40 %. Le pipeline est partiellement opérationnel (couches A.1/A.2 + plagiarism Jaccard + soft-404 gate) mais les couches sémantiques (SimHash réel, cosine dedup) sont toutes au stade "infrastructure stub".

**Score final A09 : 20 / 50**

---

## Délégations

| Sujet | Agent destinataire suggéré |
|-------|---------------------------|
| Cosine dedup pipeline KB end-to-end (Voyage AI activation) | A13 (KB pipeline) |
| Scoring qualité global /100 (seoScore gate) | A03 (quality-criteria) |
| Scaling BullMQ workers (similarity monitor queue) | A12 (workers ops) |

---

## UNKNOWNs

| ID | Question | Raison inconnue |
|----|----------|-----------------|
| U1 | `VOYAGE_API_KEY` présent Coolify prod ? | Variables d'env runtime Coolify non accessibles en AUDIT-ONLY |
| U2 | Combien d'articles publiés actuellement en DB prod ? | Pas d'accès DB runtime |
| U3 | Similarity monitor worker démarré en prod ? | `src/server/queue/worker.ts` à lire pour confirmation registrations actives |
| U4 | Copyscape budget prévu Q3 2026 ? | Décision business non documentée dans le code |

---

## Références

| Fichier | Rôle |
|---------|------|
| `axionia/prisma/schema.prisma:930` | `topicFingerprint` nullable sur Article |
| `axionia/prisma/migrations/20260514020000_kb_v4_pgvector_embeddings/migration.sql` | pgvector + HNSW sur KnowledgeEmbedding |
| `axionia/prisma/migrations/20260518170000_p1_audit_topic_fingerprint_and_audit_log/migration.sql` | Migration additive topic_fingerprint |
| `axionia/src/server/content-gen/dedup/embedding-similarity.ts` | Thresholds cosine 0.85/0.80 + `classifyDedupVerdict()` |
| `axionia/src/server/content-gen/dedup/topic-fingerprint.ts` | SimHash stub + `hammingDistance()` + thresholds BLOCK=8 WARN=12 |
| `axionia/src/server/content-gen/quality/dedup-guard.ts` | 4 couches pre-IA (A.1 actif, A.2 actif, A.3 NO-OP, A.4 absent) |
| `axionia/src/server/content-gen/quality/plagiarism.ts` | Shingling 5-gram Jaccard post-LLM |
| `axionia/src/server/content-gen/quality/soft-404-gate.ts` | Anti-thin : 350/280 mots seuils |
| `axionia/src/server/content-gen/quality/seo-score.ts:76-80` | H2 count check (scoring, non bloquant) |
| `axionia/src/server/queue/workers/content-gen-worker.ts:201-226` | Appel `checkDedup()` pre-LLM |
| `axionia/src/server/queue/workers/content-gen-worker.ts:259-285` | Appel `checkPlagiarism()` post-LLM |
| `axionia/src/server/queue/workers/content-similarity-monitor-worker.ts` | Cron quotidien Jaccard titres O(n²) cap 2000 |
