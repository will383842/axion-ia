# A04 Phase 4 — Orchestrator per-campaign + ad-hoc dispatch

## Statut : PROD

Verdict binaire : code livré, câblé bout-en-bout, aligné avec le schema Phase 1, sans
leftover de l'ancien dispatch `dailyBatchSize`. 5 tests dédiés (P1→P5) couvrent les
chemins clés.

## Files claimed vs found

| Fichier annoncé (commit 50b1c31b)                                                                      | Trouvé | Notes                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/queue/workers/content-orchestrator-worker.ts` (+85 / -25)                                  | OUI    | `resolveVilleAnchors()` lignes 202-223 ; budget V2 `ceil(dailyArticles/96)` ligne 527 ; dispatch `cityProcessingMode` ligne 533. |
| `src/server/actions/content-gen/adhoc.ts` (+91)                                                        | OUI    | `dispatchAdHocJob` Zod + `requireAdminWriteRateLimited("dispatch-adhoc-job", { limit: 10 })` + Sentry + BullMQ.                  |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator/adhoc/page.tsx` (+13)                 | OUI    | Wrapper qui rend `AdHocDispatchV2`.                                                                                              |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator/adhoc/_v2/AdHocDispatchV2.tsx` (+142) | OUI    | Formulaire client, 4 champs, toast sonner.                                                                                       |
| `src/lib/admin-nav.ts` (+12)                                                                           | OUI    | 2 items « ad-hoc » présents (grep confirm).                                                                                      |
| `src/server/queue/workers/__tests__/orchestrator-per-campaign.test.ts` (+274)                          | OUI    | 5 tests P1→P5.                                                                                                                   |
| `src/server/queue/workers/__tests__/orchestrator-sequential.test.ts` (+11/-)                           | OUI    | Patch `cityGenerationOrder` mock (diff du commit).                                                                               |
| `src/server/queue/workers/__tests__/recurring-schedule.test.ts` (+13/-)                                | OUI    | Patch `cityGenerationOrder` mock (diff du commit).                                                                               |
| `src/lib/admin-nav.test.ts` (+4/-2)                                                                    | OUI    | Maj count items.                                                                                                                 |

Aucune divergence file-level. Tous les fichiers annoncés existent au HEAD `98e7626a`.

## Tests détectés (deferred A20)

`src/server/queue/workers/__tests__/orchestrator-per-campaign.test.ts` (274 L)

- P1 : `dailyArticles=96` → 1 job/tick (`ceil(96/96)=1`).
- P2 : `dailyArticles=192` → 2 jobs/tick (`ceil(192/96)=2`).
- P3 : `villeScopeMode=custom_subset` + `customVilleSlugs=["bordeaux","nantes"]`
  → utilise `customVilleSlugs`, `cityGenerationOrder.findMany` non appelé.
- P4 : `villeScopeMode=custom_subset` + `customVilleSlugs=[]` + `anchorVilleSlugs=["lyon"]`
  → fallback `anchorVilleSlugs`, `cityGenerationOrder.findMany` non appelé.
- P5 : `villeScopeMode=global_queue` + tous anchors vides
  → query `CityGenerationOrder` (top-200, `orderBy: [pinned desc, rank asc]`).

Mocks Prisma + BullMQ + `_settings` + `anti-burst` + `content-gen-alerts` + `sentry-worker`
hoistés. Pas d'appel DB réel. Validation deferred A20.

## Cross-checks

- **Wiring avec schema enum Phase 1** : oui.
  - `VilleScopeMode` enum déclaré dans `prisma/schema.prisma:2648` (`global_queue` / `custom_subset`),
    colonne `ville_scope_mode` ligne 2984 + `custom_ville_slugs` ligne 2987 + `daily_articles` ligne 2981.
  - Migration appliquée : `prisma/migrations/20260523123842_add_city_generation_order_v7_phase1/migration.sql:8`.
  - Le worker importe `CityProcessingMode` depuis `prisma/generated/client` (ligne 30) et lit
    `campaign.villeScopeMode`, `campaign.customVilleSlugs`, `campaign.dailyArticles`, `campaign.cityProcessingMode`
    directement depuis l'enregistrement Prisma.
- **Pas de leftover ancien dispatch** : oui.
  - Aucun usage de `dailyBatchSize` dans `src/` (grep = 0 fichier).
  - `BatchSettings` (lignes 54-58 du worker) n'expose plus `dailyBatchSize` ; seul
    `workersConcurrency` + `dailyTargetByType?` + `antiBurstEnabled?` subsistent.
  - Le commentaire ligne 2979 du schema documente explicitement la dépréciation :
    `dailyArticles … déprécie le setting global batches.dailyBatchSize`.
- **Cohérence ad-hoc** : la server action `adhoc.ts` réutilise la queue `content-gen` (ligne 72)
  avec le même payload shape que `createJobForSlot` du worker (ligne 176-185), garantissant
  que les jobs ad-hoc sont consommés par le même worker primaire que les jobs orchestrés.
- **cityProcessingMode dispatch** : worker ligne 533 branche `sequential` vs `parallel`
  (default), aligné avec l'enum `CityProcessingMode` du schema Phase 1.

## Verdict / écarts trouvés

PROD. Aucun écart bloquant détecté.

Observations mineures non-bloquantes :

- Le worker ne logue pas explicitement le mode (`sequential`/`parallel`) au niveau du tick
  global ; le log final ligne 559 mentionne uniquement le mode de budget
  (`per-type-antiburst` vs `per-campaign-dailyArticles`).
- `AdHocDispatchV2.tsx` accepte un `campaignId` libre sans validation Zod côté client
  (validation côté server uniquement via `z.string().cuid().optional()`).
- Tests `orchestrator-per-campaign` mockent `computeAntiBurstSchedule` à `[]`, donc seul
  le chemin `!hasPerTypeMode` (budget V2 per-campaign) est couvert ; le chemin
  `hasPerTypeMode` (anti-burst) n'a pas de couverture dédiée dans ce fichier.

Aucune de ces observations ne remet en cause la livraison Phase 4.
