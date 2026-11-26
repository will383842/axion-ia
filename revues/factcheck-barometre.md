# Vérification des chiffres : Baromètre 2027 IA TPE-PME (V1)

Revue en lecture seule de la branche `data/barometre-2027` (commit lu le 26 novembre 2026) :
`barometre-ia-tpe-pme-v1.md`, `sources.json` (91 entrées) et `questionnaire-brouillon.md`.
Aucun de ces fichiers n'a été modifié.

## Méthode

Les trois URL citées ont été téléchargées le 26 novembre 2026 avec `curl -sL` :

| Source | URL | Réponse |
| --- | --- | --- |
| France Num, page de synthèse (publiée le 17/09/2026, mise à jour le 12/11/2026) | https://www.francenum.gouv.fr/guides-et-conseils/strategie-numerique/comprendre-le-numerique/barometre-france-num-2026-le | 200, 90 Ko |
| France Num, rapport complet (PDF de 89 pages, daté du 02/10/2026) | https://www.francenum.gouv.fr/files/2026-09/Barom%C3%A8tre%20France%20Num%202026%20-%20Rapport%20final.pdf | 200, 1,3 Mo |
| Eurostat isoc_eb_ai, tableau web | https://ec.europa.eu/eurostat/databrowser/view/isoc_eb_ai/default/table | 200 (application JavaScript) |
| Eurostat isoc_eb_ai, API JSON (jeu mis à jour le 2026-06-15T11:00+02:00) | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/isoc_eb_ai?format=JSON&lang=EN | 200, 1,06 Mo |

- Page France Num : HTML converti en texte, chaque chiffre recherché dans le texte.
- Rapport PDF : texte extrait page par page (pypdf). La page 54 a en plus été convertie en image (PyMuPDF), parce que l'ordre du texte extrait d'un graphique ne dit pas quelle barre correspond à quel libellé (voir l'écart n° 1).
- Eurostat : chaque valeur lue dans le JSON par ses coordonnées (`geo`, `size_emp`, `time`, `indic_is`, `unit`), périmètre `nace_r2 = C10-S951_X_K` (toutes activités hors agriculture, mines et secteur financier).

Toutes les URL répondent. Aucune source n'est inaccessible.

## Écarts trouvés (à corriger)

1. **Automatisation 11 % / analyse de données 9 % : les deux sources se contredisent, et la V1 ne le dit pas.**
   La page web donne « automatisation des tâches : 11 % (+6 pts) » et « analyse de données, prévision, optimisation : 9 % (+4 pts) ».
   Le rapport, p. 54 (graphique, vérifié sur l'image de la page), donne l'inverse : « Analyse de données, prévision, optimisation des ressources » **11 %** (+6 pts), « Automatisation des tâches » **9 %** (+4 pts).
   La V1 (§ 3 et `sources.json` n° 25 et 26) reprend la page sans signaler l'écart, alors qu'elle signale les deux autres (46/47 % et 13/14 %), et le § 7 affirme que ces deux-là sont les seuls « écarts constatés ».
   Correction : écrire les deux valeurs pour chacun des deux usages, comme pour les deux autres écarts, et l'ajouter à la liste du § 7. Exemple : « automatisation des tâches : 11 % sur la page de présentation, 9 % dans le rapport complet (p. 54) ; analyse de données, prévision, optimisation : 9 % sur la page, 11 % dans le rapport ». Au § 6.3, « 9-11 % » reste juste.

2. **« 52 % des solutions gratuites seulement » : la question de la source porte sur « principalement ».**
   Rapport p. 55 : la question est « Utilisez-vous **principalement** des solutions d'IA ? », réponses : gratuites 52 %, payantes 20 %, les deux 28 % (base : 4 049 utilisateurs d'IA). « 48 % payantes » = 20 + 28 : juste.
   La part qui n'utilise **que** des solutions gratuites est une autre mesure, p. 58 : « Non, je n'utilise que des solutions gratuites » **50 %**.
   Correction (§ 3) : « 52 % utilisent principalement des solutions gratuites (rapport p. 55) » ou « 50 % n'utilisent que des solutions gratuites (rapport p. 58) ».

3. **La mention « chiffre mis à jour le 2 octobre 2026 » est attribuée au mauvais document.**
   § 7 : « Le rapport complet porte en outre la mention "chiffre mis à jour le 2 octobre 2026" ». Cette mention n'apparaît pas dans le PDF (recherche de « mis à jour » et « erreur de calcul » : aucun résultat). Elle est sur la **page web** : « 21 % des TPE PME connaissent France Num (+3 points). [Chiffre mis à jour le 2 octobre 2026 suite à une erreur de calcul] ».
   Correction : « La page de présentation porte la mention… ».

4. **Phrase fausse au § 6.1.** « ne pas s'y être intéressé place désormais en minorité de l'échantillon une TPE-PME sur deux. » Avec 40 % d'utilisatrices, les **non**-utilisatrices sont la **majorité** (60 %) des TPE-PME. Seules les PME (53 % d'utilisatrices) sont dans le cas inverse. En outre, la source mesure l'usage, pas l'intérêt.
   Correction : « Quatre entreprises sur dix déclarent en utiliser (40 %, France Num 2026) ; chez les PME de 10 à 249 salariés, les utilisatrices sont désormais majoritaires (53 %). »

5. **Écart de la source non signalé dans la méthodologie (mineur).** § 7 : « en ligne (8 843) et par téléphone (802) » ; or 8 843 + 802 = 9 645, et non 9 655. Les chiffres de la V1 sont fidèles à la page, mais c'est la source qui ne fait pas le compte.
   Correction : ajouter « (la somme, 9 645, diffère de 10 du total annoncé par la source) ».

6. **Freins Eurostat : chiffres justes, mais l'unité retenue les rend presque illisibles (recommandation, pas une erreur).**
   Les huit valeurs du § 4 sont exactes, en unité `PC_ENT` (part de **toutes** les entreprises de 10 salariés ou plus). La V1 le dit. Mais le même jeu publie l'unité `PC_ENT_AI_EC` (part des entreprises qui **ont envisagé** l'IA sans l'utiliser), qui est la lecture habituelle d'Eurostat pour les freins. UE27 2025 : manque de compétences **70,31 %**, incertitude juridique 53,61 %, protection des données 52,72 %, disponibilité ou qualité des données 43,51 %, incompatibilité 41,60 %, coûts 38,37 %, éthique 24,64 %, IA jugée inutile 17,79 %.
   Au § 6.5, « le manque de compétences est le frein le plus cité (7,76 %) » est juste mais fait passer un frein majeur pour marginal.
   Correction proposée : garder 7,76 % et ajouter « soit 70,31 % des entreprises qui ont envisagé l'IA sans l'adopter (Eurostat isoc_eb_ai, unité PC_ENT_AI_EC, UE27, 2025) ». Le classement est le même dans les deux unités.

Aucun chiffre n'est inventé ou extrapolé. Aucun n'a été arrondi sans le dire. Tous ont la bonne année, le bon pays et la bonne taille d'entreprise, sauf les points 1 et 2 (valeur contradictoire ou mal libellée).

## Tableau de vérification, chiffre par chiffre

Abréviations : « page » = page de synthèse France Num ; « p. NN » = page du rapport complet PDF ; « API » = API Eurostat isoc_eb_ai. Le n° renvoie à l'entrée de `sources.json` (de 0 à 90) ; « md » = chiffre présent seulement dans `barometre-ia-tpe-pme-v1.md`.

### Baromètre France Num 2026 : adoption

| N° | Chiffre | Verdict | Correction proposée / preuve |
| --- | --- | --- | --- |
| 0 | 40 % des TPE-PME utilisent au moins une solution d'IA (2026) | OK | page (« En 2026, 40 % des TPE PME… ») ; p. 53 |
| 1 | 13 % en 2024 | OK | page ; p. 53 |
| 2 | 26 % en 2025 | OK | p. 53 ; cohérent avec « +14 points » sur la page |
| md | 5 % en 2023 | OK | p. 53 |
| 3 | TPE 38 % (2026) | OK | p. 53 et p. 54 |
| md | TPE 4 % (2023), 12 % (2024), 24 % (2025) | OK | p. 53 |
| 4 | PME 53 % (2026) | OK | page ; p. 53 |
| 5 | PME 34 % (2025) | OK | page (« passée de 34 à 53 % ») ; p. 53 |
| 6 | PME 16 % (2024) | OK | page ; p. 53 |
| 7 | 1 à 4 salariés : 36 % | OK | p. 54 |
| 8 | 5 à 9 salariés : 44 % | OK | p. 54 |
| 9 | 10 à 19 salariés : 48 % | OK | p. 54 |
| 10 | 20 à 49 salariés : 58 % | OK | p. 54 |
| 11 | 50 à 249 salariés : 62 % | OK | p. 54 |
| 12 | Numérique 72 % (×1,4) | OK | page ; p. 54 |
| 13 | Services spécialisés / techniques 60 % | OK | page ; p. 54 |
| 14 | Activités financières 46 % (page) / 47 % (p. 54) | OK | écart réel entre les deux sources, correctement signalé |
| 15 | Services à la personne 45 % | OK | p. 54 |
| 16 | Commerce (détail et gros) 34 % | OK | p. 54 |
| 17 | Hébergement-Restauration 34 % | OK | p. 54 |
| 18 | Bâtiment-Construction 30 % (×2) | OK | page ; p. 54 |
| 19 | Transport-Logistique 29 % | OK | page ; p. 54 |
| 20 | Agroalimentaire 27 % | OK | page ; p. 54 (« IAA 27 % ») |
| 21 | Agriculture 18 % (×2) | OK | page ; p. 54 |
| md | Multiplicateur de 1,4 à 2 | OK | page (×1,4 à ×2 sur les 7 secteurs listés) |
| 39 | Dirigeant de moins de 30 ans : 57 % | OK | p. 54 |
| 40 | Dirigeant de plus de 71 ans : 25 % | OK | p. 54 |
| 41 | Dirigeant au-dessus de Bac+3 : 53 % | OK | p. 54 |
| 42 | Dirigeant sous le Bac : 20 % | OK | p. 54 |
| 43 | BtoB 48 % / BtoC 33 % | OK | p. 54 |

### Baromètre France Num 2026 : usages, payant, impact, compétences

| N° | Chiffre | Verdict | Correction proposée / preuve |
| --- | --- | --- | --- |
| 22 | Génération de contenus 34 % (+12 pts) | OK | page ; p. 54 |
| 23 | Assistants conversationnels, chatbots, recherche d'informations 24 % (+10 pts) | OK | p. 54 (libellé avec « recherche d'informations ») ; page (« assistants conversationnels et chatbots : 24 % ») |
| 24 | Analyse et classification de documents 13 % (page) / 14 % (p. 54) | OK | écart réel, signalé. Les hausses diffèrent aussi (page +7 pts, p. 54 +8 pts) ; la V1 n'en donne pas |
| 25 | Automatisation des tâches 11 % | NON VÉRIFIABLE (sources contradictoires) | page : 11 % (+6) ; **p. 54 : 9 % (+4)**. Donner les deux valeurs (écart n° 1) |
| 26 | Analyse de données, prévision, optimisation 9 % | NON VÉRIFIABLE (sources contradictoires) | page : 9 % (+4) ; **p. 54 : 11 % (+6)**. Donner les deux valeurs (écart n° 1) |
| 27 | Contrôle qualité, détection 4 % | OK | p. 54 (+3 pts) |
| 28 | 68 % des utilisateurs jugent l'impact positif (base 4 049) | OK | page ; p. 57 (24 % tout à fait + 44 % plutôt d'accord) |
| 29 | 84 % chez les utilisateurs de solutions payantes | OK | page ; p. 57 |
| 30 | 56 % chez les utilisateurs de solutions gratuites | OK | p. 57 |
| md | 28 % ni d'accord ni pas d'accord | OK | p. 57 |
| 31 | 19 % de l'ensemble des TPE-PME recourent à des solutions payantes | OK | page |
| 32 | 32 % des PME | OK | page |
| 33 | 48 % des utilisateurs d'IA emploient des solutions payantes | OK | p. 55 (20 % payantes + 28 % les deux) |
| md | « 52 % des solutions gratuites seulement » | FAUX (libellé) | p. 55 mesure « principalement » : « 52 % principalement gratuites » ; « seulement gratuites » = **50 %** (p. 58). Écart n° 2 |
| 34 | 51 % des utilisateurs ont des compétences en IA, dont 40 % en interne | OK | p. 56 (40 interne + 7 externe + 4 les deux = 51) |
| 35 | 18 % cherchent à en acquérir | OK | p. 56 (16 + 2 + 0) |
| 36 | 31 % sans compétence ni projet | OK | p. 56 |
| 37 | 43 % des utilisateurs ont des dépenses d'abonnements et licences | OK | p. 58 (non repris dans la V1) |
| 38 | IA dans les projets numériques 2026-2027 : 18 % | OK | page (« 18 % (-1 pt) ») ; non repris dans la V1 |

### Baromètre France Num 2026 : autres indicateurs

| N° | Chiffre | Verdict | Correction proposée / preuve |
| --- | --- | --- | --- |
| 44 | 53 % des dirigeants craignent la perte de données ou le piratage | OK | page |
| 45 | 39 % ont subi au moins un incident cyber sur 12 mois | OK | page |
| 46 | 71 % estiment que le numérique apporte un bénéfice réel (−7 pts, baisse plus nette chez les TPE) | OK | page (TPE −8 pts, PME 83 % −1 pt) |
| 47 | 66 % disposent de compétences numériques | OK | page (non repris dans la V1) |
| 48 | 21 % ont suivi une formation au numérique en 2025 | OK | page (non repris dans la V1) |
| md | 33 % sans dépense numérique (+8 pts) | OK | page |

### Baromètre France Num 2026 : méthodologie (§ 7)

| Chiffre | Verdict | Correction proposée / preuve |
| --- | --- | --- |
| 9 655 répondants, 6 786 TPE dont 799 sans salarié, 2 869 PME | OK | page, « Méthodologie de l'enquête » |
| Du 23 mars au 18 avril 2026 | OK | page |
| En ligne 8 843 / téléphone 802 | OK (fidèle à la source) | la somme fait 9 645, pas 9 655 : le signaler (écart n° 5) |
| Représentatif de la population 2024 ; marge d'erreur < 1 % | OK | page |
| Page publiée le 17/09/2026, mise à jour le 12/11/2026 ; PDF daté du 02/10/2026 | OK | en-tête de la page ; pied de page du PDF |
| « Chiffre mis à jour le 2 octobre 2026 » dans le rapport complet | FAUX (mal attribué) | la mention est sur la **page web**, pas dans le PDF (écart n° 3) |

### Eurostat isoc_eb_ai : au moins une technologie d'IA (`E_AI_TANY`, unité `PC_ENT`)

| N° | Chiffre | Verdict | Valeur API |
| --- | --- | --- | --- |
| 49 | France, 10 sal. ou plus, 2024 : 9,91 % | OK | 9.91 |
| 50 | France, 10 sal. ou plus, 2025 : 18,16 % | OK | 18.16 |
| 51 | France, 10-49, 2024 : 8,51 % | OK | 8.51 |
| 52 | France, 10-49, 2025 : 15,04 % | OK | 15.04 |
| 53 | France, 50-249, 2024 : 14,52 % | OK | 14.52 |
| 54 | France, 50-249, 2025 : 30,81 % | OK | 30.81 |
| 55 | France, 250 ou plus, 2024 : 32,74 % | OK | 32.74 |
| 56 | France, 250 ou plus, 2025 : 58,01 % | OK | 58.01 |
| 57 | UE27, 10 sal. ou plus, 2024 : 13,48 % | OK | 13.48 |
| 58 | UE27, 10 sal. ou plus, 2025 : 19,95 % | OK | 19.95 |
| 59 | UE27, 10-49, 2024 : 11,21 % | OK | 11.21 |
| 60 | UE27, 10-49, 2025 : 17,00 % | OK | 17.0 |
| 61 | UE27, 50-249, 2024 : 20,97 % | OK | 20.97 |
| 62 | UE27, 50-249, 2025 : 30,36 % | OK | 30.36 |
| 63 | UE27, 250 ou plus, 2024 : 41,17 % | OK | 41.17 |
| 64 | UE27, 250 ou plus, 2025 : 55,03 % | OK | 55.03 |
| md | « Eurostat ne publie pas cet indicateur pour les moins de 10 salariés » | OK | les classes `0_1`, `0-9`, `2-9` existent dans le jeu, mais sans aucune valeur pour la France ni l'UE27 |
| md | « France au niveau de l'UE27 ou au-dessus pour 50 salariés ou plus en 2025 » | OK | 30,81 > 30,36 ; 58,01 > 55,03 |

### Eurostat : technologies et finalités (France ou UE27, 10 salariés ou plus, 2025, unité `PC_ENT`)

| N° | Chiffre | Verdict | Valeur API |
| --- | --- | --- | --- |
| 65 | FR, analyse de texte : 10,23 % | OK | E_AI_TTM 10.23 |
| 66 | FR, génération de langage écrit/parlé ou de code : 7,82 % | OK | E_AI_TNLG 7.82 |
| 67 | FR, génération d'images, vidéo, son : 7,50 % | OK | E_AI_TPVSG 7.5 |
| 68 | FR, reconnaissance vocale : 6,14 % | OK | E_AI_TSR 6.14 |
| 69 | FR, automatisation de processus : 4,48 % | OK | E_AI_TPA 4.48 |
| 70 | FR, apprentissage automatique : 4,23 % | OK | E_AI_TML 4.23 |
| 71 | FR, reconnaissance d'images : 3,69 % | OK | E_AI_TIR 3.69 |
| 72 | FR, robots autonomes : 1,73 % | OK | E_AI_TAR 1.73 |
| 73 | FR, production : 3,79 % | OK | E_AI_PPP 3.79 |
| 74 | FR, sécurité informatique : 3,16 % | OK | E_AI_PITS 3.16 |
| 75 | FR, logistique : 1,15 % | OK | E_AI_PLOG 1.15 |
| md | FR, marketing / administration / finance « sans valeur publiée » | OK | valeur nulle, statut `u` (faible fiabilité) pour PMS, PBAM, PFIN (et PRDI) |
| 76 | UE27, marketing ou ventes : 6,92 % | OK | E_AI_PMS 6.92 |
| 77 | UE27, administration et gestion : 6,19 % | OK | E_AI_PBAM 6.19 (« business administration processes **or management** ») |
| 78 | UE27, comptabilité, finance : 4,61 % | OK | E_AI_PFIN 4.61 |
| 79 | UE27, production : 4,14 % | OK | E_AI_PPP 4.14 |
| 80 | UE27, sécurité informatique : 3,94 % | OK | E_AI_PITS 3.94 |
| 81 | UE27, R&D, innovation : 3,80 % | OK | E_AI_PRDI 3.8 |
| 82 | UE27, logistique : 1,21 % | OK | E_AI_PLOG 1.21 |

### Eurostat : freins (UE27, 10 salariés ou plus, 2025)

| N° | Chiffre (unité `PC_ENT`) | Verdict | Valeur API `PC_ENT` | Même frein, unité `PC_ENT_AI_EC` (entreprises ayant envisagé l'IA) |
| --- | --- | --- | --- | --- |
| 83 | Manque de compétences 7,76 % | OK | 7.76 | 70,31 % |
| 84 | Incertitude juridique 5,92 % | OK | 5.92 | 53,61 % |
| 85 | Protection des données 5,82 % | OK | 5.82 | 52,72 % |
| 86 | Disponibilité ou qualité des données 4,80 % | OK | 4.8 | 43,51 % |
| 87 | Incompatibilité avec les systèmes 4,59 % | OK | 4.59 | 41,60 % |
| 88 | Coûts jugés trop élevés 4,24 % | OK | 4.24 | 38,37 % |
| 89 | Considérations éthiques 2,72 % | OK | 2.72 | 24,64 % |
| 90 | IA jugée inutile 1,96 % | OK | 1.96 | 17,79 % |
| md | « Pas de valeur pour la France » | OK | aucune valeur FR, quelle que soit l'unité, en 2023 comme en 2025 | (voir l'écart n° 6) |

Bilan du tableau : 91 entrées de `sources.json` et 16 chiffres propres au `.md`. **89 entrées de `sources.json` OK ; 2 NON VÉRIFIABLES** (n° 25 et 26, les deux sources se contredisent) ; **2 FAUX dans le `.md`** (« gratuites seulement », mention attribuée au rapport) ; **1 phrase fausse** au § 6.1 (écart n° 4).

## Interdits

| Contrôle | Résultat | Détail |
| --- | --- | --- |
| Aucun prix | OK | aucun montant, « € », « prix » ni « tarif » dans les trois fichiers. « Coûts jugés trop élevés » (frein Eurostat) et « Coût perçu » (question 10) ne sont pas des prix |
| Jamais « Grenoble » | OK | aucune occurrence (ni « Isère ») |
| Aucune garantie de gain | OK | le § 6 dit « ils ne promettent aucun résultat » ; le § 3 précise que la mesure d'impact « ne chiffre pas un gain de temps ou de chiffre d'affaires ». « Gain de temps » n'apparaît que comme réponse possible à la question 9 |
| Pas de Qualiopi ni de financement | OK | aucune occurrence de Qualiopi, OPCO, CPF, subvention, financement ni prise en charge. « Activités financières » est un secteur |
| Aucun nom de client | OK | aucun nom d'entreprise ni de personne. Axion-IA n'est pas citée non plus |

## Questionnaire (`questionnaire-brouillon.md`)

| Contrôle | Verdict | Constat et correction proposée |
| --- | --- | --- |
| Mention RGPD présente | OK, mais incomplète | Elle existe, en tête du formulaire. Il manque : l'identité du responsable du traitement et un contact pour exercer ses droits ; la durée de conservation ; l'outil de collecte et son hébergement. La promesse « anonymes » ne tient que si l'outil n'enregistre ni adresse IP ni e-mail. Les questions ouvertes 15 et 16 peuvent contenir des noms : ajouter « n'indiquez ni nom ni information permettant de vous identifier ». Le croisement région × taille × secteur peut identifier une entreprise rare : ne publier aucune case de moins de 10 réponses (par exemple). |
| 5 minutes maximum | OK, à tester | Estimation plausible (14 questions fermées, 2 ouvertes facultatives), mais à la limite : les questions 2, 7 et 10 ont 10 ou 11 choix. Chronométrer avec 5 personnes avant diffusion. Les notes annoncent « 6 à choix multiple » : on en compte **5** (questions 5, 7, 9, 10 et 14). |
| Q1 à Q8, Q11 et Q12 neutres | OK | formulations factuelles, avec une réponse « Non » ou « Je ne sais pas » quand il le faut |
| Q9 « Quel effet ressentez-vous ? » | À corriger (légèrement orientée) | Elle suppose un effet, et propose 4 réponses positives pour une négative. Proposition : « Quels effets avez-vous constatés, positifs ou négatifs ? », avec en plus « Je ne sais pas encore » et une seconde réponse négative (« Coût ou temps d'apprentissage supérieur au bénéfice »). |
| Q13 « Avez-vous un besoin de formation ou d'accompagnement ? » | À corriger (orientée) | Les réponses sont déséquilibrées : 3 sur 4 vont vers « oui ou peut-être », et « Oui, urgent » arrive en premier. La question suppose aussi un besoin. Comme Axion-IA vend de la formation, cela peut se lire comme une question de prospection. Proposition : « Envisagez-vous, dans les 12 prochains mois, une formation ou un accompagnement sur l'IA ? » avec « Oui / Non / Je ne sais pas ». |
| Q14 « Si oui… » + « Je n'ai pas de besoin » | À corriger (incohérente) | Le filtre « Si oui » rend la réponse « Je n'ai pas de besoin » inutile. Garder l'un ou l'autre. |
| Q10 (freins) | OK, avec une recommandation | La liste est équilibrée et propose « Aucun frein ». Faire varier l'ordre des réponses d'un répondant à l'autre : « Manque de compétences », placé en premier, est aussi le frein principal que le baromètre rapporte (biais d'ordre). |
| Consigne de saut après Q4 | À préciser | « Passer à la question 10 » : les questions 11 à 14 s'appliquent bien à tous, c'est cohérent. Mais Q10 est rédigée pour les deux publics : la reformuler en « Qu'est-ce qui freine (ou freinerait) l'usage de l'IA dans votre entreprise ? ». |
| Comparabilité annoncée avec France Num (Q1) | À corriger | Q1 compte les « personnes, vous compris », France Num compte les **salariés** (1 à 4, 5 à 9…). Les tranches ne se comparent donc pas. Demander « Combien de salariés compte votre entreprise (hors dirigeant) ? » avec « 0 / 1 à 4 / 5 à 9 / 10 à 19 / 20 à 49 / 50 à 249 / 250 ou plus ». |

## Corrections attendues, par ordre d'importance

1. § 3 et `sources.json` n° 25 et 26 : afficher les deux valeurs contradictoires (automatisation 11 % sur la page, 9 % dans le rapport p. 54 ; analyse de données 9 % sur la page, 11 % dans le rapport p. 54) et ajouter cet écart au § 7.
2. § 3 : remplacer « 52 % des solutions gratuites seulement » par « 52 % principalement des solutions gratuites (p. 55) » ou « 50 % n'utilisent que des solutions gratuites (p. 58) ».
3. § 6.1 : remplacer la phrase fausse (« en minorité ») par « chez les PME de 10 à 249 salariés, les utilisatrices sont désormais majoritaires (53 %) ».
4. § 7 : la mention « chiffre mis à jour le 2 octobre 2026 » est sur la page web, pas dans le rapport complet.
5. § 7 : signaler que 8 843 + 802 = 9 645 ≠ 9 655 (écart de la source).
6. § 4 et § 6.5 (recommandé) : ajouter la lecture Eurostat `PC_ENT_AI_EC` (manque de compétences : 70,31 % des entreprises ayant envisagé l'IA, UE27 2025).
7. Questionnaire : compléter la mention RGPD ; neutraliser Q9 et Q13 ; rendre Q14 cohérente ; aligner Q1 sur les salariés ; « 5 questions à choix multiple », pas 6 ; chronométrer avant diffusion.

VERDICT: A CORRIGER — (1) automatisation/analyse de données : sources contradictoires 11 %/9 % (page) contre 9 %/11 % (rapport p. 54), à afficher et signaler ; (2) « 52 % gratuites seulement » → « 52 % principalement gratuites » (p. 55) ou « 50 % seulement gratuites » (p. 58) ; (3) § 6.1, « en minorité » est faux (60 % de non-utilisatrices) ; (4) la mention « mis à jour le 2 octobre 2026 » vient de la page web, pas du rapport ; (5) 8 843 + 802 ≠ 9 655, à signaler ; (6) freins Eurostat : ajouter la lecture PC_ENT_AI_EC (70,31 %) ; (7) questionnaire : RGPD incomplet, Q9 et Q13 orientées, Q14 incohérente, Q1 non comparable à France Num, 5 questions à choix multiple et non 6.
