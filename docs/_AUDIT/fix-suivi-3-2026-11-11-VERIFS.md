# Vérifications — fix/suivi-3-2026-11-11

Base : `origin/fix/reserves-relectures-2-2026-11-11` (PR #1947 NON fusionnée au 11/11 : `git log origin/main` ne la contient pas). Rebaser sur main une fois #1947 fusionnée.

- Tâche 1 : `invalidateStaleCache` purge `< v` et la plage décalée `[DECALAGE, v + DECALAGE)`, requête paramétrée. La table `chat_semantic_cache` ne contient que question/réponse/sources/embedding/version/hits : cache technique, purge sans conséquence sur des données de clients.
- Tâche 2 : `CONTENT_FIDELITY_CHECK` absent de `src/env.ts` -> RIEN fait (routine X-6a).
- Tâche 3 : section « Etat au 11/11/2026 » ajoutée à `docs/knowledge/INTEGRATION-PACK-JOURNEE-IA.md`.

## Commandes
- `pnpm install --frozen-lockfile --ignore-scripts` : OK
- `pnpm exec vitest run src/server/chatbot/semantic-cache` : 11/11 passent (dont 2 nouveaux : éteint, allumé)
- `pnpm exec tsc --noEmit` : 4035 erreurs globales (client Prisma non généré, `--ignore-scripts`), 0 dans les fichiers touchés
- `pnpm exec eslint` (2 fichiers TS) : 0 erreur ; le .md est ignoré par la config
- `pnpm exec prettier --check` : OK
