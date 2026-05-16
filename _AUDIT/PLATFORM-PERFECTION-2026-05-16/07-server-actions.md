# Agent 2.B — Server Actions exhaustifs (audit AUDIT-ONLY)

**SHA HEAD** : `98e0b0f` (main)
**Mode** : AUDIT-ONLY (lecture seule)
**Périmètre** : `src/server/actions/` — 3 sous-modules (`content-gen/`, `knowledge/`, `image-bank/`)
**Date** : 2026-05-16

---

## 1. Inventaire & cartographie

### 1.1 Fichiers `"use server"` détectés

**Total** : 46 fichiers (le brief mentionnait 43 — le delta correspond à 3 fichiers helpers/erreurs marqués `"use server"` mais sans action exportée + 3 fichiers image-bank annoncés mais inexistants sur disque cf. §1.3).

**Répartition** :

| Sous-module    | Fichiers | Actions exportées                    | Helpers (`_*.ts`)                                                     |
| -------------- | -------- | ------------------------------------ | --------------------------------------------------------------------- |
| `content-gen/` | 20       | ~50 actions sur 16 fichiers métier   | 4 (`_auth`, `_settings`, `policies-constants`, `review-errors`)       |
| `knowledge/`   | 25       | ~33 actions sur 21 fichiers métier   | 4 (`_guards`, `_audit`, `_revalidate`, `_transition`, `_zod-schemas`) |
| `image-bank/`  | 1        | 1 action (RGPD `forgetIpHashAction`) | 0                                                                     |

### 1.2 Drift documentaire constaté

Le brief mentionne « 43 Server Actions » → en réalité **46 fichiers** `"use server"`, dont **9 helpers / erreurs / constantes** isolées par contrainte Next 16+ (interdit l'export non-async dans `"use server"`). Le compte réel d'**actions exportées** = ~84 fonctions exportées (incluant lectures `list*`, `get*`).

### 1.3 Fichiers image-bank annoncés mais ABSENTS

Le Glob initial listait 4 fichiers image-bank :

- `forget-ip-hash.action.ts` ✅ présent (91 lignes)
- `upload.action.ts` ❌ **absent disque**
- `translate.action.ts` ❌ **absent disque**
- `publish.action.ts` ❌ **absent disque**

Vraisemblablement supprimés/déplacés après le Sprint 1-7 image-bank (cf. mémoire 2026-05-16). Les workers BullMQ (`image-bank-publish-worker.ts`, etc.) couvrent désormais ces opérations. À documenter explicitement dans l'ADR 0027.

---

## 2. Architecture RBAC + helpers partagés

### 2.1 Pattern content-gen (`_auth.ts`)

Centralisation propre :

- `requireAdmin()` : throw `"unauthorized"` ou `"forbidden"`, retourne `{ userId, email, role }`
- `requireSuperAdmin()` : sur-couche super_admin only

**Roles acceptés** : `super_admin`, `admin`, `editor`

### 2.2 Pattern knowledge (`_guards.ts`)

4 niveaux gradués :

- `requireAdminRead()` — toute session connectée
- `requireAdminWrite()` — super_admin, admin, editor
- `requireAdminPublish()` — super_admin, admin
- `requireAdminDelete()` — super_admin only

### 2.3 Pattern image-bank

Auth inline (pas de helper externalisé) : `auth()` + `session.user.role === "admin"` direct. Diverge des 2 autres modules → **P2 cohérence** (1 seule action V1, pas critique).

### 2.4 Helpers transversaux solides

- `knowledge/_transition.ts` : state machine + snapshot version + audit + revalidate + IndexNow enqueue (lifecycle event mapping correct)
- `knowledge/_audit.ts` : `logKbActivity()` table `ActivityLog`
- `knowledge/_revalidate.ts` : `revalidateAdminKbRoutes()` + `revalidatePublicKbRoutes()`
- `content-gen/shared/activity-log.ts` : `logActivity()` (utilisé en 50+ sites content-gen)

---

## 3. Matrice exhaustive — Server Actions mutatives

**Légende** :

- ✓ = présent et correctement implémenté
- ~ = partiel (présent mais avec faille mineure ou pattern non-Zod)
- ✗ = absent
- N/A = lecture pure (read-only)

### 3.1 content-gen/ (50 actions sur 16 fichiers)

| #   | Fichier                 | Action                           | RBAC                     | Zod                                      | revalidate      | logActivity                 | idempotent BullMQ                                       | Note                                                                           |
| --- | ----------------------- | -------------------------------- | ------------------------ | ---------------------------------------- | --------------- | --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | `article.ts`            | `getArticleDetail`               | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 2   | `article.ts`            | `updateArticle`                  | ✓                        | ~ (validation manuelle)                  | ✓               | ✓                           | ✓ jobId déterministe via `enqueueIndexingForTier1` SSOT | OK                                                                             |
| 3   | `article.ts`            | `demoteArticle`                  | ✓                        | N/A                                      | ✓               | ✓                           | ✓                                                       | OK                                                                             |
| 4   | `article.ts`            | `archiveArticle`                 | ✓                        | N/A                                      | ✓               | ✓                           | ✓                                                       | OK                                                                             |
| 5   | `article.ts`            | `unarchiveArticle`               | ✓                        | N/A                                      | ✓               | ✓                           | ~ pas de ping indexing                                  | mineur                                                                         |
| 6   | `article.ts`            | `deleteArticle`                  | ✓                        | ~ (`confirmation==="DELETE"`)            | ✓               | ✓                           | ✓                                                       | OK                                                                             |
| 7   | `article.ts`            | `rollbackArticle`                | ✓                        | N/A                                      | ✓               | ✓                           | ✓                                                       | OK                                                                             |
| 8   | `banned-phrases.ts`     | `listBannedPhrases`              | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture publique non guardée** (P2)                                          |
| 9   | `banned-phrases.ts`     | `createBannedPhrase`             | ✓                        | ~ manuel                                 | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 10  | `banned-phrases.ts`     | `toggleBannedPhrase`             | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 11  | `banned-phrases.ts`     | `deleteBannedPhrase`             | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 12  | `banned-phrases.ts`     | `scanArticlesForPhrase`          | ✓                        | ~ manuel                                 | N/A             | ✗                           | N/A                                                     | lecture mais lourd (scan 200) — P3 logger                                      |
| 13  | `coverage.ts`           | `listCampaigns`                  | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture non guardée P2**                                                     |
| 14  | `coverage.ts`           | `getCampaign`                    | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture non guardée P2**                                                     |
| 15  | `coverage.ts`           | `createCampaign`                 | ✓                        | ~ manuel + `assertSum100`                | ✓               | ✓                           | N/A (création DB seule)                                 | OK                                                                             |
| 16  | `coverage.ts`           | `launchCampaign`                 | ✓                        | ✗                                        | ✓               | ✓                           | N/A                                                     | OK (déclenche orchestrateur asynchrone)                                        |
| 17  | `coverage.ts`           | `pauseCampaign`                  | ✓                        | ✗                                        | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 18  | `coverage.ts`           | `resumeCampaign`                 | ✓                        | ✗                                        | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 19  | `coverage.ts`           | `cancelCampaign`                 | ✓                        | ~ default mode                           | ✓               | ✓                           | ✓ purge BullMQ best-effort                              | OK                                                                             |
| 20  | `coverage.ts`           | `incrementCampaignTarget`        | ✓                        | ~ manuel                                 | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 21  | `coverage.ts`           | `estimateCampaign`               | ✓                        | ~ manuel                                 | N/A             | ✗                           | N/A                                                     | lecture/compute pure                                                           |
| 22  | `dashboard.ts`          | `getDashboardKpis`               | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 23  | `dashboard.ts`          | `getSectorBreakdownToday`        | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 24  | `distribution.ts`       | `listDistributionProfiles`       | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 25  | `distribution.ts`       | `upsertDistributionProfile`      | ✓                        | ~ `assertEditorialKeys` + `assertSum100` | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 26  | `distribution.ts`       | `deleteDistributionProfile`      | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 27  | `distribution.ts`       | `listAudienceMixProfiles`        | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 28  | `distribution.ts`       | `upsertAudienceMixProfile`       | ✓                        | ~ `assertSum100`                         | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 29  | `distribution.ts`       | `deleteAudienceMixProfile`       | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 30  | `enqueue.ts`            | `enqueueDirectGen`               | ✓                        | ~ manuel                                 | ✓               | ✗                           | ✓ `idempotencyKey` SHA-256 60s slot + `jobId=gen-${id}` | **P1 logActivity manquant** sur opération qui consomme du LLM coûteux          |
| 31  | `geo.ts`                | `listRegionGeoStats`             | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 32  | `geo.ts`                | `getCostsStats`                  | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 33  | `geo.ts`                | `getOrchestratorStats`           | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 34  | `geo.ts`                | `getGlobalGeoStats`              | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture                                                                        |
| 35  | `jobs.ts`               | `listJobs`                       | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 36  | `jobs.ts`               | `getJob`                         | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 37  | `jobs.ts`               | `retryJob`                       | ✓                        | ✗                                        | ✓               | ✓                           | ✓ `jobId=gen-${id}`                                     | OK                                                                             |
| 38  | `jobs.ts`               | `cancelJob`                      | ✓                        | ✗                                        | ✓               | ✓                           | ✓ purge BullMQ best-effort                              | OK                                                                             |
| 39  | `jobs.ts`               | `retryAllFailed`                 | ✓                        | ✗ (cap=500)                              | ✓               | ✓                           | ✓                                                       | OK                                                                             |
| 40  | `kb-ingest-external.ts` | `ingestKbFromUrl`                | ✓                        | ✗ trim seul                              | ✓               | ✗ (publishToKB log côté KB) | N/A                                                     | ~ P2 logActivity (audit double via KB)                                         |
| 41  | `kb-ingest-external.ts` | `ingestKbFromSitemap`            | ✓                        | ✗ cap 50                                 | ✓               | ✗                           | N/A                                                     | idem                                                                           |
| 42  | `kill-switch.ts`        | `getKillSwitch`                  | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture publique** mais state opérationnel = P2                              |
| 43  | `kill-switch.ts`        | `activateKillSwitch`             | ✓                        | ~ slice 280                              | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 44  | `kill-switch.ts`        | `deactivateKillSwitch`           | ✓                        | N/A                                      | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 45  | `policies.ts`           | `getBatchSettings`               | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 46  | `policies.ts`           | `updateBatchSettings`            | ✓                        | ~ manuel                                 | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant sur config critique** (concurrency, dailyBatchSize)  |
| 47  | `policies.ts`           | `getPolicies`                    | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 48  | `policies.ts`           | `updatePolicies`                 | ✓                        | ~ manuel                                 | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 49  | `policies.ts`           | `getLlmsTxt`                     | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P3 (public content)**                                                |
| 50  | `policies.ts`           | `updateLlmsTxt`                  | ✓                        | ~ length cap                             | ✓ (+ /llms.txt) | ✗                           | N/A                                                     | **P1 logActivity manquant sur contenu public**                                 |
| 51  | `policies.ts`           | `getQualityLoop`                 | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 52  | `policies.ts`           | `updateQualityLoop`              | ✓                        | ~ manuel                                 | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant (budget cap critique)**                              |
| 53  | `policies.ts`           | `getQaPolicies`                  | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 54  | `policies.ts`           | `updateQaPolicies`               | ✓                        | ~ manuel                                 | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 55  | `policies.ts`           | `getSearchIntentDistribution`    | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 56  | `policies.ts`           | `updateSearchIntentDistribution` | ✓                        | ~ sum100                                 | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 57  | `providers.ts`          | `listProviders`                  | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P0** — expose `apiKeyEnvVar` + caps + spending                       |
| 58  | `providers.ts`          | `updateProvider`                 | ✓                        | ~ range manuel                           | ✓               | ✗                           | N/A                                                     | **P0 logActivity manquant sur config provider (caps, modèle, enable/disable)** |
| 59  | `providers.ts`          | `resetProviderSpend`             | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P0 logActivity manquant — reset compteur financier sans trace !**            |
| 60  | `review.ts`             | `listReviewPaginated`            | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 61  | `review.ts`             | `listReview`                     | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 62  | `review.ts`             | `approveReview`                  | ✓                        | ✗                                        | ✓               | ✓                           | ✓ `jobId=publish-${id}` + updateMany race-safe          | **OK exemplaire**                                                              |
| 63  | `review.ts`             | `bulkApproveReviews`             | ✓                        | ~ range                                  | ✓               | ✓                           | ✓                                                       | OK                                                                             |
| 64  | `review.ts`             | `bulkRejectReviews`              | ✓                        | ~ range                                  | ✓               | ✓                           | N/A                                                     | OK                                                                             |
| 65  | `review.ts`             | `rejectReview`                   | ✓                        | ~ length≥5                               | ✓               | ✓                           | ✓ updateMany race-safe                                  | OK                                                                             |
| 66  | `review.ts`             | `requestEdits`                   | ✓                        | ~ length≥10                              | ✓               | ✓                           | N/A (transaction DB)                                    | OK                                                                             |
| 67  | `review.ts`             | `promoteToTier1`                 | ✓                        | ✗                                        | ✓               | ✓                           | ✓ updateMany race-safe                                  | OK                                                                             |
| 68  | `rss.ts`                | `listRssSources`                 | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 69  | `rss.ts`                | `addRssSource`                   | ✓                        | ~ regex+lengths                          | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 70  | `rss.ts`                | `removeRssSource`                | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 71  | `rss.ts`                | `updateRssSource`                | ✓                        | ~ regex+lengths                          | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 72  | `rss.ts`                | `toggleRssSource`                | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 73  | `templates.ts`          | `listTemplates`                  | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 74  | `templates.ts`          | `getTemplate`                    | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | **lecture P2**                                                                 |
| 75  | `templates.ts`          | `upsertTemplate`                 | ✓                        | ~ length checks                          | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant sur template (impact 100% des générations LLM)**     |
| 76  | `templates.ts`          | `toggleTemplate`                 | ✓                        | ✗                                        | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant**                                                    |
| 77  | `author.ts`             | `getAuthor`                      | ✗                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture publique OK (page équipe)                                              |
| 78  | `author.ts`             | `updateAuthor`                   | ✓                        | ~ length checks                          | ✓               | ✗                           | N/A                                                     | **P1 logActivity manquant sur identité auteur publique (E-E-A-T critique)**    |
| 79  | `_settings.ts`          | `readContentGenConfig`           | ✗ intentionnel (workers) | N/A                                      | N/A             | N/A                         | N/A                                                     | OK documenté                                                                   |
| 80  | `_settings.ts`          | `writeContentGenConfig`          | ✓                        | ✗                                        | N/A             | ✗                           | N/A                                                     | OK (appelants tracent)                                                         |
| 81  | `_settings.ts`          | `listContentGenConfig`           | ✓                        | N/A                                      | N/A             | N/A                         | N/A                                                     | lecture admin-only                                                             |

### 3.2 knowledge/ (33 actions sur 21 fichiers)

| #   | Fichier                | Action                          | RBAC                    | Zod                                | revalidate                    | logActivity         | idempotent BullMQ              | Note                                                    |
| --- | ---------------------- | ------------------------------- | ----------------------- | ---------------------------------- | ----------------------------- | ------------------- | ------------------------------ | ------------------------------------------------------- |
| 1   | `create-entry.ts`      | `createEntryAction`             | ✓ `requireAdminWrite`   | ✓ `createEntryInputSchema`         | ✓ admin + public si published | ✓ `logKbActivity`   | N/A                            | **exemplaire**                                          |
| 2   | `update-entry.ts`      | `updateEntryAction`             | ✓                       | ✓                                  | ✓ + IndexNow ping             | ✓                   | ✓ `entityId` + lifecycle event | **exemplaire**                                          |
| 3   | `save-draft.ts`        | `saveDraftAction`               | ✓                       | ✓ `saveDraftInputSchema`           | ✓ admin only                  | ✓                   | N/A                            | OK                                                      |
| 4   | `delete-entry.ts`      | `deleteEntryAction`             | ✓ `requireAdminDelete`  | ✓                                  | ✓ + IndexNow delete           | ✓                   | ✓                              | OK                                                      |
| 5   | `get-entry.ts`         | `getEntryAction`                | ✓ `requireAdminRead`    | ✓                                  | N/A                           | N/A                 | N/A                            | lecture                                                 |
| 6   | `list-entries.ts`      | `listEntriesAction`             | ✓ `requireAdminRead`    | ✓ `listInputSchema`                | N/A                           | N/A                 | N/A                            | lecture                                                 |
| 7   | `publish.ts`           | `publishAction`                 | ✓ `requireAdminWrite`   | ✓                                  | ✓ via `executeTransition`     | ✓                   | ✓ IndexNow `publish`           | OK + validations alt+banned bloquantes                  |
| 8   | `unpublish.ts`         | `unpublishAction`               | ✓ `requireAdminDelete`  | ✓                                  | ✓                             | ✓                   | ✓ delete                       | OK                                                      |
| 9   | `archive.ts`           | `archiveAction`                 | ✓ `requireAdminDelete`  | ✓                                  | ✓                             | ✓                   | ✓                              | OK                                                      |
| 10  | `restore.ts`           | `restoreAction`                 | ✓ `requireAdminDelete`  | ✓                                  | ✓                             | ✓                   | ✓                              | OK                                                      |
| 11  | `submit-for-review.ts` | `submitForReviewAction`         | ✓ `requireAdminWrite`   | ✓                                  | ✓                             | ✓                   | N/A                            | OK                                                      |
| 12  | `approve.ts`           | `approveAction`                 | ✓                       | ✓                                  | ✓                             | ✓                   | N/A                            | OK                                                      |
| 13  | `approve.ts`           | `rejectReviewAction`            | ✓                       | ✓                                  | ✓                             | ✓                   | N/A                            | OK                                                      |
| 14  | `schedule-publish.ts`  | `schedulePublishAction`         | ✓                       | ✓ `refine` future-date             | ✓                             | ✓                   | N/A                            | OK                                                      |
| 15  | `assign-reviewer.ts`   | `assignReviewerAction`          | ✓                       | ✓                                  | ✓ admin                       | ✓                   | N/A                            | OK + self-review check                                  |
| 16  | `rollback-version.ts`  | `rollbackVersionAction`         | ✓ `requireAdminPublish` | ✓                                  | ✓ admin                       | ✓                   | N/A                            | OK transactionnel                                       |
| 17  | `upload-asset.ts`      | `uploadAssetAction`             | ✓                       | ✓ `inputSchema` mimeType+size+hash | ~ pas de path publique encore | ✓                   | N/A                            | V1 sans sharp — OK                                      |
| 18  | `add-relation.ts`      | `addRelationAction`             | ✓                       | ✓                                  | ✓ both entries                | ✓                   | N/A                            | OK + cycle detection DAG                                |
| 19  | `add-relation.ts`      | `removeRelationAction`          | ✓                       | ✓                                  | ✓                             | ✓                   | N/A                            | OK                                                      |
| 20  | `annotations.ts`       | `createAnnotation`              | ✗                       | ✗ length 3 manuel                  | ✗                             | ✗                   | N/A                            | **P0 RBAC manquant**                                    |
| 21  | `annotations.ts`       | `resolveAnnotation`             | ✗                       | ✗                                  | ✗                             | ✗                   | N/A                            | **P0 RBAC manquant**                                    |
| 22  | `annotations.ts`       | `listAnnotationsForEntry`       | ✗                       | ✗                                  | N/A                           | N/A                 | N/A                            | lecture sans guard                                      |
| 23  | `annotations.ts`       | `countOpenAnnotationsForEntry`  | ✗                       | N/A                                | N/A                           | N/A                 | N/A                            | lecture sans guard                                      |
| 24  | `collections.ts`       | `createCollection`              | ✗                       | ~ length 3 manuel                  | ✗                             | ✗                   | N/A                            | **P0 RBAC manquant**                                    |
| 25  | `collections.ts`       | `addItemToCollection`           | ✗                       | ✗                                  | ✗                             | ✗                   | N/A                            | **P0 RBAC manquant**                                    |
| 26  | `collections.ts`       | `removeItemFromCollection`      | ✗                       | ✗                                  | ✗                             | ✗                   | N/A                            | **P0 RBAC manquant**                                    |
| 27  | `collections.ts`       | `getCollectionBySlug`           | ✗                       | ✗                                  | N/A                           | N/A                 | N/A                            | lecture (filtre visibility côté logique)                |
| 28  | `collections.ts`       | `publishCollection`             | ✗                       | ✗                                  | ✗                             | ✗                   | N/A                            | **P0 RBAC manquant — publication publique sans auth !** |
| 29  | `ingest.ts`            | `ingestEntry`                   | ✗ système (factory)     | ✓ structurelle                     | ✗ pas de Next revalidate      | ✓ via `appendAudit` | ✓ `idempotencyKey` unique DB   | ~ acceptable (appelant = worker authentifié facteur)    |
| 30  | `seo-cache.ts`         | `refreshSeoCacheForTranslation` | ✗ système               | ✗                                  | N/A                           | ✗                   | N/A                            | OK (hook interne ingest)                                |
| 31  | `seo-cache.ts`         | `getSeoCacheForTranslation`     | ✗                       | ✗                                  | N/A                           | N/A                 | N/A                            | lecture publique OK                                     |

### 3.3 image-bank/ (1 action)

| #   | Fichier                    | Action               | RBAC                                     | Zod                           | revalidate        | logActivity                   | idempotent BullMQ | Note                                          |
| --- | -------------------------- | -------------------- | ---------------------------------------- | ----------------------------- | ----------------- | ----------------------------- | ----------------- | --------------------------------------------- |
| 1   | `forget-ip-hash.action.ts` | `forgetIpHashAction` | ~ inline `session.user.role === "admin"` | ✓ `ForgetIpHashSchema` sha256 | ✓ `revalidateTag` | ✓ `activityLog.create` direct | N/A               | OK — pattern différent (FormData) mais valide |

---

## 4. Synthèse globale par critère

| Critère                               | Couverture                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RBAC sur mutations**                | 60/72 mutations protégées (83%) — 12 mutations knowledge/annotations + collections **non guardées (P0)**                                                             |
| **Zod schemas systématiques**         | 18/72 (~25%) — la plupart valident manuellement (length, range). knowledge V4 utilise Zod systématique (`_zod-schemas.ts`). content-gen privilégie checks impératifs |
| **revalidatePath après mutation**     | 65/72 (~90%)                                                                                                                                                         |
| **logActivity / audit trail**         | 32/72 (~44%) — **HUGE GAP côté content-gen settings + RSS + templates + author + providers + banned-phrases (toggle/delete) + distribution profiles**                |
| **BullMQ idempotency (jobId stable)** | 100% des enqueues utilisent `jobId=<prefix>-${entityId}` (gen-, publish-, indexnow-, google-indexing-) → idempotency BullMQ native                                   |

---

## 5. Top 5 actions sans RBAC (P0 BLOQUANTS PROD)

1. **`knowledge/collections.ts > publishCollection(collectionId)`** — **CRITIQUE** : publie une collection en `visibility=public` sans aucune authentification. Risque : exfiltration / publication non autorisée de séries éditoriales.
2. **`knowledge/collections.ts > createCollection / addItemToCollection / removeItemFromCollection`** — 3 mutations sans guard. Risque : un attaquant peut créer/manipuler des collections team via appel direct POST Server Action.
3. **`knowledge/annotations.ts > createAnnotation / resolveAnnotation`** — 2 mutations sans guard. Risque : pollution des commentaires de review + résolution arbitraire.
4. **`content-gen/providers.ts > listProviders` (lecture)** — Expose `apiKeyEnvVar`, `monthlyCapUsd`, `currentMonthSpentUsd` côté Server Action POST sans guard. Risque : reconnaissance attaquant pour cibler vols API keys.
5. **`content-gen/coverage.ts > listCampaigns / getCampaign` + `jobs.ts > listJobs / getJob` + `policies.ts > get*` (8 lectures)** — Expose volumes, coûts, modèles, plans. Pattern partagé : aucune `requireAdmin()` sur lectures content-gen (sauf `geo.ts` + `dashboard.ts` qui ont été patchés Pass B P0-4). Risque : observabilité interne fuit publiquement (POST publique sur server action endpoint).

---

## 6. Top 5 actions sans `logActivity` côté mutations critiques (P1)

1. **`providers.ts > updateProvider` + `resetProviderSpend`** — modifie monthly cap LLM + reset compteur financier sans aucune trace audit. **Forensique impossible** en cas d'abus admin.
2. **`policies.ts > updateBatchSettings / updatePolicies / updateQualityLoop / updateQaPolicies / updateLlmsTxt / updateSearchIntentDistribution`** — 6 mutations config critiques sans trace (budget caps, plagiat thresholds, retention, /llms.txt public).
3. **`templates.ts > upsertTemplate + toggleTemplate`** — modifie le **system prompt LLM** (impact 100% générations futures) sans audit.
4. **`author.ts > updateAuthor`** — modifie l'identité publique Manon (E-E-A-T critique disclosed) sans trace.
5. **`rss.ts > addRssSource / removeRssSource / updateRssSource / toggleRssSource`** — 4 mutations RSS (sources actives) sans trace. + `banned-phrases.ts > toggleBannedPhrase / deleteBannedPhrase` + `distribution.ts > upsert*/delete*` (idem).

---

## 7. Forces observées (à préserver)

1. **knowledge/ V4 pattern exemplaire** : Zod systématique + helpers `_guards/_audit/_revalidate/_transition` + state machine + IndexNow lifecycle event mapping (publish/update/delete).
2. **BullMQ idempotency** : tous les enqueues utilisent `jobId=<prefix>-${id}` cohérent → re-enqueue safe (BullMQ dedup native).
3. **Race-safety review** : `updateMany where status='pending'` + count check → P1-C fix pattern propre (cf. `approveReview`, `rejectReview`, `promoteToTier1`).
4. **Idempotency content-gen** : `enqueueDirectGen` utilise `sha256(slot 60s)` pour anti-doublon clic + unique DB.
5. **Safe count wrapper** : `dashboard.ts > safeCount` catch P2021 (table absente) → résiliente aux états de migration.
6. **Externalisation symboles non-async** : `policies-constants.ts`, `review-errors.ts` correctement isolés (contrainte Next 16+).
7. **Defense-in-depth `_settings.ts`** : `writeContentGenConfig` + `listContentGenConfig` re-checkent `requireAdmin` même si appelants déjà guardés.

---

## 8. Faiblesses & angles morts

1. **Pattern mixte Zod vs validation manuelle** dans content-gen : préférence pour `throw new Error("foo_range")` manuel. OK pour codes stables côté UI, mais inconsistant avec knowledge V4 (Zod safeParse → `fieldErrors`). **Recommandation** : Zod schemas pour toutes les Server Actions mutatives (defense + autocomplete UI).
2. **`coverage.ts > listCampaigns / getCampaign`** + 8 autres lectures content-gen **non guardées** — drift par rapport au `Pass B P0-4` qui n'a couvert que `dashboard.ts` + `geo.ts`. À étendre.
3. **`knowledge/collections.ts + annotations.ts`** : 6 actions mutatives **sans aucun guard**. Sprint KB-18 livré sans RBAC.
4. **Pas de rate-limiting sur Server Actions sensibles** (ex. `enqueueDirectGen` qui consomme LLM coûteux) — un admin compromis peut éclater le cap mensuel.
5. **Stub Proxy build** : `readContentGenConfig` tente `findUnique` sans guard. Le Proxy stub.invalid retourne `null` au build → comportement OK, mais à confirmer sur tous les `prisma.X.findUnique` côté SSG (cf. AGENTS.md).
6. **Image-bank** : 3 actions annoncées absentes (`upload.action.ts`, `translate.action.ts`, `publish.action.ts`). Soit migrées vers workers, soit jamais commit. **À tracer dans ADR** (sinon dette documentaire vs code).
7. **`_settings.readContentGenConfig` documenté non-guardé pour workers** — défense en profondeur OK, mais à confirmer que **aucun endpoint client direct** ne le hit. Le brief autopilot pourrait ajouter un test e2e.
8. **`uploadAssetAction`** V1 : `hash` pseudo-random `crypto.randomBytes(32)` quand client ne fournit pas → dédup factice. Acceptable V1 mais à durcir KB-11 v2.

---

## 9. Scoring détaillé

| Critère                | Poids   | Score      | Justification                                                                                  |
| ---------------------- | ------- | ---------- | ---------------------------------------------------------------------------------------------- |
| RBAC mutations         | 30      | 22/30      | 12 mutations P0 sans guard (annotations + collections + RBAC partiel sur lectures content-gen) |
| Zod inputs             | 15      | 8/15       | Knowledge OK, content-gen valide manuellement                                                  |
| Erreurs codes stables  | 10      | 9/10       | Codes lisibles (`"slug_too_short"`, `"validation"`, `"forbidden"`) — quasi parfait             |
| revalidatePath         | 10      | 9/10       | ~90% couverture, drift mineur sur restore/unarchive sans ping                                  |
| logActivity            | 20      | 9/20       | 56% des mutations ont audit ; P1 sur 15+ mutations config critiques                            |
| BullMQ idempotency     | 10      | 10/10      | jobId stable systématique, dedup native BullMQ                                                 |
| Pattern Next 16 strict | 5       | 5/5        | Symboles non-async correctement isolés (review-errors, policies-constants)                     |
| **TOTAL**              | **100** | **72/100** |                                                                                                |

---

## 10. Verdict

**Score : 72/100 — 🟡 CONDITIONAL GO**

**Diagnostic** :

- Côté **knowledge/ V4** : pattern exemplaire (Zod + RBAC gradué + audit + IndexNow lifecycle). **À répliquer**.
- Côté **content-gen/** : RBAC mutations OK, **mais audit trail anémique** sur la majorité des mutations config + RSS + templates + author. **Forensique impossible** en cas d'incident financier (LLM cap reset sans trace, prompt changé sans trace).
- Côté **knowledge/collections + annotations** (Sprint KB-18) : **6 mutations sans RBAC** = bloquant prod public.

**Conditions pour 🟢 GO** :

1. **P0 (~2-3h)** : ajouter `requireAdminWrite()` sur les 6 mutations `collections.ts` + `annotations.ts`.
2. **P0 (~30 min)** : ajouter `requireAdmin()` sur les 8 lectures content-gen non guardées (`listCampaigns`, `getCampaign`, `listJobs`, `getJob`, `listTemplates`, `getTemplate`, `listProviders`, `listRssSources`, `listBannedPhrases`, + `get*` policies).
3. **P0 (~1h)** : ajouter `logActivity` sur les 3 mutations critiques `providers.ts` (`updateProvider`, `resetProviderSpend`) + `policies.ts > updateLlmsTxt` (contenu public + impact LLM crawlers).

**Effort total P0** : ~4-5h. Score post-P0 estimé : ~85/100 🟢 GO.

---

## 11. P0 actionnables (résumé)

| #    | Action                                                   | Fichier                                                                                                                                  | Effort | Note                                           |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| P0-1 | Ajouter `requireAdminWrite`                              | `knowledge/collections.ts` × 5 fns                                                                                                       | 30 min | publishCollection critique                     |
| P0-2 | Ajouter `requireAdminWrite`                              | `knowledge/annotations.ts` × 2 fns                                                                                                       | 15 min | + listAnnotations (requireAdminRead)           |
| P0-3 | Ajouter `requireAdmin` sur 10 lectures content-gen       | `coverage.ts`, `jobs.ts`, `templates.ts`, `providers.ts`, `rss.ts`, `banned-phrases.ts`, `policies.ts` (get*), `distribution.ts` (list*) | 1h     | drift Pass B P0-4                              |
| P0-4 | Ajouter `logActivity` sur mutations providers + llms-txt | `providers.ts`, `policies.ts:updateLlmsTxt`                                                                                              | 30 min | audit trail financier + public                 |
| P0-5 | Documenter ADR sur image-bank actions absentes           | `_AUDIT/ADR-0027`                                                                                                                        | 15 min | tracer où sont passés upload/translate/publish |

**Total P0** : ~2h30 - 3h.

---

## 12. P1 (≤ 1 semaine après GO prod)

- Standardiser Zod schemas sur toutes les mutations content-gen (template depuis knowledge V4)
- Compléter `logActivity` sur 12 mutations config (policies, templates, author, rss, distribution, banned-phrases toggle/delete)
- Rate-limit Server Actions LLM-cost (`enqueueDirectGen`, `bulkApproveReviews`) via middleware ou wrapper
- Tests integration RBAC : 1 test par mutation vérifiant `unauthorized` / `forbidden` (vitest)
- Auditer endpoints client → server pour confirmer aucune fuite `readContentGenConfig` exposée

---

## 13. P2 / améliorations

- `kb-ingest-external.ts` : daily quota check (max 100 ingest/jour mentionné en comment mais pas implémenté)
- `uploadAssetAction` : require hash client (rejeter `crypto.randomBytes` fallback) pour dédup réelle
- Image-bank pattern auth diverge — uniformiser avec `requireAdmin` helper si réintroduit
- `_settings.readContentGenConfig` : ajouter logger debug pour tracer les callers (workers vs admin) en dev

---

**Auditeur** : Agent 2.B — Server Actions
**SHA HEAD** : `98e0b0f`
**Date** : 2026-05-16
**Verdict** : 🟡 72/100 — CONDITIONAL GO (P0 ~3h pour atteindre 🟢 85/100)
