Rapport du lundi : une section « Pilotage SEO » (clics, affichages, opportunités), éteinte par défaut

> **Base : `main`**, à ouvrir après la fusion de P4 (#robot de collecte). Cette branche part de `feat/seo-pilotage-p4-robot` recalée (migration P2 déjà sur `main`).

## Ce que fait cette PR

Le courriel du lundi (07 h UTC) reçoit une section « Pilotage SEO », pas de second courriel :

- **Chiffres clés** sur les 7 derniers jours mesurés, avec l'évolution face aux 7 jours d'avant : clics, affichages, taux de clics, pages affichées, position moyenne.
- **Meilleures opportunités** : jusqu'à 5, lues dans `SeoOpportunite` (dernière semaine, priorité décroissante).
- **Sources indisponibles** : jours de collecte en échec, non terminés ou incomplets, et retard de plus de 4 jours.
- Rappel « Pas encore mesuré » : modifications appliquées et visites des moteurs IA (lots P13 et P10, pas encore livrés).

## Sécurité et règles

- **Éteint par défaut** : seul `CONTENT_PILOTAGE_SEO="true"` (exact) affiche la section. Éteint, ou base `stub.invalid` : aucune lecture, courriel identique à avant.
- **Lecture seule** des tables de la mesure : aucun appel Google (aucun quota Search Console consommé), aucune écriture, aucune migration.
- **Source indisponible** (table absente P2021/P2022 ou panne) : la phrase l'annonce, jamais un 0. Une fenêtre de moins de 7 jours mesurés affiche « chiffres incomplets », sans pourcentage inventé.
- **Données personnelles** : le texte d'une requête n'est cité que si elle a au moins 30 affichages sur 28 jours (maximum par page, jamais la somme).
- Une panne de la section n'empêche jamais l'envoi du rapport existant.

## Fichiers

`src/server/seo-pilotage/rapport.ts` (pur), `rapport-donnees.ts` (lecture), branchement dans `content-weekly-report-worker.ts`, deux fichiers de tests.

## Limites assumées

- Rien n'écrit encore `SeoOpportunite` : la section d'opportunités restera vide jusqu'à ce lot ; la citation d'une requête suppose `details.requeteId` (contrat à poser avec l'écrivain).
- Le plancher « présente 3 semaines sur 4 » du PLAN n'est pas exigé par la fiche P9, non appliqué.

## Tests

- Vitest : `src/server/seo-pilotage` et `src/server/queue` : 1338 tests verts.
- `pnpm typecheck`, `content-gen:isolation-check`, `image-bank:isolation-check`, `pnpm lint` (0 erreur), prettier : OK.

VERDICT OPUS : BON
