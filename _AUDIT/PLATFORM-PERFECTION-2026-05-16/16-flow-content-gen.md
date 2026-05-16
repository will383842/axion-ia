# Agent 4.B — Flow CONTENT-GEN

- **SHA HEAD figé brief** : `98e0b0f` (main 2026-05-16 `feat(content-gen): segmentation 3 secteurs`)
- **SHA HEAD réel session** : `4cdfbe4` (`feat/image-bank-v1`, 8 commits image-bank `842cd3e`…`4cdfbe4` au-dessus de `98e0b0f`). Aucun delta image-bank ne touche `src/server/content-gen/**`, `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**` ni `prisma/schema.prisma` autre que les 9 modèles image-bank → l'audit est conduit sur l'état content-gen tel que livré à `98e0b0f`, consulté via `git show 98e0b0f:<path>`.
- **Mode** : AUDIT-ONLY. Aucun `git checkout`, zero Edit/Write hors livrable.
- **Scope** : pipelines § 25.3 (3 secteurs éditoriaux + 2 pipelines indépendants `landing_ville` / `blog_from_rss`), worker orchestrateur, content-gen-worker, quality loop, plagiarism, intent validator, FAQ Speakable extraction, approval flow, cost ledger, kill-switches, Manon persona, KB V4 binding.

---

## 1. Synthèse exécutive

**Score : 117 / 150 — verdict 🟡 NEAR-GO conditional (3 P0 + 5 P1)**

Le flow content-gen porté par le commit `98e0b0f` est **opérationnellement cohérent** sur la segmentation 3 secteurs : enum `ServiceSector` Prisma + colonne `serviceSector?` sur `CoverageCampaign` & `CoverageDistributionProfile` (+ 2 index), module pur `editorial-mix-rules` (13 tests Vitest verts), dashboard 5 cartes rollup, `/coverage/new` dropdown secteur, `/jobs` filtre secteur via `campaign.serviceSector`, 3 profils + 3 campagnes draft seedées. Le pipeline d'exécution V1.0.3 (gen → plagiat → intent → quality loop → review → publish → QA extract → indexing) est correctement structuré, kill switch global est hard-gate dans **5 workers** (orchestrator, gen, quality-improver, publish, qa-extract), auto-cascade cost-cap (disable provider + Telegram + kill-switch global si fallback chain épuisée) est livré dans `cost-tracker.ts:handleCostCapHit()`.

**Trois P0 bloquants** identifiés :

1. **KB V4 binding `targetKnowledgeEntryId` JAMAIS écrit par le pipeline** : le champ existe sur `ContentGenJob` (schema + `kbIngestStatus` + `kbRejectReason`), `publishToKB()` existe dans `src/server/content-gen/kb-feeder.ts`, mapping `CONTENT_TYPE_TO_KB_TYPE` complet (9 types), mais aucun worker (`content-publish-worker.ts`, `content-gen-worker.ts`, `content-quality-improver-worker.ts`) n'appelle `publishToKB()` post-publish. Seul caller = `src/server/actions/content-gen/kb-ingest-external.ts` (import manuel admin). Effet : chaque article généré ne nourrit PAS la KB V4 → bouclage `KB → generator.kb-client → article` cassé, dégradation continue de la qualité contextuelle générée. Cf. `axionia_session_2026-05-14_audit_fixes_v1_0_3.md` : audit Pass B avait coché « KnowledgeEntry réel » au master prompt v2.5, mais le write-back côté worker reste un TODO.
2. **Manon `aiGenerated=true` + `personaDisclaimer` NON exposés sur les pages article publiques** : `AuthorByline` (`src/components/knowledge/public/AuthorByline.tsx:9-88`) prend `authorName`/`authorAvatarUrl`/`authorBio` mais **ne lit ni `aiGenerated` ni `personaDisclaimer` ni `isPersona`**. Le disclaimer IA n'apparaît que sur `/equipe/manon` (`src/app/[locale]/equipe/[slug]/page.tsx:91-105`). Aucun appel `personaDisclaimer|isPersona|aiGenerated` dans `src/app/[locale]/blog/**`, `src/app/[locale]/actualites/**`, `src/app/[locale]/connaissances/**` (grep zéro hit). Conséquence YMYL / EEAT 2026 : Google et OpenAI/Anthropic Overviews voient `Article.creator` pointer vers une persona dont la nature IA n'est révélée que sur la page profil → risque CMS Helpful Content / AI Disclosure UE 2026.
3. **Boucle qualité — pas de seuil bas `<40 → needs_review`** : `content-gen-worker.ts:300-308` calcule `eligibleQualityLoop = qualityLoopEnabled && !blockingFail && score > 0 && score < qualityThreshold` (seuil unique 75 par défaut). Un score 5/100 ou 15/100 part en `quality_improving` exactement comme un score 70/100 alors que le brief Master v1.7 §27 demande deux paliers : `[40-74]` → quality_improving, `[1-39]` → `needs_review` direct (anti-gaspillage budget). En l'état, un échec doctrinal sévère (corpus incohérent, hallucination majeure) consomme 1-2 tentatives boucle qualité avant d'atterrir en review. P0 budget + P0 doctrinal.

---

## 2. Flow diagram textuel (pipeline 1 = secteur éditorial)

```
                      ┌────────────────────────────────────────┐
                      │ /admin/content-gen/coverage/new        │
                      │  - select serviceSector (3 options)    │
                      │  - typeDistribution JSON (somme 100)   │
                      │  - banned-types check Server Action ✅ │
                      └──────────────────┬─────────────────────┘
                                         │ createCampaign() → status=draft
                                         ▼
                      ┌────────────────────────────────────────┐
                      │ launchCampaign(id) → status='running'  │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
              ┌──────────────────────────────────────────────────────┐
              │ content-orchestrator-worker  (cron every 15min)      │
              │  1. read kill_switch — skip si active                │
              │  2. read batches config (per-type vs global)         │
              │  3. for each running campaign :                      │
              │     - sample weighted typeDistribution (random)      │
              │     - sample audienceMix (size:org)                  │
              │     - sample searchIntentMix (or default info)       │
              │     - pick anchor (ville/dept/region/multi)          │
              │     - idempotency hash = sha256(camp+slot+type+...)  │
              │     - insert ContentGenJob status=queued             │
              │     - BullMQ.add("generate", { jobId: gen-<id> })    │
              │  ⚠️ NO RUNTIME GUARD vs BANNED_FROM_EDITORIAL_MIX    │
              └──────────────────────────────┬───────────────────────┘
                                             │
                                             ▼
            ┌────────────────────────────────────────────────────────────┐
            │ content-gen-worker  (concurrency 5, 10/min limiter)         │
            │  0. kill_switch hard-gate (throw → requeue)                 │
            │  1. lookup ContentGenJob DB (UnrecoverableError si absent)  │
            │  2. assertKbReady() — fail → Telegram alertKbNotReady       │
            │  3. dedup pre-IA (checkDedup 4 couches v1.7)                │
            │  4. getGenerator(contentType) → 9 generators registry       │
            │  5. generator.generate() → output (qualityScore, seoScore,  │
            │     bodyText, bodyHtml, citations, faqJson…)                │
            │  6. checkPlagiarism shingling Jaccard (corpus top 50,       │
            │     seuil 0.30 interne / 0.10 RSS)                          │
            │  7. validateIntentAlignment (hardFails → tier_3)            │
            │  8. orchestration nextStatus :                              │
            │     - eligibleQualityLoop → 'quality_improving'             │
            │       (⚠️ pas de seuil bas <40)                             │
            │     - rssAutoPublishRequested → 'approved' + publish        │
            │     - else → 'needs_review' + ReviewQueue.pending           │
            │  9. logStep(validation) + alerts Telegram (5 reviews / fail)│
            └────────────────────────────────────────┬───────────────────┘
                                                     │
                  ┌──────────────────────────────────┼────────────────────────────┐
                  ▼                                  ▼                            ▼
        ┌────────────────────┐         ┌────────────────────────┐    ┌──────────────────────┐
        │ quality-improver    │         │ approval flow human    │    │ content-publish (auto│
        │  - kill_switch gate│         │ /content-gen/review-   │    │   pour RSS approved) │
        │  - budget cap usd   │         │   queue/[id]           │    │  - tx Article+       │
        │  - max attempts cap │         │  - iframe preview HMAC │    │    Translation FR    │
        │  - V1 = increment   │         │    token 10min         │    │  - faqJson stored    │
        │    counter only     │         │  - approve/reject/     │    │  - enqueueIndexing   │
        │    (no re-prompt)   │         │    promote_t1/edits    │    │    si promote_t1     │
        │  - back → review    │         │  - JSON brut details   │    │  - fact-check enq    │
        └─────────┬───────────┘         └────────────┬───────────┘    │  - qa-extract enq    │
                  │                                  │                │  - revalidateContent │
                  └──────────────────────────────────▼────────────────►───────────┬──────────┘
                                                                                  │
                                                              ┌───────────────────┼──────────────────┐
                                                              ▼                   ▼                  ▼
                                                  ┌───────────────────┐ ┌─────────────────┐ ┌──────────────┐
                                                  │ qa-extract        │ │ indexing        │ │ fact-check   │
                                                  │  - FAQ row upsert │ │  - IndexNow ping│ │  - Perplexity│
                                                  │  - tier_2 default │ │  - Google API   │ │    citations │
                                                  │  - revalidate     │ │  - dedupe origin│ │  - score     │
                                                  └───────────────────┘ └─────────────────┘ └──────────────┘
                                                                                  │
                                                                                  ▼
                                                                  ❌ MISSING : publishToKB(KB V4)
                                                                       targetKnowledgeEntryId reste NULL
```

**Pipelines indépendants** :

- **Pipeline 2 (RSS)** : `content-rss-fetch-worker` poll RSS sources → enqueue `content-gen` queue avec `contentType='blog_from_rss'`, `campaignId=null`. **Découplé** du flow campagne sectorielle ✅.
- **Pipeline 3 (landing_ville)** : créé via `/admin/content-gen/geo/[villeSlug]/generate` ou batches `/admin/content-gen/geo/batches/new` → enqueue `content-gen` queue avec `contentType='landing_ville'`. **Découplé** ✅ — n'apparaît plus dans `typeDistribution` d'une campagne sectorielle (validation Server Action `coverage.ts:139-148`).

---

## 3. Matrice 9 ContentType × { enum, UI, DB, template, validator }

Colonnes :

- **Enum** : présence dans `enum ContentType` Prisma + `prisma/generated/client`
- **UI list** : sélectionnable dans `/admin/content-gen/jobs` filtres (`TYPES` const)
- **UI dist** : autorisé dans `typeDistribution` d'une campagne sectorielle (interdit pour types bannis)
- **DB FK** : `ContentGenJob.contentType` (required) + `ContentMetric.contentType` (unique key)
- **Template** : `ContentTemplate.contentType` enum + au moins 1 template seed
- **Generator** : enregistré dans `getGenerator()` registry
- **Intent validator** : couvert par `validateIntentAlignment()`
- **Plagiarism seuil** : interne 0.30 ou RSS 0.10

| ContentType          | Enum | UI list | UI dist (sect.) | DB FK | Template             | Generator                      | Intent val. | Plagiat  |
| -------------------- | ---- | ------- | --------------- | ----- | -------------------- | ------------------------------ | ----------- | -------- |
| `landing_ville`      | ✅   | ✅      | ❌ banni        | ✅    | ✅ via geo/templates | ✅ `landingVilleGenerator`     | ✅          | 0.30     |
| `blog_article`       | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `blogArticleGenerator`      | ✅          | 0.30     |
| `blog_from_rss`      | ✅   | ✅      | ❌ banni        | ✅    | ✅                   | ✅ `blogFromRssGenerator`      | ✅          | **0.10** |
| `blog_from_keywords` | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `blogFromKeywordsGenerator` | ✅          | 0.30     |
| `blog_from_title`    | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `blogFromTitleGenerator`    | ✅          | 0.30     |
| `comparison`         | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `comparisonGenerator`       | ✅          | 0.30     |
| `guide_pilier`       | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `guidePilierGenerator`      | ✅          | 0.30     |
| `qa_derived`         | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `qaDerivedGenerator`        | ✅          | 0.30     |
| `faq_standalone`     | ✅   | ✅      | ✅              | ✅    | ✅                   | ✅ `faqStandaloneGenerator`    | ✅          | 0.30     |

**Cohérence 9 ContentType ↔ 7 EDITORIAL_CONTENT_TYPES** : `EDITORIAL_CONTENT_TYPES` (editorial-mix-rules.ts:14-22) = 7 valeurs (`blog_article`, `blog_from_keywords`, `blog_from_title`, `comparison`, `guide_pilier`, `qa_derived`, `faq_standalone`). `BANNED_FROM_EDITORIAL_MIX` = 2 valeurs (`landing_ville`, `blog_from_rss`). **Test `aucun type éditorial ne chevauche les types bannis`** (editorial-mix-rules.test.ts:31-37) garantit l'invariant. 9 = 7 + 2 ✅.

**Statuts pipeline (12 enum, 8 utilisés UI)** : `ContentGenJobStatus` déclare 12 valeurs (queued/running/generating_text/generating_image/running_qa/quality_improving/needs_review/approved/publishing/published/failed/cancelled). `/admin/content-gen/jobs` UI ne sélecte que 8 (audit opérationnel 2026-05-14 §2.1 retire les 4 orphelins jamais écrits). **OK — pas de divergence enum/DB, juste cosmétique UI** (commentaire `jobs/page.tsx:29-34`).

---

## 4. Statut des 3 secteurs

### 4.1. `interventions_formations`

| Item                                                         | Statut                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Enum Prisma `ServiceSector`                                  | ✅ ordre 1/3                                                                                                                          |
| Migration `20260516200000_add_service_sector`                | ✅ rétro-compat NULL legacy                                                                                                           |
| Label UI `SERVICE_SECTOR_LABELS["interventions_formations"]` | ✅ `"Interventions & Formations"`                                                                                                     |
| Profil distribution seed                                     | ✅ `coverage-distribution-profiles.ts` (slug `secteur-interventions-formations`)                                                      |
| Campagne draft seedée                                        | ✅ `Éditorial · Interventions & Formations`, scope multi, target 30, distribution dominée par `blog_article` 35 % + `qa_derived` 20 % |
| Filtre `/coverage` dropdown                                  | ✅                                                                                                                                    |
| Filtre `/jobs?serviceSector=interventions_formations`        | ✅ `listJobs({ serviceSector })` lit `campaign.serviceSector`                                                                         |
| Carte dashboard rollup                                       | ✅ première carte, clic = filtre `/jobs?serviceSector=interventions_formations`                                                       |
| Test `editorial-mix-rules` 3 secteurs présents               | ✅                                                                                                                                    |

### 4.2. `audits`

| Item                     | Statut                                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| Enum Prisma              | ✅ ordre 2/3                                                            |
| Label UI                 | ✅ `"Audits"`                                                           |
| Profil distribution seed | ✅ slug `secteur-audits` (comparison 30 % + guide_pilier 25 % dominent) |
| Campagne draft seedée    | ✅ `Éditorial · Audits`, target 30                                      |
| Carte dashboard          | ✅                                                                      |
| Filtre `/jobs`           | ✅                                                                      |

### 4.3. `implementations`

| Item                     | Statut                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Enum Prisma              | ✅ ordre 3/3                                                                       |
| Label UI                 | ✅ `"Implementations"`                                                             |
| Profil distribution seed | ✅ slug `secteur-implementations` (guide_pilier 30 % + blog_article 25 % dominent) |
| Campagne draft seedée    | ✅                                                                                 |
| Carte dashboard          | ✅                                                                                 |
| Filtre `/jobs`           | ✅                                                                                 |

**Découplage `landing_ville` / `blog_from_rss`** : 2 cartes dédiées dashboard (4ᵉ et 5ᵉ), libellées `"Landing villes (pipeline indép.)"` et `"Actualités RSS (pipeline indép.)"`. Clic = filtre `/jobs?contentType=landing_ville` (pas `serviceSector`). Note pédagogique présente dans `/coverage/new`. ✅.

---

## 5. Checklist exigences brief (13 items)

| #   | Exigence                                                        | Statut                                                                 | Référence                                                                                                                                                               |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dashboard rollup 3 secteurs visible                             | ✅                                                                     | `content-gen/page.tsx:80-117` + `dashboard.ts:getSectorBreakdownToday`                                                                                                  |
| 2   | `/coverage/new` dropdown 3 secteurs                             | ✅                                                                     | `coverage/new/page.tsx:200-217`                                                                                                                                         |
| 3   | `assertEditorialKeys` rejette landing_ville/blog_from_rss       | ✅ pure module 13 tests                                                | `editorial-mix-rules.ts:38-46` + `coverage.ts:139-148` (Server Action duplicate inline guard)                                                                           |
| 4   | Worker orchestrator `pickWeighted` par audience                 | ✅ `sampleAudienceMix` + `sampleWeighted`                              | `content-orchestrator-worker.ts:55-86`                                                                                                                                  |
| 5   | 9 ContentType + 7 EDITORIAL_CONTENT_TYPES cohérents             | ✅ test invariant zéro chevauchement                                   | matrice §3                                                                                                                                                              |
| 6   | Quality loop (score 40-74→quality_improving ; <40→needs_review) | ⚠️ **P0** seuil bas absent                                             | `content-gen-worker.ts:300-308` (un seul seuil 75)                                                                                                                      |
| 7   | Plagiarism + intent validator + Speakable FAQ extraction        | ✅ plagiat ✅ intent ⚠️ Speakable                                      | `content-gen-worker.ts:235-285` + `content-qa-extract-worker.ts` ; **Speakable selector `data-faq-q`/`data-faq-a` jamais émis côté FAQ rendu — cf. AGENT 3.E §1.51-52** |
| 8   | Approval flow `/review-queue/[id]`                              | ✅ 4 actions (approve/reject/promote_t1/requestEdits) + iframe HMAC    | `review-queue/[id]/page.tsx`                                                                                                                                            |
| 9   | Manon `aiGenerated=true` footer                                 | ❌ **P0** absent sur blog/article public                               | §1 P0-2                                                                                                                                                                 |
| 10  | Cost ledger incrémenté                                          | ✅ `trackCost()` transaction atomic                                    | `cost-tracker.ts:258-286`                                                                                                                                               |
| 11  | Kill switches global + per-provider + auto cost-cap cascade     | ✅ 3 mécanismes livrés                                                 | `kill-switch.ts` + `providers/page.tsx` enabled toggle + `cost-tracker.ts:handleCostCapHit`                                                                             |
| 12  | KB V4 `targetKnowledgeEntryId` lié                              | ❌ **P0** schéma OK mais write-back jamais appelé                      | §1 P0-1                                                                                                                                                                 |
| 13  | pSEO villes / blog_from_rss : pipelines indép.                  | ✅ découplés (queues, pas de `serviceSector`, validation banned-types) | RSS worker §2 + `coverage.ts:139-148`                                                                                                                                   |

---

## 6. Top P0 et P1 (avec localisation)

### P0 (3) — bloquants merge

| #        | Sujet                                                                  | Fichier:ligne                                                                                                                                                                                                                                         | Effort                 | Notes                                                                                                                                |
| -------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **P0-1** | KB V4 write-back manquant post-publish                                 | `content-publish-worker.ts:184-210` (insérer hook `publishToKB()` après `tx.contentGenJob.update`) + utiliser retour `entryId` pour `ContentGenJob.update({ targetKnowledgeEntryId, kbIngestStatus })`                                                | ~2-3 h                 | Désactiver le bouclage KB→KB pour `blog_from_rss` (déjà à 0.10 plagiat) si KB redondance. Helper `publishToKB` déjà testé.           |
| **P0-2** | Disclaimer Manon `aiGenerated=true` absent sur pages publiques article | `src/components/knowledge/public/AuthorByline.tsx` (étendre props + lecture `AuthorProfile.aiGenerated`/`personaDisclaimer`/`isPersona`) + appels sur blog/actualites/connaissances `[slug]/page.tsx`                                                 | ~3 h                   | Conformité AI Disclosure UE 2026 + EEAT YMYL. Doctrine v2.1 décide aiGenerated=true.                                                 |
| **P0-3** | Quality loop sans seuil bas — `<40` consomme budget inutilement        | `src/server/queue/workers/content-gen-worker.ts:300-308` ajouter `const MIN_QUALITY_LOOP_FLOOR = 40; eligibleQualityLoop = ... && score >= MIN_QUALITY_LOOP_FLOOR && score < qualityThreshold && ...`. `< 40` → `nextStatus = "needs_review"` direct. | ~30 min code + 4 tests | Master prompt v1.7 §27 exigeait deux paliers. Budget mensuel quality_loop $100 default — sans floor un batch dégradé peut le cramer. |

### P1 (5) — non bloquants mais à fixer Sprint correctif

| #    | Sujet                                                                                                                                                                                                                 | Fichier                                                                                                                    | Effort   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| P1-1 | Orchestrator-worker n'a aucun guard runtime contre `BANNED_FROM_EDITORIAL_MIX` (defense-in-depth si campagne legacy avec `serviceSector` ajouté a posteriori)                                                         | `content-orchestrator-worker.ts:208-211` — wrap `sampleWeighted(typeDist)` avec assert si `campaign.serviceSector != null` | 20 min   |
| P1-2 | Speakable selector `[data-faq-q]/[data-faq-a]` exigé par `buildFaqJsonLd` mais aucun composant React n'applique ces attrs sur les Q/R rendues (cf. AGENT 3.E §1.51-52) — JSON-LD Speakable pointe vers DOM inexistant | `src/components/marketing/FaqSection.tsx` (à grep) + qa-extract-worker.ts insérer attrs                                    | 1-2 h    |
| P1-3 | Quality-improver V1 ne fait que `qualityImprovementAttempts++` sans re-prompt LLM (commentaire avoue V2). Le `nextStatus='quality_improving'` sert juste à différer needs_review — pas de gain qualité                | `content-quality-improver-worker.ts:146-162`                                                                               | 6-8 h V2 |
| P1-4 | `/coverage/new` accepte distribution JSON main-tapé : pas de pré-suggestion auto depuis profil sectoriel sélectionné. Friction admin + risque erreur somme≠100                                                        | `coverage/new/page.tsx` UX                                                                                                 | 1-2 h    |
| P1-5 | Migration `20260516200000_add_service_sector` rétro-compat NULL : pas de back-fill des CoverageCampaign legacy → carte rollup peut sous-compter si campagnes pré-2026-05-16 actives                                   | data migration script + script `back-fill-service-sector.ts`                                                               | 30 min   |

### P2 (cosmétique)

- Filtre dropdown `/coverage` n'affiche pas count par secteur (UX info).
- `getSectorBreakdownToday` fait 5 × 3-4 Prisma calls (15+ queries) en série de `Promise.all` imbriqués. `groupBy` unique sur `ContentGenJob` + join campaign serait ~5×plus rapide. Pas bloquant V1.
- 4 statuts pipeline orphelins (`generating_text`, `generating_image`, `running_qa`, `approved`) restent dans l'enum mais jamais écrits (cf. commentaire `jobs/page.tsx:29-34`). À retirer en V2 via migration enum (lourd, casse FK).

---

## 7. Scoring /150

| Axe                                                        | Pondération | Note brute                                                             | Score       |
| ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- | ----------- |
| Architecture flow & découplage sectoriel                   | 25          | 22 (decoupling exemplaire, P1-1 orchestrator guard manquant)           | 22/25       |
| Modèle DB + migrations + enum cohérence                    | 20          | 19 (schema + index + tests + back-fill manquant P1-5)                  | 19/20       |
| Worker pipeline (orchestrator + gen + quality + publish)   | 25          | 18 (P0-3 quality floor + P1-3 quality V1 stub)                         | 18/25       |
| Qualité (plagiarism + intent + dedup)                      | 15          | 14 (3 layers livrés, configurable DB-managed)                          | 14/15       |
| Approval / review flow UX + sécurité (HMAC preview + RBAC) | 10          | 10 (token 10 min + requireAdmin)                                       | 10/10       |
| Kill switches + cost ledger + cascade auto                 | 15          | 14 (cascade complète, audit trail cost_cap_events)                     | 14/15       |
| Manon + EEAT transparence IA                               | 10          | 4 (P0-2 disclaimer absent public)                                      | 4/10        |
| KB V4 binding bidirectionnel                               | 15          | 4 (P0-1 write-back jamais wired)                                       | 4/15        |
| Speakable FAQ + sitemap-news + indexing                    | 10          | 6 (FAQ ext OK mais selector inerte, news pipeline OK)                  | 6/10        |
| Tests + documentation flow                                 | 5           | 5 (13 tests editorial-mix-rules + tests workers + audit trail logStep) | 5/5         |
| Découplage pipelines indép. + observabilité dashboard      | 10          | 9 (rollup 5 cartes + Telegram alerts 7 hooks)                          | 9/10        |
| **Total**                                                  | **150**     | —                                                                      | **117/150** |

**Verdict : 🟡 NEAR-GO conditional (78,0 %)** — segmentation 3 secteurs et orchestration techniquement solides ; trois P0 fixables en ~6 h sur 1 PR (KB binding 3 h + Manon disclaimer 3 h + quality floor 30 min). Sans ces 3 fixes : on accumule dette EEAT + dette KB qui pénaliseront les générations futures (boucle qualité contextuelle dégradée).

---

## 8. Recommandation orchestration

1. **Sprint correctif content-gen 7.1** (1 PR, ~6 h) :
   - Fix P0-1 (KB binding) — hook `publishToKB()` après `tx.contentGenJob.update` dans `content-publish-worker.ts`. Persister `entryId` + `kbIngestStatus`.
   - Fix P0-2 (Manon disclaimer) — étendre `AuthorByline` props + injecter sur 3 templates publics blog/actualites/connaissances.
   - Fix P0-3 (quality floor 40) — 3 LOC + 4 tests Vitest.
2. **Sprint 7.2** (P1, ~10 h) :
   - P1-1 orchestrator runtime guard banned-types.
   - P1-2 Speakable selector `data-faq-q/a` injection côté qa-extract + FAQ page render.
   - P1-3 Quality-improver V2 re-prompt LLM (sections sous-score identifiées via heuristique on bodyText).
   - P1-5 script back-fill `serviceSector` legacy campaigns.
3. **Re-audit Pass B content-gen** post-fixes → cible 135+/150 🟢 GO.

---

## 9. Annexe : références fichiers principaux

| Composant                              | Path                                                                       | Lignes utiles                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Module pur règles                      | `src/server/content-gen/shared/editorial-mix-rules.ts`                     | 1-62 (3 secteurs + assertEditorialKeys + assertSum100)                                                |
| Tests règles                           | `src/server/content-gen/shared/editorial-mix-rules.test.ts`                | 13 tests verts                                                                                        |
| Server Action coverage                 | `src/server/actions/content-gen/coverage.ts`                               | 139-148 (guard banned-types)                                                                          |
| Server Action distribution             | `src/server/actions/content-gen/distribution.ts`                           | 73-75 (assertEditorialKeys+assertSum100 inline)                                                       |
| Dashboard rollup                       | `src/server/actions/content-gen/dashboard.ts:getSectorBreakdownToday`      | 134-251                                                                                               |
| Page dashboard                         | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx`              | 80-117                                                                                                |
| Page /coverage/new                     | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/new/page.tsx` | 200-217 (dropdown) + 250-269 (note pédagogique)                                                       |
| Page /jobs                             | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/page.tsx`         | 11-15 (import) + 67 (filter)                                                                          |
| Worker orchestrateur                   | `src/server/queue/workers/content-orchestrator-worker.ts`                  | 86-323                                                                                                |
| Worker gen                             | `src/server/queue/workers/content-gen-worker.ts`                           | 137-529                                                                                               |
| Worker quality-improver                | `src/server/queue/workers/content-quality-improver-worker.ts`              | 79-163                                                                                                |
| Worker publish                         | `src/server/queue/workers/content-publish-worker.ts`                       | 100-310                                                                                               |
| Worker QA extract                      | `src/server/queue/workers/content-qa-extract-worker.ts`                    | 60-100+                                                                                               |
| Worker RSS fetch                       | `src/server/queue/workers/content-rss-fetch-worker.ts`                     | 1-60                                                                                                  |
| Generators registry                    | `src/server/content-gen/generators/index.ts`                               | 1-44                                                                                                  |
| Cost tracker + cascade                 | `src/server/content-gen/lib/cost-tracker.ts`                               | 36-296                                                                                                |
| Kill switch global                     | `src/server/actions/content-gen/kill-switch.ts`                            | 1-80                                                                                                  |
| KB feeder (jamais wired)               | `src/server/content-gen/kb-feeder.ts`                                      | 1-80                                                                                                  |
| Schema 3 sectors                       | `prisma/schema.prisma`                                                     | enum ServiceSector + `CoverageCampaign.serviceSector?` + `CoverageDistributionProfile.serviceSector?` |
| Migration sector                       | `prisma/migrations/20260516200000_add_service_sector/migration.sql`        | 21 lignes                                                                                             |
| Seed sector campaigns                  | `prisma/seeds/content-gen/sector-campaigns.ts`                             | 1-120                                                                                                 |
| Seed sector distribution profiles      | `prisma/seeds/content-gen/coverage-distribution-profiles.ts`               | étendu (+60 lignes vs pré-2026-05-16)                                                                 |
| Manon page profil (disclaimer présent) | `src/app/[locale]/equipe/[slug]/page.tsx`                                  | 91-105                                                                                                |
| AuthorByline (disclaimer absent ❌)    | `src/components/knowledge/public/AuthorByline.tsx`                         | 9-88                                                                                                  |

**FIN AGENT 4.B — Flow CONTENT-GEN.**
