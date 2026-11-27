Carte des mots-clés : une seule page principale par recherche

## Ce que fait la PR

- Ajoute un module pur `src/server/seo-pilotage/carte-mots-cles/` : à partir des lignes « requête × page » sur 28 jours, il désigne la page principale de chaque recherche et liste les pages qui la concurrencent.
- Propriétaire : plan éditorial, puis meilleure position, puis impressions (même ordre que `construireCarte`), parmi les pages ayant au moins 20 % des impressions. Sous 100 impressions : « trop_peu_de_donnees ».
- Aucune URL n'est changée, aucun texte public touché, aucun câblage ni interrupteur : seul un lien interne vers la page principale est suggéré, avec « fusion à étudier » (décision humaine). Page protégée : « signalement_seul ».
- Écarte marque, « Grenoble » (requête et URL, plan compris) et interdits de publication.
- Écarts assumés : pas de plancher de semaines ni de bascules (le détecteur d confirme).
- Une exception nommée est ajoutée à `scripts/content-gen/isolation-check.ts`. Pas de migration.

## Base

Branche `feat/seo-pilotage-p4-robot` ; PR à ouvrir vers `main` après la fusion de P4.

## Tests

15 tests Vitest du module (332 autres du pilotage verts), `pnpm typecheck`, `content-gen:isolation-check`, `image-bank:isolation-check`, eslint, prettier : tout vert.

VERDICT OPUS : BON
