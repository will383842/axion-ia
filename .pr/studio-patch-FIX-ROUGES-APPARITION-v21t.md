Rouge : aucun job rouge sur 62e80d7f (PR #1748) ; « next build » et « eslint et tsc différentiels » étaient encore en cours, et master n'a avancé que de #1786, déjà contenu dans la branche (aucun conflit, contenu identique).
Changé : rien dans le code ; le patch ne contient qu'un commit normal vide (aucun fichier touché, donc aucune mutation à faire).
Tests : vitest encart-3-bornes-site + apparition → 16 passés, 12 sautés (apparition sautée : studio-rendu non installé, comme en CI) ; tsc : aucune erreur dans les fichiers de la fiche.
Hérités non réparés : erreurs tsc existantes hors fiche (type Notification) ; les 2 jobs CI en cours sont à relire avant fusion.
