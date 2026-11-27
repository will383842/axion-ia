# docs : conception de la porte qualité des contenus générés

Aucun code n'est modifié. Un seul fichier ajouté : `docs/pilotage-seo-geo/CONCEPTION-PORTE-QUALITE.md`.

## Pourquoi

Will a décidé le 27/11/2026 : la qualité passe avant le volume. Aujourd'hui, il n'y a pas de porte unique : une douzaine de contrôles dispersés, dont certains éteints (la complétude ne fait que journaliser), et plusieurs chemins qui publient sans les traverser (approbation groupée sur la note seule, FAQ extraites, réécriture du fact-check).

## Ce que le document propose

- Une porte unique, en module pur, appelée à quatre endroits, avec un point final obligatoire dans le worker de publication. En cas d'erreur, rien n'est publié.
- 17 critères bloquants et 10 avertissements, une formule de note unique (seuil de départ 85/100), un classement des bloquants en dur, corrigeable et dérogeable.
- Vérification des faits en trois niveaux, avec une liste réglementaire datée (AI Act article 4 assoupli, Qualiopi, OPCO).
- Anti-doublon : registre d'intentions (une intention = une page), embeddings du brouillon avant publication, Search Console quand elle sera branchée.
- Apport original exigé (exemple type étiqueté, chiffre sourcé, angle PME française, donnée réelle d'Axion-IA).
- Huit paliers de rythme (3 à 100 par jour), au moins 35 jours chacun, passage validé par Will sur des indicateurs d'indexation, coupe-circuit automatique.
- Écran de console dont le registre de critères, les réglages et les verdicts viennent du back-end, avec trois tests de concordance.
- Découpage en petites PR (Q0 à Q17).

## À savoir

- Les seuils sont des points de départ : Google ne publie aucun seuil. Les sources sont classées « confirmé » ou « hypothèse » au § 14. Les pages `developers.google.com` n'ont pas pu être ouvertes en entier : relire les sources marquées ‡ avant de décider.
- Le palier 100 par jour n'est probablement pas tenable avec des contenus tous distincts. Le document le dit et propose de le valider au palier 5.
- Question pour Will (D1) : la consigne interdit « partout en France », le code en fait la formule permise. Choix par défaut : l'interdire, après correction du prompt.
- Autres décisions à prendre : D2 à D6 (§ 17), dont qui relit les contenus en son nom.

## Critique indépendante

Première version : « À CORRIGER », 19 défauts (dont 7 bloquants : mauvais renvoi à P13, durées de paliers trop courtes pour juger une cohorte à 28 jours, palier 0 incohérent, formule de note fausse, bloquants non classés, ordre des PR contradictoire, B17 branché trop tard). Tous ont été corrigés dans le document. La version corrigée n'a pas été relue une seconde fois par un critique.

## Vérifications

- `prettier --check` sur les fichiers ajoutés.
- Références de code relues par la critique (fichiers et lignes) : exactes sauf deux affirmations, corrigées.

VERDICT OPUS : À CORRIGER
