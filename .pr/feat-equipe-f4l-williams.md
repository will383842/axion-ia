# Équipe F4L : la page de Williams Jullin, corrections finales (suite de F4)

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

## Points traités dans cette branche (F4L)

1. **Fil d'Ariane** : le lien mène à `/fr/equipe`, route existante (hub `src/app/[locale]/equipe/page.tsx` + entrée `/equipe` dans `routing.ts`). Test ajouté.
2. **Fonction** : `WILLIAMS_FONCTION = FOUNDER.jobTitleFr` (« Fondateur & CEO d'Axion-IA »), identique à `Person.jobTitle`. Test ajouté.
3. **`Person.description`** : nouvelle constante `WILLIAMS_DESCRIPTION_PERSON`, à la 3e personne, sans « nous », même sens que la réponse de tête (inchangée à l'écran). `@id` et `sameAs` intouchés.
4. **Image de partage** : `opengraph-image.tsx` du segment `[slug]` s'appliquait à tous les slugs ; remplacé par la route `/api/og/equipe-williams`, référencée par `generateMetadata` du seul slug `williams`. Les autres (dont manon) gardent `/api/og`. Test dans `[slug]/__tests__/image-partage.spec.ts`.
5. **Code mort** : `WILLIAMS_PROFILE` et `WILLIAMS_BIO_MD` supprimés (aucun usage).

Les autres points de la section F4 (adresse sans ville, photo/consentement, compétences, LinkedIn, tests écrits après le code, lockfile) restent tels quels.

## Comment vérifier

`pnpm vitest run src/app/\[locale\]/equipe src/lib/seo src/lib/equipe src/content/__tests__ src/components/equipe tests/unit/seo`, puis `/fr/equipe/williams` (fonction = « Fondateur & CEO d'Axion-IA », balise `og:image` = `/api/og/equipe-williams`) et `/fr/equipe/manon` (`og:image` = `/api/og?...`).

## Mesures et limites

- `pnpm typecheck`, `pnpm lint` (0 erreur), tests ciblés (139 fichiers, 1780 tests) : verts.
- `pnpm format:check` échoue seulement sur `.mcp.json` (EACCES, fichier de l'environnement).
- **`pnpm bundle:check` non exécuté** : le build de compilation échoue dans cet environnement sur `fonts/inter-latin-var.woff2` (« leaves the filesystem root »), sans lien avec ce diff (une route serveur et des constantes ; aucun client ajouté).
- Git : `git checkout feat/equipe-f4l-williams` a échoué (« unable to write upstream branch configuration ») ; bascule par `git checkout -f --no-track`. Le pre-commit a d'abord manqué de mémoire (`tsc`) : relancé avec `NODE_OPTIONS=--max-old-space-size=8192`. Le lockfile n'a pas changé.

## Relecture Opus (un tour)

RAS sur JSON-LD, contenu, titres, accessibilité, image de partage, code mort. Mineurs : `ogEyebrow` obsolète (corrigé) ; `description`/`abstract` du ProfilePage reprennent encore la réponse de tête avec « nous » (hors périmètre demandé, laissé) ; restes `sameAs`/`void contenu` dans `collaborateur-jsonld.ts` pour les autres collaborateurs (nettoyage à part).

VERDICT OPUS : BON. Restes : `bundle:check` non mesuré ici ; `ProfilePage.description` encore à la 1re personne du pluriel (à trancher).
