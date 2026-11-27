# CI plus rapide : PR 1 et PR 2 du plan

⚠️ **Cette branche n'applique encore aucun changement** : `.github/` était en lecture seule dans la session
qui l'a préparée. Voir `.pr/ci-rapide-pr1-pr2-etat.md` pour le détail de ce qui reste à faire.

## Gains attendus selon le plan (PR verte)

- ≈ 10 à 16 min-machine économisées sur ≈ 76 ; chemin critique ≈ 20 → ≈ 15 min.
- PR dont Gate A rougit : ≈ 50 min-machine rendues à la file sur 66 ; verdict en ≈ 3-4 min au lieu de 17-20.
- PR 1 : coupe-circuit, caches ESLint/Prettier/tsc (≈ 4 à 5 min-m), attente disque déplacée (≈ 2 à 3,6 min-m).
- PR 2 : cache webpack (≈ 4 à 8 min-m, à mesurer), caches Playwright (≈ 1).

La fusion n'a lieu que si le gain mesuré sur la vraie CI atteint au moins 10 %.
