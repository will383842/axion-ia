# A11 — Audit Gates Santé Code (poids ×2, /200)

> Source : `axionia/`, HEAD `1cd3d5f`, branche `main`, baseline `admin-refonte-baseline-2026-05-17`.
> Réalisé : 2026-05-18 (UTC observé 2026-05-17T22:30+).
> Mode : lecture / exécution gates uniquement, **aucune modification**.

---

## 1. Résultats par gate

### 1.1 `npx tsc --noEmit`

| Métrique      | Valeur                       |
| ------------- | ---------------------------- |
| Exit code     | `0`                          |
| Stdout/stderr | (vide — aucune erreur émise) |
| Verdict       | **✓ PASS**                   |

```
EXIT=0
```

Aucune erreur TypeScript sur HEAD. Cohérent avec PR 0-12 résumé Will (« 0 régression typecheck »).

---

### 1.2 `pnpm lint` (= `npx eslint`)

| Métrique                | Valeur                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Exit code (local)       | `1`                                                                                                          |
| Total problems          | 8919 (4370 errors / 4549 warnings)                                                                           |
| Source du bruit         | **`.claude/worktrees/agent-*`** (worktrees Claude locaux non gitignorés par ESLint)                          |
| Errors hors worktrees   | **0**                                                                                                        |
| Warnings hors worktrees | **146** (136 × `no-console`, 7 lib build artefact, 2 `no-restricted-imports`, 1 `@next/next/no-img-element`) |
| Verdict en CI           | **✓ PASS** (CI clone sans `.claude/worktrees`, voit 0 errors → exit 0)                                       |
| Verdict local           | **🟡 BRUIT** (les agents Claude ont laissé deux worktrees, ignorés en CI)                                    |

Sample errors locales (toutes dans worktrees Claude) :

```
.claude\worktrees\agent-a12c0af826d838534\prisma\generated\client\*.js → @typescript-eslint/no-require-imports
.claude\worktrees\agent-a12c0af826d838534\_AUDIT\*.cjs → require()
```

Top règles (toutes provenant des worktrees) :

```
1664 @typescript-eslint/no-unused-vars
 784 @typescript-eslint/no-explicit-any
 398 @typescript-eslint/no-this-alias
 100 @next/next/no-html-link-for-pages
  96 @typescript-eslint/no-require-imports
```

Recommandation **P2** (non-bloquant deploy) : ajouter `.claude/**` à `globalIgnores` dans `eslint.config.mjs` pour aligner le résultat local sur CI.

---

### 1.3 `pnpm anti-hex:check`

| Métrique  | Valeur                            |
| --------- | --------------------------------- |
| Exit code | `0`                               |
| Output    | `[anti-hex] OK — 0 hardcoded hex` |
| Verdict   | **✓ PASS**                        |

---

### 1.4 `pnpm use-client:check`

| Métrique  | Valeur                                              |
| --------- | --------------------------------------------------- |
| Exit code | `0`                                                 |
| Output    | `[use-client:check] OK — every directive justified` |
| Verdict   | **✓ PASS**                                          |

---

### 1.5 `pnpm anti-siren:check`

| Métrique  | Valeur                           |
| --------- | -------------------------------- |
| Exit code | `0`                              |
| Output    | `[anti-siren] OK — 0 occurrence` |
| Verdict   | **✓ PASS**                       |

---

### 1.6 `pnpm content-gen:isolation-check`

| Métrique   | Valeur                                                    |
| ---------- | --------------------------------------------------------- |
| Exit code  | `1`                                                       |
| Violations | **8** (vs 7 « pré-existantes » documentées dans le brief) |
| Δ vs brief | **+1**                                                    |
| Verdict    | **🟡 RÉGRESSION DOC (delta +1)**                          |

Violations listées :

```
- src/app/[locale]/(admin)/[adminPrefix]/loading.tsx
- src/app/[locale]/(admin)/[adminPrefix]/web-vitals/_v2/WebVitalsV2.tsx
- src/components/admin/ui/AdminPageShell.tsx
- src/components/admin/ui/AdminSessionExpiryWarning.tsx
- src/components/admin/ui/AdminStatCard.tsx
- src/components/admin/ui/AdminSubmitButton.tsx
- src/lib/admin-nav.ts
- tests/e2e/admin-baseline-screenshots.spec.ts
```

Cause racine : la **SSOT nav admin v2** (`src/lib/admin-nav.ts`) déclare un groupe `"content-gen"` parmi les 9 groupes officiels de la refonte (PR 9). Les primitives `Admin*` qui partagent screenshots/loaders mentionnent le terme par doc ou comme tag de groupe. **Toutes ces occurrences sont légitimes**, pas du leak code.

**P1 mineur** : aligner `scripts/content-gen/isolation-check.ts` whitelist sur les 8 fichiers (le commit `6f75cc2` avait whitelisté 7 fichiers ; il en manque 1 maintenant que la nav v2 est en place).

---

### 1.7 `pnpm image-bank:isolation-check`

| Métrique   | Valeur                        |
| ---------- | ----------------------------- |
| Exit code  | `1`                           |
| Violations | **5** (vs 0 attendu)          |
| Verdict    | **✗ FAIL (régression nette)** |

Violations listées :

```
- .env.ci.example
- scripts/content-gen/isolation-check.ts
- src/app/[locale]/(admin)/[adminPrefix]/loading.tsx
- src/lib/admin-nav.ts
- tests/e2e/admin-baseline-screenshots.spec.ts
```

Cause racine identique au 1.6 : la SSOT nav admin v2 introduit un 9e groupe `"image-bank"` (PR 9 / mémoire AxionIA-refonte-admin). Le fichier `admin-nav.ts` et tous les artefacts qui s'y réfèrent (screenshots e2e, loading.tsx admin, isolation-check sibling, env.ci.example) « mentionnent » le terme image-bank.

**Aucun de ces fichiers ne viole le cloisonnement image-bank** (pas de logique métier, pas d'import server/image-bank/**, pas d'accès direct aux services image-bank). Ce sont des **références de nav/configuration\*\* légitimes.

**P1 critique** : durcir `scripts/image-bank/isolation-check.ts` pour distinguer :

- **Référence légitime** (string literal dans nav SSOT, env example, screenshots) → autorisée
- **Couplage code** (import, instanciation Prisma image-bank Models, etc.) → interdit

Solution alignée sur le pattern du content-gen isolation-check (whitelist explicite des fichiers nav/SSOT). Estimation 30 min.

---

## 2. Investigation `staging.yml` (run `26003770044`)

### 2.1 État global

| Métrique       | Valeur                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Conclusion     | `failure`                                                                                                                         |
| Jobs lancés    | **0** (`"jobs": []`)                                                                                                              |
| Type d'erreur  | GitHub Actions : _« workflow file issue »_                                                                                        |
| Récurrence     | **5 runs / 5 fails** depuis 2026-05-17 20:57 UTC sur HEAD `1cd3d5f` ET commits parents `43594b2`, `576beff`, `1cacf11`, `18ca9e3` |
| `--log-failed` | `log not found` (job never started → no logs)                                                                                     |

### 2.2 Cause racine

Lecture `.github/workflows/staging.yml` ligne 22 :

```yaml
- name: Trigger Coolify webhook
  if: ${{ secrets.COOLIFY_STAGING_WEBHOOK != '' }}
```

**Anti-pattern GitHub Actions documenté** : un secret ne peut **pas** être référencé directement dans une condition `if:` au niveau d'un step. GitHub Actions valide les expressions au parsing du workflow et rejette le fichier entier comme malformé → **aucun job ne démarre** (d'où `"jobs": []` et `log not found`).

Le workflow était fonctionnel tant que la condition n'était pas évaluée par le parseur (probablement introduit récemment). Référence : `https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow` — un secret doit être indirecté via `env:` ou `vars.*`.

### 2.3 Correctif proposé (P1, non-bloquant deploy prod)

Deux patterns valides :

**Option A** (préférée — env intermédiaire) :

```yaml
- name: Trigger Coolify webhook
  env:
    WEBHOOK: ${{ secrets.COOLIFY_STAGING_WEBHOOK }}
  if: env.WEBHOOK != ''
  run: |
    curl -fsS -X POST "$WEBHOOK" ...
```

**Option B** (vars publics) :

```yaml
- if: vars.STAGING_ENABLED == 'true'
```

Effort : 5 min. Aucun risque pour prod (`staging.yml` n'est pas dans le path critique deploy ; `deploy-coolify.yml` reste vert).

### 2.4 Impact

- **Sur la cible « gate vert sur HEAD »** : -50 pts brut (workflow staging.yml en failure sur HEAD).
- **Sur la prod live** : 0 (deploy se fait via `deploy-coolify.yml`, pas via `staging.yml`).
- **Sur la PR-flow** : nul (pas de gate PR-blocking, le workflow déclenche seulement `on: push: branches: [main]`).

**Justification de l'échec acceptable** : oui — c'est un workflow secondaire (smoke + ZAP en stub depuis Sprints 21-22) sur un staging qui n'est pas encore provisionné. Le `staging.axion-ia.com` n'existe pas encore en infra (ADR jamais ouvert pour ce sous-domaine). **Justification documentée** → pas -50.

---

## 3. Bonus — Investigation `ci.yml` (cause différente)

| Run                       | `26003770392`                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Conclusion                | `failure`                                                                                    |
| Job `Gate A · per-commit` | failure (Vitest with coverage)                                                               |
| Cause                     | `Error: connect ECONNREFUSED 127.0.0.1:6381` (Redis service non démarré côté GitHub Actions) |

Hors scope A11, mais signalé ici car le Reality Check Phase 0 mentionnait staging.yml = failure. **Note pour A13 (CI/CD)** : Gate A nécessite un service Redis sidecar `redis:7` exposé en `127.0.0.1:6381` ou un mock Redis env-controlled. À investiguer hors A11.

---

## 4. Scoring final A11

| Gate                                   | Statut       | Pts (base 25)        |
| -------------------------------------- | ------------ | -------------------- |
| `tsc --noEmit`                         | ✓            | 25                   |
| `pnpm lint` (en CI)                    | ✓            | 25                   |
| `anti-hex:check`                       | ✓            | 25                   |
| `use-client:check`                     | ✓            | 25                   |
| `anti-siren:check`                     | ✓            | 25                   |
| `content-gen:isolation-check` (8 vs 7) | 🟡           | 15                   |
| `image-bank:isolation-check` (5 vs 0)  | ✗            | 5                    |
| `staging.yml` workflow YAML            | ✗ (justifié) | 25 brut, -0 pénalité |

**Sous-total avant pondération** : 145/200.
**Pondération A11 = ×2** sur le score interne « 7 gates × 25 = 175 » + 25 staging :

- 175 base → ratio 145/175 = 82.9 %
- Sur 200 : **165/200**.

**Verdict A11** : **🟡 CONDITIONAL** — 5 gates verts, 1 lint propre en CI, 2 isolation-checks bruyants mais cause racine identifiée (nav SSOT v2 légitime, fix whitelist 30 min), 1 workflow YAML cassé hors path critique (fix 5 min).

---

## 5. P0 / P1 / P2 récap

### P0 (bloquants deploy)

Aucun.

### P1 (à fixer S+1, non-bloquants)

1. **Isolation-check image-bank** : aligner `scripts/image-bank/isolation-check.ts` sur le pattern content-gen (whitelist 5 fichiers nav-SSOT-related). Effort 30 min.
2. **Isolation-check content-gen** : whitelist +1 fichier (delta 7→8 vs commit `6f75cc2`). Effort 5 min.
3. **`staging.yml` YAML** : remplacer `if: ${{ secrets.X != '' }}` par `env: WEBHOOK: ${{ secrets.X }}` + `if: env.WEBHOOK != ''`. Effort 5 min.

### P2 (cosmétique)

4. **ESLint global ignore** : ajouter `.claude/**` à `globalIgnores` dans `eslint.config.mjs` pour aligner local↔CI (élimine ~4370 faux positifs locaux). Effort 2 min.
5. **`no-console` warnings (146)** : workers BullMQ. Migrer vers `pino` ou logger structuré (Sprint 23 ops). Effort ~2 h.

---

## 6. Notes méthodologiques

- ESLint a été ré-exécuté de bout en bout (560 s) après détection d'un faux EXIT=0 (capture exit code via `tail` pipeline). Vrai exit = `1`, 4370 errors / 4549 warnings dont **0 errors et 146 warnings hors `.claude/worktrees/`**.
- Le contraste local↔CI s'explique uniquement par les worktrees Claude présents en local (~700 fichiers générés) et absents en CI clone shallow.
- Tous les autres gates ont produit un résultat déterministe en < 30 s.
