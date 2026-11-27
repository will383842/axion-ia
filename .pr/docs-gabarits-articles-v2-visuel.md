# docs(gabarits-articles) : refonte visuelle v2 des modèles de pages d'articles

Cette PR contient uniquement des maquettes et de la documentation. Aucun code applicatif n'est touché : `src/` et `prisma/` restent intacts. Aucune URL, aucun slug, aucun canonical ne change.

À ouvrir en premier : `docs/design/gabarits-articles/maquettes-v2/index.html`.

## Pourquoi

Le propriétaire a refusé la première série de maquettes. Son avis : « ça manque de peps, de contraste, d'encadrés ; ça fait textuel ; il faut donner envie de lire jusqu'au bout ; des boutons bien visibles sur le côté (Journée IA, diagnostic 45 min, écrire un message) ; le but : des prospects et de la visibilité ».

## Ce qui change

- **10 nouvelles maquettes** dans `maquettes-v2/`, chacune pour ordinateur et téléphone, sans JavaScript :
  - les 8 modèles du blog : analyse, guide, comparatif, sélection, étude de cas, définition, questions-réponses, chiffres ;
  - **deux pages qui n'étaient pas prévues** : les actualités et les guides pilier.
- **Un en-tête sombre et contrasté** : grand titre avec la fin en italique terracotta, temps de lecture bien visible, et un signe propre à chaque modèle (« RAG. », « A ou B », « Art. 4 »…).
- **Des encadrés de couleur** : à retenir, attention, exemple concret, chiffre clé, citation, cartes, frises, tableaux à coches, checklist, résumé de fin. Chaque fonction a toujours la même couleur. Il y a un élément visuel toutes les deux ou trois sections, et jamais un écran entier de texte seul.
- **Les 3 boutons, toujours visibles** :
  - « Diagnostic IA, 45 min » (libellé exact du site), « Découvrir la Journée IA », « Écrire un message » ;
  - sur ordinateur, une carte dès le premier écran qui reste collée pendant la lecture, plus un bouton Diagnostic dans le bandeau du site ;
  - sur téléphone, une barre fixe en bas de l'écran.
- **Un encart d'action au milieu et un en fin d'article**, adaptés à chaque modèle. Le bouton mis en avant suit l'intention du lecteur : Journée IA pour un guide, « Écrire un message » pour une FAQ, etc.
- **Une barre de lecture** en haut de page (CSS seul), des intertitres en questions et des relances « Dans la suite : … ».
- **`PLAN.md`** (nouveau §15) : « plusieurs appels à l'action » remplace « un seul ». Il décrit aussi la bibliothèque d'encadrés, les nouveaux composants, l'extension aux actualités et aux guides, et ce qui a été tranché pendant l'arbitrage.
- **`DECOUPAGE.md`** : S2 et G1 à G8 sont révisées, et deux PR s'ajoutent, **A1** (actualités) et **GU1** (guides), avec leurs dépendances et les fichiers touchés.
- **Changement de stratégie CSS** : la CSS des modèles ne sera **plus** ajoutée à `globals.css`, ce qui alourdirait chaque page du site d'environ 18 Ko gz. Elle sera importée par les seules pages d'articles.

## Avis des spécialistes

- **Direction artistique** : le noir mocha, le terracotta et le bleu sont utilisés en aplats francs, et chaque modèle a son propre visuel. On reste sur les jetons de la marque et les polices existantes, sans nouvelle graisse.
- **Conversion** : les trois actions sont présentes à tout moment, avec un bouton principal qui change selon le modèle. Tous les libellés viennent du site : aucun prix, aucun faux témoignage, et Qualiopi n'est affiché que si la certification est publiée.
- **Lisibilité** : chaque page commence par une réponse directe de 40 à 60 mots, les intertitres sont des questions et les paragraphes sont courts. Un résumé visuel en fin de page aide à lire jusqu'au bout.
- **Accessibilité** : les contrastes de tous les textes visibles ont été mesurés par script et sont tous au-dessus de 4,5:1. Le focus est visible sur tous les fonds, les cibles font 44 px et aucun élément ne se cache sous la barre mobile. Le mouvement réduit et les couleurs forcées sont respectés.
- **Performance** : aucun JavaScript, aucune police ajoutée. Le décalage de mise en page est nul, et reste inférieur à 0,011 même quand les polices arrivent en retard. Point d'attention : la CSS doit être chargée par les seules pages d'articles.
- **SEO / GEO** : les 3 boutons sont dans un seul élément, placé hors de l'article, donc il n'y a pas de doublon de liens. Les attributs lus par les moteurs et les IA sont conservés (réponse directe, ancres, données structurées). Deux défauts existants des pages guides sont signalés : fil d'Ariane en double et durée HowTo fausse.

## Points à trancher par le propriétaire

- **Bouton « Diagnostic IA, 45 min » dans le bandeau du site** : il toucherait toutes les pages, donc il ferait l'objet d'une PR à part.
- **Chiffres des maquettes** : ce sont des exemples d'illustration, à revérifier avant toute publication. En production, seuls les chiffres issus de données vérifiées sont affichés.
- **Vérification hors Chromium** : Safari et Firefox restent à tester au moment de l'implémentation.

## Arbitrage qualité

Deux tours d'arbitrage :

- **Tour 1** : note moyenne de 7,9/10, verdict « à corriger ». Le principal reproche : sur ordinateur, aucun bouton n'était visible au premier écran.
- **Tour 2** : note moyenne de 8,7/10. Les 14 corrections demandées sont faites, et les derniers petits points (décomptes des sommaires, crédit photo) aussi.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGemsxSCQ32uNiGg6t3

VERDICT OPUS : BON
