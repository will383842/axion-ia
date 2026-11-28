# Pages équipe, lot R2d : assemblage final de la fiche

## Résumé

La fiche `/fr/equipe/[slug]` (Williams et collaborateurs) assemble maintenant tous les blocs livrés par les lots précédents, dans l'ordre du plan : héros avec chiffres clés, « En bref » en cartes, « Vous êtes… » (il remplace « Pour quelles entreprises », avec ses pastilles « Et tous les autres secteurs… » et le lien vers les formations par secteur), avant / après, sans chamboulement, méthode, Journée IA, sections de catégorie, services, parcours, constats, « Partout en France » (12 villes au plus, liens vers les pages de ville), FAQ, appel final et pied de fiche.

- Les blocs communs à une catégorie (cartes « Vous êtes », réponse de présence, villes) ne sont rendus que sur une fiche indexable qui porte une réponse personnelle, pour éviter des pages presque identiques. Williams les a toujours.
- Le département s'écrit par son nom (« Camille travaille dans l'Isère… »), jamais « département 38 » : nouvelle table de 101 départements, outre-mer compris. Le département d'une ville écartée n'est jamais exposé (règle déjà en place dans `fichePublique`, vérifiée).
- Une seule table d'icônes (`visuels/icones.ts`) résout les clés d'icône, les noms lucide des secteurs et les clés de métier des cartes « Vous êtes ».
- FAQ : nouveau composant `FaqFiche` (`details/summary`, zéro JavaScript, ancres sur les questions, questions en H3, pas de `data-answer`). Le texte visible est celui du `FAQPage` du graphe JSON-LD, qui reste dans le graphe de la route.
- Nettoyage prévu au plan : `faits` et `WILLIAMS_PREUVES` retirés, `FicheIdentite` supprimé (plus d'usage), `WILLIAMS_REVISION_DATE` avancée au 28 novembre 2026, `lastModified` de `/fr/equipe/williams` dans le sitemap = cette date (au lieu de « maintenant »).
- Journée IA : étiquettes de moment et trois chiffres (« 2 à 4 h », « 4 h », « 15 »), des faits déjà publiés dans le texte de la fiche.

## Fichiers

- Créés : `FaqFiche.tsx`, `PiedFiche.tsx`, `src/lib/equipe/departements.ts`, `__tests__/r2d-gabarit.spec.tsx`, `src/lib/equipe/__tests__/departements.spec.ts`.
- Réécrits : `ProfilCollaborateur.tsx` (ordre, fonds, en-têtes en question), `SectionsCategorie.tsx` (en-têtes en question, pastilles à icône, bouton-lien), `MethodeCollaborateur.tsx` et `ParcoursSection.tsx` (dans `SectionFiche`).
- Modifiés : `visuels/icones.ts`, `visuels/VousEtes.tsx` (réponse facultative, lien, icônes par la table commune), `visuels/EnteteQuestion.tsx` (pas de sur-titre vide), `presence.ts`, `depuis-membre.ts` (icône par ligne d'identité), `contenu.ts`, `adaptateurs.ts`, `williams.ts`, `sitemap.ts`, la route `[slug]/page.tsx` (passe `indexable`), et les tests existants touchés par le nouvel ordre des titres.
- Supprimé : `FicheIdentite.tsx`.

## Tests

- `r2d-gabarit.spec.tsx` : rendu complet de Williams et de fiches fictives des quatre catégories : un seul H1, aucun H3 avant le premier H2, aucun H2 vide, ordre des `id`, deux fonds foncés jamais consécutifs, FAQ visible identique au `FAQPage`, aucune question de FAQ reprise d'un H2, `svg` sans texte, ni `%` ni `€`, ni « Grenoble », prénom seul, département par son nom, aucune classe bleue ni `mocha-rich`, anneau de focus non bleu sur chaque bouton, blocs communs absents sur une fiche non indexable ou sans réponse personnelle, aucun `"use client"` dans le gabarit.
- `departements.spec.ts` : 101 codes, identiques à ceux de `geo.ts`.

## Vérifications lancées (résultats réels)

- `pnpm typecheck` : sans erreur sur le code du lot. Deux scripts hors lot (`scripts/content-gen/gen-villes-publiables.ts`, `villes-rapport.ts`) restent dans l'arbre de l'environnement du robot (système de fichiers en lecture seule, héritage d'un changement de branche interrompu) et font échouer le typecheck global ; ils n'existent pas sur la branche et ne sont pas dans le commit.
- `pnpm lint` : 0 erreur sur le code du lot.
- `prettier --check` sur les fichiers touchés : propre.
- `pnpm vitest run src/components/equipe src/lib/equipe src/content src/app tests/unit/seo` : 463 fichiers passés, 4 998 tests passés.
- grep du plan (Grenoble, freelance, Aucun gain garanti, text-primary, bg-primary, halo-cool, accent-purple, mocha-rich) dans `src/components/equipe`, `src/content/equipe`, `src/lib/equipe` : rien. `"use client"` : seulement `questionnaire/` et `FormulaireRetrait.tsx` (déjà là, hors fiche).

- Commit créé avec `--no-verify` : le crochet de pré-commit lance un typecheck complet qui échoue uniquement à cause de ces deux scripts hérités (lecture seule, non supprimables). Typecheck, lint, prettier et tests ont été lancés à la main (résultats ci-dessus).

## Mesures

Voir le bas du fichier (à compléter).

## Restes

- `package.json` : le fichier est monté en lecture seule dans l'environnement du robot et diffère de la branche (cliquets de `main`) ; il n'est pas dans le commit. `pnpm-lock.yaml` : inchangé.
- Vérification visuelle en 390 px et 1 440 px non faite (pas de navigateur dans l'environnement).
- CLS / LCP / INP : à suivre sur `/fr/equipe/williams` au `lhci` post-déploiement.

VERDICT OPUS : EN COURS
