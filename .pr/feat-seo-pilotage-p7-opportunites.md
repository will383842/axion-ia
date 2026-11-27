# P7 · Moteur d'opportunités (pur) — CI rétablie

## But

Premier morceau « analyse » du pilotage SEO/GEO : un module pur qui repère, à partir de données Search Console déjà lues, les pages et requêtes où un travail rapporterait des clics. Il ne lit ni la base ni le réseau et n'est branché nulle part (lecture Prisma prévue dans P4/P8).

## Correction de la CI (ce commit)

La CI était rouge : `pnpm content-gen:isolation-check` signalait 3 violations « Contient marqueur content-gen mais hors zones dédiées (§ 4.1bis) » dans `analyser.ts`, `detecteurs.ts` et `garde-fous.ts` (dossier `src/server/seo-pilotage/opportunites/`).

- **Cause** : ces fichiers importent vraiment deux fonctions pures de content-gen (`construireCarte` et `normaliserUrl` dans `carte-requetes`, `evaluerSujetCible` dans `sujet-cible`). Le marqueur vient du chemin d'import : on ne peut pas le retirer sans copier du code.
- **Correction** : trois exceptions nominatives dans `scripts/content-gen/isolation-check.ts`, sur le modèle de celle de Site Explorer (consommateurs en lecture seule). Aucun joker, aucun dossier entier : un autre fichier de `seo-pilotage/` qui importerait content-gen restera signalé. La vérification n'est pas affaiblie pour les autres dossiers.
- **Note** : les PR P0 et P3 ne déclarent aucune zone, car elles n'importent pas content-gen. Il n'y avait donc pas de précédent à copier.

## Vérifications

- `pnpm content-gen:isolation-check` : 0 violation sur 17 283 fichiers.
- `pnpm typecheck` : propre. `pnpm lint` : 0 erreur. `pnpm format:check` : propre.
- Vitest : 8 fichiers, 85 tests verts (module opportunités + garde d'isolation).

## Points à connaître

- Le couplage de code avec content-gen est réel : si ces deux fonctions changent, le pilotage SEO change avec elles. Acceptable car elles sont pures. Alternative plus lourde : les déplacer dans un module partagé hors content-gen.
- Interface `TypePage` locale à `types.ts` (P3 non disponible), à remplacer à l'intégration.
- `/formations` et `/implantations` ne sont protégées qu'en exact ; choix provisoire à arbitrer par Will.
- Seuils, efforts et facteurs de confiance arbitraires, à calibrer sur 8 semaines.

## Risques

Aucun : module neuf, non importé, aucune migration, aucun frontend. Le seul changement de cette correction est dans une garde CI.

## Relecture

Un tour Opus sur la correction : aucun point bloquant ; une imprécision de commentaire, corrigée.

VERDICT OPUS : BON
