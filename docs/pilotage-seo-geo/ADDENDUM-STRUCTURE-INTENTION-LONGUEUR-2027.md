# Addendum : intention, structure des titres, longueur (chaîne éditoriale et porte qualité, 2027)

> Phase de conception, 27/11/2026, branche `docs/addendum-structure-hn-2027`. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**
> Demande de Will : pour **chaque article**, la chaîne éditoriale IA doit tenir compte **explicitement** de (1) l'intention de recherche et du format qui y répond, (2) la structure des titres H1/H2/H3, (3) une longueur adaptée à la question, (4) les pratiques des moteurs (Google Search, AI Overviews, AI Mode, Bing/Copilot, ChatGPT Search, Perplexity, Gemini, Claude) telles qu'elles sont fin 2026.
> Ce document **complète sans les remplacer** : `CONCEPTION-CHAINE-EDITORIALE-IA.md` (rôles R1-R8, PR C0-C16), `CONCEPTION-PORTE-QUALITE.md` (critères B01-B17, W01-W10, PR Q0-Q17), `docs/design/gabarits-articles/PLAN.md` et `DECOUPAGE.md` (10 gabarits, PR S1-S3, G1-G8, A1, GU1, J1), `docs/contenu/PLAN-EDITORIAL-365.md` et son CSV. Il part du code réel : `src/server/content-gen/equipe/brief.ts`, `equipe/plan.ts`, `quality/outline-validator.ts`, `quality/passages-citables.ts`.
> Les noms existants (`B01`…`B17`, `W01`…`W10`, verdicts `publiable` / `a_corriger` / `bloque`, codes de raison de `ContenuRefus`) **ne sont pas renommés**. Les nouveaux critères sont numérotés **B18 à B23**.

## 0. En bref

1. **Aucun moteur ne publie de règle de longueur ni de nombre de titres.** Google dit qu'il n'existe pas de nombre de mots idéal et que l'ordre des titres ne compte pas pour le classement (il compte pour l'accessibilité). Le guide Google d'optimisation pour l'IA (mai 2026) dit que le contenu « non banal » pèse plus que tout le reste, et que le découpage spécial pour l'IA est inutile. Microsoft (Bing/Copilot) recommande des titres H1/H2/H3 qui nomment des questions, des réponses courtes et autonomes, et de ne pas cacher les réponses dans des onglets. **Les règles chiffrées de ce document sont donc des règles de qualité et de lisibilité de la maison, vérifiables par le code, pas des « facteurs de classement ».** Elles sont marquées comme telles (§ 2).
2. **Intention** : le brief déclare une intention parmi **cinq** (informationnelle, comparative, transactionnelle, locale, navigation). **Seules l'informationnelle et la comparative donnent un article.** Une intention transactionnelle, locale ou de navigation est servie par une page existante (offre, contact, pages villes de S6, accueil) : le stratège rend le verdict `intention_hors_article` au lieu d'écrire une page qui cannibaliserait (§ 4).
3. **Structure** : un seul H1 (rendu par la page, jamais dans le corps), des H2 informatifs souvent formulés comme les **vraies questions** du brief (avec leur origine), aucun saut de niveau, longueurs de titres bornées, **réponse directe de 40 à 60 mots sous le H1 puis sous chaque H2**, balisée `<p data-aeo="answer">` (balisage déjà prévu par `BALISAGE-ENCADRES.md`) (§ 5, § 6).
4. **Longueur** : une **fourchette** par article, calculée par le stratège à partir de la **médiane des pages qui se classent réellement** sur la requête (mesurée, pas estimée), bornée par le **plancher de couverture** des questions du brief et par les bornes du gabarit. Ni nombre fixe, ni course à la longueur (§ 7).
5. **Six nouveaux critères de porte** : B18 hiérarchie des titres, B19 réponses directes sous les H2, B20 longueur et équilibre, B21 format conforme à l'intention et au gabarit, B22 intention éditoriale admissible, B23 questions traçables et couvertes. Tous **corrigeables** par réécriture ciblée, sauf B22 (dérogeable). Aucun ne change la formule de note (§ 9).
6. **Chaque gabarit** reçoit sa propre fiche : intentions admises, plan type, nombre de H2, bornes de longueur, élément de structure obligatoire. Le gabarit fixe la **mise en page de l'article** ; l'**en-tête et le pied de page restent ceux du site**, rendus par le layout (§ 10).
7. **Trois contradictions** entre documents existants sont relevées et arbitrées : plancher de 850 mots de B11 contre des définitions à 800 mots dans le plan 365 ; 5 à 8 H2 imposés par `equipe/plan.ts` contre 3 à 8 dans B11 et 6 à 15 questions dans le gabarit FAQ ; « décision » du code contre les cinq intentions demandées (§ 13). Les arbitrages sont des **décisions pour Will** (§ 14).

## 1. Portée et ce qui ne change pas

- **Dans le périmètre** : les articles produits par la chaîne (`/blog/[slug]`, `/guides/[slug]`, `/actualites/[slug]`), du brief (R2) à la porte (R8), et le contrat entre le corps HTML produit et les 10 gabarits.
- **Hors périmètre** : pages de service, d'offre, de contact, pages villes (S6), glossaire, Observatoire. Elles reçoivent les intentions que les articles refusent (§ 4.2).
- **Ne change pas** : URL, slugs, canonical, métadonnées, `og:image`, `@id` JSON-LD, ancres des H2 publiés (`slugifyHeading`, `buildToc` : des liens profonds sont déjà cités, `PLAN.md` gabarits § 8), règles de marque (`interdits-publication.ts`, `positionnement.ts` en lecture seule), budget Web Vitals.
- **Le gabarit fixe la mise en page** de l'article (héros, encadrés, sommaire, cartes, colonne d'actions). **L'en-tête et le pied de page sont ceux du site, rendus par le layout** : aucune règle de ce document ne les touche, et aucun titre de l'en-tête ou du pied de page n'entre dans les comptes de titres (le contrôle porte sur le corps de l'article et sur le H1 rendu par la page).

## 2. Pratiques des moteurs fin 2026 : ce qui est documenté, ce qui ne l'est pas

**Méthode et limite.** Recherche web du 27/11/2026. Les pages `developers.google.com` et `about.ads.microsoft.com` **n'ont pas pu être ouvertes** (domaines refusés par le réseau de la session) : leur contenu est cité **à travers les extraits de recherche et la presse spécialisée**, comme dans les deux documents de conception précédents. Chaque affirmation porte son niveau : **[officiel]** (page de l'éditeur, lue en extrait), **[secondaire]** (presse SEO), **[étude]** (étude chiffrée, souvent d'un éditeur d'outil), **[hypothèse]**. À relire sur les pages d'origine avant toute décision engageante : celles marquées ‡.

### 2.1 Google Search, AI Overviews, AI Mode

| Fait                                                                                                                                                                                                                                                                                                                                                                                                                | Niveau                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aucune exigence supplémentaire** pour apparaître dans AI Overviews ou AI Mode ; les fondamentaux SEO s'appliquent. AI Overviews et AI Mode peuvent employer le **« query fan-out »** : plusieurs recherches liées sont lancées pour construire une réponse.                                                                                                                                                       | [officiel] ‡ https://developers.google.com/search/docs/appearance/ai-features                                                                                                                                                                                                                                                |
| **Guide d'optimisation pour l'IA générative** (mai 2026, mis à jour le 10/07/2026 selon une source) : le contenu **« non-commodity »** (expérience directe, données propres, point de vue unique, expertise réelle) « influencera probablement la présence dans la recherche générative **plus que toutes les autres suggestions** » du guide. À ignorer : `llms.txt`, **découpage en blocs (« chunking »)**, réécriture spéciale pour l'IA, données structurées « pour l'IA ». | [officiel] ‡ https://developers.google.com/search/docs/fundamentals/ai-optimization-guide ; https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing ; résumés : https://www.frase.io/blog/google-ai-optimization-guide , https://surfer.ai/blog/non-commodity-content/ [secondaire]                 |
| **Longueur** : la longueur seule ne compte pas pour le classement ; il n'y a **pas de nombre de mots cible**, ni minimum ni maximum. Mueller : « écrire aussi long ou aussi court que nécessaire pour les lecteurs ».                                                                                                                                                                                               | [officiel] ‡ SEO Starter Guide https://developers.google.com/search/docs/fundamentals/seo-starter-guide ; [secondaire] https://www.seroundtable.com/google-word-count-for-seo-google-rankings-35607.html                                                                                                                       |
| **Ordre des titres** : un ordre sémantique est très utile aux lecteurs d'écran, mais **n'a pas d'importance pour le classement** (Starter Guide, confirmé par Gary Illyes en podcast). Plusieurs H1 ne gênent pas Google (Mueller). Des titres sémantiquement structurés **aident Google à comprendre la page**.                                                                                                     | [officiel] ‡ Starter Guide ; [secondaire] https://www.searchenginejournal.com/google-clarifies-h1-h6-headings-for-seo/522454/ , https://searchengineland.com/multiple-h1s-wont-get-in-the-way-of-your-seo-google-says-322909                                                                                                  |
| **Lien de titre** : Google peut le tirer du `<title>`, du **titre principal visible**, des **éléments de titre comme le H1**. Conseil : rendre le titre principal **le plus visible**, par exemple dans le **premier H1 visible** ; si plusieurs titres ont le même niveau ou le même style, Google peut prendre le premier.                                                                                       | [officiel] ‡ https://developers.google.com/search/docs/appearance/title-link                                                                                                                                                                                                                                                 |
| **Intention** : les consignes des évaluateurs classent les requêtes en **Know** (savoir), **Do** (faire), **Website** (aller sur un site), **Visit-in-person** (se rendre sur place), puis notent l'adéquation (« Needs Met »). Les évaluateurs n'agissent pas directement sur le classement.                                                                                                                       | [officiel] https://services.google.com/fh/files/misc/hsw-sqrg.pdf ; https://developers.google.com/search/blog/2023/11/search-quality-rater-guidelines-update                                                                                                                                                                 |
| Rich results FAQ supprimés le 07/05/2026 ; politiques anti-spam étendues aux réponses génératives le 15/05/2026 ; contenu en masse = spam quel que soit le moyen. (Déjà sourcés dans `CONCEPTION-CHAINE-EDITORIALE-IA.md` § 2.)                                                                                                                                                                                      | [officiel / secondaire]                                                                                                                                                                                                                                                                                                      |
| **Mai et octobre 2026** : liens plus visibles et plus hauts dans AI Overviews et AI Mode (contexte de lien, « Further exploration »). Aucun changement de doctrine pour les éditeurs.                                                                                                                                                                                                                               | [secondaire] https://searchengineland.com/google-updates-ai-mode-and-ai-overview-with-more-links-context-carousels-and-information-on-creators-496242 ; https://www.ewn.co.za/2026/10/16/google-boosts-news-and-link-visibility-in-ai-mode                                                                                    |
| Juin 2026 : contrôle Search Console pour l'apparition dans les fonctions d'IA générative (test au Royaume-Uni), non utilisé comme signal de classement hors de ces fonctions.                                                                                                                                                                                                                                       | [officiel] https://blog.google/products-and-platforms/products/search/new-opportunities-control-and-insights-for-website-owners/                                                                                                                                                                                             |

### 2.2 Bing et Copilot

| Fait                                                                                                                                                                                                                                                                                                                                                                                                   | Niveau                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microsoft Advertising, « Optimizing Your Content for Inclusion in AI Search Answers » (08/10/2025) : **titres H1/H2/H3 qui nomment des questions ou des sujets précis** ; **paires question-réponse** que les assistants « reprennent souvent mot pour mot » ; **réponses d'une à deux phrases** qui répondent directement ; listes, Q/R et tableaux en formulations **autonomes** ; **ne pas cacher les réponses** dans des onglets ou menus repliables (les systèmes d'IA peuvent ne pas les rendre). Aucune garantie d'inclusion. | [officiel, lu en extraits] ‡ https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers ; [secondaire] https://www.seroundtable.com/microsoft-ads-optimize-for-ai-search-answers-40241.html                         |
| Consignes Bing Webmaster réécrites pour couvrir les réponses Copilot (GEO dans les consignes officielles, définitions d'abus élargies).                                                                                                                                                                                                                                                                | [secondaire] https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/                                                                                                                                  |
| Rapport « AI Performance » de Bing Webmaster Tools (aperçu public, 02/2026) : citations dans Copilot et les résumés IA de Bing ; juin 2026 : intentions, sujets, part de citation.                                                                                                                                                                                                                   | [officiel] https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview ; https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare |
| Fraîcheur : sitemaps à jour et IndexNow pour que les mises à jour apparaissent dans les réponses IA ; contenu dupliqué = visibilité affaiblie.                                                                                                                                                                                                                                                         | [officiel] https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search                                                                                                                                        |

### 2.3 ChatGPT Search, Perplexity, Gemini, Claude

| Fait                                                                                                                                                                                                                                                                                                                       | Niveau                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ChatGPT Search** : `OAI-SearchBot` sert à faire apparaître les sites dans les résultats ; on peut l'autoriser et bloquer `GPTBot` (entraînement). Le trafic venu de ChatGPT porte `utm_source=chatgpt.com`. **OpenAI ne publie aucune consigne de structure ni de longueur.**                                         | [officiel] https://developers.openai.com/api/docs/bots ; https://help.openai.com/en/articles/12627856-publishers-and-developers-faq                            |
| **Perplexity** : `PerplexityBot` sert à faire apparaître et à lier les sites ; **aucune spécification publique de la sélection des sources** n'a été trouvée.                                                                                                                                                             | [officiel] https://docs.perplexity.ai/docs/resources/perplexity-crawlers ; [secondaire] analyses de praticiens, contradictoires                                 |
| **Gemini** : l'ancrage sur Google Search cite des sources (URI et titre) reliées aux passages de la réponse ; les pages qui refusent `Google-Extended` ne servent pas à l'ancrage via l'API.                                                                                                                              | [officiel] https://ai.google.dev/gemini-api/docs/google-search                                                                                                 |
| **Claude** : la recherche web cite toujours ses sources (URL, titre) ; `Claude-SearchBot` explore pour la recherche, `Claude-User` lit à la demande.                                                                                                                                                                     | [officiel] https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool ; https://support.claude.com/en/articles/8896518                     |
| **Conséquence commune** : ces moteurs **trouvent** les pages par leur index ou celui d'un tiers, puis **citent des passages**. Rien d'officiel ne dit quel passage ils retiennent. Ce qui est sous notre contrôle : être indexable par les robots de recherche (déjà réglé), et écrire des passages **autonomes, exacts, datés et sourcés**. | [hypothèse raisonnée]                                                                                                                                          |

### 2.4 Études chiffrées (corrélations, pas des causes)

- **Longueur et citation dans AI Overviews** (Ahrefs, 2026, 174 048 pages) : corrélation de Spearman **0,04** entre nombre de mots et position de citation ; longueur moyenne citée 1 282 mots ; **53,4 % des pages citées font moins de 1 000 mots**, 30,6 % entre 1 000 et 2 000, 16 % au-delà. [étude] https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/ . Une étude plus petite (avril 2026, 1 000 aperçus) trouve 1,6 × plus de citations au-delà de 2 500 mots, attribuées à la **couverture des sous-questions** plutôt qu'à la longueur. [étude, éditeur d'outil] https://www.digitalapplied.com/blog/we-analyzed-1000-ai-overviews-citation-pattern-study
- **Titres et passages cités par ChatGPT** (Kevin Indig, 1,2 million de réponses) : contenu cité deux fois plus souvent porteur d'un point d'interrogation ; 44,2 % des citations dans les 30 premiers pour cent de la page. **Contre-exemple** : SE Ranking (11/2025) ne trouve aucun gain aux seuls titres en question ni aux FAQ. [étude, rapportée en secondaire] https://fortitudemedia.ai/insights/anatomy-of-article-cited-by-ai
- **Statistiques et citations de sources** : jusqu'à environ +40 % de visibilité dans des moteurs génératifs simulés (Princeton / IIT Delhi, KDD 2024). [étude] https://arxiv.org/abs/2311.09735
- **Instabilité** : les sources citées changent d'un jour à l'autre (34 à 42 % de recouvrement). [étude] https://arxiv.org/pdf/2604.07585

### 2.5 Ce que ce document en tire

| Règle de ce document                                         | Appui                                                                                                                       | Statut                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Un seul H1 visible, le plus en vue                           | Google, liens de titre                                                                                                      | [officiel] pour l'effet sur le titre affiché ; **pas** un facteur de classement                             |
| Hiérarchie sans saut de niveau                               | Accessibilité (RGAA, WCAG) ; Google : aide à la compréhension                                                               | [officiel] pour l'accessibilité ; neutre pour le classement                                                  |
| Titres qui nomment la question ou le sujet                   | Microsoft ; études de praticiens                                                                                            | [officiel Microsoft] ; [étude] contradictoire pour ChatGPT                                                   |
| Réponse directe de 40 à 60 mots sous le H1 et chaque H2      | Microsoft (« une à deux phrases ») ; consensus de praticiens sur 40-60 mots ; B08 existant                                  | **[hypothèse de la maison]** : la fourchette 40-60 n'est publiée par aucun moteur                           |
| Longueur = fourchette mesurée, pas un nombre                 | Google (pas de nombre cible) ; Ahrefs (corrélation 0,04)                                                                    | [officiel] + [étude]                                                                                         |
| Couvrir les sous-questions réelles sur la même page          | Query fan-out documenté ; étude avril 2026                                                                                  | Fan-out [officiel] ; effet sur la citation [hypothèse]                                                       |
| Rien de spécial « pour l'IA » (pas de découpage artificiel)  | Guide Google mai 2026                                                                                                       | [officiel] : nos blocs citables sont des **paragraphes utiles au lecteur**, pas des fragments pour robots |
| Aucune réponse clé cachée dans un élément replié             | Microsoft                                                                                                                   | [officiel Microsoft]                                                                                         |

**Le danger à éviter** : transformer ces règles en gabarit d'écriture uniforme. Le guide Google le dit : le contenu non banal compte plus que la forme. Les règles de forme ci-dessous sont **nécessaires mais pas suffisantes** ; l'apport original (B07), les faits sourcés (B02, B09) et la critique de R5 restent le cœur. Un test vérifie d'ailleurs que les plans de deux articles différents ne sont pas identiques (contrôle SimHash existant, W08).

## 3. Vue d'ensemble : qui fait quoi

```
R1 réserve de besoins ─► R2 BRIEF : intention (5) + admissibilité + format dominant observé
                              + gabarit + plan Hn + questions à couvrir + fourchette de mots
                        ─► R3 faits ─► R4 RÉDACTION : respecte le plan, réponses 40-60 mots,
                              balisage data-aeo, longueur dans la fourchette
                        ─► R5 critique (remplissage ? manque ?) ─► R6 faits
                        ─► R7 ÉDITION : contrôle structurel par le code avant/après, corrige la forme
                        ─► R8 PORTE : B18 à B23 (+ B08, B11 et W01 adaptés au gabarit)
                        ─► gabarit (G1-G8, A1, GU1) : rend le H1, place les blocs, ne recalcule rien
```

Le **même module pur** (`verifierStructureArticle`, § 11.1) sert à R2 (sur le plan), à R4 et R7 (sur le brouillon) et à la porte (sur le texte final) : **une seule mesure, trois moments**. C'est ce qui garantit que la porte dise presque toujours oui à un contenu issu de la chaîne.

## 4. Intention de recherche et format

### 4.1 Les cinq intentions

| Intention (`typeIntention`) | Le dirigeant veut…                                                         | Exemple                                              | Donne un article ?                                                                    |
| --------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `informationnelle`          | savoir, comprendre ou **faire** (Know et Do des consignes Google)          | « Comment automatiser les notes de frais ? »         | **Oui**                                                                               |
| `comparative`               | comparer des options **ou évaluer une décision** (lequel, oui ou non, combien) | « Copilot ou ChatGPT pour une PME ? », « Avec cinq salariés, l'IA vaut-elle le coup ? » | **Oui**                                                                               |
| `transactionnelle`          | agir tout de suite : demander, s'inscrire, acheter, obtenir un devis      | « diagnostic IA PME », « formation IA entreprise »   | **Non** : page d'offre ou page contact existante                                     |
| `locale`                    | un prestataire ou un lieu **dans une ville**                               | « formation IA entreprise Lyon »                     | **Non** : pages villes de S6 (`S6-VILLES.md`), jamais d'article par ville            |
| `navigation`                | atteindre une page précise d'un site connu                                 | « axion ia contact », « journée IA axion »           | **Non** : la page visée existe déjà                                                  |

**Correspondance avec le code actuel** (`brief.ts` : `INTENTIONS = ["information", "comparaison", "decision"]`, plan 365 : 288 `information`, 29 `comparaison`, 48 `décision`) :

- `information` → `informationnelle` ; `comparaison` → `comparative` ;
- `decision` → **`comparative`** par défaut. Lecture des 48 sujets « décision » du plan 365 : ce sont des évaluations (« vaut-il le coup », « par où commencer »), donc de l'investigation avant achat, **pas** des requêtes transactionnelles. R2 peut reclasser un sujet en `transactionnelle` s'il constate dans les résultats lus que la requête n'affiche que des pages d'offre ; il rend alors `intention_hors_article` (§ 4.2).
- **Ajout additif** : le champ `typeIntention` s'ajoute au brief à côté de `intention` (conservé pour la compatibilité). Valeurs en **texte validé par zod**, jamais en énumération Prisma (fenêtre app/worker, `AGENTS.md`).

### 4.2 Admissibilité : une intention, une page du bon type

- **Règle I-1.** Un brief dont `typeIntention` vaut `transactionnelle`, `locale` ou `navigation` **n'entre pas en rédaction**. R2 rend le verdict `intention_hors_article` avec `pageCible` (URL existante qui sert cette intention, lue dans la carte des requêtes `strategie/carte-requetes.ts` ou dans la liste des pages d'offre). Le besoin est marqué `ecarte` dans la réserve avec cette raison. Si aucune page existante ne sert l'intention, c'est un **signalement pour Will** (une page d'offre ou une page ville manque), jamais un article de remplacement.
- **Règle I-2.** Une requête « locale » dont la réponse ne dépend **pas** du lieu (« IA pour les commerces de centre-ville ») est reformulée en `informationnelle` **sans nom de ville** (règle du plan 365 : aucune ville nommée).
- **Règle I-3.** Une intention mixte (exemple : « formation IA entreprise prix », informationnelle **et** transactionnelle) est classée par **ce que montrent les cinq premiers résultats lus** : si au moins trois sont des pages d'offre, `transactionnelle` ; sinon `informationnelle`, avec l'appel à l'action vers le Diagnostic (B10 inchangé) et **aucun prix** dans le texte (règles de marque).
- **Nouveau code de raison** (module partagé de C4) : `intention_hors_article`. Il s'ajoute à la liste fermée ; aucun code existant ne change.

### 4.3 Format qui répond à l'intention

R2 lit déjà les cinq premières pages de résultats (`CONCEPTION-CHAINE-EDITORIALE-IA.md` § 3, R2). Il enregistre en plus, pour chacune, le **format observé** parmi une liste fermée : `definition`, `guide-etapes`, `liste-classement`, `comparatif-tableau`, `analyse`, `faq`, `chiffres`, `actualite`, `page-offre`, `forum`, `video`, `autre`. Le **format dominant** est celui d'au moins 3 pages sur 5 (sinon `mixte`).

| Sous-intention (champ `besoin`) | Intention        | Format attendu                                    | Gabarit(s) compatibles                   |
| ------------------------------- | ---------------- | ------------------------------------------------- | ---------------------------------------- |
| savoir ce qu'est X              | informationnelle | définition courte, puis usages et limites         | Définition                               |
| comprendre pourquoi, les enjeux | informationnelle | analyse : constat, causes, leviers                | Analyse                                  |
| faire, mettre en place          | informationnelle | étapes numérotées, prérequis, résultat attendu    | Guide pratique ; Guide pilier si panorama |
| plusieurs questions courtes     | informationnelle | questions-réponses                                | Questions-réponses                       |
| mesurer, situer                 | informationnelle | chiffres datés et sourcés, lecture                | Chiffres (seulement avec relevé structuré) |
| savoir ce qui change            | informationnelle | actualité : ce qui change, pour qui, que faire    | Actualité                                |
| illustrer par une situation     | informationnelle | exemple type étiqueté                              | Étude de cas                             |
| comparer A et B                 | comparative      | tableau de critères, « ça dépend de… »             | Comparatif                               |
| choisir parmi N options         | comparative      | liste classée par usage, critères, synthèse        | Sélection                                |
| décider oui ou non, par où commencer | comparative | analyse de décision : critères, calcul simple, seuils | Analyse ; Guide pratique              |

- **Règle F-1.** Le gabarit choisi par R2 doit être dans la colonne « compatibles » de son couple intention / sous-intention.
- **Règle F-2.** Si le format dominant observé diffère du gabarit choisi, R2 **justifie en une phrase** (`ecartFormat`), par exemple « les résultats sont des pages d'offre ; nous répondons à la question de fond ». Un écart non justifié est refusé par la validation du brief.
- **Règle F-3.** Si le format dominant est `page-offre` ou `forum` sur 4 pages sur 5, R2 doit se demander si la requête est vraiment éditoriale ; à défaut d'angle, `pas_d_angle` (verdict existant).
- **Appel à l'action** : inchangé, celui de la porte (§ 9.2 de `CONCEPTION-PORTE-QUALITE.md`) : Diagnostic IA 45 min par la page contact, ou renseignements Journée IA ; jamais `/appel`.

## 5. Structure des titres : règles vérifiables

Les seuils de longueur de titre sont des **choix de lisibilité de la maison** [hypothèse], pas des exigences d'un moteur. Les mots se comptent comme dans `passages-citables.ts` (`compterMots` sur le texte sans balises) ; les caractères sur le texte normalisé (espaces repliés).

### 5.1 H1

- **H-1.** **Un seul H1 par page rendue**, produit par la page à partir du titre de l'article (le gabarit l'affiche, `PLAN.md` gabarits § 4). **Le corps HTML stocké ne contient aucun `<h1>`.** Les corps anciens qui en ont (`qa_derived`) sont abaissés au rendu (`abaisserH1`, S3) ; un corps **produit par la chaîne** avec un `<h1>` est refusé (B18).
- **H-2.** Le H1 contient le **mot-clé principal** du brief ou sa variante normalisée (casse, accents, pluriel simple), avec la fonction existante `normaliserTitre`.
- **H-3.** Longueur du H1 : **20 à 90 caractères** et **au plus 14 mots**. Il est souvent la question du dirigeant (« Peut-on enfin arrêter de saisir les notes de frais à la main ? »), ou une affirmation claire pour Définition et Chiffres.
- **H-4.** Pas de nom de marque, pas de séparateur `|` ni `–` de type balise title, pas de date seule (« 2027 » n'est admis que si le contenu est réellement daté de 2027).
- **H-5.** Le H1 n'est pas identique au `<title>` imposé ; ils peuvent différer (le `<title>` garde ses bornes existantes de 50 à 60 caractères, `edition-seo.ts`).

### 5.2 H2

- **H-6.** Nombre de H2 : **bornes du gabarit** (tableau du § 10), et non plus un intervalle unique. Les H2 « structurels » (sources, FAQ en fin d'article, « À lire aussi ») sont **hors compte** et listés dans une liste fermée `H2_STRUCTURELS`.
- **H-7.** Chaque H2 **informatif** : 3 à 12 mots, **au plus 70 caractères**, contient au moins **un mot significatif** (hors mots vides) de la question qu'il couvre (`questionCouverte` du plan).
- **H-8.** **Titres génériques interdits** comme H2 : « Introduction », « Conclusion », « En résumé », « Pour aller plus loin », « Contexte », « Définition », « Avantages », « Inconvénients », « Les enjeux », « Notre avis », seuls ou suivis d'un simple deux-points. Liste fermée, normalisée, testée. « Ce qu'il faut retenir » est admis seulement comme encadré de fin, pas comme H2.
- **H-9.** **H2 en question** : quand un H2 est une question, il se termine par « ? » et **correspond à une question du brief qui porte son origine** (`search-console`, `plan-editorial`, `autre-source`). Une question inventée en titre est refusée (`question_hors_brief`, code existant de `outline-validator.ts`).
- **H-10.** Part minimale de H2 en question, **par gabarit** (§ 10) : 50 % pour Analyse, Guide pilier, Actualité ; 100 % pour Questions-réponses ; 0 % exigé pour Guide (les étapes sont des verbes d'action), Sélection (les options sont des noms) et Chiffres. Cette part remplace le seuil unique de **W01** (30 %), dont les **points ne changent pas** (formule de note intacte).
- **H-11.** Pas de H2 en double (après normalisation) ; aucun H2 identique au H1 ; le mot-clé principal exact apparaît dans **au plus la moitié** des H2 (contre le bourrage).

### 5.3 H3 et au-delà

- **H-12.** Un H3 n'existe que sous un H2 qui en a **au moins deux** (`lone_h3`, existant). 3 à 12 mots, au plus 70 caractères.
- **H-13.** **Aucun saut de niveau** (`heading_level_skip`), aucun sous-titre avant le premier H2 (`subheading_before_h2`), codes existants.
- **H-14.** H4 : interdit sauf dans le **Guide pilier** (étapes d'un chapitre, sous un H3). H5 et H6 : interdits partout.
- **H-15.** Pas de **faux titre** : un paragraphe de moins de 12 mots entièrement en `<strong>` suivi d'un paragraphe est signalé (avertissement R7, corrigé en H3 ou en texte courant).

### 5.4 Ancres et mises à jour

- **H-16.** En **mode mise à jour** d'un article publié, un H2 n'est renommé que si le brief le justifie ; son **ancre d'origine est conservée** (attribut `id` explicite, conservé par `html-sanitizer.ts`) pour ne pas casser les liens profonds déjà cités par des moteurs. À vérifier dans C9 : que `slugifyHeading` respecte un `id` déjà présent ; sinon, la règle devient « pas de renommage de H2 en mise à jour ».

## 6. Réponses directes et blocs citables

- **R-1. Sous le H1** : réponse directe autonome de **40 à 60 mots** (B08, inchangé), qui répond à la question du H1 et contient le mot-clé (contrôle `keyword_missing` existant). Rendue par `AnswerCard` (`data-aeo="tldr"`).
- **R-2. Sous chaque H2 informatif** : le **premier élément** après le H2 est un `<p data-aeo="answer">` de **40 à 60 mots** (balisage déjà défini dans `BALISAGE-ENCADRES.md`) qui répond à la question du H2 **avant** toute liste, tableau, H3 ou encadré. Exemptés : les H2 structurels (H-6) et, dans le Guide, l'éventuel H2 « Avant de commencer » (check-list).
- **R-3. Autonomie** : ces réponses ne commencent ni par un renvoi (`commenceParUnRenvoi`, existant) ni par un pronom de reprise (« Il », « Elle », « Cela », « Ce dernier », « Celle-ci », « Ces derniers », « Ils », « Elles »), et contiennent au moins un mot significatif du H2. Lue seule, sans le reste de la page, elle a du sens.
- **R-4. Chiffre dans une réponse** : un chiffre dans une réponse directe porte sa source et son année dans le même paragraphe (B02 existant, appliqué ici en priorité : ce sont les passages les plus repris).
- **R-5. Jamais caché** : la réponse sous le H1 et les réponses sous les H2 ne sont **jamais** dans un `<details>` fermé, un onglet ou un élément masqué. Exception : les cartes du gabarit Questions-réponses (G7), où la **première carte est ouverte** et toutes les réponses restent dans le HTML servi par le serveur [hypothèse : Microsoft prévient que des systèmes d'IA peuvent ne pas rendre ces éléments ; le HTML étant servi sans JavaScript, le risque est jugé faible, et sera mesuré par l'échantillon de citations de la P10 du pilotage].
- **R-6. Blocs citables** : en plus des réponses directes, chaque article informationnel ou comparatif contient au moins un bloc structuré **qui sert le lecteur** selon le gabarit (étapes, tableau, définition, chiffres datés) : exigence portée par B21 (§ 9). Pas de « fragment pour l'IA » ajouté sans utilité (guide Google).

## 7. Longueur : une fourchette par article

### 7.1 Principe

La longueur **n'est pas un objectif**. Elle sert de garde-fou dans les deux sens : **pas de remplissage** (trop long pour ce que la question demande) et **pas de manque** (trop court pour couvrir les sous-questions réelles). Google le dit, et l'étude Ahrefs ne trouve presque aucun lien entre longueur et citation (§ 2).

### 7.2 Calcul par R2 (fonction pure `calculerFourchetteMots`)

1. **Mesure des pages qui se classent.** Pour la requête principale, R2 retient les pages lues (les 5 premières déjà prévues, jusqu'à 8 si moins de 3 sont mesurables) **dont le format observé est compatible avec le gabarit choisi**. Sont exclues : pages d'offre, forums, vidéos, pages d'accueil, pages d'Axion-IA, pages illisibles. Pour chacune, `mesurerMotsContenuPrincipal(html)` compte les mots du contenu principal (`<main>` ou `<article>`, sinon le plus grand bloc de texte), **sans** en-tête, pied de page, navigation, barres latérales, commentaires. Chaque mesure est enregistrée (URL, rang, mots, nombre de H2, format) dans le brief.
2. **Médiane M** des pages retenues, si **au moins 3** sont mesurables.
3. **Fourchette brute** : de 0,75 × M à 1,25 × M, arrondie à 50 mots.
4. **Plancher de couverture** : `60 + nombreDeH2Prevus × 110` mots (la réponse directe, puis pour chaque H2 sa réponse de 40-60 mots et au moins un paragraphe ou un bloc). Le minimum de la fourchette ne descend jamais sous ce plancher.
5. **Bornes du gabarit** (§ 10) : la fourchette est ramenée dans `[borneMin, borneMax]` du gabarit. Si `1,25 × M` dépasse la borne haute, on garde la borne haute et R2 note « les pages concurrentes sont plus longues : couvrir les questions, pas recopier la longueur ».
6. **Repli** : moins de 3 pages mesurables → fourchette **par défaut du gabarit** (§ 10), `methode = "repli-gabarit"`, signalée à la console. Jamais d'invention de mesure.
7. **Cohérence** : `min < max`, et `max − min ≥ 200` mots (sinon on élargit symétriquement jusqu'à 200, dans les bornes du gabarit).

La **longueur cible du plan 365** (colonne « longueur cible ») reste une indication de départ ; **la fourchette du brief la remplace**.

### 7.3 Ce qui est compté

Le **corps de l'article** : réponse directe sous le H1, sections, encadrés rédactionnels. **Ne sont pas comptés** : FAQ de fin (comptée à part), sources, carte auteur, appels à l'action, blocs normalisés (Journée IA), et **tout ce que rend le layout** (en-tête et pied de page du site).

### 7.4 Équilibre des sections (contre le remplissage local et le manque local)

- **L-1.** Chaque section H2 informative compte **au moins 90 mots** (réponse de 40-60 mots plus un développement), sauf dans Questions-réponses (au moins 50 mots par réponse).
- **L-2.** Aucune section ne dépasse **35 %** des mots du corps, sauf le Guide pilier (chapitres) et l'Actualité courte (3 sections).
- **L-3.** **Redites entre sections** : la similarité de Jaccard sur les 5-grammes de mots entre deux sections est **inférieure à 0,15** (fonctions `shingles` et `jaccardSimilarity` de `quality/plagiarism.ts`, réutilisées). Au-delà, c'est du remplissage par répétition.
- **L-4.** **Couverture** : chaque question du brief marquée `prioritaire` est couverte par un H2 ou par la FAQ (contrôle `coverage_missing`, existant en mode bloquant).

## 8. Contrat des rôles

### 8.1 R2 stratège de brief : ce qu'il doit produire

Champs **ajoutés** au brief (`equipe/brief.ts`, ajout additif : les champs existants ne changent pas ; les nouveaux sont **obligatoires pour la voie « chaîne »** et absents des briefs importés tant que R2 ne les a pas remplis) :

| Champ                 | Contenu                                                                                                                               | Validation                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `typeIntention`       | une des 5 intentions (§ 4.1)                                                                                                          | liste fermée ; `informationnelle` ou `comparative` pour entrer en rédaction (I-1)           |
| `besoin`              | sous-intention (§ 4.3)                                                                                                                | liste fermée                                                                                 |
| `pageCible`           | URL existante si `intention_hors_article`                                                                                             | obligatoire dans ce cas, `https://` absolue                                                  |
| `resultatsLus`        | 3 à 8 entrées : URL, rang, format observé, mots du contenu principal, nombre de H2                                                     | URL réellement lues (jamais devinées) ; `mots` peut être `null` (illisible)                 |
| `formatDominant`      | format d'au moins 3 pages sur 5, ou `mixte`                                                                                           | calculé par le code à partir de `resultatsLus`, pas déclaré par le modèle                   |
| `gabarit`             | un des 10 codes (§ 10)                                                                                                                | compatible (F-1) ; `ecartFormat` obligatoire si différent du format dominant (F-2)          |
| `contentType`         | type de contenu cohérent avec le gabarit (table `PLAN.md` gabarits § 3)                                                               | correspondance vérifiée par le code                                                          |
| `planHn`              | H1, réponse directe prévue (idée, pas le texte), H2 dans l'ordre avec `questionCouverte`, type de bloc attendu, H3 éventuels           | règles H-1 à H-14 vérifiées **sur le plan** (`verifierPlan`, étendu)                        |
| `questions`           | existant : question, origine, référence ; **ajout** `prioritaire` (booléen) et `reponseAttendue` (définition, étapes, tableau, chiffre, oui-non, liste) | toute question prioritaire placée en H2 ou en FAQ ; la FAQ n'existe que si au moins 4 vraies questions (W07) |
| `fourchetteMots`      | `{ min, max, methode: "mediane-serp" | "repli-gabarit", mediane, pagesRetenues }`                                                      | calculée par `calculerFourchetteMots` (§ 7.2) ; le modèle ne la choisit pas                 |

- **Le modèle propose, le code calcule** : `formatDominant`, `fourchetteMots` et la conformité du plan sont calculés ou vérifiés par des fonctions pures ; Opus ne fournit que les lectures (URL, formats observés, questions) et le plan.
- **Nouveaux verdicts de R2** : `intention_hors_article` (I-1). Les verdicts `pas_d_angle` et `pas_de_matiere` sont inchangés.
- **Le brief est figé** avant R4 : toute réécriture ciblée garde le même brief (sinon on ne mesure plus rien).

### 8.2 R4 rédacteur : ce qu'il doit respecter

- Suivre **le plan Hn du brief dans l'ordre**, sans ajouter ni retirer de H2 (un H2 manquant ou ajouté = renvoi par R7).
- Ne jamais écrire de `<h1>` dans le corps.
- Sous chaque H2 informatif, commencer par `<p data-aeo="answer">` de 40 à 60 mots (R-2, R-3).
- Produire le **bloc attendu** par la question (`reponseAttendue`) : tableau réel pour un comparatif (`<table>` avec `<th>`), liste numérotée ou H2 « Étape n : … » pour un guide, définition « X est … » pour une définition.
- Viser **le milieu de la fourchette** ; écrire moins si la question est couverte. La consigne de prompt « la longueur est déterminante pour le rang » (`blog-from-title.ts`, cause 3 du § 1.2 de la chaîne) est **supprimée** (C7).
- Les consignes de structure sont injectées dans le prompt **depuis le brief**, pas recopiées en dur : une seule source.

### 8.3 R5 expert critique

Ses questions (5) « y a-t-il du remplissage ? » et (6) « qu'est-ce qui manque pour décider ? » reçoivent en entrée les mesures de § 7.4 (sections trop longues, redites, questions non couvertes) : la critique s'appuie sur des chiffres, pas sur une impression. Aucun changement de sa grille ni de son modèle.

### 8.4 R7 éditeur : ce qu'il doit contrôler et corriger

- Appeler `verifierStructureArticle` (§ 11.1) **avant et après** sa passe. Il corrige la **forme** : longueur des titres, titres génériques, pronoms en tête de réponse, balisage `data-aeo`, faux titres, niveau des titres.
- Il **ne déplace aucun chiffre** (comparaison automatique avant/après, existante dans la conception) et **ne réécrit pas** une réponse directe au point d'en changer le sens.
- Ce qu'il ne peut pas corriger par la forme (section trop courte, question non couverte, longueur hors fourchette de plus de 10 %) **retourne à R4** en correction localisée (section, règle, attendu), dans le compteur unique de 2 réécritures.

## 9. Nouveaux critères de la porte : B18 à B23

Les critères sont **déterministes** (aucun appel de modèle), donc peu coûteux et reproductibles. Ils lisent le **brief figé** (intention, gabarit, plan, fourchette) passé à `evaluerPorte` dans le contexte (déjà prévu : la porte reçoit le brief, § 8 de la chaîne). **Brief absent** (contenu hors chaîne) : B18, B19 et B20 utilisent les valeurs par défaut du gabarit ; B21 à B23 sont « non évalués », ce qui **bloque** (échec fermé), sauf en **mode ombre** (Q7) où ils sont seulement journalisés.

| Id      | Critère                                      | Mesure                                                                                                                                                                                                                                                                                                                                       | Seuil de départ [à calibrer en Q9]                                         | Classe                         | Code de raison                 |
| ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| **B18** | **Hiérarchie et libellé des titres**         | Règles H-1 à H-14 sur le corps et le H1 : 0 `<h1>` dans le corps, H1 conforme (H-2, H-3, H-4), nombre de H2 dans les bornes du gabarit, aucun saut, aucun H3 isolé, aucun titre générique, longueurs de titres, pas de doublon, bourrage du mot-clé                                                                                       | 0 écart                                                                    | Corrigeable                    | `structure_titres`             |
| **B19** | **Réponse directe sous chaque H2**           | Pour chaque H2 informatif : premier élément = `<p data-aeo="answer">`, 40 à 60 mots, autonome (R-3), non caché (R-5)                                                                                                                                                                                                                       | 100 % des H2 informatifs                                                   | Corrigeable                    | `style`                        |
| **B20** | **Longueur adaptée et sections équilibrées** | Mots du corps (§ 7.3) entre `0,9 × min` et `1,1 × max` de la fourchette du brief ; L-1, L-2, L-3                                                                                                                                                                                                                                            | dans la fourchette ± 10 % ; 0 écart sur L-1 à L-3                          | Corrigeable                    | `longueur`                     |
| **B21** | **Format conforme à l'intention et au gabarit** | Gabarit compatible avec l'intention (F-1) ; **élément obligatoire du gabarit présent** (§ 10, colonne « élément obligatoire ») ; part de H2 en question du gabarit (H-10, mesurée ici pour le seul cas Questions-réponses = 100 % ; ailleurs W01)                                                                                         | conforme                                                                   | Corrigeable                    | `format_intention`             |
| **B22** | **Intention éditoriale admissible**          | `typeIntention` ∈ {`informationnelle`, `comparative`} ; sinon une `pageCible` est connue et l'article n'aurait pas dû être écrit                                                                                                                                                                                                         | admissible                                                                 | Dérogeable (motif écrit, Will) | `intention_hors_article`       |
| **B23** | **Questions traçables et couvertes**         | Toute question prioritaire du brief couverte (H2 ou FAQ, `coverage_missing`) ; tout H2 en question et toute question de FAQ présents dans le brief avec origine (`question_hors_brief`) ; aucune question à la fois en H2 et en FAQ (`coverage_duplicate`)                                                                                  | 100 %                                                                      | Corrigeable                    | `questions_non_couvertes`      |

**Ajustements des critères existants (sans changer la formule de note)** :

- **B08** (réponse directe en tête) : inchangé.
- **B11** (complétude) : le plancher unique « ≥ 850 mots (articles) » et « 3 à 8 H2 » est **remplacé par les bornes du gabarit** (§ 10), via B18 et B20. B11 garde le reste (`data-quality-gate`, page non mince à 350 mots, H1 unique). **Décision D-A1 de Will** (§ 14), car la porte prévoyait que « le seuil par intention est décidé avec la porte, pas contourné ».
- **W01** (H2 en question) : seuil **par gabarit** (H-10) au lieu de 30 % ; **6 points inchangés**.
- **W02** (passages autonomes) : inchangé ; B19 le rend presque toujours satisfait.
- **Note** : `note = 100 − P_avertissements − P_preuves − P_proximité − P_intention` **reste identique** ; le test qui verrouille la somme des maxima (86) ne change pas. Les nouveaux critères sont bloquants, ils n'ajoutent pas de points.
- **Classement du § 5 de la porte** : B18, B19, B20, B21, B23 rejoignent la ligne **Corrigeable** ; B22 la ligne **Dérogeable**. Le test « la colonne dérogation du tableau 4.1 concorde avec le classement » couvre les nouveaux critères.
- **Codes de raison** : `structure_titres`, `longueur`, `format_intention`, `intention_hors_article`, `questions_non_couvertes` **s'ajoutent** à la liste fermée de C4 (B19 reste sous `style`, comme B08). Le détail garde le critère exact (`B18`…) et la règle (`H-7`, `L-3`…) en échec, avec la preuve (titre fautif, nombre de mots mesuré, sections en cause).
- **Version de la porte** : l'ajout des critères crée une nouvelle `versionPorte` ; les verdicts anciens restent lisibles.
- **Taux de refus** : sur les contenus de la chaîne, B18 à B23 devraient être **presque toujours verts**, puisque R2, R4 et R7 appellent la même fonction. Un taux de refus élevé sur l'un d'eux est une **alarme sur le rôle amont** (R2 si B20, B21, B22 ou B23 ; R4 ou R7 si B18 ou B19), affichée comme telle.

## 10. Adaptation aux 10 gabarits

Rappel : le gabarit fixe la **mise en page de l'article** ; l'**en-tête et le pied de page du site** sont rendus par le layout et n'entrent dans aucune règle. Les bornes de mots sont des **hypothèses de départ** tirées du plan 365 (longueurs cibles par modèle : définition 800-1 000, FAQ 800-1 200, actualité 900-1 100, analyse 1 100-1 400, guide 1 200-1 800, comparatif 1 400-1 800, sélection 1 300-1 600, chiffres 1 100-1 400, guide pilier 2 000-2 300) et élargies pour laisser la mesure des pages concurrentes décider ; à calibrer en Q9.

| Gabarit (code)                  | Intentions et besoins admis                         | H2 informatifs | Part de H2 en question (H-10) | Bornes de mots (min-max) | Fourchette de repli | Élément obligatoire (B21)                                                                                                     |
| ------------------------------- | --------------------------------------------------- | -------------- | ----------------------------- | ------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Analyse (`analyse`, G1)         | info : comprendre ; comparative : décider           | 4 à 8          | ≥ 50 %                        | 800 - 2 200              | 1 100 - 1 500       | au moins un bloc structuré (liste ou tableau) **ou** un chiffre sourcé encadré                                                |
| Guide pratique (`guide`, G2)    | info : faire ; comparative : par où commencer       | 3 à 10         | 0 % exigé                     | 800 - 2 200              | 1 200 - 1 800       | étapes : au moins 3 H2 « Étape n : verbe … » **ou** une liste `<ol>` d'au moins 3 étapes, lisibles par `parseStepsFromBody`  |
| Comparatif (`comparatif`, G3)   | comparative : comparer                              | 4 à 8          | ≥ 30 %                        | 1 000 - 2 400            | 1 400 - 1 800       | un vrai `<table>` avec `<th>`, au moins 2 options et 4 critères ; phrase « ça dépend de… » ; aucun gagnant ni note           |
| Sélection (`selection`, G4)     | comparative : choisir parmi N                       | 5 à 13 (dont 3 à 10 options) | 0 % exigé        | 1 000 - 2 400            | 1 300 - 1 700       | 3 à 10 H2 d'options, chacun avec « pour qui », « points forts », « limites » ; critères de sélection annoncés avant les options |
| Étude de cas (`cas`, G5)        | info : illustrer                                    | 4 à 7          | ≥ 30 %                        | 700 - 1 800              | 900 - 1 400         | H2 Contexte / Avant / Pendant / Après / Ce que l'équipe a appris ; étiquette « exemple type, pas un client » ; **aucun chiffre de résultat** |
| Définition (`definition`, G6)   | info : savoir                                       | 3 à 6          | ≥ 30 %                        | 500 - 1 300              | 700 - 1 000         | réponse directe de la forme « [terme] est … » (balisée `<dfn>` par le gabarit) ; H2 « À ne pas confondre avec » ou équivalent |
| Questions-réponses (`faq`, G7)  | info : plusieurs questions courtes                  | 6 à 15 questions | 100 %                       | 600 - 1 800              | 800 - 1 200         | chaque question en H2 (au-delà de 10 questions : H2 = thèmes, H3 = questions, 2 à 5 thèmes) ; 50 à 200 mots par réponse       |
| Chiffres (`chiffres`, G8)       | info : mesurer, situer                              | 3 à 7          | 0 % exigé                     | 700 - 1 700              | 1 000 - 1 400       | **relevé structuré** rattaché (`charger-releve.ts`) ; H2 « Comment lire ces chiffres » ; chaque chiffre daté et sourcé        |
| Actualité (`actualite`, A1)     | info : savoir ce qui change                         | 3 à 5          | ≥ 50 %                        | 400 - 1 300              | 700 - 1 100         | H2 « Ce qui change », « Pour qui », « Que faire maintenant » ; source d'origine avec date ; « Ce que l'on ne sait pas encore » si incertain |
| Guide pilier (`guide-pilier`, GU1) | info : panorama ; comparative : feuille de route | 5 à 9 chapitres | ≥ 50 %                       | 1 800 - 4 500            | 2 000 - 2 800       | chapitres H2 avec au moins 2 H3 chacun ; H4 admis pour les étapes ; feuille de route finale ; ids `step-N` conservés          |

### 10.1 Notes par gabarit

- **Analyse (G1)** : gabarit de **repli** de tous les autres tant qu'ils ne sont pas livrés. Un contenu de la chaîne destiné à un gabarit non livré est **vérifié selon les règles de son gabarit cible** (brief) et rendu en Analyse : la structure reste juste, seule la mise en page attend. Le schéma « constat → causes → leviers » n'est rendu que s'il vient du corps balisé (`BALISAGE-ENCADRES.md`).
- **Guide (G2)** : `parseStepsFromBody` lit des motifs textuels « Étape N : » ou « N. Titre ». **À vérifier dans G2** : qu'il reconnaît des H2 « Étape 1 : … » dans du HTML (sinon, adapter l'extraction au HTML, pas l'écriture). Au-delà de 8 étapes : H2 = phases, H3 = étapes. `calculator_roi` : formule et tableau de scénarios, **aucun montant de prix**.
- **Comparatif (G3)** : le premier `<table>` du corps est **remonté en « En bref »** par le gabarit : R4 place donc le tableau récapitulatif **en premier tableau**. La réponse sous le H1 dit « ça dépend de… » et nomme les 2 ou 3 critères qui tranchent.
- **Sélection (G4)** : les numéros des options sont posés par **compteur CSS** ; R4 n'écrit donc **pas** « 1. » dans le texte des H2 d'options (sinon double numérotation pour les lecteurs d'écran, test de G4). Les H2 de cadrage (« Comment nous avons choisi », « Par où commencer ») sont hors compteur.
- **Étude de cas (G5)** : le plan 365 n'en contient **aucune** (les études fictives ont été converties en guides). Le gabarit n'est admis que pour un **exemple type explicitement étiqueté** ou un cas réel autorisé par écrit ; jamais de résultat chiffré mis en valeur (règles de marque, `G5`).
- **Définition (G6)** : sommaire masqué sous 4 entrées : avec 3 H2, pas de sommaire, c'est voulu. La réponse sous le H1 commence par le terme. Les « termes liés » viennent du glossaire existant, pas du texte.
- **Questions-réponses (G7)** : la FAQ **est** le corps ; les questions sont des H2 (ou H3 sous des thèmes), pour que le sommaire et la hiérarchie restent justes. **Chaque question vient du brief avec son origine** : pas de FAQ inventée (cause 4 de la chaîne). Les cartes `<details>` gardent la réponse dans le HTML ; la première est ouverte (R-5). Une seule `FAQPage` émise (G7, J1).
- **Chiffres (G8)** : **sans relevé structuré, pas de gabarit Chiffres** : le brief doit alors choisir Analyse. Les 17 sujets « chiffres » du plan 365 sont à vérifier un par un en C6 (la clé de jointure du relevé est à établir dans G8).
- **Actualité (A1)** : `/actualites/[slug]` n'est servi aujourd'hui que pour `blog_from_rss`. Les 11 sujets « actualité » du plan 365 n'ont **pas encore de type de contenu qui y mène** : point ouvert (§ 13, D-A4). En attendant, ils sont rédigés en Analyse avec les H2 de l'actualité.
- **Guide pilier (GU1)** : seul gabarit où H4 est admis. Le type `guide_pilier` est rangé dans la famille `guide` de la table des gabarits du blog (`PLAN.md` § 3) alors que GU1 sert `/guides/[slug]` : la route réelle d'un guide pilier produit par la chaîne est **à confirmer** avant C6 (D-A4).

## 11. Où chaque règle s'insère dans le découpage existant

### 11.1 Module commun

Un **module pur** `src/server/content-gen/structure/` (nom indicatif), sans base ni réseau :

- `typesIntention`, `GABARITS_REGLES` (le tableau du § 10, **source unique**, lue aussi par la console), `H2_STRUCTURELS`, `TITRES_GENERIQUES` ;
- `calculerFourchetteMots(mesures, gabarit, nombreH2)` ; `mesurerMotsContenuPrincipal(html)` ; `formatDominant(resultats)` ;
- `verifierStructureArticle(html, brief, gabarit)` → liste d'écarts `{ regle: "H-7", critere: "B18", section, preuve }`.

Il **réutilise** `outline-validator.ts` (codes existants, mode bloquant **paramétré par gabarit** au lieu de 5 à 8 H2 en dur), `passages-citables.ts` (`compterMots`, `commenceParUnRenvoi`, `texteSansBalises`), `normaliserTitre`, et `shingles` / `jaccardSimilarity` de `plagiarism.ts`. **Il ne duplique rien.**

### 11.2 Table d'insertion

| Règle(s)                                                        | PR existante                       | Ce qui s'ajoute à cette PR                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Champs du brief (§ 8.1)                                         | **C3** (tables, extension de `brief.ts`) | champs additifs du brief, tous optionnels au niveau du schéma partagé ; schéma « brief de chaîne » qui les rend obligatoires ; `ContenuBrief` stocke le JSON (aucune colonne d'énumération) |
| Codes de raison nouveaux (§ 9)                                  | **C4** (liste fermée)              | `structure_titres`, `longueur`, `format_intention`, `intention_hors_article`, `questions_non_couvertes` ; correspondance `B18`…`B23` → code                                                                                                         |
| Module commun (§ 11.1)                                          | **C6** (première PR qui en a besoin) | le module pur et ses tests ; `outline-validator` paramétré par gabarit (le comportement des appelants hors chaîne **ne change pas**)                                                                                                                      |
| Intention, admissibilité, format, gabarit, plan Hn, fourchette (§ 4, § 5, § 7, § 8.1) | **C6** (R2 stratège de brief)      | lecture des résultats avec format observé et mesure des mots ; `calculerFourchetteMots` ; `verifierPlan` étendu (H-1 à H-14 sur le plan) ; verdict `intention_hors_article` ; import du **CSV du plan 365** (colonnes modèle, intention, longueur) en plus du tableau des 40 |
| Contrat de rédaction (§ 6, § 8.2)                               | **C7** (R4 rédacteur)              | consignes de structure tirées du brief ; balisage `data-aeo="answer"` ; suppression de « la longueur est déterminante pour le rang » ; contrôle de sortie par `verifierStructureArticle`                                                                 |
| Mesures pour la critique (§ 8.3)                                | **C8** (R5)                        | passage des mesures L-1 à L-4 en entrée ; aucune autre modification                                                                                                                                                                                       |
| Contrôle et correction de forme (§ 8.4) ; ancres en mise à jour (H-16) | **C9** (R6 et R7)                  | `verifierStructureArticle` avant/après ; renvoi à R4 des écarts de fond ; vérification de `slugifyHeading` avec `id` existant                                                                                                                             |
| B18 à B21, B23 (déterministes) ; B11 et W01 par gabarit         | **Q2** (squelette de la porte)     | ajout au registre `CRITERES` avec classe, seuil, fonction ; B11 sans plancher unique ; tests de concordance. **Si Q2 est déjà fusionnée** : PR **Q2c** dédiée, même contenu                                                                               |
| B22 ; type d'intention au registre                              | **Q5a** (migration) et **Q5** (registre `ContentIntention`) | colonne **texte nullable** `typeIntention` (et `pageCible` nullable) dans `ContentIntention` ; la colonne existante « intention » mélange thème et intention (financement, réglementation…) : elle devient le **thème**, sans renommage de colonne en base. Si Q5a est déjà livrée : migration additive séparée **Q5b**, seule |
| Mode ombre                                                      | **Q7**                             | B18 à B23 journalisés comme les autres, sans blocage                                                                                                                                                                                                       |
| Rendu : un H1, réponses visibles, numérotation, tableau remonté | **G1 à G8, A1, GU1** (+ S3)        | aucun recalcul de structure dans le gabarit ; tests : un seul `h1` rendu par gabarit (interrupteur allumé et éteint) ; `p[data-aeo="answer"]` jamais dans un `<details>` fermé (sauf G7, cartes après la première) ; compteur CSS sans doublon (G4) ; premier tableau remonté (G3) |
| Données structurées                                             | **J1**                             | rien de neuf : la règle « tout champ JSON-LD a son pendant visible » couvre déjà la FAQ et `HowTo`                                                                                                                                                       |
| Console                                                         | **C14** et **Q8**                  | colonne « intention / gabarit / fourchette / mots mesurés » dans l'entonnoir ; raisons B18 à B23 dans le classement des refus ; `null` affiché « indisponible »                                                                                          |

**Ordre** : C3 → C4 → C6 (module + R2) → C7 → C8 → C9, puis Q2 (ou Q2c) et Q5a/Q5 (ou Q5b), comme prévu par les deux découpages. Les gabarits G1 à G8 peuvent avancer en parallèle : leurs tests ne dépendent que du **contrat de balisage** (§ 6, § 10), écrit ici. Aucune PR ne change un comportement public avant son drapeau ; la chaîne reste éteinte par défaut.

## 12. Tests à écrire

**Module commun (C6)**

1. `calculerFourchetteMots` : médiane sur 3, 5 et 8 pages ; moins de 3 pages → repli du gabarit avec `methode = "repli-gabarit"` ; plancher de couverture qui relève le minimum ; plafond du gabarit qui coupe ; écart minimal de 200 mots ; aucune valeur inventée quand toutes les mesures sont `null`.
2. `mesurerMotsContenuPrincipal` : page avec `<main>`, avec `<article>`, sans les deux ; en-tête, pied de page, navigation, barre latérale, commentaires **exclus** (fixtures HTML).
3. `formatDominant` : 3 sur 5, 2-2-1 → `mixte`.
4. `verifierStructureArticle`, **un cas par règle** H-1 à H-15, R-2, R-3, R-5, L-1 à L-4, avec une fixture qui passe et une qui échoue, et la **règle citée** dans l'écart.
5. `GABARITS_REGLES` couvre **exactement** les 10 codes de gabarit (`Record` exhaustif, comme la table `ContentType → gabarit`).
6. `TITRES_GENERIQUES` et `H2_STRUCTURELS` : normalisation (casse, accents, deux-points final).

**Brief et R2 (C3, C6)**

7. Brief de chaîne sans `typeIntention`, `gabarit`, `planHn` ou `fourchetteMots` → refusé ; brief importé (40 ou 365) sans ces champs → accepté (compatibilité).
8. `transactionnelle`, `locale`, `navigation` → verdict `intention_hors_article` avec `pageCible` ; sans `pageCible` → signalement, pas d'article.
9. Gabarit incompatible avec l'intention → refusé ; gabarit différent du format dominant sans `ecartFormat` → refusé.
10. Import du CSV du plan 365 : 365 lignes, `décision` → `comparative`, modèle → gabarit, `chiffres` sans relevé signalé, aucune question sans origine.

**Rédaction et édition (C7, C9)**

11. Corps produit avec un `<h1>` → écart B18 ; H2 ajouté hors plan → renvoi à R4.
12. R7 : avant/après identiques sur les chiffres ; un écart de fond (section trop courte) n'est pas « corrigé » par R7 mais renvoyé.
13. Mise à jour : un H2 renommé garde son `id` d'origine (ou est refusé, selon le résultat de la vérification H-16).

**Porte (Q2 ou Q2c, Q5)**

14. Registre `CRITERES` : B18 à B23 présents, classe conforme au § 9, libellé non vide ; test de concordance « colonne dérogation = classement » étendu.
15. La **formule de note** est inchangée (somme des maxima = 86) ; W01 lit le seuil du gabarit.
16. Brief absent : B21 à B23 « non évalués » → `bloque` en mode réel, journalisés seulement en mode ombre.
17. Correspondance `B18`…`B23` → codes de raison ; aucun ne tombe dans `autre`.
18. Non-régression de marque : un texte contenant « dans vos locaux, partout en France » n'est refusé par **aucun** des nouveaux critères.

**Gabarits (G1 à G8, A1, GU1)**

19. Un seul `h1` dans la page rendue, interrupteur `BLOG_GABARITS_V2` allumé **et** éteint, pour une fixture de chaque gabarit ; aucun `h1` dans l'en-tête ou le pied de page du site ne vient d'un gabarit.
20. `p[data-aeo="answer"]` conservé au rendu (le nettoyeur garde l'attribut) et jamais dans un `<details>` fermé hors G7.
21. G2 : `parseStepsFromBody` reconnaît des H2 « Étape n : … » dans le HTML produit par R4 (fixture réelle de la chaîne).
22. G3 : le tableau récapitulatif écrit en premier par R4 est remonté une seule fois ; G4 : un H2 d'option sans « 1. » écrit ne produit pas de double numéro.
23. Contrat de bout en bout : une fixture de corps **conforme** pour chaque gabarit passe `verifierStructureArticle` **et** se rend sans perte (tous les H2 du corps présents dans le sommaire).

## 13. Contradictions relevées dans les documents existants

| #  | Contradiction                                                                                                                                                                                                         | Arbitrage proposé                                                                                                                                                         |
| -- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | **B11** exige ≥ 850 mots pour un article ; le **plan 365** prévoit des définitions à 800-1 000 mots et des FAQ à 800-1 200 mots (21 et 52 sujets), donc certaines sous 850. Google : aucun nombre minimum.            | Bornes par gabarit (§ 10) via B20 ; B11 garde « page mince < 350 mots ». **D-A1.**                                                                                        |
| 2  | `equipe/plan.ts` (mode bloquant) impose **5 à 8 H2** ; **B11** dit **3 à 8** ; le gabarit **Questions-réponses** a 6 à 15 questions ; la **Sélection** jusqu'à 10 options.                                           | Bornes par gabarit (§ 10) ; `outline-validator` paramétré ; les appelants hors chaîne gardent leur comportement.                                                          |
| 3  | `brief.ts` a 3 intentions (`information`, `comparaison`, `decision`) ; Will en demande 5 ; `ContentIntention` (porte § 7.1) mêle intention et thème (« financement, réglementation »).                                | Champ additif `typeIntention` (5 valeurs), `decision` → `comparative` par défaut ; la colonne existante de `ContentIntention` devient le thème. **D-A2.**                 |
| 4  | Les 11 sujets « actualité » et les 13 « guide pilier » du plan 365 n'ont pas de chemin de contenu établi vers `/actualites` et `/guides` (le premier n'est servi que pour `blog_from_rss`).                         | Rédigés et rendus en Analyse (ou Guide) en attendant ; route à trancher. **D-A4.**                                                                                        |
| 5  | La porte écrit « titres en questions » (W01 30 %) ; Will veut des H2 « souvent » en question ; mais un guide en étapes ou une sélection d'options en question serait artificiel.                                     | Part **par gabarit** (H-10), points de W01 inchangés.                                                                                                                     |

## 14. Décisions demandées à Will

| Id   | Question                                                                                                                  | Ma recommandation par défaut, avec un exemple                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-A1 | Remplacer le plancher unique de 850 mots de B11 par des bornes par gabarit ?                                              | **Oui.** Exemple : une définition de « RAG » complète en 750 mots, quand les pages qui se classent en font 700, passe ; une analyse de 750 mots sur « faut-il former ses salariés à l'IA ? » ne passe pas (borne basse 800 et fourchette mesurée plus haute).                       |
| D-A2 | Cinq intentions, et les sujets « décision » du plan 365 rangés en « comparative » ?                                       | **Oui.** Exemple : « Avec cinq salariés, l'IA vaut-elle le coup ? » est une évaluation, pas un achat : elle reste un article. « Diagnostic IA PME » est une demande d'action : elle va vers la page contact, sans article.                                                           |
| D-A3 | Les requêtes transactionnelles, locales et de navigation ne donnent jamais d'article ?                                    | **Oui.** Exemple : « formation IA entreprise Lyon » n'a pas d'article ; elle relève des pages villes honnêtes de S6. Si aucune page ne la sert, vous recevez un signalement, pas un article de remplacement.                                                                       |
| D-A4 | Où vivent les sujets « actualité » et « guide pilier » du plan 365 produits par la chaîne ?                               | **Les garder sur `/blog` (Analyse ou Guide) tant qu'un type de contenu ne mène pas proprement à `/actualites` et `/guides`.** Exemple : le n° 1 (E01, guide pilier) est rendu en Guide, avec sa structure en chapitres vérifiée, jusqu'à la décision.                               |
| D-A5 | Les seuils de ce document (40-60 mots, 70 caractères, ± 10 %, 0,15 de redite) sont des hypothèses : les calibrer en phase d'observation (Q9) avant de bloquer ? | **Oui.** Exemple : si, sur 30 contenus relus, vous validez des articles que B20 aurait refusés pour 12 % de dépassement, la tolérance passe à ± 15 % par une nouvelle version de la porte, jamais en silence.                                                       |

## 15. Critique indépendante

_Section remplie après la relecture par un sous-agent Opus indépendant (voir l'historique ci-dessous)._
