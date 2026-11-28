# Pages équipe, lot R2c2 : registre de catégorie, présence « partout en France », JSON-LD

## En clair

- Le registre de catégorie (`modeles-categorie.ts`) gagne, pour chaque catégorie : un sur-titre, une question en H2 et une réponse directe (30 mots au plus) par section ; 3 cartes « Vous êtes… » au plus (`cle, titre, cout, action, gain, icone`, en « vous », gains qualitatifs, aucun chiffre) ; la question/réponse « près de chez moi ? » (40 à 60 mots) ; un `pourQui` pour les apporteurs ; `chiffresAutorises`. Les textes varient d'une catégorie à l'autre.
- Nouveau `src/lib/equipe/presence.ts` : régions de France, 12 plus grandes villes (lues dans `@/content/villes/core` : villes indexées et citables, population décroissante, liens `/audit/par-ville/<slug>`, aucune ville tapée à la main), phrase de lieu d'un collaborateur (ville, sinon département, sinon rien).
- `depuis-membre.ts` : `entetes`, `vousEtes`, `presence`, `pourQui`, `iconesIdentite`, `chiffresCles` (seulement si 2 chiffres réels : aucun aujourd'hui). Types déclarés localement (`ExtensionContenuR2c2`), à rapatrier dans `contenu.ts` par R2d.
- JSON-LD : `areaServed` (Country France + régions ; ville ou département du collaborateur seulement s'ils sont connus) pour Williams et les collaborateurs ; `knowsAbout` ; FAQ avec `@id` et `isPartOf` ; `significantLink` pour Williams. `williams-person.ts` n'est pas modifié (`@id` et `sameAs` inchangés).
- `page.tsx` : seulement `generateMetadata` (titre absolu collaborateur, 60 caractères au plus).

## Points à connaître

- Les pages `/audit/par-ville/*` sont toutes en `noindex, follow` depuis le 18/11/2026 ; « indexable » est pris au sens de la liste des villes indexées. Il n'existe pas de page d'index `/audit/par-ville` : aucun lien d'index ajouté.
- Question de présence écrite sans « il/elle » (« {prénom} et l'équipe d'Axion-IA interviennent-ils près de chez moi ? ») : l'accord n'est pas connu du registre. Phrase de lieu : « travaille depuis… » (même raison).
- La ville Grenoble est déjà écartée par la fiche publique ; rien ne l'écrit.
- Aucune dépendance, migration, job ni enum.

## Fichiers

`src/lib/equipe/{modeles-categorie,depuis-membre,presence}.ts`, `src/lib/seo/collaborateur-jsonld.ts`, `src/app/[locale]/equipe/[slug]/page.tsx` ; tests : `src/lib/equipe/__tests__/{depuis-membre.spec,categories.test}.ts`, `src/lib/seo/__tests__/collaborateur-jsonld.spec.ts`.

## Vérifications lancées (résultats réels)

- `pnpm typecheck` (8 Go de mémoire) : OK
- `eslint` sur les fichiers touchés : OK ; `prettier --check` : OK
- `vitest` : `src/lib/equipe`, `src/components/equipe`, `collaborateur-jsonld.spec.ts` : 289 tests OK
- grep des mots interdits dans `src/lib/equipe` hors tests : rien

VERDICT OPUS : EN COURS
