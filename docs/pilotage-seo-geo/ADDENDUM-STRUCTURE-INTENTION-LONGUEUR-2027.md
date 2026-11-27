# Addendum : intention, structure des titres, longueur (chaîne éditoriale et porte qualité, 2027)

> Phase de conception, 27/11/2026, branche `docs/addendum-structure-hn-2027`. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**
> Demande de Will : pour **chaque article**, la chaîne éditoriale IA doit tenir compte **explicitement** de (1) l'intention de recherche et du format qui y répond, (2) la structure des titres H1/H2/H3, (3) une longueur adaptée à la question, (4) les pratiques des moteurs (Google Search, AI Overviews, AI Mode, Bing/Copilot, ChatGPT Search, Perplexity, Gemini, Claude) telles qu'elles sont fin 2026.
> Ce document **complète sans les remplacer** : `CONCEPTION-CHAINE-EDITORIALE-IA.md` (rôles R1-R8, PR C0-C16), `CONCEPTION-PORTE-QUALITE.md` (critères B01-B17, W01-W10, PR Q0-Q17), `docs/design/gabarits-articles/PLAN.md`, `DECOUPAGE.md` et `BALISAGE-ENCADRES.md` (10 gabarits, PR S1-S3, G1-G8, A1, GU1, J1), `docs/contenu/PLAN-EDITORIAL-365.md` et son CSV. Il part du code lu le 27/11/2026 : `equipe/brief.ts`, `equipe/plan.ts`, `quality/outline-validator.ts`, `quality/passages-citables.ts`, `quality/plagiarism.ts`, `quality/search-intent-validator.ts`, `guides/loader.ts`, `shared/html-sanitizer.ts`, `lib/knowledge/article-enrich.ts`, énumération Prisma `SearchIntent`.
> Les noms existants (`B01`…`B17`, `W01`…`W10`, classes Dur / Corrigeable / Dérogeable, verdicts `publiable` / `a_corriger` / `bloque`, codes de `ContenuRefus`) **ne sont pas renommés**. Les nouveaux critères sont **B18 à B23**.

## 0. En bref

1. **Aucun moteur ne publie de règle de longueur ni de nombre de titres.** Selon les extraits des pages officielles (non ouvertes en entier, § 2) : Google dit qu'il n'y a pas de nombre de mots cible et que l'ordre des titres ne compte pas pour le classement (il compte pour l'accessibilité) ; son guide d'optimisation pour l'IA (mai 2026) placerait le contenu « non banal » avant tout le reste et jugerait inutile le découpage spécial pour l'IA. Microsoft (Bing/Copilot) recommande des titres qui nomment des questions, des réponses d'une à deux phrases, et de ne pas cacher les réponses. **Les règles chiffrées ci-dessous sont des règles de qualité et de lisibilité de la maison, vérifiables par le code, pas des « facteurs de classement ».**
2. **Intention** : cinq intentions, qui **reprennent l'énumération existante `SearchIntent`** (pas de nouvelle taxonomie). **Seules l'informationnelle et la comparative donnent un article.** Une requête transactionnelle (y compris une question de **prix**), locale ou de navigation est servie par une page existante : le stratège rend `intention_hors_article`.
3. **Structure** : un seul H1 (rendu par la page à partir du titre), des H2 informatifs reliés **par leur position dans le plan figé** aux vraies questions du brief, aucun saut de niveau, longueurs de titres calibrées sur les 365 questions du plan, **réponse directe de 40 à 60 mots sous le H1** (B08, inchangé) et **réponse d'ouverture visée à 40-60 mots sous chaque H2**, contrôlée avec tolérance (25 à 80 mots, au moins 70 % des H2 informatifs) pour ne pas uniformiser les articles.
4. **Longueur** : une **fourchette** par article, calculée par le code à partir des pages que le stratège lit déjà (échantillon de l'outil de recherche, **sans lecture supplémentaire**), d'un plancher de couverture et des bornes du gabarit. Ni nombre fixe, ni course à la longueur.
5. **Six nouveaux critères de porte** (B18 à B23), qui ne s'appliquent **qu'aux contenus porteurs d'un brief de chaîne**. B18 à B21 et B23 sont **corrigeables** ; B22 (intention admissible) est **dur**. La formule de note ne change pas. Ils restent **en ombre** jusqu'à une observation dédiée des sorties de la chaîne (au moins 10 contenus relus par gabarit).
6. **Chaque gabarit** a sa fiche : intentions admises, nombre de H2, H2 imposés, bornes de mots, élément obligatoire **balisé** (`data-section`, attribut déjà conservé par le nettoyeur HTML). Le gabarit fixe la **mise en page de l'article** ; l'**en-tête et le pied de page du site** sont rendus par le layout et n'entrent dans aucune règle.
7. **Contradictions relevées et arbitrées** (§ 13) : plancher de 850 mots contre le plan 365, 5 à 8 H2 en dur contre la FAQ et la Sélection, FAQ en double source, ancres des H2 en mise à jour, taxonomie d'intention. Sept décisions pour Will (§ 14).

## 1. Portée et ce qui ne change pas

- **Dans le périmètre** : les articles produits par la chaîne, du brief (R2) à la porte (R8), et le contrat entre le contenu produit (corps HTML, champ `directAnswer`, champ FAQ structuré) et les 10 gabarits.
- **Hors périmètre de B18 à B23** : tout contenu **sans brief de chaîne** (générateurs actuels, actualités RSS `blog_from_rss`, éditions manuelles). Pour eux, ces critères ne sont **pas évalués et ne bloquent pas** : ce n'est pas un « non évalué » au sens de la porte (qui bloque), c'est un **hors champ** déclaré dans le registre. Savoir si l'on publie encore hors chaîne après Q10 est une décision de Will (**D-A6**), pas un effet de bord de ces critères.
- **Pages qui reçoivent les intentions refusées** : pages d'offre et de contact, pages villes (S6), accueil, glossaire, Observatoire.
- **Ne change pas** : URL, slugs, canonical, métadonnées, `og:image`, `@id` JSON-LD, ancres des H2 publiés (`buildToc` est gelé et réécrit les `id` à partir du texte), règles de marque (`interdits-publication.ts`, `positionnement.ts` en lecture seule : jamais « Grenoble », « partout en France » autorisée, aucun prix ni frais de déplacement, pas de lien `/appel`, pas de faux témoignage, aucun avocat), budget Web Vitals, et jamais Fable.
- **Le gabarit fixe la mise en page** de l'article (héros, encadrés, sommaire, cartes, colonne d'actions). **L'en-tête et le pied de page sont ceux du site, rendus par le layout** : aucun de leurs titres n'entre dans les comptes, qui portent sur le H1 de l'article et sur son contenu.

## 2. Pratiques des moteurs fin 2026 : documenté ou non

**Méthode et limite.** Recherche web du 27/11/2026. `developers.google.com` et `about.ads.microsoft.com` **n'ont pas pu être ouverts** (domaines refusés par le réseau de la session). Leur contenu est cité **par les extraits de recherche et la presse spécialisée**, comme dans les deux conceptions précédentes. Niveaux : **[officiel, extrait]** = page de l'éditeur connue par extrait, non relue en entier ; **[officiel]** = documentation publique de l'éditeur, connue par ses extraits ; **[secondaire]** = presse SEO ; **[étude]** = étude chiffrée (souvent d'un éditeur d'outil, non relue par des pairs) ; **[hypothèse]**. Avant toute décision engageante, relire les pages d'origine.

### 2.1 Google Search, AI Overviews, AI Mode

| Fait | Niveau et source |
| --- | --- |
| Aucune exigence supplémentaire pour apparaître dans AI Overviews ou AI Mode ; les fondamentaux SEO s'appliquent. Les deux peuvent employer le **« query fan-out »** (plusieurs recherches liées pour construire une réponse). | [officiel, extrait] https://developers.google.com/search/docs/appearance/ai-features |
| Guide d'optimisation pour l'IA générative (mai 2026, mise à jour au 10/07/2026 selon une source) : le contenu **« non-commodity »** (expérience directe, données propres, point de vue unique, expertise réelle) « influencera probablement » la présence dans la recherche générative **plus que toutes les autres suggestions** du guide ; à ignorer : `llms.txt`, **découpage en blocs**, réécriture spéciale pour l'IA, données structurées « pour l'IA ». | [officiel, extrait] https://developers.google.com/search/docs/fundamentals/ai-optimization-guide ; https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing ; [secondaire] https://www.frase.io/blog/google-ai-optimization-guide |
| Longueur : la longueur seule ne compte pas pour le classement ; **pas de nombre de mots cible**. Mueller : écrire aussi long ou aussi court que nécessaire pour les lecteurs. | [officiel, extrait] SEO Starter Guide https://developers.google.com/search/docs/fundamentals/seo-starter-guide ; [secondaire] https://www.seroundtable.com/google-word-count-for-seo-google-rankings-35607.html |
| Titres : un ordre sémantique aide les lecteurs d'écran mais **ne compte pas pour le classement** (Starter Guide, repris par Gary Illyes) ; plusieurs H1 ne gênent pas Google ; des titres structurés **aident à comprendre** la page. | [officiel, extrait] ; [secondaire] https://www.searchenginejournal.com/google-clarifies-h1-h6-headings-for-seo/522454/ ; https://searchengineland.com/multiple-h1s-wont-get-in-the-way-of-your-seo-google-says-322909 |
| Lien de titre : Google peut le tirer du `<title>`, du titre principal visible, du **H1** ; conseil : mettre le titre principal dans le **premier H1 visible** ; si plusieurs titres ont le même niveau, Google peut prendre le premier. | [officiel, extrait] https://developers.google.com/search/docs/appearance/title-link |
| Intention : les consignes des évaluateurs classent les requêtes en **Know**, **Do** (qui couvre aussi l'achat et le téléchargement), **Website**, **Visit-in-person**, puis notent l'adéquation (« Needs Met »). Les évaluateurs n'agissent pas directement sur le classement. | [officiel] https://services.google.com/fh/files/misc/hsw-sqrg.pdf ; https://developers.google.com/search/blog/2023/11/search-quality-rater-guidelines-update |
| Mai et octobre 2026 : liens plus visibles et plus hauts dans AI Overviews et AI Mode. Juin 2026 : contrôle Search Console de l'apparition dans les fonctions génératives (test au Royaume-Uni). | [secondaire] https://searchengineland.com/google-updates-ai-mode-and-ai-overview-with-more-links-context-carousels-and-information-on-creators-496242 ; [officiel] https://blog.google/products-and-platforms/products/search/new-opportunities-control-and-insights-for-website-owners/ |
| Fin des résultats enrichis FAQ (07/05/2026), politiques anti-spam étendues aux réponses génératives (15/05/2026). | [secondaire], déjà sourcés au § 2 de `CONCEPTION-CHAINE-EDITORIALE-IA.md` |

### 2.2 Bing et Copilot

| Fait | Niveau et source |
| --- | --- |
| « Optimizing Your Content for Inclusion in AI Search Answers » (Microsoft Advertising, 08/10/2025) : titres H1/H2/H3 qui **nomment des questions ou des sujets précis** ; paires question-réponse que les assistants « reprennent souvent mot pour mot » ; réponses **d'une à deux phrases** ; listes, Q/R, tableaux autonomes ; **ne pas cacher les réponses** dans des onglets ou menus repliables. Aucune garantie d'inclusion. | [officiel, extrait] https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers ; [secondaire] https://www.seroundtable.com/microsoft-ads-optimize-for-ai-search-answers-40241.html |
| Consignes Bing Webmaster réécrites pour couvrir les réponses de Copilot. | [secondaire] https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ |
| Rapport « AI Performance » (aperçu public, 02/2026) ; juin 2026 : intentions, sujets, part de citation. | [officiel] https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview ; https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare |
| Fraîcheur : sitemaps à jour et IndexNow ; contenu dupliqué = visibilité affaiblie. | [officiel] https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search |

### 2.3 ChatGPT Search, Perplexity, Gemini, Claude

| Fait | Niveau et source |
| --- | --- |
| ChatGPT Search : `OAI-SearchBot` fait apparaître les sites dans les résultats, séparément de `GPTBot` (entraînement) ; trafic marqué `utm_source=chatgpt.com`. **Aucune consigne de structure ni de longueur publiée.** | [officiel] https://developers.openai.com/api/docs/bots ; https://help.openai.com/en/articles/12627856-publishers-and-developers-faq |
| Perplexity : `PerplexityBot` fait apparaître et lie les sites ; **aucune spécification publique** de la sélection des sources trouvée. | [officiel] https://docs.perplexity.ai/docs/resources/perplexity-crawlers |
| Gemini, **API** : l'ancrage sur Google Search relie des passages de réponse à des sources (URI, titre) ; dans l'API, les pages qui refusent `Google-Extended` ne servent pas à l'ancrage. Le comportement de l'application Gemini n'est **pas documenté** ici. | [officiel] https://ai.google.dev/gemini-api/docs/google-search |
| Claude : la recherche web cite toujours ses sources (URL, titre) ; `Claude-SearchBot` explore pour la recherche, `Claude-User` lit à la demande. | [officiel] https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool ; https://support.claude.com/en/articles/8896518 |
| Ces moteurs trouvent les pages par un index et **citent des passages** ; rien d'officiel ne dit lequel. Sous notre contrôle : rester indexable par leurs robots de recherche (déjà réglé) et écrire des passages autonomes, exacts, datés, sourcés. | [hypothèse raisonnée] |

### 2.4 Études chiffrées (corrélations, pas des causes)

- **Longueur et citation dans AI Overviews** (Ahrefs, 2026, 174 048 pages) : corrélation de Spearman **0,04** entre nombre de mots et position de citation ; moyenne citée 1 282 mots ; **53,4 % des pages citées sous 1 000 mots**. [étude] https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/ . Une étude plus petite (avril 2026, 1 000 aperçus) voit plus de citations au-delà de 2 500 mots, attribuées à la **couverture des sous-questions**. [étude] https://www.digitalapplied.com/blog/we-analyzed-1000-ai-overviews-citation-pattern-study
- **Titres et passages cités par ChatGPT** (Kevin Indig, 1,2 million de réponses, rapporté en secondaire) : contenu cité deux fois plus souvent porteur d'un « ? » ; 44,2 % des citations dans le premier tiers de la page. **Contre-exemple** : SE Ranking (11/2025), aucun gain aux seuls titres en question ni aux FAQ. [étude] https://fortitudemedia.ai/insights/anatomy-of-article-cited-by-ai
- **Statistiques et sources citées** : jusqu'à environ +40 % de visibilité dans des moteurs génératifs simulés (KDD 2024). [étude] https://arxiv.org/abs/2311.09735
- **Instabilité des citations** : 34 à 42 % de recouvrement d'un jour à l'autre. [étude] https://arxiv.org/pdf/2604.07585

### 2.5 Ce que ce document en tire

| Règle | Appui | Statut |
| --- | --- | --- |
| Un seul H1 visible | Google, liens de titre ; accessibilité | [officiel, extrait] pour le titre affiché ; pas un facteur de classement |
| Hiérarchie sans saut | RGAA / WCAG ; Google : aide à comprendre | [officiel] pour l'accessibilité ; neutre pour le classement |
| Titres qui nomment la question ou le sujet | Microsoft ; études | [officiel, extrait] Microsoft ; [étude] contradictoire |
| Réponse directe sous le H1 (40-60 mots) et ouverture courte sous les H2 | Microsoft (« une à deux phrases ») ; B08 existant ; praticiens | **[hypothèse de la maison]** pour la fourchette ; tolérance large sous les H2 pour ne pas uniformiser |
| Longueur en fourchette, pas un nombre | Google ; Ahrefs (0,04) | [officiel, extrait] + [étude] |
| Couvrir les sous-questions réelles | fan-out documenté ; étude d'avril 2026 | fan-out [officiel, extrait] ; effet sur la citation [hypothèse] |
| Rien de spécial « pour l'IA » | guide Google | [officiel, extrait] : nos blocs sont des paragraphes utiles au lecteur, pas des fragments pour robots |
| Pas de réponse clé cachée | Microsoft | [officiel, extrait] |

**Le danger à éviter** : faire de ces règles un moule d'écriture. Le guide Google le dit : le contenu non banal compte plus que la forme. Les règles de forme sont **nécessaires, pas suffisantes** ; l'apport original (B07), les faits sourcés (B02, B09) et la critique de R5 restent le cœur. Trois garde-fous contre l'uniformisation : tolérance sur les ouvertures de H2 (R-2), part de H2 en question **plafonnée par les questions réellement sourcées** (H-10), et contrôle de **variété des plans** contre les 20 derniers contenus du même gabarit (§ 9.2, test 24).

## 3. Vue d'ensemble

```
R1 réserve de besoins (pré-classement de l'intention, sans modèle coûteux)
 ─► R2 BRIEF : intention + admissibilité + formats observés (pages déjà lues) + gabarit
        + plan Hn figé (type de chaque H2) + questions sourcées + fourchette calculée par le code
 ─► R3 faits ─► R4 RÉDACTION : plan dans l'ordre, ouvertures de H2, balisage, fourchette
 ─► R5 critique (reçoit les mesures de remplissage et de manque) ─► R6 faits
 ─► R7 ÉDITION : verifierStructureArticle avant/après, corrige la forme, renvoie le fond
 ─► R8 PORTE : B18 à B23 (contenus avec brief de chaîne), B08, B11 et W01 adaptés
 ─► gabarit (G1-G8, A1, GU1) : rend le H1 et place les blocs ; ne recalcule rien
```

Le **même module pur** (`verifierStructureArticle`, § 11.1) sert à R2 (sur le plan), R4 et R7 (sur le brouillon) et à la porte (sur le texte final) : une seule mesure, quatre moments. C'est ce qui permet à la porte de dire presque toujours oui à un contenu de la chaîne.

## 4. Intention de recherche et format

### 4.1 Les cinq intentions, reprises de `SearchIntent`

Le dépôt a déjà une taxonomie : l'énumération Prisma `SearchIntent` (`informational`, `commercial_investigation`, `transactional`, `navigational`, `local`, plus `voice_search`, `ai_overview`, `featured_snippet`), lue par `search-intent-validator.ts`, dont le résultat entre dans la note (`P_intention`). **On la réutilise** au lieu d'en créer une quatrième.

| Intention (libellé console) | Valeur `SearchIntent` | Le dirigeant veut… | Exemple | Article ? |
| --- | --- | --- | --- | --- |
| Informationnelle | `informational` | savoir, comprendre, **faire** (le volet « Do » sans achat) | « Comment automatiser les notes de frais ? » | **Oui** |
| Comparative | `commercial_investigation` | comparer des options ou **évaluer une décision** (lequel, oui ou non, en combien de **temps**) | « Copilot ou ChatGPT pour une PME ? », « Avec cinq salariés, l'IA vaut-elle le coup ? » | **Oui** |
| Transactionnelle | `transactional` | agir tout de suite (demander, s'inscrire, acheter) **ou connaître un prix**, un tarif, un montant | « diagnostic IA PME », « formation IA entreprise prix » | **Non** : page d'offre ou de contact |
| Locale | `local` | un prestataire ou un lieu dans une ville | « formation IA entreprise Lyon » | **Non** : pages villes de S6 |
| Navigation | `navigational` | atteindre une page précise d'un site connu | « axion ia contact » | **Non** : la page existe |

- Les trois autres valeurs (`voice_search`, `ai_overview`, `featured_snippet`) sont des **formats**, pas des intentions : R2 ne les choisit jamais.
- **Correspondance avec `brief.ts`** (`INTENTIONS = information, comparaison, decision`) et le plan 365 (288 `information`, 29 `comparaison`, 48 `décision`) : `information` → `informational` ; `comparaison` et `decision` → `commercial_investigation`. Les 48 sujets « décision » sont des évaluations (« vaut-il le coup », « par où commencer »), pas des achats.
- **`targetSearchIntent`** du contenu est **dérivé** de l'intention du brief : `search-intent-validator` et B21 jugent donc la même intention (test 9).
- **« Combien »** n'est éditorial que pour du **temps, un volume, des heures**. Une question de **prix ou de montant** est `transactional` : la règle de marque interdit le prix dans le texte, donc un article ne pourrait pas y répondre (« Needs Met »).

### 4.2 Admissibilité

- **I-1.** Un brief `transactional`, `local` ou `navigational` **n'entre pas en rédaction**. R2 rend `intention_hors_article` avec `pageCible` (URL existante qui sert l'intention, lue dans `strategie/carte-requetes.ts` ou la liste des pages d'offre). Le besoin passe `ecarte` avec cette raison. Sans page existante : **signalement à Will** (une page d'offre ou une page ville manque), jamais un article de remplacement.
- **I-2.** Une requête « locale » dont la réponse ne dépend pas du lieu est reformulée en `informational` **sans nom de ville** (règle du plan 365).
- **I-3.** Intention mixte : on regarde les pages lues (§ 4.3). Si **au moins 60 % des pages lisibles** sont des pages d'offre, l'intention est `transactional` (I-1). Sinon elle reste éditoriale, sans prix dans le texte.
- **I-4. Pré-classement en amont (R1, C11)** : `ContenuBesoin` reçoit une colonne texte nullable `typeIntention`, posée par une règle simple (mots « prix », « tarif », « devis », nom de ville, nom de marque d'Axion-IA) pour écarter **avant** R2 les besoins manifestement hors article, sans payer une passe d'Opus. R2 confirme ou corrige.
- **Code de raison nouveau** (liste fermée de C4) : `intention_hors_article`.

### 4.3 Format qui répond à l'intention

R2 lit déjà les cinq premières pages de résultats de **son outil de recherche** (`CONCEPTION-CHAINE-EDITORIALE-IA.md`, R2). Ce n'est **pas** le classement de Google France : c'est un **échantillon** des pages qui se classent, à traiter comme tel [hypothèse : l'outil renvoie des pages proches de celles de Google ; à vérifier pendant l'observation, sur 20 requêtes, par comparaison manuelle]. Pour chacune, R2 note le **format observé** dans une liste fermée : `definition`, `guide-etapes`, `liste-classement`, `comparatif-tableau`, `analyse`, `faq`, `chiffres`, `actualite`, `page-offre`, `forum`, `video`, `autre`. Le **format dominant** est celui d'au moins **60 % des pages lisibles**, sinon `mixte` ; il est **calculé par le code**.

| Besoin (`besoin`) | Intention | Format attendu | Gabarits compatibles |
| --- | --- | --- | --- |
| savoir ce qu'est X | informational | définition courte, usages, limites | Définition |
| comprendre pourquoi, les enjeux | informational | constat, causes, leviers | Analyse |
| faire, mettre en place | informational | étapes, prérequis, résultat attendu | Guide ; Guide pilier (panorama) |
| plusieurs questions courtes | informational ou commercial_investigation | questions-réponses | Questions-réponses |
| panorama de tâches ou d'outils | informational | liste commentée, critères, synthèse | Sélection ; Guide pilier |
| mesurer, situer | informational | chiffres datés et sourcés, lecture | Chiffres (avec relevé structuré) |
| savoir ce qui change | informational ou commercial_investigation | ce qui change, pour qui, que faire | Actualité |
| illustrer par une situation | informational | exemple type étiqueté | Étude de cas |
| comparer A et B | commercial_investigation | tableau de critères, « ça dépend de… » | Comparatif |
| choisir parmi N options | commercial_investigation | options classées par usage, critères, synthèse | Sélection |
| décider oui ou non, par où commencer | commercial_investigation | critères, calcul simple en temps, seuils | Analyse ; Guide ; Guide pilier |

- **F-1.** Le gabarit est dans la colonne « compatibles » de son couple intention / besoin. Les 365 lignes du plan doivent passer cette table (test 10) : les 13 `information` + `selection` relèvent du « panorama », les 11 `décision` + `faq` et les 2 `décision` + `actualite` de la comparative admise par ces gabarits, les 5 `décision` + `guide-pilier` de « décider, par où commencer ».
- **F-2.** Si le format dominant diffère du gabarit choisi, R2 justifie en une phrase (`ecartFormat`). Un écart non justifié invalide le brief.
- **F-3.** Si au moins 60 % des pages lisibles sont des `forum` ou des `video`, R2 vérifie qu'un article répond bien au besoin ; sans angle, `pas_d_angle` (verdict existant).
- **Appel à l'action** : inchangé (§ 9.2 de la porte) : Diagnostic IA 45 min par la page contact, ou renseignements Journée IA ; jamais `/appel`.

## 5. Structure des titres

Mots : `compterMots` de `passages-citables.ts` sur le texte sans balises. Caractères : texte normalisé (espaces repliés). **Mots significatifs** : mots de 3 lettres ou plus hors d'une liste fermée `MOTS_VIDES_FR` (articles, prépositions, pronoms, auxiliaires ; définie et testée dans le module du § 11.1). **Normalisation** : `normaliserTitre` (existante) puis retrait d'un « s » ou d'un « x » final sur les mots de plus de 3 lettres (`racineSimple`, nouvelle, testée). Les seuils de longueur sont des **choix de lisibilité** [hypothèse], calibrés sur les 365 questions du plan (médiane 86 caractères et 15 mots ; 90e centile 108 caractères et 19 mots ; maximum 133 et 24).

### 5.1 H1 et réponse directe

- **H-1. Un seul H1 par page rendue**, produit par la page à partir du titre (`PLAN.md` gabarits § 4). **Point de mesure** : la sortie brute de R4 et de R7 (`outputJsonRaw`), **avant** le nettoyeur HTML. Le nettoyeur retire la balise `<h1>` (`FORBID_TAGS`) mais garde son texte : mesurer après lui laisserait passer un titre orphelin. Un `<h1>` dans le corps brut est un écart B18.
- **H-2.** Le **mot-clé principal** est présent **dans le H1 ou dans la réponse directe** (contrôle `keyword_missing` existant, sur `directAnswer`). Le H1 contient au moins **la moitié des mots significatifs** du mot-clé, arrondie à l'entier inférieur, et au moins un (exemple : E02, « Avec cinq salariés, l'IA vaut-elle vraiment le coup pour moi ? », mot-clé « IA pour une entreprise de moins de 10 salariés » : « salariés » présent ; la formulation complète est dans la réponse directe).
- **H-3.** H1 de **20 à 120 caractères** et **au plus 20 mots** (354 et 347 des 365 questions passent). Au-delà, R2 **abrège** la question en H1 et place la formulation complète dans la réponse directe.
- **H-4.** Pas de nom de marque, pas de séparateur `|` de type balise title, pas d'année sauf si le contenu est réellement daté de cette année.
- **H-5.** Le H1 et le `<title>` sont deux textes indépendants ; le `<title>` garde ses bornes existantes (50 à 60 caractères, `edition-seo.ts`).
- **R-1.** La réponse directe sous le H1 est le champ **`directAnswer`** (rendu par `AnswerCard`, `data-aeo="tldr"`), **pas** le corps : B08 la mesure là, 40 à 60 mots, inchangé.

### 5.2 H2 : un plan figé, des types déclarés

Le plan du brief (`planHn`) donne pour chaque H2, **dans l'ordre**, un **type** : `informatif`, `etape`, `option`, `cadrage`, `impose`, `structurel`. **Le H2 numéro i du corps correspond à la section i du plan** : c'est cet appariement par position qui relie un titre reformulé à sa question (R7 vérifie que le nombre, l'ordre et les types sont identiques). Le corps porte aussi `data-section="<type>"` sur chaque H2 qui n'est pas `informatif` (attribut déjà conservé par `html-sanitizer.ts`), pour que le gabarit rende options et étapes sans deviner.

- **H-6.** Nombre de H2 par **bornes du gabarit** (§ 10), compté selon les types indiqués dans le tableau. Les H2 `structurel` (sources, « À lire aussi ») ne sont jamais comptés.
- **H-7.** H2 `informatif`, `etape`, `cadrage` : **3 à 12 mots, au plus 70 caractères** ; pour un `informatif`, au moins **un mot significatif** commun avec sa `questionCouverte` après normalisation. H2 `option` : 1 à 12 mots (un nom d'outil ou de tâche suffit). H2 `impose` : libellé exact de la liste fermée du gabarit (§ 10), exempt de H-7 à H-9.
- **H-8.** **Titres génériques interdits** pour les types `informatif` et `cadrage` : « Introduction », « Conclusion », « En résumé », « Pour aller plus loin », « Contexte », « Définition », « Avantages », « Inconvénients », « Les enjeux », « Notre avis », seuls ou suivis d'un deux-points. Liste fermée `TITRES_GENERIQUES`, testée.
- **H-9.** Un H2 en question finit par « ? » et sa section du plan porte une **question du brief avec son origine** (`search-console`, `plan-editorial`, `autre-source`). Une question écrite en titre sans question du brief à cette position est un écart (`question_hors_brief`, code existant).
- **H-10. Part de H2 en question** : visée par gabarit (§ 10 : 50 % pour Analyse, Guide pilier, Actualité ; 30 % pour Comparatif, Cas, Définition ; 0 % exigé pour Guide, Sélection, Chiffres), **jamais au-delà des questions réellement sourcées** : `seuil = min(cible du gabarit, questions sourcées disponibles ÷ H2 informatifs)`. Sans question sourcée, aucune n'est exigée et **aucune ne doit être inventée**. Mesurée par **W01** (seuil par gabarit, **6 points inchangés**).
- **H-11.** Pas de H2 en double après normalisation ; aucun H2 identique au H1 ; le mot-clé principal exact dans **au plus la moitié** des H2.

### 5.3 H3 et au-delà

- **H-12.** Un H3 n'existe que sous un H2 qui en a au moins deux (`lone_h3`, existant), sauf les trois H3 imposés de la Sélection ; 3 à 12 mots, au plus 70 caractères (H3 imposés : libellé exact).
- **H-13.** Aucun saut de niveau (`heading_level_skip`), aucun sous-titre avant le premier H2 (`subheading_before_h2`), codes existants.
- **H-14.** H4 : seulement dans le Guide pilier (étapes sous un H3). H5, H6 : interdits.
- **H-15.** Faux titre (paragraphe de moins de 12 mots tout en `<strong>`, suivi d'un paragraphe) : avertissement de R7, transformé en H3 ou en texte courant.

### 5.4 Mise à jour d'un article publié

- **H-16. Aucun renommage de H2 en mode mise à jour.** `buildToc` (`lib/knowledge/article-enrich.ts`) réécrit l'`id` de chaque H2 à partir de son texte et ignore un `id` existant ; il est gelé (`DECOUPAGE.md`). Renommer un H2 casserait donc les liens profonds déjà cités. Exception : un H2 **générique** d'un ancien corps (« Introduction »…) peut être renommé **une fois**, sur décision humaine dans la file de relecture, en acceptant la perte de l'ancre.
- En mise à jour, B18 et B19 ne s'appliquent **qu'aux sections ajoutées ou modifiées** (régime de Q15, § 11.2) : les H2 anciens non touchés sont tolérés tels quels.

## 6. Réponses d'ouverture et blocs citables

- **R-2. Ouverture sous un H2 `informatif` ou `cadrage`** : le premier élément après le H2 est un `<p data-aeo="answer">` qui répond à la question de la section **avant** toute liste, tableau, H3 ou encadré. **Cible pour R4 : 40 à 60 mots. Tolérance de la porte : 25 à 80 mots**, exigée pour **au moins 70 %** de ces H2. Exemptés : `etape` (une consigne d'action courte suffit), `option` (la carte du gabarit structure la réponse), `impose`, `structurel`, et toute section dont le **premier bloc est un tableau** annoncé par une phrase. Les générateurs actuels demandent déjà ce balisage (`blog-article.ts`, `blog-from-keywords.ts`, `barometer-insight.ts`, `blog-from-rss.ts`…) : C7 regroupe ces consignes en une seule source au lieu de les recopier.
- **R-3. Autonomie** : l'ouverture ne commence ni par un renvoi (`commenceParUnRenvoi`, existant) ni par un pronom de reprise (« Elle », « Cela », « Ce dernier », « Celle-ci », « Ces derniers », « Ils », « Elles », et « Il » **sauf** dans les tournures impersonnelles « Il faut », « Il existe », « Il y a », « Il est », « Il s'agit », « Il suffit », « Il reste ») ; elle contient au moins un mot significatif du H2.
- **R-4.** Un chiffre dans une réponse directe ou une ouverture porte sa source et son année dans le même paragraphe (B02, appliqué ici en priorité).
- **R-5. Jamais caché** : `directAnswer` et les ouvertures ne sont jamais dans un `<details>` fermé, un onglet ou un élément masqué. Seule exception : les cartes du gabarit Questions-réponses, où la **première est ouverte** et toutes les réponses sont dans le HTML servi sans JavaScript [hypothèse : risque faible, à vérifier par l'échantillon de citations de la P10 du pilotage].
- **R-6. Blocs citables** : chaque article contient l'**élément obligatoire de son gabarit** (étapes, tableau, définition, chiffres datés…), parce qu'il sert le lecteur ; B21 le vérifie. Aucun fragment ajouté « pour l'IA ».

## 7. Longueur : une fourchette par article

### 7.1 Principe

La longueur n'est **pas un objectif**. Elle sert à refuser **le remplissage** (trop long pour la question) et **le manque** (sous-questions non couvertes). Google le dit, l'étude Ahrefs ne trouve presque aucun lien entre longueur et citation (§ 2).

### 7.2 Une seule façon de compter, des deux côtés

- **Fonction unique** `compterMotsTexte(texte)` = `compterMots` de `passages-citables.ts`, appliquée à du **texte**.
- **Pages lues par R2** : le texte que rend l'outil `web_fetch` (il rend déjà le contenu extrait de la page, pas le HTML brut). On ne prétend pas distinguer `<main>` du reste : l'outil en décide.
- **Notre article** : le même périmètre qu'une page lue, c'est-à-dire **le contenu de l'article tel qu'il sera affiché** : réponse directe, corps, FAQ, sources. Sont exclus seulement les blocs ajoutés hors rédaction (appels à l'action, bloc normalisé Journée IA, carte auteur, articles liés) **et tout ce que rend le layout** (en-tête, pied de page du site).
- **Écart de méthode assumé** [hypothèse] : l'extraction de l'outil peut garder ou perdre des bouts de page. Un **facteur de correction** par gabarit (départ 1,0) est calibré pendant l'observation (§ 9.3) en comparant, sur 20 pages, le compte de l'outil à un compte manuel.

### 7.3 Calcul par le code (`calculerFourchetteMots`)

Entrées : les mesures des pages lues, le gabarit, le plan.

1. **Pages retenues** : celles dont le format observé est compatible avec le gabarit (sont exclues `page-offre`, `forum`, `video`, pages d'Axion-IA) et dont le compte n'est pas `null`. **Aucune lecture supplémentaire** : on utilise les 5 pages que R2 lit déjà. Surcoût : zéro appel, quelques millisecondes de calcul.
2. **Traçabilité** : chaque URL mesurée doit figurer dans le **journal des appels d'outil** de R2 (`outputJsonRaw.equipe`) ; une URL absente du journal est retirée de la mesure.
3. **Si au moins 3 pages retenues** : médiane M ; fourchette brute de 0,75 × M à 1,25 × M (arrondie à 50).
4. **Sinon** (moins de 3, ou toutes `null`) : **fourchette de repli du gabarit** (§ 10), `methode = "repli-gabarit"`, affichée « mesure indisponible » en console.
5. **Plancher de couverture** : `60 + n × 100` mots, où n = nombre de H2 `informatif`, `cadrage`, `etape` ou `option` du plan ; pour Questions-réponses, `60 + q × 60`, où q = nombre de questions.
6. **Ordre de priorité, écrit et testé** : (a) le minimum est relevé au plancher de couverture ; (b) la fourchette est ramenée dans les **bornes du gabarit** ; (c) si le plancher dépasse la borne haute du gabarit, **le plan est refusé** (trop de sections pour ce gabarit : R2 réduit le plan ou change de gabarit) ; (d) l'écart entre minimum et maximum est porté à **au moins 200 mots** si les bornes le permettent, sinon on garde l'écart possible.
7. La **longueur cible du plan 365** reste une indication ; la fourchette du brief la remplace.

### 7.4 Équilibre des sections

- **L-1.** Une section `informatif` ou `cadrage` compte au moins **80 mots** ; une réponse de FAQ de **25 à 200 mots**.
- **L-2.** Aucune section ne dépasse **35 %** des mots de l'article quand il y a au moins 4 H2 comptés, **50 %** en dessous ; ne s'applique ni au Guide pilier (chapitres) ni à l'Actualité.
- **L-3. Redites** : pour deux sections A (la plus courte) et B, la **part des 5-grammes de A retrouvés dans B** est inférieure à **0,20** (`shingles` de `quality/plagiarism.ts`, plus une petite fonction `partReprise` ; la similarité de Jaccard, symétrique, sous-estimerait la reprise d'une section courte dans une longue).
- **L-4. Couverture** : **100 % des questions du brief** sont couvertes par une section du plan ou par la FAQ (`coverage_missing`, comme aujourd'hui dans `verifierPlan`). Le contrat ne change pas : R2 ne met dans `questions` que celles qu'il couvre ; les autres vont dans `questionsEcartees` avec leur motif (« autre URL du site », « hors sujet »).

## 8. Contrat des rôles

### 8.1 R2 stratège de brief

**Compatibilité de la fenêtre app/worker.** `briefSchema` et `planSchema` sont `.strict()` : un worker plus ancien **rejetterait** un brief qui porte des champs nouveaux. Les nouveaux champs vivent donc dans un **objet séparé**, `structureBrief`, avec son propre schéma versionné (`versionStructure: 1`), stocké à côté du brief existant dans `ContenuBrief` (C3). Le brief v1 ne change pas ; un worker ancien ne lit jamais `structureBrief` (test 8).

| Champ de `structureBrief` | Contenu | Validation (par le code) |
| --- | --- | --- |
| `intention` | valeur `SearchIntent` (§ 4.1) | une des 5 ; `informational` ou `commercial_investigation` pour entrer en rédaction |
| `besoin` | sous-intention (§ 4.3) | liste fermée |
| `pageCible` | URL existante si `intention_hors_article` | obligatoire dans ce cas |
| `pagesLues` | 3 à 5 entrées : URL, rang dans l'outil, format observé, `mots` (ou `null`) | chaque URL présente dans le journal des appels d'outil |
| `formatDominant` | calculé (≥ 60 % des pages lisibles, sinon `mixte`) | jamais déclaré par le modèle |
| `gabarit`, `contentType` | un des 10 codes ; type de contenu cohérent (table `PLAN.md` gabarits § 3) | F-1 ; `ecartFormat` si différent du format dominant |
| `planHn` | sections dans l'ordre : `type`, intitulé prévu, `questionCouverte` (index de question ou `null`), `blocAttendu` (définition, étapes, tableau, chiffre, oui-non, liste) | H-6 à H-14 vérifiées **sur le plan** (`verifierPlan` étendu, bornes du gabarit au lieu de 5 à 8 en dur) |
| `incertain` | booléen (Actualité : un point reste inconnu) | facultatif |
| `questionsEcartees` | questions trouvées mais non traitées, avec motif | jamais une question sans origine |
| `fourchetteMots` | `{ min, max, methode, mediane, pagesRetenues }` | calculée par `calculerFourchetteMots` ; le modèle ne la choisit pas |

- Les **questions** restent dans le brief v1 (`questions` avec `origine` et `reference`) ; `planHn` les désigne par leur index.
- **Questions sourcées minimales par gabarit** : Questions-réponses **au moins 6** ; si R2 en trouve moins, il choisit un autre gabarit (Analyse) : **jamais de question inventée**. Sources admises : réserve de R1, Search Console, plan éditorial, et pages lues par R2 (origine `autre-source`, URL en référence, **D-A7**).
- **Verdict nouveau** : `intention_hors_article`. `pas_d_angle` et `pas_de_matiere` sont inchangés.
- **Le brief est figé** avant R4 ; les réécritures ciblées gardent le même brief.

### 8.2 R4 rédacteur

- Suit `planHn` **dans l'ordre**, sans ajouter ni retirer de H2 ; pose `data-section` sur les H2 non informatifs.
- N'écrit jamais de `<h1>` ; écrit la réponse directe dans `directAnswer`.
- Ouvre chaque H2 `informatif` ou `cadrage` par `<p data-aeo="answer">` de 40 à 60 mots (R-2, R-3).
- Produit le **bloc attendu** (`blocAttendu`) et l'élément obligatoire du gabarit (§ 10).
- Vise **le milieu de la fourchette** ; écrit moins si les questions sont couvertes. La consigne « la longueur est déterminante pour le rang » est supprimée (C7).
- Les consignes de structure sont **tirées du brief** : une seule source, pas de texte recopié en dur.

### 8.3 R5 expert critique

Ses questions (5) « y a-t-il du remplissage ? » et (6) « qu'est-ce qui manque pour décider ? » reçoivent les mesures de § 7.4 (sections trop longues, redites, questions non couvertes). Sa grille et son modèle ne changent pas.

### 8.4 R7 éditeur

- Appelle `verifierStructureArticle` **avant et après** sa passe ; vérifie que le nombre, l'ordre et les types des H2 sont ceux du plan.
- Corrige la **forme** : longueur et libellé des titres, titres génériques, pronom de tête, balisage `data-aeo` et `data-section`, faux titres, niveaux.
- Ne déplace **aucun chiffre** (comparaison avant/après) et ne change pas le sens d'une réponse.
- Renvoie à R4 ce qui relève du fond (section trop courte, question non couverte, longueur hors fourchette, redite), en correction localisée, dans le compteur unique de 2 réécritures.

## 9. Nouveaux critères de la porte : B18 à B23

### 9.1 Registre

Déterministes (aucun appel de modèle). **Champ d'application** : contenus dont le contexte de `evaluerPorte` porte un `structureBrief` valide. **Sans lui : « hors champ »**, ni évalués ni bloquants (§ 1). En mode « mise à jour » (Q15), B18 et B19 portent sur les sections ajoutées ou modifiées seulement.

| Id | Critère | Mesure (règles) | Seuil de départ [à calibrer, § 9.3] | Classe | Code de raison |
| --- | --- | --- | --- | --- | --- |
| **B18** | **Hiérarchie et libellé des titres** | H-1 à H-14 sur `outputJsonRaw` (avant nettoyage) ; nombre, ordre et types des H2 identiques au plan | 0 écart | Corrigeable | `structure_titres` |
| **B19** | **Ouvertures de section** | R-2, R-3, R-5 | ≥ 70 % des H2 `informatif` et `cadrage` conformes ; R-5 : 0 écart | Corrigeable | `style` |
| **B20** | **Longueur adaptée et sections équilibrées** | mots de l'article (§ 7.2) entre `0,9 × min` et `1,1 × max` ; L-1 à L-3 | ± 10 % ; 0 écart L-1 à L-3 | Corrigeable | `longueur` |
| **B21** | **Format conforme à l'intention et au gabarit** | F-1 ; élément obligatoire du gabarit présent (§ 10), mesuré sur le balisage ; `targetSearchIntent` = intention du brief | conforme | Corrigeable | `format_intention` |
| **B22** | **Intention éditoriale admissible** | intention ∈ {`informational`, `commercial_investigation`} | admissible | **Dur** | `intention_hors_article` |
| **B23** | **Questions traçables et couvertes** | L-4 (100 %) ; H-9 par appariement de position ; aucune question à la fois en H2 et dans la FAQ (`coverage_duplicate`) | 100 % | Corrigeable | `questions_non_couvertes` |

- **B22 est dur** : D-A3 dit « jamais d'article » pour ces intentions ; une dérogation n'aurait pas de sens. Il double R2 volontairement (dernier filet) et reste distinct de B05 (intention libre, dérogeable) : B05 dit « pas déjà couverte », B22 dit « éditoriale ».
- **B21 et `P_intention`** jugent la même intention, puisque `targetSearchIntent` est dérivé du brief (§ 4.1).

### 9.2 Ajustements des critères existants (formule de note inchangée)

- **B08** : inchangé, sur `directAnswer`.
- **B11** : le plancher unique « ≥ 850 mots (articles) » et « 3 à 8 H2 » est **remplacé, pour les contenus de la chaîne, par les bornes du gabarit** (B18, B20). Hors chaîne, B11 reste tel quel. B11 garde le reste (`data-quality-gate`, page mince sous 350 mots, H1 unique). **D-A1.**
- **W01** : seuil par gabarit et plafonné par les questions sourcées (H-10) ; **6 points inchangés**.
- **W08** (variété, avertissement existant) : sa mesure de plan devient la distance SimHash des titres (`dedup/outline-simhash.ts`, existant) contre les **20 derniers contenus du même gabarit** ; le blocage des plans quasi identiques reste celui du contrôle existant `doublon_plan` (Hamming ≤ 4). Points inchangés.
- **Note** : `100 − P_avertissements − P_preuves − P_proximité − P_intention`, identique ; somme des maxima = 86, test inchangé.
- **Classement du § 5 de la porte** : B18, B19, B20, B21, B23 → **Corrigeable** ; B22 → **Dur**. Le test de concordance « colonne dérogation = classement » couvre les nouveaux critères.
- **Codes de raison** ajoutés à la liste fermée de C4 : `structure_titres`, `longueur`, `format_intention`, `intention_hors_article`, `questions_non_couvertes` (B19 reste sous `style`, comme B08). Le détail garde le critère (`B18`…), la règle (`H-7`, `L-3`…) et la preuve.
- **Version de la porte** : nouvelle `versionPorte` ; les anciens verdicts restent lisibles.
- **Alarme amont** : un refus fréquent sur B20, B21, B22 ou B23 pointe R2 ; sur B18 ou B19, R4 ou R7. Affiché comme tel en console.

### 9.3 Observation avant blocage

L'observation Q9 de la porte porte sur le pipeline actuel, **sans brief** : elle ne peut pas calibrer B18 à B23. Ces critères ont donc leur **propre observation** : ils tournent **en ombre** sur les sorties de C10 (chaîne de bout en bout, relecture humaine à 100 %) jusqu'à ce que **chaque gabarit** ait **au moins 10 contenus relus** par Will. On compare alors leurs verdicts à ceux de Will et on ajuste les seuils (nouvelle version de la porte). Un gabarit sans ses 10 contenus reste en ombre. Le passage en blocage réel est un clic de Will (**D-A5**).

## 10. Adaptation aux 10 gabarits

Le gabarit fixe la **mise en page de l'article** ; l'**en-tête et le pied de page du site** sont rendus par le layout et n'entrent dans aucune règle. Bornes de mots : **hypothèses de départ** tirées des longueurs cibles du plan 365 (définition 800-1 000, FAQ 800-1 200, actualité 900-1 100, analyse 1 100-1 400, guide 1 200-1 800, comparatif 1 400-1 800, sélection 1 300-1 600, chiffres 1 100-1 400, guide pilier 2 000-2 300), élargies pour laisser la mesure décider ; calibrées au § 9.3.

| Gabarit (code, PR) | H2 comptés (types) | H2 imposés (`impose`, liste fermée) | Part de H2 en question (cible, H-10) | Bornes de mots | Repli | Élément obligatoire (B21), mesuré sur le balisage |
| --- | --- | --- | --- | --- | --- | --- |
| Analyse (`analyse`, G1) | 4 à 8 (informatif, cadrage) | aucun | 50 % | 800 - 2 200 | 1 100 - 1 500 | au moins un `<ul>`/`<ol>` d'au moins 3 éléments, un `<table>`, ou un encadré `ax-stat` sourcé |
| Guide pratique (`guide`, G2) | 3 à 10 (etape) + 0 à 3 (cadrage) | aucun | 0 % | 800 - 2 200 | 1 200 - 1 800 | au moins 3 H2 `data-section="etape"`, ou un `<ol>` d'au moins 3 étapes ; prérequis en liste avant le premier H2 (encadré « Avant de commencer » du gabarit) |
| Comparatif (`comparatif`, G3) | 4 à 8 (informatif, cadrage, impose) | « Lequel choisir ? » | 30 % | 1 000 - 2 400 | 1 400 - 1 800 | premier `<table>` du corps avec `<th>`, au moins 2 colonnes d'options et 4 lignes de critères ; aucun gagnant, aucune note |
| Sélection (`selection`, G4) | 3 à 10 (option) + 1 à 3 (cadrage, impose) | « Comment nous avons choisi » | 0 % | 1 000 - 2 400 | 1 300 - 1 700 | chaque H2 `option` suivi de trois H3 exacts « Pour qui », « Points forts », « Limites » ; aucun numéro écrit dans le H2 (compteur CSS du gabarit) |
| Étude de cas (`cas`, G5) | 5 (impose) + 0 à 2 (informatif) | « Le contexte », « Avant », « Pendant », « Après », « Ce que l'équipe a appris » | 30 % (des informatifs) | 700 - 1 800 | 900 - 1 400 | les 5 H2 imposés dans l'ordre ; encadré `ax-exemple` « Exemple type, pas un client » ; aucun chiffre de résultat |
| Définition (`definition`, G6) | 3 à 6 (informatif, impose) | « À ne pas confondre avec » | 30 % | 500 - 1 300 | 700 - 1 000 | `directAnswer` qui commence par le terme suivi de « est » ou « désigne » ; le H2 imposé |
| Questions-réponses (`faq`, G7) | 6 à 15 **questions** (champ FAQ structuré) | aucun | 100 % (des questions) | 600 - 1 800 | 800 - 1 200 | au moins 6 questions sourcées dans le champ FAQ ; chaque réponse de 25 à 200 mots ; au-delà de 10 questions, 2 à 5 thèmes |
| Chiffres (`chiffres`, G8) | 3 à 7 (informatif, impose) | « Comment lire ces chiffres » | 0 % | 700 - 1 700 | 1 000 - 1 400 | relevé structuré rattaché (`charger-releve.ts`) ; chaque chiffre du texte daté et sourcé ; le H2 imposé |
| Actualité (`actualite`, A1) | 3 (impose) + 0 à 2 (informatif) | « Ce qui change », « Pour qui ça change », « Que faire maintenant » ; « Ce que l'on ne sait pas encore » si `incertain` | 50 % (des informatifs) | 400 - 1 300 | 700 - 1 100 | les H2 imposés ; source d'origine avec URL et date |
| Guide pilier (`guide-pilier`, GU1) | 5 à 9 chapitres (informatif avec au moins 2 H3) + 1 (impose) | « Votre feuille de route » | 50 % | 1 800 - 4 500 | 2 000 - 2 800 | chaque chapitre a au moins 2 H3 ; H4 admis pour les étapes ; H2 imposé en dernier ; ids `step-N` conservés |

### 10.1 Notes par gabarit

- **Analyse (G1)** : gabarit de **repli** de tous les autres tant qu'ils ne sont pas livrés. Un contenu destiné à un gabarit non livré est **vérifié selon son gabarit cible** (brief) et rendu en Analyse : la structure reste juste, seule la mise en page attend.
- **Guide (G2)** : `parseStepsFromBody` (`guides/loader.ts`) cherche « Étape N » ou « N. » **en début de ligne de texte** : il ne reconnaît ni `<h2>Étape 1 : …</h2>` ni `<ol><li>`. **Prérequis de G2** : adapter l'extraction au HTML (H2 `data-section="etape"`, puis `<ol>`), sans changer l'écriture. B21 mesure le balisage, pas `parseStepsFromBody`. Au-delà de 8 étapes : H2 = phases, H3 = étapes. `calculator_roi` : formule et scénarios, **aucun montant de prix**.
- **Comparatif (G3)** : le premier `<table>` est remonté en « En bref » par le gabarit : R4 écrit le tableau récapitulatif **en premier**. Le H2 imposé porte la réponse « ça dépend de… ».
- **Sélection (G4)** : les H2 `option` portent `data-section="option"` : le gabarit leur applique le compteur CSS et laisse hors compte les H2 `cadrage` et `impose`.
- **Étude de cas (G5)** : le plan 365 n'en contient aucune (les études fictives ont été converties en guides). Admis seulement pour un **exemple type étiqueté** ou un cas réel autorisé par écrit ; jamais de résultat chiffré mis en valeur.
- **Définition (G6)** : avec 3 H2, pas de sommaire (masqué sous 4 entrées) : voulu. Les termes liés viennent du glossaire, pas du texte.
- **Questions-réponses (G7) : une seule source pour les questions.** Les questions et réponses vivent **dans le champ FAQ structuré**, rendu par `ArticleFaq` (comme le prévoit G7) avec une **seule `FAQPage`** (J1) ; le corps ne contient qu'une courte introduction, **sans H2 de question**. Pour ce gabarit, B19 lit les réponses de la FAQ (25 à 200 mots, première carte ouverte), B23 vérifie l'origine de chaque question, et H-6 compte les questions. Dans les **autres gabarits**, la FAQ de fin reste aussi dans le champ structuré et aucune de ses questions n'est un H2 (`coverage_duplicate`). Ce choix est à reporter dans G7 et J1.
- **Chiffres (G8)** : **sans relevé structuré, pas de gabarit Chiffres** : le brief choisit Analyse. Les 17 sujets « chiffres » du plan 365 sont vérifiés en C6.
- **Actualité (A1)** : `/actualites/[slug]` n'est servi que pour `blog_from_rss`. Les 11 sujets « actualité » du plan 365 n'ont pas encore de type de contenu qui y mène (**D-A4**) ; en attendant ils sont rédigés avec la structure Actualité et rendus en Analyse.
- **Guide pilier (GU1)** : seul gabarit où H4 est admis. Le type `guide_pilier` est dans la famille `guide` de la table du blog alors que GU1 sert `/guides/[slug]` : route à confirmer avant C6 (**D-A4**).

## 11. Où chaque règle s'insère

### 11.1 Module commun

Module **pur** `src/server/content-gen/structure/` (nom indicatif), sans base ni réseau : `GABARITS_REGLES` (tableau du § 10, **source unique**, lue aussi par la console), `TITRES_GENERIQUES`, `MOTS_VIDES_FR`, `racineSimple`, `compterMotsTexte`, `formatDominant`, `calculerFourchetteMots`, `partReprise`, `verifierStructureArticle(contenu, structureBrief)` → écarts `{ regle, critere, section, preuve }`.

Il **réutilise** `outline-validator.ts` (codes existants ; mode bloquant **paramétré par gabarit**, les appelants hors chaîne gardent leur comportement), `passages-citables.ts`, `normaliserTitre`, `shingles` de `plagiarism.ts`, `outline-simhash.ts`. **Il ne duplique rien.**

### 11.2 Table d'insertion

| Règle(s) | PR | Ce qui s'ajoute |
| --- | --- | --- |
| `structureBrief` (§ 8.1) ; colonne `typeIntention` de `ContenuBesoin` (I-4) | **C3** (tables) | schéma séparé et versionné, brief v1 intact ; `ContenuBrief` stocke les deux JSON ; colonne texte nullable ; aucune énumération Prisma nouvelle |
| Codes de raison | **C4** | `structure_titres`, `longueur`, `format_intention`, `intention_hors_article`, `questions_non_couvertes` ; correspondance B18…B23 → code |
| Module commun (§ 11.1) et fixtures de contrat | **C6** | le module pur, ses tests, et les **fixtures de contrat par gabarit** qui servent ensuite aux tests des PR G (21 à 23) |
| Intention, admissibilité, format, gabarit, plan, fourchette | **C6** (R2) | formats observés et mots des pages déjà lues ; `calculerFourchetteMots` ; `verifierPlan` étendu ; `intention_hors_article` ; dérivation de `targetSearchIntent` ; import du **CSV du plan 365** |
| Pré-classement de l'intention | **C11** (R1) | règle simple qui remplit `typeIntention` avant R2 |
| Rédaction (§ 6, § 8.2) | **C7** (R4) | consignes tirées du brief ; regroupement des consignes `data-aeo` dispersées dans les générateurs ; suppression de « la longueur est déterminante » ; contrôle de sortie |
| Mesures pour la critique | **C8** (R5) | mesures L-1 à L-4 en entrée |
| Forme et renvoi du fond ; H-16 | **C9** (R6, R7) | `verifierStructureArticle` avant/après ; contrôle nombre, ordre, types des H2 ; règle « aucun renommage en mise à jour » |
| Observation dédiée (§ 9.3) | **C10** et **C14** | verdicts en ombre de B18 à B23 sur les sorties de la chaîne ; compteur « contenus relus par gabarit » |
| B18 à B23 ; B11, W01, W08 adaptés | **Q2c** (nouvelle, **après C6**) | ajout au registre `CRITERES` (classe, seuil, champ d'application), en ombre. Q2 n'est pas modifiée et reste sans dépendance à C6 |
| `theme`, `typeIntention`, `pageCible` au registre des intentions | **Q5a** (conception à corriger, non encore livrée) et **Q5** | `ContentIntention` reçoit **deux colonnes texte nullables distinctes**, `theme` (financement, réglementation…) et `typeIntention` (valeur `SearchIntent`), plus `pageCible` nullable. Q5 alimente B22 depuis le registre |
| Mise à jour | **Q15** | régime « sections modifiées seulement » pour B18 et B19 ; H-16 |
| Rendu | **G1 à G8, A1, GU1** (+ S3) | lecture de `data-section` ; rien n'est recalculé ; G2 adapte l'extraction des étapes au HTML ; G7 et J1 : questions dans le seul champ FAQ ; tests 21 à 23 |
| Console | **C14**, **Q8** | intention, gabarit, fourchette, mots mesurés, méthode ; raisons B18 à B23 ; `null` = « indisponible » |

**Ordre** : C3 → C4 → C6 → C7 → C8 → C9 → C10, puis Q2c et Q5a/Q5 ; C11 quand prévu. Les PR G peuvent avancer en parallèle **pour leur rendu**, mais leurs tests de contrat (21 à 23) s'appuient sur les fixtures livrées par C6. Rien ne change le comportement public avant son drapeau ; la chaîne reste éteinte par défaut.

## 12. Tests à écrire

**Module commun (C6)**

1. `calculerFourchetteMots` : médiane sur 3 et 5 pages ; moins de 3 pages ou toutes `null` → repli ; URL absente du journal retirée ; plancher qui relève le minimum ; borne du gabarit qui coupe ; plancher au-dessus de la borne haute → plan refusé ; écart de 200 mots quand c'est possible, sinon écart maximal possible ; cas FAQ de 15 questions.
2. `compterMotsTexte` : même résultat que `compterMots` ; nombres et abréviations comptés comme des mots.
3. `formatDominant` : 3 sur 5, 2 sur 3, 2-2-1 → `mixte`.
4. `verifierStructureArticle` : **un cas par règle** (H-1 à H-15, R-2, R-3, R-5, L-1 à L-4), une fixture qui passe et une qui échoue, avec la règle citée ; « Il faut … » n'est pas un pronom de reprise.
5. `GABARITS_REGLES` couvre exactement les 10 codes (`Record` exhaustif) ; les H2 et H3 imposés sont exemptés de H-7 à H-9 et de `lone_h3`.
6. `TITRES_GENERIQUES`, `MOTS_VIDES_FR`, `racineSimple` : casse, accents, deux-points, pluriels simples.
7. H1 : les 365 questions du CSV sont testées contre H-2 et H-3 ; celles qui dépassent sont **listées** pour qu'R2 les abrège (aucune abréviation automatique silencieuse).

**Brief et R2 (C3, C6)**

8. Fenêtre app/worker : un brief v1 accompagné d'un `structureBrief` est lu sans erreur par le `briefSchema` actuel (qui ne voit pas `structureBrief`) ; un `structureBrief` d'une version inconnue est ignoré, pas rejeté en bloc.
9. Intention : `targetSearchIntent` dérivé du brief ; `search-intent-validator` et B21 reçoivent la même valeur.
10. Import du CSV du plan 365 : 365 lignes, `décision` → `commercial_investigation`, **F-1 vérifié sur toutes les lignes sans rejet**, `chiffres` sans relevé signalé, aucune question sans origine.
11. `transactional`, `local`, `navigational` → `intention_hors_article` avec `pageCible` ; sans page → signalement ; une question de prix → `transactional`.
12. Questions-réponses avec moins de 6 questions sourcées → brief refusé pour ce gabarit ; aucune question créée par le code.

**Rédaction et édition (C7, C9)**

13. `<h1>` dans la sortie brute → écart B18, même si le nettoyeur l'aurait retiré.
14. H2 ajouté, retiré ou déplacé par rapport au plan → renvoi à R4.
15. R7 : chiffres identiques avant/après ; un écart de fond est renvoyé, pas « corrigé ».
16. Mise à jour : un H2 ancien renommé → refusé, sauf l'exception humaine d'un titre générique.

**Porte (Q2c, Q5)**

17. Registre : B18 à B23 présents, classe et champ d'application conformes au § 9 ; test « dérogation = classement » étendu ; B22 dur.
18. Formule de note inchangée (somme = 86) ; W01 lit le seuil du gabarit plafonné par les questions sourcées.
19. Contenu sans `structureBrief` → B18 à B23 « hors champ », aucun blocage ; mode ombre → journalisés sans blocage.
20. Correspondance B18…B23 → codes ; aucun ne tombe dans `autre`. Non-régression de marque : « dans vos locaux, partout en France » n'est refusé par aucun nouveau critère.

**Gabarits (G1 à G8, A1, GU1), sur les fixtures de C6**

21. Un seul `h1` dans la page rendue, interrupteur `BLOG_GABARITS_V2` allumé et éteint, pour chaque gabarit ; aucun titre de l'en-tête ou du pied de page n'est compté.
22. `p[data-aeo="answer"]` et `data-section` conservés au rendu ; aucune ouverture dans un `<details>` fermé hors G7 ; G2 reconnaît les étapes balisées ; G3 remonte le premier tableau une seule fois ; G4 numérote les seules options, sans double numéro ; G7 émet une seule `FAQPage`.
23. Contrat de bout en bout : une fixture conforme par gabarit passe `verifierStructureArticle` et se rend sans perte (tous les H2 du corps dans le sommaire).
24. Variété : deux briefs différents du même gabarit ne produisent pas des plans à distance SimHash ≤ 4 (W08 et `doublon_plan`).

## 13. Contradictions relevées dans les documents existants

| # | Contradiction | Arbitrage proposé |
| --- | --- | --- |
| 1 | B11 exige ≥ 850 mots ; le plan 365 prévoit des définitions et des FAQ dès 800 mots ; Google : aucun minimum. | Bornes par gabarit pour la chaîne (B18, B20) ; B11 inchangé hors chaîne. **D-A1** |
| 2 | `equipe/plan.ts` impose 5 à 8 H2 ; B11 dit 3 à 8 ; la FAQ va jusqu'à 15 questions, la Sélection jusqu'à 10 options. | Bornes par gabarit et par type de H2 ; `outline-validator` paramétré ; hors chaîne inchangé. |
| 3 | `brief.ts` a 3 intentions ; Will en demande 5 ; `SearchIntent` existe déjà ; la conception de `ContentIntention` mêle intention et thème. | Reprendre `SearchIntent` ; deux colonnes `theme` et `typeIntention` dans Q5a. **D-A2** |
| 4 | Les 11 sujets « actualité » et 13 « guide pilier » du plan 365 n'ont pas de chemin établi vers `/actualites` et `/guides`. | Rendus en Analyse ou Guide en attendant. **D-A4** |
| 5 | W01 (30 % de H2 en question) ; Will veut des H2 « souvent » en question ; un guide en étapes ou une sélection d'options ne s'y prête pas ; les questions sourcées manquent souvent. | Part par gabarit, plafonnée par les questions sourcées ; points inchangés. |
| 6 | Le gabarit FAQ (G7) rend la FAQ structurée ; mettre aussi les questions en H2 doublerait la source et la `FAQPage`. | Questions dans le seul champ FAQ, pour tous les gabarits. |
| 7 | La conception des gabarits suppose des ancres de H2 stables ; `buildToc` réécrit les `id` depuis le texte. | Aucun renommage de H2 en mise à jour (H-16). |

## 14. Décisions demandées à Will

| Id | Question | Ma recommandation par défaut, avec un exemple |
| --- | --- | --- |
| D-A1 | Remplacer, pour la chaîne, le plancher unique de 850 mots par des bornes par gabarit ? | **Oui.** Exemple : une définition de « RAG » complète en 750 mots, quand les pages lues en font 700, passe ; une analyse de 750 mots sur « faut-il former ses salariés à l'IA ? » ne passe pas (borne basse 800). |
| D-A2 | Reprendre les cinq intentions de `SearchIntent`, et ranger les sujets « décision » en comparative ? | **Oui.** Exemple : « Avec cinq salariés, l'IA vaut-elle le coup ? » reste un article ; « diagnostic IA PME » va vers la page contact. |
| D-A3 | Les requêtes transactionnelles (prix compris), locales et de navigation ne donnent jamais d'article ? | **Oui.** Exemple : « formation IA entreprise Lyon » relève des pages villes de S6 ; « formation IA prix » de la page d'offre. Si aucune page ne les sert, vous recevez un signalement, pas un article. |
| D-A4 | Où vivent les sujets « actualité » et « guide pilier » produits par la chaîne ? | **Sur `/blog`, en Analyse ou Guide, tant qu'un type de contenu ne mène pas proprement à `/actualites` et `/guides`.** Exemple : E01 (guide pilier) est rendu en Guide, sa structure en chapitres déjà vérifiée. |
| D-A5 | Garder B18 à B23 en ombre jusqu'à 10 contenus relus par gabarit ? | **Oui.** Exemple : si, sur 10 définitions relues, vous en validez 3 que B20 refusait pour 12 % de dépassement, la tolérance passe à ± 15 % par une nouvelle version de la porte, jamais en silence. |
| D-A6 | Après Q10, publie-t-on encore des contenus hors chaîne (générateurs actuels, actualités RSS) ? | **Non pour les articles neufs** (seule la chaîne en produit) ; les actualités RSS gardent les critères existants seulement, en relecture. Exemple : un article de rotation gpt-4o n'est plus publiable ; une brève RSS garde son circuit actuel. |
| D-A7 | Les questions trouvées dans les pages lues par R2 suffisent-elles comme « questions réelles » ? | **Oui, avec l'URL en référence**, en plus de la Search Console et de votre liste. Exemple : une question lue sur la page d'une CCI peut devenir un H2 ; une question qu'aucune page ne pose ne le peut pas. |

## 15. Critique indépendante

- **Tour 1** (sous-agent Opus indépendant) : « À CORRIGER », 6 défauts bloquants, 12 importants, 8 mineurs. Traités dans cette version : H1 recalibrés sur les 365 questions (H-2, H-3) ; champ d'application des critères limité aux contenus porteurs d'un brief de chaîne, et régime de mise à jour (§ 1, § 9.1, Q15) ; table de compatibilité complétée pour les 26 sujets du plan qu'elle rejetait (F-1) ; H2 imposés, types de H2 et `data-section` pour que chaque gabarit puisse satisfaire B18 (§ 5.2, § 10) ; méthode de longueur requalifiée en échantillon de l'outil, sans lecture supplémentaire, avec une seule fonction de comptage (§ 7) ; schéma séparé et versionné pour la fenêtre app/worker (§ 8.1) ; FAQ à source unique (§ 10.1) ; aucun renommage de H2 en mise à jour (H-16) ; reprise de `SearchIntent` (§ 4.1) ; tolérance des ouvertures de H2 contre l'uniformisation (R-2) ; traçabilité par appariement de position (§ 5.2) ; prix → transactionnelle ; B22 dur ; observation dédiée (§ 9.3) ; Q2c après C6 ; Q5a corrigée ; niveaux de preuve revus (§ 2) ; point de mesure avant nettoyage et `directAnswer` (H-1, R-1) ; seuils et exemptions alignés (§ 6, § 7.4).
