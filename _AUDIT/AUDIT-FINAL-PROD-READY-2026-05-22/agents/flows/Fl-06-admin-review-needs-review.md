# Fl-06 — Admin review needs_review

**HEAD audité** : 81f6ea0e
**Score** : 23 / 25
**Verdict** : 🟢 GO PROD

## Chaîne traçée

| Étape                                                                        | Fichier                                                                                       | Ligne                                              | Verdict                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| Route review queue list                                                      | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/page.tsx`                    | 1-23                                               | OK                           |
| Auth gate                                                                    | idem                                                                                          | 19-20                                              | OK                           |
| List V2                                                                      | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/_v2/ReviewQueueListV2.tsx`   | présent                                            | OK                           |
| Route detail review                                                          | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/page.tsx`               | présent                                            | OK                           |
| Detail V2                                                                    | `src/app/[locale]/(admin)/[adminPrefix]/content-gen/review-queue/[id]/_v2/ReviewDetailV2.tsx` | 1-50+                                              | OK                           |
| Imports `approveReview` / `rejectReview` / `promoteToTier1` / `requestEdits` | idem                                                                                          | 8-13                                               | OK                           |
| **`qualityImprovementAttempts` field DB**                                    | `prisma/schema.prisma`                                                                        | 3007 (`Int @default(0)`) sur model `ContentGenJob` | OK P5 P0-4                   |
| `QualityIterationsBadge` UI colorée (success/warning/danger)                 | `ReviewDetailV2.tsx`                                                                          | 35-50                                              | OK                           |
| `ReviewData` shape avec `qualityImprovementAttempts`                         | idem                                                                                          | 24-29                                              | OK                           |
| **Server action `approveReview`**                                            | `src/server/actions/content-gen/review.ts`                                                    | 153-179                                            | OK                           |
| Update atomique pending → approved (race-safe, P1-C fix 2026-05-15)          | idem                                                                                          | 156-167                                            | OK                           |
| `enqueuePublish` tier-2 default                                              | idem                                                                                          | 170                                                | OK                           |
| `logActivity` SOC2                                                           | idem                                                                                          | 171-177                                            | OK                           |
| **Server action `rejectReview`**                                             | idem                                                                                          | 264-…                                              | OK (race-safe identique)     |
| Bulk approve (score ≥ 75 modifiable)                                         | idem                                                                                          | 189-224                                            | OK § 12.1 master prompt v1.8 |
| Bulk reject (score < maxScore)                                               | idem                                                                                          | 229-262                                            | OK                           |
| **Prisma model `ArticleFeedback`** (thumbs up/down P5.5 P1-4)                | `prisma/schema.prisma`                                                                        | 3634-3645 (`@@map("…")` + FK `article` cascade)    | OK                           |
| API route `POST /api/admin/content-gen/articles/[id]/feedback`               | `src/app/api/admin/content-gen/articles/[id]/feedback/route.ts`                               | présent                                            | OK                           |
| `promoteToTier1` (promotion direct tier-1 sans publier)                      | `review.ts` (importé `ReviewDetailV2.tsx:10`)                                                 | OK                                                 |
| `requestEdits` (P1 boucle quality-improver re-run)                           | idem                                                                                          | OK                                                 |

## Findings P0/P1/P2

| Niveau | Item                                                                                                                                                                                                                                                                | Référence             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **P1** | Le QualityV2 dashboard (`quality/_v2/QualityV2.tsx`) agrège scores quotidiens 30j (SEO/Quality/Readability/FactCheck/Editorial) mais ne montre PAS la distribution des `qualityImprovementAttempts` — manque visualisation "X articles ont nécessité 2 itérations". | `QualityV2.tsx:26-93` |
| **P2** | `articles/[id]/review` n'a pas été inspecté en détail — uniquement `review-queue/[id]` (qui est le chemin canonique). Le prompt mentionnait `articles/[id]/review` alternatif — non implémenté ici (acceptable car `review-queue/[id]` est le pattern utilisé).     | —                     |

## Verdict détaillé

Flow review robuste : route auth-gatée, server actions `approveReview`/`rejectReview`/`promoteToTier1`/`requestEdits` race-safe (updateMany atomique pending→target), enqueue publish-worker tier-2 par défaut, SOC2 audit log, bulk operations, `qualityImprovementAttempts` exposé dans badge UI, `ArticleFeedback` model P5.5 + API route câblés. Score 23/25 (−2 : pas de visualisation aggregée `qualityImprovementAttempts` dans QualityV2 ; route alternative `articles/[id]/review` absente).
