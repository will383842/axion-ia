# Pages équipe, lot R2b1 : frises (méthode, Journée IA, parcours)

## Résumé

Ce lot remplace les listes de texte de la méthode et du parcours par deux frises visuelles, sans JavaScript client.

- `FriseEtapes` : liste ordonnée, un disque numéroté et un titre de niveau 3 par étape. Trois étapes ou cinq (variante avec étiquette de moment). Frise horizontale sur grand écran, verticale sur mobile.
- `FriseParcours` : frise chronologique. Une date n'est affichée que si elle est fournie ; `<time>` seulement pour une année.
- `MethodeCollaborateur` et `ParcoursSection` utilisent ces frises. Leurs props sont déclarées localement (aucun import de `ContenuFiche` dans les nouvelles briques).

Aucune couleur bleue, aucune animation, aucun SVG porteur de sens (la flèche finale est masquée), aucune dépendance, aucune migration.

## Fichiers

- créés : `src/components/equipe/visuels/FriseEtapes.tsx`, `visuels/FriseParcours.tsx`, `__tests__/r2b1-frises.spec.tsx`
- modifiés : `MethodeCollaborateur.tsx`, `ParcoursSection.tsx`, `__tests__/profil-williams.spec.tsx` (le compte des H3 passe de 13 à 19 : 3 étapes et 3 jalons en plus)

## Vérifications lancées (résultats réels)

- `pnpm typecheck` : OK (avec `NODE_OPTIONS=--max-old-space-size=8192`)
- `pnpm exec eslint src/components/equipe` : OK
- `prettier --check src/components/equipe` : OK
- `pnpm vitest run src/components/equipe` : 6 fichiers, 89 tests OK
- grep des mots interdits dans `src/components/equipe`, `src/content/equipe`, `src/lib/equipe` : seules des occurrences existantes dans des tests (listes de mots refusés) et ma propre vérification négative ; aucune dans le code produit
- `"use client"` : seulement `questionnaire/`
- `pnpm-lock.yaml` : non touché

Note : un verrou `.git/config.lock` périmé empêchait le suivi amont ; la branche a été créée avec `--no-track`.

## Relecture Opus

Quatre points relevés, corrigés dans ce lot : trait du parcours qui barrait les titres sans date (zone de date à hauteur fixe, trait seulement si tous les jalons sont datés) ; disques de la frise à 5 étapes qui débordaient entre `sm` et `lg` ; trait posé seulement si les étapes remplissent la grille ; intitulé « Ce que vous obtenez » rendu visible.

À savoir : `ParcoursSection` passe en fond `paper` (plan § 2.11) ; `CitationsTerrain` est aussi en `paper`, donc deux sections claires se suivent jusqu'à l'assemblage R2d. Tests : 91 OK, typecheck et eslint OK.

VERDICT OPUS : BON
