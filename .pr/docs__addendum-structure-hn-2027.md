Conception : intention de recherche, structure des titres et longueur des articles (addendum 2027)

## Ce que fait cette PR

Elle ajoute un seul document de conception, sans code ni migration :
`docs/pilotage-seo-geo/ADDENDUM-STRUCTURE-INTENTION-LONGUEUR-2027.md`.

Base : `main` (fusionné le 27/11/2026, avec S1 #2448 et C3 #2465 livrées).

Il complète la conception de la chaîne éditoriale IA, celle de la porte qualité et celle des gabarits d'articles. Pour chaque article, la chaîne tient compte, de façon explicite et vérifiable par le code :

- **de l'intention de recherche** (les valeurs de l'énumération `SearchIntent` existante) : seules les intentions informationnelles et comparatives donnent un article ; prix, ville ou page précise renvoient vers une page existante.
- **de la structure des titres** : un seul H1, des H2 reliés aux questions du brief, aucun saut de niveau, longueurs calibrées sur les 365 questions du plan, réponse directe de 40 à 60 mots sous le H1.
- **de la longueur** : une fourchette calculée par le code à partir des pages que R2 lira en C6, bornée par la couverture des questions et par le gabarit.
- **des pratiques des moteurs fin 2026**, en séparant le documenté du supposé.

Il définit aussi six critères de porte (B18 à B23, en observation), une fiche par gabarit (10), la place de chaque règle dans le découpage (dont une migration C3b et une PR S1b nouvelles), les contrôles existants à adapter (validateur d'intention, Q5, Q6, Q8, Q13 de la grille, `edition-seo.ts`, planchers de 850 mots, etc.) et neuf décisions pour Will (D-A1 à D-A9).

## Limites

- Recherche web du 27/11/2026 ; les pages Google Search Central et Microsoft n'ont pas pu être ouvertes (domaines bloqués), elles sont citées d'après des extraits et marquées comme telles.
- Huit tours de relecture Opus. Dernière passe (tour 8, 3 tours de cette session) : 1 bloquant (le marqueur `versionChaine` serait perdu par le worker : déplacé dans `inputPayload`) et 6 mineurs, **tous corrigés mais non relus**.

Aucune PR n'est ouverte.

VERDICT OPUS : À CORRIGER (3 tours épuisés ; 1 bloquant et 6 mineurs du dernier tour corrigés, non relus)
