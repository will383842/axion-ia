# A01 Phase 1 — Schema Prisma enums + CityGenerationOrder

## Statut : ✅ PROD

## Files claimed vs found

| Path                                                                                 | Claimed | Found on disk                                                                                                                           | Found in git history    |
| ------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `prisma/schema.prisma` (3 enums + 6 cols + 1 model + 7 index)                        | oui     | oui — `axionia/prisma/schema.prisma` lignes 2648-2672 (enums), 2977-2997 (cols CoverageCampaign), 3031-3051 (model CityGenerationOrder) | oui — commit `53a1a61b` |
| `prisma/migrations/20260523123842_add_city_generation_order_v7_phase1/migration.sql` | oui     | oui — 59 lignes, lu intégralement                                                                                                       | oui — commit `53a1a61b` |

Note de path : git suit les paths sans préfixe `axionia/` (repo Next.js démarre dans `axionia/`). Sur disque WSL via Windows : `C:\Users\willi\Documents\Projets\Axion-IA\axionia\prisma\...`.

## Tests

- Test files détectés (consumers Phase 1) :
  - `axionia/src/server/actions/content-gen/__tests__/cities-order.test.ts`
  - `axionia/src/server/queue/workers/__tests__/recurring-schedule.test.ts`
  - `axionia/src/server/queue/workers/__tests__/orchestrator-sequential.test.ts`
  - `axionia/src/server/queue/workers/__tests__/orchestrator-per-campaign.test.ts`
- Run vitest deferred to A20.

## Cross-checks

- Enums référencés par code applicatif : **oui** — 10 fichiers app utilisent `VilleScopeMode|MixMode|ExpansionPhase|CityGenerationOrder` (`expansion-state.ts`, `CampaignWizardV2.tsx`, `cities-order.ts`/`.test.ts`, `coverage-map.ts`, `cities-order/page.tsx`, `content-orchestrator-worker.ts`, 3 worker tests).
- Pas de leftover ancien enum : **oui** — `ExpansionMode` (5 fichiers templates.ts/TemplateForm.tsx/TemplatesNewV2.tsx/TemplatesEditV2.tsx/TemplateNewFormWrapper.tsx) est un enum DIFFÉRENT pré-existant (schema.prisma ligne 2583, déclaré avant Phase 1), pas un orphelin. Les enums Phase 1 (VilleScopeMode/MixMode/ExpansionPhase) sont câblés.
- Migration SQL cohérente avec schema.prisma : **oui** — 3 enums créés (lignes 8-14), 6 cols ALTER TABLE coverage_campaigns (lignes 17-22), table city_generation_order avec 10 cols (lignes 25-38), 7 CREATE INDEX (count vérifié = 7 : 6 sur city_generation_order + 1 `coverage_campaigns_expansion_phase_status_idx`).

## Verdict / écarts trouvés

**Écart de nomenclature dans le prompt vs réalité — NON BLOQUANT** :

Le prompt A01 annonce `3 enums (ExpansionMode / CityProcessingMode / CoverageStatus)`. C'est FAUX par rapport au commit `53a1a61b` réel. Les 3 enums ajoutés par Phase 1 sont :

- `VilleScopeMode` (global_queue, custom_subset) — schema.prisma:2648
- `MixMode` (percentage, manual) — schema.prisma:2656
- `ExpansionPhase` (phase_a, phase_b, phase_c, phase_d) — schema.prisma:2667

Les enums cités dans le prompt (ExpansionMode/CityProcessingMode/CoverageStatus) sont des enums **pré-existants** :

- `ExpansionMode` ligne 2583 (pré-Sprint v7, lié au domaine `templates`)
- `CoverageStatus` ligne 2624 (pré-Sprint v7)
- `CityProcessingMode` ligne 2638 (Sprint Campaign Controls 2026-05-22, schema.prisma:2970 sur CoverageCampaign)

Cet écart de prompt est probablement une confusion mémoire. Le commit message `53a1a61b` est cohérent avec la réalité du diff. La mémoire `axionia_sprint_v7_phases_1_2_3_livre_2026-05-23.md` confirme `3 enums + 6 cols coverage_campaigns + table city_generation_order + 7 index` sans nommer les enums (compatible avec les 2 jeux).

**Conformité au claim de scope (chiffrée)** :

- ✅ 3 enums créés (migration:8-14)
- ✅ 6 colonnes AJOUTÉES sur `coverage_campaigns` (migration:17-22 : content_type_weights, custom_ville_slugs, daily_articles, expansion_phase, mix_mode, ville_scope_mode)
- ✅ Table `city_generation_order` créée (migration:25-38)
- ✅ 7 index créés au total (1 UNIQUE rank + 5 INDEX sur city_generation_order ligne 44-56 + 1 INDEX coverage_campaigns ligne 59)
- ✅ Migration v7-only isolée (59 lignes, pas de DROP/RENAME drift historique — conforme décision Will Option A documentée dans commit message)
- ✅ Aucun consumer orphelin : les 3 nouveaux enums + model sont wired dans 10 fichiers app

**Conclusion** : la Phase 1 schema Prisma est LIVRÉE et CONFORME aux chiffres annoncés (3/6/1/7). L'écart sur les noms d'enums est une erreur du prompt A01, pas un défaut du code.
