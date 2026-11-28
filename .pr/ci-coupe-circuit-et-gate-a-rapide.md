# ci: coupe-circuit et caches sûrs de gate-a (PR 1 CI rapide)

Première des trois PR du plan `plan/ci-rapide` (`.pr/plan-ci-rapide.md`). Le goulot de la CI est la file : on réduit les minutes-machine par PR.

## Changements

- **Coupe-circuit** : nouveau job `coupe-circuit` (`needs: gate-a`, `failure()` sur PR prête ou `merge_group`, jamais en brouillon ni sur `schedule`). Il lance `gh run cancel` ; couverture et Gate B s'arrêtent, leurs verdicts (`always()`) rendent rouge. Il n'est pas exigé ; `permissions: actions: write` sur ce seul job. Contrepartie : sur ce cas seulement, les tests et l'E2E ne sont plus rendus dans la même passe que Gate A (paragraphe daté en tête de `jobs:`).
- **Gate A, caches** : `actions/cache@v4` sur ESLint, Prettier et `tsconfig.tsbuildinfo` ; clé = lockfile + configs + SHA ; `--cache-strategy content` ; le passage quotidien (`schedule`) tourne sans cache.
- **Gate B** : l'attente « Libérer le disque » passe après l'installation de Playwright, toujours avant `.next`, le build et le semis (protection ENOSPC inchangée).
- **Gardes** : `tests/unit/ci/coupe-circuit-ne-rend-jamais-vert.spec.ts`, `tests/unit/ci/gate-a-caches-surs.spec.ts`.
- **AGENTS.md** : 3 puces dans la section CI.

## Hors périmètre

Aucun build Docker, déploiement ni purge. Les PR 2 et 3 du plan restent à faire.

## À vérifier au premier run

Gain attendu de Gate A (ESLint, Prettier, tsc) lu sur le 2e run (1er run = cache froid). Le temps se lit sur plusieurs runs.
