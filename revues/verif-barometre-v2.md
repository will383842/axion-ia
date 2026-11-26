# Vérification n° 2 : Baromètre 2027 IA TPE-PME, après corrections

Revue en lecture seule de la branche `data/barometre-2027`, commit `9964ee5ef` (« corrections après vérification des faits »), le 26 novembre 2026.
Fichiers lus : `data/barometre-2027/barometre-ia-tpe-pme-v1.md`, `sources.json` (93 entrées, numérotées de 0 à 92) et `questionnaire-brouillon.md`.
Première vérification : `revues/factcheck-barometre.md` sur la branche `revue/barometre-2027` (7 corrections demandées).
Aucun fichier de la branche `data/barometre-2027` n'a été modifié.

## Méthode

Les trois sources citées ont été téléchargées à nouveau le 26 novembre 2026 (`curl -sL`) :

| Source | Réponse | Lecture |
| --- | --- | --- |
| Page de synthèse France Num (publiée le 17/09/2026, mise à jour le 12/11/2026) | 200, 89 959 octets | HTML converti en texte, chaque chiffre recherché |
| Rapport complet France Num (PDF de 89 pages, daté du 02/10/2026) | 200, 1 296 699 octets | texte extrait page par page (PyMuPDF) ; pages 6, 8 et 54 converties en image et lues à l'œil |
| API Eurostat `isoc_eb_ai` (JSON, jeu mis à jour le 2026-06-15T11:00+02:00) | 200, 1 064 729 octets | chaque valeur lue par ses coordonnées (`geo`, `size_emp`, `time`, `indic_is`, `unit`, `nace_r2 = C10-S951_X_K`) |

Les 93 entrées de `sources.json` et les chiffres propres au `.md` ont été recomparés un par un, y compris ceux que la première vérification avait jugés justes.

## 1. Les 7 corrections demandées

| N° | Correction demandée | Verdict | Constat |
| --- | --- | --- | --- |
| 1 | Automatisation / analyse de données : afficher les deux valeurs contradictoires et le signaler au § 7 | **FAITE** | § 3, § 6.3 et § 7 donnent les deux valeurs ; `sources.json` n° 25 et 26 aussi, avec les hausses (+6/+4). Revérifié sur l'image de la p. 54 : « Analyse de données, prévision, optimisation des ressources » 11 % (+6 pts), « Automatisation des tâches » 9 % (+4 pts) ; page web : automatisation 11 % (+6), analyse de données 9 % (+4). Détail sans conséquence : le champ `url` des n° 25 et 26 pointe seulement vers la page web alors que la valeur cite aussi le rapport. |
| 2 | « 52 % gratuites seulement » → « principalement » (p. 55) ou « 50 % seulement » (p. 58) | **FAITE dans le `.md`, mais l'erreur inverse est entrée dans `sources.json`** | § 3 est juste (52 % principalement gratuites, p. 55 ; 50 % n'utilisent que des gratuites, p. 58). Mais le n° 33 porte maintenant le libellé « payantes **seules** 20 % + les deux 28 % » : la p. 55 pose la question « Utilisez-vous **principalement** des solutions d'IA ? » ; 20 % = « principalement payantes », pas « payantes seules ». Corriger en « principalement payantes 20 % + les deux 28 % ». |
| 3 | § 6.1 : remplacer la phrase fausse sur la « minorité » | **FAITE** | « chez les PME de 10 à 249 salariés, les utilisatrices sont désormais majoritaires (53 %) » : juste (p. 53 et page web). |
| 4 | La mention « chiffre mis à jour le 2 octobre 2026 » est sur la page web | **FAITE** | Le § 7 attribue désormais la mention à la page, avec le chiffre concerné (21 %, +3 points) : conforme à la page. Absence confirmée dans le PDF (aucun « mis à jour », aucune « erreur de calcul »). Voir toutefois l'écart B ci-dessous sur la phrase qui suit. |
| 5 | Signaler que 8 843 + 802 ≠ 9 655 | **FAITE comme demandé, mais le constat est FAUX — à reprendre** | Le rapport complet, **p. 6** (vérifié sur l'image), donne : « 8 843 réponses obtenues en ligne (10 219 en 2025) » et « **812** réponses obtenues par téléphone (**802 en 2025**) ». 8 843 + 812 = **9 655** : le total est juste. Le 802 de la page web est le chiffre de téléphone **de 2025**, recopié par erreur. La phrase ajoutée au § 7 (« la somme, 9 645, diffère de 10 du total annoncé par la source ») attribue à la source une incohérence que la source elle-même résout. La première vérification avait raté la p. 6 ; l'erreur vient d'elle, pas de la rédaction. |
| 6 | Freins Eurostat : ajouter la lecture `PC_ENT_AI_EC` | **FAITE** | Les 8 valeurs sont exactes (API) : 70,31 ; 53,61 ; 52,72 ; 43,51 ; 41,60 ; 38,37 ; 24,64 ; 17,79 %. L'unité `PC_ENT_AI_EC` est libellée par Eurostat « Percentage of the enterprises which ever considered to use any of the AI technologies » ; appliquée aux indicateurs « Enterprises do not use AI technologies, because… », la lecture « entreprises qui ont envisagé l'IA sans l'utiliser » est correcte. « Même classement » : vrai. Le § 6.5 et `sources.json` n° 83 à 90 sont à jour. Détail : « lecture **plus courante** d'Eurostat » est une appréciation sans source ; écrire « autre lecture publiée par Eurostat ». |
| 7 | Questionnaire : RGPD, Q9, Q13, Q14, Q1, décompte, chronométrage | **PARTIELLEMENT FAITE** | Q9 (« Quels effets avez-vous constatés, positifs ou négatifs ? » + 2 réponses ajoutées), Q13 (Oui / Non / Je ne sais pas), Q14 (filtre seul), Q10 (reformulée, ordre aléatoire), Q1 (salariés hors dirigeant : 0 / 1-4 / 5-9 / 10-19 / 20-49 / 50-249, identique aux 6 tranches France Num p. 8), décompte (5 questions à choix multiple : 5, 7, 9, 10, 14, recompté) et chronométrage : faits. **La mention RGPD n'est pas complète** : trois champs restent « [à compléter] » et des éléments obligatoires manquent (voir § 4). |

Bilan : 5 corrections faites (1, 3, 4, 6 et, dans le `.md`, 2) ; 1 faite mais fondée sur un constat faux (5) ; 1 partielle (7) ; et la correction 2 a introduit un libellé faux dans `sources.json` (n° 33).

## 2. Revérification de chaque chiffre restant

### Écarts nouveaux (non relevés par la première vérification)

**A. Téléphone : 812, pas 802** (voir correction 5). § 7 du `.md` à corriger : « en ligne (8 843) et par téléphone (812, rapport p. 6 ; la page web indique 802, qui est le chiffre de 2025) ». Retirer la phrase sur la somme qui « diffère de 10 ». Le même passage figure dans la section « Corrections apportées après vérification » (« l'écart 8 843 + 802 = 9 645 ≠ 9 655 est signalé ») : à reprendre aussi.

**B. « Le jeu de chiffres a été corrigé après publication ; en cas de doute, la version en ligne fait foi » (§ 7).** Deux affirmations non sourcées :
- la page ne signale la correction que d'**un** chiffre (la notoriété de France Num, 21 %) : on ne peut pas en déduire que « le jeu de chiffres » a été corrigé ;
- « la version en ligne fait foi » n'est écrit nulle part, et c'est démenti par les faits : la page porte le 802 erroné (écart A), et pour automatisation / analyse de données on ne sait pas laquelle des deux sources a raison.
Correction : « La page de présentation signale qu'un chiffre (la notoriété de France Num, 21 %, +3 points) a été mis à jour le 2 octobre 2026 après une erreur de calcul. Quand la page et le rapport divergent, les deux valeurs sont données. »

**C. Eurostat compte des « personnes occupées », pas des « salariés ».** L'API libelle les classes de taille « 10 persons employed or more », « From 10 to 49 persons employed », etc. (dirigeants, associés et indépendants compris). Le `.md` (§ 1.3, § 2, § 4, § 5, § 7) et `sources.json` (n° 49 à 90, champ `perimetre`) écrivent « 10 salariés ou plus ». Les valeurs sont justes, le périmètre est mal nommé. Correction : « entreprises de 10 personnes occupées ou plus » (formulation de l'INSEE pour cette enquête), et ajouter dans le § 7 que France Num compte des salariés et Eurostat des personnes occupées — c'est une raison de plus pour laquelle « les deux séries ne se comparent pas directement » (§ 2, phrase déjà présente et juste).

**D. `sources.json` n° 33 : « payantes seules »** (voir correction 2).

### Remarques mineures (pas des erreurs de chiffre)

- § 7 : la page dit que l'étude a été confiée « au Crédoc **et au Centre Relations Clients** » ; le `.md` ne cite que le Crédoc. Ajouter le second prestataire.
- § 7 : la représentativité porte sur « 13 régions France métropolitaine » (rapport p. 6 ; la Corse est regroupée avec PACA, p. 8). Le `.md` dit « région » sans préciser : ajouter « France métropolitaine ».
- Le rapport n'est pas cohérent avec lui-même sur les entreprises sans salarié : 799 (p. 6 et page web) contre 874 « en brut » (p. 8). Le `.md` reprend 799, comme la page : à garder, éventuellement avec une note.
- § 3 : « 48 % emploient des solutions payantes » est la formule du rapport (p. 55, titre). Pour éviter qu'on le lise comme le complément du « 50 % n'utilisent que des gratuites » (p. 58, autre question, 48 + 50 ≠ 100), préciser : « 48 % utilisent principalement des solutions payantes (20 %) ou les deux (28 %) ».

### Chiffres revérifiés et justes

France Num, page web et rapport (pages citées) :

| Chiffres | Source relue | Verdict |
| --- | --- | --- |
| 40 % (2026), 26 % (2025), 13 % (2024), 5 % (2023) ; « +14 points », « ×3 en deux ans » | page ; p. 53 | OK |
| TPE 38 / 24 / 12 / 4 % ; PME 53 / 34 / 16 % | page ; p. 53 | OK |
| 1-4 sal. 36 %, 5-9 sal. 44 %, 10-19 sal. 48 %, 20-49 sal. 58 %, 50-249 sal. 62 % | p. 54 | OK |
| Numérique 72 % (×1,4), Services spécialisés 60 % (×1,5), Activités financières 46 % page / 47 % p. 54, Services à la personne 45 %, Commerce 34 %, Hébergement-Restauration 34 %, Bâtiment 30 % (×2), Transport 29 % (×1,8), Agroalimentaire / IAA 27 % (×1,8), Agriculture 18 % (×2) ; multiplicateur de 1,4 à 2 | page ; p. 54 | OK |
| Dirigeant < 30 ans 57 %, > 71 ans 25 % ; > Bac+3 53 %, < Bac 20 % ; BtoB 48 %, BtoC 33 % | p. 54 | OK |
| Génération de contenus 34 % (+12), chatbot / assistant / recherche 24 % (+10), documents 13 % (+7) page / 14 % (+8) p. 54, contrôle qualité 4 % (+3) ; base : échantillon total (9 655) | page ; p. 54 (image) | OK |
| Gratuites 52 % / payantes 20 % / les deux 28 % ; 48 % (base 4 049) ; 50 % seulement gratuites ; 43 % abonnements-licences | p. 55 ; p. 58 | OK (libellé du n° 33 : écart D) |
| Impact positif 68 % (24 + 44), ni accord ni désaccord 28 %, payantes 84 %, gratuites 56 % | page ; p. 57 | OK |
| 19 % de l'ensemble et 32 % des PME en solutions payantes | page | OK |
| Compétences IA 51 % (40 interne + 7 externe + 4 les deux), 18 % en cours, 31 % ni compétence ni projet | p. 56 | OK |
| Questions impact, compétences, payant, dépenses « nouvelles en 2026 » | p. 55 à 58 (« *nouvelle question en 2026 ») | OK |
| 53 % craignent la perte de données (+1 pt) ; 39 % incident cyber 12 mois ; 71 % bénéfice réel (−7 pts, TPE −8 pts) ; 66 % compétences numériques ; 21 % formés au numérique en 2025 ; 33 % sans dépense numérique (+8 pts) ; IA dans les projets 2026-2027 18 % | page | OK |
| 9 655 répondants, 6 786 TPE dont 799 sans salarié, 2 869 PME ; 23 mars – 18 avril 2026 ; en ligne 8 843 ; représentatif population 2024 (taille, secteur, région) ; marge d'erreur < 1 % (95 %, 2,4 millions d'entreprises) | page ; p. 6 | OK (téléphone : écart A) |
| Page publiée le 17/09/2026, mise à jour le 12/11/2026 ; PDF daté du 02/10/2026 (pied de page et métadonnées : création 2026-10-02) | page ; PDF | OK |

Eurostat `isoc_eb_ai`, valeurs de l'API (toutes égales à celles du `.md` et de `sources.json`) :

| Indicateur | Valeurs |
| --- | --- |
| Au moins une technologie d'IA (`E_AI_TANY`, `PC_ENT`), FR 2024 / 2025 | 10+ : 9,91 / 18,16 ; 10-49 : 8,51 / 15,04 ; 50-249 : 14,52 / 30,81 ; 250+ : 32,74 / 58,01 |
| Idem, UE27 2024 / 2025 | 10+ : 13,48 / 19,95 ; 10-49 : 11,21 / 17,00 ; 50-249 : 20,97 / 30,36 ; 250+ : 41,17 / 55,03 |
| Technologies, FR 2025 | texte 10,23 ; langage / code 7,82 ; images-vidéo-son 7,50 ; vocal 6,14 ; automatisation de processus 4,48 ; apprentissage automatique 4,23 ; reconnaissance d'images 3,69 ; robots 1,73 |
| Finalités, FR 2025 | production 3,79 ; sécurité informatique 3,16 ; logistique 1,15 ; marketing, administration, finance, R&D : valeur nulle, statut `u` (= « pas de valeur publiée », juste) |
| Finalités, UE27 2025 | marketing-ventes 6,92 ; administration 6,19 ; finance 4,61 ; production 4,14 ; sécurité 3,94 ; R&D 3,80 ; logistique 1,21 |
| Freins, UE27 2025, `PC_ENT` / `PC_ENT_AI_EC` | compétences 7,76 / 70,31 ; juridique 5,92 / 53,61 ; données personnelles 5,82 / 52,72 ; données 4,80 / 43,51 ; incompatibilité 4,59 / 41,60 ; coûts 4,24 / 38,37 ; éthique 2,72 / 24,64 ; inutile 1,96 / 17,79 |
| Freins, France | aucune valeur, quelle que soit l'unité, en 2021, 2023, 2024 et 2025 : « pas de valeur pour la France » est juste |
| Moins de 10 personnes (`0_1`, `0-9`, `2-9`) | aucune valeur FR ni UE27 : « Eurostat ne publie pas cet indicateur pour les moins de 10 » est juste |
| Lecture du § 5 (France sous l'UE27 en 10+, au niveau ou au-dessus en 50+, écart surtout en 10-49) | conforme aux valeurs |

Aucun chiffre inventé, extrapolé ou arrondi sans le dire. Années et pays justes partout.

## 3. Interdits

| Contrôle | Résultat |
| --- | --- |
| Aucun prix | OK : aucun montant, « € », « prix », « tarif ». « devis » (Q7, exemple de texte à rédiger), « Coût perçu » (Q10) et « coûts jugés trop élevés » (frein Eurostat) ne sont pas des prix. |
| Aucune ville | OK : aucun nom de ville. « sans ville » / « pas de ville » ne sont que des consignes. La seule localisation demandée est la région (Q3). |
| Aucune garantie | OK : « ils ne promettent aucun résultat » (§ 6) ; l'impact est présenté comme déclaratif. |
| Aucune certification | OK : ni Qualiopi ni aucune certification. |
| Aucun financement | OK : ni OPCO, CPF, subvention, prise en charge. « Activités financières » est un secteur ; « comptabilité, finance » une finalité Eurostat. |
| Aucun nom de client, Axion-IA non citée | OK |

## 4. Questionnaire

### Neutralité

| Question | Verdict |
| --- | --- |
| Q1 à Q8, Q11, Q12, Q14 | OK, formulations factuelles. |
| Q9 | OK après correction : effets positifs et négatifs, « Aucun effet notable », « Je ne sais pas encore ». À rendre exclusives dans l'outil : « Aucun effet notable » et « Je ne sais pas encore » ne se cochent pas avec un autre effet. |
| Q10 | OK : liste équilibrée, « Aucun frein », ordre aléatoire (garder « Aucun frein » en dernier). |
| Q13 | OK : « Oui / Non / Je ne sais pas », sans présupposé. |

### RGPD : incomplet — **à corriger avant diffusion**

1. Trois champs restent vides : responsable du traitement et contact, durée de conservation, outil et hébergement. Un brouillon peut les laisser ouverts, mais la mention n'est pas « complète » tant qu'ils ne sont pas remplis (décision de Will).
2. Éléments absents : **finalité et base légale** (intérêt légitime, ou consentement exprimé par l'envoi du formulaire) ; **droit d'introduire une réclamation auprès de la CNIL** ; droits d'opposition et de limitation ; destinataires (qui lit les réponses brutes) ; transfert hors UE ou non (dépend de l'outil).
3. Contradiction : le texte promet des réponses « anonymes » puis renvoie à des droits d'accès, de rectification et d'effacement. Des réponses vraiment anonymes ne peuvent pas être retrouvées, donc ces droits ne s'exercent pas ; et elles ne sont pas certainement anonymes (région × taille × secteur + réponses libres peuvent identifier une entreprise rare, par exemple une entreprise de 250 salariés ou plus dans un secteur peu représenté d'une petite région). Écrire plutôt : « Vos réponses ne sont pas nominatives. Faute d'identifiant, nous ne pourrons pas retrouver vos réponses après envoi ; vous pouvez arrêter à tout moment avant l'envoi. » et garder la règle des 10 réponses minimum par case publiée (déjà présente, bonne).

### Cohérence

- Logique de saut : les non-utilisateurs vont à Q10, et Q10 à Q14 s'appliquent bien à tous. OK.
- Q12 : « Oui, des salariés » et « Oui, les deux » n'ont pas de sens si Q1 = 0 ; masquer ces réponses dans ce cas. Ajouter « Je ne sais pas » (le répondant n'est pas toujours informé des formations de ses salariés).
- Q6 : ajouter « Je ne sais pas ».
- Q14 : ajouter « Autre ».
- Décompte « 14 questions fermées + 2 ouvertes » et « 5 à choix multiple (5, 7, 9, 10, 14) » : recompté, juste.

### Comparabilité avec France Num : **à corriger**

Les notes de validation annoncent que Q1, Q2, Q4 et Q10 permettent des comparaisons avec France Num. Vérifié contre le rapport (p. 6, 8, 9, 53, 55) :

| Question | Verdict | Constat et correction |
| --- | --- | --- |
| Q1 | OK | Tranches identiques aux 6 de France Num (0, 1-4, 5-9, 10-19, 20-49, 50-249) ; « 250 ou plus » est hors du champ France Num : à exclure des comparaisons. |
| Q2 | **Non comparable en l'état** | France Num (p. 9, correspondance NACE) range l'**immobilier** (LZ) dans « Services spécialisés / techniques », pas avec les activités financières ; il distingue l'**agroalimentaire** (IAA) de l'industrie ; ses « Services à la personne » incluent santé, action sociale, enseignement (OP, QZ). La réponse « Activités financières et immobilier » mélange deux secteurs France Num, et « Industrie / artisanat de production » en fusionne deux autres. Reprendre les libellés France Num : Activités financières / assurances ; Agriculture ; Bâtiment / Construction ; Commerce (détail et gros) ; Hébergement / Restauration ; Industrie agroalimentaire ; Industrie et fabrication artisanale (hors agroalimentaire) ; Numérique (information, communication) ; Services à la personne (santé, action sociale, enseignement…) ; Services spécialisés / techniques (conseil, ingénierie, immobilier…) ; Transport / Logistique ; Autre. |
| Q3 | À préciser | France Num redresse sur les **13 régions de France métropolitaine** (Corse regroupée avec PACA). Prévoir les 13 régions + « Outre-mer » séparé, pour pouvoir comparer à périmètre égal. |
| Q4 | À aligner | France Num demande « Utilisez-vous des outils d'IA **au sein de votre entreprise**, à des fins professionnelles ? » ; Q4 demande l'usage « dans **votre** activité professionnelle » (la personne, pas l'entreprise). Reprendre la formulation France Num ; les 4 niveaux de réponse peuvent rester (« Oui » = les deux premiers). |
| Q6 | À aligner (non annoncée comparable, mais elle pourrait l'être) | France Num (p. 55) : « Utilisez-vous **principalement** des solutions d'IA : gratuites / payantes / les deux ». Q6 dit « seulement » : ce n'est pas la même mesure (c'est précisément l'erreur n° 2 de la première vérification). Reprendre la question France Num. |
| Q10 | **Annonce fausse** | Le baromètre lui-même (§ 4) dit que France Num **ne publie pas** de classement des freins à l'IA. La seule référence est Eurostat (UE27), qui ne pose la question qu'aux entreprises **qui n'utilisent pas l'IA et l'ont envisagée**, et seulement pour 10 personnes occupées ou plus. Corriger la note : « Q10 reprend des catégories proches d'Eurostat ; pas de comparaison France Num possible ». |
| Q7 | Recommandation | Les usages ne reprennent pas les 6 types de la p. 54 de France Num ; si la comparaison est voulue, ajouter ces libellés. |

## Corrections attendues

1. § 7 du `.md` (et section « Corrections apportées ») : téléphone **812** (rapport p. 6), 8 843 + 812 = 9 655 ; la page web indique 802, chiffre de 2025. Retirer la phrase sur l'écart de 10.
2. § 7 : retirer « le jeu de chiffres a été corrigé » et « la version en ligne fait foi » (non sourcés, et démentis par l'écart 1).
3. `sources.json` n° 33 : « principalement payantes 20 % + les deux 28 % », pas « payantes seules ».
4. Eurostat : « 10 personnes occupées ou plus » au lieu de « 10 salariés ou plus » dans le `.md` et dans `sources.json` (n° 49 à 90), et le signaler au § 7.
5. Questionnaire, RGPD : remplir les trois champs ; ajouter base légale, réclamation CNIL, opposition et limitation, destinataires, transfert hors UE ; remplacer « anonymes » par « non nominatives » et résoudre la contradiction avec les droits d'accès et d'effacement.
6. Questionnaire, comparabilité : Q2 sur les secteurs France Num (immobilier, agroalimentaire, services à la personne) ; Q3 en 13 régions métropolitaines + Outre-mer ; Q4 « au sein de votre entreprise » ; Q6 « principalement » ; corriger la note sur Q10 (Eurostat, pas France Num).
7. Mineurs : Centre Relations Clients au § 7 ; « France métropolitaine » pour la représentativité ; « autre lecture publiée par Eurostat » au lieu de « plus courante » ; précision du 48 % au § 3 ; Q6 et Q12 « Je ne sais pas », Q12 masquée si 0 salarié, Q14 « Autre », exclusivité des réponses de Q9 ; `url` des n° 25 et 26.

VERDICT: A CORRIGER — (1) § 7 : téléphone 812 et non 802 (rapport p. 6, 8 843 + 812 = 9 655) : la correction n° 5 signale un écart qui n'existe pas ; (2) § 7 : « jeu de chiffres corrigé » et « la version en ligne fait foi » non sourcés et démentis ; (3) `sources.json` n° 33 : « payantes seules » au lieu de « principalement payantes » ; (4) Eurostat compte des personnes occupées, pas des salariés ; (5) RGPD incomplet (3 champs vides, base légale, CNIL, contradiction « anonymes » / droits d'accès) ; (6) comparabilité France Num : Q2 secteurs mal découpés (immobilier, agroalimentaire), Q3 régions, Q4 entreprise et non personne, Q6 « principalement », note Q10 fausse ; (7) mineurs listés ci-dessus.
