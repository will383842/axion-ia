# P0b · Plancher d'impressions dans `declencheursMiseAJour`

## But

Une baisse de position de 3 places ou plus ne déclenche plus une mise à jour d'article que si la page a eu au moins 100 impressions sur 28 jours. Sur un site jeune (~428 impressions par semaine), une baisse sans volume est du bruit. Pas de nouvel interrupteur : la règle reste derrière `CONTENT_EQUIPE_EDITORIALE`.

## Fichiers

- `src/server/content-gen/equipe/suivi-publication.ts` : constante `PLANCHER_IMPRESSIONS_BAISSE = 100`, champ facultatif `impressions28j?: number | null` dans `SignauxArticle`, condition ajoutée à la règle « baisse-position ».
- `src/server/content-gen/equipe/suivi-publication.test.ts` : tests 99 / 100 impressions, impressions `null` ou absentes, autres raisons inchangées.

## Tests

- 99 impressions : pas de déclenchement ; 100 : déclenchement.
- `null` ou champ absent : aucun déclenchement.
- Les autres raisons (âge, lien cassé, preuve, cannibalisation) ne changent pas.
- Spec exécutée : 21 tests verts (vitest, alias `@` et `next-intl/routing` simulés : le dépôt n'avait pas de `node_modules` dans cet environnement).
- Non exécutés ici faute de dépendances : `pnpm typecheck`, `pnpm lint`. Le changement ne touche que des types simples (champ facultatif). La CI les rejouera.
- Prettier passé avec la config du dépôt, hors plugin Tailwind (absent ici, sans effet sur ces fichiers).

## Risques

- ⚠️ **Effet dormant côté worker.** Les impressions ne sont pas conservées aujourd'hui : `content-refresh-worker.ts` ne remplit pas `impressions28j` (il ne stocke que les positions dans Redis). Conformément à la consigne « impressions absentes = aucun déclenchement », la raison « baisse-position » ne se déclenchera donc plus en production tant que le worker ne fournit pas ce chiffre. Les autres raisons restent actives. Brancher la valeur (stocker `impressions` à côté de la position, ou la lire dans `GscPageJour` après P2/P4) est hors du périmètre de P0b (fichiers : `suivi-publication.ts` et son test) ; à traiter dans P6a/P4.
- Champ facultatif : aucun appelant cassé, aucune charge de job BullMQ modifiée.
- Aucun interrupteur nouveau, aucun fichier interdit touché.

Relecture Opus (1 tour) : aucun problème à corriger ; remarque facultative (test NaN / 0 / négatif) reprise.

VERDICT OPUS : BON
