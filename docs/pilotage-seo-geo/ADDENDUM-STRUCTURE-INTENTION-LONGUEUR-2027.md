# Addendum : intention, structure des titres, longueur (chaîne éditoriale et porte qualité, 2027)

> Phase de conception, 27/11/2026, branche `docs/addendum-structure-hn-2027`. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**
> Demande de Will : pour **chaque article**, la chaîne éditoriale IA doit tenir compte **explicitement** de (1) l'intention de recherche et du format qui y répond, (2) la structure des titres H1/H2/H3, (3) une longueur adaptée à la question, (4) les pratiques des moteurs (Google Search, AI Overviews, AI Mode, Bing/Copilot, ChatGPT Search, Perplexity, Gemini, Claude) telles qu'elles sont fin 2026.
> Ce document **complète sans les remplacer** : `CONCEPTION-CHAINE-EDITORIALE-IA.md` (rôles R1-R8, PR C0-C16), `CONCEPTION-PORTE-QUALITE.md` (critères B01-B17, W01-W10, PR Q0-Q17), `docs/design/gabarits-articles/PLAN.md`, `DECOUPAGE.md`, `BALISAGE-ENCADRES.md` et les maquettes v3 validées par Will (`maquettes-v2/*.html`, qui priment, `PLAN.md` § 15.9), `docs/contenu/PLAN-EDITORIAL-365.md` et son CSV. Il part du code lu le 27/11/2026 : `equipe/brief.ts`, `equipe/plan.ts`, `equipe/redaction.ts`, `equipe/redacteur-en-chef.ts`, `equipe/journal.ts`, `quality/outline-validator.ts`, `quality/passages-citables.ts`, `quality/plagiarism.ts`, `quality/search-intent-validator.ts`, `quality/barrieres-publication.ts`, `dedup/outline-simhash.ts`, `fact-check/verificateur-deux-phases.ts`, `guides/loader.ts`, `shared/html-sanitizer.ts`, `lib/knowledge/article-enrich.ts`, `queue/workers/content-gen-worker.ts`, énumération Prisma `SearchIntent`.
> Les noms existants (`B01`…`B17`, `W01`…`W10`, classes Dur / Corrigeable / Dérogeable, verdicts `publiable` / `a_corriger` / `bloque`, codes de `ContenuRefus`) **ne sont pas renommés**. Les nouveaux critères sont **B18 à B23**.

## 0. En bref

1. **Aucun moteur ne publie de règle de longueur ni de nombre de titres.** Selon les extraits des pages officielles (non ouvertes en entier, § 2) : Google dit qu'il n'y a pas de nombre de mots cible et que l'ordre des titres ne compte pas pour le classement (il compte pour l'accessibilité) ; son guide d'optimisation pour l'IA (mai 2026) placerait le contenu « non banal » avant tout le reste et jugerait inutile le découpage spécial pour l'IA. Microsoft (Bing/Copilot) recommande des titres qui nomment des questions, des réponses d'une à deux phrases, et de ne pas cacher les réponses. **Les règles chiffrées ci-dessous sont des règles de qualité et de lisibilité de la maison, vérifiables par le code, pas des « facteurs de classement ».**
2. **Intention** : cinq intentions, qui **reprennent l'énumération existante `SearchIntent`**. **Seules l'informationnelle et la comparative donnent un article.** Une requête transactionnelle (y compris une question de **prix**), locale ou de navigation est servie par une page existante : le stratège rend `intention_hors_article`.
3. **Structure** : un seul H1 (rendu par la page à partir du titre), des H2 du corps qui sont, comme dans les maquettes v3, **le plus souvent les vraies questions** du brief, reliés à elles **par leur position dans un plan figé** ; aucun saut de niveau ; longueurs de titres calibrées sur les 365 questions du plan ; **réponse directe de 40 à 60 mots sous le H1** (B08, inchangé) et **ouverture visée à 40-60 mots sous chaque H2**, contrôlée avec tolérance (25 à 80 mots, au moins 70 % des H2 qui en demandent une) pour ne pas uniformiser les articles. Les maquettes v3 montrent des ouvertures plus courtes (8 à 26 mots) : l'arbitrage est soumis à Will (**D-A9**).
4. **Les blocs propres à chaque gabarit** (triptyque de l'actualité, frise de l'étude de cas, « Comment lire ces chiffres », feuille de route, verdict du comparatif) sont **rendus par le gabarit** à partir de champs ou d'encadrés balisés, **jamais par des H2 imposés dans le corps**.
5. **Longueur** : une **fourchette** par article, calculée par le code à partir des pages que le stratège lit déjà (échantillon de l'outil de recherche, comptées par le code, **sans lecture supplémentaire**), d'un plancher de couverture et des bornes du gabarit.
6. **Six nouveaux critères de porte** (B18 à B23) pour **tout contenu produit par la chaîne** ; un brief de structure manquant ou illisible sur un tel contenu **bloque** (échec fermé). B18 à B21 et B23 sont **corrigeables**, B22 (intention admissible) est **dur**. La formule de note ne change pas. Ils restent **en ombre** jusqu'à 10 contenus relus par gabarit.
7. **Contrôles et circuits existants à adapter, sinon ils casseraient la chaîne** : le validateur d'intention (qui exige un tableau pour toute intention comparative et **désindexe** sinon), trois planchers codés à 850 mots, le contrôle de plan dupliqué (SimHash), le contrôle `keyword_missing`, la section « Sources » ajoutée au corps stocké, la consigne de lisibilité V2 injectée dans tous les prompts, et l'aiguillage du worker par type de contenu (qui choisit le générateur et le gabarit). Neuf décisions pour Will (§ 14).

## 1. Portée et ce qui ne change pas

- **Dans le périmètre** : les articles **produits par la chaîne**, reconnus par un **marqueur explicite** écrit par C10 à la création du job (`outputJsonRaw.equipe.versionChaine = 2`), **distinct** du `structureBrief` lui-même (les rôles actuels de l'équipe, comme `strateg`, écrivent déjà dans le journal de jobs qui n'ont pas de brief de structure : leur présence ne suffit pas), du brief à la porte, et le contrat entre le contenu produit (corps HTML, champ `directAnswer`, champ FAQ structuré, champs de métadonnées) et les 10 gabarits.
- **Champ d'application défini par l'origine, pas par la présence d'un schéma.** Un contenu de la chaîne **sans `structureBrief` valide** (absent, illisible, version inconnue) a B18 à B23 **« non évalués », donc bloquants** hors mode ombre (règle 2 du § 3 de la porte, et C10 « fail-closed »). Seuls les contenus **qui ne viennent pas de la chaîne** (générateurs actuels, actualités RSS, éditions manuelles) sont **hors champ** : ces critères ne s'y appliquent pas. Publier encore hors chaîne après Q10 est une décision de Will (**D-A6**).
- **Pages qui reçoivent les intentions refusées** : pages d'offre et de contact, pages villes (`/implantations`, conception `S6-VILLES.md`), accueil, glossaire, Observatoire.
- **Ne change pas** : URL, slugs, canonical, métadonnées, `og:image`, `@id` JSON-LD, ancres des H2 publiés (`buildToc` est gelé), règles de marque (`interdits-publication.ts`, `positionnement.ts` en lecture seule : jamais « Grenoble », « partout en France » autorisée, aucun prix ni frais de déplacement, pas de lien `/appel`, pas de faux témoignage, aucun avocat), budget Web Vitals, jamais Fable. Les **générateurs hors chaîne ne changent pas** (aucune consigne modifiée).
- **Le gabarit fixe la mise en page** de l'article (héros, encadrés, sommaire, cartes, colonne d'actions). **L'en-tête et le pied de page sont ceux du site, rendus par le layout** : aucun de leurs titres n'entre dans les comptes. Les H2 rendus par le gabarit lui-même (« Questions fréquentes », « Sources », « À lire aussi », « Votre feuille de route »…) ne sont pas des H2 du corps et ne sont pas comptés.

## 2. Pratiques des moteurs fin 2026 : documenté ou non

**Méthode et limite.** Recherche web du 27/11/2026. `developers.google.com` et `about.ads.microsoft.com` **n'ont pas pu être ouverts** (domaines refusés par le réseau de la session). Leur contenu est cité **par les extraits de recherche et la presse spécialisée**, comme dans les deux conceptions précédentes. Niveaux : **[officiel, extrait]** = page de l'éditeur connue par extrait, non relue en entier ; **[officiel]** = documentation publique de l'éditeur, connue par ses extraits ; **[secondaire]** = presse SEO ou reprise d'une étude par un tiers ; **[étude]** = étude chiffrée (souvent d'un éditeur d'outil, non relue par des pairs) ; **[hypothèse]**. Avant toute décision engageante, relire les pages d'origine.

### 2.1 Google Search, AI Overviews, AI Mode

| Fait | Niveau et source |
| --- | --- |
| Aucune exigence supplémentaire pour apparaître dans AI Overviews ou AI Mode ; les fondamentaux SEO s'appliquent. Les deux peuvent employer le **« query fan-out »** (plusieurs recherches liées pour construire une réponse). | [officiel, extrait] https://developers.google.com/search/docs/appearance/ai-features |
| Guide d'optimisation pour l'IA générative (mai 2026, mise à jour au 10/07/2026 selon une source) : le contenu **« non-commodity »** (expérience directe, données propres, point de vue unique, expertise réelle) « influencera probablement » la présence dans la recherche générative **plus que toutes les autres suggestions** du guide ; à ignorer : `llms.txt`, **découpage en blocs**, réécriture spéciale pour l'IA, données structurées « pour l'IA ». | [officiel, extrait] https://developers.google.com/search/docs/fundamentals/ai-optimization-guide ; https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing ; [secondaire] https://www.frase.io/blog/google-ai-optimization-guide |
| Longueur : la longueur seule ne compte pas pour le classement ; **pas de nombre de mots cible**. Mueller : écrire aussi long ou aussi court que nécessaire pour les lecteurs. | [officiel, extrait] SEO Starter Guide https://developers.google.com/search/docs/fundamentals/seo-starter-guide ; [secondaire] https://www.seroundtable.com/google-word-count-for-seo-google-rankings-35607.html |
| Titres : un ordre sémantique aide les lecteurs d'écran mais **ne compte pas pour le classement** (Starter Guide, repris par Gary Illyes) ; plusieurs H1 ne gênent pas Google ; des titres structurés **aident à comprendre** la page. | [officiel, extrait] ; [secondaire] https://www.searchenginejournal.com/google-clarifies-h1-h6-headings-for-seo/522454/ ; https://searchengineland.com/multiple-h1s-wont-get-in-the-way-of-your-seo-google-says-322909 |
| Lien de titre : Google peut le tirer du `<title>`, du titre principal visible, du **H1** ; conseil : mettre le titre principal dans le **premier H1 visible**. | [officiel, extrait] https://developers.google.com/search/docs/appearance/title-link |
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
| Gemini : dans l'API, l'ancrage sur Google Search relie des passages à des sources (URI, titre), et les pages qui refusent `Google-Extended` ne servent pas à l'ancrage. Le jeton `Google-Extended` régirait aussi l'ancrage dans les applications Gemini [à vérifier sur la page Google des robots courants, non ouverte]. | [officiel] https://ai.google.dev/gemini-api/docs/google-search |
| Claude : la recherche web cite toujours ses sources (URL, titre) ; `Claude-SearchBot` explore pour la recherche, `Claude-User` lit à la demande. | [officiel] https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool ; https://support.claude.com/en/articles/8896518 |
| Ces moteurs trouvent les pages par un index et **citent des passages** ; rien d'officiel ne dit lequel. Sous notre contrôle : rester indexable par leurs robots de recherche (déjà réglé) et écrire des passages autonomes, exacts, datés, sourcés. | [hypothèse raisonnée] |

### 2.4 Études chiffrées (corrélations, pas des causes)

- **Longueur et citation dans AI Overviews** (Ahrefs, 2026, 174 048 pages) : corrélation de Spearman **0,04** entre nombre de mots et position de citation ; moyenne citée 1 282 mots ; **53,4 % des pages citées sous 1 000 mots**. [étude, connue par extraits] https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/ . Une étude plus petite (avril 2026, 1 000 aperçus) voit plus de citations au-delà de 2 500 mots, attribuées à la **couverture des sous-questions**. [étude] https://www.digitalapplied.com/blog/we-analyzed-1000-ai-overviews-citation-pattern-study
- **Titres et passages cités par ChatGPT** (Kevin Indig, 1,2 million de réponses) : contenu cité deux fois plus souvent porteur d'un « ? » ; 44,2 % des citations dans le premier tiers de la page. **Contre-exemple** : SE Ranking (11/2025), aucun gain aux seuls titres en question ni aux FAQ. [secondaire : chiffres connus par une reprise] https://fortitudemedia.ai/insights/anatomy-of-article-cited-by-ai
- **Statistiques et sources citées** : jusqu'à environ +40 % de visibilité dans des moteurs génératifs simulés (KDD 2024). [étude] https://arxiv.org/abs/2311.09735
- **Instabilité des citations** : 34 à 42 % de recouvrement d'un jour à l'autre. [étude] https://arxiv.org/pdf/2604.07585

### 2.5 Ce que ce document en tire

| Règle | Appui | Statut |
| --- | --- | --- |
| Un seul H1 visible | Google, liens de titre ; accessibilité | [officiel, extrait] pour le titre affiché ; pas un facteur de classement |
| Hiérarchie sans saut | RGAA / WCAG ; Google : aide à comprendre | [officiel] pour l'accessibilité ; neutre pour le classement |
| Titres qui nomment la question ou le sujet | Microsoft ; études ; maquettes v3 | [officiel, extrait] Microsoft ; [étude] contradictoire |
| Réponse directe sous le H1 (40-60 mots) et ouverture courte sous les H2 | Microsoft (« une à deux phrases ») ; B08 existant ; praticiens | **[hypothèse de la maison]** pour la fourchette ; tolérance large sous les H2 |
| Longueur en fourchette, pas un nombre | Google ; Ahrefs (0,04) | [officiel, extrait] + [étude] |
| Couvrir les sous-questions réelles | fan-out ; étude d'avril 2026 | fan-out [officiel, extrait] ; effet sur la citation [hypothèse] |
| Rien de spécial « pour l'IA » | guide Google | [officiel, extrait] : nos blocs sont des paragraphes utiles au lecteur |
| Pas de réponse clé cachée | Microsoft | [officiel, extrait] |

**Le danger à éviter** : faire de ces règles un moule d'écriture. Le contenu non banal compte plus que la forme ; l'apport original (B07), les faits sourcés (B02, B09) et la critique de R5 restent le cœur. Trois garde-fous contre l'uniformisation : tolérance sur les ouvertures (R-2), part de H2 en question **plafonnée par les questions réellement sourcées** (H-10), et contrôle des **plans quasi identiques** sur des fixtures (test 24).

## 3. Vue d'ensemble

```
R1 réserve de besoins (pré-classement de l'intention, confirmé ensuite par R2)
 ─► R2 BRIEF : intention + admissibilité + formats observés et mots comptés par le code
        + gabarit + plan Hn figé + questions sourcées + fourchette calculée par le code
 ─► R3 faits ─► R4 RÉDACTION : plan dans l'ordre, ouvertures, blocs du gabarit, fourchette
 ─► R5 critique (reçoit les mesures de remplissage et de manque) ─► R6 faits
 ─► R7 ÉDITION : verifierStructureArticle avant/après, corrige la forme, renvoie le fond
 ─► R8 PORTE : B18 à B23 ; B08, B11, W01 et contrôles existants adaptés
 ─► gabarit (G1-G8, A1, GU1) : rend le H1 et ses blocs ; ne recalcule rien
```

Le **même module pur** (`verifierStructureArticle`, § 11.1) sert à R2 (sur le plan), R4 et R7 (sur le brouillon), à la journalisation d'ombre de C10, puis à la porte : une seule mesure, cinq moments.

## 4. Intention de recherche et format

### 4.1 Les cinq intentions, reprises de `SearchIntent`

Le dépôt a déjà une taxonomie : l'énumération Prisma `SearchIntent` (`informational`, `commercial_investigation`, `transactional`, `navigational`, `local`, plus `voice_search`, `ai_overview`, `featured_snippet`), lue par `search-intent-validator.ts`. **On la réutilise.**

| Intention (libellé console) | Valeur `SearchIntent` | Le dirigeant veut… | Exemple | Article ? |
| --- | --- | --- | --- | --- |
| Informationnelle | `informational` | savoir, comprendre, **faire** (le volet « Do » sans achat) | « Comment automatiser les notes de frais ? » | **Oui** |
| Comparative | `commercial_investigation` | comparer des options ou **évaluer une décision** (lequel, oui ou non, en combien de **temps**) | « Copilot ou ChatGPT pour une PME ? », « Avec cinq salariés, l'IA vaut-elle le coup ? » | **Oui** |
| Transactionnelle | `transactional` | agir tout de suite (demander, s'inscrire, acheter) **ou connaître le prix d'une prestation** | « diagnostic IA PME », « prix d'un audit IA » | **Non** : page d'offre ou de contact |
| Locale | `local` | un prestataire ou un lieu dans une ville | « formation IA entreprise Lyon » | **Non** : pages `/implantations` |
| Navigation | `navigational` | atteindre une page précise d'un site connu | « axion ia contact » | **Non** : la page existe |

- `voice_search`, `ai_overview`, `featured_snippet` sont des **formats**, pas des intentions : R2 ne les choisit jamais.
- **Source qui fait foi** : `structureBrief.intention` (§ 8.1). Le champ `brief.intention` existant (3 valeurs) reste pour la compatibilité et doit lui **correspondre** (`information` ⇔ `informational` ; `comparaison` ou `decision` ⇔ `commercial_investigation`), règle testée (test 9). Les 48 sujets « décision » du plan 365 sont des évaluations, pas des achats.
- **« Combien »** est éditorial pour du **temps, un volume, des heures**, ou pour un ordre de coût **général et sourcé** (« coût de l'IA en PME » cité d'une étude datée). Le **prix d'une prestation** (« prix d'un audit IA », tarif de la Journée IA) est `transactional` : la règle de marque interdit tout prix dans le texte généré, l'article ne pourrait pas répondre. Les trois sujets du plan concernés (C103 « prix d'un audit IA », C041 « coût réel de l'IA en PME », C126 qui évoque le prix de la Journée IA) sont soumis à Will (**D-A8**).

### 4.2 Admissibilité

- **I-1.** Un brief `transactional`, `local` ou `navigational` **n'entre pas en rédaction**. R2 rend `intention_hors_article` avec la **page propriétaire** de l'intention (lue dans le registre `ContentIntention` de la porte, sinon dans `strategie/carte-requetes.ts`). Le besoin passe `ecarte` avec cette raison. Sans page existante : **signalement à Will**, jamais un article de remplacement.
- **I-2.** Une requête « locale » dont la réponse ne dépend pas du lieu est reformulée en `informational` **sans nom de ville** (règle du plan 365).
- **I-3.** Intention mixte : si **au moins 60 % des pages lisibles** lues par R2 (§ 4.3) sont des pages d'offre, l'intention est `transactional` (I-1) ; sinon elle reste éditoriale, sans prix dans le texte.
- **I-4. Pré-classement en amont (R1, C11)** : une règle simple propose une intention (mots « tarif », « devis », « prix d'un/d'une », nom de ville, marque d'Axion-IA). **C'est une proposition, jamais un écart automatique** : « fixer ses prix » (C196, C061) ou « veille tarifaire » (C365) ne sont pas transactionnels. R2 confirme ou corrige.
- **Code de raison nouveau** (liste fermée de C4) : `intention_hors_article`.

### 4.3 Format qui répond à l'intention

R2 **lira** (C6, conception de la chaîne ; `equipe/strategie.ts` n'appelle aujourd'hui aucun outil web) les cinq premières pages de résultats de **son outil de recherche** (`web_search` puis `web_fetch`). Ce n'est **pas** le classement de Google France : c'est un **échantillon** des pages qui se classent [hypothèse : l'outil renvoie des pages proches de celles de Google ; à vérifier sur 20 requêtes par comparaison manuelle pendant l'observation]. Pour chacune, R2 note le **format observé** dans une liste fermée : `definition`, `guide-etapes`, `liste-classement`, `comparatif-tableau`, `analyse`, `faq`, `chiffres`, `actualite`, `page-offre`, `forum`, `video`, `autre`. Une page est **lisible** si le code a pu compter ses mots (§ 7.2). Le **format dominant** est celui d'au moins **60 % des pages lisibles**, sinon `mixte` ; il est **calculé par le code**.

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
| choisir parmi N options | commercial_investigation | options classées par usage, critères | Sélection |
| décider oui ou non, par où commencer | commercial_investigation | critères, calcul simple en temps, seuils | Analyse ; Guide ; Guide pilier |

**Formats observés compatibles avec chaque gabarit** (pour la mesure de longueur, § 7.3, dans `GABARITS_REGLES`) : Analyse ← `analyse`, `guide-etapes`, `actualite` ; Guide ← `guide-etapes`, `analyse` ; Comparatif ← `comparatif-tableau`, `analyse`, `liste-classement` ; Sélection ← `liste-classement`, `comparatif-tableau` ; Étude de cas ← `analyse`, `guide-etapes` ; Définition ← `definition`, `analyse`, `faq` ; Questions-réponses ← `faq`, `definition`, `analyse` ; Chiffres ← `chiffres`, `analyse`, `actualite` ; Actualité ← `actualite`, `analyse` ; Guide pilier ← `guide-etapes`, `analyse`, `liste-classement`. Jamais compatibles : `page-offre`, `forum`, `video`, `autre`.

- **F-1.** Le gabarit est dans la colonne « compatibles » de son couple intention / besoin. Les 365 lignes du plan doivent passer (test 10) : les 13 `information` + `selection` relèvent du « panorama », les 11 `décision` + `faq` et les 2 `décision` + `actualite` de la comparative admise par ces gabarits, les `décision` + `guide-pilier`, `guide`, `analyse` de « décider, par où commencer », les 3 `décision` + `selection` de « choisir parmi N ».
- **F-2.** Si le format dominant diffère du gabarit choisi, R2 justifie en une phrase (`ecartFormat`). Un écart non justifié invalide le brief.
- **F-3.** Si au moins 60 % des pages lisibles sont des `forum` ou des `video`, R2 vérifie qu'un article répond bien au besoin ; sans angle, `pas_d_angle` (verdict existant).
- **Appel à l'action** : inchangé (§ 9.2 de la porte) : Diagnostic IA 45 min par la page contact, ou renseignements Journée IA ; jamais `/appel`.

### 4.4 Le validateur d'intention existant doit être adapté

`search-intent-validator.ts` émet aujourd'hui, pour `commercial_investigation`, un **échec dur « sans `<table>` comparatif »** et un avertissement si le titre ne contient ni « vs », ni « comparatif », ni « meilleur » ; pour `informational`, un avertissement si le titre ne commence pas par « Comment », « Pourquoi »… Dans `content-gen-worker.ts`, un échec d'alignement fait passer l'article en **`tier_3_noindex_nofollow`**. Sans adaptation, les sujets « décision » rendus en Analyse ou FAQ seraient **désindexés**.

- **Pour les contenus de la chaîne seulement** (C6, avec un test) : le validateur reçoit le gabarit ; le tableau n'est exigé **que pour le gabarit Comparatif** ; ses règles de titre (« vs », « Comment… ») ne s'appliquent pas, H-1 à H-11 les remplacent ; l'échec dur `informational` « moins de 3 citations » est aligné sur B09 (2 sources primaires), pour qu'une Définition courte à 2 sources ne soit pas désindexée. Hors chaîne, rien ne change.
- `targetSearchIntent` du contenu est **dérivé** de `structureBrief.intention`, pour que le validateur et B21 jugent la même chose.
- Test 9 : un sujet « décision » rendu en Analyse **sans tableau** reste indexable.

## 5. Structure des titres

**Corps mesuré** : partout dans ce document, le « corps » est le `bodyHtml` produit par R4 et R7 **sans les blocs injectés après eux**, en particulier la section `section#sources-axion` (`<h2>Sources</h2>`) qu'`appendSourcesSection` (`quality/article-quality.ts`, `intent-enforcement.ts`) ajoute au corps stocké et que le rendu ne retire que s'il existe des citations en base. Sans cette exclusion, le nombre de H2, W01, L-2, la longueur et le SimHash seraient faussés. Une seule fonction, `corpsMesure(bodyHtml)`, le définit (test 4).

**Compter** : `compterMotsContenu` (§ 7.2) sur le texte sans balises, qui **ignore la ponctuation isolée** (en typographie française, « ? » et « : » sont précédés d'une espace). **Caractères** : texte normalisé (espaces repliés). **Mots significatifs** : mots de 3 lettres ou plus **plus « IA »** (liste blanche), hors liste fermée `MOTS_VIDES_FR` (articles, prépositions, pronoms, auxiliaires). **Normalisation** : `normaliserTitre` (existante) puis retrait d'un « s » ou d'un « x » final sur les mots de plus de 3 lettres (`racineSimple`). Seuils de longueur : **choix de lisibilité** [hypothèse], calibrés sur les 365 questions du plan avec ce comptage (médiane 86 caractères et 13 mots ; 90e centile 108 caractères et 18 mots ; maximum 133 et 22).

### 5.1 H1 et réponse directe

- **H-1. Un seul H1 par page rendue**, produit par la page à partir du titre (`PLAN.md` gabarits § 4). **Point de mesure** : la **réponse du modèle** dans R4 et R7, **avant** `sanitizeContentGenHtml`, qui tourne dans le générateur avant tout stockage et retire la balise `<h1>` en gardant son texte (`outputJsonRaw` est donc déjà nettoyé et ne peut pas servir). R4 et R7 écrivent dans leur journal un drapeau `h1DansSortieBrute` ; B18 lit ce drapeau.
- **H-2.** Le H1 contient **au moins un mot significatif** du mot-clé principal (après normalisation), et **tous** les mots significatifs du mot-clé sont présents **dans le H1 ou dans `directAnswer`**. Pour les contenus de la chaîne, ce contrôle **remplace** `keyword_missing` (qui exige la chaîne exacte dans la réponse directe et produit du français forcé, comme « IA hôtellerie restauration chiffres »). Environ 24 questions du plan n'ont aucun mot significatif commun avec leur mot-clé : le test 7 les liste, et R2 reformule le H1 **ou** propose un mot-clé plus fidèle à la question.
- **H-3.** H1 de **20 à 120 caractères** et **au plus 20 mots**. Les deux conditions ensemble : **354 questions sur 365** passent ; les 11 autres sont **abrégées par R2** en H1, la formulation complète allant dans la réponse directe.
- **H-4.** Pas de nom de marque, pas de séparateur `|` de type balise title. Une **année** n'apparaît que si elle est celle d'une date portée par le brief (date du relevé, de la source d'origine, ou du texte réglementaire).
- **H-5.** Le H1 et le `<title>` sont deux textes indépendants ; le `<title>` garde ses bornes (50 à 60 caractères, `edition-seo.ts`).
- **R-1.** La réponse directe sous le H1 est le champ **`directAnswer`** (rendu par `AnswerCard`, `data-aeo="tldr"`) : B08 la mesure là, 40 à 60 mots, inchangé.

### 5.2 H2 : un plan figé, des types déclarés dans le plan

Le plan du brief (`planHn`) donne pour chaque H2 du corps, **dans l'ordre**, un **type** : `informatif`, `etape`, `phase`, `groupe` (regroupe des options en H3, Sélection). **Le H2 numéro i du corps correspond à la section i du plan.** Règle d'appariement, vérifiable : le corps mesuré a **autant** de H2 que le plan, et le H2 n° i partage **au moins un mot significatif** avec l'intitulé prévu de `planHn[i]` ou avec sa question ; sinon écart `ordre_plan` (H2 manquant, en trop ou permuté). Le contrôle existant `h2-hors-plan` de `redaction.ts` ne détecte qu'un manque : il est complété par cette règle.

**Aucun attribut n'est requis dans le corps** : `buildToc` réécrit chaque H2 (`<h2 id=… data-speakable="true">`) et efface ses autres attributs. Les types vivent dans `planHn`, **persisté** avec le `structureBrief` (§ 8.1) : le chargeur du gabarit (S1, `chargerTypeContenu`) le lit pour savoir quels H2 sont des étapes, des groupes ou des options. Sans plan persisté (contenu hors chaîne), le gabarit garde ses heuristiques actuelles.

- **H-6.** Nombre de H2 du corps dans les **bornes du gabarit** (§ 10).
- **H-7.** Chaque H2 du corps : **3 à 14 mots, au plus 90 caractères** (les questions des maquettes v3 vont jusqu'à 14 mots) ; pour un `informatif`, au moins **un mot significatif** commun avec la question qu'il couvre, quand il en couvre une.
- **H-8.** **Titres génériques interdits** : « Introduction », « Conclusion », « En résumé », « Pour aller plus loin », « Contexte », « Définition », « Avantages », « Inconvénients », « Les enjeux », « Notre avis », seuls ou suivis d'un deux-points. Liste fermée `TITRES_GENERIQUES`, testée. (« Ce qu'il faut retenir » est un bloc du gabarit, pas un H2 du corps.)
- **H-9.** Un H2 en question finit par « ? » et sa section du plan porte une **question du brief avec son origine** (`search-console`, `plan-editorial`, `autre-source`). Sinon : écart `question_hors_brief` (code existant). **Mesuré par B23 seul.**
- **H-10. Part de H2 en question** (cible par gabarit, § 10), **jamais au-delà des questions réellement sourcées** : `seuil = min(cible, questions sourcées disponibles ÷ H2 du corps)`, la question principale (celle du H1) n'étant pas comptée ; si le corps n'a aucun H2, aucune part n'est exigée. Sans question sourcée, aucune n'est exigée et **aucune ne doit être inventée**. **Mesurée par W01 seul** (seuil par gabarit, 6 points inchangés).
- **H-11.** Pas de H2 en double après normalisation ; aucun H2 identique au H1 ; le mot-clé principal **exact** dans **au plus 2** H2.

### 5.3 H3 et au-delà

- **H-12.** Un H3 n'existe que sous un H2 qui en a au moins deux (`lone_h3`, existant) ; 2 à 14 mots, au plus 90 caractères. Exceptions tirées des maquettes v3 : sous un H2 `groupe` de la Sélection, un seul H3 d'option est admis ; dans le Guide pilier, un chapitre peut avoir un seul H3.
- **H-13.** Aucun saut de niveau (`heading_level_skip`), aucun sous-titre avant le premier H2 (`subheading_before_h2`), codes existants.
- **H-14.** H4 : seulement dans le Guide pilier. H5, H6 : interdits.
- **H-15.** Faux titre (paragraphe de moins de 12 mots tout en `<strong>`, suivi d'un paragraphe) : avertissement de R7, transformé en H3 ou en texte courant.

### 5.4 Mise à jour d'un article publié (régime de Q15)

- **H-16. Aucun renommage de H2 en mise à jour.** `buildToc` réécrit l'`id` de chaque H2 à partir de son texte et ignore un `id` existant ; il est gelé (`DECOUPAGE.md`). Renommer un H2 casserait les liens profonds déjà cités. Exception : un H2 **générique** d'un ancien corps peut être renommé **une fois**, sur décision humaine dans la file de relecture, en acceptant la perte de l'ancre. **Insérer ou supprimer** une section casse aussi des ancres (ids `step-N` du Guide et du Guide pilier, fixés par la position ; suffixe `-2` des doublons ; aucun id sous 3 H2, `TOC_MIN_HEADINGS`) : en mise à jour, les sections nouvelles s'ajoutent **en fin de corps** seulement, et **aucune section n'est supprimée**.
- **Plan d'un corps publié** : `planHn` est construit par le code à partir des H2 existants, tous de type `informatif` marqués **hérités** (exemptés de H-7, H-8, H-9) ; les sections ajoutées par la mise à jour sont déclarées normalement.
- **Régime par critère** : B18 et B19 sur les **sections ajoutées ou modifiées** ; B20 : L-1 et L-3 sur ces sections, et la longueur totale ne doit **ni baisser de plus de 10 %** ni dépasser la borne haute du gabarit (pas de fourchette recalculée) ; B21 : seulement si le gabarit change ; B22 : inchangé ; B23 : seules les **questions ajoutées** par le brief de mise à jour doivent être couvertes.

## 6. Ouvertures de section et blocs citables

- **R-2. Ouverture sous un H2 `informatif` ou `phase`** : le premier élément après le H2 est un `<p data-aeo="answer">` qui répond à la question de la section **avant** toute liste, tableau, H3 ou encadré. **Cible pour R4 : 40 à 60 mots. Tolérance de la porte : 25 à 80 mots**, exigée pour **au moins 70 %** de ces H2 (**0 sur 0 = conforme**). Exemptés : `etape` (consigne d'action courte), `groupe` (les options en H3 portent la réponse), H2 **hérités** d'une mise à jour, et une section qui commence par **une phrase d'au plus 25 mots suivie d'un tableau**. Le balisage `data-aeo="answer"` est conservé par le nettoyeur (`ADD_ATTR`) et n'est pas touché par `buildToc` (qui ne réécrit que les H2).
- **R-3. Autonomie** : l'ouverture ne commence ni par un renvoi (`commenceParUnRenvoi`, existant) ni par un pronom de reprise (« Elle », « Cela », « Ce dernier », « Celle-ci », « Ces derniers », « Ils », « Elles », et « Il » **sauf** « Il faut », « Il existe », « Il y a », « Il est », « Il s'agit », « Il suffit », « Il reste ») ; elle contient au moins un mot significatif du H2.
- **R-4.** Un chiffre dans une réponse directe ou une ouverture porte sa source et son année dans le même paragraphe (B02, appliqué ici en priorité).
- **R-5. Jamais caché** : `directAnswer` et les ouvertures ne sont jamais dans un `<details>` fermé, un onglet ou un élément masqué. Exception : les cartes du gabarit Questions-réponses, où la **première est ouverte** et toutes les réponses sont dans le HTML servi sans JavaScript [hypothèse : risque faible, à vérifier par l'échantillon de citations de la P10 du pilotage].
- **R-6. Blocs citables** : chaque article contient l'**élément obligatoire de son gabarit** (§ 10), parce qu'il sert le lecteur ; B21 le vérifie. Aucun fragment ajouté « pour l'IA ».
- Les générateurs **hors chaîne** demandent déjà ce balisage dans leurs propres prompts : **on n'y touche pas**. C7 n'écrit cette consigne qu'une fois, pour R4, tirée du brief.
- **Consigne de lisibilité V2** : `injectBrandVoice` (`brand/brand-voice.ts`) ajoute `consigneLisibiliteV2` à tous les prompts et la déclare prioritaire sur la forme. Elle impose une dernière section « Par où commencer ? » (H2 hors plan : B18 échouerait), « au moins la moitié des intertitres en questions » (pousse à inventer des questions, contre H-9 et H-10) et des H2 de 5 à 10 mots (contre H-7). **Dans C7, la voie R4 de la chaîne reçoit une version « chaîne » de cette consigne, sans ces trois règles** ; « Par où commencer ? » devient une section déclarée dans `planHn` quand le brief la prévoit. Hors chaîne, la consigne ne change pas. Test sur le prompt de R4 (test 14 b).

## 7. Longueur : une fourchette par article

### 7.1 Principe

La longueur n'est **pas un objectif**. Elle sert à refuser **le remplissage** (trop long pour la question) et **le manque** (sous-questions non couvertes). Google le dit, l'étude Ahrefs ne trouve presque aucun lien entre longueur et citation (§ 2).

### 7.2 Une seule façon de compter, des deux côtés

- **Fonction unique** `compterMotsContenu(texte)` : elle **réutilise le compteur de `quality/lisibilite-v2.ts`**, qui ignore déjà les jetons sans lettre ni chiffre (le nom `compterMotsTexte` est déjà pris par `shared/sources-et-chapo.ts`, avec une autre règle, et sert au `wordCount` des pages : on n'y touche pas). Elle sert à la mesure des pages lues, à la fourchette, à B20, **et remplace pour les contenus de la chaîne** les planchers qui comptent avec `computeReadabilityFr().wordCount` (§ 9.2).
- **Pages lues par R2** : le texte est celui des **blocs de résultat `web_fetch`** de type texte de la réponse du modèle (jamais un PDF en base64), extrait par le code sur le modèle de `pagesLues(reponse)` de `fact-check/verificateur-deux-phases.ts` (fonction à **exporter** et à restreindre aux sources texte, C6) ; **le code** compte les mots. Le modèle ne fournit ni URL ni nombre : il ne fournit que le format observé de chaque page. Le **journal de R2** (`equipe/journal.ts`, aujourd'hui rôle, décision, coût, passe, détail) est **enrichi** de la liste des URL lues et de leur nombre de mots.
- **Notre article** : le même périmètre qu'une page lue, c'est-à-dire **le contenu affiché de l'article** : réponse directe, corps mesuré, FAQ, plus les sources comptées une seule fois. Sont exclus les blocs ajoutés hors rédaction (appels à l'action, bloc normalisé Journée IA, carte auteur, articles liés) et **tout ce que rend le layout** (en-tête, pied de page du site).
- **Écart de méthode assumé** [hypothèse] : l'extraction de l'outil peut garder ou perdre des bouts de page. Un **facteur de correction** par gabarit (départ 1,0) est calibré pendant l'observation (§ 9.3) en comparant, sur 20 pages, le compte de l'outil à un compte manuel.

### 7.3 Calcul par le code (`calculerFourchetteMots`)

1. **Pages retenues** : pages lues par R2 (0 à 5, **aucune lecture supplémentaire**, surcoût nul), lisibles, dont le format observé est compatible avec le gabarit (table du § 4.3).
2. **Si au moins 3 pages retenues** : médiane M ; fourchette brute de 0,75 × M à 1,25 × M (arrondie à 50).
3. **Sinon** : **fourchette de repli du gabarit** (§ 10), `methode = "repli-gabarit"`, affichée « mesure indisponible » en console.
4. **Plancher de couverture** : `60 + n × 100` mots, où n = nombre de H2 du plan ; pour Questions-réponses, `60 + q × 60`, où q = nombre de questions.
5. **Ordre de priorité, écrit et testé** :
   - (a) `min = max(min, plancher)` ;
   - (b) si le plancher dépasse la **borne haute** du gabarit, **le plan est refusé** (trop de sections : R2 réduit le plan ou change de gabarit) ;
   - (c) `min` et `max` sont ramenés dans les **bornes du gabarit** ; si la fourchette entière dépasse la borne haute, `max = borne haute` et `min = max(borne basse, plancher, borne haute − 200)` ; si elle est entière sous la borne basse, `min = borne basse` et `max = min(borne haute, borne basse + 200)` ;
   - (d) l'écart `max − min` est porté à **200 mots** au moins si les bornes le permettent, en élargissant d'abord vers le haut.
6. La **longueur cible du plan 365** reste une indication ; la fourchette du brief la remplace.

### 7.4 Équilibre des sections

- **L-1.** Une section `informatif` ou `phase` compte au moins **80 mots** ; une réponse de FAQ **25 à 200 mots**.
- **L-2.** Aucune section ne dépasse **35 %** des mots de l'article quand il y a au moins 4 H2, **50 %** en dessous ; ne s'applique ni au Guide pilier ni à l'Actualité.
- **L-3. Redites** : pour deux sections A (la plus courte) et B, la **part des 5-grammes de A retrouvés dans B** est inférieure à **0,20** (`shingles` de `quality/plagiarism.ts`, plus une fonction `partReprise`).
- **L-4. Couverture** : **toutes les questions du brief sauf la question principale** sont couvertes par une section du plan ou par la FAQ (`coverage_missing`). La **question principale** (marquée `principale`, celle du H1) est couverte par `directAnswer` et n'entre ni dans L-4, ni dans H-9, ni dans H-10 : sinon `importerPlanEditorial`, qui place la question du plan dans `brief.questions`, forcerait un H2 ou une FAQ qui répète la réponse directe. Les questions trouvées mais non traitées vont dans `questionsEcartees` avec leur motif.

## 8. Contrat des rôles

### 8.1 R2 stratège de brief

**Une extension du module `brief.ts`, pas un second schéma de brief.** `briefSchema` et `planSchema` sont `.strict()` : un worker plus ancien **rejetterait** un brief portant des champs nouveaux (fenêtre app/worker). Les nouveaux champs vivent donc dans un **objet séparé du même module**, `structureBrief` (schéma versionné, `versionStructure: 1`), stocké à côté du brief dans `ContenuBrief` (C3). Le brief v1 ne change pas.

| Champ de `structureBrief` | Contenu | Validation (par le code) |
| --- | --- | --- |
| `intention` | valeur `SearchIntent` | une des 5 ; doit correspondre à `brief.intention` (§ 4.1) |
| `besoin` | sous-intention (§ 4.3) | liste fermée |
| `pageProprietaire` | page qui sert l'intention si `intention_hors_article` | lue dans `ContentIntention` ou la carte des requêtes ; jamais saisie par le modèle |
| `pagesLues` | 0 à 5 entrées : URL, rang dans l'outil, format observé, `mots` | URL et `mots` extraits **par le code** des blocs `web_fetch` ; format observé par le modèle |
| `formatDominant` | ≥ 60 % des pages lisibles, sinon `mixte` | calculé |
| `gabaritCible`, `gabaritRendu`, `contentType` | gabarit visé ; gabarit réellement rendu (Analyse tant que le gabarit cible n'est pas livré ou ne peut pas servir, § 10.1) ; type de contenu qui mène au gabarit rendu | F-1 sur le gabarit cible ; `contentType` cohérent avec le gabarit rendu (table `PLAN.md` gabarits § 3), jamais `blog_from_rss` |
| `planHn` | sections dans l'ordre : `type`, intitulé prévu, `question` (index dans `brief.questions` ou `null`), `blocAttendu` (définition, étapes, tableau, chiffre, oui-non, liste) ; pour la Sélection, les options (H3) de chaque groupe | H-6 à H-14 vérifiées **sur le plan** ; **fait foi** ; persisté et lu par le gabarit (§ 5.2) |
| `faqPrevue` | index des questions de `brief.questions` prévues dans la FAQ, avec thème facultatif | la FAQ produite est appariée à ces questions par égalité après normalisation (B23) ; le champ FAQ existant (`question`, `answer`) ne change pas |
| `incertain` | Actualité : un point reste inconnu | facultatif |
| `questionsEcartees` | questions trouvées mais non traitées, avec motif | jamais une question sans origine |
| `fourchetteMots` | `{ min, max, methode, mediane, pagesRetenues }` | calculée par `calculerFourchetteMots` |

- **Questions** : elles restent dans `brief.questions` (avec `origine`, `reference`) ; on y ajoute le marqueur `principale` par la même voie séparée (`structureBrief.questionPrincipale`, index), pour ne pas toucher au schéma strict.
- **Questions sourcées minimales** : Questions-réponses **au moins 6** (hors principale) ; sinon R2 choisit Analyse. **Jamais de question inventée.** Sources admises : réserve de R1, Search Console, plan éditorial, et pages lues par R2 (origine `autre-source`, URL en référence, **D-A7**).
- **Verdict nouveau** : `intention_hors_article`. `pas_d_angle` et `pas_de_matiere` sont inchangés.
- **Le brief est figé** avant R4 ; les réécritures ciblées gardent le même brief.
- **Dérivation vers `verifierPlan` (code existant)** : `verifierPlan` reçoit un `Plan` construit depuis `planHn` (pas de saisie double), avec ces règles : une section sans question reçoit comme `questionCouverte` son intitulé prévu et est **exclue** du contrôle `question_hors_brief` ; la couverture (`verifierCouverture`) porte sur `brief.questions` **moins** la question principale ; `faq` = questions de `faqPrevue` ; **pas** de contrôle `answer_length` ni `keyword_missing` au stade du plan (la réponse directe n'est pas encore écrite : ces contrôles passent à R7 et à la porte, sur `directAnswer`, avec H-2). Test 15 b.

### 8.1 bis Aiguillage du job (décision de C10)

Le rendu choisit le gabarit d'après `ContentGenJob.contentType` (S1 : `chargerTypeContenu` puis `gabaritPourType`), et le worker choisit le générateur par `getGenerator(contentType)` **avant** le bloc de l'équipe ; l'équipe ne tourne que pour les types autorisés (`CONTENT_GEN_CLAUDE_TYPES`). Une Définition voulue par R2 serait donc soit rendue en Analyse, soit écrite par `whatIsXGenerator`, hors chaîne, avec ses propres consignes (8 H2, « longueur déterminante »). Décision à inscrire dans C10 :

- le brief (R2) est produit **avant** la création du job ; le job est créé avec le `contentType` qui mène au `gabaritRendu` (table `PLAN.md` gabarits § 3), et avec le marqueur `versionChaine = 2` (§ 1) ;
- pour un job portant ce marqueur, le worker **aiguille vers la chaîne avant `getGenerator`** : un seul R4, quel que soit le `contentType` ; les générateurs par type ne sont jamais appelés ;
- `CONTENT_GEN_CLAUDE_TYPES` inclut les types menant aux 10 gabarits ;
- test : un job de la chaîne de type `what_is_x` n'appelle pas `whatIsXGenerator` (test 15 c).

### 8.2 R4 rédacteur

- Suit `planHn` **dans l'ordre**, sans ajouter ni retirer de H2 ; écrit les étapes (souvent en question, comme la maquette du Guide) et les options en H3 comme le plan les déclare ; n'écrit pas « Étape n » ni de numéro : le gabarit les rend.
- N'écrit jamais de `<h1>` ; écrit la réponse directe dans `directAnswer`, la FAQ dans le champ FAQ structuré.
- Ouvre chaque H2 `informatif` ou `phase` par `<p data-aeo="answer">` de 40 à 60 mots (R-2, R-3).
- Produit le **bloc attendu** et l'**élément obligatoire** du gabarit (§ 10), y compris les encadrés balisés que le gabarit transforme en blocs.
- Vise **le milieu de la fourchette** ; écrit moins si les questions sont couvertes. La consigne « la longueur est déterminante pour le rang » est supprimée de la voie R4 (C7).

### 8.3 R5 expert critique

Ses questions (5) « y a-t-il du remplissage ? » et (6) « qu'est-ce qui manque pour décider ? » reçoivent les mesures de § 7.4. Sa grille et son modèle ne changent pas.

### 8.4 R7 éditeur

- Appelle `verifierStructureArticle` **avant et après** sa passe ; vérifie la règle d'appariement du § 5.2 (`ordre_plan`), qui complète `h2-hors-plan`.
- Corrige la **forme** : longueur et libellé des titres, titres génériques, pronom de tête, balisage `data-aeo`, faux titres, niveaux.
- Ne déplace **aucun chiffre** (comparaison avant/après) et ne change pas le sens d'une réponse.
- Renvoie à R4 ce qui relève du fond (section trop courte, question non couverte, longueur hors fourchette, redite), en correction localisée, dans le compteur unique de 2 réécritures.

## 9. Nouveaux critères de la porte : B18 à B23

### 9.1 Registre

Déterministes (aucun appel de modèle). **Champ d'application** : contenus **produits par la chaîne** (§ 1). Pour eux, un `structureBrief` absent ou illisible rend B18 à B23 **« non évalués » = bloquants** hors ombre. Les autres contenus sont **hors champ**. Régime de mise à jour : § 5.4.

| Id | Critère | Mesure (règles) | Seuil de départ [à calibrer, § 9.3] | Classe | Code de raison |
| --- | --- | --- | --- | --- | --- |
| **B18** | **Hiérarchie et libellé des titres** | H-1 (drapeau `h1DansSortieBrute` des journaux de R4 et R7), H-2 à H-8, H-11 à H-14 sur le corps mesuré ; appariement au plan (`ordre_plan`, § 5.2) | 0 écart | Corrigeable | `structure_titres` |
| **B19** | **Ouvertures de section** | R-2, R-3, R-5 | ≥ 70 % des H2 concernés (0 sur 0 = conforme) ; R-5 : 0 écart | Corrigeable | `style` |
| **B20** | **Longueur adaptée et sections équilibrées** | mots de l'article (§ 7.2) entre `0,9 × min` et `1,1 × max`, **sans jamais sortir des bornes du gabarit** ; L-1 à L-3 | ± 10 % dans les bornes ; 0 écart L-1 à L-3 | Corrigeable | `longueur` |
| **B21** | **Format conforme à l'intention et au gabarit** | F-1 ; élément obligatoire du gabarit cible présent (§ 10) ; `targetSearchIntent` = intention du brief | conforme | Corrigeable | `format_intention` |
| **B22** | **Intention éditoriale admissible** | intention ∈ {`informational`, `commercial_investigation`} | admissible | **Dur** | `intention_hors_article` |
| **B23** | **Questions traçables et couvertes** | L-4 ; H-9 par appariement de position ; aucune question à la fois en H2 et dans la FAQ (`coverage_duplicate`) | 100 % | Corrigeable | `questions_non_couvertes` |

- **Chaque règle a un seul juge** : H-9 relève de B23, H-10 de W01, les autres règles H de B18.
- **B22 est dur** : D-A3 dit « jamais d'article » pour ces intentions. Il double R2 volontairement (dernier filet) et reste distinct de B05 (intention libre, dérogeable) : B05 dit « pas déjà couverte », B22 dit « éditoriale ».

### 9.2 Contrôles existants à adapter (formule de note inchangée)

| Contrôle existant | Problème pour la chaîne | Adaptation, **pour les contenus de la chaîne seulement** | PR |
| --- | --- | --- | --- |
| **B11** (porte) : ≥ 850 mots, 3 à 8 H2, H1 unique | contredit les bornes par gabarit (définitions dès 500 mots) ; le H1 relève de B18 | remplacé par les bornes du gabarit (B18, B20) ; le H1 est jugé par B18 seul ; le reste de B11 est gardé (page mince sous 350 mots, `data-quality-gate`). **D-A1** | Q2c |
| `equipe/redaction.ts` : `mots-insuffisants` sous `PLANCHER_MOTS_RELECTURE` (850), compté par `computeReadabilityFr` | bloquerait la Définition, l'Actualité, une FAQ courte | remplacé par la borne basse de la fourchette du brief, comptée par `compterMotsContenu` | C7 |
| `equipe/redacteur-en-chef.ts` : question Q13 de la grille du rédacteur en chef (même plancher) | idem | idem | C9 |
| `quality/barrieres-publication.ts` : `moins-de-850-mots` pour `TYPES_PLANCHER_MOTS` (dont `blog_article` et `barometer_insight`) | envoie en relecture des contenus conformes à leur fourchette | la barrière lit la fourchette du brief quand il existe | C9 |
| `equipe/plan.ts` : 5 à 8 H2 en mode bloquant ; `outline-validator.ts` | contredit la FAQ (questions dans le champ structuré), la Sélection, la Définition | bornes du gabarit passées en paramètre ; hors chaîne inchangé | C6 |
| `search-intent-validator.ts` | désindexe un « décision » sans tableau | § 4.4 | C6 |
| `keyword_missing` (plan.ts) | mot-clé exact, français forcé | H-2 | C6 |
| `dedup/outline-simhash.ts` (`doublon_plan`, Hamming ≤ 4, corpus publié sur 365 jours ; un `duplicate_template` mène à `tier_3_noindex_nofollow`) | un corps de Questions-réponses sans H2 n'aurait pour plan que « Sources » : SimHash identique d'un article à l'autre, donc désindexation | le SimHash est calculé sur le **corps mesuré** ; avec **moins de 2 titres**, il vaut `null` (non comparé) ; aucun H2 imposé n'est écrit dans le corps (§ 10). Test 24 : deux plans conformes et différents passent, un plan recopié est refusé, deux FAQ sans H2 ne sont pas comparées | C6 |
| **W01** (porte) | 30 % pour tous | seuil par gabarit plafonné par les questions sourcées (H-10) ; **6 points inchangés** | Q2c |
| **B08** | — | inchangé, sur `directAnswer` | — |

- **Note** : `100 − P_avertissements − P_preuves − P_proximité − P_intention`, identique ; somme des maxima = 86, test inchangé.
- **Classement du § 5 de la porte** : B18, B19, B20, B21, B23 → **Corrigeable** ; B22 → **Dur**. Le test de concordance « colonne dérogation = classement » couvre les nouveaux critères.
- **Codes de raison** ajoutés à la liste fermée de C4 : `structure_titres`, `longueur`, `format_intention`, `intention_hors_article`, `questions_non_couvertes` (B19 reste sous `style`, comme B08). Le détail garde le critère, la règle (`H-7`, `L-3`…) et la preuve.
- **Version de la porte** : nouvelle `versionPorte` ; les anciens verdicts restent lisibles.
- **Alarme amont** : un refus fréquent sur B20 à B23 pointe R2 ; sur B18 ou B19, R4 ou R7. Affiché comme tel en console.

### 9.3 Observation avant blocage

L'observation Q9 de la porte porte sur le pipeline actuel, **sans brief** : elle ne peut pas calibrer B18 à B23. Ces critères ont donc leur **propre observation** : dès **C10**, la chaîne appelle `verifierStructureArticle` et **journalise** le verdict qu'auraient rendu B18 à B23, **hors porte** (la porte n'a pas besoin de les connaître à ce stade). Q2c les inscrit ensuite au registre `CRITERES`, en ombre. Ils passent en blocage réel, **gabarit cible par gabarit cible**, quand ce gabarit a **au moins 10 contenus relus** par Will et que les seuils ont été ajustés sur ses verdicts (nouvelle version de la porte). Le passage est un clic de Will (**D-A5**). Un gabarit qui n'atteint jamais 10 contenus (Étude de cas : aucun sujet au plan 365) reste en ombre ; ses contenus restent de toute façon en relecture humaine à 100 %.

## 10. Adaptation aux 10 gabarits

Le gabarit fixe la **mise en page de l'article** ; l'**en-tête et le pied de page du site** sont rendus par le layout et n'entrent dans aucune règle. **Comme dans les maquettes v3, les H2 du corps sont surtout des questions** ; les **blocs propres au gabarit** (triptyque, frise, verdict, « Comment lire ces chiffres », feuille de route, « Ce qu'il faut retenir ») sont **rendus par le gabarit** à partir de champs existants (« Point clé », métadonnées, relevé) ou d'**encadrés balisés** (`BALISAGE-ENCADRES.md` : `ax-bref`, `ax-retenir`, `ax-exemple`, `ax-stat`) ; leur source exacte est fixée dans la PR du gabarit. Ils **ne sont jamais des H2 du corps** (sinon doublon visible). Bornes de mots : **hypothèses de départ** tirées des longueurs cibles du plan 365, élargies pour laisser la mesure décider ; calibrées au § 9.3.

| Gabarit (code, PR) | H2 du corps (types) | Part de H2 en question (cible, H-10) | Bornes de mots | Repli | Élément obligatoire (B21), vérifiable par le code |
| --- | --- | --- | --- | --- | --- |
| Analyse (`analyse`, G1) | 4 à 8 (informatif) | 50 % | 800 - 2 200 | 1 100 - 1 500 | au moins un `<ul>`/`<ol>` de 3 éléments ou plus, un `<table>`, ou un encadré `ax-stat` sourcé |
| Guide pratique (`guide`, G2) | 3 à 8 (etape) + 0 à 2 (informatif : prérequis en premier, durée ou bilan en dernier) ; au-delà de 8 étapes, 2 à 5 (phase) avec les étapes en H3 | 50 % | 800 - 2 200 | 1 200 - 1 800 | au moins 3 sections `etape` dans `planHn` et autant de H2 (ou H3 sous phase) rendus ; « Étape n sur N » rendu par le gabarit, jamais écrit |
| Comparatif (`comparatif`, G3) | 4 à 8 (informatif) | 50 % | 1 000 - 2 400 | 1 400 - 1 800 | premier `<table>` du corps avec `<th>`, au moins 2 colonnes d'options et 4 lignes de critères ; `directAnswer` contient « dépend » ou « selon » ; aucun gagnant, aucune note |
| Sélection (`selection`, G4) | 3 à 8 : 2 à 5 (groupe) + 1 à 4 (informatif, dont les critères en premier) ; options = **H3** sous les groupes, 3 à 10 au total | 50 % | 1 000 - 2 400 | 1 300 - 1 700 | 3 à 10 H3 d'options ; une section `informatif` sur les critères de sélection (« Comment avons-nous choisi… ? ») ; aucun numéro écrit dans les H3 |
| Étude de cas (`cas`, G5) | 4 à 7 (informatif) | 50 % | 700 - 1 800 | 900 - 1 400 | encadré `ax-exemple` « Exemple type, pas un client » ; aucun chiffre de résultat |
| Définition (`definition`, G6) | 3 à 6 (informatif) | 30 % | 500 - 1 300 | 700 - 1 000 | `directAnswer` dont les premiers mots contiennent le terme (« Le RAG, ou génération augmentée par recherche, permet… » est conforme) ; un H2 qui contient « différence » ou « confondre » |
| Questions-réponses (`faq`, G7) | 0 à 2 (informatif) ; questions dans le **champ FAQ**, 6 à 15 | 100 % (des questions) | 600 - 1 800 | 800 - 1 200 | au moins 6 questions sourcées dans le champ FAQ, appariées à `faqPrevue`, réponses de 25 à 200 mots ; thèmes facultatifs (rendus seulement si `faqPrevue` en porte, `PLAN.md` G7) |
| Chiffres (`chiffres`, G8) | 3 à 7 (informatif) | 30 % | 700 - 1 700 | 1 000 - 1 400 | relevé structuré rattaché (`charger-releve.ts`) ; chaque chiffre du texte daté et sourcé |
| Actualité (`actualite`, A1) | 3 à 6 (informatif) | 50 % | 400 - 1 300 | 700 - 1 100 | source d'origine (URL et date) et « Point clé » renseignés (le triptyque du gabarit les reprend) |
| Guide pilier (`guide-pilier`, GU1) | 5 à 9 chapitres (informatif) ; H3 facultatifs (un seul admis, H-12) | 50 % | 1 800 - 4 500 | 2 000 - 2 800 | 5 à 9 chapitres ; ids `step-N` conservés ; la feuille de route est un bloc du gabarit |

### 10.1 Notes par gabarit

- **Analyse (G1)** : gabarit de **repli** de tous les autres tant qu'ils ne sont pas livrés. Un contenu destiné à un gabarit non livré est **vérifié selon son gabarit cible** et rendu en Analyse (`gabaritRendu`).
- **Guide (G2)** : la maquette v3 a des H2 d'étape **en question** (« Comment enregistrer la réunion sans gêner les participants ? »), « Étape 1 sur 6 » rendu par le gabarit (`etape__rang`, ids `step-N`), une première section de prérequis en question et une section finale informative. `parseStepsFromBody` (`guides/loader.ts`), qui cherche « Étape N » en début de ligne de texte, ne peut pas reconnaître ces étapes. **Prérequis de G2** : pour un contenu de la chaîne, les étapes sont **les H2 dont la section de `planHn` est de type `etape`** (plan persisté, § 5.2) ; hors chaîne, l'heuristique actuelle reste. `calculator_roi` : formule et scénarios, **aucun montant de prix**.
- **Comparatif (G3)** : le premier `<table>` est remonté en « En bref » : R4 écrit le tableau récapitulatif **en premier**. Le verdict « ça dépend de… » est un bloc du gabarit nourri par la réponse directe.
- **Sélection (G4)** : la maquette v3 regroupe les options (H3 « tâche ») sous des H2 en question. **`DECOUPAGE.md` G4 parle d'un compteur sur les H2 d'options : la maquette prime** ; G4 applique le compteur CSS aux H3 d'options (ceux que `planHn` déclare comme options). Les rubriques « pour qui / points forts / limites » sont des libellés de carte du gabarit, pas des titres.
- **Étude de cas (G5)** : le plan 365 n'en contient aucune (les études fictives ont été converties en guides). Admis seulement pour un **exemple type étiqueté** ou un cas réel autorisé par écrit. La frise Avant / Pendant / Après est un bloc du gabarit, sans chiffre.
- **Définition (G6)** : avec 3 H2, pas de sommaire (masqué sous 4 entrées) : voulu. Les termes liés viennent du glossaire.
- **Questions-réponses (G7) : une seule source pour les questions.** Questions et réponses vivent **dans le champ FAQ structuré**, rendu par `ArticleFaq` avec une **seule `FAQPage`** (J1) ; le corps n'a qu'une introduction et au plus 2 H2. B19 lit les réponses de la FAQ, B23 l'origine de chaque question, H-6 compte les questions. Dans les **autres gabarits**, la FAQ de fin est aussi dans le champ structuré et aucune de ses questions n'est un H2 (`coverage_duplicate`). À reporter dans G7 et J1.
- **Chiffres (G8)** : **sans relevé structuré, pas de gabarit Chiffres** : `gabaritCible` devient Analyse. Les 17 sujets « chiffres » du plan 365 sont vérifiés en C6.
- **Actualité (A1)** : `/actualites/[slug]` n'est servi que pour `blog_from_rss`, hors chaîne. Les 11 sujets « actualité » du plan 365 ont `gabaritCible = actualite` et `gabaritRendu = analyse` sur `/blog` tant qu'aucun type de contenu de la chaîne ne mène à `/actualites` (**D-A4**).
- **Guide pilier (GU1)** : seul gabarit où H4 est admis. Le type `guide_pilier` est dans la famille `guide` de la table du blog alors que GU1 sert `/guides/[slug]` : `gabaritRendu = guide` sur `/blog` jusqu'à décision (**D-A4**).

## 11. Où chaque règle s'insère

### 11.1 Module commun

Module **pur** `src/server/content-gen/structure/` (nom indicatif), sans base ni réseau : `GABARITS_REGLES` (tableau du § 10 et table des formats compatibles du § 4.3, **source unique**, lue aussi par la console), `TITRES_GENERIQUES`, `MOTS_VIDES_FR`, `racineSimple`, `corpsMesure`, `compterMotsContenu`, `formatDominant`, `calculerFourchetteMots`, `partReprise`, `verifierStructureArticle(contenu, structureBrief)` → écarts `{ regle, critere, section, preuve }`.

Il **réutilise** `outline-validator.ts` (codes existants, bornes passées en paramètre), `passages-citables.ts`, `normaliserTitre`, `shingles` de `plagiarism.ts`, le compteur de mots de `lisibilite-v2.ts`, `pagesLues` de `verificateur-deux-phases.ts` (exportée). **Il ne duplique aucun de ces outils.**

### 11.2 Table d'insertion

| Règle(s) | PR | Ce qui s'ajoute |
| --- | --- | --- |
| `structureBrief` (§ 8.1) dans `brief.ts` ; intention de `ContenuBesoin` | **C3** (tables, pas encore livrée) | schéma séparé et versionné dans le même module, brief v1 intact ; `ContenuBrief` stocke les deux JSON ; dans la conception de `ContenuBesoin`, la colonne d'intention prend directement les valeurs `SearchIntent` (texte nullable), au lieu de « info, comparaison, décision » ; aucune énumération Prisma nouvelle |
| Codes de raison | **C4** | `structure_titres`, `longueur`, `format_intention`, `intention_hors_article`, `questions_non_couvertes` ; correspondance B18…B23 → code |
| Module commun, fixtures de contrat, contrôles existants (§ 9.2 lignes C6) | **C6** | le module pur et ses tests ; `outline-validator` et `plan.ts` paramétrés ; `search-intent-validator` adapté (§ 4.4) ; H-2 au lieu de `keyword_missing` pour la chaîne ; fixtures par gabarit (tests 21 à 24) |
| Intention, admissibilité, formats, gabarit, plan, fourchette | **C6** (R2) | `pagesLues` et comptage par le code ; journal de R2 enrichi ; `calculerFourchetteMots` ; `verifierPlan` sur un `Plan` dérivé de `planHn` ; `intention_hors_article` ; import du **CSV du plan 365** |
| Pré-classement de l'intention | **C11** (R1) | règle simple, proposition seulement (I-4) |
| Rédaction (§ 6, § 8.2) ; plancher de `redaction.ts` ; lisibilité V2 | **C7** (R4) | consignes tirées du brief, pour R4 seulement ; suppression de « la longueur est déterminante » dans la voie R4 ; version « chaîne » de `consigneLisibiliteV2` ; drapeau `h1DansSortieBrute` ; plancher remplacé par la fourchette |
| Mesures pour la critique | **C8** (R5) | mesures L-1 à L-4 en entrée |
| Forme et renvoi du fond ; H-16 ; question Q13 de la grille et barrière de 850 mots | **C9** (R6, R7) | `verifierStructureArticle` avant/après ; règle `ordre_plan` en plus de `h2-hors-plan` ; règle « aucun renommage en mise à jour » ; planchers remplacés par la fourchette |
| Aiguillage du job (§ 8.1 bis) ; marqueur `versionChaine` ; observation dédiée (§ 9.3) | **C10** et **C14** | brief avant le job, `contentType` déduit du gabarit rendu, aiguillage avant `getGenerator` ; verdicts B18 à B23 journalisés hors porte ; compteur « contenus relus par gabarit cible » |
| B18 à B23 au registre ; B11, W01 adaptés | **Q2c** (nouvelle, **après C6**) | registre `CRITERES` (classe, seuil, champ d'application par origine), en ombre. Q2 n'est pas modifiée |
| `theme` et `typeIntention` au registre des intentions | **Q5a** (conception à corriger, non livrée) et **Q5** | `ContentIntention` reçoit **deux colonnes texte nullables distinctes**, `theme` (financement, réglementation…) et `typeIntention` (valeur `SearchIntent`) ; la **page propriétaire** déjà prévue sert de page cible (pas de second champ). Q5 alimente B22 et I-1 |
| Mise à jour | **Q15** | régime du § 5.4 pour B18 à B23 ; H-16 |
| Rendu | **S1**, **G1 à G8, A1, GU1** (+ S3) | S1 : le chargeur lit aussi `planHn` persisté quand il existe ; blocs du gabarit à partir de champs ou d'encadrés balisés ; G2 prend ses étapes dans `planHn` ; G4 compteur sur les H3 d'options ; G7 et J1 : questions dans le seul champ FAQ ; tests 21 à 23 |
| Console | **C14**, **Q8** | intention, gabarit cible et rendu, fourchette, mots mesurés, méthode ; raisons B18 à B23 ; `null` = « indisponible » |

**Ordre** : C3 → C4 → C5 (dossier de preuves, inchangé) → C6 → C7 → C8 → C9 → C10 (observation de B18 à B23 hors porte), puis Q2c et Q5a/Q5 ; C11 quand prévu. Les PR G avancent en parallèle **pour leur rendu** ; leurs tests de contrat s'appuient sur les fixtures livrées par C6. Rien ne change le comportement public avant son drapeau ; la chaîne reste éteinte par défaut.

## 12. Tests à écrire

**Module commun et contrôles adaptés (C6)**

1. `calculerFourchetteMots` : médiane sur 3 et 5 pages ; moins de 3 pages lisibles → repli ; plancher qui relève le minimum ; plancher au-dessus de la borne haute → plan refusé ; fourchette entière au-dessus ou au-dessous des bornes → règles (c) ; écart de 200 mots quand c'est possible ; FAQ de 15 questions.
2. `compterMotsContenu` : « Pourquoi ? » compte 1 mot, « 45 min » 2 ; même résultat que le compteur de `lisibilite-v2.ts`. `corpsMesure` retire `section#sources-axion` et tout bloc injecté après R4 ; un article avec et sans cette section donne le même nombre de H2, de mots et le même SimHash.
3. `formatDominant` et formats compatibles : 3 sur 5, 2 sur 3, 2-2-1 → `mixte` ; une `page-offre` n'est jamais retenue pour la longueur.
4. `verifierStructureArticle` : **un cas par règle** (H-1 à H-15, R-2, R-3, R-5, L-1 à L-4), une fixture qui passe et une qui échoue, avec la règle citée ; « Il faut … » n'est pas un pronom de reprise ; 0 H2 concerné → B19 conforme.
5. `GABARITS_REGLES` couvre exactement les 10 codes (`Record` exhaustif) et la table des formats compatibles.
6. `TITRES_GENERIQUES`, `MOTS_VIDES_FR` (« IA » significatif), `racineSimple`.
7. H1 : les 365 questions du CSV contre H-2 et H-3 ; le test **liste** les 11 H1 à abréger et les cas sans mot significatif commun, pour que R2 les traite ; aucune abréviation automatique silencieuse.
8. `search-intent-validator` adapté : un contenu de la chaîne `commercial_investigation` rendu en Analyse sans tableau reste aligné (pas de `tier_3_noindex_nofollow`) ; un Comparatif sans tableau échoue ; hors chaîne, comportement inchangé.

**Brief et R2 (C3, C6)**

9. Cohérence `brief.intention` ⇔ `structureBrief.intention` ; `targetSearchIntent` dérivé ; un brief v1 accompagné d'un `structureBrief` est lu sans erreur par le `briefSchema` actuel (fenêtre app/worker).
10. Import du CSV du plan 365 : 365 lignes, `décision` → `commercial_investigation`, **F-1 vérifié sur toutes les lignes sans rejet**, lignes touchant un prix **signalées** (C103, C041, C126), `chiffres` sans relevé signalé, aucune question sans origine, question du plan marquée principale.
11. `transactional`, `local`, `navigational` → `intention_hors_article` avec la page propriétaire ; sans page → signalement ; I-4 ne classe pas « fixer ses prix » en transactionnel.
12. `pagesLues` : URL et nombre de mots extraits des blocs `web_fetch` ; une URL citée par le modèle mais absente des blocs est ignorée.
13. Questions-réponses avec moins de 6 questions sourcées → brief refusé pour ce gabarit ; aucune question créée par le code.

**Rédaction et édition (C7, C9)**

14. R4 écrit un `<h1>` dans sa réponse → drapeau `h1DansSortieBrute` vrai dans son journal → écart B18, alors que le `bodyHtml` stocké n'a plus de `<h1>`.
    - 14 b. Le prompt de R4 de la chaîne ne contient ni « Par où commencer ? » imposé, ni « au moins la moitié des intertitres en questions », ni « 5 à 10 mots » ; le prompt hors chaîne est inchangé.
15. H2 ajouté, retiré ou **permuté** par rapport au plan → écart `ordre_plan`, renvoi à R4.
    - 15 b. Dérivation de `planHn` vers `Plan` : une section `etape` sans question ne déclenche pas `question_hors_brief` ; la question principale n'est pas exigée en couverture ; aucun `answer_length` au stade R2.
    - 15 c. Un job marqué `versionChaine = 2` de type `what_is_x` n'appelle pas `whatIsXGenerator` ; il est rendu avec le gabarit Définition.
16. Planchers : une Définition de 600 mots dans sa fourchette ne déclenche ni `mots-insuffisants`, ni Q13, ni `moins-de-850-mots` ; hors chaîne, ces trois contrôles restent à 850.
17. R7 : chiffres identiques avant/après ; un écart de fond est renvoyé.
18. Mise à jour : un H2 ancien renommé → refusé (sauf exception humaine) ; plan hérité construit par le code ; B20 refuse une mise à jour qui fait perdre plus de 10 % de mots.

**Porte (Q2c, Q5)**

19. Registre : B18 à B23 présents, classe et champ d'application conformes ; test « dérogation = classement » étendu ; B22 dur ; H-9 jugé par B23 seul et H-10 par W01 seul.
20. Formule de note inchangée (somme = 86). Contenu de la chaîne sans `structureBrief` → `bloque` (hors ombre) ; contenu hors chaîne → hors champ ; correspondance B18…B23 → codes, aucun dans `autre` ; « dans vos locaux, partout en France » n'est refusé par aucun nouveau critère.

**Gabarits (G1 à G8, A1, GU1), sur les fixtures de C6**

21. Un seul `h1` dans la page rendue, interrupteur `BLOG_GABARITS_V2` allumé et éteint, pour chaque gabarit ; les titres de l'en-tête et du pied de page du site, et les H2 rendus par le gabarit, ne sont pas comptés.
22. `p[data-aeo="answer"]` conservé au rendu et jamais dans un `<details>` fermé hors G7 ; G2 rend « Étape n sur N » sur les H2 de type `etape` du plan persisté, y compris des étapes en question ; G3 remonte le premier tableau une seule fois ; G4 numérote les seuls H3 d'options ; G7 émet une seule `FAQPage` ; aucun bloc de gabarit (triptyque, frise, verdict) ne duplique un H2 du corps.
23. Rendu sans perte : chaque H2 du corps de la fixture est présent dans la page rendue (le sommaire peut être masqué ou réduit aux étapes selon le gabarit : ce n'est pas l'objet du test).
24. Plans : des fixtures de plans conformes et différents, du même gabarit, ne sont pas refusés par `doublon_plan` ; un plan recopié l'est.

## 13. Contradictions relevées dans les documents et le code existants

| # | Contradiction | Arbitrage proposé |
| --- | --- | --- |
| 1 | B11, `redaction.ts`, `redacteur-en-chef.ts` (Q13) et `barrieres-publication.ts` exigent 850 mots ; le plan 365 prévoit des définitions et des FAQ dès 800 mots ; Google : aucun minimum. | Fourchette et bornes par gabarit pour la chaîne ; hors chaîne inchangé. **D-A1** |
| 2 | `equipe/plan.ts` impose 5 à 8 H2 ; B11 dit 3 à 8 ; la FAQ a ses questions dans un champ, la Sélection ses options en H3. | Bornes par gabarit ; validateur paramétré. |
| 3 | `brief.ts` a 3 intentions ; Will en demande 5 ; `SearchIntent` existe ; la conception de `ContentIntention` et de `ContenuBesoin` mêle intention et thème. | `SearchIntent` partout, `theme` à part ; `brief.intention` gardé et tenu cohérent. **D-A2** |
| 4 | `search-intent-validator` désindexe une intention comparative sans tableau. | Adapté pour la chaîne (§ 4.4). |
| 5 | Les sujets « actualité » et « guide pilier » du plan 365 n'ont pas de chemin vers `/actualites` et `/guides`. | `gabaritRendu` Analyse ou Guide sur `/blog`. **D-A4** |
| 6 | W01 (30 %) ; Will veut des H2 « souvent » en question ; les questions sourcées manquent souvent. | Cible par gabarit, plafonnée par les questions sourcées. |
| 7 | G7 rend la FAQ structurée ; des questions en H2 doubleraient la source et la `FAQPage`. | Questions dans le seul champ FAQ. |
| 8 | Ancres des H2 supposées stables ; `buildToc` les réécrit depuis le texte et efface les attributs. | Aucun renommage en mise à jour (H-16) ; aucun attribut requis sur les H2. |
| 9 | `DECOUPAGE.md` G4 numérote des H2 d'options ; la maquette v3 a des options en H3 sous des H2 en question. | La maquette prime. |
| 10 | `keyword_missing` exige le mot-clé exact dans la réponse directe. | H-2 (mots significatifs) pour la chaîne. |
| 11 | `appendSourcesSection` ajoute un H2 « Sources » au corps stocké ; les mesures compteraient ce H2. | Corps mesuré (§ 5). |
| 12 | `consigneLisibiliteV2`, injectée partout et prioritaire, impose une section « Par où commencer ? », la moitié des intertitres en questions et des H2 de 5 à 10 mots. | Version « chaîne » de la consigne pour R4 (§ 6). |
| 13 | Le worker choisit générateur et gabarit par `contentType`, avant l'équipe ; une Définition voulue par R2 serait écrite par `whatIsXGenerator` ou rendue en Analyse. | Aiguillage de C10 (§ 8.1 bis). |
| 14 | Will demande 40 à 60 mots sous chaque H2 ; les maquettes v3 validées montrent des ouvertures de 8 à 26 mots (médiane voisine de 18). | **D-A9.** |

## 14. Décisions demandées à Will

| Id | Question | Ma recommandation par défaut, avec un exemple |
| --- | --- | --- |
| D-A1 | Remplacer, pour la chaîne, le plancher de 850 mots par une fourchette et des bornes par gabarit ? | **Oui.** Exemple : une définition de « RAG » complète en 650 mots, quand les pages lues en font 700, passe ; une analyse de 700 mots sur « faut-il former ses salariés à l'IA ? » ne passe pas (borne basse du gabarit 800, jamais franchie, même avec la tolérance de 10 %). |
| D-A2 | Reprendre les cinq intentions de `SearchIntent`, et ranger les sujets « décision » en comparative ? | **Oui.** Exemple : « Avec cinq salariés, l'IA vaut-elle le coup ? » reste un article, rendu en Analyse sans tableau obligatoire ; « diagnostic IA PME » va vers la page contact. |
| D-A3 | Les requêtes transactionnelles (prix d'une prestation compris), locales et de navigation ne donnent jamais d'article ? | **Oui.** Exemple : « formation IA entreprise Lyon » relève des pages `/implantations` ; « prix d'un audit IA » de la page d'offre. Si aucune page ne les sert, vous recevez un signalement. |
| D-A4 | Où vivent les sujets « actualité » et « guide pilier » produits par la chaîne ? | **Sur `/blog`, rendus en Analyse ou Guide, tant qu'un type de contenu ne mène pas proprement à `/actualites` et `/guides`.** Exemple : E01 (guide pilier) est vérifié comme un guide pilier et affiché en Guide. |
| D-A5 | Garder B18 à B23 en ombre jusqu'à 10 contenus relus par gabarit ? | **Oui.** Exemple : si, sur 10 définitions relues, vous en validez 3 que B20 refusait pour 12 % de dépassement, la tolérance passe à ± 15 % par une nouvelle version de la porte, jamais en silence. |
| D-A6 | Après Q10, publie-t-on encore des articles hors chaîne (générateurs actuels) ? | **Non pour les articles neufs** ; les actualités RSS gardent leur circuit et les critères existants, en relecture. Exemple : un article de rotation gpt-4o n'est plus publiable ; une brève RSS l'est après relecture. |
| D-A7 | Les questions trouvées dans les pages lues par R2 comptent-elles comme « questions réelles » ? | **Oui, avec l'URL en référence.** Exemple : une question lue sur la page d'une CCI peut devenir un H2 ; une question qu'aucune page ne pose ne le peut pas. |
| D-A8 | Que faire des trois sujets du plan qui touchent un prix (C103 « prix d'un audit IA », C041 « coût réel de l'IA en PME », C126 sur la Journée IA) ? | **C103 : retirer du plan** (c'est une demande de tarif, la page d'offre y répond). **C041 : garder**, reformulé en coût général sourcé (études datées) et en temps, sans aucun tarif d'Axion-IA. **C126 : garder**, en reprenant mot pour mot `journee-ia-commun.ts`, sans montant, relecture humaine (règle existante). |
| D-A9 | Ouvertures sous les H2 : 40 à 60 mots (votre demande) ou une à deux phrases courtes comme dans les maquettes v3 (8 à 26 mots) ? | **Garder votre demande, 40 à 60 mots visés, tolérance de la porte 25 à 80**, et traiter les maquettes comme des modèles de mise en page, pas de longueur : les fixtures de test suivent cet arbitrage. Exemple : sous « Comment vérifier que rien d'important ne manque ? », deux phrases de 45 mots qui disent quoi relire et dans quel ordre. Si vous préférez les maquettes, la cible devient 15 à 35 mots, une nouvelle version de la porte, sans autre changement. |

## 15. Critique indépendante

- **Tour 1** (sous-agent Opus indépendant) : « À CORRIGER », 6 bloquants, 12 importants, 8 mineurs. Traités : H1 recalibrés sur le plan 365 ; champ d'application ; compatibilités du plan 365 ; types de H2 ; méthode de longueur requalifiée ; schéma séparé pour la fenêtre app/worker ; FAQ à source unique ; H-16 ; reprise de `SearchIntent` ; tolérance des ouvertures ; traçabilité par position ; prix ; B22 dur ; observation dédiée ; Q2c après C6 ; Q5a corrigée ; niveaux de preuve ; point de mesure avant nettoyage.
- **Tour 2** (nouveau sous-agent Opus indépendant) : « À CORRIGER », 4 bloquants, 12 importants, 14 mineurs. Traités dans cette version : validateur d'intention qui aurait désindexé les sujets « décision » (§ 4.4) ; H2 imposés supprimés au profit des blocs du gabarit, comme dans les maquettes v3, ce qui lève aussi le risque de plans identiques au contrôle SimHash (§ 10) ; `data-section` abandonné, puisque `buildToc` l'efface (§ 5.2) ; champ d'application défini par l'origine, échec fermé (§ 1, § 9.1) ; trois planchers de 850 mots recensés (§ 9.2) ; question principale hors couverture (L-4) ; `pagesLues` et comptage par le code (§ 7.2) ; table des formats compatibles (§ 4.3) ; un seul juge par règle (§ 9.1) ; exemple de D-A1 corrigé ; H-2 et « IA » ; sujets de prix (D-A8) ; sources de vérité désignées (§ 8.1) ; régime de mise à jour complet (§ 5.4) ; observation hors porte dès C10 (§ 9.3) ; mineurs (343 H1, 0 sur 0, phases du Guide, tests 23 et 24, `contentType` cible et rendu, `/implantations`, ponctuation, H-11, Gemini, Indig, C7 limité à R4).
- **Tour 3** (nouveau sous-agent Opus indépendant), sur la version précédente : « À CORRIGER », 4 bloquants, 8 importants, 7 mineurs. Corrigés dans cette version, **qui n'a pas été relue par une quatrième critique** (limite de trois tours) : Guide aligné sur sa maquette (étapes en question, « Étape n sur N » rendu par le gabarit, types lus dans `planHn` persisté) ; corps mesuré sans la section « Sources » injectée ; version « chaîne » de la consigne de lisibilité V2 ; aiguillage du job avant `getGenerator` et `contentType` déduit du gabarit rendu (§ 8.1 bis) ; ouvertures des maquettes contre la demande de Will (D-A9) ; point de mesure du H1 dans R4 et R7 ; dérivation de `planHn` vers `verifierPlan` ; règle d'appariement `ordre_plan` ; comptage recalculé (354 H1 conformes, 11 à abréger) et `compterMotsContenu` sans conflit de nom ; Sélection, Guide pilier, Définition et FAQ alignés sur leurs maquettes ; SimHash sur le corps mesuré et non comparé sous 2 titres ; marqueur `versionChaine` ; mineurs (R2 « lira », `pagesLues` texte seulement, « question Q13 de la grille », H1 retiré de B11, ancres en mise à jour, 3 citations du validateur, gabarit cible pour l'ombre, C5 dans l'ordre).
