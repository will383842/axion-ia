# Équipe F4 : la page de Williams Jullin sur le gabarit unique

## Quoi

La page `/fr/equipe/williams` passe sur le gabarit commun des fiches équipe, avec les nouveaux textes (version 4 : « transformation simple et rassurante »).

- Contenu : `src/content/equipe/williams.ts` réécrit (réponse de tête, fiche « en bref », avant/après, transformation sans chamboulement, Journée IA, services, méthode « Chiffrer, Essayer, Trancher », parcours, citations, 8 questions, appel final). Le délai du rapport, la garantie et sa condition viennent de `journee-ia-commun.ts`.
- Données : `ficheDepuisWilliams()` (statique, aucune base, fonctionne avec les stubs de build) et `ContenuFiche`.
- Composants (`src/components/equipe/`) : `ProfilCollaborateur`, `HeroCollaborateur`, blocs, services (H3), méthode, parcours, citations. Fil d'Ariane Accueil > Équipe > Williams Jullin, date « Mis à jour le » visible.
- JSON-LD : `src/lib/seo/collaborateur-jsonld.ts` (Person, ProfilePage, BreadcrumbList, FAQPage dans un seul `@graph`). Pour Williams il délègue à `williams-person.ts`.
- Image de partage : `[slug]/opengraph-image.tsx` (portrait, nom, fonction).
- `FounderProfile` supprimé (plus aucun usage). `FaqBlock` accepte `questionAs="h3"`.

## Pourquoi

Un seul gabarit pour toute l'équipe, des titres qui nomment des sujets, et des textes alignés sur la méthode et l'offre actuelles.

## Garde d'entité

`@id`, `name`, `givenName`, `familyName`, `sameAs`, `image.@id`, `worksFor`, `url` de Williams sont figés par un test aux valeurs écrites en dur (`src/lib/seo/__tests__/collaborateur-jsonld.spec.ts`). Seuls `description`, `knowsAbout` et `dateModified` évoluent. `hasOccupation.name` et `disambiguatingDescription` sont aussi figés.

## Comment vérifier

`pnpm vitest run src/lib/seo src/lib/equipe src/components/equipe src/content tests/unit/seo`, puis ouvrir `/fr/equipe/williams` : un seul H1, 10 H2, 5 H3 de services puis 8 H3 de questions, date visible.

## Mesures

- `pnpm typecheck`, `pnpm lint` (0 erreur), `pnpm bundle:check` : verts. `pnpm format:check` échoue seulement sur `.mcp.json` (fichier de l'environnement, illisible).
- Build de compilation fait : le chunk de la route `equipe/[slug]` pèse 583 octets gz (composants serveur, aucun client). Mesure « avant » non faite (un second build complet de `main`) ; le First Load JS partagé n'a pas été touché.
- Lighthouse (LCP, CLS) non mesuré ici : portrait en conteneur carré réservé, `priority`.

## Points à trancher / limites

1. **Fil d'Ariane vers `/fr/equipe`** : la page hub est faite à part ; le lien et le 2e élément du `BreadcrumbList` mènent à une 404 tant qu'elle n'est pas fusionnée. `/equipe` n'est pas encore déclaré dans `routing.ts` (à faire avec le hub).
2. **Fonction** : la page affiche « Fondateur et dirigeant d'Axion-IA » ; `Person.jobTitle` reste « Fondateur & CEO d'Axion-IA » (identité non modifiée). À aligner par décision.
3. **`Person.description`** = la réponse de tête telle que retenue (avec « nous »). Hors contexte ce « nous » est flou ; reformulation possible.
4. **Adresse** : le JSON-LD de Williams garde `workLocation.address` avec le seul `addressCountry: "FR"` (un test existant l'exige) : aucune ville, aucun `homeLocation`.
5. **Photo** : `consentementLe` de Williams (2026-08-19) est la date d'usage public existante du portrait, à confirmer.
6. **Image de partage** : le fichier `opengraph-image` s'applique à tous les slugs ; les fiches autres que Williams reçoivent une carte de marque sans photo (Manon perd la carte `/api/og` générique).
7. **Compétences** : `skills` n'évoque plus le code propriétaire (règle « pas de propriété du code »).
8. Le profil LinkedIn n'est jamais repris pour un autre collaborateur que le dirigeant (il peut contenir un nom de famille). Les textes du contenu ne passent pas encore par le filtre de `fichePublique` : à faire avec `ficheDepuisBase`.
9. Code mort laissé : `WILLIAMS_PROFILE` et `WILLIAMS_BIO_MD` dans `williams-person.ts` (plus de consommateur).
10. Méthode : les tests de logique ont été écrits en même temps que le code, pas avant.
11. Le lockfile n'a pas changé.

## Relecture

Un tour de relecture Opus (entité, contenu, Hn, accessibilité) : 20 remarques, corrigées sauf les points 1 à 3, 6 (image), 8 et 9 ci-dessus, laissés volontairement et signalés. Pas de second tour.

VERDICT OPUS : À CORRIGER — restent les points 1 (hub/routing), 2 (fonction), 3 (description), 6 (image de partage) et 9 (code mort), à trancher.
