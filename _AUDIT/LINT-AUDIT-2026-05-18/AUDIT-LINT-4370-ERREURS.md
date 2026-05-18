# Audit profond — 4370 erreurs ESLint

**Date** : 2026-05-18
**Commande** : `pnpm lint` (cwd = `axionia/`)
**Sortie** : `8958 problems (4370 errors, 4588 warnings)` — exit 1
**Verdict** : 🟢 **FAUX POSITIF TOTAL** — le code réel a **0 erreur**

---

## TL;DR

**100 % des 4370 erreurs viennent de `.claude/worktrees/**`\*\* (= 2 worktrees git zombies créés par Claude Code agents le 2026-05-17, jamais nettoyés, contenant chacun une copie complète du repo).

Le code applicatif (`src/`, `prisma/`, `scripts/`, `tests/`, configs root) a :

- **0 erreur**
- **93 warnings** (essentiellement `no-console` dans 10 workers BullMQ + 21 `react-hooks/incompatible-library`)

Aucune action sur le code n'est requise.

---

## 1. Distribution exacte des 4370 erreurs

| #   | Location                                   | Règle                                               | Count    |
| --- | ------------------------------------------ | --------------------------------------------------- | -------- |
| 1   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-unused-vars`                 | 1664     |
| 2   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-empty-object-type`           | 1300     |
| 3   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-explicit-any`                | 784      |
| 4   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-this-alias`                  | 398      |
| 5   | `.claude/worktrees/*/src/components/ui/**` | `@next/next/no-html-link-for-pages`                 | 100      |
| 6   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-require-imports`             | 64       |
| 7   | `.claude/worktrees/*/_AUDIT/**`            | `@typescript-eslint/no-require-imports`             | 32       |
| 8   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-unnecessary-type-constraint` | 12       |
| 9   | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-unsafe-function-type`        | 10       |
| 10  | `.claude/worktrees/*/prisma/generated/**`  | `@typescript-eslint/no-wrapper-object-types`        | 6        |
|     |                                            | **TOTAL**                                           | **4370** |

**Tous les buckets sont déjà censés être ignorés** dans `eslint.config.mjs` :

- `prisma/generated/**` → ligne 54
- `src/components/ui/**` → ligne 51
- `_AUDIT/**` → ligne 58

Mais les patterns ne matchent qu'au **top-level** (relatif au cwd), pas leurs copies dans `.claude/worktrees/*/`.

---

## 2. Cause racine — 3 facteurs cumulés

### Facteur 1 : 2 worktrees git zombies sous `.claude/worktrees/`

```
$ git worktree list
C:/.../axionia                                                09087f2 [main]
C:/.../axionia/.claude/worktrees/agent-a12c0af826d838534      59edcb9 [worktree-agent-a12c0af826d838534] locked
C:/.../axionia/.claude/worktrees/agent-ae17b3d52b6d24ddd      59edcb9 [worktree-agent-ae17b3d52b6d24ddd] locked
```

- Créés le **2026-05-17** par Claude Code agents (refonte admin PR 7)
- Branche : `worktree-agent-*` pointe sur `59edcb9` (= `feat(admin): pr 7 migration content-gen 48 routes v2 derriere flag`)
- **Lockfile** : `.git/worktrees/agent-*/locked` → `claude agent agent-* (pid 3892)` — le PID 3892 ne tourne plus
- Chaque worktree contient une copie complète du repo (~322 + ~315 fichiers lintés) + son propre `node_modules/`
- 2185 erreurs × 2 worktrees = **4370** (match exact)

### Facteur 2 : `.claude/` absent de `.gitignore` ET de `globalIgnores`

`.gitignore` (vérifié) n'a pas d'entrée pour `.claude/`.
`eslint.config.mjs` (`globalIgnores`) n'a pas non plus d'entrée pour `.claude/`.

Résultat : ESLint scanne tout `.claude/worktrees/*/` en récursif.

### Facteur 3 : Patterns `globalIgnores` non préfixés `**/`

```js
// eslint.config.mjs
globalIgnores([
  ".next/**",
  "out/**",
  // ...
  "src/components/ui/**", // ← matche src/components/ui/ uniquement, PAS .claude/worktrees/*/src/components/ui/
  "prisma/generated/**", // ← idem
  "_AUDIT/**", // ← idem
]);
```

En flat config ESLint, un pattern sans préfixe `**/` est ancré à la racine du cwd. Seul `node_modules/**` bénéficie d'un traitement spécial intégré (d'où l'absence d'erreurs depuis `.claude/worktrees/*/node_modules/`).

---

## 3. Verdict détaillé sur le **code réel**

### Erreurs (severity=2) : **0**

| Bucket       | Errors |              Files |
| ------------ | -----: | -----------------: |
| `src/**`     |      0 | 38 (warnings only) |
| `prisma/**`  |      0 |                  5 |
| `scripts/**` |      0 |                 14 |
| `tests/**`   |      0 |                  0 |
| Configs root |      0 |                  7 |

### Warnings (severity=1) : 93 dans le vrai code (les ~4495 autres sont dans les worktrees)

| Rule                                |    Count | Localisation                                             |
| ----------------------------------- | -------: | -------------------------------------------------------- |
| `no-console`                        |      ~73 | `src/server/queue/workers/**` (10 workers BullMQ)        |
| `react-hooks/incompatible-library`  |      ~21 | (warning issu de `eslint-plugin-react-hooks`)            |
| `@typescript-eslint/no-unused-vars` |      ~10 | divers                                                   |
| `@next/next/no-img-element`         |        3 | composants admin                                         |
| `no-restricted-imports`             | nombreux | module boundary lib/↔components/ (volontairement `warn`) |

Les `no-console` dans les workers sont **acceptables** (BullMQ workers stdout = log infra) mais à migrer vers un logger structuré (Sentry/pino) à terme.

---

## 4. Recommandations — 3 niveaux

### NIVEAU 1 — Fix immédiat dans `eslint.config.mjs` (30 sec, 0 risque)

Ajouter `.claude/**` aux `globalIgnores` :

```diff
   globalIgnores([
+    ".claude/**",
     ".next/**",
     "out/**",
     // ...
   ]);
```

Cela résout **100 %** des 4370 erreurs et tous les warnings parasites issus des worktrees.

### NIVEAU 2 — Hardening préventif (recommandé)

Préfixer les patterns avec `**/` pour qu'ils matchent aussi les worktrees futurs et les éventuels sous-modules :

```diff
   globalIgnores([
     ".claude/**",
-    ".next/**",
-    "out/**",
-    "build/**",
-    "next-env.d.ts",
-    "node_modules/**",
-    "playwright-report/**",
-    "test-results/**",
-    "coverage/**",
-    "lhci/**",
-    "src/components/ui/**",
-    "prisma/generated/**",
-    "_AUDIT/**",
+    "**/.next/**",
+    "**/out/**",
+    "**/build/**",
+    "**/next-env.d.ts",
+    "**/node_modules/**",
+    "**/playwright-report/**",
+    "**/test-results/**",
+    "**/coverage/**",
+    "**/lhci/**",
+    "**/src/components/ui/**",
+    "**/prisma/generated/**",
+    "**/_AUDIT/**",
   ]);
```

### NIVEAU 3 — Cleanup des worktrees zombies (à valider avec Will)

Action manuelle (destructive — créerait un commit perdu si le PID 3892 reprenait) :

```bash
# 1. Vérifier qu'aucun agent n'utilise réellement ces worktrees
ps aux | grep 3892

# 2. Force-remove
git worktree remove --force .claude/worktrees/agent-a12c0af826d838534
git worktree remove --force .claude/worktrees/agent-ae17b3d52b6d24ddd

# 3. Branches associées (déjà mergées via PR 7 : feat(admin))
git branch -D worktree-agent-a12c0af826d838534
git branch -D worktree-agent-ae17b3d52b6d24ddd
```

⚠️ Note : ces branches sont à `59edcb9` qui pointe sur du travail PR 7 admin. Avant suppression, vérifier que ce commit est bien sur `main` (`git branch --contains 59edcb9`).

### NIVEAU 4 — Optionnel : ajouter `.claude/` à `.gitignore`

```diff
 # next.js
 /.next/
 /out/
+
+# Claude Code agent worktrees (locaux, jamais committés)
+.claude/
```

---

## 5. Anti-régression

Après application du NIVEAU 1, relancer :

```bash
pnpm lint
```

Attendu : **`✖ ~93 problems (0 errors, 93 warnings)`** et exit 0.

Les 93 warnings restantes sont du vrai signal (console dans workers, restricted-imports volontairement `warn`) — à traiter dans un sprint qualité dédié, hors urgence.

---

## 6. Fichiers d'analyse

- `analyze-lint.cjs` — buckets par dossier + top 30 fichiers par erreurs
- `analyze-lint-rules-by-loc.cjs` — distribution règles × location (résultat ci-dessus tableau §1)
- `analyze-lint-scanned.cjs` — décompte fichiers scannés par bucket

Pour reproduire :

```bash
pnpm lint --format json > /tmp/lint-report.json
node _AUDIT/LINT-AUDIT-2026-05-18/analyze-lint.cjs
node _AUDIT/LINT-AUDIT-2026-05-18/analyze-lint-rules-by-loc.cjs
```
