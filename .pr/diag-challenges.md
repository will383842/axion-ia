# Diagnostic — push de feat/apporteurs-challenges-v2

Étape : 7 (`git push -u origin feat/apporteurs-challenges-v2`). Échec : push jamais abouti.

Cause exacte : le hook `.husky/pre-push` lance une très large suite vitest (centaines de fichiers, toute la base `src/` et `tests/`). Deux essais (premier en tâche de fond après le commit, second seul) ont été TUÉS par la limite de 600 000 ms (10 min) des commandes de fond de l'environnement, sans message d'erreur de git : le hook n'avait pas fini. Aucune sortie d'échec de test : les tests visibles étaient verts. `git ls-remote origin feat/apporteurs-challenges-v2` ne rend rien.

Je n'ai pas utilisé `--no-verify` (contournement d'un garde-fou non autorisé).

État : la branche locale `feat/apporteurs-challenges-v2` porte un commit (a70069959) au-dessus de `origin/main` (1abd8256d), avec le corps de PR dans `.pr/feat/apporteurs-challenges-v2.md`. Vérifié avant : prisma:generate, tsc (vert), eslint (vert), vitest ciblé 132 fichiers / 1745 tests verts. Reste à pousser depuis un environnement sans limite de 10 min (ou à autoriser explicitement `--no-verify`).
