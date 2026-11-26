# Équipe éditoriale, PR 3 : fiche de brief et stratège mots-clés

## But

Donner à l'équipe éditoriale une fiche de brief SEO validée, et un premier rôle (« stratège mots-clés ») qui la produit à partir d'un sujet. Tout est éteint par défaut derrière `CONTENT_EQUIPE_EDITORIALE` (valeur exacte `true`).

## Fichiers (tous nouveaux, rien d'existant modifié)

- `src/server/content-gen/equipe/brief.ts` : schéma zod du brief (mot-clé, intention, requêtes secondaires, champ sémantique, entités, questions avec origine obligatoire `search-console` | `plan-editorial` | `autre-source` + référence, URL cible, cluster, type `neuf` | `mise-a-jour`) ; fonction pure `importerPlanEditorial` qui lit le tableau des 40 sujets de `docs/contenu/plan-editorial-journee-ia-2026-11.md`.
- `src/server/content-gen/equipe/strategie.ts` : `produireBrief`. Appelle claude-sonnet-5-5 par la porte existante `genererTexteBlogClaude` (rôle `court`, réservation de coût existante). Avant tout appel, la carte des requêtes (PR #2351) est consultée : mot-clé déjà possédé par une URL → refus, ou proposition « mise-a-jour » de l'URL propriétaire (option `siPossede`), sans appel au modèle. Même garde après coup si le modèle choisit lui-même un mot-clé possédé.
- `brief.test.ts`, `strategie.test.ts`.

## Tests

17 tests Vitest : question sans origine refusée, URL/type invalides, import du plan (40 briefs, 40 URL distinctes, ligne incomplète écartée), mot-clé possédé → refus sans modèle (modèle simulé), mise à jour proposée, mot-clé libre → un seul appel `court`, interrupteur éteint (absent, « 1 », « TRUE ») → aucun appel. `tsc --noEmit` et eslint passent.

## Choix à connaître

- Le plan ne contient ni slug ni cluster : l'URL cible importée est **prévue** (`/fr/blog/<slug du mot-clé>`, à confirmer à la publication) et le cluster est la page de rattachement (« lien interne »).
- Les briefs importés ont des listes vides (requêtes secondaires, champ sémantique, entités) : le stratège les complète.
- Rien n'est branché : aucun appelant dans le worker ni dans le front.

## Risques

Faibles : modules inertes, aucune migration, aucun champ de job BullMQ. Le `typecheck` complet demande ~12 Go de tas Node sur ce runner. `pnpm-lock.yaml` inchangé.
