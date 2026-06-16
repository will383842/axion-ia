# Audit fonctionnel content-gen — synthèse UX (Phase 0+1)

> Date : 2026-06-16 · Périmètre : back-office `content-gen` (admin) · Méthode : audit par zone + verdict adversarial croisé (2 agents/zone) · Build : `stub.invalid` (pages DB-dependent rendues vides au build = comportement attendu, **jamais** compté comme bug).

## 0. Compteurs

| Métrique | Valeur |
|---|---|
| Routes auditées (total) | **65** |
| OK (câblées + navigables + tiennent leur promesse) | **38** |
| WARN (câblées mais défaut UX / orpheline / promesse partielle) | **24** |
| BROKEN (lien mort / promesse non tenue bloquante) | **3** |

Détail BROKEN : `brand-voice-drift` (lien mort `/recalibrate` 404), `geo/[villeSlug]/generate` (route « generate » qui ne génère rien + commande CLI exposée), `settings/kb-ingest` (orpheline totale + zéro feedback). Note : `templates/[id]` a été requalifié **broken** par le verdict adversarial (2 défauts manqués par le 1er agent : test ignore `templateId` + enum `commercial_investigation` fait throw) — le compteur retient les 3 « broken structurels » mais ce 4e cas est traité comme défaut critique au §2.

---

## 1. Matrice nav ↔ route ↔ action ↔ worker ↔ table

Légende statut : ✅ OK · ⚠️ WARN · ⛔ BROKEN · 🕳️ orpheline (hors sidebar SSOT `admin-nav.ts`)

| Route | Sidebar | Server Action (lecture / mutation) | Worker / Queue BullMQ | Table Prisma | Statut |
|---|---|---|---|---|---|
| `/content-gen` (dashboard) | ✅ | `getDashboardKpis`, `getSectorBreakdownToday`, `getCityCoverageProgress`, `getOrchestratorStats` / `enqueueDirectGen` | `content-gen-worker` (queue `content-gen`) | ContentGenJob, ReviewQueue, CostLedger, GenerationLog, KnowledgeEntry, CoverageCampaign | ⚠️ |
| `/content-gen/onboarding` | 🕳️ | `read/writeContentGenConfig` (clé `onboarded`) | — | ContentGenConfig, ProviderConfig, AuthorProfile, CoverageDistributionProfile | ⚠️ |
| `/campaigns/new` (wizard) | ✅ | `createCampaignFromWizard` | `content-orchestrator-worker` | CoverageCampaign | ⚠️ |
| `/coverage` (liste) | ✅ | `listCampaigns` / `launch/pause/resumeCampaign` | `content-orchestrator-worker` | CoverageCampaign | ⚠️ |
| `/coverage/[id]` | 🕳️ (détail) | `getCampaign` / `launch/pause/resume/cancelCampaign`, `incrementCampaignTarget` | purge BullMQ | CoverageCampaign | ✅ |
| `/coverage/new` (stub 308) | 🕳️ | `permanentRedirect` → `/campaigns/new` (drop query) | — | — | ⚠️ |
| `/coverage/presets` | 🕳️ | `campaignTemplate.findMany` (+ fallback statique) | — | CampaignTemplate | ⛔ (flux preset cassé) |
| `/orchestrator` | 🕳️ | `getOrchestratorStats`, `getBatchSettings` | — | CoverageCampaign, ContentGenJob | ⚠️ |
| `/orchestrator/adhoc` | ✅ | `dispatchAdHocJob` | `content-gen-worker` (queue `content-gen`) | ContentGenJob | ⚠️ |
| `/jobs` (liste) | ✅ | `listJobs` / `retryAllFailed` (re-enqueue) | `content-gen-worker` | ContentGenJob | ⚠️ |
| `/jobs/[id]` | 🕳️ (détail) | `getJob` / `retryJob`, `cancelJob` ; SSE `/api/content-gen/jobs/[id]/stream` | `content-gen-worker` | ContentGenJob, ContentGenJobLog | ✅ |
| `/queue` | 🕳️ | `listJobs` / `retryAllFailed` (**Prisma, pas Redis**) | — | ContentGenJob | ⚠️ |
| `/review-queue` | ✅ | `listReviewPaginated` / `approve/rejectReview` | `content-publish-worker` (queue `content-publish`) | ReviewQueue, ContentGenJob, Article | ⚠️ |
| `/review-queue/[id]` | 🕳️ (détail) | `approve/rejectReview`, `promoteToTier1`, `requestEdits` / `articleFeedback` | `content-publish-worker` ; iframe `/api/content-gen/preview/[jobId]` | ReviewQueue, ArticleFeedback | ⚠️ |
| `/publications` | ✅ | `article.count/findMany` / `demote/archive/unarchive/rollbackArticle` ; export `/api/content-gen/export?type=articles` | — | Article, ArticleTranslation | ⚠️ |
| `/publications/[id]/edit` | 🕳️ (détail) | `getArticleDetail` / `updateArticle`, `deleteArticle` (revalidate + IndexNow) | — | Article, ArticleTranslation | ✅ |
| `/publications-status` (kanban) | 🕳️ | `contentGenJob.findMany`, `reviewQueue.findMany` / `bulkApprove/RejectReviews`, `retryAllFailed` ; export `?type=jobs` | — | ContentGenJob, ReviewQueue | ⚠️ |
| `/rss` (liste) | ✅ | `listRssSourcesFromDb` / `toggle/removeRssSourceFromDb` | `content-rss-fetch-worker` (queue `content-rss-fetch`, cron 1h) | rss_sources | ⚠️ |
| `/rss/new` | 🕳️ | `addRssSourceToDb` | `content-rss-fetch-worker` | rss_sources | ⚠️ |
| `/rss/[id]` | 🕳️ | `getRssSourceByIdFromDb` / `removeRssSourceFromDb` (**`updateRssSourceInDb` = code mort**) | — | rss_sources | ⛔ (read-only sous lien « Éditer ») |
| `/rss/import` | 🕳️ | `bulkAddRssSourcesToDb` | — | rss_sources | ✅ |
| `/templates` (liste) | ✅ | `listTemplates` / `toggleTemplate` | — | ContentTemplate | ⚠️ |
| `/templates/new` | 🕳️ | `upsertTemplate` | — | ContentTemplate | ⚠️ |
| `/templates/[id]` | 🕳️ | `getTemplate`, `upsertTemplate` / `testTemplate`→`enqueueDirectGen` | `content-gen-worker` | ContentTemplate, ContentGenJob | ⛔ (test ignore templateId + enum throw) |
| `/keyword-tracking` | ✅ | `keywordTracking.findMany` | `content-keyword-sync-worker` (queue `content-keyword-sync`, cron `0 4 * * 1`, fetch GSC) | KeywordTracking | ⚠️ |
| `/keyword-strategy` | 🕳️ | static `ALL_KEYWORD_SEEDS` (in-memory, 0 DB) | — | — | ⚠️ (+ code mort `KeywordStrategyView.tsx`) |
| `/cities-coverage` | 🕳️ | `getCitiesStats`, `listCities` (**`markCitiesPriority` = action fantôme non câblée**) | — | City | ⚠️ |
| `/cities-order` | ✅ | `getCityGenerationOrder` / `reorderCities`, `pinCity` | (mode global_queue) | CityGenerationOrder | ✅ |
| `/city-coverage` | ✅ | `getCityCoverage` (lecture fichiers TS, 0 DB) | — | — | ⚠️ |
| `/city-equity` | ✅ | `getCityContentEquityMatrix`, `getContentTypeEquitySummary` | — | ContentGenJob | ⚠️ |
| `/coverage-map` | ✅ | `getCoverageMapData` | — | ContentGenJob, City | ⚠️ |
| `/geo` (cockpit) | 🕳️ | `getGlobalGeoStats`, `listRegionGeoStats` | — | ContentGenJob | ⚠️ |
| `/geo/batches` | 🕳️ | `coverageCampaign.findMany` (inline) | — | CoverageCampaign | ⚠️ |
| `/geo/batches/new` | 🕳️ | static (renvoi vers `/coverage/new`) | — | — | ⚠️ (stub trompeur) |
| `/geo/batches/[id]` | 🕳️ | static (redirect → `/coverage/[id]`) | — | — | ⚠️ (page fantôme) |
| `/geo/history` | 🕳️ | `coverageCampaign.findMany` (commentaire périmé) | — | CoverageCampaign | ⚠️ |
| `/geo/coverage-table` | 🕳️ | `getJobsVilleSectorDetail` ; export CSV | — | ContentGenJob | ⚠️ |
| `/geo/[villeSlug]/generate` | 🕳️ | `contentGenJob.findMany` (lecture seule, **0 enqueue**) | — | ContentGenJob | ⛔ |
| `/kb-readonly` | 🕳️ (lié dashboard) | `knowledgeEntry.count/groupBy/findMany` | — | knowledge_entries | ⚠️ |
| `/kb-readonly/[id]` | 🕳️ | `knowledgeEntry.findUnique` | — | knowledge_entries, knowledge_translations | ⚠️ |
| `/embeddings` | 🕳️ (totale) | `$queryRawUnsafe`, `contentGenConfig` (`embeddings_last_run`...) | `embeddings-backfill-worker` (queue `embeddings-backfill`, cron 03:00) | articles, ContentGenConfig | ⚠️ |
| `/external-links` | 🕳️ (totale) | `listExternalLinks` / `triggerManualVerification` | `external-links-monitor-worker` (queue `external-links-monitor`) | ContentGenConfig, external_link_usage | ✅ |
| `/quality` | ✅ | `article.findMany`, `getQualityImprovementAttemptsDistribution` | `content-quality-improver-worker` | Article, ContentGenJob | ✅ |
| `/monitoring` | 🕳️ | static (redirect → `/jobs?status=failed`) | — | — | ⚠️ (placeholder) |
| `/similarity-monitor` | 🕳️ (cmdk) | static (**worker existe + écrit `similarity_pairs`, page n'affiche rien**) | `content-similarity-monitor-worker` | ContentGenConfig | ⚠️ |
| `/brand-voice-drift` | 🕳️ (totale) | `getBrandVoiceDriftStats` / `recalibrateBrandVoice` (**non exposée**) | `brand-voice-drift-monitor` (cron 04:00) | ContentGenConfig | ⛔ |
| `/costs` | ✅ | `getCostsStats` | — | CostLedger / providers | ✅ |
| `/landing-variants` | 🕳️ (totale) | `readContentGenConfig('landing_variants_active')` (**toggle promis, absent**) | — | ContentGenConfig | ⚠️ |
| `/landing-variants/[variant]` | 🕳️ | `contentTemplate.findMany`, `contentGenJob.count` | — | ContentTemplate, ContentGenJob | ✅ |
| `/author/manon` | 🕳️ (cmdk) | `getAuthor('manon')` / `updateAuthor` | — (rebuild JSON-LD + revalidate) | AuthorProfile | ✅ |
| `/settings` (hub) | ✅ | static (SECTIONS, **omet kb-ingest**) | — | — | ⚠️ |
| `/settings/providers` | 🕳️ (hub) | `listProviders` / `updateProvider`, `resetProviderSpend` | — | ProviderConfig | ✅ |
| `/settings/batches` | 🕳️ (hub) | `getBatchSettings` / `updateBatchSettings` ; `getContentGenQueueHealth` | `content-orchestrator-worker` ; BullMQ | ContentGenConfig | ✅ |
| `/settings/policies` | 🕳️ (hub) | `getPolicies` / `updatePolicies` | — | ContentGenConfig | ⚠️ |
| `/settings/banned-phrases` | 🕳️ (hub) | `listBannedPhrases` / `create/toggle/deleteBannedPhrase` | — | BannedPhrase | ✅ |
| `/settings/llms-txt` | 🕳️ (hub) | `getLlmsTxt` / `updateLlmsTxt` | lu par `/llms.txt` route | ContentGenConfig | ✅ |
| `/settings/coverage-distribution` | 🕳️ (hub) | `listDistributionProfiles` / `upsertDistributionProfile`, `delete` | — | CoverageDistributionProfile | ⚠️ |
| `/settings/audience-mix` | 🕳️ (hub) | `listAudienceMixProfiles` / `upsert`, `delete` | — | AudienceMixProfile | ⚠️ |
| `/settings/search-intent-distribution` | 🕳️ (hub) | `get/updateSearchIntentDistribution` | — | ContentGenConfig | ✅ |
| `/settings/quality-loop` | 🕳️ (hub) | `get/updateQualityLoop` | `content-quality-improver-worker` | ContentGenConfig | ✅ |
| `/settings/benefit-gate` | 🕳️ (hub) | `get/updateBenefitGateConfig` ; SSOT `quality-profile-table.ts` | — (env `QUALITY_PROFILES_ENABLED`) | ContentGenConfig | ⚠️ |
| `/settings/qa-policies` | 🕳️ (hub) | `get/updateQaPolicies` | `content-qa-extract-worker` | ContentGenConfig | ✅ |
| `/settings/kill-switch` | 🕳️ (hub) | `getKillSwitch` / `activate/deactivateKillSwitch` | lu par **TOUS** les workers content-* au pick | ContentGenConfig | ✅ |
| `/settings/seed-initial` | 🕳️ (hub) | `runInitialSeed` → `seedKbFacts`, `seedCampaignTemplates` | — | KnowledgeEntry, CampaignTemplate | ⚠️ |
| `/settings/kb-ingest` | 🕳️ (totale) | `ingestKbFromUrl/Sitemap` (anti-SSRF) → `publishToKB` (**résultat jeté**) | — | KnowledgeEntry | ⛔ |

**Constats transverses de la matrice :**
- Câblage backend **globalement sain** : aucune action « factice », queues nommées de façon concordante action↔worker (`content-gen`, `content-publish`, `content-rss-fetch`, `content-keyword-sync`, `external-links-monitor`, `embeddings-backfill`).
- Kill-switch correctement lu par tous les workers (point de sûreté validé).
- **Drift SSOT nav** : `AdminCommandPalette.tsx` maintient une liste hardcodée divergente de `admin-nav.ts` (PR5 jamais faite). Plusieurs routes ne sont accessibles QUE via cmdk, d'autres via NI sidebar NI cmdk.

---

## 2. Vrais défauts confirmés (triés par sévérité)

### ⛔ BLOQUANT — lien mort / promesse non tenue

| # | Défaut | Preuve `fichier:ligne` | Correctif proposé |
|---|---|---|---|
| B1 | **Lien mort 404** : bouton « Recalibrer la référence » pointe vers `/brand-voice-drift/recalibrate` inexistant (dossier = `page.tsx` + `_v2/` seulement, vérifié). L'action `recalibrateBrandVoice` existe mais n'est exposée par aucune page. | `brand-voice-drift/_v2/BrandVoiceDriftV2.tsx:32` ; `server/actions/content-gen/brand-voice.ts:66` | Remplacer le `<Link>` par un `<form action={recalibrateBrandVoice}>` inline (bouton submit + confirm), supprimer la cible fantôme. |
| B2 | **Route « generate » ne génère rien** : `geo/[villeSlug]/generate` n'a ni bouton ni Server Action d'enqueue, seulement de la prose + un Link, ET affiche la commande CLI `pnpm tsx scripts/content-gen/enqueue.ts` à l'admin. Quasi-inatteignable (0 lien interne). | `geo/[villeSlug]/generate/_v2/GeoVilleGenerateV2.tsx:28-43,31-33` | Soit câbler un vrai `<form action={enqueueDirectGen}>` (ville pré-remplie), soit supprimer la route et rediriger vers `/campaigns/new?ville=`. Retirer toute commande CLI de l'UI. |
| B3 | **`settings/kb-ingest` orpheline + 0 feedback** : absente du hub ET de la sidebar (URL-only), et les wrappers jettent le résultat riche (`accepted/rejected/rejectReason/processed`) → l'admin ne sait jamais si l'ingest a réussi/été rejeté. | `settings/_v2/SettingsIndexV2.tsx:8-69` ; `admin-nav.ts:186-191` ; `settings/kb-ingest/_v2/KbIngestV2.tsx:11-23` | Ajouter au hub SECTIONS ; capturer le retour dans un `useActionState` et afficher accepted/rejected/raison (pattern `seed-initial`). |
| B4 | **`templates/[id]` — « Tester » teste le mauvais template** : `testTemplate` passe `templateId` mais (1) le payload BullMQ ne le contient pas et (2) le worker résout par `contentType + isActive` en ignorant `dbJob.templateId`. Si le template édité est inactif/un autre actif existe → test sur un template différent. | `templates/[id]/_v2/TemplatesEditV2.tsx:79-89` ; `enqueue.ts:158-165` ; `content-gen-worker.ts:392` ; `template-resolver.ts:39-45` | Propager `templateId` dans le payload BullMQ et faire lire `dbJob.templateId` au worker (override prioritaire sur la résolution par contentType). |
| B5 | **`templates/[id]` — enqueue throw sur intent** : le dropdown de test propose `commercial_investigation` (enum DB) mais le schéma Zod d'`enqueueDirectGen` liste `commercial` → `ZodError` → 0 job créé. | `templates/[id]/_v2/TemplatesEditV2.tsx:116` ; `enqueue.ts:38,96` | Aligner `SearchIntentSchema` d'`enqueueDirectGen` sur l'enum DB SearchIntent (8 valeurs, dont `commercial_investigation`). |
| B6 | **Flux PRESETS cassé bout-en-bout** : `presets` → `/coverage/new?preset=` → redirect 308 **drop le query** → `campaigns/new/page.tsx` n'await que `params` (jamais `searchParams`) + wizard n'accepte aucune prop preset. Les 6 presets sont purement décoratifs. Aggravé : type `blog_pillar` des presets inexistant dans `WIZARD_CONTENT_TYPES` (`.strict()` Zod rejetterait même après fix). | `coverage/presets/_v2/CampaignPresetsV2.tsx:117` ; `coverage/new/page.tsx:20` ; `campaigns/new/page.tsx:26-31` ; `campaign-wizard-constants.ts` | Lien direct `/campaigns/new?preset=<slug>` ; `campaigns/new/page.tsx` await `searchParams` ; `CampaignWizardV2` accepte `initialState` ; mapper slugs preset → `WizardContentType` (`blog_pillar`→`guide_pilier`). |
| B7 | **`rss/[id]` read-only sous lien « Éditer »** : la liste mène à une page sans formulaire d'édition (seul « Supprimer »). `updateRssSourceInDb` existe avec validation Zod mais n'est câblée nulle part (code mort backend). | `rss/[id]/_v2/RssDetailV2.tsx:16-58` ; `rss/_v2/RssListV2.tsx:98-103` ; `rss-sources.ts:206-243` | Câbler un `<form action={updateRssSourceInDb}>` sur la page détail (réutiliser `RssFormClient`), OU renommer le lien en « Voir » si l'édition n'est pas voulue. |

### ⚠️ MAJEUR — fonctionnalité fantôme / donnée non affichée / promesse partielle

| # | Défaut | Preuve | Correctif |
|---|---|---|---|
| M1 | **`similarity-monitor` n'affiche pas ses données réelles** : le worker écrit `similarity_pairs` dans `ContentGenConfig` mais la page est 100 % statique et son texte « Sprint 4 à venir » est périmé. | `similarity-monitor/_v2/SimilarityMonitorV2.tsx:7-37` ; `content-similarity-monitor-worker.ts:133` | Lire `readContentGenConfig('similarity_pairs')` et rendre le top des paires ; corriger le texte de statut. |
| M2 | **`cities-coverage` — action `markCitiesPriority` fantôme** : définie/exportée mais jamais importée en UI ; le tableau est read-only, aucun moyen de prioriser une ville « À faire ». | `cities-coverage/_v2/CitiesCoverageV2.tsx` ; `server/actions/content-gen/cities-coverage.ts` | Ajouter une colonne action (checkbox + bouton `<form action={markCitiesPriority}>`). |
| M3 | **`embeddings` — bouton « Déclencher » mort** : `disabled` placeholder, alors que la queue `embeddings-backfill` + worker `runBackfill` existent et que la page sœur `external-links` a un trigger fonctionnel. | `embeddings/page.tsx:315-322` | Câbler une server action `triggerEmbeddingsBackfill` → enqueue `embeddings-backfill` (calquer sur `triggerManualVerification`). |
| M4 | **`landing-variants` — toggle promis absent** : header annonce « Toggle ON/OFF + override par ville » mais colonne « Actif » = emoji read-only, aucun `<form>` ; ni le détail ni le parent ne le permettent. | `landing-variants/_v2/LandingVariantsV2.tsx:31,52,54` | Ajouter un `<form action={toggleLandingVariant}>` écrivant `landing_variants_active` dans ContentGenConfig. |
| M5 | **`targetPerCity` input mort + affiché comme effectif** : collecté/validé Zod mais jamais persisté (`totalTargetCount = dailyArticles*30` en dur), pourtant affiché au récap comme valeur effective (trompeur). | `campaign-wizard.ts:53,104,108-128` ; `CampaignWizardV2.tsx:475-476` | Soit persister `targetPerCity` et l'utiliser dans le calcul, soit retirer le champ + la ligne de récap. |
| M6 | **Incohérence donnée feedback `ArticleFeedback.type`** : la page détail review écrit `up`/`down` en court-circuitant l'action canonique `submitArticleFeedback` qui écrit `thumbs_up`/`thumbs_down` (même colonne) → valeurs divergentes ; et dédoublonne par `articleId` seul (le vote d'1 admin bloque tous les autres). | `ReviewDetailV2.tsx:66,90-99` ; `article.ts:40,555-564` | Faire appeler `submitArticleFeedback` par la page détail (valeurs + dédoublonnage `(articleId,userId)` corrects). |
| M7 | **Campagnes wizard sans coût estimé** : `createCampaignFromWizard` ne pose pas `estimatedCostUsd`/`Duration` → colonne « Coût est. » toujours « — » pour ces campagnes (divergence avec `createCampaign`). | `campaign-wizard.ts:108-128` ; `CoverageListV2.tsx:168-170` | Calculer une estimation au create wizard (réutiliser la logique de `createCampaign`). |
| M8 | **CTA « Nouvelle campagne » via stub 308** : dashboard + onboarding + presets pointent vers `/coverage/new` (redirect legacy) au lieu de `/campaigns/new` (SSOT nav). Saut inutile + divergence. | `ContentGenDashboardV2.tsx:61,81` ; `OnboardingV2.tsx:83` ; `CampaignPresetsV2.tsx:75` | Pointer directement `/campaigns/new`. |

### ⚠️ MINEUR — propreté code / cohérence charte / chiffres périmés

| # | Défaut | Preuve | Correctif |
|---|---|---|---|
| m1 | Onboarding : pas de gating réel avant « Marquer terminé » (`allOk` circulaire car inclut `onboarded`) + commande shell `pnpm tsx ...` exposée. | `OnboardingV2.tsx:33,58,96-105` | `disabled` tant que étapes 1-3 KO ; remplacer la commande par un bouton « Seeder Manon ». |
| m2 | Filtre statut `/coverage` omet `scheduled` (réellement atteignable) ; filtre `/jobs` omet `approved`, `quarantined_*`. | `CoverageListV2.tsx:21-27` ; `JobsListV2.tsx:21-30` | Compléter les listes de statuts. |
| m3 | Schéma Zod `ContentGenJobStatusSchema` (action `jobs.ts`) incomplet vs enum Prisma (`generating_text`, `generating_image`, `running_qa` omis). | `jobs.ts:27-39` ; `schema.prisma:2736-2751` | Synchroniser le Zod sur l'enum Prisma. |
| m4 | Imports/fichiers morts : `coverage/page.tsx:7-35` (listCampaigns, STATUSES, sectorLabel…) ; `KeywordStrategyView.tsx` (V1 jamais importée) ; `updateRssSourceInDb`, `backfillRssSourcesFromJsonConfig` non câblés. | cf. zones | Supprimer le code mort. |
| m5 | JSON brut édité sans garde : `coverage-distribution:37` et `audience-mix:37` font `JSON.parse` sans try/catch (crash serveur sur JSON malformé), asymétrie avec `batches` (fallback `{}`). | `CoverageDistributionV2.tsx:37` ; `AudienceMixV2.tsx:37` | Wrapper try/catch + message FR. |
| m6 | Édition template : `JSON.parse(variables)` non protégé (vs création). | `templates/[id]/_v2/TemplatesEditV2.tsx:70` | try/catch + erreur inline. |
| m7 | Champs template inertes : `userPromptTemplate`, `outputSchemaZod`, `variables` requis dans le form mais jamais relus par le pipeline (`template-resolver` ne SELECT que systemPrompt/temperature/maxTokens). | `template-resolver.ts:46-52` | Marquer les champs « non utilisés (V2) » ou les câbler. |
| m8 | Couleurs hors tokens admin : `city-equity` (bg-red/yellow/green-50), `coverage/[id]` badges (bg-blue/orange-100). | `CityEquityV2.tsx:37-39` ; `CoverageDetailV2.tsx:240,245` | Utiliser `var(--color-admin-*)`. |
| m9 | Distributions/JSON bruts en `<pre>` : `coverage/[id]` (typeDistribution/audienceMix/searchIntentMix). | `CoverageDetailV2.tsx:198-216` | Rendre en tableaux lisibles. |
| m10 | Chiffres périmés hub settings : « 130 facts / 6 presets / 11 sous-pages / 30 réglages » vs réalité 290/8/14. | `SettingsIndexV2.tsx:68,82` ; `page.tsx:5` ; `SeedInitialV2.tsx:25` | Aligner sur les valeurs réelles. |
| m11 | Pagination heuristique `geo/coverage-table` : « Suivant » sur dernière page pleine + label « 50+ » trompeur. | `CoverageCrossTableV2.tsx:62,234-236` | Compter le total et borner. |
| m12 | Commentaires/roadmap périmés : `rss/page.tsx` (parle de ContentGenConfig), `geo/history/page.tsx:4` (« ContentGenJob » vs CoverageCampaign), « Sprint 4/v7+1/Session 7+ » contradictoires. | cf. zones | Nettoyer les commentaires. |
| m13 | `keyword-strategy` : « 5 verticales » vs 6 labels (`transversal`) + barre `/5` → % faux ; basePath hardcode `/fr/`. | `KeywordStrategyV2.tsx:126,148,166,109` | Corriger le dénominateur + utiliser `locale`. |
| m14 | Pas de `loading.tsx` sur les 3 routes DB de `kb-embeddings` (force-dynamic, external-links hydrate ~2400 liens). | `kb-readonly`, `embeddings`, `external-links` | Ajouter un skeleton. |
| m15 | Constante coût hardcodée dans la vue embeddings (`*695*0.00000013`) divergente du worker. | `embeddings/page.tsx:281` | Centraliser `COST_PER_TOKEN`. |
| m16 | `geo/batches/new` + `geo/batches/[id]` = stubs/redirects nommés pour une action qu'ils ne réalisent pas (mériteraient « broken » par cohérence avec `generate`). | `GeoBatchesNewV2.tsx:14-35` ; `geo/batches/[id]/page.tsx:16-20` | Supprimer ou implémenter la vraie vue batch. |
| m17 | `adhoc` : pas de garde `auth()` explicite (vs 3 autres pages), prop `adminPrefix` renommée `_adminPrefix` inutilisée → pas de lien vers le job dispatché ; types `blog_from_title`/`blog_from_rss` proposés sans payload requis. | `orchestrator/adhoc/page.tsx:10-13` ; `AdHocDispatchV2.tsx:32,134-139` | Ajouter `auth()` ; afficher un `<Link>` vers `/jobs/[id]` ; conditionner/masquer les types nécessitant un payload. |

### Faux positifs rejetés (ne PAS corriger)

- **`JobDetailV2` bouton Annuler « mort »** : FAUX — `generating_text`/`generating_image` SONT dans l'enum Prisma, et `isRunning` couvre aussi `running/queued/quality_improving`. Bouton fonctionnel.
- **`embeddings` « 1536 dims imprécis »** : FAUX — config réelle volontaire (worker `dimensions:1536` Matryoshka + colonne `vector(1536)`).
- **`templates` « pas d'error.tsx/loading.tsx »** : FAUX partiel — boundaries existent au niveau `[adminPrefix]`.
- **Pages DB vides au build stub.invalid** : NORMAL (ADR 0026), jamais un bug.
- **`blog_from_keywords` « plante sans keyword »** : FAUX — fallback worker (rotation seeds). Risque réel limité à `blog_from_title`/`blog_from_rss`.
- **`(prisma as any).articleFeedback`** : bruit de typage, modèle existe — pas un bug runtime.

---

## 3. Routes orphelines (hors sidebar) — décision

| Route | Décision | Justification |
|---|---|---|
| `/content-gen/onboarding` | **À rattacher** (conditionnel) | Utile à la 1re visite ; ajouter au pôle Réglages OU n'afficher dans la nav que si `!onboarded`. |
| `/coverage/presets` | **À rattacher** (après fix B6) | Vraie valeur (presets) mais flux cassé ; rattacher au pôle Lancer une fois fonctionnel. |
| `/coverage/new` | **Mort à supprimer** (à terme) | Stub 308 legacy ; garder 6 mois pour bookmarks puis retirer après bascule des CTA vers `/campaigns/new`. |
| `/orchestrator` | **Doublon à fusionner** | Duplique KPIs + liste campagnes du dashboard et de `/coverage` ; fusionner dans le dashboard ou rattacher au pôle Suivre. |
| `/orchestrator/adhoc` | **OK** (déjà sidebar) | — |
| `/queue` | **Doublon à fusionner** | Mêmes données + même action que `/jobs` ; soit supprimer, soit transformer en vraie vue Redis (sinon retirer le titre « BullMQ » trompeur). |
| `/publications-status` | **Doublon à fusionner** | Recoupe `/review-queue` (approbation pending) ; garder comme vue « kanban » rattachée au pôle Publier mais retirer la promesse drag&drop fantôme. |
| `/geo` + sous-arbre (`batches`, `batches/new`, `batches/[id]`, `history`, `coverage-table`, `[villeSlug]/generate`) | **À rattacher (cockpit) / supprimer (stubs)** | Rattacher `/geo` + `/geo/coverage-table` au pôle Villes ; **supprimer** `batches/new`, `batches/[id]`, `[villeSlug]/generate` (stubs/redirects/broken) ; `history` = doublon de `batches` (fusionner). |
| `/cities-coverage` | **À rattacher** (+ renommer) | Vraie page de couverture 2100 villes ; rattacher au pôle Villes en désambiguïsant le nom. |
| `/kb-readonly` (+ `/[id]`) | **À rattacher** | Lié au dashboard mais hors sidebar ; rattacher au pôle Qualité&Coûts (ou Réglages/KB). |
| `/embeddings` | **À rattacher** | Orpheline totale ; pôle Qualité&Coûts. |
| `/external-links` | **À rattacher** | Orpheline totale alors qu'elle a une action mutante ; pôle Qualité&Coûts. |
| `/similarity-monitor` | **À rattacher** | cmdk only ; pôle Qualité&Coûts (après fix M1). |
| `/brand-voice-drift` | **À rattacher** (après fix B1) | Orpheline totale + lien mort ; pôle Qualité&Coûts. |
| `/landing-variants` (+ `/[variant]`) | **À rattacher** | Orpheline totale ; pôle Réglages (après fix M4). |
| `/author/manon` | **À rattacher** | cmdk only ; pôle Réglages. |
| `/monitoring` | **Mort à supprimer** | Pur redirect placeholder ; remplacer le lien du bandeau par `/jobs?status=failed` direct. |
| Sous-pages `/settings/*` (13) | **OK via hub** | Accessibles via le hub `settings` (lui-même en sidebar) — sauf `kb-ingest` à rattacher (cf. B3). |
| Routes `[id]` de détail | **OK** | Orphelines par nature (atteignables via leur liste). |

**Drift SSOT à corriger** : aligner `AdminCommandPalette.tsx` sur `admin-nav.ts` (PR5) — une seule source de vérité de navigation.

---

## 4. Graines de taxonomie cible

### 4.1 Regroupement en 6 pôles orientés tâche

> Principe : l'admin pense en **tâche** (« je veux lancer », « je veux voir où ça en est », « je veux publier »), pas en objet technique. Les ~17 items à plat actuels sont répartis ainsi :

1. **Lancer** — démarrer de la génération
   - Nouvelle campagne (`/campaigns/new`), Presets (`/coverage/presets`), Génération immédiate (`/orchestrator/adhoc`), Onboarding (1re visite).
2. **Suivre** — observer l'avancement & l'état
   - Tableau de bord (`/content-gen`), Campagnes (`/coverage` + détail), Jobs (`/jobs` + détail), File d'attente (`/queue` fusionnée), Cockpit (`/orchestrator` + `/geo` fusionnés).
3. **Publier** — valider & mettre en ligne
   - File de revue (`/review-queue`), Publications (`/publications` + édition), Suivi des publications (`/publications-status` kanban).
4. **Villes** — couverture géographique
   - Couverture villes (`/cities-coverage`), Qualité data pilote (`/city-coverage`), Équité par ville (`/city-equity`), Carte de couverture (`/coverage-map`), Ordre des villes (`/cities-order`), Tableau croisé (`/geo/coverage-table`).
5. **Qualité & Coûts** — santé & dépenses
   - Qualité (`/quality`), Coûts (`/costs`), Anti-doublon (`/similarity-monitor`), Dérive de ton (`/brand-voice-drift`), Embeddings (`/embeddings`), Liens externes (`/external-links`), Base de connaissances (`/kb-readonly`).
6. **Réglages** — configuration
   - Hub `/settings` + ses 14 sous-pages, Sources RSS (`/rss`), Templates de prompts (`/templates`), Variantes de landing (`/landing-variants`), Mots-clés (`/keyword-tracking` + `/keyword-strategy`), Profil auteur Manon (`/author/manon`), Ingestion KB (`/settings/kb-ingest`).

### 4.2 Tableau de renommage du jargon (ancien → clair)

| Ancien (jargon) | Nouveau (clair) |
|---|---|
| Orchestrateur / Cockpit géo | Pilotage de la génération |
| Queue BullMQ / Inspecter BullMQ | File d'attente |
| Dispatch un job / Lancement ad-hoc | Lancer une génération maintenant |
| Jobs content-gen / Retry all failed | Générations / Relancer les échecs |
| Review queue | File de revue |
| Approuver (tier-2) / Promouvoir tier-1 | Approuver (page non indexée) / Mettre en avant (page indexée) |
| Demote tier-2 / Rollback / Draft (rollback) | Rétrograder (non indexée) / Revenir en arrière / Repasser en brouillon |
| tier-1 indexable / tier-2 noindex / tier-3 nofollow | Indexée / Non indexée / Non suivie |
| re-prompt LLM / guidance LLM | Demander une réécriture (à venir) |
| Rollup aujourd'hui | Récapitulatif du jour |
| Anti-doublon (similarity / cosine / Jaccard) | Détection de doublons |
| Brand voice drift | Dérive du ton éditorial |
| Embeddings Backfill Monitor | Suivi des vecteurs de similarité |
| External Links Database | Base de liens externes |
| Benefit-gate / juge LLM PH3 | Filtre bénéfice client / Relecture par IA |
| Anti-burst / Concurrency workers | Lissage de la cadence / Générations en parallèle |
| KB / KB entries | Base de connaissances / Fiches |
| Keyword tracking / Stratégie Keywords | Suivi des positions / Stratégie mots-clés |
| Rollback / IndexNow ping | Revenir en arrière / Notifier les moteurs |
| Génération unitaire (§ 12.2) / 21 sliders (9 V1 + 12 Phase 8) | Génération à l'unité / Répartition des types de contenu |
| landing_ville / blog_from_rss / qa_derived (IDs sliders) | Page ville / Article depuis RSS / Q-R dérivée |
| Cible/ville (targetPerCity) | (champ à retirer ou à câbler) |
| pnpm tsx scripts/... / pnpm content-gen:seed | (à remplacer par un bouton d'action) |

---

## 5. Top flux cassés (priorité de correction)

1. **B6 — Flux PRESETS** (lien + redirect + searchParams + enum) : le plus visible, 6 presets décoratifs.
2. **B4+B5 — `templates/[id]` « Tester »** : teste le mauvais template OU throw silencieux selon l'intent.
3. **B1 — `brand-voice-drift/recalibrate`** : 404 garanti au clic.
4. **B2 — `geo/[villeSlug]/generate`** : route « generate » sans génération + CLI exposé.
5. **B7 — `rss/[id]` « Éditer »** : lien qui ne tient pas sa promesse (read-only).
6. **B3 — `settings/kb-ingest`** : orpheline + aucun feedback.

---

*Fin de l'audit fonctionnel. Sources : 11 audits de zone + verdicts adversariaux croisés. Toutes les preuves sont `fichier:ligne` et reproductibles sur la branche `content-gen-ux`.*
