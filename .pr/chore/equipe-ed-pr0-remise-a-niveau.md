# Équipe éditoriale, PR 0 : remise à niveau de la génération de contenu

## But

Sans effet fonctionnel :

1. Tarif de lecture du cache de `claude-sonnet-5-5` : 0,10 $ par million de jetons (était 0,20).
2. README de `content-gen` et en-tête de `reviewer/llm-judge.ts` alignés sur le code réel. Constat : par défaut, écriture et relecture passent par GPT-4o. Voie Claude (si `CONTENT_GEN_BLOG_CLAUDE="true"` et type autorisé) : écriture Claude Sonnet 5.5, relecture Claude Opus 5.5. Corrigé aussi : tableau des coûts (Sonnet 5.5) et seuils du juge (6.0 / 8.5) dans l'en-tête.

## Fichiers

- `src/server/content-gen/providers/anthropic.ts` (tarif)
- `providers/__tests__/anthropic-pricing-5-5.spec.ts`, `anthropic-cache-prompt.spec.ts` (specs de coût)
- `src/server/content-gen/README.md`, `reviewer/llm-judge.ts` (documentation / commentaires)

## Tests

Specs de coût et ensemble de `src/server/content-gen` : passent (199 fichiers). Prettier et eslint passent. Typecheck (`tsc --noEmit`, tas Node porté à 10 Go car OOM au défaut) : passe.

## Risques

Seul le coût comptabilisé des lectures de cache Sonnet 5.5 baisse de moitié (plafonds un peu moins consommés). ⚠️ À confirmer : 0,10 $/M vaut 0,05 × l'entrée Sonnet 5.5 (2 $/M) ; la règle habituelle 0,1 × l'entrée donnerait 0,20 $/M. Valeur imposée par la consigne, non vérifiée sur la grille officielle. Aucun interrupteur : aucun changement de comportement. Pas de changement de `pnpm-lock.yaml`.

VERDICT OPUS : BON
