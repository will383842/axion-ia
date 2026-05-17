# Journal de bord — Refonte admin mai 2026

> Format par entrée : `## YYYY-MM-DD HH:MM — <phase ou PR-équivalent>` + sections fixes (Contexte / Décisions / Commits / Gates / Verdict / Risques résiduels).

---

## 2026-05-17 — Pré-flight §3bis

### Contexte

- Repo cible : `https://github.com/will383842/axion-ia.git` (sous-dossier `axionia/` du workspace).
- Branche : `main` local (en sync avec `origin/main` au démarrage, working tree propre sauf 1 prompt deploy recovery untracked).
- PR #14 image-bank V1 : **MERGED** ✅ (Gate C Docker smoke avait fail mais non-bloquant à la merge). Voie libre pour démarrer la refonte sans risque de conflit sur `image-bank/`.
- Master prompt lu intégralement en chunks (1100+ lignes, 30k tokens).

### Décisions autonomes

1. **PR #14 mergée → aucun bypass image-bank nécessaire**. L'ordre PRs 0→14 du prompt master s'applique tel quel, image-bank peut être inclus dans les phases concernées.
2. **Baseline tag créé en LOCAL uniquement** (`admin-refonte-baseline-2026-05-17`), pas pushé (règle dure §1 du brief Will).
3. **Feature flag `ADMIN_V2_ENABLED`** : helper minimaliste dans `src/lib/feature-flags.ts`, lecture `process.env.ADMIN_V2_ENABLED === "true"` à chaque appel (pas de cache module-level — même pattern que `adminSegment()` dans `src/lib/admin-path.ts`, qui privilégie la testabilité et le hot-reload).
4. **Playwright @baseline screenshots** : spec créée (`tests/e2e/admin-baseline-screenshots.spec.ts`), 12 pages représentatives ciblées, tag `@baseline` pour exécution opt-in. **Exécution effective des screenshots reportée** : Playwright requiert un dev server live (`pnpm dev`) + auth bootstrappée. L'exécution sera tentée en Phase 0 sous webServer auto, sinon documentée comme dépendance humaine (Will lance `pnpm exec playwright test --grep "@baseline" --update-snapshots` une fois). Le **tag git `admin-refonte-baseline-2026-05-17` reste la référence canonique de rollback** indépendamment du statut des golden screenshots — `git diff baseline..HEAD` suffit pour audit visuel manuel.
5. **Override per-session du flag (cookie `admin_v2=1`)** : pattern documenté dans le helper mais pas implémenté avant la PR-équivalent 0 (besoin du middleware admin pour lire le cookie côté serveur). Ajouté à la TODO Phase 5.
6. **Pas d'env var Coolify poussée** : règle « 0 push » couvre aussi le Coolify API (qui modifie l'env distante prod). Toggle resterait à `false` (default) tant que la migration n'est pas livrée. STOP & ASK Will avant tout flip prod.

### Commits livrés (atomiques, sur `main` local)

- `e900bc4` — `docs(admin-refonte): scaffolding _AUDIT/ADMIN-REFONTE-2026-05-17/`
- `568d92e` — `feat(feature-flags): add ADMIN_V2_ENABLED toggle for admin refonte`
- `67c57df` — `test(e2e): admin baseline screenshots (@baseline gated, 12 pages)`

Tous gates pre-commit verts (lint-staged, anti-siren, anti-hex, use-client:check, typecheck `tsc --noEmit` 0 erreur). Prettier a légèrement reformaté `README.md` (blank lines après headings) et `admin-baseline-screenshots.spec.ts` (wrap long array item) — pas de changement sémantique.

### Tags locaux créés

- `admin-refonte-baseline-2026-05-17` (avant tout changement, ancre rollback canonique).

### Gates exécutés

- Aucun gate technique appliqué au pré-flight (scaffolding documentaire + helper trivial + test gated). Gates A complets entreront en jeu à partir de la PR-équivalent 0 (cf. §6.5 brief Will).
- Validation manuelle : feature flag isolée + spec Playwright gated → 0 impact runtime sur les pages prod (le helper n'est pas encore appelé, le test n'est pas couvert par les suites smoke par défaut).

### Verdict sous-agent (self-review B)

- Non applicable au pré-flight (pas de diff de code substantiel).
- À partir de la PR-équivalent 0, un sous-agent Explore indépendant relira chaque diff complet.

### Risques résiduels

- **P2** : si Will souhaite exécuter `pnpm exec playwright test --grep "@baseline" --update-snapshots` immédiatement, il faudra un dev server + DB seed admin. À tenter en Phase 0 quand le dev env sera vérifié.
- **P3** : pas de cookie override du flag tant que PR-équivalent 0 (middleware) pas livrée → tests en prod V2 reposent sur env var globale (= bascule binaire). Acceptable car aucune bascule prévue avant Phase 7.

---
