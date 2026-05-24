# A22 — Frontend/backend raccordement

## Statut : ⚠️ Orphelins (3 modules sans consumer UI) + 0 consumer cassé

Scope : server actions ajoutées (A) ou modifiées (M) entre `c39f08db` et `98e7626a` sous `src/server/actions/content-gen/`. Vérification : import alias `@/server/actions/content-gen/*` depuis `src/app/[locale]/(admin)/**` + `src/components/admin/**` + signatures call-site vs Zod/TS schema.

## Server actions nouvelles (Sessions 4-11)

| Action                             | File                                                  | Consumer(s) UI                                       | Signature match                                       |
| ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `dispatchAdHocJob`                 | `src/server/actions/content-gen/adhoc.ts`             | `orchestrator/adhoc/_v2/AdHocDispatchV2.tsx` (L44)   | OK — `{contentType, anchorVilleSlug?, searchIntent?}` |
| `createCampaignFromWizard`         | `src/server/actions/content-gen/campaign-wizard.ts`   | `campaigns/new/_v2/CampaignWizardV2.tsx` (L139)      | OK — 11 champs strict, Zod parse côté action          |
| `WIZARD_CONTENT_TYPES` const       | `campaign-wizard-constants.ts`                        | importé par `campaign-wizard.ts` + tests (transitif) | OK constants-only                                     |
| `getCityGenerationOrder`           | `src/server/actions/content-gen/cities-order.ts`      | `cities-order/page.tsx` (L38)                        | OK — `{page, pageSize}`                               |
| `reorderCities`                    | idem                                                  | `cities-order/_v3/CitiesOrderV3.tsx` (L178)          | OK — `{slugs[]}`                                      |
| `pinCity`                          | idem                                                  | `cities-order/_v3/CitiesOrderV3.tsx` (L204)          | OK — `{slug, pinned}`                                 |
| `getCoverageStats`                 | idem                                                  | aucun (helper interne D13)                           | ⚠️ Orphelin partiel                                   |
| `getCoverageMapData`               | `src/server/actions/content-gen/coverage-map.ts`      | `coverage-map/page.tsx` (L30)                        | OK — opts optionnels                                  |
| `getCurrentExpansionPhase`         | `src/server/actions/content-gen/expansion-state.ts`   | aucun UI                                             | ⚠️ Orphelin (worker-only, voir A09)                   |
| `setCurrentExpansionPhase`         | idem                                                  | aucun UI                                             | ⚠️ Orphelin                                           |
| `assertWithinPhaseQuotas`          | idem                                                  | aucun UI                                             | ⚠️ Orphelin (worker-only)                             |
| `PHASE_QUOTAS` const               | idem                                                  | aucun UI                                             | ⚠️ Orphelin                                           |
| `markAsRealTestimonial`            | `src/server/actions/content-gen/real-testimonials.ts` | aucun UI                                             | 🟠 Orphelin Phase 15                                  |
| `getRealTestimonialsOnly`          | idem                                                  | aucun UI                                             | 🟠 Orphelin Phase 15                                  |
| `listRssSourcesFromDb`             | `src/server/actions/content-gen/rss-sources.ts`       | aucun UI (worker + script)                           | 🟠 Orphelin admin                                     |
| `getRssSourceByIdFromDb`           | idem                                                  | aucun                                                | 🟠 Orphelin                                           |
| `addRssSourceToDb`                 | idem                                                  | aucun UI                                             | 🟠 Orphelin                                           |
| `updateRssSourceInDb`              | idem                                                  | aucun UI                                             | 🟠 Orphelin                                           |
| `removeRssSourceFromDb`            | idem                                                  | aucun UI                                             | 🟠 Orphelin                                           |
| `toggleRssSourceInDb`              | idem                                                  | aucun UI                                             | 🟠 Orphelin                                           |
| `backfillRssSourcesFromJsonConfig` | idem                                                  | `src/scripts/backfill-rss-sources.ts`                | OK script CLI                                         |

## Server actions modifiées (signatures touchées)

| Action                                                                                                                                                                                                                                                                               | File                                         | Consumer(s) UI                                                                                                             | Signature match                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `getCityContentEquityMatrix` (nouveau)                                                                                                                                                                                                                                               | `city-equity.ts`                             | `city-equity/_v2/CityEquityV2.tsx` L90                                                                                     | OK — `{campaignId?, regionSlug?, ...}`                     |
| `getContentTypeEquitySummary` (nouveau)                                                                                                                                                                                                                                              | idem                                         | `city-equity/_v2/CityEquityV2.tsx` L94                                                                                     | OK — `(campaignId)`                                        |
| `getCityEquityData` (return type renommé `CityEquityData` → `ReadonlyArray<CityEquityRow>`)                                                                                                                                                                                          | idem                                         | aucun consumer trouvé                                                                                                      | ⚠️ Breaking type contract sans cassure (zéro consommateur) |
| `coverage.ts` — `listCampaigns/getCampaign/createCampaign/launchCampaign/pauseCampaign/resumeCampaign/cancelCampaign/incrementCampaignTarget/estimateCampaign/scheduleCampaign/listCampaignTemplates/extendCampaignDeadline`                                                         | `coverage.ts` (M, déjà présents au baseline) | `coverage/page.tsx`, `coverage/_v2/CoverageListV2.tsx`, `coverage/[id]/page.tsx`, `coverage/[id]/_v2/CoverageDetailV2.tsx` | OK toutes signatures préservées                            |
| `policies.ts` (M) — `getBatchSettings/updateBatchSettings/getMaxPublishPerDay/updateMaxPublishPerDay/getPolicies/updatePolicies/getLlmsTxt/updateLlmsTxt/getQualityLoop/updateQualityLoop/getQaPolicies/updateQaPolicies/getSearchIntentDistribution/updateSearchIntentDistribution` | `policies.ts`                                | `orchestrator/_v2/OrchestratorV2.tsx` + 6 settings pages `_v2/*V2.tsx`                                                     | OK 11 imports validés                                      |

## Consumers UI cassés (imports vers action obsolète)

| Consumer | Action attendue | Action trouvée |
| -------- | --------------- | -------------- |
| (aucun)  | —               | —              |

Aucune référence cassée détectée : tous les imports `@/server/actions/content-gen/*` côté UI admin résolvent vers un export existant à HEAD.

## Server actions sans consumer UI (orphelins)

| Action                                         | Justifiable (API direct ?)                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getCoverageStats` (cities-order.ts)           | Justifiable — utilitaire D13 « 3 buckets » conçu pour appel direct depuis serveur (tooltips villes). Recommandé : câbler dans `CitiesOrderV3.tsx` pour révéler la couverture par ligne, ou marquer `@internal`.                                                                                                                                                             |
| `expansion-state.ts` (4 exports)               | Justifiable — consommé par `content-orchestrator-worker.ts` (phase 9). Pas d'UI prévue : c'est de la régulation backend. Conforme.                                                                                                                                                                                                                                          |
| `real-testimonials.ts` (2 exports)             | 🟠 NON justifiable seul — Phase 15 « real testimonials marker + filter » prévoit un toggle admin pour marquer un avis. Aucun bouton/page admin ne pointe encore vers `markAsRealTestimonial`. Wiring UI manquant.                                                                                                                                                           |
| `rss-sources.ts` (6 exports CRUD + 1 backfill) | 🟠 NON justifiable — Phase 6 « RSS Prisma-backed CRUD » a été livrée côté action + worker + script, mais l'admin `/content-gen/rss/**` continue d'importer le **legacy** `@/server/actions/content-gen/rss` (JSON-config keyed by URL). Coexistence intentionnelle (cf. memory `axionia_sprint_v7_session_6_2026-05-23`) mais migration UI vers `rss-sources` non réalisée. |

## Verdict / écarts trouvés

- 0 consumer UI cassé. 0 import vers symbole inexistant. 0 mismatch d'arity.
- 1 module 100 % wired vers UI : `campaign-wizard`, `cities-order`, `coverage-map`, `adhoc`, `policies`, `city-equity` (nouveaux exports), `coverage` (modifs).
- 3 modules orphelins UI :
  1. `expansion-state.ts` — légitime (worker-only).
  2. `real-testimonials.ts` — wiring UI Phase 15 manquant (bouton « marquer comme vrai » + filtre liste avis absents côté admin testimonials).
  3. `rss-sources.ts` — wiring UI Phase 6 manquant (admin `/rss/**` toujours sur API JSON legacy). Cohabitation documentée mais non terminée.
- 1 helper partiellement orphelin : `getCoverageStats` (utilitaire D13 non consommé).
- 1 breaking type silencieux : `getCityEquityData` change de forme retour ; aucun consumer impacté car remplacé par les deux nouvelles fonctions matrix/summary. À noter pour quiconque réintroduirait un appel direct.

Sous-sprint résiduel ~3-4 h estimé pour câbler real-testimonials admin UI + migrer admin /rss vers `rss-sources.ts`.
