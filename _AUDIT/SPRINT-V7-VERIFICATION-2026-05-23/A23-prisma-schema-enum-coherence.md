# A23 — Prisma schema cohérence enum ContentType

## Statut : ✅ COHÉRENT

## Schema.prisma — ContentType values

Source : `axionia/prisma/schema.prisma` lignes 2517-2542.

| #   | Value                 | Présent dans migration SQL |
| --- | --------------------- | -------------------------- |
| 1   | `landing_ville`       | N/A (pré-existant)         |
| 2   | `blog_article`        | N/A (pré-existant)         |
| 3   | `blog_from_rss`       | N/A (pré-existant)         |
| 4   | `blog_from_keywords`  | N/A (pré-existant)         |
| 5   | `blog_from_title`     | N/A (pré-existant)         |
| 6   | `comparison`          | N/A (pré-existant)         |
| 7   | `guide_pilier`        | N/A (pré-existant)         |
| 8   | `qa_derived`          | N/A (pré-existant)         |
| 9   | `faq_standalone`      | N/A (pré-existant)         |
| 10  | `long_tail_keyword`   | ✅                         |
| 11  | `pain_point_solution` | ✅                         |
| 12  | `vs_comparator`       | ✅                         |
| 13  | `alternative_to`      | ✅                         |
| 14  | `top_x_in_y`          | ✅                         |
| 15  | `how_to_x_in_y`       | ✅                         |
| 16  | `best_for_x_in_y`     | ✅                         |
| 17  | `calculator_roi`      | ✅                         |
| 18  | `glossary_term`       | ✅                         |
| 19  | `what_is_x`           | ✅                         |
| 20  | `faq_geo`             | ✅                         |
| 21  | `case_study_local`    | ✅                         |

Total : **21 valeurs** (9 pré-existantes + 12 Phase 8) — conforme.

## Migration SQL — ALTER TYPE statements

Fichier : `axionia/prisma/migrations/20260523210942_v7_phase8_add_12_content_types/migration.sql`

- **Count : 12** `ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS` statements (lignes 10-21)
- Claimed 12 nouvelles → ✅ match exact
- Idempotence assurée via `IF NOT EXISTS`
- Statements séparés (non-transactionnels, conforme limitation Postgres 12+ enum DDL)

## Record<ContentType, X> exhaustive maps trouvées dans src/

| File:line                                                     | Type                                   | Keys count                         | Manquants                                            |
| ------------------------------------------------------------- | -------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `src/server/content-gen/generators/index.ts:40`               | `Record<ContentType, Generator>`       | **21** (9 legacy + 12 Phase 8)     | aucun ✅                                             |
| `src/server/content-gen/kb-feeder.ts:38`                      | `Record<ContentType, KbType>`          | **21** (9 legacy + 12 Phase 8)     | aucun ✅                                             |
| `src/server/queue/workers/content-orchestrator-worker.ts:56`  | `Partial<Record<ContentType, number>>` | N/A (Partial — pas d'exhaustivité) | N/A — exemption Partial                              |
| `src/server/queue/workers/content-orchestrator-worker.ts:249` | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |
| `src/server/queue/workers/content-orchestrator-worker.ts:295` | `as Record<ContentType, number>` cast  | N/A (cast dynamique JSON DB)       | runtime-dependent (campagnes existantes ⇒ keys ↓ OK) |
| `src/server/queue/workers/content-orchestrator-worker.ts:357` | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |
| `src/server/queue/workers/content-orchestrator-worker.ts:363` | `as Record<ContentType, number>` cast  | N/A (cast dynamique JSON DB)       | runtime-dependent                                    |
| `src/server/queue/workers/content-orchestrator-worker.ts:457` | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |
| `src/server/queue/workers/content-orchestrator-worker.ts:476` | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |
| `src/server/actions/content-gen/policies.ts:90`               | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |
| `src/server/content-gen/scheduler/anti-burst.ts:27`           | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |
| `src/server/content-gen/scheduler/anti-burst.ts:29`           | `Partial<Record<ContentType, number>>` | N/A (Partial)                      | N/A                                                  |

Grep `satisfies Record<ContentType` : **0 occurrence** dans `src/`.

## Verdict / écarts trouvés

- ✅ Schema Prisma déclare 21 valeurs (9 legacy + 12 Phase 8).
- ✅ Migration SQL ajoute exactement les 12 nouvelles valeurs en `ADD VALUE IF NOT EXISTS`.
- ✅ Les **2 seules maps non-Partial** (`REGISTRY` generators/index.ts:40 + `CONTENT_TYPE_TO_KB_TYPE` kb-feeder.ts:38) listent les 21 clés explicitement — pas de TS exhaustiveness error possible.
- ✅ Tous les autres usages sont `Partial<Record<ContentType, number>>` (volumes par type) ou casts JSON DB dynamiques — exemptés d'exhaustivité statique.
- ⚠️ **Note runtime non-bloquante** : les casts dynamiques `as Record<ContentType, number>` lignes 295/363 du worker orchestrator lisent `campaign.contentTypeWeights` / `typeDistribution` depuis la DB ; les campagnes créées avant Phase 8 n'auront pas de clés pour les 12 nouveaux types → traitées comme `undefined` / poids 0 (comportement attendu, pas un drift).
- ✅ Aucun écart entre schema.prisma et migration.sql.
- ✅ Aucune map exhaustive incomplète susceptible de générer `TS2741` / `TS2740` strict.

**Conclusion : cohérence totale schema ↔ migration ↔ maps TS.**
