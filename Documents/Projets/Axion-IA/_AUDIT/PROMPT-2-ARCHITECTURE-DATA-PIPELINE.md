# 🏗️ PROMPT P2 — ARCHITECTURE & DATA PIPELINE AUDIT (Content-Gen AxionIA)

> **Fichier** : `_AUDIT/PROMPT-2-ARCHITECTURE-DATA-PIPELINE.md`
> **Phase** : P2 sur 7 (pipeline content-gen perfection 2026)
> **Date création** : 2026-05-21
> **Mode** : `AUDIT-ONLY` — lecture seule, zéro commit, zéro modification de code prod
> **Score** : /1000 avec seuils GO(≥900) / CONDITIONNEL(750-899) / NO-GO(<750)
> **Durée estimée** : 8-10h Claude autopilot (10 sous-agents parallèles)
> **Self-contained** : ce fichier suffit — aucun contexte externe requis pour l'exécuter

---

## 0. CONTEXTE PROJET — ÉTAT P1.5 LIVRÉ

### Stack technique
- **Frontend / API** : Next.js 16 App Router (TypeScript strict)
- **ORM** : Prisma 5.22, PostgreSQL 16 + pgvector extension
- **Queue** : BullMQ (Redis), workers Node.js isolés
- **Infra** : Coolify (VPS Hetzner CPX42, 16 GB RAM, 8 vCPU), GitHub Actions CI/CD → GHCR → Coolify pull
- **AI** : Claude Sonnet 4.6 (Anthropic SDK), OpenAI Embeddings (optionnel, flag `OPENAI_EMBEDDINGS_ENABLED`)
- **Monitoring** : Sentry, logs JSON structurés
- **Repo** : `will383842/axion-ia`, branche `main`, HEAD `37ca0147`

### Score baseline P1.5
- **Score D-État** : ~770-820/1000 (post-Phase B P1.5)
- **Vitest** : 1376/1383 (7 skipped non-critiques)
- **Publication cap** : `MAX_PUBLISH_PER_DAY=30` (rampe progressive jusqu'à 500)
- **HOLD levé** : double HOLD compliance AI Act + Google Policy levé Phase A
- **DPA Anthropic** : non signé — risque résiduel documenté, ne bloque pas P2

### Composants livrés en P1.5 (à auditer dans ce prompt P2)

| Composant | Fichier (chemin probable) | Mission |
|---|---|---|
| `keyword-selector.ts` | `src/server/content-gen/keyword-selector.ts` | Sélection keyword atomique `FOR UPDATE SKIP LOCKED` PostgreSQL |
| `dedup-guard.ts` | `src/server/content-gen/dedup-guard.ts` | SimHash 4 couches + pgvector IVFFlat 3072 dim |
| `llm-judge.ts` | `src/server/content-gen/llm-judge.ts` | Claude Sonnet 4.6 reviewer 7 dimensions qualité |
| `assignHeroImage` | `src/server/content-gen/hero-image-assigner.ts` (probable) | Scoring image-bank → hero article |
| `GenerationProvenance` | `src/server/content-gen/generation-provenance.ts` (probable) | Hash chainé AI Act art. 50 traçabilité |
| `pauseCampaign` | `src/server/content-gen/campaign-manager.ts` (probable) | BullMQ purge jobs campagne |
| Verticale `sites_web_augmentes` | Enum Prisma + migration | 6e verticale AxionIA |

### Workers existants (à auditer architecture)

| Worker | Mission |
|---|---|
| `content-gen-worker` | Génération articles (Claude API) |
| `content-publish-worker` | Publication + `MAX_PUBLISH_PER_DAY` gate |
| `content-quality-improver-worker` | Boucle amélioration qualité post-génération |
| `indexnow-worker` | Ping IndexNow après publication |
| `rss-ingestion-worker` | Ingestion flux RSS sources externes |
| `image-bank-*-workers` (×4) | Pipeline Sharp variants + traduction + EXIF + watermark |

### 7 P2 différés (non bloquants P1.5 — à évaluer dans agent A2-10)

| # | Description | Effort estimé |
|---|---|---|
| P2-1 | Env vars exhaustives dans `.env.example` | ~30 min |
| P2-2 | Couche 4 embeddings pre-publish wiring complet | ~4-6h |
| P2-3 | Frontend `Image` rendu `Article.featuredImage` (Next.js `<Image>`) | ~2h |
| P2-4 | Log warning `keyword_select_exhausted` | ~1h |
| P2-5 | `JUDGE_THRESHOLDS` DB-managed (admin configurable) | ~4-6h |
| P2-6 | Voyage AI topic-fingerprint integration | ~6-10h |
| P2-7 | Bonus translation `assignHeroImage` (FR+EN hero distinct) | ~3-4h |

### Décisions Will canoniques à respecter dans l'audit

| # | Décision | Impact audit |
|---|---|---|
| D-W1 | Cap = 30/jour initial → 500/jour progressif avec gates qualité | Auditer le mécanisme de rampe |
| D-W2 | DPA Anthropic non signé — risque assumé Will | Auditer exposition PII dans jobs BullMQ |
| D-W3 | `factoryAutoPublishAllBlogTypes` ON — review ultérieure | Auditer impact conformité actuel |
| D-W4 | `OPENAI_EMBEDDINGS_ENABLED=false` par défaut | Auditer fallback sans embeddings |
| D-W5 | IVFFlat `lists=1` → passer à 100 après ≥10k rows backfill | Auditer plan migration index |

---

## 1. MODE OPÉRATOIRE

### AUDIT-ONLY — Règles absolues

```
┌─────────────────────────────────────────────────────────────┐
│  MODE : AUDIT-ONLY STRICT                                   │
│                                                             │
│  ✅ AUTORISÉ                                                │
│    - Read, Grep, Glob sur tout le repo                      │
│    - git log, git diff, git show (lecture seule)            │
│    - Écriture UNIQUEMENT dans _AUDIT/CONTENT-GEN-           │
│      PERFECTION-2026/phase-2/ (nouveaux fichiers .md)       │
│                                                             │
│  ❌ INTERDIT                                                │
│    - Modifier tout fichier hors _AUDIT/                     │
│    - git commit, git push, git stash                        │
│    - Appeler APIs externes (Claude, OpenAI, etc.)           │
│    - Inventer des faits — si incertain → [UNKNOWN]          │
│    - Générer images via DALL-E / IA générative              │
└─────────────────────────────────────────────────────────────┘
```

### Spawn 10 sous-agents parallèles

Lance les 10 agents **A2-01 à A2-10 simultanément** (pas séquentiellement). Chaque agent :
1. Lit les fichiers source pertinents (chemins indiqués dans chaque section)
2. Produit son livrable dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/agents/A2-{NN}.md`
3. Retourne son score `/max` à l'orchestrateur

L'orchestrateur (toi) :
- Attend la complétion de tous les agents
- Agrège les scores dans `PHASE-2-VERDICT.md`
- Produit `CROSS-CUTTING.md` avec les thèmes transverses
- Termine par le verdict GO / CONDITIONNEL / NO-GO

### Anti-patterns interdits

- ❌ "À améliorer" sans précision → doit inclure : fichier exact, ligne approximative, critère d'acceptation, impact chiffré
- ❌ Conseils génériques sans ancrage code → cite la fonction/classe/table Prisma concernée
- ❌ Copier-coller de best practices sans vérifier l'existant → lire d'abord, analyser ensuite
- ❌ Score subjectif — chaque point retiré = justification concrète dans le fichier agent
- ❌ Ignorer les contraintes Will (D-W1 à D-W5) — elles sont des faits, pas des options

---

## 2. STRUCTURE DES LIVRABLES

```
_AUDIT/CONTENT-GEN-PERFECTION-2026/
└── phase-2/
    ├── PHASE-2-VERDICT.md          ← Orchestrateur : agrège + verdict final
    ├── CROSS-CUTTING.md            ← Thèmes transverses + contradictions inter-agents
    └── agents/
        ├── A2-01.md               ← Architecture BullMQ queues
        ├── A2-02.md               ← Prisma schema cohérence
        ├── A2-03.md               ← Rate limiting & cost control
        ├── A2-04.md               ← Observability
        ├── A2-05.md               ← Configuration management
        ├── A2-06.md               ← Error handling & resilience
        ├── A2-07.md               ← Performance DB
        ├── A2-08.md               ← Multi-campagnes concurrence
        ├── A2-09.md               ← Sécurité & conformité pipeline
        └── A2-10.md               ← Sprint S+6 roadmap différés
```

Créer le dossier `phase-2/agents/` avant de lancer les agents.

---

## 3. AGENTS — DÉFINITIONS DÉTAILLÉES

---

### A2-01 — Architecture BullMQ Queues

**Score** : /70
**Mission** : Auditer la topologie des queues BullMQ, leur configuration, et la capacité à exécuter des campagnes parallèles sans interférence.

**Fichiers à lire en priorité** :
```
src/server/queue/workers/content-gen-worker.ts
src/server/queue/workers/content-publish-worker.ts
src/server/queue/workers/content-quality-improver-worker.ts
src/server/queue/workers/indexnow-worker.ts
src/server/queue/workers/rss-ingestion-worker.ts
src/server/queue/workers/image-bank-*-worker.ts (×4)
src/server/queue/queues.ts (ou equivalent — chercher avec Glob)
src/server/queue/index.ts
src/server/content-gen/campaign-manager.ts (probable)
src/server/content-gen/pauseCampaign.ts (ou dans campaign-manager)
```

**Recherches complémentaires** :
```bash
# Trouver tous les fichiers queue/worker
Glob: src/server/queue/**/*.ts
Glob: src/server/workers/**/*.ts

# Trouver les définitions de queues
Grep: "new Queue(" --type ts
Grep: "new Worker(" --type ts
Grep: "BullMQ" --type ts
Grep: "defaultJobOptions" --type ts
Grep: "removeOnComplete\|removeOnFail\|attempts\|backoff" --type ts
```

**Points à auditer** :

1. **Topologie queues** (0-15 pts)
   - Combien de queues distinctes existent ?
   - Nommage cohérent ? (convention `axion:{domaine}:{action}` recommandée)
   - Séparation correcte génération / publication / qualité / indexnow / rss / image-bank ?
   - Pas de monolithe queue unique qui mélange des responsabilités ?

2. **Configuration retry & dead-letter** (0-20 pts)
   - `attempts` configuré sur chaque worker (valeur : 3-5 recommandé)
   - `backoff: { type: 'exponential', delay: 2000 }` présent ?
   - Dead Letter Queue (DLQ) configurée pour les jobs poison pill ?
   - `removeOnFail` : gardé assez longtemps pour debug (≥7j) ou purgé trop tôt ?
   - `removeOnComplete` : nettoyage après succès (max 1000 jobs) ?

3. **Concurrence & backpressure** (0-20 pts)
   - `concurrency` configuré par worker ?
   - Rate limit BullMQ (`limiter: { max, duration }`) présent sur workers Anthropic/OpenAI ?
   - Pas de fan-out non maîtrisé (un job qui génère N jobs sans limite) ?
   - `pauseCampaign()` : la purge BullMQ est-elle correcte ? Utilise `queue.drain()` ou `queue.obliterate()` ? Que se passe-t-il si un job est `active` (en cours) au moment de la pause ?

4. **Multi-campagnes parallèles** (0-15 pts)
   - Peut-on lancer 2 campagnes (ex: Paris ×formation + Lyon ×audit) en même temps sans interférence ?
   - Chaque job porte-t-il un `campaignId` en data permettant filtrage ?
   - Les workers filtrent-ils par `campaignId` ou prennent-ils n'importe quel job ?
   - Isolation memory/CPU entre campagnes respectée ?

**Scoring A2-01** :
- 63-70 : Architecture BullMQ solide, production-ready multi-campagnes
- 50-62 : Gaps configuration mais fonctionnel
- 35-49 : Problèmes concurrence ou DLQ manquant
- <35 : Architecture fragile, risque de corruption données ou jobs orphelins

**Format livrable A2-01.md** :
```markdown
# A2-01 — Architecture BullMQ Queues

## Score : X/70

## 1. Topologie (X/15)
[Schéma textuel des queues trouvées]
[Gaps identifiés]

## 2. Configuration retry & DLQ (X/20)
[Tableau workers × config trouvée vs recommandée]
[Code snippet exact si problème]

## 3. Concurrence & backpressure (X/20)
[Analyse par worker]
[pauseCampaign() analyse exacte]

## 4. Multi-campagnes (X/15)
[Test logique : 2 campagnes simultanées → isolation ?]

## P0 identifiés (bloquants)
## P1 identifiés (importants)
## Recommandations ordonnées par impact
```

---

### A2-02 — Prisma Schema Cohérence

**Score** : /80
**Mission** : Auditer la cohérence du schéma Prisma, les relations, les index manquants, les requêtes N+1 potentielles, et l'intégrité des migrations.

**Fichiers à lire en priorité** :
```
prisma/schema.prisma
prisma/migrations/ (liste des fichiers)
src/server/content-gen/keyword-selector.ts
src/server/content-gen/dedup-guard.ts
src/server/content-gen/generation-provenance.ts (probable)
src/server/content-gen/campaign-manager.ts (probable)
src/server/content-gen/*.ts (tous)
```

**Recherches complémentaires** :
```bash
Grep: "@@index\|@@unique\|@unique" prisma/schema.prisma
Grep: "findMany\|findFirst\|include:" --type ts -C 3
Grep: "FOR UPDATE SKIP LOCKED" --type ts
Grep: "pgvector\|IVFFlat\|HNSW\|vector" --type ts
Grep: "sites_web_augmentes\|SitesWebAugmentes" --type ts
Grep: "GenerationProvenance\|Provenance" --type ts
```

**Points à auditer** :

1. **Modèles content-gen** (0-20 pts)
   - Modèles présents : `Article`, `CoverageCampaign`, `GenerationProvenance`, `KeywordSeed`, `ContentJob` (ou équivalent) ?
   - La verticale `sites_web_augmentes` est-elle dans l'enum Prisma + migration appliquée ?
   - `GenerationProvenance` : champ `chainHash` (ou équivalent) pour AI Act art. 50 ? Type `String` ou `Bytes` ? Longueur ?
   - Relations correctes : `Article.campaign`, `Article.provenance`, `Article.heroImage` → nullable vs required ?
   - Champs `createdAt`/`updatedAt` présents sur tous les modèles content-gen ?

2. **Index manquants** (0-20 pts)
   - `KeywordSeed` : index sur `(campaignId, status)` pour `FOR UPDATE SKIP LOCKED` efficace ?
   - `Article` : index sur `(status, publishedAt)` pour dashboards ?
   - `Article` : index sur `(campaignId, status)` pour filtres campagne ?
   - `GenerationProvenance` : index sur `chainHash` pour dédup ?
   - `ContentJob` (ou équivalent) : index sur `(workerId, status)` ?
   - Vérifier `EXPLAIN ANALYZE` possible via `prisma.$queryRaw` — pas d'index inadapté sur haute cardinalité ?

3. **Requêtes N+1** (0-20 pts)
   - Chercher tous les `findMany` sans `include` approprié dans les workers
   - Y a-t-il des boucles `for ... of` avec `findFirst` à l'intérieur → N+1 classique ?
   - `content-quality-improver-worker` : charge-t-il les relations en une requête ou boucle ?
   - `keyword-selector.ts` : la requête `FOR UPDATE SKIP LOCKED` est-elle dans `$queryRaw` ou via Prisma ORM natif ?

4. **Migrations intégrité** (0-20 pts)
   - Pas de migration squashée ou manquante (vérifier séquence chronologique)
   - La migration `sites_web_augmentes` verticale est-elle présente ?
   - Migrations idempotentes (pas de `CREATE TABLE IF NOT EXISTS` manquant) ?
   - Pas de `ALTER COLUMN` sans `DEFAULT` sur colonnes non-nullable sur prod ?
   - `prisma migrate status` : état drift ? (lire le dernier log si disponible)

**Scoring A2-02** :
- 72-80 : Schéma production-grade, index complets, zéro N+1
- 56-71 : Gaps index mais pas critiques, quelques N+1 tolérables
- 40-55 : Index manquants sur requêtes fréquentes, N+1 confirmés
- <40 : Schéma incohérent, migrations risquées, refactor urgent

**Format livrable A2-02.md** :
```markdown
# A2-02 — Prisma Schema Cohérence

## Score : X/80

## 1. Modèles content-gen (X/20)
[Liste modèles trouvés avec champs clés]
[Gaps vs attendu]

## 2. Index manquants (X/20)
[Tableau : table × colonne × index présent/manquant × impact perf]

## 3. Requêtes N+1 (X/20)
[Liste requêtes problématiques avec fichier:ligne]

## 4. Migrations intégrité (X/20)
[Liste migrations + état]
[Risques identifiés]

## P0 identifiés
## P1 identifiés
## SQL recommandations (index à ajouter)
```

---

### A2-03 — Rate Limiting & Cost Control

**Score** : /90
**Mission** : Auditer tous les mécanismes de contrôle des coûts et rate limits sur les APIs externes (Anthropic, OpenAI, éventuellement Perplexity), avec focus sur les limites configurables et l'alerting dépassement.

**Fichiers à lire en priorité** :
```
src/server/content-gen/llm-judge.ts
src/server/content-gen/keyword-selector.ts
src/server/content-gen/dedup-guard.ts
src/server/providers/ (tous fichiers)
src/server/queue/workers/content-gen-worker.ts
src/server/queue/workers/content-publish-worker.ts
src/server/lib/anthropic*.ts (probable)
src/server/lib/openai*.ts (probable)
.env.example (si existe)
```

**Recherches complémentaires** :
```bash
Grep: "anthropic\|Anthropic\|claude" --type ts -l
Grep: "openai\|OpenAI\|embeddings" --type ts -l
Grep: "MAX_PUBLISH_PER_DAY\|maxPublish\|dailyCap" --type ts
Grep: "rateLimit\|rate_limit\|RateLimit\|limiter" --type ts
Grep: "cost\|Cost\|budget\|Budget\|spend\|Spend" --type ts
Grep: "ANTHROPIC_COST\|COST_PER_\|costCap\|maxCost" --type ts
Grep: "Sentry.captureException\|captureWorkerError" --type ts -C 2
```

**Points à auditer** :

1. **Limites par worker Anthropic** (0-25 pts)
   - `content-gen-worker` : combien d'appels Claude par article ? Tokens estimés input/output ?
   - `llm-judge.ts` : même question (7 dimensions = 7 appels ? ou 1 seul ?)
   - Rate limit BullMQ ou wait entre appels pour respecter Anthropic tier limits ?
   - Gestion `429 Too Many Requests` : retry avec backoff ou crash ?
   - Estimation coût par article généré (input + output tokens × prix Sonnet 4.6) : calculer manuellement depuis le code

2. **Limites OpenAI Embeddings** (0-20 pts)
   - `OPENAI_EMBEDDINGS_ENABLED=false` : le flag coupe-t-il TOUS les appels OpenAI ?
   - Y a-t-il un fallback (ex: embeddings locaux / hash SimHash) si OpenAI désactivé ?
   - Quand activé : combien d'embeddings par article ? Coût estimé par article (3072 dim = text-embedding-3-large) ?
   - Batch embeddings ou un appel par texte ?

3. **Cap journalier `MAX_PUBLISH_PER_DAY`** (0-25 pts)
   - Où est définie la constante ? (chercher dans code)
   - Comment est-il compté (compteur Redis ? requête DB `COUNT(*)` ? ) ?
   - Thread-safe si plusieurs workers publient en parallèle ?
   - Resetté à minuit UTC ou minuit CET ?
   - La rampe progressive (D-W1 : 30 → 500) est-elle codée ou juste commentée ?
   - Alerting si cap atteint ? (Sentry event, log warn, email ?)

4. **Cost cap configurable & alerting** (0-20 pts)
   - Existe-t-il un budget max Anthropic configurable (env var `MAX_ANTHROPIC_COST_PER_DAY` ou équivalent) ?
   - Si non : risque runaway cost si bug boucle infinie
   - Tracking coût par article dans DB (champ `generationCost` ou équivalent sur `Article`) ?
   - Alerting Sentry sur dépassement seuil coût ?
   - Pas de secrets API dans logs (sanitize-job-data appliqué) ?

**Scoring A2-03** :
- 81-90 : Cost control complet, rate limits solides, alerting opérationnel
- 63-80 : Cap publish OK, mais cost tracking partiel ou alerting manquant
- 45-62 : Rate limits absents ou partiels, risque runaway cost
- <45 : Pas de contrôle coût — P0 critique avant scale

**Format livrable A2-03.md** :
```markdown
# A2-03 — Rate Limiting & Cost Control

## Score : X/90

## 1. Limites Anthropic par worker (X/25)
[Tableau : worker × appels Claude × tokens estimés × coût/article]
[Gestion 429 trouvée ou manquante]

## 2. Limites OpenAI Embeddings (X/20)
[Flag OPENAI_EMBEDDINGS_ENABLED : coverage complète ?]
[Fallback trouvé ou manquant]

## 3. Cap journalier MAX_PUBLISH_PER_DAY (X/25)
[Implémentation exacte : fichier:ligne]
[Thread-safety analyse]
[Rampe progressive : codée ou TODO ?]

## 4. Cost cap & alerting (X/20)
[Budget max : présent / absent]
[Coût estimé 30 articles/jour en €]
[Coût estimé 500 articles/jour en €]

## P0 identifiés
## P1 identifiés
## Recommandations priorisées
```

---

### A2-04 — Observability

**Score** : /80
**Mission** : Auditer la qualité des logs structurés JSON, les captures Sentry sur les workers content-gen, et les métriques BullMQ exposées — avec focus sur les champs métier obligatoires.

**Champs de log obligatoires à vérifier** :
- `keyword_select` : keyword sélectionné + campagne + durée sélection
- `hero_image_pending` : article sans hero image + raison (image-bank vide ? scoring trop bas ?)
- `dedup_check` : résultat SimHash (pass/fail, couches vérifiées, similarité score)
- `quality_loop_pass` : résultat llm-judge (score 7-dim, pass/fail, retry count)
- `generation_cost` : tokens Anthropic input + output + coût € estimé

**Fichiers à lire en priorité** :
```
src/server/queue/workers/content-gen-worker.ts
src/server/queue/workers/content-publish-worker.ts
src/server/queue/workers/content-quality-improver-worker.ts
src/server/content-gen/keyword-selector.ts
src/server/content-gen/dedup-guard.ts
src/server/content-gen/llm-judge.ts
src/server/content-gen/hero-image-assigner.ts (probable)
src/lib/logger*.ts (chercher)
src/server/queue/helpers/captureWorkerError.ts (probable)
src/server/queue/helpers/sanitize-job-data.ts (probable)
```

**Recherches complémentaires** :
```bash
Grep: "console\.\(log\|warn\|error\|info\)" --type ts -- src/server/queue/
Grep: "logger\.\|log\.\|structured\|json.*log" --type ts -C 2
Grep: "Sentry\." --type ts -- src/server/
Grep: "captureWorkerError\|captureException" --type ts
Grep: "keyword_select\|hero_image\|dedup_check\|quality_loop\|generation_cost" --type ts
Grep: "BullMQ\|getJobCounts\|getMetrics\|bull-board\|Arena" --type ts
```

**Points à auditer** :

1. **Logs structurés JSON** (0-25 pts)
   - Les workers utilisent-ils `console.log` brut (bad) ou un logger structuré (`pino`, `winston`, custom) ?
   - Les 5 champs métier obligatoires sont-ils loggués ? (keyword_select, hero_image_pending, dedup_check, quality_loop_pass, generation_cost)
   - Format : `{ event: "...", campaignId: "...", articleId: "...", duration_ms: N, ... }` ?
   - Niveau de log approprié (`info` pour flux normal, `warn` pour dégradé, `error` pour exception) ?
   - Pas de données PII dans les logs (titres articles OK, contenu brut NON, email user NON) ?

2. **Sentry captures** (0-20 pts)
   - `captureWorkerError` helper utilisé dans tous les workers content-gen ?
   - Les 4 workers chokepoint (publish/gen/orchestrator/indexnow) ont-ils leur capture Sentry ?
   - Tags Sentry utiles : `campaignId`, `workerId`, `jobId`, `verticale` ?
   - Breadcrumbs Sentry pour tracer le chemin d'exécution ?
   - `sanitize-job-data` appliqué avant envoi Sentry (PII/secrets) ?

3. **Métriques BullMQ** (0-20 pts)
   - Dashboard BullMQ exposé (bull-board, BullMQ Arena, ou custom) ?
   - Métriques par queue : `waiting`, `active`, `completed`, `failed`, `delayed` accessibles ?
   - Alerting sur `failed` count > seuil ? (Sentry ou webhook)
   - Historique jobs failed consultable (durée rétention) ?

4. **Traçabilité end-to-end** (0-15 pts)
   - Peut-on tracer un article depuis son `KeywordSeed` → `ContentJob` → `Article` → `IndexNow` avec un seul ID ?
   - `correlationId` ou `traceId` propagé entre workers ?
   - `GenerationProvenance.chainHash` permet-il de retrouver tous les artefacts d'une génération ?

**Scoring A2-04** :
- 72-80 : Observability production-grade, debug facile en prod
- 56-71 : Sentry OK mais logs partiellement structurés
- 40-55 : Logs non structurés, debug prod difficile
- <40 : Blind — impossible diagnostiquer incidents prod sans SSH

**Format livrable A2-04.md** :
```markdown
# A2-04 — Observability

## Score : X/80

## 1. Logs structurés JSON (X/25)
[Tableau : champ obligatoire × présent/absent × fichier trouvé]
[Format log réel vs recommandé]

## 2. Sentry captures (X/20)
[Tableau : worker × captureWorkerError présent × tags utiles]

## 3. Métriques BullMQ (X/20)
[Dashboard trouvé ou manquant]
[Alerting configuré ?]

## 4. Traçabilité end-to-end (X/15)
[Schéma : KeywordSeed → Job → Article → IndexNow (IDs chainés ?)]

## P0 identifiés
## P1 identifiés
## Recommandations (logger à adopter, champs à ajouter)
```

---

### A2-05 — Configuration Management

**Score** : /70
**Mission** : Auditer l'exhaustivité des variables d'environnement documentées, la gestion des feature flags, la configurabilité des seuils métier, et la sécurité des secrets.

**Fichiers à lire en priorité** :
```
.env.example (si existe — chercher)
.env.local (si existe — chercher, NE PAS logger le contenu)
src/lib/env.ts (ou src/env.ts — validation Zod/T3 Env)
src/server/content-gen/llm-judge.ts (JUDGE_THRESHOLDS)
src/server/content-gen/keyword-selector.ts
src/server/queue/workers/content-publish-worker.ts
src/lib/feature-flags*.ts (probable)
next.config.ts (ou next.config.js)
```

**Recherches complémentaires** :
```bash
Glob: .env* (à la racine)
Grep: "process\.env\." --type ts -o | sort | uniq -c | sort -rn
Grep: "JUDGE_THRESHOLDS\|judgeThreshold\|QUALITY_THRESHOLD" --type ts
Grep: "MAX_PUBLISH_PER_DAY\|DAILY_CAP\|PUBLISH_CAP" --type ts
Grep: "OPENAI_EMBEDDINGS_ENABLED\|VOYAGE_AI\|VOYAGE_ENABLED" --type ts
Grep: "factoryAutoPublish\|AUTO_PUBLISH\|autoPublish" --type ts
Grep: "z\.env\|createEnv\|T3_ENV\|zodEnv" --type ts
```

**Points à auditer** :

1. **`.env.example` exhaustivité** (0-20 pts)
   - Le fichier `.env.example` existe-t-il ?
   - Toutes les vars lues via `process.env.` sont-elles documentées dans `.env.example` ?
   - Valeurs d'exemple sécurisées (pas de vraies clés API dans `.env.example`) ?
   - Commentaires explicatifs sur chaque var sensible (ex: `# Anthropic API key — obtenir sur console.anthropic.com`) ?
   - Vars spécifiques content-gen couvertes : `MAX_PUBLISH_PER_DAY`, `OPENAI_EMBEDDINGS_ENABLED`, `JUDGE_THRESHOLDS`, `ANTHROPIC_API_KEY`, `INDEXNOW_INTERNAL_HMAC_SECRET` ?

2. **Validation env vars au démarrage** (0-15 pts)
   - Validation Zod (T3 Env ou custom) sur les vars critiques ?
   - Démarrage fail-fast si var requise manquante (ex: `ANTHROPIC_API_KEY` absent → crash immédiat avec message clair) ?
   - Vars optionnelles avec valeurs par défaut saines (ex: `MAX_PUBLISH_PER_DAY=30`) ?
   - `OPENAI_EMBEDDINGS_ENABLED` a-t-il une valeur par défaut `false` correctement typée (boolean vs string "false") ?

3. **`JUDGE_THRESHOLDS` — configurabilité** (0-20 pts)
   - Les seuils du `llm-judge.ts` sont-ils hardcodés ou configurables ?
   - Si hardcodés : valeurs raisonnables ? (Ex: score min qualité = 7/10 ?)
   - P2-5 différé (JUDGE_THRESHOLDS DB-managed) : évaluer faisabilité — quelle table DB ? `ContentGenConfig` ou nouvelle table `JudgeThreshold` ?
   - Admin peut-il changer les seuils sans redémarrer le worker ?
   - Protection contre seuils aberrants (ex: threshold = 0 désactive toute vérification qualité) ?

4. **Feature flags propres** (0-15 pts)
   - `OPENAI_EMBEDDINGS_ENABLED`, `factoryAutoPublishAllBlogTypes` : flags env var vs DB-managed ?
   - Pas de feature flags hardcodés dans le code (ex: `if (process.env.NODE_ENV === 'production')`) ?
   - Flags documentés avec impact de chaque valeur ?
   - Changement flag nécessite-t-il redémarrage worker ou hot-reload ?

**Scoring A2-05** :
- 63-70 : Config documentée, validation stricte, flags propres
- 49-62 : `.env.example` partiel ou validation manquante
- 35-48 : Config éparpillée, seuils hardcodés non documentés
- <35 : Pas de `.env.example`, pas de validation — risque mise en prod cassée

**Format livrable A2-05.md** :
```markdown
# A2-05 — Configuration Management

## Score : X/70

## 1. .env.example exhaustivité (X/20)
[Vars trouvées vs documentées — tableau]
[Vars manquantes liste complète]

## 2. Validation env vars démarrage (X/15)
[Zod/T3 Env : présent / partiel / absent]
[Fail-fast : testé logiquement ?]

## 3. JUDGE_THRESHOLDS configurabilité (X/20)
[Valeurs hardcodées trouvées]
[Design DB-managed recommandé]

## 4. Feature flags (X/15)
[Inventaire flags trouvés × type (env/DB/hardcoded)]

## P0 identifiés
## P1 identifiés
## Liste complète vars à ajouter dans .env.example
```

---

### A2-06 — Error Handling & Resilience

**Score** : /80
**Mission** : Auditer les mécanismes de protection contre les failures d'APIs externes, les patterns retry, la gestion des jobs poison pill dans BullMQ, et les rollbacks de publication.

**Fichiers à lire en priorité** :
```
src/server/queue/workers/content-gen-worker.ts
src/server/queue/workers/content-publish-worker.ts
src/server/queue/workers/content-quality-improver-worker.ts
src/server/providers/anthropic*.ts (chercher)
src/server/providers/openai*.ts (chercher)
src/server/content-gen/llm-judge.ts
src/server/content-gen/dedup-guard.ts
src/server/content-gen/hero-image-assigner.ts (probable)
src/lib/errors*.ts (probable)
```

**Recherches complémentaires** :
```bash
Grep: "try\s*{" --type ts -- src/server/queue/workers/ -C 2
Grep: "catch\s*(e\|err\|error)" --type ts -- src/server/queue/workers/ -C 3
Grep: "retry\|backoff\|exponential\|jitter" --type ts
Grep: "circuit.*breaker\|circuitBreaker\|CircuitBreaker" --type ts
Grep: "fallback\|Fallback\|FALLBACK" --type ts
Grep: "rollback\|Rollback\|unpublish\|PUBLISHED.*DRAFT" --type ts
Grep: "MoveToFailed\|moveToFailed\|token.*expired" --type ts
Grep: "timeout\|Timeout\|AbortSignal\|AbortController" --type ts
```

**Points à auditer** :

1. **Gestion erreurs Anthropic API** (0-20 pts)
   - `429 RateLimitError` : retry avec backoff ou propagation erreur worker ?
   - `500 InternalServerError` Anthropic : retry ou fail job ?
   - `timeout` configuré sur les appels Claude (recommandé : 30-60s) ?
   - Si Claude indisponible (503) : le job revient en queue ou est marqué failed ?
   - `overloaded_error` Anthropic (spécifique Sonnet en peak) : géré ?

2. **Circuit breakers** (0-20 pts)
   - Y a-t-il un circuit breaker sur les appels Anthropic (ex: si 10 fails consécutifs → ouvrir circuit 5 min) ?
   - Y a-t-il un circuit breaker sur OpenAI si embeddings activés ?
   - Pattern utilisé : library (`opossum`, `cockatiel`, custom) ou rien ?
   - Fallback si circuit ouvert : continuer sans embedding ? Suspendre la campagne ? Alert ?

3. **Poison pills BullMQ** (0-20 pts)
   - Un job qui échoue `maxAttempts` fois : que se passe-t-il ?
   - DLQ ou simple `failed` state ?
   - Un job poison pill (ex: article avec contenu qui plante toujours le judge) bloque-t-il les autres jobs de la queue ?
   - `stalled` jobs : timeout configuré (`stalledInterval`) ?
   - Jobs `delayed` excessivement : protection contre pile-up ?

4. **Rollback publication** (0-20 pts)
   - Si `content-publish-worker` échoue après écriture en DB mais avant IndexNow ping : état article cohérent ?
   - Un article peut-il se retrouver `PUBLISHED` sans avoir été pingé IndexNow ?
   - Rollback possible : l'article repasse en `DRAFT` automatiquement si IndexNow échoue ?
   - Transaction DB atomique sur publish (update status + create provenance en même transaction) ?
   - Si `MAX_PUBLISH_PER_DAY` atteint en mid-batch : les articles en cours de publication sont-ils rollbackés ou laissés à moitié publiés ?

**Scoring A2-06** :
- 72-80 : Resilience production-grade, zéro single point of failure
- 56-71 : Retry OK, mais circuit breakers absents ou rollbacks partiels
- 40-55 : Gestion erreurs basique, risque de corruption état articles
- <40 : Try/catch vide ou absent, jobs poison pill bloquants, rollback absent

**Format livrable A2-06.md** :
```markdown
# A2-06 — Error Handling & Resilience

## Score : X/80

## 1. Gestion erreurs Anthropic (X/20)
[Code snippet exact retry trouvé ou manquant]
[Codes erreur Anthropic gérés vs non gérés]

## 2. Circuit breakers (X/20)
[Library trouvée ou absence confirmée]
[Analyse risque runaway si Anthropic down]

## 3. Poison pills BullMQ (X/20)
[Config stalledInterval trouvée ou manquante]
[Scenario poison pill : impact simulé]

## 4. Rollback publication (X/20)
[Transaction atomique : présente / absente]
[Scénario IndexNow fail après DB write : comportement réel]

## P0 identifiés
## P1 identifiés
## Pseudo-code recommandations resilience
```

---

### A2-07 — Performance DB

**Score** : /80
**Mission** : Auditer les performances des requêtes DB liées au content-gen, avec focus sur le plan de montée en charge pgvector IVFFlat, la comparaison IVFFlat vs HNSW pour 3072 dimensions, et la stratégie de backfill embeddings.

**Fichiers à lire en priorité** :
```
prisma/schema.prisma
src/server/content-gen/dedup-guard.ts
src/server/content-gen/keyword-selector.ts
prisma/migrations/ (chercher migrations pgvector)
src/server/content-gen/embeddings*.ts (probable)
src/server/queue/workers/content-gen-worker.ts
src/scripts/backfill-*.ts (chercher)
```

**Recherches complémentaires** :
```bash
Grep: "vector\|pgvector\|IVFFlat\|HNSW\|lists=" --type ts
Grep: "vector\|pgvector\|IVFFlat\|HNSW" -- prisma/
Grep: "embedding\|Embedding\|3072\|1536" --type ts
Grep: "\$queryRaw\|\$executeRaw" --type ts
Grep: "CREATE INDEX\|ivfflat\|hnsw" -- prisma/migrations/
Grep: "backfill\|Backfill\|migrate.*embed" --type ts
Grep: "cosine\|innerProduct\|l2\|<->\|<=>" --type ts
```

**Points à auditer** :

1. **IVFFlat actuel : `lists=1`** (0-25 pts)
   - Confirmer `lists=1` dans la migration pgvector ou schema
   - Impact perf `lists=1` : séquentiel scan équivalent → OK pour <10k rows, catastrophique au-delà
   - Seuil déclencher migration `lists=100` : à quelle volumétrie ? (règle : `lists = sqrt(nb_rows)` → 10k rows → lists=100)
   - Plan migration sans downtime :
     - Option A : `REINDEX CONCURRENTLY` sur prod
     - Option B : créer nouvel index, swapper
     - Option C : `ALTER INDEX ... SET (lists = 100)` (non disponible pgvector) → recréer
   - Estimation durée migration sur 10k rows (CPU VPS CPX42 8 vCPU) : [UNKNOWN si pas de données]

2. **IVFFlat vs HNSW — 3072 dimensions** (0-20 pts)
   - pgvector ≥ 0.5.0 supporte HNSW natif
   - Pour 3072 dim (text-embedding-3-large OpenAI) :
     - IVFFlat : build plus lent, recall moindre (~90-95%), RAM proportionnel à lists
     - HNSW (m=16, ef_construction=64) : build plus lent initialement, recall >99%, query constante O(log N)
   - Quelle version pgvector est installée ? (chercher dans `docker-compose`, `Dockerfile`, migrations)
   - Recommandation fondée sur dimension 3072 + volumétrie cible 10k-100k articles
   - Si OPENAI_EMBEDDINGS_ENABLED=false : quelle dimension utilisée pour SimHash ? 0 ? vecteur absent ?

3. **Query plan `keyword-selector.ts`** (0-20 pts)
   - La requête `FOR UPDATE SKIP LOCKED` est-elle en `$queryRaw` (perf) ou ORM Prisma (overhead) ?
   - Index sur `(campaignId, status, lockedUntil)` pour que le SKIP LOCKED soit efficient ?
   - Si 1000 keywords en `AVAILABLE` pour une campagne : SKIP LOCKED ne scanne-t-il que les rows non locked ? (Oui si index correct)
   - Durée estimée `lockTimeout` (combien de temps un keyword est "réservé" avant libération si worker crash) ?

4. **Backfill embeddings strategy** (0-15 pts)
   - Existe-t-il un script de backfill pour articles sans embedding ?
   - Le backfill est-il batchifiable (chunks de 100) pour éviter OOM ?
   - Ordre de priorité backfill : articles récents d'abord ou aléatoire ?
   - Peut-on activer `OPENAI_EMBEDDINGS_ENABLED=true` en prod sans backfill complet et avoir un comportement cohérent (fallback SimHash pour les anciens articles) ?
   - Estimation coût backfill 10k articles × text-embedding-3-large : ~$0.13/10k tokens × moyenne 500 tokens/article = [calculer]

**Scoring A2-07** :
- 72-80 : Plan IVFFlat→HNSW documenté, index complets, backfill strategy claire
- 56-71 : `lists=1` risque identifié mais plan migration ébauché
- 40-55 : Pas de plan migration index, backfill absent
- <40 : pgvector mal configuré, risk data corruption ou performance effondrement

**Format livrable A2-07.md** :
```markdown
# A2-07 — Performance DB

## Score : X/80

## 1. IVFFlat lists=1 — analyse (X/25)
[Migration pgvector trouvée : contenu exact]
[Seuil déclenchement upgrade]
[Plan migration step-by-step sans downtime]

## 2. IVFFlat vs HNSW 3072 dim (X/20)
[Version pgvector installée]
[Tableau comparatif IVFFlat vs HNSW pour ce use-case]
[Recommandation motivée]

## 3. Query plan keyword-selector (X/20)
[Requête exacte trouvée dans code]
[Index présent / manquant]
[Analyse atomicité SKIP LOCKED]

## 4. Backfill strategy (X/15)
[Script backfill : trouvé / absent]
[Plan backfill recommandé]
[Coût estimé OpenAI backfill 10k articles]

## P0 identifiés
## P1 identifiés
## SQL scripts recommandés (index upgrade)
```

---

### A2-08 — Multi-Campagnes Concurrence

**Score** : /70
**Mission** : Auditer la capacité du système à exécuter plusieurs campagnes en parallèle sans interférence, avec focus sur l'atomicité de la sélection de keywords et l'exactitude de `pauseCampaign`.

**Scénario de test logique à simuler** :
- Campagne A : Paris × formation (200 keywords disponibles)
- Campagne B : Lyon × audit (150 keywords disponibles)
- Workers parallèles : 3 instances `content-gen-worker`
- Worker 1 prend keyword de A, Worker 2 prend keyword de B, Worker 3 prend keyword de A
- → Pas de double sélection, pas de cross-campaign contamination

**Fichiers à lire en priorité** :
```
src/server/content-gen/keyword-selector.ts
src/server/content-gen/campaign-manager.ts (probable)
src/server/content-gen/pauseCampaign.ts (ou dans campaign-manager)
src/server/queue/workers/content-gen-worker.ts
prisma/schema.prisma (modèles CoverageCampaign, KeywordSeed)
```

**Recherches complémentaires** :
```bash
Grep: "FOR UPDATE SKIP LOCKED" --type ts
Grep: "campaignId\|campaign_id" --type ts -- src/server/content-gen/
Grep: "pauseCampaign\|pause.*campaign\|drainQueue" --type ts
Grep: "queue\.drain\|queue\.obliterate\|queue\.pause\|getJobs.*waiting" --type ts
Grep: "lockedUntil\|locked_until\|lockedBy\|locked_by" --type ts
Grep: "KEYWORD.*LOCKED\|keyword.*status.*LOCKED\|KeywordStatus" --type ts
```

**Points à auditer** :

1. **FOR UPDATE SKIP LOCKED — atomicité** (0-25 pts)
   - La requête `FOR UPDATE SKIP LOCKED` s'exécute-t-elle dans une vraie transaction DB (`BEGIN` / `COMMIT`) ?
   - Si Prisma `$queryRaw` : est-ce enveloppé dans `$transaction()` ?
   - Durée de la transaction : minimale (select + update status = locked) ou trop longue (select + génération article entière) ?
   - Si le worker crash après le lock mais avant le unlock : le keyword reste-t-il bloqué indéfiniment ? Mécanisme de libération automatique (`lockedUntil` + cron cleanup) ?
   - Test logique : 3 workers simultanés → chacun obtient-il un keyword distinct ? (Oui si SKIP LOCKED correct)

2. **Isolation entre campagnes** (0-20 pts)
   - La requête `keyword-selector` filtre-t-elle par `campaignId` AVANT le SKIP LOCKED ? (Critique : sans ça, un worker Campagne-A pourrait prendre un keyword de Campagne-B)
   - Les articles générés portent-ils le bon `campaignId` en DB ?
   - Les queues BullMQ sont-elles partagées (une seule queue `content-gen`) ou par campagne ?
   - Si queue partagée : un job d'une campagne peut-il être traité par un worker configuré pour une autre campagne ?

3. **`pauseCampaign()` — exactitude** (0-15 pts)
   - Que fait exactement `pauseCampaign()` ? (lire le code)
   - Purge-t-elle : jobs `waiting` + jobs `delayed` + jobs `active` ?
   - Jobs `active` (en cours) : impossible à purger atomiquement — que se passe-t-il ? Worker continue puis essaie de publier → check campagne `PAUSED` avant publish ?
   - Keywords `LOCKED` libérés au pause ? (Sinon : relock après timeout seulement)
   - Cas edge : pause alors que 50 jobs `waiting` → tous purgés ? Ou seulement les `waiting` initiaux ?

4. **No cross-campaign pollution** (0-10 pts)
   - Si erreur de routing (bug) : un article généré pour Campagne-A se retrouve-t-il publié dans Campagne-B ?
   - Protection : `Article.campaignId` non-nullable en DB ?
   - Worker vérifie `job.data.campaignId === article.campaignId` avant publication ?

**Scoring A2-08** :
- 63-70 : Isolation parfaite, atomicité correcte, pause exacte
- 49-62 : SKIP LOCKED OK mais isolation partielle ou pause approximative
- 35-48 : Race conditions possibles ou cross-campaign pollution risk
- <35 : Pas de vrai mécanisme isolation — risque corruption données campagnes

**Format livrable A2-08.md** :
```markdown
# A2-08 — Multi-Campagnes Concurrence

## Score : X/70

## 1. FOR UPDATE SKIP LOCKED atomicité (X/25)
[Requête exacte trouvée]
[Transaction wrapping : présent / absent]
[Mécanisme libération lock si crash]

## 2. Isolation campagnes (X/20)
[Filtre campaignId sur SKIP LOCKED : présent / absent]
[Schéma queues BullMQ : partagées / par campagne]

## 3. pauseCampaign() exactitude (X/15)
[Code exact de pauseCampaign]
[Jobs active : comportement documenté]
[Keywords LOCKED : libérés au pause ?]

## 4. Cross-campaign pollution (X/10)
[Protection DB (NOT NULL) : présente ?]
[Check worker avant publish : présent ?]

## Scénario test logique 3 workers × 2 campagnes
[Résultat simulé : OK / RISK / FAIL]

## P0 identifiés
## P1 identifiés
```

---

### A2-09 — Sécurité & Conformité Pipeline

**Score** : /80
**Mission** : Auditer la sécurité du pipeline content-gen : intégrité de la chaîne `GenerationProvenance`, exposition PII dans les jobs BullMQ, `sanitize-job-data`, et conformité rétention 6 ans AI Act.

**Contexte réglementaire** :
- **AI Act art. 50** (deadline 2026-08-02) : obligation de traçabilité des contenus générés par IA, conservation des logs 6 ans minimum, marquage `aiGenerated:true` dans JSON-LD
- **RGPD art. 5(1)(e)** : pas de conservation données personnelles au-delà de la finalité
- **DPA Anthropic** : non signé (décision Will D-W2) → données envoyées à Anthropic sans DPA — risque RGPD si PII dans prompts

**Fichiers à lire en priorité** :
```
src/server/content-gen/generation-provenance.ts (probable)
src/server/queue/helpers/sanitize-job-data.ts (probable)
src/server/queue/workers/content-gen-worker.ts
src/server/queue/workers/content-publish-worker.ts
src/lib/ai-act*.ts (chercher)
prisma/schema.prisma (GenerationProvenance model)
src/server/content-gen/llm-judge.ts (données envoyées à Claude)
```

**Recherches complémentaires** :
```bash
Grep: "GenerationProvenance\|provenance\|chainHash\|aiGenerated" --type ts
Grep: "sanitize\|Sanitize\|redact\|Redact\|pii\|PII" --type ts
Grep: "email\|user.*email\|customer.*email" --type ts -- src/server/queue/
Grep: "ANTHROPIC_API_KEY\|apiKey\|api_key" --type ts -- src/server/
Grep: "6.*ans\|6.*year\|retention\|Retention\|TTL\|purge" --type ts
Grep: "aiGenerated.*true\|ai_generated\|AI_GENERATED" --type ts
Grep: "hash\|Hash\|sha256\|SHA256\|crypto\." --type ts -- src/server/content-gen/
```

**Points à auditer** :

1. **GenerationProvenance — intégrité chaîne hash** (0-25 pts)
   - Le modèle `GenerationProvenance` existe-t-il en DB (Prisma schema) ?
   - Champs présents : `articleId`, `modelId`, `promptHash`, `inputTokens`, `outputTokens`, `chainHash`, `createdAt` ?
   - `chainHash` calculé comment ? (SHA-256 de `previousHash + articleId + promptHash + timestamp` ?)
   - La chaîne est-elle vérifiable a posteriori (audit trail reconstitutable) ?
   - Qui peut modifier un `GenerationProvenance` record ? (Normalement : personne — insert-only)
   - Pas d'API admin permettant de supprimer des `GenerationProvenance` records avant 6 ans ?

2. **PII dans jobs BullMQ** (0-20 pts)
   - Les jobs BullMQ `content-gen-worker` : contiennent-ils des données PII (email user, IP, nom) ?
   - `job.data` standard : `{ campaignId, keywordId, verticale, ville }` — pas de PII attendu
   - `sanitize-job-data` helper : quels champs sont redactés avant Sentry ?
   - Les prompts envoyés à Claude contiennent-ils des données personnelles ? (Si oui : DPA Anthropic urgent)
   - Logs BullMQ (Redis) : TTL configuré pour éviter accumulation PII longue durée ?

3. **Rétention 6 ans AI Act** (0-20 pts)
   - `GenerationProvenance` : pas de `DELETE CASCADE` depuis `Article` ? (sinon suppression article = perte trace)
   - Soft delete sur `Article` (champ `deletedAt`) plutôt que hard delete ?
   - Table `GenerationProvenance` : pas de politique purge automatique < 6 ans ?
   - Backup incluant `GenerationProvenance` dans la stratégie backup existante (Storage Box) ?
   - Conflit RGPD × AI Act : si utilisateur demande suppression (RGPD art. 17) → article supprimé mais `GenerationProvenance` conservé (OK légalement) ?

4. **Secrets dans le code** (0-15 pts)
   - Pas de clé API Anthropic hardcodée dans le code source ?
   - `ANTHROPIC_API_KEY` passé uniquement via env var ?
   - Pas de logs de la clé API (même partielle) dans les workers ?
   - Pas de secrets dans `job.data` passé en clair dans Redis ?
   - `.gitignore` couvre bien `.env`, `.env.local`, `.env.production` ?

**Scoring A2-09** :
- 72-80 : Conformité AI Act + RGPD solide, chaîne hash intègre, 0 PII dans jobs
- 56-71 : Provenance OK mais rétention 6 ans non garantie ou PII partiel dans jobs
- 40-55 : Hash chaîne absente ou PII dans logs/jobs
- <40 : Non-conformité AI Act critique, DPA absent + PII exposé

**Format livrable A2-09.md** :
```markdown
# A2-09 — Sécurité & Conformité Pipeline

## Score : X/80

## 1. GenerationProvenance intégrité (X/25)
[Modèle Prisma : champs trouvés vs attendus]
[Algorithme chainHash : trouvé / absent / UNKNOWN]
[Garantie insert-only : présente ?]

## 2. PII dans jobs BullMQ (X/20)
[Structure job.data trouvée]
[sanitize-job-data : champs redactés]
[Prompts Claude : PII présent ?]

## 3. Rétention 6 ans AI Act (X/20)
[Relation Article → GenerationProvenance : CASCADE ou RESTRICT ?]
[Politique purge automatique : absente / présente]
[Conflit RGPD art.17 × AI Act analyse]

## 4. Secrets dans le code (X/15)
[Scan secrets : clean / alertes]

## P0 CRITIQUE (conformité)
## P1 identifiés
## Checklist conformité AI Act art. 50 (état actuel)
```

---

### A2-10 — Sprint S+6 Roadmap Différés

**Score** : /100
**Mission** : Évaluer les 7 items P2 différés issus de P1.5, prioriser leur exécution, estimer l'effort réel (en heures Claude autopilot), identifier les dépendances inter-items, et émettre une recommandation Go/No-Go pour chaque item dans le contexte S+6.

**Contexte S+6** :
- P1.5 livré : score ~770-820/1000, double HOLD levé, publication 30/jour active
- S+6 = sprint suivant P2 (ce prompt) et P3 (SEO/AEO) + éventuellement P4 (éditorial)
- Budget temps Will : limité — prioriser par ROI (impact score × effort inverse)
- Constraint : `OPENAI_EMBEDDINGS_ENABLED=false` toujours par défaut (DPA non signé)

**Items P2 différés à évaluer** :

| # | Item | Effort P1.5 estimé | À réévaluer |
|---|---|---|---|
| P2-1 | Env vars exhaustives `.env.example` | ~30 min | Effort réel post-lecture codebase |
| P2-2 | Couche 4 embeddings pre-publish wiring complet | ~4-6h | Dépend OPENAI_EMBEDDINGS_ENABLED |
| P2-3 | Frontend `<Image>` rendu `Article.featuredImage` | ~2h | Impact UX + Web Vitals |
| P2-4 | Log warning `keyword_select_exhausted` | ~1h | Simple mais important ops |
| P2-5 | `JUDGE_THRESHOLDS` DB-managed | ~4-6h | Complexité réelle ? |
| P2-6 | Voyage AI topic-fingerprint | ~6-10h | Dépend DPA + budget |
| P2-7 | Bonus translation `assignHeroImage` (FR+EN distinct) | ~3-4h | Valeur SEO bilingue |

**Fichiers à lire pour chaque item** :
```
# P2-1
.env.example (si existe)
src/lib/env.ts

# P2-2
src/server/content-gen/dedup-guard.ts
src/server/queue/workers/content-publish-worker.ts
src/server/content-gen/embeddings*.ts

# P2-3
src/app/[locale]/(public)/blog/[slug]/page.tsx (probable)
src/components/blog/ArticleCard*.tsx (probable)

# P2-4
src/server/content-gen/keyword-selector.ts

# P2-5
src/server/content-gen/llm-judge.ts
prisma/schema.prisma

# P2-6
src/server/content-gen/dedup-guard.ts
package.json (voyage ai lib disponible ?)

# P2-7
src/server/content-gen/hero-image-assigner.ts (probable)
src/server/image-bank/*.ts (couche bilingue)
```

**Points à auditer par item** :

**P2-1 — `.env.example` exhaustif**
- Compter les vars `process.env.X` utilisées dans le code
- Compter celles documentées dans `.env.example` (si existe)
- Delta = effort réel
- **Recommandation** : Go immédiat (faible effort, fort bénéfice onboarding)

**P2-2 — Couche 4 embeddings pre-publish**
- Qu'est-ce que "couche 4" du dedup-guard ? (SimHash a 4 couches : titre, body, semantic vec, cross-article)
- La couche 4 (pgvector) nécessite `OPENAI_EMBEDDINGS_ENABLED=true`
- Si flag `false` : couche 4 silent-skip ou erreur ?
- Wiring "pre-publish" = appeler dedup-guard AVANT publish-worker ?
- **Recommandation** : Conditionnel — Go si DPA Anthropic signé + OPENAI activé, sinon reporter

**P2-3 — Frontend `<Image>` Article.featuredImage**
- L'article publié affiche-t-il le hero image assigné par `assignHeroImage` ?
- Si `Article.featuredImage` null : fallback image générique ou champ absent dans template ?
- Impact LCP si image non optimisée (Next.js `<Image>` avec priority + sizes)
- **Recommandation** : Go fort — impact direct UX + LCP + E-E-A-T visuel

**P2-4 — Log warning `keyword_select_exhausted`**
- Que se passe-t-il actuellement si tous les keywords d'une campagne sont épuisés ?
- Worker boucle indéfiniment ? Fail silencieux ? Exception non catchée ?
- **Recommandation** : Go immédiat (1h, prévient incident prod critique)

**P2-5 — `JUDGE_THRESHOLDS` DB-managed**
- Design actuel : seuils hardcodés dans `llm-judge.ts` (ex: `THRESHOLD_MIN_SCORE = 7`)
- Design cible : table `JudgeThreshold` (ou `ContentGenConfig`) avec `key`, `value`, `updatedBy`, `updatedAt`
- Admin peut modifier sans redéploiement
- Complexité : migration Prisma + admin UI page (backlog admin V2)
- **Recommandation** : Conditionnel — Go si admin V2 page déjà planifiée, sinon P3

**P2-6 — Voyage AI topic-fingerprint**
- Voyage AI : provider embeddings alternatif (https://www.voyageai.com)
- Use case : détecter similarité thématique entre articles (topic clustering, dédup sémantique)
- `voyageai` npm package disponible ?
- DPA Voyage AI signé ? (probablement pas si DPA Anthropic pas signé)
- Coût estimé Voyage AI vs OpenAI text-embedding-3-large pour 10k articles
- **Recommandation** : No-Go S+6 — DPA non signé + OPENAI pas encore activé → surcharge

**P2-7 — Translation hero image FR+EN**
- Image hero actuellement : une seule assignée par article (FR ou EN ?)
- En bilingue : `/fr/blog/slug` → hero FR, `/en/blog/slug` → hero EN (distinct ?)
- `assignHeroImage` actuel : retourne 1 image ou 2 ?
- Impact SEO : `og:image` distinct FR vs EN ?
- **Recommandation** : Conditionnel — Go si image-bank a images bilingues disponibles

**Format scoring A2-10** :
- Analyse claire par item (10 pts chacun + 30 pts recommandations priorisées cohérentes)
- Tableau final Go/No-Go/Conditionnel + justification 1 ligne + effort réel réévalué

**Scoring A2-10** :
- 90-100 : Analyse précise tous items, recommandations actionables, priorisation défendable
- 70-89 : Analyse complète mais effort ou dépendances mal évalués
- 50-69 : Items partiellement analysés
- <50 : Recommandations sans base code réelle

**Format livrable A2-10.md** :
```markdown
# A2-10 — Sprint S+6 Roadmap Différés

## Score : X/100

## Tableau Go/No-Go

| Item | Titre | Go/No-Go | Effort réel | Dépendances | Impact score |
|------|-------|----------|-------------|-------------|--------------|
| P2-1 | .env.example | GO | X min | aucune | +5 pts A2-05 |
| P2-2 | Embeddings couche 4 | CONDITIONNEL | Xh | DPA signé + OPENAI | +8 pts A2-07 |
| P2-3 | <Image> Article | GO | Xh | image-bank active | +10 pts E2E |
| P2-4 | Log keyword exhausted | GO | 1h | aucune | +5 pts A2-04 |
| P2-5 | JUDGE_THRESHOLDS DB | CONDITIONNEL | Xh | admin UI page | +8 pts A2-05 |
| P2-6 | Voyage AI | NO-GO | — | DPA absent | 0 |
| P2-7 | Hero image bilingue | CONDITIONNEL | Xh | image-bank bilingue | +5 pts SEO |

## Analyse détaillée par item (P2-1 à P2-7)
[Section par item : trouvé dans code, gap identifié, effort réel, blockers]

## Séquencement recommandé S+6
[Ordre d'implémentation avec dépendances]

## Budget total S+6 estimé
[Total heures × items GO]
```

---

## 4. SCORING GLOBAL

### Tableau d'agrégation

| Agent | Domaine | Score | Max |
|-------|---------|-------|-----|
| A2-01 | Architecture BullMQ queues | — | /70 |
| A2-02 | Prisma schema cohérence | — | /80 |
| A2-03 | Rate limiting & cost control | — | /90 |
| A2-04 | Observability | — | /80 |
| A2-05 | Configuration management | — | /70 |
| A2-06 | Error handling & resilience | — | /80 |
| A2-07 | Performance DB | — | /80 |
| A2-08 | Multi-campagnes concurrence | — | /70 |
| A2-09 | Sécurité & conformité pipeline | — | /80 |
| A2-10 | Sprint S+6 roadmap différés | — | /100 |
| **TOTAL** | | **—** | **/800** |

> **Note de pondération** : Le score brut est sur /800. La normalisation sur /1000 s'obtient par : `score_normalise = score_brut / 800 * 1000`.
>
> Exemple : 640/800 brut = 800/1000 normalisé.

### Seuils de verdict

| Verdict | Score normalisé /1000 | Signification |
|---------|----------------------|---------------|
| 🟢 **GO** | ≥ 900 | Architecture production-ready, lancer S+6 |
| 🟡 **CONDITIONNEL** | 750 - 899 | S+6 possible après correction P0 identifiés |
| 🔴 **NO-GO** | < 750 | Sprint correctif P2 obligatoire avant S+6 |

### Calcul score normalisé

```
score_brut = A2-01 + A2-02 + A2-03 + A2-04 + A2-05 + A2-06 + A2-07 + A2-08 + A2-09 + A2-10
score_normalise = round(score_brut / 800 * 1000)
```

---

## 5. FORMAT PHASE-2-VERDICT.md

L'orchestrateur produit ce fichier en DERNIER, après réception de tous les agents.

```markdown
# PHASE 2 — VERDICT ARCHITECTURE & DATA PIPELINE
# AxionIA Content-Gen Perfection 2026

**Date audit** : [date]
**Commit HEAD** : 37ca0147
**Auditeur** : Claude Sonnet 4.6 (AUDIT-ONLY)
**Score P2** : X/800 brut → X/1000 normalisé
**Verdict** : 🟢 GO / 🟡 CONDITIONNEL / 🔴 NO-GO

---

## Scores par agent

| Agent | Score | Max | % |
|-------|-------|-----|---|
| A2-01 BullMQ | | /70 | |
| A2-02 Prisma | | /80 | |
| A2-03 Rate Limit | | /90 | |
| A2-04 Observability | | /80 | |
| A2-05 Config | | /70 | |
| A2-06 Resilience | | /80 | |
| A2-07 Perf DB | | /80 | |
| A2-08 Concurrence | | /70 | |
| A2-09 Sécurité | | /80 | |
| A2-10 Roadmap | | /100 | |
| **TOTAL** | | **/800** | |

---

## Top P0 — Bloquants absolus
[Liste P0 cross-agents, max 10, ordonnés par criticité]

## Top P1 — Importants non-bloquants
[Liste P1 cross-agents, max 15]

## Synthèse par dimension

### Architecture BullMQ (A2-01 + A2-08)
[2-3 phrases]

### Data Model (A2-02 + A2-07)
[2-3 phrases]

### Contrôle coûts & resilience (A2-03 + A2-06)
[2-3 phrases]

### Conformité & sécurité (A2-09)
[2-3 phrases]

### Observabilité & config (A2-04 + A2-05)
[2-3 phrases]

### Roadmap S+6 (A2-10)
[2-3 phrases]

---

## Verdict final

**Score normalisé** : X/1000

**Verdict** : [GO / CONDITIONNEL / NO-GO]

**Condition de passage à GO** (si CONDITIONNEL) :
- [ ] Fix P0-X : description
- [ ] Fix P0-Y : description

**Recommandation séquencement S+6** :
[Items P2 GO dans l'ordre recommandé]

---

## Actions Will requises
[Décisions Will nécessaires pour débloquer items CONDITIONNEL]
```

---

## 6. FORMAT CROSS-CUTTING.md

L'orchestrateur produit ce fichier en complément du VERDICT.

```markdown
# CROSS-CUTTING — Thèmes transverses P2

## Contradictions inter-agents
[Ex: A2-03 dit "pas de rate limit" mais A2-06 dit "retry avec backoff" — contradiction ?]

## Thèmes récurrents
[Ex: "sanitize-job-data manquant" cité par A2-04 ET A2-09 → priorité double]

## Dépendances P2 → P3 (SEO/AEO)
[Ex: "GenerationProvenance.aiGenerated non exposé dans JSON-LD" → dépend A2-09 fix pour P3]

## Dépendances P2 → P4 (Éditorial)
[Ex: "llm-judge.ts thresholds hardcodés" → P4 devra proposer des valeurs calibrées]

## Dépendances P2 → P5 (Console admin)
[Ex: "JUDGE_THRESHOLDS DB-managed" → P5 devra créer la page admin]

## Risques systémiques identifiés
[Ex: "DPA Anthropic non signé + PII dans prompts → risque RGPD critique scale >30/j"]

## Wins rapides transverses (impact immédiat)
[Ex: "Ajouter 3 index DB = -70% durée SELECT keyword-selector"]
```

---

## 7. INSTRUCTIONS FINALES D'EXÉCUTION

### Étape 1 — Initialisation (avant de lancer les agents)

```bash
# Créer la structure de dossiers
mkdir -p "C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CONTENT-GEN-PERFECTION-2026\phase-2\agents"

# Vérifier le HEAD commit
git -C "C:\Users\willi\Documents\Projets\Axion-IA" log --oneline -3

# Vérifier la branche active
git -C "C:\Users\willi\Documents\Projets\Axion-IA" branch --show-current

# Détecter sessions Manon parallèles
git -C "C:\Users\willi\Documents\Projets\Axion-IA" log --all --oneline -20

# Lister les workers existants
# Glob: src/server/queue/workers/*.ts
```

### Étape 2 — Lancement 10 agents en parallèle

Spawner A2-01 à A2-10 simultanément. Chaque agent :
1. Lire ses fichiers cibles
2. Effectuer ses recherches Grep/Glob
3. Scorer chaque sous-dimension
4. Écrire son fichier `agents/A2-{NN}.md`
5. Retourner son score total à l'orchestrateur

### Étape 3 — Agrégation (après completion tous agents)

1. Calculer `score_brut` = somme A2-01 à A2-10
2. Calculer `score_normalise` = round(score_brut / 800 * 1000)
3. Écrire `CROSS-CUTTING.md`
4. Écrire `PHASE-2-VERDICT.md`
5. Logger la completion

### Étape 4 — STOP & ASK Will

Après livraison complète, afficher :

```
═══════════════════════════════════════════════════════
  PHASE P2 ARCHITECTURE & DATA PIPELINE — LIVRÉ
═══════════════════════════════════════════════════════

  Score : X/800 brut → X/1000 normalisé
  Verdict : [GO / CONDITIONNEL / NO-GO]

  Livrables :
  _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/
  ├── PHASE-2-VERDICT.md
  ├── CROSS-CUTTING.md
  └── agents/ (A2-01 à A2-10)

  Top 3 P0 identifiés :
  1. [P0-X] Description courte
  2. [P0-Y] Description courte
  3. [P0-Z] Description courte

  Items S+6 recommandés (Go) :
  [P2-1, P2-3, P2-4 par exemple]

  ⏸️  STOP & ASK Will :
  Valider verdict avant lancement P3 (SEO/AEO/GEO) ?
  [ ] OUI → lancer P3 avec phase-2-verdict comme input
  [ ] NON → sprint correctif P2 d'abord
═══════════════════════════════════════════════════════
```

---

## 8. PHRASE DE LANCEMENT

Copier-coller cette phrase dans une nouvelle conversation Claude Code pour exécuter l'audit :

---

**PHRASE DE LANCEMENT (self-contained) :**

```
Mode AUTOPILOT DE BOUT EN BOUT — exécute tout sans t'arrêter. Aucune question en cours de route. Le seul point d'arrêt autorisé est le STOP & ASK final après livraison complète de tous les livrables.

Lis le fichier prompt suivant en entier et exécute EXACTEMENT les instructions qu'il contient :

Fichier : C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\PROMPT-2-ARCHITECTURE-DATA-PIPELINE.md

Instructions d'exécution :
1. Mode AUDIT-ONLY strict — zéro modification code prod, zéro commit, lecture seule
2. Crée la structure de dossiers _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-2/agents/
3. Spawn 10 sous-agents parallèles A2-01 à A2-10 — tous en même temps
4. Chaque agent produit son fichier agents/A2-XX.md avec score détaillé
5. Produis CROSS-CUTTING.md (patterns transverses) + PHASE-2-VERDICT.md (score /1000 + verdict GO/CONDITIONNEL/NO-GO)
6. Une fois TOUS les livrables créés : STOP & ASK Will avec verdict final et décisions canoniques

Repo : C:\Users\willi\Documents\Projets\Axion-IA
HEAD : 37ca0147
Baseline P1.5 : score ~770-820/1000, Vitest 1376/1383, double HOLD levé, 7 P2 différés
```

---

*Fin du prompt P2 — PROMPT-2-ARCHITECTURE-DATA-PIPELINE.md*
*Créé le 2026-05-21 | Version 1.0 | AxionIA OÜ*
