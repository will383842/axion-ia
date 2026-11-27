# P12 · Score de citabilité et cohérence des faits (sans modèle)

## But

Calculer, sans aucun appel à un modèle, un score de citabilité sur 100 pour une page publique, à partir de son HTML rendu, et repérer les faits « canon » qui divergent (prix, délai). Le score sert à prioriser le travail éditorial ; il n'agit sur rien.

## Fichiers

- `src/server/seo-pilotage/citabilite/score.ts` : grille du PLAN § 3.5 (11 critères = 100 points, pénalités −20 « fait canon » et −20 « mot interdit/Grenoble », score borné à 0).
- `src/server/seo-pilotage/citabilite/faits.ts` : faits lus dans `pricing.ts` (prix de la Journée IA) et `journee-ia-commun.ts` (délai du rapport) ; mots interdits via `interdits-publication.ts` (source unique).
- `src/server/seo-pilotage/citabilite/__tests__/score.spec.ts` : un fixture par critère et par pénalité, une page réelle (extrait), un prix divergent, la phrase canon de déduction (5 000 € + prix), une Organization redéfinie avec le même `@id`, une entrée gigantesque.
- `docs/content-gen/seo-aeo-60-items-checklist.md` : correction, le « CI gate » annoncé n'existe pas.

## Non fait, volontairement (module pur, non branché)

- Pas de tâche hebdomadaire ni de fetch réseau.
- `scripts/seo-audit.ts` reste un stub : le remplacer suppose le branchement (PR suivante).
- Pas d'instantané d'une vraie page publique (pas de réseau ici) ; remplacé par un extrait écrit à la main.
- Concordance avec `feat/gabarits-articles-conception` non vérifiée.

## Tests

⚠️ **Non exécutés** : `node_modules` est absent du conteneur et l'installation a été refusée. Vitest, `pnpm typecheck` et `pnpm lint` n'ont donc PAS tourné ; les tests ont été déroulés à la main par la relecture. Prettier a été passé (sans le plugin Tailwind, absent). **La CI doit confirmer.**

## Risques

- Analyse du HTML par regex (aucune dépendance de plus) : entrée tronquée à 1 Mo, balises bornées à 1 024 caractères. Un HTML hostile avec commentaires/scripts jamais fermés reste quadratique ; la source est notre propre site.
- Les pages qui décrivent des tiers comme `Organization` perdent le critère JSON-LD.
- Heuristiques linguistiques (questions, renvois) simples ; à calibrer.

## Relecture

Opus, tour 1 : À CORRIGER (phrase de déduction faussement pénalisée, critère JSON-LD trop strict, bornes de taille, test de page réelle). Corrigé sauf l'instantané réel. Tour 2 non relancé (les tests ne pouvant pas s'exécuter ici).

VERDICT OPUS : À CORRIGER

🤖 Generated with [Claude Code](https://claude.com/claude-code)
