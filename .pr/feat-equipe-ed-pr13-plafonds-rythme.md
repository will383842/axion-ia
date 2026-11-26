# Plafonds et rythme de l'équipe éditoriale (PR 13)

## But

Poser les plafonds de coût par défaut et le rythme quotidien de l'équipe éditoriale, derrière `CONTENT_EQUIPE_EDITORIALE` (éteint par défaut ; seule la valeur exacte `true` l'allume).

## Fichiers

- `src/server/content-gen/providers/blog-claude-plafonds.ts` : défauts 10 $/jour et 200 $/mois (`lirePlafondsBlogEffectifs`), contrôle `plafondsCoherents` (jour ≤ mois). Bornes de garde 20 et 300 inchangées.
- `src/server/content-gen/scheduler/anti-burst.ts` : clés `equipe_articles_max_jour` (3) et `equipe_maj_max_jour` (1) en lecture tolérante (`resoudreRythmeEquipe`), et `decisionRythmeEquipe` (refus au-delà de 3 nouveaux articles / 1 mise à jour par jour, cohérence jour ≤ mois).
- Tests : `scheduler/__tests__/anti-burst.spec.ts`, `providers/__tests__/blog-claude-plafonds.spec.ts`.

## Tests

Refus au-delà de 3 articles/jour, mise à jour limitée à 1, cohérence jour ≤ mois, interrupteur éteint = autorisé comme avant, lecture tolérante des clés absentes ou aberrantes. Specs passées ; eslint et tsc ciblés propres. `pnpm typecheck` complet : abandon mémoire (core dump, exit 134) dans cet environnement, même avec 6 Go de tas ; à confirmer par la CI.

## Risques

- Aucune migration, aucun changement de `prisma/**`, aucun frontend.
- Fonctions pures, **pas encore branchées** sur l'orchestrateur : il n'existe pas aujourd'hui de compteur « mises à jour du jour » distinct des nouveaux articles, et le brancher sans lui aurait changé le comportement. Le branchement est à faire quand ce compteur existera.
- Les défauts 10/200 ne sont lus que par la nouvelle fonction ; `blog-claude.ts` et l'écran d'administration ne sont pas modifiés.
