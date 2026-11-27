# État : CI plus rapide, PR 1 et PR 2 du plan (`ci/rapide-pr1-pr2`)

**Rien n'est appliqué.** `.github/` est monté en lecture seule dans l'environnement de cette session
(`mount` : `/dev/mapper/cow-root … /axion-ia/.github type ext4 (ro,…)`). Toute écriture dans
`.github/workflows/ci.yml` échoue avec « Read-only file system ». Le verrou n'a pas été contourné.

La branche ne porte donc que ce fichier et `.pr/ci-rapide-pr1-pr2.md`. Aucun test, aucun `ci.yml` modifié.

## Ce qui reste à faire (plan `origin/plan/ci-rapide:.pr/plan-ci-rapide.md`)

### PR 1 (un commit)

- `ci.yml` : job `coupe-circuit` après `gate-a` (`needs: gate-a`, `if: failure() && (PR prête || merge_group)`,
  `permissions: actions: write` sur ce seul job, une seule commande `gh run cancel`). Paragraphe daté sous le
  commentaire du 2026-08-18 en tête de `jobs:`.
- `ci.yml`, `gate-a` : étape `actions/cache@v4` (`node_modules/.cache/eslint`, `node_modules/.cache/prettier`,
  `tsconfig.tsbuildinfo`, clé `gate-a-v1-<hash configs>-<sha>`, `if: github.event_name != 'schedule'`),
  placée avant `next typegen` ; ESLint et Prettier avec `--cache --cache-strategy content --cache-location …`.
- `ci.yml`, `gate-b` : déplacer « Libérer le disque — ATTENDRE la fin » après « Install Playwright browsers »,
  avant « Relocate .next to /mnt » ; mettre à jour le commentaire « ORDRE DES ÉTAPES ».
- Nouvelles gardes `tests/unit/ci/coupe-circuit-ne-rend-jamais-vert.spec.ts` et `gate-a-caches-surs.spec.ts`.
- `AGENTS.md` (section CI, 4 lignes) et `.pr/ci-coupe-circuit-et-gate-a-rapide.md`.

### PR 2 (un commit)

- `ci.yml`, `gate-b` : `actions/cache/restore@v4` sur `.next/cache/webpack` (après « Relocate .next to /mnt »,
  avant « Build »), `actions/cache/save@v4` après « Build » seulement si `schedule && matrix.tranche == 1` ;
  cache `~/.cache/ms-playwright` (clé `pw-<hash pnpm-lock.yaml>`).
- Nouvelle garde `tests/unit/ci/gate-b-cache-sur.spec.ts`.
- Mesure préalable (part « Compiled successfully in … » du build) : exige un run CI réel.

## Vérifications à lancer une fois `ci.yml` modifié

`pnpm vitest run tests/unit/ci src/server/ops/__tests__/disque-vps-aucune-purge-dangereuse.spec.ts`
