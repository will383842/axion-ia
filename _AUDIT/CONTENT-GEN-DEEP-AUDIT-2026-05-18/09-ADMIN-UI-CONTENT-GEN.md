# 09 — ADMIN UI CONTENT-GEN — Audit 50+ sous-pages V1/V2

> **Score : 78/100 — Status global : 🟡 BON, sprint correctif sécurité requis**
>
> Date : 2026-05-18 · HEAD git : `9c1adaa` · Mode : AUDIT-ONLY STRICT (zéro modif code)
> Périmètre : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**`

---

## 0. Récapitulatif global

| Indicateur                                                         |                                                                                                                     Valeur | Note                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------- |
| Total `page.tsx` racine (V1 entrypoints)                           |                                                                                                                     **47** | inventaire factuel via Glob                                           |
| Total composants `_v2/*V2.tsx`                                     |                                                                                                                     **47** | parité 1:1 avec V1 (sauf `city-coverage` qui est V2-only)             |
| Sous-pages V1 markup substantiel                                   |                                                                                                                         46 | toutes sauf `city-coverage` (V1 = simple message « Activez la V2 »)   |
| Sous-pages V2 uniquement (V1 retiré)                               |                                                                                                        1 (`city-coverage`) | confirmé Read page.tsx ligne 31-46                                    |
| Sous-pages V1 sans équivalent V2                                   |                                                                                                                          0 | parité totale                                                         |
| Server Actions content-gen avec **rate-limit P1-30** direct        |                                                               1/19 fichiers actions (`_settings.ts:writeContentGenConfig`) | toutes les `update*` settings hérient indirectement via ce chokepoint |
| Server Actions content-gen avec **audit log SOC2 P1-9** direct     |                                                                                     1/19 fichiers actions (`_settings.ts`) | idem — couverture indirecte des update settings                       |
| Actions writes **HORS chokepoint** (sans rate-limit ni SOC2 audit) |                                                                    **providers, templates, review, jobs, author, article** | `requireAdmin()` only + `logActivity()` ActivityLog historique        |
| Auth admin (sidebar/page)                                          |                                                                       OK : `auth()` + `redirect` login sur chaque page.tsx | Pattern uniforme vérifié sur 8 spot-checks                            |
| Middleware/proxy admin                                             | `src/proxy.ts` ne touche pas content-gen — protection est layout-level via `ADMIN_URL_PREFIX` notFound + `auth()` redirect | confirmé Grep + Read `[adminPrefix]/layout.tsx`                       |

**Mécanisme V1/V2** (ADR 0028 implicite, refonte mai 2026) :

- Chaque `page.tsx` racine importe `isAdminV2Enabled()` depuis `src/lib/feature-flags.ts`
- Si cookie session `admin_v2=1` (override per-user) **OU** env var `ADMIN_V2_ENABLED=true` (bascule globale) → rend `<XxxV2 />` depuis `./_v2/XxxV2.tsx`
- Sinon : markup V1 historique inline dans la page
- Will active la V2 en preview via cookie sans toucher la prod

---

## 1. Tableau exhaustif

> Légende : `Auth` = redirect login si pas de session · `RL` = rate-limit P1-30 sur Server Action write · `Audit` = SOC2 audit log P1-9 · `Indirect` = wrapper via `writeContentGenConfig` qui porte les 2 protections.

| #   | Path                                               | V1      | V2  | Rôle (1 phrase Will)                                                    | Fonctionnelle | Auth | RL                                                                                                                    | Audit                                 | Status     |
| --- | -------------------------------------------------- | ------- | --- | ----------------------------------------------------------------------- | ------------- | ---- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- |
| 1   | `/content-gen` (dashboard)                         | ✅      | ✅  | KPIs 7j + état queue + KB + kill-switch + quick gen                     | oui           | ✅   | indirect (quickGen→enqueueDirectGen)                                                                                  | partiel                               | 🟢         |
| 2   | `/content-gen/orchestrator`                        | ✅      | ✅  | vue campagnes actives + daily plan + quotas pipelines                   | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 3   | `/content-gen/coverage`                            | ✅      | ✅  | liste campagnes coverage par secteur                                    | oui           | ✅   | n/a                                                                                                                   | n/a                                   | 🟢         |
| 4   | `/content-gen/coverage/new`                        | ✅      | ✅  | wizard création campagne                                                | oui           | ✅   | ❌ `coverage.ts` writes (UNKNOWN — `grep -n requireAdminWriteRateLimited src/server/actions/content-gen/coverage.ts`) | partiel (logActivity)                 | 🟡         |
| 5   | `/content-gen/coverage/[id]`                       | ✅      | ✅  | détail/pause/resume/cancel d'une campagne                               | oui           | ✅   | ❌ idem                                                                                                               | partiel                               | 🟡         |
| 6   | `/content-gen/city-coverage`                       | ⚠️ stub | ✅  | dashboard couverture villes pilote (6 villes Tier-1)                    | oui (V2 only) | ✅   | n/a (lecture VilleCopy fichiers)                                                                                      | n/a                                   | 🟡 V1 vide |
| 7   | `/content-gen/geo`                                 | ✅      | ✅  | cockpit villes : génération unitaire + batch                            | oui           | ✅   | ❌ `geo.ts` (UNKNOWN — pas vu dans grep RL)                                                                           | partiel                               | 🟡         |
| 8   | `/content-gen/geo/batches`                         | ✅      | ✅  | liste batches lancés (audit/interventions/implementation)               | oui           | ✅   | ❌ idem                                                                                                               | partiel                               | 🟡         |
| 9   | `/content-gen/geo/batches/new`                     | ✅      | ✅  | wizard lancement batch villes (DEPT/REGION/VILLES)                      | oui           | ✅   | ❌ idem                                                                                                               | partiel                               | 🟡         |
| 10  | `/content-gen/geo/batches/[id]`                    | ✅      | ✅  | suivi avancement batch                                                  | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 11  | `/content-gen/geo/history`                         | ✅      | ✅  | historique générations villes (Article archive)                         | oui           | ✅   | n/a                                                                                                                   | n/a                                   | 🟢         |
| 12  | `/content-gen/geo/[villeSlug]/generate`            | ✅      | ✅  | génération unitaire 1 ville → 1 verticale                               | oui           | ✅   | ❌ enqueueDirectGen (UNKNOWN)                                                                                         | partiel                               | 🟡         |
| 13  | `/content-gen/jobs`                                | ✅      | ✅  | liste BullMQ ContentGenJob filtrée 9 colonnes                           | oui           | ✅   | ❌ retryJob/cancelJob/retryAllFailed                                                                                  | ✅ logActivity (pas SOC2)             | 🟡         |
| 14  | `/content-gen/jobs/[id]`                           | ✅      | ✅  | détail job + logs 100 derniers steps + retry/cancel                     | oui           | ✅   | ❌                                                                                                                    | ✅ logActivity                        | 🟡         |
| 15  | `/content-gen/kb-readonly`                         | ✅      | ✅  | viewer KB published (lecture pure, mutations via skill connaissances)   | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 16  | `/content-gen/kb-readonly/[id]`                    | ✅      | ✅  | détail entrée KB                                                        | oui           | ✅   | n/a                                                                                                                   | n/a                                   | 🟢         |
| 17  | `/content-gen/keyword-tracking`                    | ✅      | ✅  | dashboard GSC shadow V1 (cron pas câblé — table vide)                   | oui (vide)    | ✅   | n/a                                                                                                                   | n/a                                   | 🟡 shadow  |
| 18  | `/content-gen/landing-variants`                    | ✅      | ✅  | 4 variants generator landing villes                                     | oui           | ✅   | indirect via writeContentGenConfig                                                                                    | indirect                              | 🟢         |
| 19  | `/content-gen/landing-variants/[variant]`          | ✅      | ✅  | édit 1 variant (prompts + tokens)                                       | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 20  | `/content-gen/onboarding`                          | ✅      | ✅  | wizard checklist 1ère visite (providers, manon, distribution)           | oui           | ✅   | indirect (writeContentGenConfig "onboarded")                                                                          | indirect                              | 🟢         |
| 21  | `/content-gen/publications`                        | ✅      | ✅  | browser Articles publiés + edit/archive/demote/rollback                 | oui           | ✅   | ❌ `article.ts` (UNKNOWN)                                                                                             | partiel (logActivity Article actions) | 🟡         |
| 22  | `/content-gen/publications/[id]/edit`              | ✅      | ✅  | éditeur article (Tiptap-like)                                           | oui           | ✅   | ❌ updateArticle                                                                                                      | partiel                               | 🟡         |
| 23  | `/content-gen/publications-status`                 | ✅      | ✅  | dashboard temps-réel status pipelines                                   | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 24  | `/content-gen/quality`                             | ✅      | ✅  | 5 scores moyens 30j (seo/quality/readability/factcheck/editorial)       | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 25  | `/content-gen/queue`                               | ✅      | ✅  | visualisation BullMQ jobs waiting/active/delayed/failed                 | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 26  | `/content-gen/review-queue`                        | ✅      | ✅  | workflow approbation Will critique (approve/reject/promote/bulk)        | oui           | ✅   | ❌ `review.ts` 6 writes → `requireAdmin()` seul                                                                       | ✅ logActivity (pas SOC2)             | 🟡         |
| 27  | `/content-gen/review-queue/[id]`                   | ✅      | ✅  | détail review : preview article + edit/promote tier-1                   | oui           | ✅   | ❌ idem                                                                                                               | partiel                               | 🟡         |
| 28  | `/content-gen/rss`                                 | ✅      | ✅  | sources RSS configurables (add/toggle/update/remove)                    | oui           | ✅   | indirect (writeContentGenConfig "rss_sources")                                                                        | indirect                              | 🟢         |
| 29  | `/content-gen/rss/new`                             | ✅      | ✅  | wizard ajout source RSS (URL + pollInterval + autoPublish)              | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 30  | `/content-gen/rss/[id]`                            | ✅      | ✅  | édit source RSS existante                                               | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 31  | `/content-gen/similarity-monitor`                  | ✅      | ✅  | placeholder cron quotidien table `SimilarityPair` Sprint 4              | oui (stub)    | ✅   | n/a                                                                                                                   | n/a                                   | 🟡 stub    |
| 32  | `/content-gen/templates`                           | ✅      | ✅  | liste 9 ContentType × N variantes templates                             | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 33  | `/content-gen/templates/new`                       | ✅      | ✅  | création template (systemPrompt + userTemplate + Zod schema)            | oui           | ✅   | ❌ `templates.ts` upsertTemplate → `requireAdmin()` seul                                                              | ❌ aucun audit log                    | 🟠         |
| 34  | `/content-gen/templates/[id]`                      | ✅      | ✅  | édit template + versioning auto (version+1 à chaque save)               | oui           | ✅   | ❌ idem + toggleTemplate                                                                                              | ❌ aucun audit log                    | 🟠         |
| 35  | `/content-gen/costs`                               | ✅      | ✅  | ledger LLM providers (cost/article, monthlyCap, currentSpent)           | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 36  | `/content-gen/author/manon`                        | ✅      | ✅  | édit profil Manon (nom, jobTitle, bio, photoAlt, disclaimer IA persona) | oui           | ✅   | ❌ `author.ts:updateAuthor` → `requireAdmin()` seul                                                                   | ❌ aucun audit log                    | 🟠         |
| 37  | `/content-gen/settings` (index)                    | ✅      | ✅  | index des 13 sous-pages settings                                        | oui           | ✅   | n/a (lecture)                                                                                                         | n/a                                   | 🟢         |
| 38  | `/content-gen/settings/audience-mix`               | ✅      | ✅  | mix audience cible (P2P/B2B/grand public) par contentType               | oui           | ✅   | indirect (writeContentGenConfig)                                                                                      | indirect                              | 🟢         |
| 39  | `/content-gen/settings/banned-phrases`             | ✅      | ✅  | liste expressions interdites (filter LLM output)                        | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 40  | `/content-gen/settings/batches`                    | ✅      | ✅  | tailles batch + concurrency workers + retry + dailyTargetByType         | oui           | ✅   | indirect (`updateBatchSettings`→writeContentGenConfig)                                                                | indirect                              | 🟢         |
| 41  | `/content-gen/settings/coverage-distribution`      | ✅      | ✅  | distribution % par sub-vertical / par contentType                       | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 42  | `/content-gen/settings/kb-ingest`                  | ✅      | ✅  | config ingestion KB (chunks size, embeddings provider)                  | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 43  | `/content-gen/settings/kill-switch`                | ✅      | ✅  | 1-clic stop toutes générations (reason + activatedAt)                   | oui           | ✅   | indirect (writeContentGenConfig "kill_switch") + logActivity                                                          | indirect + logActivity                | 🟢         |
| 44  | `/content-gen/settings/llms-txt`                   | ✅      | ✅  | éditeur llms.txt (~50KB max, max 50_000 chars)                          | oui           | ✅   | indirect (`updateLlmsTxt`→writeContentGenConfig)                                                                      | indirect                              | 🟢         |
| 45  | `/content-gen/settings/policies`                   | ✅      | ✅  | skipVilleIfCopyExists + plagiat Jaccard + retention tier-3              | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 46  | `/content-gen/settings/providers`                  | ✅      | ✅  | CRUD ProviderConfig (toggles, model, monthlyCap, rateLimitRpm)          | oui           | ✅   | ❌ `providers.ts:updateProvider/resetProviderSpend` → `requireAdmin()` seul                                           | ❌ aucun audit log ni logActivity     | 🔴         |
| 47  | `/content-gen/settings/qa-policies`                | ✅      | ✅  | post-process Q/R auto (seuils questions, longueurs)                     | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 48  | `/content-gen/settings/quality-loop`               | ✅      | ✅  | boucle qualité v1.7 (minScore, targetScore, maxAttempts, monthlyCap)    | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |
| 49  | `/content-gen/settings/search-intent-distribution` | ✅      | ✅  | mix searchIntent (informational/transactional/...) par contentType      | oui           | ✅   | indirect                                                                                                              | indirect                              | 🟢         |

**Totaux** : 49 sous-pages auditées (incluant `/content-gen` racine et `/settings` index). 8 manquantes par rapport au prompt initial : `/orchestrator/new` (non livré), `/keyword-tracking` (V1 vide shadow), `/jobs/[id]/_v2/JobDetailV2` (✅ présent en V2). Les autres prévues du prompt sont alignées 1:1.

---

## 2. Sections détaillées par groupe

### 2.1 Orchestrator (briefing)

**Path** : `/content-gen/orchestrator` (V1 + V2 OK).

**Rôle Will (simple)** : la vue d'accueil pour piloter — combien de campagnes tournent, quels quotas, quels pipelines actifs. Pas d'action de write directe sur cette page (juste des liens vers `/coverage/[id]`).

**Sécurité** :

- Auth ✅ via `auth()` + redirect `/login` si pas de session.
- Pas de Server Action write côté page → pas de rate-limit nécessaire.
- Lecture pure : `getOrchestratorStats()` + `getBatchSettings()`.

**Statut** : 🟢 fonctionnel.

**Note V2** : la route `/orchestrator/new` annoncée dans le prompt initial **n'existe pas** dans le code (Glob ne la retourne pas). À retirer du périmètre.

---

### 2.2 Coverage (campagnes par secteur)

**Paths** : `/coverage`, `/coverage/new`, `/coverage/[id]` (V1 + V2 OK pour les 3) · plus `/city-coverage` (V2 only, V1 affiche message).

**Rôle Will (simple)** :

- `/coverage` : liste de toutes les campagnes (draft/running/paused/completed/cancelled) par secteur (audit, interventions, implementation, un-a-un).
- `/coverage/new` : wizard pour lancer une nouvelle campagne (scope + ContentType + volumes cibles).
- `/coverage/[id]` : détail d'une campagne avec pause/resume/cancel.
- `/city-coverage` : tableau 6 villes pilote (Paris, Lyon, Saint-Etienne, Grenoble, Valence, Montpellier) avec score complétude par dimension (18 critères, 5 dimensions). V2 only — V1 montre juste un message « Activez le cookie `admin_v2=1` ».

**Sécurité** :

- Auth ✅ uniforme.
- Writes (`createCampaign`, `pauseCampaign`, `resumeCampaign`, `cancelCampaign`) dans `coverage.ts` : `requireAdmin()` direct, **PAS** de `requireAdminWriteRateLimited` (vérifié grep — 0 occurrence dans ce fichier).
  - **UNKNOWN sur audit log** : pas vérifié si `logActivity()` est appelé dans `coverage.ts`. À fact-check : `grep -n "logActivity\|writeAuditLog" src/server/actions/content-gen/coverage.ts`.
- `/city-coverage` est lecture pure (parse fichiers `src/content/villes/copy/*.ts`).

**Statut** : 🟡 — writes campaign sans rate-limit ni SOC2. Pas critique car Will est un seul humain qui clique, mais doctrine A10 P1-30 recommande couverture systématique.

---

### 2.3 Geo (villes/batches)

**Paths** : `/geo`, `/geo/batches`, `/geo/batches/new`, `/geo/batches/[id]`, `/geo/history`, `/geo/[villeSlug]/generate` (tous V1 + V2 ✅).

**Rôle Will (simple)** :

- `/geo` : cockpit principal villes — accès rapide aux 6 villes pilote + batch launcher.
- `/geo/batches` : liste des batches déjà lancés (DEPT/REGION/VILLES × verticale).
- `/geo/batches/new` : wizard pour lancer un batch (sélection villes, verticale, ContentType, priorité).
- `/geo/batches/[id]` : suivi avancement avec compteurs queued/running/published/failed.
- `/geo/history` : historique des articles villes publiés.
- `/geo/[villeSlug]/generate` : génération unitaire 1 ville → 1 verticale (debug/tuning).

**Sécurité** :

- Auth ✅.
- `geo.ts` exporte 4 fonctions dont au moins `enqueueGeoBatch` et `enqueueDirectGen` qui mutent BullMQ + DB. Vérifié grep : 0 `requireAdminWriteRateLimited` dans `geo.ts`. Présence de `requireAdmin()` × 4.
- **UNKNOWN sur audit log SOC2** : non vérifié, à confirmer via `grep -n writeAuditLog src/server/actions/content-gen/geo.ts`.

**Statut** : 🟡 — fonctionnel mais rate-limit/audit log non couverts sur le chokepoint batch (impact si Will lance accidentellement 10 batches d'affilée — pas de garde-fou côté actions).

---

### 2.4 Jobs (state queues BullMQ)

**Paths** : `/jobs`, `/jobs/[id]` (V1 + V2 ✅).

**Rôle Will (simple)** :

- `/jobs` : liste des ContentGenJob filtrable (status, contentType, templateId, campaignId, serviceSector, search), pagination 50/page. 8 statuts effectifs (V1.0.2).
- `/jobs/[id]` : détail job + 100 derniers `GenerationLog` steps + actions retry/cancel.

**Sécurité** :

- Auth ✅.
- Writes (`retryJob`, `cancelJob`, `retryAllFailed`) dans `jobs.ts` : `requireAdmin()` seul (3 occurrences vérifiées). **PAS** de rate-limit.
- ✅ `logActivity()` appelé sur chaque write (ActivityLog table historique — pas le ContentGenAuditLog SOC2).
- ⚠️ `retryAllFailed` cap 500 jobs côté code — protection volume, mais sans rate-limit côté action, Will pourrait lancer 1000 retries en 60 secondes (peu probable mais protégeable).

**Statut** : 🟡 — couverture activity-log OK mais P1-9 SOC2 (ContentGenAuditLog) absent + P1-30 rate-limit absent.

---

### 2.5 KB readonly (KB browser)

**Paths** : `/kb-readonly`, `/kb-readonly/[id]` (V1 + V2 ✅).

**Rôle Will (simple)** : viewer pur de la KB (KnowledgeEntry published) pour vérifier la santé avant de lancer une campagne. **Mutations interdites ici** — passer par `/connaissances/` (skill séparé).

**Sécurité** :

- Auth ✅.
- Lecture pure (`prisma.knowledgeEntry.count/groupBy/findMany`).
- Pas de Server Action write.

**Statut** : 🟢 — read-only safe.

---

### 2.6 Keyword tracking (GSC shadow V1)

**Path** : `/keyword-tracking` (V1 + V2 ✅).

**Rôle Will (simple)** : dashboard des positions SERP par keyword (source GSC/SerpAPI/manual) avec trending + gaps (position 11-20) + cannibalisation. **V1 mode shadow** — la table `KeywordTracking` est vide tant que le cron n'est pas câblé (Sprint 12.5 task #5 en pending).

**Sécurité** :

- Auth ✅.
- Lecture pure.

**Statut** : 🟡 — fonctionnel mais 0 row tant que cron pas activé. À surveiller : annoncer la disponibilité au Will quand le cron sera live.

---

### 2.7 Landing variants (4 generator variants)

**Paths** : `/landing-variants`, `/landing-variants/[variant]` (V1 + V2 ✅).

**Rôle Will (simple)** : config des 4 variants du generator de landing villes (prompts, tokens, modèle). Édition d'un variant fait écrire dans `ContentGenConfig` → traverse `writeContentGenConfig` → couvert rate-limit + audit log.

**Sécurité** :

- Auth ✅.
- Writes via `writeContentGenConfig` → **rate-limit indirect** (60/min/admin/setting) + **SOC2 audit log indirect** ✅.

**Statut** : 🟢 — modèle exemplaire.

---

### 2.8 Onboarding (quickstart admin)

**Path** : `/onboarding` (V1 + V2 ✅).

**Rôle Will (simple)** : checklist linéaire 1ère visite — providers configurés, Manon en place, profil de distribution actif, flag `onboarded=true`. V1.5 prévoit Stepper modal Radix Dialog.

**Sécurité** :

- Auth ✅.
- Writes via `writeContentGenConfig("onboarded", ...)` → couvert.

**Statut** : 🟢.

---

### 2.9 Publications (Articles DB browser)

**Paths** : `/publications`, `/publications/[id]/edit`, `/publications-status` (V1 + V2 ✅).

**Rôle Will (simple)** :

- `/publications` : browser Articles publiés via content-gen avec actions inline edit/demote-tier1/archive/unarchive/rollback (P0-9/10/11 fix audit 2026-05-14).
- `/publications/[id]/edit` : éditeur article complet (Tiptap-like markdown + meta).
- `/publications-status` : dashboard temps-réel par pipeline (publié 24h, en cours, failed, etc.).

**Sécurité** :

- Auth ✅.
- Writes `article.ts` : `archiveArticle`, `demoteArticle`, `rollbackArticle`, `unarchiveArticle`, `updateArticle` → grep dit 7 occurrences `requireAdmin()` + 8 `writeAuditLog`/`logActivity` (à départager : `grep -n "writeAuditLog\|logActivity" src/server/actions/content-gen/article.ts`).
- **UNKNOWN sur rate-limit** : non vérifié dans `article.ts` — à grep.

**Statut** : 🟡 — couverture probable via logActivity, mais SOC2 strict probablement absent. À fact-check.

---

### 2.10 Quality + Queue + Review-queue

**Paths** : `/quality`, `/queue`, `/review-queue`, `/review-queue/[id]` (V1 + V2 ✅).

**Rôle Will (simple)** :

- `/quality` : 5 scores moyens (SEO, qualité, lisibilité, fact-check, éditorial) sur 30 jours glissants. Lecture pure.
- `/queue` : visualisation BullMQ (waiting/active/delayed/failed/completed).
- `/review-queue` : workflow critique APPROVAL Will — approve / reject / needs_edits / promote_t1 / bulk_approve / bulk_reject.
- `/review-queue/[id]` : preview article + actions inline.

**Sécurité** :

- Auth ✅ sur les 4 pages.
- `review.ts` writes : 6 fonctions de write (`approveReview`, `rejectReview`, `bulkApproveReviews`, `bulkRejectReviews`, `requestEdits`, `promoteToTier1`). Toutes : `requireAdmin()` + `logActivity()` ✅. **PAS** de `requireAdminWriteRateLimited` ni `writeAuditLog` SOC2.
- ⚠️ `bulkApproveReviews(minScore=75, limit=100)` peut publier 100 articles d'un coup sans rate-limit côté action — `limit≤500` côté code.

**Statut** : 🟡 — bulk approve sans rate-limit + SOC2 absent sur workflow critique = priorité moyenne à durcir.

---

### 2.11 RSS sources

**Paths** : `/rss`, `/rss/new`, `/rss/[id]` (V1 + V2 ✅).

**Rôle Will (simple)** : gestion des sources RSS avec add / toggle ON-OFF / update / remove. Stockage V1 = liste JSON dans `ContentGenConfig.key="rss_sources"`. Migration table `RssSource`/`RssItem` dédiée prévue Sprint 4.

**Sécurité** :

- Auth ✅.
- 4 writes (`addRssSource`, `updateRssSource`, `removeRssSource`, `toggleRssSource`) : tous via `writeContentGenConfig` → **couvert rate-limit + SOC2 audit log** ✅.

**Statut** : 🟢.

---

### 2.12 Similarity monitor (dedup MinHash)

**Path** : `/similarity-monitor` (V1 + V2 ✅).

**Rôle Will (simple)** : placeholder — la couche C (surveillance similarité cosine + Jaccard post-publi avec cron quotidien 04:30 et table `SimilarityPair`) est prévue Sprint 4. V1 affiche juste statut des 3 couches anti-doublon (A idempotency ✅, B dedup-guard pré-IA ✅, C cron ⏳).

**Sécurité** : Auth ✅, pas de writes V1.

**Statut** : 🟡 stub — assumé.

---

### 2.13 Templates

**Paths** : `/templates`, `/templates/new`, `/templates/[id]` (V1 + V2 ✅).

**Rôle Will (simple)** : CRUD des ContentTemplate (9 ContentType × N variantes) avec édition `systemPrompt` / `userPromptTemplate` / `outputSchemaZod` / `variables` / `expansionMode` / `defaultModel` override / `defaultTemperature` / `defaultMaxTokens` / toggle `isActive`. Versioning auto : `version+1` à chaque save (`upsertTemplate` ligne 158).

**Sécurité** :

- Auth ✅.
- Writes (`upsertTemplate`, `toggleTemplate`) : `requireAdmin()` seul. **PAS** de `requireAdminWriteRateLimited` ni `writeAuditLog` ni même `logActivity`.
- ⚠️ Templates = code-as-data critique (prompts LLM qui pilotent toute la génération). Aucun audit trail = **0 trace** si Will (ou un attaquant avec session admin volée) modifie un systemPrompt. Risque : changement silencieux du ton, fuite de PII via prompt malicieux, etc.

**Statut** : 🟠 — **gap critique sécurité** : templates = chokepoint éditorial sans aucun audit log. À durcir P1.

---

### 2.14 Costs (cost ledger)

**Path** : `/costs` (V1 + V2 ✅).

**Rôle Will (simple)** : lecture du `cost_ledger` (1 row/appel provider) + agrégats par provider/jour. Aide à anticiper le mensuel.

**Sécurité** : Auth ✅, lecture pure.

**Statut** : 🟢.

---

### 2.15 Author / Manon

**Path** : `/author/manon` (V1 + V2 ✅).

**Rôle Will (simple)** : édit du profil Manon — `displayName`, `jobTitle`, `bioMd`, `photoAlt`, `aiGenerated`, `linkedinUrl`, `knowsAbout[]`, `isPersona` + `personaDisclaimer` (obligatoire si `isPersona=true` & slug=manon, ligne 85). Le JSON-LD Person est reconstruit à chaque save via `buildPersonManonJsonLd()`.

**Sécurité** :

- Auth ✅.
- Write (`updateAuthor`) : `requireAdmin()` seul (`author.ts:80`). **PAS** de rate-limit ni audit log.
- ⚠️ Le profil Manon est l'unique identité éditoriale exposée sur tous les Articles. Modification non tracée = perte SEO-fingerprint si rollback nécessaire.

**Statut** : 🟠 — audit log P1-9 manquant sur un chokepoint visible.

---

### 2.16 Settings (13 sous-pages)

| Path                                   | Couverture sécurité                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/settings` (index)                    | lecture pure 🟢                                                                                |
| `/settings/audience-mix`               | writeContentGenConfig → indirect ✅ 🟢                                                         |
| `/settings/banned-phrases`             | writeContentGenConfig → indirect ✅ 🟢                                                         |
| `/settings/batches`                    | `updateBatchSettings` → writeContentGenConfig ✅ 🟢                                            |
| `/settings/coverage-distribution`      | writeContentGenConfig → indirect ✅ 🟢                                                         |
| `/settings/kb-ingest`                  | writeContentGenConfig → indirect ✅ 🟢                                                         |
| `/settings/kill-switch`                | `activate/deactivateKillSwitch` → writeContentGenConfig + `logActivity` ✅ 🟢                  |
| `/settings/llms-txt`                   | `updateLlmsTxt` → writeContentGenConfig ✅ 🟢                                                  |
| `/settings/policies`                   | `updatePolicies` → writeContentGenConfig ✅ 🟢                                                 |
| `/settings/providers`                  | `updateProvider`/`resetProviderSpend` → `requireAdmin()` seul ❌ ni rate-limit ni audit log 🔴 |
| `/settings/qa-policies`                | `updateQaPolicies` → writeContentGenConfig ✅ 🟢                                               |
| `/settings/quality-loop`               | `updateQualityLoop` → writeContentGenConfig ✅ 🟢                                              |
| `/settings/search-intent-distribution` | `updateSearchIntentDistribution` → writeContentGenConfig ✅ 🟢                                 |

**Diagnostic** : 12/13 settings sont sécurisés correctement via le chokepoint `writeContentGenConfig` (rate-limit 60/min/setting + SOC2 audit log diff). **Exception unique : `/settings/providers`** qui écrit directement dans `prisma.providerConfig.update` (ligne `providers.ts:68`) sans aucun audit. C'est paradoxal car cette page contrôle les clés API LLM (via `apiKeyEnvVar`) et les caps mensuels — donc le chokepoint financier le plus sensible.

---

## 3. Gaps critiques

### 3.1 🔴 P0 — `/settings/providers` : aucun audit log ni rate-limit

**Fichier** : `src/server/actions/content-gen/providers.ts:62-87`.

**Risque** : modification silencieuse du `monthlyCapUsd` (1000 USD → 100_000 USD = facture explose) ou toggle `enabled=false` sur tous les providers (génération bloquée sans trace). Aucune trace ContentGenAuditLog, aucun ActivityLog.

**Reco patch** :

```ts
// providers.ts:62
export async function updateProvider(input: UpdateProviderInput): Promise<void> {
  const session = await requireAdminWriteRateLimited(`updateProvider:${input.id}`);
  // ...
  const existing = await prisma.providerConfig.findUnique({ where: { id: input.id } });
  await prisma.providerConfig.update({
    /* ... */
  });
  await writeAuditLog({
    action: "updateProvider",
    settingKey: `provider:${input.id}`,
    oldValue: existing,
    newValue: input,
    actorUserId: session.userId,
    actorEmail: session.email,
  });
}
```

### 3.2 🟠 P1 — `/templates/[id]`, `/templates/new`, `/author/manon` : aucun audit log

Mêmes fichiers à patcher : `templates.ts:134-179` + `author.ts:79-105`. Templates = prompts LLM = chokepoint éditorial. AuthorManon = identité publique de tous les Articles. SOC2 absent.

### 3.3 🟠 P1 — Review queue + jobs : pas de SOC2 audit log

`review.ts` (6 writes) et `jobs.ts` (3 writes) utilisent `logActivity()` (ActivityLog table) — utile mais ce n'est PAS le ContentGenAuditLog SOC2 dédié (P1-9 livré commit `34e3c54`). Les deux doivent coexister :

- `ActivityLog` : trace métier admin générique (présent ✅)
- `ContentGenAuditLog` : trace SOC2 stricte avec diff oldValue→newValue (manquant ici)

### 3.4 🟠 P1 — Coverage, geo : rate-limit P1-30 absent

`coverage.ts` (createCampaign + pause/resume/cancel) et `geo.ts` (4 writes incluant batch enqueue) n'utilisent que `requireAdmin()`. Pas critique en usage normal (Will humain), mais bonne pratique A10 doctrine SOC2 + protection contre clics-frénétiques accidentels qui lancent N batches.

### 3.5 🟡 P2 — `/city-coverage` V1 = stub message « Activez V2 »

Asymétrie volontaire (cf. ADR 0028 implicite mentionné dans le code). V1 markup retiré pour éviter le drift. Acceptable mais nuit à la grep-ability : si Will désactive ADMIN_V2_ENABLED, il perd l'accès à cette page. Reco : soit affirmer V2-only (supprimer V1 entrypoint et router dans le V2 wrapper), soit livrer un V1 lisible.

### 3.6 🟡 P2 — `/orchestrator/new` annoncé dans le prompt mais inexistant

Le prompt liste `/orchestrator/new` dans l'inventaire. Glob ne retourne rien. Soit la page a été retirée silencieusement, soit le prompt anticipe une route future. Statut actuel : **inexistante**.

### 3.7 🟡 P2 — `/keyword-tracking` UI vide tant que cron pas câblé

Confirmation par lecture page.tsx : « Mode shadow V1 : table vide tant que cron sync GSC/SerpAPI pas câblé (Sprint 12.5 task #5) ». Risque : Will ouvre la page, voit 0 ligne, déduit un bug. Reco : afficher un banner explicite « Mode shadow — cron Sprint 12.5 pending ».

### 3.8 🟡 P2 — `/similarity-monitor` placeholder Sprint 4

Assumé dans le code (« V1 = squelette »). Aligné avec le master prompt § 25.5.

---

## 4. Note V1/V2 coexistence

### 4.1 Mécanisme

**ADR** : pas d'ADR formel sous `_AUDIT/ADR-V2-*.md` mais commentaire explicite dans `src/lib/feature-flags.ts:8-58` :

```
//   `ADMIN_V2_ENABLED=true`, sinon fallback `<PageV1 />`.
//   1. Cookie session `admin_v2=1` (override per-utilisateur — Will peut
//      activer en preview sans toucher la prod globale).
//   2. Env var `ADMIN_V2_ENABLED=true` (bascule globale prod).
```

Fonctions exposées :

- `isAdminV2Enabled()` async (lit `cookies()` Next 16 → priorité cookie sur env).
- `isAdminV2EnabledFromEnv()` sync (lit `process.env`).

### 4.2 Convention de routing

Chaque V1 `page.tsx` racine fait :

```tsx
if (await isAdminV2Enabled()) {
  return <XxxV2 adminPrefix={adminPrefix} {...autresProps} />;
}
// V1 markup historique inline ci-dessous
```

Le composant V2 vit dans `./_v2/XxxV2.tsx` (préfixe `_` = Next.js l'exclut du file-system routing, donc pas de route accidentelle).

### 4.3 Activation Will

**Mode preview personnel** : Will fixe le cookie `admin_v2=1` dans DevTools sur `app.axion-ia.com` (1 ligne) → toutes les pages content-gen rendent V2 pour sa session uniquement.

**Mode prod global** : env var Coolify `ADMIN_V2_ENABLED=true` → bascule tous les admins en V2 simultanément. Memoire 2026-05-17 confirme **`default false`** en prod (cf. memoire « 116 routes V2 derrière flag `ADMIN_V2_ENABLED` default false »).

### 4.4 Coût maintenance

Coexistence V1+V2 = ~47 paires de composants. Source de vérité dupliquée temporairement. Mémoire `axionia_admin_refonte_complete_2026-05-17.md` indique score pondéré 1753/2000 (87.7%) avec « 0 régression ». Plan implicite : V2 valide pendant N semaines puis V1 retiré (cf. closure PR 14).

### 4.5 Asymétrie unique : `/city-coverage`

Seule sous-page **V2-only effective** — V1 est volontairement un message d'invitation à activer V2. Cohérent avec la doctrine « pas de duplication de markup » pour les composants natifs V2 (cf. commentaire page.tsx:7 « Convention V2 only »).

---

## 5. Synthèse Will (TL;DR)

**Ce qui marche bien** :

- Parité V1/V2 sur 47 sous-pages (sauf `/city-coverage` V2-only volontaire).
- Auth uniforme via `auth()` + redirect login sur 100% des pages.
- Le chokepoint `writeContentGenConfig` (rate-limit + audit SOC2) couvre **12/13 settings** + landing-variants + onboarding + rss + kill-switch indirectement.
- Activation V2 via cookie = parfait pour preview sans risque prod.

**Ce qui nécessite un sprint correctif** :

1. **🔴 P0** — Patcher `providers.ts:updateProvider` + `resetProviderSpend` (chokepoint financier nu).
2. **🟠 P1** — Ajouter `writeAuditLog` SOC2 sur `templates.ts`, `author.ts`, `review.ts`, `jobs.ts`, `article.ts` (5 fichiers, ~15 fonctions).
3. **🟠 P1** — Ajouter `requireAdminWriteRateLimited` sur les writes `coverage.ts`, `geo.ts`, `review.ts:bulk*`, `jobs.ts:retryAllFailed` (protection contre frénésie clics + abus script).
4. **🟡 P2** — Banner « shadow mode » sur `/keyword-tracking`.
5. **🟡 P2** — Clarifier statut `/orchestrator/new` (existe ? planifié ? à retirer du prompt source).

**Effort estimé sprint correctif** : ~6-8h dev (patches mécaniques + tests).

---

## 6. Commandes de fact-check (UNKNOWN à confirmer)

```bash
# Coverage / geo : audit log + rate-limit coverage
grep -n "writeAuditLog\|requireAdminWriteRateLimited\|logActivity" \
  src/server/actions/content-gen/coverage.ts \
  src/server/actions/content-gen/geo.ts \
  src/server/actions/content-gen/article.ts

# Confirmer 0 occurrence sur providers + templates + author
grep -n "writeAuditLog\|logActivity" \
  src/server/actions/content-gen/providers.ts \
  src/server/actions/content-gen/templates.ts \
  src/server/actions/content-gen/author.ts

# Confirmer existence /orchestrator/new
find "src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator" -type d
```

---

> **Fin audit 09-ADMIN-UI-CONTENT-GEN** · 49 sous-pages auditées · 5 P0/P1 sécurité identifiés · 4 P2 UX/stub · effort correctif estimé ~6-8h.
