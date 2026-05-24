# CROSS-CUTTING — Thèmes transverses P2
# AxionIA Content-Gen Architecture & Data Pipeline

**Date audit** : 2026-05-21
**Commit HEAD** : 2b98a70 (baseline P1.5 ~770-820/1000)
**Auditeurs** : 10 sous-agents A2-01 à A2-10 (Claude Sonnet 4.6, AUDIT-ONLY)

---

## Contradictions inter-agents

### A2-06 "retry avec backoff" ↔ A2-03 "retry linéaire"
- **A2-03** constate que `withRetry()` a des délais configurés (10s/30s/60s) et classe ça comme "solide".
- **A2-06** confirme que ces délais sont **linéaires** (fixed), pas exponentiels malgré le nom de la fonction — la protection contre thundering herd est donc insuffisante avec 5 workers concurrents en retry simultané.
- **Résolution** : A2-06 est correct. `withRetry()` dans `retry.ts` utilise des paliers fixes, pas `delay × 2^attempt`. P1 à corriger.

### A2-07 "IVFFlat lists=1" ↔ réalité code
- Le prompt P2 (et MEMORY.md) mentionne "migration corrigée HNSW→IVFFlat" mais A2-07 confirme que **HNSW est effectivement utilisé partout** (knowledge_embeddings 1024 dims, articles 1536 dims). IVFFlat n'existe pas dans le codebase.
- La note MEMORY.md sur "IVFFlat lists=1" était erronée — le choix final est HNSW. A2-07 a audité correctement avec les vrais fichiers.

### A2-09 "promptHash AI Act" ↔ A2-04 "traçabilité chainée"
- **A2-04** valide la traçabilité end-to-end via `ContentGenJob.id` comme pivot.
- **A2-09** révèle que `promptHash` dans `generation_provenance` est en réalité `hash(contentType:jobId:articleId)` — **pas** le hash du prompt LLM réel.
- **Résolution** : La traçabilité structurelle est correcte (A2-04), mais la traçabilité sémantique AI Act est creuse (A2-09 a raison). Le hash ne permet pas de reconstituer le prompt original.

---

## Thèmes récurrents (cités par 2+ agents)

### 🔴 Thème 1 — Atomicité et état cohérent (A2-06 + A2-08 + A2-03)
Trois agents indépendants identifient des race conditions différentes dans le même pipeline :
- **A2-06** : `lockDuration` BullMQ non configuré (défaut 30s) → jobs dépassant 30s repassent en `stalled` → double-exécution → double `Article.create`
- **A2-08** : Requête SKIP LOCKED sans wrapper `$transaction()` + absence de `lockedUntil` sur `Keyword` → crash worker = keyword "brûlé" sans rollback
- **A2-03** : Race condition MAX_PUBLISH_PER_DAY avec concurrency=3 (count→check→publish non atomique)
- **Priorité double** : ces 3 bugs peuvent interagir pour créer des doublons d'articles publiés en production.

### 🔴 Thème 2 — Conformité AI Act art. 50 (A2-09 + A2-04 + A2-05)
- **A2-09** : `ON DELETE CASCADE` sur `generation_provenance` → suppression article = perte trace légale
- **A2-09** : `promptHash` sémantiquement creux (hash jobId, pas prompt réel)
- **A2-04** : Aucun `correlationId`/`traceId` propagé entre workers
- **A2-05** : Promesse "DB-managed" de `JUDGE_THRESHOLDS` non implémentée (hardcoded `as const`)
- **Deadline AI Act** : 2026-08-02 (< 3 mois). Risque légal P0 critique.

### 🟠 Thème 3 — Coûts Anthropic non maîtrisés à l'échelle (A2-03 + A2-01 + A2-06)
- **A2-03** : Monthly caps actuels ($100/mois Anthropic) atteints en ~2 jours à 500 articles/jour
- **A2-01** : Workers `image-bank-enrich` et `image-bank-translate` sans `limiter` Claude → burst non contrôlé
- **A2-06** : Circuit breakers en mémoire par process → protection anti-runaway inefficace en multi-instance
- **Calcul A2-03** : 500 articles/jour ≈ $1 411/mois (dépasse caps × 14×)

### 🟠 Thème 4 — Observabilité insuffisante pour le debug prod (A2-04 + A2-01 + A2-06)
- **A2-04** : ~40 `console.log` bruts dans les workers, 0 corrélation entre BullMQ Job.id et ContentGenJob.id
- **A2-01** : Absence de dashboard BullMQ natif (bull-board/Arena)
- **A2-06** : Circuit breakers sans alerte Telegram quand ils s'ouvrent (TODO non implémenté)
- **Conséquence** : Un incident prod (ex: boucle infinie jobs stalled) sera difficile à diagnostiquer sans SSH.

### 🟡 Thème 5 — Configuration éparpillée (A2-05 + A2-03 + A2-08)
- **A2-05** : 31 vars `process.env` non documentées dans `.env.example`, JUDGE_THRESHOLDS hardcodés
- **A2-03** : `BUDGET_CAP_USD=$0.15` hardcodé dans le code, pas configurable via env
- **A2-08** : Filtrage campagne par `vertical` uniquement (pas `campaignId`) → deux campagnes même vertical partagent leur pool keywords

---

## Dépendances P2 → P3 (SEO/AEO/GEO)

| Fix P2 requis | Impact P3 |
|---|---|
| **A2-09** : Corriger `ON DELETE CASCADE` → `RESTRICT` sur `generation_provenance` | P3 devra exposer `aiGenerated:true` dans JSON-LD — nécessite que la trace soit intègre |
| **A2-09** : Corriger `promptHash` pour hasher le prompt réel | Conformité AI Act art. 50 pour marquage JSON-LD — l'audit trail doit être réel |
| **A2-08** : Ajouter `Article.campaignId NOT NULL` | P3 analytics SEO par campagne nécessite cette FK propre |
| **A2-04** : Ajouter champ `generation_cost` dans logs | P3 reporting ROI contenu (coût/article × trafic organique) |

## Dépendances P2 → P4 (Éditorial)

| Fix P2 requis | Impact P4 |
|---|---|
| **A2-05** : `JUDGE_THRESHOLDS` DB-managed implémenté | P4 devra proposer des valeurs calibrées par verticale — impossible si hardcodé |
| **A2-06** : Rollback publication atomique | P4 éditorial review workflow nécessite états `PUBLISHED/DRAFT` fiables |
| **A2-03** : Rampe progressive 30→500 codée | P4 monte à 500 art/j — sans rampe, P3 SEO score sera dilué par mauvaise qualité |

## Dépendances P2 → P5 (Console admin)

| Fix P2 requis | Impact P5 |
|---|---|
| **A2-05** P2-5 : `JUDGE_THRESHOLDS` dans ContentGenConfig DB | P5 devra créer la page admin de configuration des seuils |
| **A2-01** : Dashboard BullMQ natif | P5 console admin doit exposer métriques queues en temps réel |
| **A2-08** : `campaignId` comme dimension d'isolation | P5 page "campagnes actives" nécessite isolation fiable |

---

## Risques systémiques identifiés

### 🔴 RISQUE CRITIQUE — Double publication d'articles
**Interaction** : `lockDuration=30s` (BullMQ défaut) × jobs pouvant durer 100s (withRetry 3×) × `concurrency=3`
**Scénario** : Worker 1 prend job, dure 35s → BullMQ le marque `stalled` → Worker 2 reprend le même job → 2 articles créés avec le même keyword.
**Impact** : Doublons indexés Google → pénalité duplicate content + état DB incohérent.
**Fix** : `lockDuration: 120000` dans worker options (2 min > durée max retry).

### 🔴 RISQUE CRITIQUE — Violation AI Act deadline 2026-08-02
**Interaction** : `ON DELETE CASCADE` sur `generation_provenance` + action admin `deleteArticle()` existante
**Scénario** : Will supprime un article depuis l'admin (légitimement) → toutes les traces de génération IA sont détruites → non-conformité AI Act.
**Fix** : Changer FK en `RESTRICT` ou `NO ACTION` + soft delete sur Article.

### 🟠 RISQUE COÛT — Runaway cost à 500 articles/jour
**Calcul** : 500 art/j × $2.82/article (contenu + judge + image-bank) = **$1 411/mois**.
Monthly cap Anthropic actuel = $100 → dépassé en < 3 jours.
**Fix** : Augmenter caps à $1 500/mois Anthropic + $300/mois OpenAI, et implémenter rampe progressive codée.

### 🟠 RISQUE RACE CONDITION — MAX_PUBLISH_PER_DAY non thread-safe
**Scénario** : 3 workers vérifient le cap simultanément (count=29 pour cap=30) → 3 articles publiés = 32 total.
**Fix** : Compteur atomique Redis `INCR axion:pub:$(date +%Y%m%d)` + `EXPIRE` à minuit UTC.

### 🟡 RISQUE ISOLATION — Pool keywords partagé entre campagnes de même verticale
**Scénario** : Campagne Paris×formation + Campagne Lyon×formation → même pool keywords `WHERE vertical='interventions_formations'`.
**Fix** : Ajouter `AND campaign_id = ${campaignId}` dans la requête SKIP LOCKED.

---

## Wins rapides transverses (impact immédiat, effort < 2h)

| Action | Effort | Impact | Agents concernés |
|---|---|---|---|
| `lockDuration: 120000` dans content-gen-worker options | 10 min | Éliminer risk double-article | A2-06, A2-01 |
| `ON DELETE RESTRICT` sur FK `generation_provenance.article_id` | 15 min | Conformité AI Act baseline | A2-09 |
| Ajouter filtre `AND campaign_id = ${campaignId}` dans SKIP LOCKED | 30 min | Isolation parfaite multi-campagnes | A2-08 |
| `MAX_PUBLISH_PER_DAY` via Redis INCR atomique | 1h | Race condition publish cap | A2-03, A2-08 |
| Log `keyword_select_exhausted` dans keyword-selector.ts | 30 min | Prévenir incident prod silencieux | A2-04, A2-10 |
| 3 index DB manquants (articles status+published_at, generation_provenance article_id+timestamp, keywords vertical+last_used_at) | 1h | -60 à -70% sur requêtes fréquentes | A2-02, A2-07 |
