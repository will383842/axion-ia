# Vérifications — feat/verif-prod-knowledge

- `pnpm exec vitest run tests/unit/ops/verif-prod-knowledge.spec.ts` : 1 fichier, 8 tests passés.
- `pnpm exec eslint` + `prettier --write` sur les 3 fichiers touchés : aucune erreur.
- `pnpm exec tsc --noEmit` : ~4 000 erreurs préexistantes (client Prisma non généré dans ce bac à sable) ; **aucune** dans les fichiers de la branche.
- Exécution du script contre la prod : 1 essai, `fetch failed` (réseau du bac à sable sans accès à axion-ia.com). Le contrôle réel reste à lancer depuis une machine qui joint la prod (2 fois maximum).
