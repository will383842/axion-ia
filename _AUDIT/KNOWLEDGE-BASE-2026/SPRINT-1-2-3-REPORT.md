# SPRINT-1-2-3-REPORT — Knowledge Base 2026 — Phase B autopilot

> Date : 2026-05-13
> Branche : `feature/kb-foundations`
> Commits livrés : 3 (KB-1 `5119889` + KB-2 `0eede3e` + KB-3 `1f489a0`)
> Statut : **TERMINÉ — STOP autopilot** (consigne user respectée : arrêt après KB-3)

---

## 1. Sprints livrés

### Sprint KB-1 — Schéma Prisma + SSOT TypeScript (commit `5119889`)

**Schema Prisma** : 11 enums (`KbType` 16 valeurs, `KbDomain` 10, `KbAudience` 4, `KbConfidentiality` 4, `KbStatus` 7, `KbPipelineStage` 9, `KbRelationKind` 7, `KbFeedbackVote`, `KbImportSource` 6, `KbImportStatus` 5, `KbReviewerAssignmentStatus` 4) + 11 modèles (`KnowledgeEntry` polymorphique racine + `KnowledgeTranslation` triple-source + `KnowledgeVersion` immutable + `KnowledgeTag` + `KnowledgeTagOnEntry` M2M + `KnowledgeRelation` typed graph + `KnowledgeFeedback` rate-limited + `KnowledgeAsset` + `KnowledgeSlugHistory` + `KnowledgeBookmark` + `KnowledgeImportBatch` + `KnowledgeReviewerAssignment`).

**Migration** : `prisma/migrations/20260513221900_kb_01_init_schema/migration.sql` (432 lignes) — appliquée locale OK.

**SSOT** : `src/content/knowledge-base.ts` (barrel) + `src/content/knowledge/{types,domains,audiences,confidentialities,statuses,relation-kinds,routes,quality-thresholds,review-windows}.ts`.

**Helpers Prisma** : `src/lib/knowledge/prisma-helpers.ts` (PUBLIC_VISIBLE_WHERE, CLIENT_VISIBLE_WHERE, buildListWhere, isFrontVisible, COMMON_ENTRY_INCLUDE, DETAILED_ENTRY_INCLUDE).

**Tests** : 40 Vitest verts (`src/lib/knowledge/prisma-helpers.test.ts`).

### Sprint KB-2 — Migration legacy Article → KnowledgeEntry expand-only (commit `0eede3e`)

**Mode** : strict EXPAND-ONLY (décision Will 2026-05-13). Aucun DROP ni ALTER sur les tables legacy `articles`/`article_translations`/`article_tags`.

**Helpers de mapping** : `src/lib/knowledge/legacy-import-mapping.ts` :

- `mapLegacyStatusToKb` PublishStatus → KbStatus.
- `mapArticleToEntryInput` Article → KnowledgeEntry shape.
- `mapTranslationToKnowledgeTranslationInput` ArticleTranslation → triple-source body (Sprint 24 C4 pattern).

**Script CLI** : `scripts/import-knowledge-from-legacy.ts` (--dry-run default, --commit, --batch-size). Smoke-test : 5 articles seed détectés, 5 would-create.

**Tests** : 14 Vitest verts (`src/lib/knowledge/legacy-import-mapping.test.ts`).

### Sprint KB-3 — Admin core CRUD `/connaissances/` + server actions (commit `1f489a0`)

**Server actions** (7, pattern 1 fichier par action sous `src/server/actions/knowledge/`) :

- `create-entry.ts` (Zod, RBAC editor+, audit `kb.created`, unicité slug, revalidatePath).
- `update-entry.ts` (PATCH-style, slug history auto si rename, transaction atomique).
- `save-draft.ts` (autosave throttled translation, upsert entryId×locale).
- `delete-entry.ts` (soft-delete `deletedAt`, super_admin only).
- `list-entries.ts` (liste admin filtrable type/audience/status/domain/search).
- `get-entry.ts` (lecture détail DETAILED_ENTRY_INCLUDE).
- Helpers `_guards.ts` (RBAC), `_audit.ts` (ActivityLog wrapper), `_revalidate.ts`, `_zod-schemas.ts`.

**Pages admin FR cohérentes** sous `/fr/<adminPrefix>/connaissances/` :

- `page.tsx` (liste filtrable 5 facettes + pagination).
- `nouvelle/page.tsx` + `ConnaissancesNouvelleForm` (création + Tiptap shared).
- `[id]/page.tsx` + `ConnaissancesEditForm` (édition 3 forms : meta + body FR + zone danger).

**Tests** : 17 Vitest Zod (`_zod-schemas.test.ts`).

---

## 2. Volumes

| Métrique                          | Valeur                                         |
| --------------------------------- | ---------------------------------------------- |
| Commits livrés                    | 3 (`5119889`, `0eede3e`, `1f489a0`)            |
| Fichiers créés                    | 38                                             |
| Fichiers modifiés (schema.prisma) | 1                                              |
| Migrations Prisma                 | 1 (`20260513221900_kb_01_init_schema`)         |
| Lignes de code TS ajoutées        | ~3 200                                         |
| Lignes SQL migration              | 432                                            |
| Tests Vitest ajoutés              | 71 (40 KB-1 + 14 KB-2 + 17 KB-3)               |
| Tests Vitest totaux (verts)       | 419 / 419                                      |
| Modèles Prisma ajoutés            | 11 (+ 0 V1.5 différé)                          |
| Enums Prisma ajoutés              | 11                                             |
| Server actions créées             | 7 + 4 helpers                                  |
| Pages admin créées                | 5 (page + nouvelle + [id] + 2 form components) |

---

## 3. Gates respectées par sprint

- ✅ `pnpm prisma validate` OK
- ✅ `pnpm prisma migrate deploy` OK locale (DB axion_ia_dev)
- ✅ `pnpm prisma generate` OK (client TS régénéré)
- ✅ `pnpm typecheck` OK
- ✅ `pnpm lint` OK (0 errors, warnings pré-existants seuls)
- ✅ `pnpm test` 419/419 verts
- ✅ `pnpm i18n:check` OK (224 keys in sync)
- ✅ Commits atomiques par sprint, branche feature seulement

---

## 4. Décisions Will appliquées

| Q                                | Décision                                           | Application                     |
| -------------------------------- | -------------------------------------------------- | ------------------------------- |
| Q1 — Unification vs cohabitation | **A** : unification `KnowledgeEntry` polymorphique | Schema KB-1, 16 types via enum  |
| Q2 — Nom hub public              | `/fr/ressources/` + `/en/resources/`               | SSOT `routes.ts` `KB_HUB_ROUTE` |
| Q3 — Glossaire/Guide-IA hardcode | **A** : migrer en DB dès KB-5                      | Reporté KB-5 (selon plan)       |
| Q4 — Volume Coolify              | **B/C** : reporté KB-11                            | Pas bloquant autopilot          |
| Q5 — WIP booking                 | Géré en parallèle par autre conversation           | Working tree propre             |

---

## 5. Doctrine respectée

- ✅ **Code = SSOT** : schema.prisma + src/content/knowledge/\* sont source unique.
- ✅ **Zero-hardcode** : aucune string magique dans les composants. Tous enums via SSOT.
- ✅ **Naming Axion-IA partout** : identifiers camelCase, libellés FR.
- ✅ **KbStatus dédié** (vs étendre `PublishStatus` global) — ADR draft proposé.
- ✅ **Admin FR cohérent** (`/connaissances/`) — contraste avec legacy mixte EN.
- ✅ **Triple-source body** (html + json + text) aligné Sprint 24 C4 pattern.
- ✅ **RBAC** 4 rôles aligné `AdminRole` enum existant.
- ✅ **Audit log** via `ActivityLog` existant (pas nouvelle table).
- ✅ **i18n** : namespacer dans mono-fichier `fr.json`/`en.json` (pas multi-fichiers).
- ✅ **Tiptap** : réutilise `TiptapEditor.tsx` shared (pas de duplication).

---

## 6. Hors-scope KB-3 V1 (différé)

- **Workflow états** explicites (submit/publish/archive/restore) → Sprint KB-4.
- **Versionning immutable** `KnowledgeVersion` rows snapshots → Sprint KB-4.
- **Relations** entry-to-entry (graphe typé) → Sprint KB-4.
- **Autosave réelle** debounce client 2 s → Sprint KB-3.5 ou KB-16.
- **Tiptap extensions** custom (Image/Link/SlashMenu/Placeholder) → Sprint KB-16.
- **Templates Tiptap** par type → Sprint KB-16.
- **E2E Playwright** `creation-publication.spec.ts` → Sprint KB-20.
- **Migration legacy autres types** (CaseStudy/FAQ/HelpArticle) → Sprint KB-5.
- **Glossaire/Guide-IA hardcode** → Sprint KB-5.

---

## 7. Incidents et corrections en cours de session

### Incident 1 — Lint-staged backup stash perd des fichiers

**Symptôme** : pendant le commit KB-1, `_guards.ts` et `_audit.ts` ont disparu silencieusement. Le `git stash --keep-index` / `git stash pop` de lint-staged a écrasé des fichiers neufs.

**Correction** : fichiers recréés manuellement avant commit KB-3.

**Suivi** : à investiguer hors scope KB. Possible workaround = configurer husky pour ignorer les fichiers untracked dans le stash.

### Incident 2 — Branche HEAD basculée vers main sans `git checkout`

**Symptôme** : pendant le commit KB-2, HEAD a basculé de `feature/kb-foundations` vers `main`. Le commit KB-2 (`9e1f11e`) a été créé sur `main` au lieu de la branche feature.

**Correction** : cherry-pick `9e1f11e` sur `feature/kb-foundations` (devenu `0eede3e`). Reset `main --hard bd961c1` après autorisation explicite Will.

**Cause probable** : worktree partagé entre 2 conversations Claude actives sur le même repo (confirmé par l'autre conversation).

**Suivi** : à investiguer hors scope KB. **Recommandation hors-scope** : isoler chaque conversation Claude dans un worktree dédié (`git worktree add`) pour éviter les races.

### Incident 3 — Conversation Claude parallèle sur main

**Symptôme** : 2 commits inattendus apparus sur main pendant l'autopilot :

- `d9436e5` — fix maintenance/layout.tsx (prod build webpack strict).
- `0045424` — fix tsconfig.json (exclude KB legacy script).

**Diagnostic** : autre session Claude Code travaillant en parallèle sur le même repo.

**Correction** : aucune (commits légitimes, à préserver). Plan D appliqué = `git stash --include-untracked` pour migrer KB-3 untracked de main vers feature/kb-foundations sans toucher main.

**Recommandation Will** : coordonner les sessions Claude futures (1 seule à la fois par repo, ou worktree dédié).

---

## 8. STOP autopilot — Phase B fini

**Conformément à la consigne user** : _« ARRÊT après KB-3 même si tu pourrais continuer. »_

**État final** :

- `feature/kb-foundations` HEAD = `1f489a0` (KB-1 + KB-2 + KB-3 livrés).
- `main` HEAD = `0045424` (intact, contient les commits de l'autre conversation).
- Working tree propre.
- Aucun push effectué (Will pushera ou mergera lui-même).

**Prochaine étape attendue** (Will) :

1. Tests UX manuels sur la branche feature (admin `/connaissances/`).
2. PR `feature/kb-foundations` → `main` quand prêt.
3. `GO BUILD KB-SPRINT-4` pour workflow états + versionning + relations.

---

## 9. Commandes utiles pour Will

```bash
# Vérifier la branche feature
git checkout feature/kb-foundations
git log --oneline -3
# Doit afficher : 1f489a0 KB-3, 0eede3e KB-2, 5119889 KB-1

# Tester en local
pnpm prisma generate
pnpm typecheck
pnpm test
pnpm lint

# Smoke test import legacy (dry-run safe)
pnpm tsx scripts/import-knowledge-from-legacy.ts --dry-run

# Lancer dev pour tester l'admin
pnpm db:up
pnpm dev
# → http://localhost:3000/fr/<adminPrefix>/connaissances

# Quand prêt : PR
gh pr create --base main --head feature/kb-foundations \
  --title "feat(kb): foundations KB-1+KB-2+KB-3 (schema + SSOT + admin CRUD)"
```
