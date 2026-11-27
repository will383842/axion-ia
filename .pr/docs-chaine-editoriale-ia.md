# Conception de la chaîne éditoriale IA (qualité à la source)

## Ce que fait cette PR

Elle ajoute un seul document : `docs/pilotage-seo-geo/CONCEPTION-CHAINE-EDITORIALE-IA.md`. **Aucun code, aucune migration.** C'est un plan.

## Ce que dit le plan

- **Pourquoi les contenus actuels sont faibles** (preuves dans le code) : un seul passage par gpt-4o, aucun fait sourcé (`CHIFFRES_VERIFIES` est vide), même plan en 8 sections pour tous, questions « People Also Ask » inventées, aucun expert, sujets choisis par rotation, aucun retour des résultats. Un article noté 75 ou plus part sans qu'un modèle l'ait relu. Une équipe Claude existe déjà mais elle est éteinte par défaut.
- **La chaîne cible, en huit rôles** : chercheur de besoins réels, brief (angle unique), faits sourcés et datés, rédacteur, expert dirigeant de PME, vérificateur de faits, éditeur, porte qualité (dernier filet). Un contenu refusé est réécrit sur la partie en cause, 2 fois au plus, puis **abandonné** : jamais publié faible.
- **Modèles** : Opus pour le brief, la rédaction et l'expert ; Sonnet ailleurs ; jamais Fable.
- **Coût** (estimation à mesurer) : 1,3 à 1,6 $ pour un passage complet, environ 3,5 à 6 $ par contenu publié. Avec 200 $/mois : **10 à 30 contenus publiés par mois au départ**, limités par la relecture humaine plus que par le budget.
- **Boucle d'amélioration** : chaque refus et sa raison sont enregistrés, chaque contenu publié est suivi, une analyse chaque semaine propose des changements, **appliqués seulement après relecture de Will**, avec retour arrière.
- **Rythme** : il découle de ce qui passe. Aucun quota.
- **Console** : cinq vues (entonnoir, raisons de refus, coût, résultats, propositions), chacune alimentée par une table réelle.
- **Découpage en 17 petites PR**, avec ce qu'on peut faire tout de suite : mesurer le coût réel (C1), arrêter la publication faible y compris les actualités RSS (C2), auditer les pages déjà publiées (C2b).

## À savoir

- La conception de la porte qualité (`docs/porte-qualite-contenus`) n'existait pas encore : l'interface avec elle est proposée au § 8, à aligner ensuite.
- La recherche sur Google et les IA n'a pas pu lire les pages `developers.google.com` en texte intégral ; le document le dit et sépare faits sourcés, hypothèses et non vérifié.
- **Décisions demandées à Will (§ 14)** : la règle « jamais partout en France » est **contraire** au code actuel, qui l'impose comme formule de remplacement de « Grenoble » ; la persona « Manon » ; l'arrêt de la publication automatique ; les données de demandes reçues autorisées ; le budget ; le relecteur.

Une critique par un second agent a relevé des erreurs (tâche déjà livrée, coût du web sous-estimé, volume incohérent avec les plafonds, risque du corpus existant) : elles sont corrigées dans le document, **mais la version corrigée n'a pas été relue une seconde fois par un agent Opus** : le dernier verdict rendu par l'agent critique est donc « à corriger ».

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGdCcvz7RZcmTkuxruE

VERDICT OPUS : À CORRIGER
