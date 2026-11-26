# Équipe éditoriale, PR 6 : rédacteur « pas de chiffre sans preuve »

**Dépend de #2363** (PR 5, plan bloquant : apporte `equipe/plan.ts`). Cette branche part de `feat/equipe-ed-pr5-plan-bloquant` ; à rebaser sur `main` après la fusion de #2363.

## But

Quand `CONTENT_EQUIPE_EDITORIALE` vaut exactement `true`, la consigne d'écriture de `blog_from_title` reçoit le dossier de preuves (phase A du vérificateur, PR #2352) et impose : aucun chiffre sans preuve du dossier ; sans preuve, on écrit sans chiffre ; le prix passe uniquement par le jeton `{{price:journee-ia|flat}}` (`brand/consigne-prix.ts`). Interrupteur éteint : prompt strictement identique à avant.

## Fichiers

- `src/server/content-gen/equipe/redaction.ts` (nouveau, module pur) : `consigneRedactionEquipe`, `chiffresHorsDossier` (pourcentages, montants, années hors année de publication, effectifs, durées ; ignore jetons de prix et numérotation des titres), `controlerRedaction` (chiffres + h2 manquants + plancher 850 mots + 20 mots/phrase + tutoiement, en réutilisant `compterH2`, `PLANCHER_MOTS_RELECTURE`, `computeReadabilityFr`, `detecterTutoiement`).
- `src/server/content-gen/equipe/redaction.test.ts` (nouveau).
- `src/server/content-gen/generators/blog-from-title.ts` : ajout de la consigne dans l'expansion (vide si éteint).
- `src/server/content-gen/generators/types.ts` : champ facultatif `dossierPreuves`.
- `src/server/queue/workers/content-gen-worker.ts` : transmet `dossierPreuves` au générateur quand il existe. Aucun changement de charge BullMQ.
- `src/server/content-gen/generators/__tests__/blog-from-title-redaction-equipe.spec.ts` (nouveau) : non-régression éteint/allumé sur les prompts d'expansion.

## Tests

Chiffre hors dossier détecté ; chiffre du dossier accepté (formats français : `1.490,50 €`, espaces insécables) ; jeton de prix ignoré ; interrupteur éteint = consigne vide et prompt d'expansion identique à celui sans dossier ; instantané de la consigne allumée ; échappement du dossier ; signe négatif conservé. `pnpm typecheck`, eslint et prettier passent.

## Risques

- `controlerRedaction` est un module pur **non branché** dans le worker pour l'instant : seule la consigne agit en production (derrière l'interrupteur). Le branchement du contrôle (barrière de publication) est à faire dans une PR suivante.
- `h2-hors-plan` ne signale que les h2 manquants, comme la barrière existante.
- Le contrôle est volontairement permissif sur l'unité (un nombre présent au dossier est autorisé quelle que soit son unité) ; faux positif possible sur un décimal anglais (`0.125`).
- Le dossier vient de la recherche web : ses champs sont échappés avant d'entrer dans le prompt.

## Relecture

3 tours Opus en lecture seule : tour 1 et 2 « À CORRIGER » (échappement, plan répété par tranche, formats français, signe négatif), tout corrigé.

VERDICT OPUS : BON
