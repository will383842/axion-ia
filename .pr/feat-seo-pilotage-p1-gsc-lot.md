# P1 · Client Search Console par lot

## But

Lire Search Console en masse (un jour, toutes les pages, toutes les requêtes) au lieu d'une URL à la fois. Ce sont des fonctions nouvelles, **non branchées** : aucun appelant n'est touché, les signatures existantes sont inchangées.

## Fichiers

- `src/server/content-gen/seo/gsc-client.ts` : ajout de quatre fonctions.
  - `gscSearchAnalytics` : pagination (`startRow`, `rowLimit` ≤ 25 000), `fetch` injectable, réessai sur 429 (en-tête `Retry-After`, plafonné à 60 s, sinon délai exponentiel), arrêt net sur 403 `quotaExceeded`.
  - `gscDernierJourFinal` : détecte le dernier jour qui a des données finales.
  - `gscSonde` : rend toujours `{ etat: "ok" | "identifiants_absents" | "refus" | "quota" | "erreur" }`, jamais `null`.
  - `gscPageMetricsForUrlDates` : variante de `gscPageMetricsForUrl` à dates explicites.
- `src/server/content-gen/seo/__tests__/gsc-client-lot.spec.ts` : 30 tests.

## Tests

- 36 tests passent (les 6 existants et les nouveaux), sans réseau et sans identifiant réel.
- Ils couvrent : la forme de la requête (`dataState: final`, `byPage`), l'arrêt de la pagination, le 429 et le `quotaExceeded`, la sonde dans les 5 états, et l'absence d'identifiant dans les messages d'erreur.

## Risques et réserves

- **Documentation Google non consultée en ligne** : le domaine `developers.google.com` est bloqué dans cette session. Les noms de champs (`dataState`, `aggregationType`, `rowLimit`, `startRow`, `metadata.first_incomplete_date`) viennent du schéma connu de `searchanalytics.query` : à confirmer.
- **Vérifications** : les dépendances n'étaient pas installées. Les tests ont été lancés avec vitest installé hors du dépôt. `tsc --strict` est passé sur `gsc-client.ts` seul ; le `pnpm typecheck` complet et `pnpm lint` n'ont pas pu tourner : la CI tranchera. Prettier a été lancé sans le plugin Tailwind.
- `dataState: "hourly_all"` volontairement non géré.
- Les dates de `gscDernierJourFinal` sont en UTC ; la fenêtre de 14 jours absorbe l'écart avec l'heure du Pacifique.
- Aucune migration, aucun frontend, aucun fichier interdit touché.

## Relecture

Deux tours de relecture Opus ; toutes les corrections demandées ont été appliquées (NaN, jeton 401, raisons de quota, URL vide, corps JSON non conforme, tests). Deux remarques mineures du 2e tour ont aussi été corrigées.

VERDICT OPUS : BON
