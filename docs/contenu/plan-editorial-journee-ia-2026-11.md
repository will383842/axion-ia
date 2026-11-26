# Plan éditorial « Journée IA » : 40 articles de blog (novembre 2026)

- **Objectif** : 40 articles qui répondent chacun à une question réelle d'un dirigeant de TPE ou de PME sur le déploiement concret de l'IA, et qui amènent vers la Journée IA (`/journee-ia`) ou vers la page de service qui répond à la suite. Aucun article ne reprend un sujet déjà traité par une page du site ou déjà réservé dans le référentiel de mots-clés, et deux articles du plan ne visent jamais le même mot-clé.
- **Date** : plan établi le 26 novembre 2026, corrigé après relecture le même jour. Première publication en semaine 1 de la campagne.
- **Sources lues** :
  - `src/server/content-gen/knowledge/journee-ia-fiche.ts` (faits et interdits), `src/content/journee-ia-commun.ts` (garantie, condition, délai du rapport, durées), `src/content/questions-reference.ts`, `src/server/content-gen/brand/positionnement.ts`, `src/server/content-gen/brand/consigne-prix.ts` ;
  - `docs/knowledge/INTEGRATION-PACK-JOURNEE-IA.md`, `docs/knowledge/pack-journee-ia-2026-11-25/Base_RAG.jsonl` (53 fiches en brouillon), `docs/knowledge/pack-journee-ia-2026-11-10/Expressions_SEO_GEO.csv` (623 expressions, hypothèses non mesurées) ;
  - inventaire de l'existant : `src/content/og-blog-manifest.ts` (instantané de 134 slugs d'articles ; le blog lui-même est en base), `src/content/blog/index.ts`, `src/server/content-gen/audit-blog-existant.ts`, `src/server/content-gen/paires-similaires.ts`, `src/server/content-gen/keyword-templates.ts`, `src/server/content-gen/keywords/keyword-catalog.ts`, `src/content/keywords/*.ts` (référentiel de mots-clés du moteur), `src/content/comparaisons.ts`, `src/content/glossaire-reference/*.ts`, `src/content/automatisations.ts`, `src/content/implementation.ts`, `src/app/_llms/reference.ts`, les contenus des pages `/journee-ia`, `/prix-audit-ia`, `/cartographie` et de l'accueil ;
  - types de contenu : `src/server/content-gen/generators/registered-types.ts`, `blog-from-title.ts`, `comparison.ts`, `guide-pilier.ts`, `v7-phase8-generators.ts` ;
  - routes : `src/i18n/routing.ts` (`pathnames`) et `src/app/[locale]/**/page.tsx`. Toutes les URL citées ci-dessous y figurent sans redirection ; `/audit/tpe-1-jour` est écartée (elle redirige).
- **Rythme** : 1 article en semaine 1, 5 par semaine de la semaine 2 à la semaine 7, puis 3 par semaine de la semaine 8 à la semaine 10.

## Les 40 articles

Intention : **information** (comprendre un usage), **comparaison** (choisir entre deux options), **décision** (passer à l'action). Les URL sont en français, sans préfixe de langue (le lien se rend en `/fr/...`).

**Type de contenu : `blog_from_title` pour les 40 lignes.** Les consignes des autres types contredisent les règles du plan : `pain_point_solution` porte un appel à l'action vers `/formations` avec le montant d'une autre offre et recommande un exemple présenté comme réel ; `long_tail_keyword` renvoie vers `/audit` ; `vs_comparator`, `alternative_to` et `comparison` placent Axion-IA comme option comparée ; `guide_pilier` s'appuie sur « cas concrets + tarifs ». `blog_from_title` impose le titre, s'ancre sur la base de connaissances et interdit tout exemple fictif présenté comme réel et tout chiffre non sourcé. Les trois articles de comparaison (n° 5, 8, 12) comparent deux façons de faire, jamais des offres ni des prestataires.

| n° | Question du dirigeant | Mot-clé principal | Intention | Angle | Persona | Type de contenu | Lien interne | Semaine |
|---:|---|---|---|---|---|---|---|---:|
| 1 | « Dans une PME de vingt personnes, à quoi ressemble une semaine de travail avec l'IA ? » | travailler avec l'IA dans une PME | information | Avant/après d'une semaine ordinaire, service par service, sans chiffre inventé | Dirigeant de PME de 10 à 50 salariés | `blog_from_title` | `/journee-ia` | S1 |
| 2 | « Avec cinq salariés, l'IA vaut-elle vraiment le coup pour moi ? » | IA pour une entreprise de moins de 10 salariés | information | Idée reçue (« c'est pour les grands ») corrigée par une tâche de la semaine | Gérant de TPE | `blog_from_title` | `/journee-ia` | S2 |
| 3 | « Mes salariés utilisent déjà ChatGPT dans leur coin : j'interdis ou j'encadre ? » | usage de l'IA non encadré par les salariés | décision | Ce que coûte l'interdiction, ce que coûte le laisser-faire, et les trois règles à poser | Dirigeant de PME de services | `blog_from_title` | `/glossaire/shadow-ai` | S2 |
| 4 | « Peut-on enfin arrêter de saisir les notes de frais à la main ? » | automatiser les notes de frais | information | Avant/après d'une fin de mois | Dirigeant de PME avec des équipes sur la route | `blog_from_title` | `/implementation/processus` | S2 |
| 5 | « Avant de recruter un assistant administratif, dois-je regarder ce que l'IA peut prendre ? » | IA ou embauche d'un assistant administratif | comparaison | Les deux options comparées tâche par tâche, sans opposer IA et salariés | Dirigeant de PME en croissance | `blog_from_title` | `/implementation/par-fonction/administratif` | S2 |
| 6 | « Combien de temps faut-il à un salarié pour être à l'aise avec l'IA ? » | temps d'apprentissage de l'IA pour un salarié | information | Les premiers jours, les premières semaines : ce qui vient vite, ce qui demande de la pratique | Dirigeant de PME de 20 à 50 salariés | `blog_from_title` | `/formations/entreprise` | S2 |
| 7 | « Je forme toute l'équipe d'un coup ou je commence par un service pilote ? » | service pilote IA | décision | Les critères pour choisir le premier service | Dirigeant de PME à plusieurs services | `blog_from_title` | `/journee-ia` | S3 |
| 8 | « Formation IA générique ou formation sur nos propres dossiers : qu'est-ce que ça change pour mes équipes ? » | formation IA sur ses propres dossiers | comparaison | La même tâche traitée dans les deux formats | Dirigeant de PME | `blog_from_title` | `/formations/entreprise` | S3 |
| 9 | « Quelles tâches de dirigeant puis-je confier à l'IA dès cette semaine ? » | tâches du dirigeant confiées à l'IA | information | Les mails, les synthèses, les brouillons de courriers : un premier pas possible cette semaine | Dirigeant seul aux commandes | `blog_from_title` | `/interventions/dirigeants` | S3 |
| 10 | « Peut-on rédiger nos annonces immobilières avec l'IA sans qu'elles se ressemblent toutes ? » | annonces immobilières rédigées avec l'IA | information | Scène : vingt biens à publier le lundi matin | Gérante d'agence immobilière | `blog_from_title` | `/implementation/documents` | S3 |
| 11 | « Faut-il changer nos ordinateurs pour utiliser l'IA ? » | matériel nécessaire pour utiliser l'IA | information | La question posée avec ses mots ; réponse concrète : navigateur, téléphone, compte professionnel | Gérant de TPE | `blog_from_title` | `/stack-ia` | S3 |
| 12 | « Un assistant IA polyvalent ou un outil d'IA propre à notre métier : que choisir ? » | assistant IA polyvalent ou outil d'IA de son métier | comparaison | Deux approches comparées sur trois tâches réelles, sans marque nommée | Dirigeant de PME | `blog_from_title` | `/implementation/integrations` | S4 |
| 13 | « Nos façons de faire sont dans la tête de deux anciens : l'IA peut-elle nous aider à les écrire ? » | rédiger des procédures internes avec l'IA | information | Le coût de ne rien faire : un départ en retraite sans transmission | Dirigeant de PME industrielle | `blog_from_title` | `/implementation/par-fonction/metier-production` | S4 |
| 14 | « Dois-je former aussi les salariés qui n'ont pas d'ordinateur ? » | former à l'IA les salariés sans poste informatique | décision | Atelier, chantier, magasin : ce que l'IA change pour eux, sur téléphone | Dirigeant de PME de production ou de commerce | `blog_from_title` | `/formations/metiers` | S4 |
| 15 | « Si l'IA se trompe dans un document envoyé à un client, qui est responsable ? » | responsabilité en cas d'erreur de l'IA | information | Scène : un chiffre faux dans une réponse à un client, et la relecture qui l'aurait arrêté | Dirigeant de PME | `blog_from_title` | `/glossaire/hallucination` | S4 |
| 16 | « Peut-on demander à l'IA de comparer trois devis fournisseurs ? » | comparer des devis fournisseurs avec l'IA | information | Scène : trois devis présentés différemment, et le tableau qu'on en tire | Dirigeant de PME | `blog_from_title` | `/implementation/par-fonction/administratif` | S4 |
| 17 | « Les textes et les images produits par l'IA appartiennent-ils à mon entreprise ? » | propriété des contenus générés par l'IA | information | Réponse prudente et renvoi vers un juriste | Dirigeant d'agence de communication | `blog_from_title` | `/glossaire/ia-generative` | S5 |
| 18 | « Peut-on préparer nos fiches techniques de cuisine avec l'IA sans perdre la main ? » | fiches techniques de restaurant avec l'IA | information | Scène : la carte qui change et les fiches à refaire | Restaurateur | `blog_from_title` | `/implementation/par-fonction/metier-production` | S5 |
| 19 | « Mes salariés ont plus de cinquante ans : l'IA, c'est vraiment pour eux ? » | salariés seniors et IA | information | Idée reçue corrigée : l'expérience du métier sert à juger ce que l'IA propose | Dirigeant de PME à l'équipe expérimentée | `blog_from_title` | `/formations/entreprise` | S5 |
| 20 | « Comment préparer un rendez-vous commercial en dix minutes avec l'IA ? » | préparer un rendez-vous commercial avec l'IA | information | Un premier pas possible cette semaine, avec un outil nommé | Dirigeant commercial de PME | `blog_from_title` | `/implementation/par-fonction/ventes-prospection` | S5 |
| 21 | « Et si l'outil d'IA qu'on utilise change ses conditions ou disparaît ? » | dépendance à un outil d'IA | décision | Les questions à se poser avant d'adopter un outil : export des données, alternatives | Dirigeant de PME | `blog_from_title` | `/implementation/ia-custom` | S5 |
| 22 | « Peut-on répondre aux avis Google avec l'IA sans paraître automatique ? » | répondre aux avis clients avec l'IA | information | Scène : trois avis négatifs un dimanche soir | Dirigeant de commerce de proximité | `blog_from_title` | `/implementation/par-fonction/service-client` | S6 |
| 23 | « Mes fichiers sont en désordre : est-ce que ça bloque l'IA ? » | données en désordre et IA | information | Idée reçue (« il faut d'abord tout ranger ») corrigée par un exemple | Dirigeant de PME | `blog_from_title` | `/implementation/structuration` | S6 |
| 24 | « Quel est le bon moment dans l'année pour lancer l'IA dans l'entreprise ? » | période de l'année pour lancer l'IA | décision | Les périodes creuses et pleines d'une PME, et ce qu'on lance dans chacune | Dirigeant de PME saisonnière | `blog_from_title` | `/journee-ia` | S6 |
| 25 | « Mes salariés me posent dix fois les mêmes questions : l'IA peut-elle y répondre à ma place ? » | réponses aux questions internes récurrentes | information | Scène : les mêmes questions sur les congés et les procédures | Dirigeant de PME de 30 à 80 salariés | `blog_from_title` | `/implementation/par-fonction/communication-interne` | S6 |
| 26 | « Peut-on préparer les entretiens annuels avec l'IA sans les déshumaniser ? » | préparer les entretiens annuels avec l'IA | information | Ce que l'IA prépare (trame, synthèse des notes), ce qui reste au manager | Dirigeant de PME | `blog_from_title` | `/implementation/par-fonction/ressources-humaines` | S6 |
| 27 | « Comment lire un contrat fournisseur de quarante pages avec l'IA sans rien rater d'important ? » | lire un contrat fournisseur avec l'IA | information | Scène : le contrat reçu la veille de la signature, et ce qu'on fait relire | Dirigeant de PME | `blog_from_title` | `/implementation/documents` | S7 |
| 28 | « Comment suivre la réglementation de mon métier sans y passer mes soirées ? » | suivre la réglementation de son métier avec l'IA | information | Un premier pas possible cette semaine, avec une source officielle | Dirigeant de PME d'un secteur réglementé | `blog_from_title` | `/implementation/par-fonction/donnees-pilotage` | S7 |
| 29 | « Peut-on laisser l'IA prendre les rendez-vous au téléphone quand on est sur un chantier ? » | prise de rendez-vous automatisée par IA | information | Le coût des appels manqués, sur un ton calme | Artisan dépanneur | `blog_from_title` | `/implementation/chatbot` | S7 |
| 30 | « Comment écrire un message délicat à un client (retard, refus, hausse de tarif) avec l'aide de l'IA ? » | écrire des messages délicats aux clients avec l'IA | information | Trois brouillons pour le même message, et celui qu'on garde | Dirigeant de PME de services | `blog_from_title` | `/implementation/par-fonction/ventes-prospection` | S7 |
| 31 | « L'IA peut-elle relire nos documents pour repérer fautes et incohérences avant envoi ? » | relecture de documents par l'IA avant envoi | information | Avant/après d'une offre commerciale relue | Dirigeant de PME | `blog_from_title` | `/implementation/documents` | S7 |
| 32 | « Comment traduire nos documents commerciaux avec l'IA sans perdre en qualité ? » | traduire des documents commerciaux avec l'IA | information | Scène : une offre à envoyer à un client étranger avant vendredi | Dirigeant de PME exportatrice | `blog_from_title` | `/stack-ia` | S8 |
| 33 | « L'IA peut-elle m'aider à tenir à jour le document unique de l'entreprise ? » | mettre à jour le document unique avec l'IA | information | Ce que l'IA aide à rédiger, ce qui reste à vérifier sur le terrain | Chef d'entreprise du bâtiment | `blog_from_title` | `/implementation/par-fonction/administratif` | S8 |
| 34 | « Comment protéger mon entreprise des arnaques qui imitent ma voix ou mes mails grâce à l'IA ? » | arnaque au faux dirigeant par IA | information | Scène : un appel pressant qui demande un virement, et les réflexes à installer | Dirigeant de PME | `blog_from_title` | `/glossaire/hypertrucage` | S8 |
| 35 | « Peut-on remplir les questionnaires de nos clients donneurs d'ordre plus vite avec l'IA ? » | remplir les questionnaires fournisseurs avec l'IA | information | Scène : un questionnaire qualité de quatre-vingts questions à rendre | Dirigeant de PME sous-traitante | `blog_from_title` | `/implementation/documents` | S9 |
| 36 | « Peut-on créer nos visuels publicitaires avec l'IA sans graphiste ? » | créer des visuels publicitaires avec l'IA | information | Ce qui marche pour une affiche ou un post, ce qui demande encore un professionnel | Dirigeant de commerce | `blog_from_title` | `/implementation/par-fonction/marketing-communication` | S9 |
| 37 | « Avant de lancer une automatisation, que doit contenir le devis que je signe ? » | devis de projet d'automatisation IA | décision | Les lignes à exiger et les questions à poser, sans aucun montant | Dirigeant de PME | `blog_from_title` | `/demande-devis` | S9 |
| 38 | « Comment convaincre mes associés de consacrer une journée à l'IA ? » | convaincre ses associés d'investir dans l'IA | décision | Arguments, objections, réponses | Dirigeant associé de PME | `blog_from_title` | `/journee-ia` | S10 |
| 39 | « Comment préparer un salon professionnel avec l'IA ? » | préparer un salon professionnel avec l'IA | information | Avant, pendant, après : fiches visiteurs, relances, synthèse | Dirigeant de PME industrielle | `blog_from_title` | `/implementation/par-fonction/marketing-communication` | S10 |
| 40 | « Trois mois après, comment savoir si l'IA sert vraiment dans l'entreprise ? » | mesurer l'usage de l'IA après déploiement | décision | Les signes concrets d'usage réel, service par service | Dirigeant de PME | `blog_from_title` | `/roi` | S10 |

### Calendrier

| Semaine | Articles | Nombre |
|---|---|---:|
| S1 | 1 | 1 |
| S2 | 2 à 6 | 5 |
| S3 | 7 à 11 | 5 |
| S4 | 12 à 16 | 5 |
| S5 | 17 à 21 | 5 |
| S6 | 22 à 26 | 5 |
| S7 | 27 à 31 | 5 |
| S8 | 32 à 34 | 3 |
| S9 | 35 à 37 | 3 |
| S10 | 38 à 40 | 3 |
| **Total** | | **40** |

Répartition : 29 articles d'information, 3 de comparaison, 8 de décision. Type de contenu : `blog_from_title` (40), présent dans `REGISTERED_CONTENT_TYPE_NAMES`. Aucun autre type n'est retenu (voir la note au-dessus du tableau) ; écartés aussi : `case_study_local` (fausse preuve sociale), `faq_geo`, `top_x_in_y`, `how_to_x_in_y` et `best_for_x_in_y` (ancrés sur une ville), `barometer_insight` (statistiques), `glossary_term` et `what_is_x` (le glossaire couvre déjà les définitions), `calculator_roi` (doublon du simulateur `/roi`), `blog_from_rss` (actualité).

## Sujets écartés car déjà couverts

| Sujet écarté | Où il est déjà traité |
|---|---|
| Prix de la Journée IA et ce qui est compris | `/journee-ia` (FAQ « Combien coûte la Journée IA, et qu'est-ce qui est compris ? »), `/tarifs`, accueil `/` |
| Prix d'un audit IA pour une TPE ou une PME | `/prix-audit-ia` (H1 et FAQ), `/journee-ia` (FAQ) |
| Prix d'une formation IA | `/formations` (`ref-formation-prix`), `/formations/tarifs`, `/prix-audit-ia` (FAQ) |
| Prix d'une automatisation IA | `/prix-audit-ia` (FAQ), `/tarifs` (`ref-automatisation-prix`) |
| Que contient un audit IA ; audit IA ou audit informatique | `/prix-audit-ia` (`ref-audit-contenu`, `ref-audit-vs-info` dans `src/content/questions-reference.ts`, rattachés à cette page par `src/app/_llms/reference.ts`) |
| Audit ou formation : par quoi commencer | `/journee-ia` (`ref-audit-vs-formation`) |
| Par où commencer avec l'IA ; cartographie de l'entreprise | accueil `/` (FAQ `ref-commencer`), `/cartographie` |
| Étapes du déploiement de l'IA dans une petite entreprise | réservé : `src/content/keywords/g3-implementation-codage.ts` (l. 232, « étapes déploiement IA petite entreprise ») |
| Erreurs à éviter dans un premier projet IA | réservé : `src/content/keywords/g3-implementation-codage.ts` (l. 268), sous-titre de `g1-audit.ts` (l. 496) |
| Choisir un prestataire IA | réservé : `src/content/keywords/g4-aeo.ts` (l. 1273), sous-titres de `g1-audit.ts` (l. 1567) ; comparaisons `/comparaisons/*` |
| Différence entre IA et automatisation classique | réservé : `src/content/keywords/g4-aeo.ts` (l. 1528) ; `/glossaire/automatisation`, `/glossaire/rpa` |
| Fiches produits rédigées par l'IA | réservé : `src/content/keywords/g3b-web-digital-augmente.ts` (~l. 262, page cible `/fr/blog/automatiser-fiches-produit-ia-ecommerce`), `g6-sectoriels-coaching.ts` (l. 1685) |
| Comparer les formats d'accompagnement ou d'intervention | réservé : `src/content/keywords/g2-interventions.ts` (~l. 1343, page cible `/fr/blog/formats-intervention-ia-entreprise`) |
| Contenu d'un rapport d'audit, plan d'action à 90 jours, délai du rapport | `/journee-ia` (section « Ce que vous recevez : rapport chiffré, plan à 90 jours, attestations » et FAQ « Quand recevons-nous le rapport ? ») |
| Saisie automatique des commandes clients | réservé : `src/content/keywords/g6-sectoriels-coaching.ts` (l. 1786, « automatiser les commandes IA PME ») |
| Intégration des nouveaux salariés avec l'IA | réservé : `src/content/keywords/g6-sectoriels-coaching.ts` (l. 1339 et l. 1359) |
| Passer à des licences d'IA payantes | réservé : `src/content/keywords/g2-interventions.ts` (l. 1686, « Quand passer à un outil IA payant ») |
| Faire adopter l'IA aux salariés réticents | réservé : `src/content/keywords/g1-audit.ts` (l. 1329, page cible `/fr/blog/freins-adoption-ia-pme-france`) |
| Déroulé de la journée, préparation, temps pris aux équipes, nombre de personnes formées, suite de la journée | `/journee-ia` (sections « Le déroulé », « Ce que vous recevez » et FAQ) |
| Et si l'audit trouve peu de gains ; calcul des gains identifiés | `/journee-ia` (FAQ), accueil `/` (FAQ) |
| « Nous avons déjà ChatGPT, qu'est-ce que ça change ? » | `/journee-ia` (FAQ), accueil `/` (FAQ) |
| Faut-il connaître l'IA ; est-ce que ça marche dans notre secteur | `/journee-ia` (FAQ) |
| Protection des données | `/journee-ia` (FAQ « Et nos données ? »), `/faq` (`ref-donnees`) |
| L'IA va-t-elle remplacer mes salariés | `/faq` (`ref-remplacer`) |
| Faut-il changer de logiciels | `/implementation/integrations` (`ref-outils-existants`) |
| Quelles tâches automatiser en premier ; premiers gains rapides | `/implementation` (`ref-automatiser-premier`) ; slug `3-quick-wins-ia-operationnels-2026` dans `src/content/og-blog-manifest.ts` |
| Automatiser les devis et les relances | accueil `/` (FAQ « Peut-on automatiser les devis et les relances avec l'IA ? ») |
| AI Act, article 4, formation exigée, information des clients | accueil `/` (FAQ `ref-ai-act-pme`), `/journee-ia` (section « article 4 »), `/glossaire/ai-act`, `/glossaire/maitrise-ia-article-4` |
| AI Act et RGPD | slug `ai-act-vs-rgpd-differences-obligations-entreprises` dans `src/content/og-blog-manifest.ts` |
| Pourquoi auditer avant d'implémenter | slug `pourquoi-auditer-avant-implementer-ia` dans `src/content/og-blog-manifest.ts` |
| Coaching individuel ou formation collective | `/interventions/dirigeants`, `/interventions/individuel`, `/un-a-un` (`ref-coaching-vs-formation`) |
| Mesurer sa maturité IA | `/diagnostic` |
| Simuler ses gains | `/roi` |
| Cabinet IA ou logiciel générique ; internaliser ou faire appel à un prestataire ; fine-tuning ou RAG | `/comparaisons/cabinet-ia-vs-saas-generique`, `/comparaisons/internalisation-vs-externalisation`, `/comparaisons/fine-tuning-vs-rag` |
| Définitions (agent IA, chatbot, RAG, charte IA, POC, ROI de l'IA, RPA, no-code, visibilité dans les réponses des IA) | `/glossaire/agent`, `/glossaire/chatbot`, `/glossaire/rag`, `/glossaire/charte-ia`, `/glossaire/poc`, `/glossaire/roi-ia`, `/glossaire/rpa`, `/glossaire/no-code`, `/glossaire/geo`, `/glossaire/aeo` ; services `/implementation/agents`, `/implementation/chatbot` |
| La méthode d'Axion-IA ; le guide complet | `/methodologie`, `/guide-ia` |
| Automatiser une fonction entière (service client, ventes, marketing, RH, administratif, pilotage, production, communication interne) | `/implementation/par-fonction/*` (8 pages, `src/content/automatisations.ts`) : le plan ne traite que des tâches précises et y renvoie |
| Formation IA en présentiel ou à distance | réservé : `src/content/keywords/g2m-formation-clusters.ts` (l. 434), `src/content/keywords/g5-comparatifs-partenaires.ts` (l. 357) |
| Ressources internes et rôle du référent IA | réservé : `src/content/keywords/g4-aeo.ts` (l. 940, page cible `/fr/faq/ressources-internes-projet-ia`) |
| Débuter avec un budget maîtrisé | réservé : `src/content/keywords/m-positionnements.ts` (l. 374) |
| Chatbot ou assistant IA | réservé : `src/content/keywords/g5-comparatifs-partenaires.ts` (l. 589) |
| « Que regarde l'audit sur… » (relances clients, factures fournisseurs, e-mails, comptes rendus, dossiers comptables, devis de chantier, recrutement, stocks, appels d'offres, plannings, réclamations, etc.) ; coût d'une tâche répétitive ; temps libéré et argent encaissé ; rôle du dirigeant pendant l'audit ; tâche à ne pas automatiser ; observer les services sur place ; choisir trois à cinq priorités ; entreprise en difficulté ; diagnostic d'abord | fiches en brouillon de `docs/knowledge/pack-journee-ia-2026-11-25/Base_RAG.jsonl`, destinées à `/connaissances` : GEO-008, GEO-010, GEO-011, GEO-013, GEO-015, GEO-017, GEO-019, GEO-025, GEO-035 à GEO-051, GEO-053, GEO-056 à GEO-063 (GEO-052, 054 et 055 ont été retirées du pack) |
| Articles ancrés sur une ville | les 134 slugs de `src/content/og-blog-manifest.ts` sont presque tous ancrés sur une ville : aucun article du plan n'en vise une |
| Doublons internes retirés à la relecture | « sous-traiter la saisie ou l'automatiser » (doublon du n° 5), « retard face aux concurrents » (même décision de calendrier que le n° 24), « IA pour les métiers de terrain » (grappe administrative déjà couverte par les n° 4, 5, 16 et 33) |

## Contrôle anti-doublon (méthode)

1. **Pages du site** : chaque question a été comparée aux FAQ et aux sections de `/journee-ia`, `/prix-audit-ia`, `/cartographie`, de l'accueil, aux questions de référence (`src/content/questions-reference.ts`), aux comparaisons, au glossaire et aux pages `/implementation/**`. Une question déjà posée par une page est écartée (tableau ci-dessus), même reformulée.
2. **Blog en base** : le dépôt n'en contient qu'un instantané (`src/content/og-blog-manifest.ts`). Avant de lancer chaque génération, vérifier dans la console (« Détection de doublons », clé `similarity_pairs` lue par `paires-similaires.ts`) et dans la page d'audit du blog qu'aucun article publié ne porte déjà le mot-clé.
3. **Référentiel de mots-clés** : chaque mot-clé principal, y compris ceux des remplaçants, a été cherché dans `src/content/keywords/*.ts`, `keyword-templates.ts` et `keyword-catalog.ts`. Les correspondances ont été retirées du plan (voir les lignes « réservé » ci-dessus).
4. **Voisins à surveiller** (angle différent, mais à relire au moment de la génération) :
   - n° 8 (formation sur ses propres dossiers) face à « formation ia sur mesure entreprise » (`g2n-formations-v2.ts` l. 46) et « formation IA sur mesure pour entreprise » (`g2m-formation-clusters.ts` l. 557) ; la page `/journee-ia` cite aussi la formation « sur vos dossiers » ;
   - n° 17 (propriété des contenus) face à « Propriété intellectuelle et IA créative » (`g7c-secteurs-conso-culture.ts` l. 1539) ;
   - n° 22 (réponse aux avis) face à « Relance automatique des avis Google » et la réponse automatique aux avis (`src/content/automatisations.ts` l. 90 à 98) ;
   - n° 29 (prise de rendez-vous au téléphone) face à « Assistante IA médicale : réponse appels entrants, prise RDV » (`g6-sectoriels-coaching.ts` l. 1932, cible médicale) ;
   - n° 40 (mesurer l'usage) face à « comment mesurer le ROI d'un projet d'implémentation IA ? » (`g4-aeo.ts` l. 855) : l'article parle d'usage réel, pas de retour sur investissement.
5. **Pack GEO** : aucun article ne reprend le gabarit « Que regarde l'audit sur… » ni une question des fiches en brouillon.
6. **Dans le plan** : 40 questions et 40 mots-clés distincts (contrôlés par script) ; deux articles qui renvoient vers la même page traitent des tâches différentes, et aucun angle n'est repris d'un article à l'autre.
7. **À la génération** : laisser jouer les contrôles du générateur (empreinte de sujet et similarité dans `src/server/content-gen/dedup/`, `src/server/content-gen/generators/anti-duplicate-check.ts`). Un article signalé proche d'un existant est réorienté, pas publié.
8. **Consigne Journée IA** : la fiche n'est ajoutée au prompt que si le sujet nomme la Journée IA (`sujetTouchelaJourneeIA`). Pour les articles qui renvoient vers `/journee-ia`, écrire « Journée IA » dans le brief, sinon le modèle ne reçoit ni les faits ni les interdits.

## Règles de communication appliquées

- **Faits** : seuls ceux des sources. Une journée en présentiel, dans les locaux de l'entreprise, **partout en France**, pour des TPE et PME qui partent de zéro, rapport sous 10 jours ouvrés (`journee-ia-fiche.ts`, `DELAI_RAPPORT_JOURS_OUVRES` de `journee-ia-commun.ts`). Audit le matin, de 2 à 4 h selon l'entreprise, et formation de 4 h l'après-midi (`questions-reference.ts`, `ref-journee-prix` ; `journee-ia-commun.ts` : « formées 4 heures sur leurs propres dossiers »). Diagnostic IA de 45 minutes, en visio ou par téléphone (`journee-ia-commun.ts`, `EN_BREF_ACCUEIL` ; `questions-reference.ts`, `ref-commencer`). Aucune autre durée chiffrée.
- **Prix** : un prix unique, jamais comparé à un autre, écrit uniquement par le jeton `{{price:journee-ia|flat}}`. Aucun montant pour les autres offres (« sur devis »). Le devis du n° 37 se traite sans aucun chiffre.
- **Garantie** : une seule formulation, sur les **gains identifiés** : si les gains identifiés dans le rapport n'atteignent pas 3 fois le prix HT de la journée, le client est remboursé sur demande écrite. Toujours avec la condition : le décideur et les personnes prévues sont présents pendant l'audit. Aucun montant en euros pour le seuil, aucune promesse de gains, et la formule négative sur les gains que la fiche interdit n'est jamais employée.
- **Lieu** : on écrit « partout en France » et « dans vos locaux ». Le nom de la ville interdite par la fiche n'apparaît nulle part, et rien n'est dit des frais liés à la venue sur place.
- **Ce qui renvoie aux CGV et au rendez-vous** : paiement, réservation, modalités contractuelles. Un seul appel à l'action, en fin d'article : le Diagnostic IA gratuit de 45 minutes, sans engagement, avec un conseiller, lien `/appel?rdv=diagnostic`.
- **Fond interdit** (bloqué par `src/lib/contenu/interdits-publication.ts`) : aucun client nommé, aucun témoignage ni résultat chiffré attribué à Axion-IA, aucune statistique maison, aucun partenariat ni label, aucun dispositif de financement public. Les exemples restent explicitement hypothétiques.
- **Ton** : celui du dirigeant, concret. Un métier précis, une tâche réelle, un outil nommé, un ordre de grandeur honnête d'effort, un premier pas possible cette semaine. « PME » dans les titres, « TPE et PME » dans le texte. Axion-IA s'occupe de la mise en place : aucun article ne pousse le lecteur à le faire seul.
