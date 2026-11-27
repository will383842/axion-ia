# Conception : chaîne éditoriale IA qui crée la qualité à la source

> Phase de conception, 27/11/2026. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**
> Origine : constat de Will (27/11/2026). Une porte qualité seule bloquerait presque tout si le contenu de départ est faible. Il faut d'abord **améliorer la génération**, avec une équipe IA, et un système qui **s'améliore avec le temps**. Pas de quota : le but est la qualité ; on n'accélère que si Google et les IA suivent (indexation, affichages, clics, citations IA).
> Documents liés : `AUDIT.md`, `PLAN.md`, `DECOUPAGE.md` (pilotage SEO/GEO). La conception de la porte qualité (`CONCEPTION-PORTE-QUALITE.md`, branche `docs/porte-qualite-contenus`) est publiée ; ce document est **aligné sur elle** (noms de critères `B01`…`B17`, verdicts, enregistrement des refus : § 8). La porte est le **dernier filet**, pas l'outil principal.

## 0. En bref

1. Le générateur par défaut est **un seul passage (plan puis expansion) par gpt-4o, sans fait sourcé, sans expert, sans relecture par un modèle** pour tout article noté 75 ou plus. La publication automatique est active par défaut. Une vraie équipe Claude existe déjà (`equipe/`), mais **elle est éteinte par défaut (état réel en production non vérifié)** et couvre la rédaction, pas la recherche de besoins ni l'expert métier.
2. La chaîne cible a **huit rôles** : chercheur de besoins, stratège de brief, collecteur de faits, rédacteur, expert métier critique, vérificateur de faits, éditeur, porte qualité. Un contenu qui échoue repart en **réécriture ciblée (2 essais au plus)**, puis est **abandonné** : jamais publié faible.
3. Opus là où la qualité se joue (brief, rédaction, expert), Sonnet ailleurs, jamais Fable. **Coût estimé, à mesurer (C1) : 1,3 à 1,6 $ pour un passage complet, environ 3,5 à 6 $ par contenu publié** au départ (taux de réussite supposé 35 à 50 %, hypothèse). Avec 200 $/mois, **10 à 30 contenus publiés par mois au départ**, bornés d'abord par la relecture humaine, pas par le budget (§ 6, § 11).
4. La boucle d'amélioration : chaque refus et sa raison sont enregistrés, chaque contenu publié est suivi, et **chaque semaine** un analyste propose des changements de briefs, de prompts et de sujets, **appliqués seulement après relecture de Will** et visibles dans la console.
5. Le rythme **découle de ce qui passe la qualité**. **Aucun quota**, aucun objectif de volume. Il y a un plafond de dépense et des limites hautes de sécurité, jamais une cible. On n'accélère que si Google et les IA suivent, sur décision de Will.
6. Toute la chaîne est **éteinte par défaut**, et chaque PR est petite (§ 12). On peut commencer tout de suite par des PR sans migration (§ 12, « Tout de suite »), dont un audit du corpus déjà publié, qui est le premier risque Google.

## 1. État actuel du générateur et pourquoi ses contenus seraient faibles

Source : lecture du code au 27/11/2026 (`src/server/content-gen`, `src/server/queue/workers/content-gen-worker.ts`). Les références `fichier:ligne` sont celles de la lecture ; elles dérivent avec le code.

### 1.1 Le pipeline réel

| Étape               | Ce qui se passe                                                                                                                                  | Où                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Sujet               | Rotation sur 747 mots-clés seedés (`lastUsedAt ASC`) et gabarits par ville. Plafond par défaut 20 articles par jour.                             | `keyword-selector.ts`, `scheduler/anti-burst.ts:119` |
| Avant l'IA          | Base de connaissances prête, dédoublonnage, verrou Redis 30 min, gabarit de prompt en base.                                                      | worker `:448-677`                                    |
| Équipe (si allumée) | Stratège, gardien, vérificateur phase A.                                                                                                         | `equipe/orchestration.ts:204-273`                    |
| Génération          | Appel 1 PLAN (métas, FAQ ×8, plan en 8 sections), appel 2 EXPANSION en deux tranches. Boucle interne d'au plus 2 itérations, seuil 75, 850 mots. | `generators/blog-from-title.ts:221-390`              |
| Retouches           | Réparation de la réponse directe, « plancher d'intention » qui injecte sources et appel à l'action.                                              | worker `:1056-1126`                                  |
| Contrôles           | Plagiat, intention, plan, doctrine, barrières, fidélité, fact-check. Ils produisent `blockingFail`.                                              | worker `:1270-1749`                                  |
| Décision            | Publication automatique si pas de `blockingFail` et score ≥ 75 (**défaut : vrai**).                                                              | worker `:1865-1939`                                  |
| Publication         | L'article est **forcé en `tier_1_indexable`**, puis IndexNow.                                                                                    | `content-publish-worker.ts`                          |
| Après               | Fact-check Perplexity qui note `factCheckScore` sans rien dépublier.                                                                             | `content-fact-check-worker.ts`                       |

Modèles : écriture et juge par défaut **gpt-4o** (`provider-router.ts`, `llm-judge.ts:45`). La voie Claude (`blog-claude.ts`) n'est prise que si les drapeaux `CONTENT_EQUIPE_EDITORIALE` et `CONTENT_GEN_BLOG_CLAUDE` sont allumés ; elle emploie `claude-sonnet-5-5` pour écrire et `claude-opus-5-5` pour relire. Les valeurs réelles des drapeaux en production n'ont pas pu être vérifiées (seul `.env.example` est lisible : vide).

### 1.2 Pourquoi les contenus seraient faibles : huit causes, avec preuves

1. **Un seul passage, sans relecture par un modèle.** Le score qui décide de la publication est heuristique : (SEO + lisibilité) / 2 (`quality/article-quality.ts:80`). Le juge LLM n'est appelé que pour les articles sous 75 (`content-quality-improver-worker.ts:369`). Un article à 75 ou plus sans blocage dur **part sans qu'aucun modèle l'ait relu**, quand l'équipe est éteinte.
2. **Aucun fait sourcé.** `kb/chiffres-verifies.ts:25` : `CHIFFRES_VERIFIES = []`. Aucun générateur ne fait de recherche web ; la base de connaissances n'apporte que des extraits de 8 fiches internes. Sans chiffre ni source, un article ne peut produire que des généralités.
3. **Même gabarit pour tous.** Plan imposé en 8 sections identiques (`blog-from-title.ts:108`), « l'angle est TOUJOURS ce qu'Axion-IA fait concrètement », mot-clé « au moins 3 fois », longueur « déterminante pour le rang ». La parade existante (8 angles d'entrée tirés au hasard, dédoublonnage de plan SimHash) traite le symptôme d'un gabarit qui produit des structures quasi identiques.
4. **Contenu inventé encouragé.** Le prompt demande « 8 questions People-Also-Ask réelles » sans fournir aucune donnée PAA : le modèle les invente (`blog-from-title.ts`, `blog-from-keywords.ts:89`, `blog-article.ts:82`). Les FAQ ne reflètent donc aucune demande réelle.
5. **Pas d'expert métier.** L'avis est signé « Point de vue d'Axion-IA » (`brand/expert-bank.ts:14-17`) ; la persona est une « plume IA ». Aucune donnée de terrain, et la doctrine interdit à juste titre cas client et témoignage inventés. Résultat : rien d'unique à dire.
6. **Sujets choisis sans demande mesurée.** Rotation, pas de questions issues de la Search Console (le stratège est appelé sans `questionsConnues`, worker `:824-832`), pas de recherches associées, pas d'usage des demandes reçues. Le détecteur d'opportunités ne fait qu'alerter sur Telegram sans créer de sujet. Le site est jeune : environ 13 clics sur la période relevée (`AUDIT.md`).
7. **Juge partial.** gpt-4o juge gpt-4o (`llm-judge.ts:11-15`) ; le juge n'a pas d'accès web et note pourtant « exactitude des faits ».
8. **Aucun retour des résultats.** Pas de lien article → rendez-vous, pas de mesure de citation IA, pas d'historique Search Console (`AUDIT.md`). Le générateur ne peut donc rien apprendre de ses succès.

### 1.3 Ce qui est déjà là et se réutilise

- `equipe/` : orchestration avec journal par rôle, coût, plafond de 3 $ par job, au plus 2 renvois, issues `publier / a_relire / ecarte / mise_a_jour / relecture_humaine` ; rôles `strategie`, `gardien`, `plan`, `redaction`, `maillage`, `edition-seo`, `conformite`, `redacteur-en-chef` (grille Q1-Q13), `charge-de-liens`, `suivi-publication`.
- `fact-check/verificateur-deux-phases.ts` : dossier de preuves avec extrait exact, puis vérification finale ; outils `web_search_20260318` et `web_fetch_20260318`, plafonds 4 et 6 recherches ; « en cas de doute, a_retirer ».
- `providers/blog-claude.ts` : réservation du coût maximal avant l'appel, plafonds jour et mois réglables, réserve, alerte à 80 %, suspension après 3 refus de crédit ; bornes dures 20 $/jour et 300 $/mois, valeurs posées 10 $ et 200 $.
- Console : `content-gen/jobs/[id]` avec `PanneauEquipe.tsx`, `review-queue`, `costs`, `settings/providers`, `settings/quality-loop`, `charge-liens`.
- Tables : `ContentGenJob` (`outputJsonRaw.equipe`), `GenerationLog`, `ReviewQueue`, `CostLedger`, `ProviderConfig`, `ContentGenAuditLog`, `ContentTemplate`, `CoverageCampaign`, `KeywordTracking`, `ContentMetric`.
- Défauts connus de l'audit (`AUDIT.md`) : type `blog_edition_seo`, mise à jour réelle sans ligne `content_gen_jobs` : **déjà corrigés par la P0 du pilotage (#2406, `providers/job-porteur.ts`)**. Reste : `dateModified` qui bouge sur une simple méta, mode mise à jour sans retour arrière (traités par le pilotage). `equipe/brief.ts` définit déjà un schéma de brief (questions avec origine, intentions `information` / `comparaison` / `decision`) : **il est étendu, pas dupliqué**.

**Conclusion honnête.** Il ne manque pas une porte : il manque la matière. Les rôles de rédaction existent mais sont éteints ; les rôles qui créent la valeur (vrai besoin, faits datés, expert exigeant, retour des résultats) n'existent pas.

## 2. Ce que Google et les IA valorisent fin 2026 (sources datées)

Limite de la recherche : les pages `developers.google.com` et le tableau de bord d'état de Google n'ont pas pu être relus en texte intégral (domaines inaccessibles à l'outil) ; elles sont citées via des extraits de recherche. « (secondaire) » = presse SEO ou éditeur d'outil.

**Faits sourcés**

- **Contenu à grande échelle.** Politique « scaled content abuse » (mars 2024) : produire de nombreuses pages surtout pour manipuler le classement est du spam, **quel que soit le moyen** (IA, humains ou mélange). https://developers.google.com/search/docs/essentials/spam-policies ; https://developers.google.com/search/blog/2024/03/core-update-spam-policies (05/03/2024).
- **15/05/2026.** Les politiques anti-spam s'appliquent aussi aux réponses d'IA générative de Search ; « tenter de manipuler les réponses d'IA générative » entre dans la définition du spam (secondaire) : https://searchengineland.com/google-updates-search-spam-policies-to-clarify-it-applies-to-generative-ai-responses-477657 ; https://www.seroundtable.com/google-spam-policies-apply-ai-responses-41331.html.
- **Guide Google d'optimisation pour l'IA générative (2026).** Créer une page par variante de requête pour manipuler classement ou réponses IA viole la politique. Le contenu « unique, convaincant et utile » comptera à terme plus que le reste : https://developers.google.com/search/docs/fundamentals/ai-optimization-guide.
- **Contenu généré.** L'IA n'est pas interdite et ne donne aucun bonus ; est jugé sans effort le texte produit en masse sans supervision ni curation manuelle. Google déconseille de fabriquer des profils d'auteur (photos générées, faux titres) : https://developers.google.com/search/docs/fundamentals/creating-helpful-content ; https://developers.google.com/search/blog/2023/02/google-search-and-ai-content (08/02/2023). Le journal de Google signale une révision de la page « using-gen-ai-content » le 01/10/2026, non lue.
- **Quality Rater Guidelines.** Janvier 2025 : un contenu principal produit par des outils automatisés avec peu de valeur ajoutée peut recevoir la note la plus basse (secondaire) : https://searchengineland.com/google-quality-raters-content-ai-generated-454161.
- **Mises à jour 2026.** Core update de novembre 2026 du 10/11 au 24/11 (secondaire) : https://searchengineland.com/google-november-2026-core-update-rollout-is-now-complete-502268. Une core update de décembre 2026 est pré-annoncée, non démarrée au 24/11 : https://searchengineland.com/google-preannounced-the-december-2026-core-update-but-it-is-not-live-or-active-yet-502947.
- **Ce que Google dit inutile pour ses fonctionnalités d'IA** : `llms.txt`, découpage en blocs, réécriture spéciale pour l'IA, balisage spécial. Être indexé et pouvoir afficher un extrait suffit : https://developers.google.com/search/docs/appearance/ai-features ; https://www.searchenginejournal.com/googles-new-ai-search-guide-calls-aeo-and-geo-still-seo/575026/ (05/2026).
- **Rich results FAQ supprimés le 07/05/2026** (balisage toléré, pas de gain Google) : https://searchengineland.com/google-to-no-longer-support-faq-rich-results-476957.
- **Recherche GEO (KDD 2024).** Ajouter des citations de sources crédibles et des statistiques augmente la visibilité dans les moteurs génératifs (jusqu'à environ 40 %) ; le bourrage de mots-clés est inefficace : https://arxiv.org/abs/2311.09735.
- **Robots d'IA.** `OAI-SearchBot` (présence dans la recherche ChatGPT), `Claude-SearchBot` et `Claude-User`, `PerplexityBot` sont des robots de recherche distincts de ceux d'entraînement (`GPTBot`, `ClaudeBot`) ; les bloquer exclut le site des réponses : https://developers.openai.com/api/docs/bots ; https://docs.perplexity.ai/docs/resources/perplexity-crawlers ; https://support.claude.com/en/articles/8896518.
- **France.** AI Overviews et AI Mode lancés en France le 22/07/2026 : https://blog.google/intl/fr-fr/nouveautes-produits/explorez-obtenez-des-reponses/recherche-ia-apercus-mode/.
- **Mesure des citations.** Search Console : rapports « Search Generative AI performance » (annoncés 03/06/2026, ouverts à tous au 31/08/2026) par page, appareil et date : https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports. Selon des sources secondaires (août-septembre 2026), pas de clics ni de requêtes et pas de valeur « IA » dans l'API `searchAnalytics`, non vérifié dans la référence officielle. Bing Webmaster Tools : rapport « AI Performance » en bêta depuis 02/2026, citations Copilot et Bing seulement : https://searchengineland.com/bing-webmaster-tools-ai-performance-report-468751 (02/2026). Les sources citées varient d'un jour à l'autre (34 à 42 % de recouvrement) : il faut répéter les mesures (https://arxiv.org/pdf/2604.07585, 04/2026).
- **Tarifs Anthropic** (page lue le 27/11/2026, $ par million de tokens) : Opus 5.5 entrée 4 / sortie 20 ; Sonnet 5.5 entrée 2 / sortie 10 ; Haiku 5.5 entrée 0,10 / sortie 0,50 ; lecture de cache 0,05 × l'entrée sur Opus et Sonnet ; Batch −50 % ; recherche web 10 $ les 1 000 : https://platform.claude.com/docs/en/about-claude/pricing.

**Hypothèses (non démontrées)**

- Le risque de pénalité tient au **rapport entre le nombre de pages et la valeur unique de chacune**, pas à l'usage d'agents. Une chaîne qui produit beaucoup de pages proches (une par ville ou par variante de requête) est le profil le plus exposé, d'autant plus que la core update de décembre est annoncée.
- Ce qui différencie : données propres datées et sourcées, retour d'expérience réel, auteur ou relecteur réel et vérifiable, réponse directe en tête. Cohérent avec Google et avec l'étude GEO ; **aucune mesure causale récente trouvée**.
- `llms.txt` et schema.org : faible coût, effet de citation non démontré. Ce ne sont pas des priorités ; le schema sert surtout à désambiguïser les entités.

**Non vérifié** : texte intégral des pages Google, dates exactes des spam updates 2026, absence de données IA dans l'API Search Console, politique de sources de Gemini et de Copilot hors Bing, et **toute étude chiffrée sur les chaînes multi-agents avec relecture humaine** (aucune trouvée ; seulement des retours d'expérience de rédactions).

**Ce que la conception en tire** : (a) moins de pages, plus fortes, une requête = une URL ; (b) chaque page apporte un fait daté et sourcé et un angle que les concurrents n'ont pas ; (c) réponse directe en tête, questions réelles, auteur ou relecteur réel et transparence sur l'IA ; (d) pas de FAQ inventée ; (e) rien de spécifique « pour l'IA » : c'est du bon SEO.

## 3. La chaîne cible, rôle par rôle

```
 R1 Chercheur de besoins ─► R2 Stratège de brief ─► R3 Collecteur de faits ─► R4 Rédacteur
                                                                                  │
   (abandon)◄─ échec après 2 réécritures ◄─┐                                      ▼
                                           ├◄ R5 Expert métier critique ◄────────┤
   réécriture ciblée (≤ 2 essais) ─────────┤◄ R6 Vérificateur de faits ◄─────────┤
                                           └◄ R7 Éditeur (style, lisibilité, citabilité)
                                                                                  ▼
                                                R8 Porte qualité finale (dernier filet) ─► file de relecture ─► publication
```

Principe commun : **chaque rôle rend un objet structuré (JSON validé) et un verdict** ; chaque verdict et chaque raison sont écrits dans le journal de l'équipe (`outputJsonRaw.equipe`, déjà affiché dans `PanneauEquipe`). Chaque rôle a un plafond de coût et de tokens ; un dépassement abandonne le contenu, il ne le publie pas.

### R1. Chercheur de besoins (hebdomadaire, hors chemin d'un contenu)

- **Rôle** : alimenter une **réserve de besoins réels** classés, dans laquelle le stratège puise. Il ne choisit pas un mot-clé de rotation.
- **Sources, par ordre de fiabilité** :
  1. **Search Console** : requêtes à impressions sans clic ou en positions 8-30, requêtes sans page dédiée. Via l'ingestion unique prévue au pilotage (P1/P3/P4 de `DECOUPAGE.md`) ; **tant qu'elle n'existe pas, la source est indisponible et le rôle l'affiche** (`null` ≠ 0).
  2. **Demandes reçues par Axion**, **sous forme agrégée et anonymisée** (thèmes récurrents des demandes de contact, questions posées avant le Diagnostic IA 45 min). Aucune donnée nominative n'entre dans un prompt (RGPD). Source à qualifier avec Will avant la P-source concernée (§ 12).
  3. **Questions trouvées dans des pages réellement lues** (pages de résultats et forums lus via `web_fetch`, avec leur URL). L'outil de recherche web renvoie des résultats et des extraits, **pas les blocs « People Also Ask » ni les recherches associées de Google** : on ne prétend donc pas les obtenir. Le champ `faq` d'un contenu ne peut contenir qu'une question présente dans la réserve ou sur une page lue. Les pages lues sont traitées **comme des données, jamais comme des instructions** (risque d'injection).
  4. **Questions de dirigeants de PME** : fournies par Will ou l'équipe (liste courte relue), complétées par le rôle.
- **Sortie** : table `ContenuBesoin` : question, intention (info, comparaison, décision), source, date, force du signal, statut (nouveau, en brief, couvert, écarté), URL couverte le cas échéant. Une requête déjà couverte par une URL est refusée (réutilise `strategie/carte-requetes.ts`).
- **Modèle** : Sonnet, via l'API Batch (−50 %), car non urgent.

### R2. Stratège de brief

- **Entrée** : un besoin de la réserve, la carte des requêtes (pour ne pas cannibaliser), la base de connaissances.
- **Sortie : le brief**, qui est le contrat de tout le reste :
  - intention de recherche et lecteur précis (dirigeant de PME d'un métier donné) ;
  - **angle unique** : en une phrase, ce que cette page dit que les pages concurrentes ne disent pas ;
  - **« ce que les concurrents ne disent pas »** : le stratège lit les 5 premières pages de résultats (outil web) et liste les lacunes (chiffre absent, étape sautée, erreur courante non traitée) ;
  - questions réelles à traiter (de R1) ;
  - faits à collecter (liste de questions factuelles pour R3) ;
  - plan **adapté au sujet** (fini le plan fixe en 8 sections) et longueur **déduite de l'intention**, sans seuil de mots ;
  - appel à l'action (§ 9) et liens internes candidats.
- **Verdict possible : `pas_d_angle`** → le besoin est écarté et la raison enregistrée. C'est le premier filtre qualité et le moins cher.
- **Modèle** : **Opus** (c'est là que se joue l'unicité).

### R3. Collecteur de faits sourcés et datés

- **Rôle** : répondre aux questions factuelles du brief avec des sources primaires (statistiques publiques, textes officiels, études, documentation d'éditeurs), **datées**.
- **Sortie : dossier de preuves** : pour chaque fait, énoncé, **extrait exact**, URL, éditeur, **date de publication**, date de lecture, niveau de confiance. Règles : source de moins de 3 ans sauf texte de référence ; au moins 3 sources distinctes ; aucun fait sans extrait ; en cas de doute, le fait est écarté. Le dossier alimente `CHIFFRES_VERIFIES` de façon **gouvernée** (écriture en base après relecture, pas dans le code).
- **Modèle** : Sonnet avec outils `web_search` et `web_fetch` (reprise du vérificateur phase A, plafonds relevés à 8 recherches).
- **Verdict possible : `dossier_insuffisant`** → abandon raisonné (« pas assez de faits sourcés pour ce sujet »).

### R4. Rédacteur

- **Entrée** : brief + dossier de preuves + doctrine de marque. **Il n'a le droit d'énoncer un chiffre que s'il est dans le dossier**, avec son lien ; sinon il écrit sans chiffre.
- **Format citable** : réponse directe de 40 à 60 mots en tête, titres sous forme de questions réelles, chaque affirmation clé dans un paragraphe autonome, chiffres datés (« en 2026, … »), définition des termes, liste ou tableau quand c'est le bon format, pas de remplissage.
- **Honnêteté d'auteur** : mention transparente « rédigé avec l'aide de l'IA, relu et validé par … » (voir § 9 sur la persona « Manon »).
- **Modèle** : **Opus**. Une tranche, un passage de rédaction ; la réécriture ciblée réutilise le même modèle sur la seule section en cause.

### R5. Expert métier critique (le dirigeant de PME exigeant)

- **Rôle** : lire le texte comme un dirigeant de PME du secteur ciblé, sans indulgence. Il note sur une grille de 6 questions : (1) est-ce que j'apprends quelque chose que je ne savais pas ? (2) le lecteur sait-il quoi décider ou quoi demander cette semaine ? (la doctrine veut qu'Axion-IA s'occupe de la mise en place : on ne suggère jamais au lecteur de le faire seul) (3) tout ordre de grandeur cité est-il crédible et sourcé (jamais un résultat chiffré attribué à Axion-IA) ? (4) un conseiller sensé dirait-il la même chose ? (5) y a-t-il du remplissage ? (6) qu'est-ce qui manque pour décider ?
- **Sortie** : verdict (`ok`, `reecrire`, `abandonner`), notes de 1 à 5 par question, **liste de corrections localisées** (section, problème, attendu). Une note < 3 sur (1) ou (3) refuse.
- **Modèle** : **Opus**, **différent du rédacteur par instruction et par contexte** (il ne voit pas le raisonnement du rédacteur, seulement le texte et le brief). C'est aussi la parade au « juge partial » constaté en § 1.2.

### R6. Vérificateur de faits

- **Rôle** : reprendre **chaque affirmation vérifiable** du texte final (chiffre, date, nom, texte de loi) et la rapprocher du dossier de preuves, puis, si absente, de la source ouverte de nouveau. Reprise de `verificateur-deux-phases.ts` phase B : « en cas de doute, `a_retirer` ».
- **Sortie** : tableau affirmation → source → verdict (`confirme`, `a_retirer`, `a_nuancer`). **Toute affirmation non confirmée est retirée ou réécrite ; un chiffre sans source retourne en réécriture.** Les liens sortants sont testés (réponse 200, pas de redirection vers une page sans rapport).
- **Modèle** : Sonnet (tâche étroite, vérifiable), outils web.

### R7. Éditeur (style, lisibilité, structure citable)

- **Rôle** : passe finale sur la forme, **sans changer le fond ni les chiffres** (une comparaison automatique des chiffres avant/après le garantit) : phrases courtes, voix active, tutoiement ou vouvoiement conforme à la doctrine, pas de formule creuse, titres informatifs, méta et réponse directe, maillage interne ciblé (réutilise `maillage.ts` et `charge-de-liens.ts`), contrôle des règles de marque (§ 9).
- **Modèle** : Sonnet. Il s'appuie sur les contrôles déterministes existants (`conformite.ts`, `interdits-publication.ts`) : le modèle propose, le code vérifie.

### R8. Porte qualité finale (dernier filet)

- **Rôle** : refuser ce que la chaîne a laissé passer. Combinaison de contrôles **déterministes** (doctrine, plagiat, doublon de plan, liens, présence du dossier de preuves, mots interdits) et d'**un juge LLM indépendant** (Sonnet, grille courte).
- **Elle n'est plus l'outil principal** : sur un contenu issu de la chaîne, elle doit presque toujours dire oui. **Un taux de refus élevé à la porte est un signal d'alarme sur les rôles amont**, affiché comme tel (§ 7).
- **Alignement** : le contrat d'interface est au § 8. Tant que la porte autonome n'existe pas, la porte actuelle (`blockingFail` + juge) tient lieu de R8, **mais sans publication automatique** (§ 5).

## 4. Cycle de réécriture et abandon

- **États** : `besoin → brief → faits → redige → critique → verifie → edite → porte → a_relire | publie | abandonne`.
- **Réécriture ciblée** : sur refus de R5, R6, R7 ou R8, la liste des corrections localisées retourne à R4 **qui ne réécrit que les sections en cause** (pas de nouveau texte complet, pour borner le coût et éviter la dérive). Le contenu repasse alors par R5, R6 **et R7** (qui garantit le style et compare les chiffres avant/après) sur ces sections seulement, puis par R8.
- **Vocabulaire** : un **passage** = un parcours R4 → R8 ; un **contenu lancé** = un besoin qui entre en R2. **Plafonds** : **2 réécritures au plus** par contenu (3 passages au total), **plafond de coût par contenu lancé 3 $** (le plafond actuel de l'équipe) ; atteindre l'un des deux = **abandon**.
- **Abandon** : statut terminal `abandonne`, **raison classée** (§ 7.1), jamais de repli vers « publier quand même ». Les contenus abandonnés **ne sont ni publiés, ni indexés** (pas de `tier_1_indexable` forcé), et le besoin retourne dans la réserve avec la raison (« dossier insuffisant », « pas d'angle »…) pour être retravaillé ou écarté.
- **Pas de publication à l'essai** : l'état actuel, où la publication force `tier_1_indexable`, est supprimé pour la voie « chaîne ».

## 5. Publication : relecture d'abord, automatique ensuite, par type

Un contenu qui a franchi R8 entre d'abord en **file de relecture humaine** (réutilise `ReviewQueue` et l'écran existant). Will ou un relecteur désigné valide ou refuse, **et un refus humain enregistre sa raison comme un refus machine** (§ 7.1).

**Passage à l'automatique, par type de contenu et seulement quand ces conditions sont réunies** : (a) au moins 50 contenus du type relus par un humain ; (b) accord humain avec la chaîne dont la **borne basse de Wilson (95 %) est ≥ 85 %** (par exemple 50 sur 50 passe, 46 sur 50 ne passe pas) ; (c) un **échantillon des abandons** a aussi été relu, pour mesurer les faux refus (sinon on ne mesure que la précision) ; (d) activation explicite dans la console par Will. Un accord qui retombe sous 80 % sur 20 contenus **repasse le type en relecture** automatiquement. Les contenus touchant la Journée IA restent **toujours** en relecture humaine (règle existante).

## 6. Choix des modèles et coût

### 6.1 Modèle par rôle

| Rôle                          | Modèle             | Pourquoi                                              |
| ----------------------------- | ------------------ | ----------------------------------------------------- |
| R1 Chercheur de besoins       | Sonnet 5.5 (Batch) | Tri et regroupement, pas urgent, −50 %                |
| R2 Stratège de brief          | **Opus 5.5**       | L'angle unique se joue ici                            |
| R3 Collecteur de faits        | Sonnet 5.5 + web   | Tâche de recherche étroite, extraits exacts           |
| R4 Rédacteur                  | **Opus 5.5**       | La qualité du texte et de la voix                     |
| R5 Expert critique            | **Opus 5.5**       | Jugement exigeant, indépendant du rédacteur           |
| R6 Vérificateur               | Sonnet 5.5 + web   | Contrôle étroit et vérifiable                         |
| R7 Éditeur                    | Sonnet 5.5         | Forme, contrôlée par le code                          |
| R8 Porte                      | Sonnet 5.5 + code  | Dernier filet, majoritairement déterministe           |
| Analyste hebdomadaire (§ 7.3) | Opus 5.5 (Batch)   | Raisonnement sur peu de données, une fois par semaine |

**Jamais Fable.** Haiku 5.5 n'est pas retenu : le calcul de coût du dépôt refuse son prix (`providers/anthropic.ts`), il faudrait d'abord le saisir ; gain marginal face au risque sur la qualité. Le cache de prompt (doctrine de marque, grille, positionnement : lecture à 0,05 × l'entrée sur Opus et Sonnet) est employé pour les parties stables des prompts.

### 6.2 Estimation du coût par contenu (à confirmer par mesure réelle)

Hypothèses (tarifs du § 2, page lue le 27/11/2026) : article d'environ 1 800 mots, soit 4 500 tokens de sortie avec une marge pour les tokens supplémentaires des modèles récents (ordre de 30 %, **non sourcé**, à mesurer) ; entrées de 8 000 à 40 000 tokens selon le rôle ; réflexion adaptative incluse dans les sorties.

| Rôle                                 | Hypothèse (tokens entrée × sortie)            | Coût par passage  |
| ------------------------------------ | --------------------------------------------- | ----------------- |
| R1 (réparti sur ~10 briefs, Batch)   | 15 k × 2 k                                    | 0,0025 $          |
| R2 Opus (lit les 5 premières pages)  | 25-50 k × 2 k                                 | 0,15 à 0,30 $     |
| R3 Sonnet + 8 recherches + lectures  | 150-250 k × 3 k (contexte relu à chaque tour) | 0,35 à 0,60 $     |
| R4 Opus                              | 15 k × 6 k                                    | 0,18 $            |
| R5 Opus                              | 12 k × 3 k                                    | 0,11 $            |
| R6 Sonnet + web (rouvre les sources) | 20-60 k × 3 k + pages                         | 0,15 à 0,40 $     |
| R7 Sonnet                            | 12 k × 6 k                                    | 0,08 $            |
| R8 Sonnet                            | 10 k × 1 k                                    | 0,03 $            |
| **Total, un passage complet**        |                                               | **≈ 1,3 à 1,6 $** |

- Une **réécriture ciblée** (R4 sur sections, puis R5, R6, R7, R8 sur ces sections) ≈ **0,45 $**. Un **contenu lancé** coûte selon l'issue : abandon tôt (`pas_d_angle`, `dossier_insuffisant`) ≈ 0,2 à 0,6 $ ; abandon après 2 réécritures ≈ 2,5 $ ; réussite ≈ 1,5 à 2,3 $. Avec la répartition supposée (40 % de réussites, 40 % d'abandons tôt, 20 % d'abandons tardifs), **≈ 1,4 $ par contenu lancé**, donc **≈ 3,5 $ par contenu publié** ; **jusqu'à 6 $ si le taux de réussite est de 35 %**. Formule retenue : somme des coûts de tous les contenus lancés ÷ nombre de contenus publiés. **Plafond dur 3 $ par contenu lancé.**
- **Le taux de réussite de 35 à 50 % et la répartition des issues sont des hypothèses, à mesurer (C1)**, car la première semaine sera sévère.
- **Budget : 200 $/mois** (réglable dans la console, valeur posée actuelle de la voie Claude ; bornes dures 20 $/jour et 300 $/mois). Répartition proposée : **analyste et chercheur ≈ 15 $**, **réserve de dépassement 10 %** (20 $), **part du pilotage SEO/GEO ≈ 30 $** (2 $/jour partagé avec cette voie), soit **≈ 135 $ pour la production**, **≈ 30 à 40 contenus publiés au plus** à 3,5-4 $ pièce. **Le volume réel sera plus bas : il est borné par la relecture humaine** (un seul relecteur, 3 contenus lancés par jour au départ, file arrêtée à 10 en attente), d'où **10 à 30 publiés par mois au départ**. Ce n'est pas un objectif : on publie ce qui passe. **Contrôle à faire en C10** : le plafond jour (10 $) étant réservé au coût maximal, 3 contenus × 3 $ + 2 $ du pilotage = 11 $ dépasse ; régler le plafond jour ou limiter à 2 contenus simultanés. Ces « 3 par jour » sont une **limite haute de sécurité**, pas un objectif.
- **Si le budget est atteint dans le mois** : la chaîne s'arrête (mécanisme actuel de réservation et de suspension de `blog-claude.ts`), les contenus en cours sont mis en attente, **jamais finis au rabais**.
- **Mesure** : la première semaine sert à mesurer le vrai coût par rôle dans `CostLedger` (champ `role`) ; ce tableau est alors **remplacé par les valeurs mesurées**.
- **Concurrence avec l'existant** : la boucle d'amélioration qualité (100 $/mois, `content-quality-improver-worker.ts`) est surtout de la dépense OpenAI (gpt-4o), pas du budget Claude. La console doit afficher un **total multi-fournisseur**. Les modèles par rôle exigent aussi de modifier la table de `blog-claude.ts:35` (aujourd'hui `ecriture` = Sonnet, `relecture` = Opus avec plafond `jugeMaxJour`) : R4 en Opus et R5 en Opus passent par cette table, avec un test, dans C7 et C8 ; `jugeMaxJour` s'applique à R5.

## 7. Boucle d'amélioration continue

### 7.1 Enregistrer chaque refus et sa raison

Table `ContenuRefus` (additive) : contenu, tentative, **rôle qui refuse**, **code de raison** parmi une liste fermée (ex. `pas_d_angle`, `dossier_insuffisant`, `fait_non_source`, `chiffre_retire`, `generique`, `non_actionnable`, `doctrine`, `plagiat`, `doublon_plan`, `lien_mort`, `style`, `refus_humain_<motif>`), détail libre, section en cause, coût déjà dépensé, version du prompt et du brief employés. Les refus humains sont saisis dans la même liste. **Une raison qui tombe dans « autre » plus de 10 % du temps déclenche l'ajout d'un code.**

### 7.2 Suivre chaque contenu publié

Table `ContenuResultat` (une ligne par contenu et par date de mesure) : **indexation** (inspection d'URL à J3 et J7, réutilise `suivi-publication.ts`), **affichages, clics, position** (Search Console, J7/J28/J90), **affichages dans les aperçus IA** (rapport « Search Generative AI performance » : données par page, **à consulter hors API tant qu'une API n'est pas confirmée**), **citations IA** (voir ci-dessous), **visites venues des IA** (Plausible, existant), **rendez-vous générés** (voir ci-dessous).

- **Citations IA mesurables ?** Seulement en partie : Bing AI Performance (Copilot, Bing), rapport Search Console pour les aperçus IA, et un **échantillon de questions fixes** posées chaque semaine aux moteurs ouverts (une dizaine de questions, 7 à 8 répétitions, car les sources citées changent d'un jour à l'autre). C'est la P10 « GEO mesure » du pilotage, que cette chaîne **réutilise sans la dupliquer**. Aucun chiffre de citation n'est présenté sans son intervalle et son échantillon.
- **Rendez-vous générés** : il n'existe aujourd'hui **aucun lien article → rendez-vous** (`AUDIT` : Calendly capte `utm_source`, rien ne le relie à `content-gen`). **Pas de `utm_content` sur un lien interne** (il écraserait la source de la visite dans Plausible, et les pages publiques n'ont pas de JavaScript) : transmettre la page d'origine **côté serveur**, de la page contact jusqu'à la réservation Calendly (C12). **Attribution partielle assumée** : la décision de réserver suit rarement une seule page ; le tableau dit « attribué au dernier article lu », pas « causé par ».
- **Règle de prudence** : le site est jeune (environ 428 impressions par semaine en août). Sous les planchers statistiques définis au pilotage (§ 4.2 de `PLAN.md`), **l'écran affiche « données insuffisantes » et aucune décision n'est tirée**. Une durée d'observation d'au moins 8 semaines précède toute conclusion sur les résultats.

### 7.3 Analyse hebdomadaire

Chaque semaine, un job `chaine-analyse-hebdo` (file `seo-pilotage`, tâche nouvelle ignorée par un worker plus ancien, conformément à la règle D8b) prépare un dossier : taux de réussite par rôle, raisons de refus, coût par contenu publié, résultats des contenus mûrs. L'analyste Opus produit une **liste de propositions** : changements de brief (nouvelle consigne dans R2), de prompts (modification d'un gabarit de rôle), de sujets (besoins à monter, à écarter ou à fusionner), de règles d'abandon.

### 7.4 Appliquer après relecture, de façon visible

- Chaque proposition porte : constat chiffré, hypothèse, **changement exact (diff du prompt ou du brief)**, effet attendu, risque, **critère d'évaluation après application** (« taux de réussite sur 20 contenus »).
- **Rien ne s'applique seul.** Will valide dans la console (« Appliquer », « Refuser », « Reporter »), l'application passe par `ContentTemplate`/`ContentTemplateHistory` (**versionné, avec retour arrière**) et `ContentGenAuditLog`.
- **Un seul changement de prompt à la fois par rôle**, et au plus 2 changements par semaine au total, pour qu'on puisse attribuer l'effet. Un changement qui dégrade le taux de réussite de plus de 15 points sur 20 contenus est **proposé en retour arrière**.
- **Garde-fou de l'analyste** : il ne peut proposer ni d'assouplir une règle de marque (§ 9), ni de relever un plafond de coût, ni de baisser un seuil de la porte. Ces points restent des décisions humaines.

## 8. Interface avec la porte qualité

La porte (`CONCEPTION-PORTE-QUALITE.md`, branche `docs/porte-qualite-contenus`) est le **dernier filet**. Sur un contenu issu de la chaîne, elle doit presque toujours dire oui ; **un taux de refus élevé à la porte est une alarme sur les rôles amont**, affichée comme telle. Ce document reprend ses noms, sans rien redéfinir :

- **Appel** : une fois par contenu final (R8), avec texte, métadonnées, dossier de preuves, brief, identifiant de contenu. La porte est un module pur `evaluerPorte(contenu, contexte)` ; elle est **aussi** rejouée au point final de `content-publish-worker.ts` (la chaîne ne la contourne jamais).
- **Verdict** : `publiable`, `a_corriger` ou `bloque` (et non `passe` / `refuse`), avec la liste des **critères** en échec, leur preuve et une note sur 100 (seuil de départ 85, à calibrer).
- **Noms de critères** : ceux du registre `CRITERES` de la porte, `B01` à `B17` pour les bloquants (doctrine B01, faits chiffrés sourcés B02, faits canoniques B03, exactitude réglementaire B04, intention libre B05, unicité sémantique B06, apport original B07, réponse directe B08, sources primaires B09, appel à l'action unique B10, complétude B11, métadonnées B12, maillage B13, auteur et dates B14, texte caché B15, relecture adverse B16, coupe-circuit B17) et `W01` à `W10` pour les avertissements. La chaîne ne les renomme pas.
- **Réécriture et abandon** : `a_corriger`, ou `bloque` avec cause localisable, entre dans le cycle du § 4 (réécriture ciblée, 2 essais au plus, plafond de coût de 3 $), puis **abandon**. Un bloquant « dur » (B01, B02, B03, B04, B09, B12, B14, B15, B17) n'a **aucune dérogation humaine**. Les dérogations permises (B05, B06, B07) sont motivées par écrit, avec nom et date.
- **Enregistrement des refus : un seul mécanisme.** La porte emploie la **liste fermée de codes de raison** de la chaîne (`ContenuRefus`, § 7.1, **un seul module partagé**). Chaque critère `Bnn` correspond à un code : B01 → `doctrine`, B02 → `fait_non_source`, B03 → `fait_non_source`, B05 et B06 → `doublon_plan`, B07 → `generique`, B09 → `dossier_insuffisant`, B13 → `lien_mort`, B16 → `generique` ou `non_actionnable` selon la note. Le détail (critère `Bnn`, raison en français simple, preuve, tentative, version de la porte) est enregistré avec le code. Tant que `ContenuRefus` n'est pas livrée, la porte écrit seule dans `ContentQualityVerdict.criteres` ; à la livraison de C3 les deux tables portent les mêmes codes. Un refus humain est saisi comme un refus machine.
- **Fail-closed** : si l'appel échoue, ou si une source d'un critère bloquant est indisponible (« non évalué »), le contenu n'est pas publié.
- **Doublons de rôle à éviter** : R5 (expert critique) et B16 (relecture adverse) sont deux lectures indépendantes ; B16 s'applique à tous les contenus, y compris ceux de la chaîne. B07 (apports originaux) est réservé **dès le brief** (R2), comme l'exige la porte : sans apport B ou C disponible, l'intention reste non générable.
- **Pas de nouvelle valeur d'énumération** : un contenu refusé reste `needs_review` ou `pending`, le motif est dans la table des verdicts (fenêtre app/worker).
- **Rythme** : le plafond de sécurité de la porte s'ajoute aux autres ; on prend le **minimum**. Ce sont des limites hautes, jamais des objectifs.

## 9. Règles de marque (appliquées à tous les rôles et vérifiées par le code)

À inscrire dans le prompt de chaque rôle **et** vérifiées par `interdits-publication.ts` (la source de vérité, en lecture seule ici) :

- **Jamais « Grenoble »** (sauf mentions légales), aucun ancrage local d'Axion-IA.
- **« Partout en France » est la formule VOULUE et AUTORISÉE** (décision de Will du 27/11/2026) : c'est la formule de remplacement de toute mention locale (« dans vos locaux, partout en France »). Le code (`interdits-publication.ts`, `positionnement.ts`) a raison ; **aucun rôle de la chaîne ne l'interdit, ne la signale, ne la pénalise**. Un test de non-régression vérifie qu'elle n'est refusée par aucun contrôle.
- **Aucun faux témoignage, aucun cas client inventé**, aucun résultat chiffré attribué à Axion-IA, aucun partenaire ni client nommé.
- **Aucun prix barré ni ancien prix** (le tarif s'affiche seul).
- **Aucune mention de frais de déplacement, d'hébergement ou de repas** sur les pages.
- **Aucun avocat** : pas de « relecture avocat » ni de mention d'un avocat ; Will tranche lui-même les points juridiques.
- **Jamais Fable** dans la chaîne (aucun rôle, aucun repli).
- **Appel à l'action unique** : le **Diagnostic IA gratuit de 45 minutes** sans engagement (page contact) ; sur un contenu qui parle de la Journée IA, **renseignements Journée IA** sans prix chiffré dans le texte généré et relecture humaine obligatoire. **Pas de réservation directe en ligne** : lien vers la page dédiée (`/appel`) seulement, aucun widget ni bouton de réservation intégré, aucun lien de paiement dans le corps (règle actuelle de `positionnement.ts` et B10 de la porte).
- Cible : PME ; autres interdits existants conservés (Qualiopi, CPF, financement « à 100 % », « garanti », etc.).
- **Couleur terracotta** : règle d'**interface** (console et visuels) : jeton `#c24a1b` de la charte ; **ce n'est pas une règle de texte** et rien dans les prompts ne la concerne. Les écrans de la console l'emploient pour les éléments d'action et de vigilance, et jamais en couleur unique de statut (le texte accompagne toujours la couleur).
- **Honnêteté sur l'IA** : la persona « Manon, plume IA » est à reconsidérer. Google déconseille les profils d'auteur fabriqués. **Proposition** : signer d'un relecteur réel et nommé (Will ou un responsable désigné) **seulement si cette personne a effectivement relu** ; sinon, « rédigé avec l'aide de l'IA, relu par l'équipe Axion-IA ». Décision à prendre par Will.

## 10. Console : des écrans en adéquation parfaite avec le back-end

Règle d'or : **un chiffre affiché = une requête sur une table qui existe, avec sa date**. Aucun écran n'affiche une donnée que le back-end ne produit pas ; une source indisponible affiche « indisponible » (jamais 0). Les écrans sont en `force-dynamic`, sans appel réseau au SSG, sans JavaScript sur les pages publiques, couleur terracotta selon § 9.

Nouvel onglet **« Chaîne éditoriale »** sous `content-gen`, en cinq vues :

1. **Entonnoir** (période réglable) : besoins reçus → briefs → dossiers de faits → rédigés → critiqués → vérifiés → édités → passés la porte → publiés, et **abandonnés par étape**. Source : `ContentGenJob` + `outputJsonRaw.equipe`. Taux de réussite par étape et global.
2. **Raisons de refus** : classement des codes de `ContenuRefus` par rôle, tendance sur 8 semaines, exemples cliquables vers le contenu et le journal du job (`PanneauEquipe` existant).
3. **Coût** : par rôle, par contenu publié, par contenu abandonné ; progression du budget mensuel, plafond jour/mois, réserve. Source : `CostLedger` avec le champ `role`. Réglage des plafonds par le formulaire existant de `settings/providers` (aucun second réglage).
4. **Résultats** : par contenu publié et par date de mesure, indexation, affichages, clics, position, affichages IA, citations IA, rendez-vous attribués ; **mention explicite des planchers statistiques** et de l'attribution partielle.
5. **Propositions de la semaine** : liste, diff exact, état (à relire, appliquée, refusée, reportée), résultat mesuré après application et bouton de retour arrière. Journal des changements appliqués.

Interrupteurs de la console (tous éteints au départ) : chaîne allumée, par rôle ; publication automatique par type ; plafonds.

## 11. Rythme

Le rythme **découle de ce qui passe la qualité**. Mécanique :

- Le chercheur alimente une réserve ; le stratège **prend au plus N besoins par jour, N déduit du budget restant du mois et du délai de relecture humaine**, et **s'arrête quand la file de relecture dépasse 10 contenus en attente** (ne pas produire plus vite qu'on ne relit).
- Aucun objectif de nombre de publications, aucun rattrapage : une semaine à zéro publication n'est pas un échec. Le plafond de 20 articles par jour de `anti-burst.ts` devient un **maximum de sécurité**, pas une cible, et s'abaisse à 3 par jour au départ. **On n'accélère que si Google et les IA suivent** (indexation à 28 jours, affichages, clics, citations IA, comme dans les indicateurs de la porte) : le relèvement est une décision de Will, jamais automatique.
- **Une requête = une URL** (`carte-requetes.ts`) : pas de pages par ville ou par variante de requête.
- Si le taux de réussite est trop bas (< 25 % sur 20 tentatives), la chaîne **ralentit** et le rapport hebdomadaire le dit, plutôt que de brûler le budget.
- Toute reprise d'un contenu publié existant (mise à jour) suit le **mode mise à jour** déjà prévu (avant/après, `dateModified` seulement si le corps change).

## 12. Découpage en petites PR ordonnées

Règles communes (identiques à `DECOUPAGE.md`) : ouvrir en **brouillon**, ne passer « prête » qu'à la fin du lot ; ne jamais toucher `positionnement.ts`, `interdits-publication.ts`, `pricing.ts`, `legal.ts`, `journee-ia-commun.ts` ; migrations **additives** uniquement, colonnes nullables ; **nouvelles files et charges tolérées par un worker plus ancien** (D8b : le worker ignore toute tâche inconnue, une valeur d'énumération est ajoutée avant d'être émise) ; tout éteint par défaut ; respecter le contrat de build `stub.invalid`.

### Tout de suite (sans migration, sans risque pour le site)

- **C0 · (déjà livré, rien à faire)** : la P0 du pilotage (#2406) a livré `providers/job-porteur.ts`, le job porteur de la mise à jour réelle et la correction de `blog_edition_seo`. Le § 1.3 le mentionne. L'ordre part donc de C1.
- **C1 · Mesurer avant de changer, sans migration** : rapport **lecture seule** « taux de blocage actuel par contrôle et coût réel par article et par rôle » sur les 30 derniers jours, lu dans `outputJsonRaw.equipe` (qui journalise déjà coût par rôle) et `GenerationLog.metadata`. La colonne `role` de `CostLedger` attend la migration de C3. **Objectif : remplacer les hypothèses du § 6.2 par des chiffres réels.**
- **C2 · Arrêter la publication faible** : pour la voie actuelle, passer `factoryAutoPublishAllBlogTypes` **et `newsAutoPublish`** (actualités RSS : réécritures de flux publiées dès 60, le profil le plus exposé) à faux, ne plus forcer `tier_1_indexable` pour les contenus sans relecture, **et abaisser en même temps le plafond `anti-burst` (20 → 3) ; décider du gel de la rotation des 747 mots-clés**, sinon la file de relecture sature. Décision à valider par Will (changement de comportement, d'où la PR séparée et le test dédié).
- **C2b · Audit du corpus déjà publié** (lecture seule, sans migration) : liste des articles et pages gabaritées (pages villes) à faible valeur, sans impressions, doublons de plan ; **signalements pour un humain, jamais de noindex ni de fusion automatique** (`PLAN.md`, principe 5). C'est le premier risque Google : le signal de qualité à l'échelle du site vient de l'existant, pas de la nouvelle chaîne.

### Vague 1 : fondations (migration additive)

- **C3 · Tables** (en **étendant** `equipe/brief.ts` et ses énumérations d'intention plutôt que de dupliquer un second schéma de brief) ; ajout de la colonne nullable `role` à `CostLedger` : `ContenuBesoin`, `ContenuBrief`, `ContenuRefus`, `ContenuResultat`, `ContenuProposition` (migration additive, colonnes nullables).
- **C4 · Liste fermée des codes de raison** (module pur, tests, correspondance `Bnn` → code du § 8) et contrat d'interface avec la porte (§ 8).

### Vague 2 : rôles, un par PR, chacun testé seul et éteint

- **C5 · R3 collecteur de faits + dossier de preuves** (reprise de la phase A, plafonds relevés) et `CHIFFRES_VERIFIES` alimenté par la base. _Le plus rentable : sans faits, rien d'autre ne sert._
- **C6 · R2 stratège de brief** (angle unique, lacunes des concurrents, plan adapté, `pas_d_angle`).
- **C7 · R4 rédacteur sous contrat de faits** (aucun chiffre hors dossier) et suppression de la consigne « 8 PAA réelles » inventées.
- **C8 · R5 expert critique** (Opus, grille, corrections localisées).
- **C9 · R6 vérificateur** (tableau affirmation → source) et **R7 éditeur** (comparaison automatique des chiffres avant/après).
- **C10 · Orchestration** : états, réécriture ciblée (≤ 2), plafond de 3 $, abandon, appel à la porte fail-closed, file de relecture. Premier moment où la chaîne tourne **de bout en bout, sur 3 sujets par jour, en relecture humaine seulement**.

### Vague 3 : besoins réels et résultats

- **C11 · R1 chercheur de besoins** : réserve, source Search Console quand l'ingestion du pilotage (P1/P4) existe ; saisie manuelle de questions de dirigeants dès le départ ; thèmes agrégés des demandes reçues après décision de Will.
- **C12 · Suivi des résultats** : `ContenuResultat` (indexation, Search Console), `utm_content` de la réservation du Diagnostic IA 45 min, lecture de l'attribution.
- **C13 · Citations IA** : branchement sur la P10 du pilotage (échantillon de questions fixes, Bing AI Performance).

### Vague 4 : console et amélioration

- **C14 · Console « Chaîne éditoriale »** (cinq vues du § 10), livrée **en deux temps** : vues Entonnoir/Refus/Coût dès C10, vues Résultats/Propositions après C12.
- **C15 · Analyse hebdomadaire** (job, dossier, propositions, application versionnée avec retour arrière, un changement à la fois).
- **C16 · Publication automatique par type** (§ 5), éteinte, avec bascule automatique vers la relecture si l'accord humain retombe.

### Ordre et dépendances

`C1 → C2, C2b` (parallèle de C3) → `C3 → C4 → C5 → C6 → C7 → C8 → C9 → C10` → `C11, C12` → `C13, C14` → `C15 → C16`. C5, C6, C7 peuvent avancer en parallèle après C4.

## 13. Risques et réponses

| Risque                                                                                                                             | Réponse                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pénalité « scaled content abuse »** (politique 2024, élargie à l'IA générative le 15/05/2026) ; core update de décembre annoncée | Peu de pages et plus fortes ; une requête = une URL ; pas de pages par ville ; faits sourcés et datés ; relecture humaine d'abord ; abandon plutôt que publication faible. La chaîne **réduit** le risque en baissant le volume de pages médiocres ; elle ne le supprime pas. |
| Coût qui dérive                                                                                                                    | Réservation avant appel, plafond par contenu 3 $, plafond jour/mois, arrêt à l'atteinte, mesure réelle (C1) avant toute montée en charge.                                                                                                                                     |
| Taux de réussite trop bas au départ                                                                                                | Attendu ; la chaîne ralentit, ne dégrade pas ; l'analyse hebdomadaire cible la raison principale.                                                                                                                                                                             |
| Boucle d'amélioration qui « apprend » du bruit                                                                                     | Planchers statistiques, un changement à la fois, évaluation sur 20 contenus, retour arrière, validation humaine.                                                                                                                                                              |
| Données personnelles dans les prompts                                                                                              | Demandes reçues uniquement agrégées et anonymisées.                                                                                                                                                                                                                           |
| Faux fait malgré la chaîne                                                                                                         | R3 extraits exacts, R6 sur chaque affirmation, « doute = retrait », relecture humaine, liens testés ; correction et retrait possibles depuis la console.                                                                                                                      |
| Fenêtre app/worker (D8b)                                                                                                           | Files et tâches nouvelles ignorées par un ancien worker, colonnes nullables, énumération ajoutée avant son émission, tolérance P2021.                                                                                                                                         |
| Dépendance à des sources non vérifiées (API Search Console pour l'IA, citations)                                                   | Marquées « indisponible » à l'écran ; aucune décision automatique sur ces données.                                                                                                                                                                                            |
| Mauvaise lecture des règles de marque                                                                                              | « Grenoble » est interdit ; « partout en France » est autorisée (§ 9, décision de Will tranchée). Test de non-régression dans la porte.                                                                                                                                       |
| **Corpus existant** : articles gpt-4o publiés automatiquement depuis juin, actualités RSS, pages villes gabaritées                 | Audit en lecture seule (C2b), arrêt de la publication faible (C2), aucune action automatique sur les URL.                                                                                                                                                                     |
| Injection d'instructions par les pages lues (R1, R2, R3, R6)                                                                       | Pages traitées comme des données, jamais comme des consignes ; sorties JSON validées.                                                                                                                                                                                         |
| Paraphrase trop proche des pages concurrentes lues par R2                                                                          | Contrôle de plagiat contre ces pages.                                                                                                                                                                                                                                         |
| Péremption des faits datés                                                                                                         | Revérification à 12 mois (mode mise à jour).                                                                                                                                                                                                                                  |
| Envoi d'articles à l'API Google Indexing (hors conditions d'usage)                                                                 | Exclu pour la chaîne ; IndexNow et sitemap seulement.                                                                                                                                                                                                                         |
| Juge de même famille que le rédacteur (Opus juge Opus)                                                                             | Entrée de terrain réelle obligatoire dans le brief (note de Will, constat anonymisé de Diagnostic) sinon abandon `pas_de_matiere` ; R5 calibré sur les verdicts humains ; autre modèle à envisager pour R5 ou R8 si l'écart persiste.                                         |

## 14. Décisions demandées à Will

**Déjà tranché (27/11/2026), rien à décider** : « partout en France » est autorisée, « Grenoble » est interdit (sauf mentions légales) ; aucun quota de volume ; la porte est le dernier filet ; pas de faux témoignage, pas de prix barré, aucun frais de déplacement sur les pages, pas de réservation directe en ligne, aucun avocat, jamais Fable.

Restent les décisions ci-dessous. Pour chacune : ma recommandation par défaut, en français simple.

| Id  | Question                                                | Ma recommandation par défaut, avec un exemple                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Signature des articles (persona « Manon », relecteur)   | **Ne mettre aucun nom tant qu'une vraie personne n'a pas relu.** Exemple : un article relu par vous le 3 décembre affiche « relu par [votre nom] le 3 décembre » ; un article que personne n'a relu affiche « rédigé avec l'aide de l'IA, relu par l'équipe Axion-IA ». Jamais de faux auteur.                                                                                     |
| 2   | Arrêt de la publication automatique actuelle (C2)       | **Oui, l'arrêter**, y compris pour les actualités RSS. Exemple : aujourd'hui un article noté 76 par un modèle qui ne l'a pas relu part en ligne seul ; demain il attend votre clic dans la file de relecture.                                                                                                                                                                      |
| 3   | Données « demandes reçues » autorisées dans les prompts | **Seulement des thèmes agrégés, sans nom ni e-mail.** Exemple : « 7 demandes sur 20 parlent de formation des équipes » est permis ; « Mme Durand, société X, demande… » ne l'est jamais.                                                                                                                                                                                           |
| 4   | Budget                                                  | **Confirmer 200 $/mois comme limite haute**, pas comme objectif de dépense, et laisser la boucle qualité actuelle (100 $, surtout OpenAI) en veille pour les contenus de la chaîne. Exemple : si le mois a coûté 60 $ parce que peu de contenus ont passé, c'est normal.                                                                                                           |
| 5   | Qui relit la file, et sous quel délai                   | **Vous-même au départ, délai cible de 48 h ouvrées**, file arrêtée à 10 contenus en attente. Exemple : 3 contenus lancés le lundi, relus avant mercredi soir ; si la file est pleine, la chaîne attend au lieu de produire.                                                                                                                                                        |
| 6   | Audit du corpus déjà publié (C2b)                       | **Oui, en lecture seule, avant toute nouvelle production.** Exemple : la liste signale 40 pages villes presque identiques et sans impression ; vous décidez page par page (améliorer, fusionner, retirer), la chaîne ne touche à aucune URL seule.                                                                                                                                 |
| 7   | Matière de terrain pour chaque brief                    | **Oui : fournir, pour chaque sujet, une note réelle ou un constat anonymisé.** Exemple : « une PME de 40 salariés a d'abord voulu un outil, puis a compris qu'elle devait former deux référents ». Sans matière, le sujet est abandonné (`pas_de_matiere`) plutôt que rempli de généralités. La démarche reste celle d'Axion-IA : on ne conseille jamais au lecteur de faire seul. |
