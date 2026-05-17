# Phase 0 — Reality Check (autopilot verif-fix-deploy 2026-05-18)

> Source : `axionia/` sub-repo, branche `main`, HEAD `1cd3d5f`.
> Réalisé : 2026-05-17T22:24Z (UTC réel observé ; system date affiche 2026-05-18).
> Mode : autopilot end-to-end, autorisation Will explicite donnée.

---

## 1. État git

| Assertion                                         | Attendu                   | Observé                                    | OK  |
| ------------------------------------------------- | ------------------------- | ------------------------------------------ | --- |
| `git rev-parse HEAD`                              | `1cd3d5f`                 | `1cd3d5f5637905b0cc8edd48067cf0f9b7c4c668` | ✓   |
| Commits baseline..HEAD                            | ≥ 27                      | 28                                         | ✓   |
| Tags `admin-refonte-*`                            | ≥ 30                      | 31                                         | ✓   |
| `git rev-list --count origin/main..HEAD` (ahead)  | 0                         | 0                                          | ✓   |
| `git rev-list --count HEAD..origin/main` (behind) | 0                         | 0                                          | ✓   |
| Remote origin                                     | `will383842/axion-ia.git` | identique                                  | ✓   |

## 2. Working tree

```
?? .claude/worktrees/
?? _AUDIT/PROMPT-DEPLOY-RECOVERY-PERFECTION-2026-05-17.md
```

Les deux entrées sont **untracked attendues** :

- `.claude/worktrees/` (artefact local outils Claude).
- `PROMPT-DEPLOY-RECOVERY-PERFECTION-2026-05-17.md` (prompt précédent, non versionné).

Working tree côté tracked = **clean**. Aucun fichier modifié non commité non-attendu. ✓

## 3. Comptage routes admin + V2

| Métrique                                | Attendu   | Observé | OK  |
| --------------------------------------- | --------- | ------- | --- |
| `page.tsx` sous `[adminPrefix]`         | ≥ 116     | 116     | ✓   |
| Répertoires `_v2/` sous `[adminPrefix]` | indicatif | 101     | ✓   |
| Fichiers `*.tsx` dans `_v2/`            | indicatif | 97      | ✓   |

> ℹ️ Note : 101 dossiers `_v2/` vs 116 routes → certains `_v2/` sont des sous-dossiers de composants partagés, pas un mapping 1:1. À ré-évaluer en A1 (Pattern conformité).

## 4. Comptage primitives `src/components/admin/ui/**`

| Métrique                          | Attendu   | Observé | Delta | OK  |
| --------------------------------- | --------- | ------- | ----- | --- |
| Primitives (`*.tsx` sans `.test`) | 32        | **31**  | -1    | ⚠️  |
| Tests Vitest primitives           | indicatif | 7       | —     | ✓   |

**31 primitives listées** :

```
AdminAutosaveIndicator, AdminBadge, AdminBreadcrumbs, AdminBulkActions, AdminCard,
AdminConfirmDialog, AdminConflictDialog, AdminEmptyState, AdminErrorState,
AdminFilterChip, AdminFilterTabs, AdminFormDirtyGuard, AdminFormField,
AdminInlineEdit, AdminKeyboardHint, AdminLoadingState, AdminNotificationsDropdown,
AdminPageHeader, AdminPageShell, AdminPagination, AdminSessionExpiryWarning,
AdminShortcutListener, AdminSidebarNav, AdminStatCard, AdminSubmitButton,
AdminTable, AdminTabs, AdminToolbar, AdminTopbar, AdminUndoToast, AdminUserMenu
```

**🟡 Delta -1 vs claim VERDICT-FINAL.md à vérifier en Audit A1 / A9.**
Hypothèse : claim ancien comptait un sous-component (ex `AdminUserMenu` + `AdminUserMenuItem`) ou un primitive `index.ts` séparé.

## 5. Feature flag `isAdminV2Enabled`

`src/lib/feature-flags.ts` :

- ✅ Export `isAdminV2Enabled()` async (ligne 42).
- ✅ Cookie `admin_v2=1` override per-session (ligne 45).
- ✅ Env var `ADMIN_V2_ENABLED === "true"` (ligne 58).
- ✅ Default `false` (logique fallback).
- ✅ `isAdminV2EnabledFromEnv()` exporté séparément (ligne 57).

Conforme spec master prompt §3 + §2.

## 6. Pipeline déploiement

| Élément                                                                                                                   | État | Notes                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `.github/workflows/deploy-coolify.yml`                                                                                    | ✓    | Présent. Trigger `push: branches:[main]` + `paths-ignore`.           |
| `Dockerfile.coolify-pull`                                                                                                 | ✓    | Présent (un-liner GHCR pull).                                        |
| `paths-ignore` couvre `**.md`, `docs/**`, `_AUDIT/**`, `.claude/**`, `coolify-diagnose.yml`, `coolify-zombie-cleanup.yml` | ✓    | Bonne hygiène : commits docs-only ne déclenchent pas Build & Deploy. |
| Workflows zombie cleanup + diagnose                                                                                       | ✓    | `coolify-diagnose.yml` et `coolify-zombie-cleanup.yml` présents.     |

## 7. Workflows recent runs (Build & Deploy)

```
in_progress    43594b2 (PR 12 polish)        id=26003551440  (started 21:43:16Z, last update 22:20:44Z)
failure        576beff (PR 9 content 22 v2)  id=26003287480
cancelled      1cacf11 (PR 8 image-bank 15)  id=26002780898
failure        18ca9e3 (PR 11 systeme)       id=26002524510
failure        59edcb9 (PR 7 content-gen 48) id=26001143605
cancelled      11bab33 (fix docker revert)   id=26000619492
```

**🔴 Constat critique** : aucun Build & Deploy n'a réussi sur la série PR 6 → PR 12. **La prod tourne probablement sur une image plus ancienne** (avant PR 6 — soit la baseline 2026-05-17).

**Run PR 12 (`26003551440`) toujours `in_progress` à 22:24Z** : le job `Build & push image to GHCR` est à l'étape `Free disk space` depuis 22:20:46Z (durée step ~3min35). **Pas zombie**, actif récent, mais incertain s'il complétera correctement.

**HEAD `1cd3d5f` (closure docs)** n'a _PAS_ déclenché Build & Deploy (paths-ignore `_AUDIT/**` et `**.md` correctement). En revanche, deux autres workflows déclenchés sur HEAD ont échoué :

- **`26003770392 CI · Gates A + B`** → **`failure` sur Gate A · per-commit, step `Vitest (with coverage)`**.
  - Cause racine : `ERROR: Coverage for lines (24.43%) does not meet global threshold (26%)` + statements (24.43%/26%) + functions (31.71%/33%).
  - Cause : nouveaux fichiers `image-bank/services/**` et `queue/workers/**` à 0% coverage dilution la moyenne globale.
- **`26003770044 staging.yml`** → `failure` (détails à investiguer en A11).

## 8. Tests Vitest local (sanity check pré-Phase 1)

Pas exécuté localement Phase 0 (sera couvert par A10 + Phase 5/7). État CI confirme 945+ tests **passing** mais coverage threshold échoue → P0 connu.

## 9. Auth GitHub CLI

```
✓ Logged in to github.com account will383842 (keyring)
Token scopes: 'gist', 'read:org', 'repo'
```

Accès `gh` opérationnel. ✓

## 10. Findings P0 / P1 issus de Phase 0

### P0 — bloquants déploiement

- **FINDING-P0-PHASE0-01** : Coverage threshold échoue dans CI Gates A+B (statements 24.43/26, lines 24.43/26, functions 31.71/33).
  - Source : `gh run view 26003770392 --log-failed` (HEAD SHA).
  - Cause racine probable : nouveaux fichiers non testés (`src/server/image-bank/services/**`, `src/server/queue/workers/**`) dilution coverage.
  - Fix proposé Phase 4 : ajuster thresholds OU étendre `exclude` patterns `vitest.config.ts` lignes 30-49.
  - Effort estimé : 15-30 min.

- **FINDING-P0-PHASE0-02** : Pipeline `Build & Deploy` n'a pas eu de succès depuis PR 7 (5 deploys ratés/cancellés). Prod sur image ancienne.
  - Source : `gh api repos/will383842/axion-ia/actions/runs`.
  - Cause racine : à déterminer en Phase 9/10 (build PR 9 échoué après free disk space + extract metadata, possible OOM, GHCR rate limit, ou Docker buildx crash).
  - Fix proposé Phase 9/10 : laisser run PR 12 in_progress se terminer OU cancel et trigger fresh deploy après fixes Phase 4.

### P1 / 🟡

- **FINDING-P1-PHASE0-03** : Delta -1 primitive (31 vs claim 32).
  - À vérifier Audit A1/A9 (peut-être faux claim ou primitive sub-component).

- **FINDING-P1-PHASE0-04** : Staging workflow (`staging.yml`) en failure sur HEAD.
  - À investiguer Audit A11.

## 11. Décision Phase 0

✅ **AUCUN des 4 cas catastrophiques §28 atteint**.
✅ **Aucune assertion git critique en erreur**.
✅ **Working tree clean côté tracked, primitives 31/32 = écart mineur**.

→ **Continuer Phase 1 (12 audits parallèles) automatiquement**.

---

**Tag suggéré post-Phase 0** : pas nécessaire (rien commité). Le tag baseline `admin-refonte-baseline-2026-05-17` couvre déjà l'avant-fix.

**Heure fin Phase 0** : ~2026-05-17T22:28Z.
