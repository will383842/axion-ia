Conception : intention de recherche, structure des titres et longueur des articles (addendum 2027)

## Ce que fait cette PR

Elle ajoute un seul document de conception, sans aucun code :
`docs/pilotage-seo-geo/ADDENDUM-STRUCTURE-INTENTION-LONGUEUR-2027.md`.

Il complète la conception de la chaîne éditoriale IA, celle de la porte qualité et celle des gabarits d'articles. Pour chaque article, la chaîne tient désormais compte, de façon explicite et vérifiable par le code :

- **de l'intention de recherche.** On reprend les cinq valeurs de l'énumération `SearchIntent` qui existe déjà. Seules les intentions informationnelles et comparatives donnent un article. Une question de prix, une recherche par ville ou une recherche de page précise est renvoyée vers une page existante, jamais vers un nouvel article.
- **de la structure des titres.**
  - Un seul H1, rendu par la page.
  - Des H2 qui sont le plus souvent les vraies questions du brief, reliés à elles par leur place dans un plan figé.
  - Aucun saut de niveau et des longueurs de titres calibrées sur les 365 questions du plan éditorial.
  - Une réponse directe de 40 à 60 mots sous le H1, et une ouverture visée de 40 à 60 mots sous chaque H2. La porte tolère 25 à 80 mots pour ne pas rendre tous les articles identiques.
- **de la longueur.** Une fourchette est calculée par le code à partir des pages concurrentes que le stratège lit déjà, sans lecture supplémentaire. Elle est bornée par la couverture des questions et par le gabarit. Ce n'est jamais un nombre fixe.
- **des pratiques des moteurs fin 2026**, en séparant ce qui est documenté de ce qui est supposé : Google (Search, AI Overviews, AI Mode), Bing et Copilot, ChatGPT Search, Perplexity, Gemini et Claude.

Le document définit aussi :

- **six nouveaux critères de porte, B18 à B23.** Ils ne s'appliquent qu'aux contenus de la chaîne, restent en observation jusqu'à 10 contenus relus par gabarit, et ne changent pas la formule de note.
- **une fiche pour chacun des 10 gabarits.** Le gabarit fixe la mise en page ; l'en-tête et le pied de page restent ceux du site.
- **la place de chaque règle dans le découpage existant** (C3 à C11, C14, Q2c, Q5a/Q5, Q8, Q15, S1, G1 à G8, A1, GU1) et 23 groupes de tests numérotés (plus leurs sous-tests).
- **les contrôles existants à adapter**, sans quoi la chaîne casserait :
  - le validateur d'intention, qui désindexerait les sujets « décision » ;
  - les questions Q5 et Q6 de la grille du rédacteur en chef (un H2 exigé, mot-clé exact) ;
  - quatre planchers de 850 mots codés en dur (dont celui de B11 dans la porte livrée) ;
  - la section « Sources » ajoutée au corps stocké ;
  - la consigne de lisibilité V2 ;
  - l'aiguillage du worker par type de contenu ;
  - le contrôle de plan dupliqué.
- **neuf décisions à prendre par Will (D-A1 à D-A9)**, chacune avec une recommandation par défaut et un exemple.

## Limites

- La recherche web date du 27/11/2026. Les pages de Google Search Central et le guide de Microsoft n'ont pas pu être ouverts (domaines bloqués dans la session). Ils sont cités d'après les extraits de recherche et la presse spécialisée, et marqués comme tels dans le document.
- Le document a été relu par trois sous-agents Opus indépendants, l'un après l'autre. Chacun a rendu « À CORRIGER », et leurs remarques ont été corrigées. Un quatrième tour a relevé 14 points (dont B11a, B11b, B11c et ce que Q2c doit modifier dans la porte déjà livrée), corrigés puis relus ; un cinquième tour a relevé 14 autres points (Q5 et Q6 de la grille, objet mesuré de H-2 à H-4, juge unique du saut de niveau, W01 non codé, exceptions `lone_h3`, fichiers de Q2c, rangement des tests), corrigés mais **non relus**. Les choix de conception tranchés à cette occasion sont listés en fin de § 15 du document, à valider.

Aucun fichier de code n'est modifié. Aucune PR n'est ouverte.

VERDICT OPUS : À CORRIGER (points du tour 5 corrigés, non relus)
