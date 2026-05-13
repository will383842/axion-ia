# SPRINT-4-REPORT — Knowledge Base 2026 — Phase B autopilot

> Date : 2026-05-13 → 2026-05-14 (overnight)
> Branche : `feature/kb-foundations`
> Commits livrés : 2 (`29822d4` step 1 + `099b1cf` step 2)
> Statut : **TERMINÉ** — workflow + versionning + relations livrés

---

## 1. Sprint KB-4 — Workflow + versionning + relations

### Step 1 — State machine + snapshot (`29822d4`)

**Livrables** :

- `src/lib/knowledge/state-machine.ts` (pure, 17 transitions, 4 niveaux rôles `OWNER/EDITOR/REVIEWER/SYSTEM`).
- `src/lib/knowledge/state-machine.test.ts` (23 tests Vitest verts).
- `src/lib/knowledge/snapshot.ts` (helper `makeEntrySnapshot` format `v1` figé).

### Step 2 — 11 server actions transition (`099b1cf`)

**Server actions** :

- `_transition.ts` : helper générique (validate state machine + snapshot version + update + audit + revalidate, transaction atomique).
- `submit-for-review.ts` : draft → review (EDITOR+).
- `approve.ts` : review → approved (REVIEWER+ ≠ author) + `rejectReviewAction` (review → draft).
- `publish.ts` : approved → published (publishedAt=now, EDITOR+).
- `schedule-publish.ts` : approved → scheduled (scheduledFor>now).
- `unpublish.ts` : published → archived (OWNER).
- `archive.ts` : any → archived (OWNER, state machine valide).
- `restore.ts` : archived → draft OU deprecated → published (OWNER).
- `rollback-version.ts` : v_n+1 = copie de v_n-K (append-only, jamais DELETE).
- `add-relation.ts` : graphe typé entry-to-entry + cycle detection BFS bornée 100 pour DAG kinds (replaces/depends_on/supersedes/extends).
- `assign-reviewer.ts` : upsert KnowledgeReviewerAssignment manuel (round-robin auto Sprint KB-17), refus self-review.

Barrel `src/lib/knowledge/index.ts` étendu (state-machine + snapshot exports).

---

## 2. Volumes

| Métrique             | Valeur                       |
| -------------------- | ---------------------------- |
| Commits              | 2 (`29822d4`, `099b1cf`)     |
| Fichiers créés       | 14 (3 lib + 11 actions)      |
| Fichiers modifiés    | 1 (`index.ts` barrel)        |
| Lignes TS ajoutées   | ~1 100                       |
| Tests Vitest ajoutés | 22 (state-machine)           |
| Tests totaux verts   | 441 / 441 (+22 vs précédent) |

---

## 3. Doctrine respectée

- ✅ **KbStatus dédié** (cf. ADR 0021 draft).
- ✅ **Versions immutables append-only** (jamais DELETE de KnowledgeVersion).
- ✅ **Audit log ActivityLog réutilisé** (events `kb.submitted_for_review`, `kb.approved`, `kb.published`, `kb.unpublished`, `kb.archived`, `kb.restored`, `kb.scheduled`, `kb.updated`).
- ✅ **Cycle detection** BFS bornée 100 nœuds pour DAG kinds.
- ✅ **Anti auto-approve** : `review → approved` gate state machine si reviewer = author.
- ✅ **Permissions** OWNER (archive/unpublish/restore/rollback) vs EDITOR (submit/publish/schedule/assign).
- ✅ **Snapshot v1 figé** : format stable, évolutions futures incrémentent.
- ✅ **revalidatePath** systématique sur transitions impactant le public.

---

## 4. Gates passées

- ✅ `pnpm typecheck` OK
- ✅ `pnpm test` 441/441 verts
- ✅ `pnpm lint` OK (0 errors, 43 warnings pré-existants)

---

## 5. Hors-scope KB-4 V1 (différé)

- **UI admin** pour déclencher publish/archive/restore depuis `[id]/page.tsx` → Sprint KB-4.1 ou Sprint UI dédié.
- **Reviewer notifications** email + Telegram redacté (ADR 0010) → Sprint KB-17.
- **Cron BullMQ** `kb-publish-scheduled` pour transition system scheduled → published → Sprint KB-17.
- **Round-robin auto** des reviewers par domain → Sprint KB-17.
- **Side-channel review** pour version majeure d'une entrée déjà publiée → Sprint KB-17.
- **Tests intégration DB** (workflow-states, versions, relations) → Sprint KB-20 ou hors-scope.

---

## 6. Incident notable cette session

**Incident** : pendant Sprint KB-4 step 2, le worktree partagé entre conversations Claude a fait basculer HEAD vers `main` (nouveau commit `18c95f2` par l'autre session). Mes 11 fichiers KB-4 working tree ont disparu (jamais commités, donc perdus).

**Récupération** : depuis le contexte du Write précédent, j'ai pu re-Writer les 11 fichiers à l'identique. Commit immédiat après création de chaque batch pour limiter la perte future.

**Recommandation forte à Will** : **isoler chaque conversation Claude dans un git worktree dédié** via `git worktree add ../axionia-kb feature/kb-foundations`. Sans cela, les sessions parallèles se marchent dessus.

---

## 7. État final branches

- `main` : intacte (contient les commits de l'autre conversation `18c95f2`, `0045424`, `d9436e5`, `9e1f11e`, `bd961c1`).
- `feature/kb-foundations` HEAD = `099b1cf` (KB-1 + KB-2 + KB-3 + polish + KB-4 step 1 + KB-4 step 2 + ce rapport).
- Aucun push effectué.

---

## 8. Prochaines étapes possibles

1. **`GO BUILD KB-SPRINT-5`** — migration legacy CaseStudy + FAQ + HelpArticle + Glossaire hardcode + Guide-IA hardcode (5 dj selon plan).
2. **Sprint KB-4.1 UI** — boutons publish/archive/etc. dans `ConnaissancesEditForm.tsx` (1 dj non-prévu plan).
3. **PR feature/kb-foundations → main** — merge si Will valide les 5 sprints livrés.
4. **Tests intégration DB** — workflow-states, versions, relations (1-2 dj, peut être groupé avec KB-20).

---

**STOP autopilot** — Will reprend la main pour orienter la suite.
