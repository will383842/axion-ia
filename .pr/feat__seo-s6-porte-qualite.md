S6-3 · Porte de qualité des villes indexées (test seul, sans effet sur le site)

Fiche : `docs/pilotage-seo-geo/S6-VILLES.md`, § 5 et § 7, S6-3.

## Ce que fait cette PR

Deux fichiers nouveaux, aucun code servi ne les importe (éteint par défaut, aucun effet sur le site, le bundle ou les sitemaps) :

- `src/content/villes/qualite-indexation.ts` : `evaluerQualiteVille(slug)` rend, critère par critère, passé ou échoué avec le motif chiffré : fiche locale présente, 3 secteurs chiffrés, 3 institutions publiques, 3 questions locales, moins de 30 % de suites de 6 mots communes avec chaque autre fiche, au moins 250 mots propres à la ville, nom de la ville du siège absent de tous les textes affichés. Les autres critères du § 5 (sources, dates, catégories fermées, ni frais ni fausse présence, title/description) sont déjà portés par d'autres tests sur toutes les fiches ; le module les liste et un test vérifie que ces fichiers existent.
- `src/content/villes/__tests__/qualite-indexation.spec.ts` (17 tests) : une ville sans fiche échoue ; une fiche copiée échoue ; un cas à 31 % de suites communes échoue et un cas à 29 % passe ; les seuils sont figés (les changer est une décision de Will) ; ajouter une ville sans fiche à l'index fait échouer le test ; le module n'importe que des modules légers.

## Cliquets (la dette ne peut que diminuer)

- `VILLES_INDEXEES_SANS_FICHE` : 29 villes indexées sans fiche (la ville du siège est suivie à part par `VILLES_HORS_MAILLAGE`). Jamais plus, aucune désindexation automatique.
- `FICHES_SOUS_LE_SEUIL` : **constat à trancher par Will.** Mesurée à la lettre (un mot est « propre » s'il n'appartient à aucune suite de 6 mots présente sur une autre fiche), **les 10 fiches actuelles sont sous 250 mots propres** (de 125 à 237). Quatre n'ont aussi que 2 institutions (Nice, Montpellier, Strasbourg, Rennes). Elles sont inscrites au cliquet, critère par critère : une fiche ne peut ni rater un critère de plus, ni être ajoutée. Deux sorties possibles pour Will : baisser le seuil de 250 (le test « seuils figés » le rendra visible), ou étoffer les fiches (lots S6-4 et S6-5).

## Vérifications

- Typecheck propre, `prettier --check` propre.
- `qualite-indexation.spec.ts`, `fiches-locales.spec.ts`, `villes-indexees.spec.ts` verts (34 tests).
- Le nom de la ville du siège n'est écrit nulle part : il est lu à l'exécution depuis `VILLES_HORS_MAILLAGE` et `core.ts`.

VERDICT OPUS : BON
