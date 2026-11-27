# Porte qualité des contenus générés : conception

> Phase de conception, 27/11/2026. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**
> Ce document complète `AUDIT.md`, `PLAN.md` et `DECOUPAGE.md` du même dossier (pilotage SEO et GEO). Il s'appuie sur :
>
> - une recherche web sur l'état de Google et des moteurs IA fin 2026 (§ 14) ;
> - une lecture du code du générateur (§ 2, § 11) ;
> - une critique indépendante (§ 16).
>
> **Décision de Will (27/11/2026) : la qualité passe avant le volume.** Contenus excellents, utiles à un dirigeant de PME, appréciés de Google et cités par les IA. L'objectif de ~100 contenus par jour est un horizon, pas un engagement. Le rythme monte par paliers, et seulement si les indicateurs le permettent.

## 1. En une page

1. **Il n'existe pas de porte unique aujourd'hui.** Il existe une douzaine de contrôles dispersés, dont certains sont éteints ou passifs (§ 2). Un contenu peut être publié par au moins sept chemins qui ne les traversent pas tous (§ 11).
2. **La porte proposée** est un module pur `evaluerPorte(contenu, contexte)` qui rend un verdict `publiable`, `a_corriger` ou `bloque`, avec la liste des critères et leurs preuves. Elle est appelée à **quatre endroits**, dont un **point final obligatoire** dans `content-publish-worker.ts`, par lequel passent tous les articles. En cas d'erreur de la porte, le contenu **n'est jamais publié** (échec fermé).
3. **Deux familles de critères.** Des **bloquants** (un seul suffit à refuser) et des **avertissements** (ils retirent des points). Un contenu est publié s'il n'a aucun bloquant **et** une note d'au moins 85/100 **et** une relecture adverse favorable (§ 5).
4. **Les sources de vérité ne bougent pas.** Les mots interdits restent dans `src/lib/contenu/interdits-publication.ts`, les prix dans `pricing.ts`, la Journée IA dans `journee-ia-commun.ts`. La porte les **appelle**, elle ne les recopie pas.
5. **Le rythme est piloté, pas réglé à la main.** Huit paliers (§ 10), de 3 à 100 contenus par jour. Passer au palier suivant exige des indicateurs (indexation d'une cohorte à 28 jours, impressions, absence d'action manuelle) et **un clic de Will**. Un coupe-circuit fait redescendre tout seul.
6. **Une vérité à dire dès maintenant** : la limite du volume ne sera pas le modèle d'écriture mais le **nombre d'intentions de recherche réellement distinctes** que Axion-IA peut couvrir avec un apport original. À 100 par jour, cela fait 3 000 par mois : sans doublon ni cannibalisation, c'est improbable. La porte plafonne donc le rythme par le **stock d'intentions validées** (§ 7.1). Voir aussi § 10.5.
7. **Un point à trancher par Will avant le code** : « partout en France » est aujourd'hui la formule **imposée** par la doctrine du code, alors que la consigne demande de ne jamais l'écrire (§ 9, décision D1).

## 2. Ce qui existe déjà (lecture du code, commit `686f6b62`)

Légende : **[lu]** vérifié dans le code. Les numéros de ligne sont ceux de ce commit.

### 2.1 Chaîne de génération

- Création des tâches : orchestrateur (cron 15 min, plafond `daily_generation_cap`, 20 par défaut), flux RSS (5 par jour), actions de console. [lu]
- Worker `content-gen-worker.ts` : arrêt d'urgence, base de connaissances prête, dédoublonnage avant appel IA (titre, Levenshtein ≥ 0,85), verrou de mot-clé, génération, retouches déterministes, contrôles, décision de statut. [lu]
- Modèles : OpenAI `gpt-4o` par défaut pour écrire **et** pour juger. Voie Claude (Sonnet 5.5 écrit, Opus 5.5 relit) derrière `CONTENT_GEN_BLOG_CLAUDE`, avec plafonds de 10 $/jour et 200 $/mois. [lu]
- Équipe éditoriale (brief, gardien, vérificateur, mailleur, éditeur SEO, conformité, rédacteur en chef avec note 8,5) : **derrière `CONTENT_EQUIPE_EDITORIALE`, éteint par défaut.** [lu]

### 2.2 Contrôles existants et leur état réel

| Contrôle                                                        | Seuil actuel                                    | État                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Note de qualité (SEO + lisibilité, moins 30 si doctrine)        | ≥ 75 pour publier seul                          | Actif. Ne mesure ni l'utilité, ni l'originalité, ni les faits.                                      |
| Plagiat (5-grammes) contre les 200 derniers articles            | 0,30 (0,10 actualités)                          | Actif, bloque l'auto-publication.                                                                   |
| Plan dupliqué (SimHash h2/h3)                                   | Hamming ≤ 4                                     | Actif.                                                                                              |
| Doublon de sujet (empreinte Voyage)                             | ≤ 8                                             | Actif.                                                                                              |
| Accroche trop proche                                            | ≥ 0,6 sur 300 caractères                        | Actif.                                                                                              |
| Page mince                                                      | < 350 mots (280 avec données riches)            | Actif.                                                                                              |
| Longueur des articles longs                                     | ≥ 850 mots                                      | Actif.                                                                                              |
| Aucun fait de la base de connaissances                          | `kbEntryIds` vide = refus                       | Actif.                                                                                              |
| Fautes de doctrine (Grenoble, prix barré, faux témoignage, etc.) | Liste dans `interdits-publication.ts`           | Actif, rejoué à la publication.                                                                     |
| Complétude (réponse directe ≥ 40 mots, FAQ ≥ 4, 2 citations…)  | Seuils dans `data-quality-gate.ts`              | **Journalise seulement** tant que `CONTENT_QUALITY_GATE_ENABLED` n'est pas `"true"`.                |
| Fidélité aux fiches de la base                                  | Règles + Claude                                 | Derrière `CONTENT_FIDELITY_CHECK`.                                                                  |
| Fact-check Claude avec recherche web                            | Preuve exigée si le drapeau est allumé          | Derrière `CONTENT_GEN_FACTCHECK_CLAUDE`. La porte du score (`minScore 40`) est **passive** à la première publication.  |
| Juge sur 7 dimensions                                           | Publier ≥ 8,5, rejeter < 6,0                    | **Ne tourne que sous la note 75**, dans la boucle d'amélioration. Un contenu ≥ 75 n'est jamais jugé. |
| Embeddings (pgvector, doublon 0,85, proche 0,80)                | —                                               | **Calculés après publication.** Non utilisés par la porte avant publication. Le gardien reçoit `voisins: async () => []`. |
| Search Console                                                  | —                                               | Instantané `SiteRoute.gsc*`, une URL à la fois. Pas d'historique. Fonctions par lot (P1) **non branchées**. |

### 2.3 Les écarts qui comptent

- La porte de complétude est **éteinte** par défaut : une page sans FAQ peut partir.
- Le juge peut faire publier une note inférieure à 75 (`judge-outcome.ts:52-58`).
- `bulkApproveReviews` (`review.ts:267-345`) approuve **sur la note seule**, sans regarder pourquoi le contenu était en relecture (plagiat, doublon, moins de 850 mots).
- Aucune vérification des faits **chiffrés** par une source externe avant publication, alors que Google écrit depuis le 01/10/2026 qu'il est « critical » de les vérifier (§ 14).
- Le quota de 3 nouveaux articles par jour de l'équipe éditoriale n'est branché nulle part ; seul le quota de mises à jour l'est.
- Aucune table ne garde les verdicts : on ne peut ni auditer, ni calibrer, ni afficher.

## 3. Architecture de la porte

```
 génération ──► [P1 avant écriture]   intention libre ? doublon ? voisins ?          (§ 7)
      │
      ▼
 contrôles actuels (inchangés, en amont)
      │
      ▼
 [P2 après écriture]  evaluerPorte() en ombre puis réelle ──► table ContentQualityVerdict
      │
      ├─► décision de statut (gen-worker, boucle d'amélioration)  : approved seulement si publiable
      │
      ▼
 file content-publish ──► [P3 POINT FINAL] evaluerPorte() rejouée sur outputJsonRaw ──► transaction de publication
                                    ▲
 approbation humaine (review.ts) ───┘  (dérogation motivée, jamais sur un bloquant « doctrine » ou « faits »)

 [P4 écritures après publication]  mise à jour, fact-check réécrivain, édition manuelle : même porte, mode « mise à jour »
```

Règles de construction :

1. **Module pur** : `src/server/content-gen/porte-qualite/` (sans `prisma`, sans réseau). Les accès (embeddings, Search Console, récupération d'URL) sont des **fonctions injectées**, qui rendent `{ etat: "ok" | "indisponible", … }`.
2. **`null` n'est pas 0.** Une source indisponible ne fait pas passer un critère. Elle le rend **« non évalué »**, et un critère bloquant non évalué **bloque** (échec fermé). Les critères qui dépendent de la Search Console (§ 7.3) sont l'exception documentée : site jeune, donc non évalués = avertissement, et le rythme est plafonné.
3. **Un seul registre de critères** `CRITERES` : identifiant, libellé en français simple, famille, gravité, seuil, fonction. L'écran de console et les tests sont **générés depuis ce registre** (§ 12).
4. **Version de la porte** : chaque verdict porte `versionPorte` et les seuils figés. Changer un seuil crée une nouvelle version ; l'ancienne reste lisible.
5. **Mode ombre d'abord** : la porte écrit son verdict sans rien bloquer, pendant le palier 0 (§ 10). On compare ce qu'elle aurait refusé à ce que le pipeline actuel publie.
6. **Pas de nouvelle valeur d'énumération** dans `ContentGenJobStatus` ni `ReviewStatus` (fenêtre app/worker de ~50 min, `AGENTS.md`). Un contenu refusé reste `needs_review` ou `pending` ; le motif est dans la table de verdicts.
7. **Compatibilité des deux sens** : une nouvelle colonne est nullable ; un worker qui ne connaît pas la porte publie comme avant **mais** le point final P3 refuse de publier si la table est absente **et** que le drapeau d'application est allumé. L'allumage du drapeau se fait donc après la mise en ligne des deux conteneurs.

## 4. Critères

### 4.1 Bloquants (un seul suffit à refuser)

Chaque critère est mesurable, a un identifiant stable (`B01`…), une preuve enregistrée, et un test.

| Id  | Critère                                         | Mesure                                                                                                                                                                                  | Seuil de départ       | Dérogation humaine ?    |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------- |
| B01 | **Doctrine et communication**                   | `detecterInterdits` + doctrine de surface (§ 9) sur titre, méta, corps, alt, JSON-LD, FAQ                                                                                                | 0 faute               | **Non**                 |
| B02 | **Faits chiffrés sourcés et vérifiés**          | Chaque nombre, date, pourcentage, montant, référence réglementaire porte une source (URL, éditeur, date) **et** la vérification (§ 6) retrouve le chiffre dans la source                  | 100 % des affirmations | **Non**                 |
| B03 | **Faits canoniques cohérents**                  | Prix, durées, programme lus dans `pricing.ts` et `journee-ia-commun.ts` ; tout écart = refus                                                                                              | 0 écart               | **Non**                 |
| B04 | **Exactitude réglementaire**                    | Liste de contrôle datée (§ 6.3) : AI Act article 4, Qualiopi, OPCO, CPF. Une affirmation contraire à la liste = refus                                                                     | 0 écart               | **Non**                 |
| B05 | **Intention déclarée et libre**                 | L'intention (§ 7.1) existe au registre et **n'est pas déjà couverte** par une page publiée ou en cours                                                                                    | 1 intention = 1 page  | Oui, avec plan de fusion |
| B06 | **Unicité sémantique**                          | Cosinus maximal du brouillon contre tout contenu publié (embedding calculé **avant** publication)                                                                                         | < 0,85 (hyp. à calibrer) | Oui, motivée          |
| B07 | **Apport original**                             | Au moins 2 apports distincts parmi 4 types, vérifiés (§ 8)                                                                                                                                | ≥ 2                   | Oui, motivée            |
| B08 | **Réponse directe en tête**                     | Réponse autonome de 40 à 60 mots dans les 150 premiers mots, qui répond à la question cible                                                                                               | présente              | Non                     |
| B09 | **Sources externes primaires**                  | ≥ 2 sources primaires (Insee, Bpifrance, texte officiel, étude datée), dont ≥ 1 de moins de 18 mois pour l'IA et la réglementation                                                        | ≥ 2                   | Non                     |
| B10 | **Un seul appel à l'action cohérent**           | Un appel principal : Diagnostic IA 45 min **ou** renseignements Journée IA, relié à l'intention (§ 9.2), lien correct, aucun prix hors source unique                                      | 1 exact               | Non                     |
| B11 | **Complétude de la page**                       | Anciennes règles de `data-quality-gate` **rendues bloquantes** + ≥ 850 mots (articles), page non mince, H1 unique, 3 à 8 H2                                                                | voir code             | Non                     |
| B12 | **Métadonnées relues**                          | Title (unique sur le site), méta description, alt : présents, conformes, sans faute de doctrine. Google étend la relecture aux métadonnées (01/10/2026)                                    | 100 %                 | Non                     |
| B13 | **Maillage minimal**                            | ≥ 3 liens internes vers des pages **existantes et saines** (HTTP 200, indexables), dont 1 vers la page « propriétaire » du thème                                                         | ≥ 3                   | Non                     |
| B14 | **Auteur et dates honnêtes**                    | Auteur identifiable (§ 9.4), `datePublished` visible, pas de `dateModified` sans changement réel du corps                                                                                | conforme              | Non                     |
| B15 | **Aucun texte caché ni consigne aux modèles**   | Détection de texte invisible, de consignes adressées à une IA, de listes comparatives biaisées. Visé par la politique du 15/05/2026                                                       | 0                     | **Non**                 |
| B16 | **Relecture adverse favorable**                 | Juge indépendant (modèle différent de l'auteur) : note « utile à un dirigeant » ≥ 8,5, aucun problème P0                                                                                 | ≥ 8,5                 | Non                     |
| B17 | **Cadence autorisée**                           | Le quota du palier du jour n'est pas dépassé et le coupe-circuit n'est pas déclenché (§ 10)                                                                                               | respecté              | Non                     |

### 4.2 Avertissements (retirent des points, jamais bloquants seuls)

| Id  | Critère                                                                                      | Points |
| --- | -------------------------------------------------------------------------------------------- | ------ |
| W01 | Au moins 30 % des H2 formulés en question de dirigeant                                       | 6      |
| W02 | Au moins 3 passages autonomes de 40 à 120 mots, sans renvoi du type « comme vu plus haut »   | 8      |
| W03 | Un tableau ou une liste structurée quand le sujet s'y prête                                  | 4      |
| W04 | Sous-questions : au moins 3 sur 5 de la liste prévue sont traitées, sans remplissage         | 8      |
| W05 | Lisibilité adaptée à un dirigeant (phrases courtes, pas de jargon non défini)                | 6      |
| W06 | Données structurées (Article, Person, Organization) **concordantes** avec le texte visible   | 4      |
| W07 | FAQ visible utile (≥ 4 vraies questions), **jamais décorative**                              | 4      |
| W08 | Variété : accroche, plan et CTA différents des 20 derniers contenus du même type             | 6      |
| W09 | Exemple concret français (secteur, taille, situation) au-delà du minimum de B07              | 4      |
| W10 | Image principale pertinente, alt descriptif, **terracotta** pour les visuels dessinés (§ 9.3) | 4      |

### 4.3 Notation

- **Note = 100 − pénalités des avertissements − pénalités de qualité continue**, sur 100 (voir tableau : les points ci-dessus sont des **pénalités maximales**, qui s'additionnent à 60 au plus).
- Les 40 points restants viennent de **trois mesures continues** : couverture des sous-questions (W04 pondéré), densité de preuves (nombre de faits sourcés rapporté à la longueur), originalité (cosinus complémentaire).
- **Seuil de publication : 85/100, relevé à 90 si le taux d'indexation de la dernière cohorte est sous 70 %** (§ 10).
- Un contenu entre 70 et 84 est `a_corriger` : renvoi au rédacteur (2 passes au plus, plafond de coût existant de 3 $ par article), puis relecture humaine.
- Sous 70, ou avec un bloquant : `bloque`, avec motif en français simple.
- **Pourquoi 85** : le seuil actuel de 75 mesure surtout la forme (titre, méta, longueur). Les critères nouveaux mesurent le fond. Le seuil est un **point de départ à calibrer** sur le palier 0 (§ 10), pas une valeur démontrée. [hypothèse]

## 5. Décision finale

```
publiable  = aucun bloquant  ET  note ≥ seuil  ET  B16 favorable  ET  critères non évalués = 0 (bloquants)
a_corriger = aucun bloquant dur  ET  70 ≤ note < seuil   (ou bloquant « corrigeable » : B08, B11, B13)
bloque     = au moins un bloquant dur (B01-B04, B09, B12, B14, B15, B17)  OU  note < 70
```

- **Dérogation humaine** : permise seulement sur les critères marqués « Oui » du tableau 4.1, avec **motif écrit, nom de l'approbateur et date** dans la table des verdicts. Compteur visible à l'écran. Plus de 5 % de dérogations sur 28 jours déclenche une alerte : la porte est trop dure ou trop contournée.
- **Approbation groupée** : exclut tout contenu `bloque` ou `a_corriger`. Plus jamais de validation par la note seule.
- **Relecture humaine échantillon** : voir § 6.4.

## 6. Vérification des faits

Google a écrit le 01/10/2026 qu'il est « critical » de faire vérifier manuellement les faits et de relire tout contenu généré par IA, y compris les métadonnées. Il ne définit pas « manuellement ». [confirmé, § 14]

### 6.1 Extraction

Une fonction déterministe extrait les **affirmations vérifiables** : nombres, pourcentages, montants, dates, noms de textes (« règlement (UE) 2026/1744 »), noms d'organismes, durées. Chacune doit être associée dans le même paragraphe à une **source** (lien externe + éditeur + date de la source) ou à un **fait canonique** interne (`kb/chiffres-verifies.ts`, `pricing.ts`, `journee-ia-commun.ts`).

### 6.2 Contrôle en trois niveaux

1. **Interne, déterministe** : un fait canonique doit être identique à sa source unique (B03).
2. **Source retrouvée** : le worker récupère la page citée (liste blanche de domaines : Insee, Bpifrance, légifrance/EUR-Lex, CNIL, DGE, France Num, Google Search Central, éditeurs d'études datés) et vérifie que **le chiffre apparaît** dans la page. Source injoignable = non évalué = bloquant (§ 3, règle 2).
3. **Recoupement IA** : le fact-check Claude avec recherche web existe déjà ; il devient **obligatoire** (plus « derrière un drapeau »), et son score alimente B02. Il **ne remplace pas** les niveaux 1 et 2.

### 6.3 Liste de contrôle réglementaire datée

Fichier versionné, relu par un humain à chaque changement, avec la **date de dernière relecture** (si > 90 jours, avertissement sur l'écran, et blocage des contenus qui touchent le sujet au-delà de 180 jours).

| Sujet                    | Fait de référence au 27/11/2026                                                                                                                                                                  | Piège à bloquer                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| AI Act, article 4        | Applicable depuis le 02/02/2025. L'Omnibus numérique sur l'IA (règlement (UE) 2026/1744, en vigueur le 27/07/2026) l'assouplit : « promouvoir » la maîtrise de l'IA. **Formulation exacte à relire au JO.** | Présenter la formation comme une **obligation stricte** par salarié |
| AI Act, haut risque      | Obligations de l'annexe III reportées au 02/12/2027 (même source, à relire)                                                                                                                      | Donner l'ancienne échéance                                       |
| Qualiopi                 | Usage du logo selon la charte, avec la mention des catégories d'actions certifiées                                                                                                              | Logo sans catégorie ; certification non établie                  |
| Financement (OPCO, CPF)  | Toujours au conditionnel, renvoi vers l'OPCO, **aucune promesse de prise en charge** (règle code `financement-100`, `financement-public`)                                                       | « Financé à 100 % »                                              |
| Usage de l'IA en PME     | Insee Première n° 2120 (07/2026) : 18 % des entreprises de 10 salariés ou plus utilisent l'IA en 2025, 15 % chez les 10-49 salariés. Bpifrance Le Lab (06/2025) : 32 % utilisent réellement l'IA | Chiffre sans millésime ni source                                 |

### 6.4 Relecture humaine : dosage

Google ne chiffre rien. Le dosage proposé est une **hypothèse prudente** :

| Palier (§ 10) | Relecture humaine                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------- |
| 0 à 2         | **100 %** des contenus, avec l'écran « Porte qualité » qui présente verdict, faits et sources       |
| 3 à 4         | 100 % des contenus qui touchent réglementation ou financement ; **30 %** tirés au sort pour le reste |
| 5 à 7         | 100 % réglementation et financement ; **10 %** tirés au sort ; 100 % des contenus à note 85-88      |

À 100 contenus par jour, 100 % de relecture est impossible : ce point est un **garde-fou naturel du volume** (§ 10.5).

## 7. Doublons, cannibalisation, intention

### 7.1 Registre des intentions (avant d'écrire)

Nouvelle table `ContentIntention` : requête principale normalisée, **intention** (informationnelle, décision, financement, réglementation, comparaison…), persona (dirigeant de PME de 10 à 250 salariés), sous-questions attendues (3 à 5), page type, **page propriétaire** (URL, quand elle existe), état (`libre`, `reservee`, `couverte`, `a_fusionner`).

- **Une intention = une page.** Avant d'appeler le modèle d'écriture : si l'intention est `couverte` ou `reservee`, la tâche est **annulée** ou transformée en **mise à jour** de la page propriétaire (mécanisme du mode « mise à jour » existant).
- Le registre est alimenté par la carte des requêtes existante (`strategie/carte-requetes.ts`, « une requête = une URL »), la Search Console (§ 7.3) et les sous-questions que le brief génère.
- **Le stock d'intentions `libre` plafonne le rythme** (§ 10.5) : sans intention libre validée, aucune génération n'est lancée.

### 7.2 Après écriture : embeddings du brouillon

- Calcul de l'embedding du **brouillon avant publication** (aujourd'hui seulement après) avec le fournisseur déjà configuré, requête `<=>` sur `Article.embedding`.
- Seuils existants dans le code : doublon 0,85, proche 0,80. Les pratiques d'audit publiques vont de 0,85 à 0,95 selon l'outil [hypothèse, § 14]. **Départ : bloquer à 0,85 ; entre 0,80 et 0,85 : alerte « fusion à étudier »** ; calibrage sur 50 paires étiquetées à la main pendant le palier 0.
- Pour les contenus **hors articles** (FAQ extraites, villes, fiches), même contrôle sur leur table respective (§ 11).
- Le comparateur doit aussi couvrir les **contenus en file** (pas seulement publiés), pour que deux brouillons du même jour ne se doublonnent pas.

### 7.3 Search Console

- Dépend des PR P2 à P4 du pilotage (historique jour × page × requête). **Tant qu'elles ne sont pas livrées, ce contrôle est « non évalué »** et le palier maximal est 2.
- Règle : si une **page existante** reçoit déjà des impressions pour la requête cible (position ≤ 20), la tâche devient une **mise à jour** de cette page, pas une nouvelle page.
- Règle : si, après publication, **deux URL alternent** sur la même requête (détecteur `detecterCannibalisation`, déjà fusionné et non branché), un **signalement de fusion** est créé pour un humain. **Aucune URL ne change automatiquement** (principe 5 du plan).
- Le site est jeune (~428 impressions par semaine en août) : la Search Console ne détecte **presque rien** avant des semaines. Le contrôle sémantique (§ 7.2) est donc le vrai garde-fou du début.

### 7.4 Intention de recherche

La porte vérifie que le **format** répond à l'intention déclarée : une question « comment financer » appelle des étapes et un tableau, pas un article d'opinion. Le contrôle existant `search-intent-validator.ts` est conservé et son résultat entre dans la note.

## 8. Apport original exigé (B07)

Un contenu doit contenir **au moins 2 apports distincts**, chacun vérifié et marqué dans le texte source (balise interne retirée au rendu) :

| Type | Exigence vérifiable                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Exemple concret de PME française** | Secteur, taille (effectif), situation, étapes, résultat chiffré **ou** « exemple type » explicitement étiqueté. **Jamais présenté comme un client réel s'il ne l'est pas** (règles `temoignage-axion`, `citation-temoin`, `preuve-sociale-vague`). |
| **B. Chiffre sourcé**                    | Un nombre avec source primaire datée (Insee, Bpifrance, texte officiel), contrôlé au § 6.2. Une étude pertinente est utile ; une compilation de chiffres déjà cités partout ne suffit pas seule.        |
| **C. Angle PME française**               | Un point propre au contexte français que les contenus génériques anglophones n'ont pas : OPCO, AI Act et calendrier français, Qualiopi, obligations de l'employeur, fiscalité, contrat de travail.      |
| **D. Donnée propre à Axion-IA**          | Une donnée **réelle et agrégée** (Diagnostic IA anonymisé, Observatoire). Interdit sans donnée réelle (règle `stat-axion`). Tant qu'aucune donnée n'existe, ce type est **indisponible**, pas simulé. |

Contraintes :

- A seul ne suffit pas : **A + B**, **B + C** ou **A + C** sont les combinaisons minimales de départ (D compte comme un apport supplémentaire quand il existe).
- Un exemple « type » doit être **plausible et utile** ; un exemple inventé qui ressemble à un client est un faux témoignage et bloque (B01).
- Le brief (équipe éditoriale) doit **réserver** les apports **avant** l'écriture : si aucun apport B ou C n'est disponible pour une intention, l'intention reste `libre` mais **non générable** (pas assez de matière).

## 9. Communication, appel à l'action, structure pour les IA

### 9.1 Règles de communication

Source unique : `src/lib/contenu/interdits-publication.ts`. **La porte appelle cette liste, elle ne la duplique pas.**

| Règle demandée                          | Règle de code déjà en place                                              | Vérification de la porte                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Jamais « Grenoble »                     | `grenoble`, `ancrage-local`                                              | Titre, méta, corps, alt, JSON-LD, URL, noms de fichiers d'images                          |
| Pas de faux témoignage                  | `temoignage-axion`, `citation-temoin`, `preuve-sociale-vague`, `stat-axion` | Plus la règle B07 (exemple étiqueté)                                                      |
| Pas de prix barré                       | `prix-barre`                                                             | Y compris dans le HTML et les images alternatives                                         |
| Aucun frais de déplacement              | `frais-deplacement`, `frais-venue`                                       | Idem                                                                                      |
| Prix, durée, programme                  | `prix hors source unique`, barrière Journée IA                           | B03 : comparaison à `pricing.ts` et `journee-ia-commun.ts`                                |
| « Partout en France »                   | **Formule imposée** par le code (`interdits-publication.ts:213, 222, 293`, `positionnement.ts:20`) | **Décision D1 ci-dessous**                                                                |

**Décision D1 (à trancher par Will).** La consigne demande de ne jamais écrire « partout en France ». Le code impose au contraire cette formule pour remplacer toute mention locale. Les deux ne peuvent pas être vrais en même temps. Trois lectures possibles :

- (a) la consigne veut dire « jamais **seulement** en France / jamais de promesse de présence physique partout » ; le code est juste et la porte n'ajoute rien ;
- (b) la consigne veut bannir la formule entière ; il faut alors **changer la doctrine du code** (et ses tests) avant la porte, et définir la formule de remplacement ;
- (c) la consigne est une erreur.

**En attendant la réponse**, la porte reprend la doctrine du code (lecture a) et la formule reste autorisée. Le critère est un **paramètre de la porte** (liste de formules interdites), pas un texte figé : la bascule vers (b) est une PR d'une ligne.

### 9.2 Appel à l'action : un seul, relié à l'intention, varié

- **Un seul appel principal par contenu**, choisi par l'intention déclarée :
  - décision, évaluation, « par où commencer » : **Diagnostic IA de 45 minutes** (`/appel`) ;
  - formation, découverte, équipe : **renseignements Journée IA** (page dédiée) ;
  - informationnel pur sans intention d'achat : appel discret vers le Diagnostic.
- **Variété** : la phrase d'appel d'un contenu ne doit pas être identique (similarité ≥ 0,8) à celle des 20 précédents du même type (W08). Les angles d'entrée de `positionnement.ts` (8) sont la réserve de variété.
- **Tension à lever (décision D2)** : le prompt demande d'expliquer la Journée IA, mais toute mention de la Journée IA dans le corps généré **force la relecture humaine** (`relecture-journee-ia.ts`). Proposition : autoriser un **bloc normalisé**, construit à partir de `journee-ia-commun.ts`, et garder la relecture humaine pour tout texte libre qui la mentionne.

### 9.3 Charte visuelle

La couleur de marque est le **terracotta** (jeton `@theme`, pas un code recopié). Contrôle (W10, avertissement) : les visuels générés (images dessinées, graphiques, bandeaux) utilisent les jetons du thème ; une image principale sans rapport avec le sujet est refusée. **Le terracotta n'est pas contrôlable dans le texte** : il relève de la génération d'images et des gabarits de page, pas de la porte de contenu.

### 9.4 Auteur et E-E-A-T

Aujourd'hui, la signature est « Plume IA d'Axion-IA », publiée en `Organization` (test `plume-ia-pas-une-personne`). Cela évite de faire passer un texte de modèle pour une personne. Pour l'E-E-A-T, la porte exige :

- une **relecture nominative** par une personne réelle d'Axion-IA, affichée (« relu par … le … ») **seulement quand elle a eu lieu** ;
- jamais de faux auteur, jamais de qualification inventée.

C'est un **point à trancher (D3)** : qui relit, et en son nom propre ? Sans cela, le palier 3 et au-delà (relecture par échantillon) pose un problème d'honnêteté de l'affichage « relu par ».

### 9.5 Structure lisible par les IA

À mesurer dans W01 à W07, **sans en faire un dogme** : Google écrit (guide de mai 2026) que le découpage en fragments, les schémas spécifiques et `llms.txt` ne sont pas nécessaires [confirmé]. Les études GEO sont corrélationnelles, sauf Princeton/IIT Delhi qui est simulée [§ 14]. Retenu :

- réponse directe en tête, titres en questions, tableaux et listes **parce qu'ils servent le lecteur** ;
- données structurées **concordantes** avec le texte (exigence Google) ;
- **`llms.txt` n'est pas un critère** (étude Ahrefs de mai 2026 : 97 % des fichiers jamais lus) ;
- **FAQPage décorative proscrite** : Google a retiré les résultats enrichis FAQ, et une FAQ non visible ou non utile est un risque ;
- `dateModified` honnête (B14) : une étude montre un biais de fraîcheur des assistants, mais changer la date sans changer le texte n'a aucun effet démontré et serait trompeur.

## 10. Montée progressive du rythme

### 10.1 Paliers

| Palier | Nouveaux contenus publiés par jour (plafond) | Durée minimale | Relecture humaine (§ 6.4) |
| ------ | -------------------------------------------- | -------------- | ------------------------- |
| 0      | 0 (**mode ombre**) : la porte écrit des verdicts, le pipeline actuel continue à son rythme actuel **plafonné à 3** | 14 jours | 100 % |
| 1      | 3                                            | 14 jours       | 100 %                     |
| 2      | 5                                            | 14 jours       | 100 %                     |
| 3      | 10                                           | 21 jours       | 30 % + 100 % sensibles    |
| 4      | 20                                           | 21 jours       | 30 % + 100 % sensibles    |
| 5      | 40                                           | 28 jours       | 10 % + 100 % sensibles    |
| 6      | 70                                           | 28 jours       | 10 % + 100 % sensibles    |
| 7      | 100                                          | —              | 10 % + 100 % sensibles    |

À ce rythme, le palier 7 n'est pas atteint avant **environ 6 mois**. C'est voulu : [hypothèse] un pic soudain n'est pas pénalisé en tant que tel, mais il rend visible un défaut de qualité qui peut s'étendre au site entier (John Mueller sur le « programmatic SEO » et les pages de faible valeur qui pèsent sur le site, § 14).

**Le plafond de publication de la porte s'applique en plus** des plafonds existants (`daily_generation_cap`, `MAX_PUBLISH_PER_DAY`, rampe 150/300/1 000, quotas Claude) : on prend **le minimum**. La rampe existante, qui monte jusqu'à 1 000, est donc **neutralisée** par la porte tant que le palier est bas.

### 10.2 Indicateurs de passage (cohorte = contenus publiés la même semaine)

Un passage au palier suivant est **proposé** quand toutes les conditions sont vraies sur la **dernière cohorte arrivée à 28 jours** ; **Will valide d'un clic**, jamais d'automatisme.

| Indicateur                                                                            | Seuil de départ [hypothèse à calibrer] | Source                                  |
| ------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------- |
| Pages de la cohorte **indexées** à 28 jours                                           | ≥ 70 %                                 | Inspection d'URL (P5 du pilotage)       |
| Part « Explorée, actuellement non indexée » de la cohorte                             | ≤ 20 %                                 | Inspection d'URL                        |
| Pages de la cohorte avec **au moins 1 impression** à 28 jours                         | ≥ 50 %                                 | Search Console (P4)                     |
| Impressions par page indexée, comparées à la cohorte précédente                       | pas en baisse de plus de 30 %          | Search Console                          |
| Pages **anciennes** (hors cohorte) : impressions sur 28 jours                         | pas en baisse de plus de 15 % hors tendance du site | Search Console                 |
| Action manuelle ou message de qualité dans la Search Console                          | **aucun**                              | Saisie manuelle de Will (pas d'API fiable) |
| Taux de dérogation humaine                                                            | ≤ 5 %                                  | Table des verdicts                      |
| Note moyenne de la porte sur la cohorte                                               | ≥ 88                                   | Table des verdicts                      |

Les **clics** ne sont pas un critère de passage : à ~428 impressions par semaine pour tout le site, ils sont statistiquement muets. Les indicateurs fiables au début sont l'**indexation** et les **impressions par page**, avec leurs planchers (`PLAN.md` § 4.2). En dessous du plancher statistique, l'écran affiche « pas assez de données » et **le palier ne monte pas** (principe « mesurer avant d'agir »).

### 10.3 Coupe-circuit (retour automatique en arrière)

Retour au **palier précédent**, publications mises en pause, alerte à Will (une seule, anti-répétition de 30 jours par motif) quand :

- l'indexation d'une cohorte à 28 jours tombe **sous 50 %** ;
- la part « Explorée, non indexée » **gagne plus de 15 points en une semaine** ;
- les pages anciennes perdent **plus de 25 %** d'impressions hors tendance du site, dans les 21 jours qui suivent une vague ;
- Will saisit une **action manuelle** ;
- le taux de dérogation dépasse 10 % ;
- une faute de doctrine (B01) **atteint le public** (échec du point final) : arrêt complet et enquête.

### 10.4 Élagage

Toute page publiée avec **0 impression après 90 jours** passe en revue : améliorer, fusionner (signalement) ou `noindex` (signalement). Mueller indique que les pages faibles pèsent sur le site entier [§ 14]. Les pages de la catégorie `legal` et `conversion` sont exclues (règle du détecteur « jamais affichée »).

### 10.5 Ce que la porte plafonne vraiment

`quota du jour = min(palier, intentions libres générables, capacité de relecture humaine, plafonds existants)`.

À 100 contenus par jour, il faudrait 100 intentions réellement distinctes, chacune avec ≥ 2 apports originaux vérifiés, **chaque jour**. [hypothèse] C'est le vrai plafond : une thématique « IA pour dirigeants de PME » ne se fragmente pas à l'infini sans doublonner. **Recommandation : traiter 100 par jour comme un horizon à valider au palier 5**, et accepter que le rythme stable soit nettement inférieur.

## 11. Chemins de publication et contournements à fermer

Point de publication unique des articles : `content-publish-worker.ts`, `executePublishPipeline` (l. 302), transaction l. 915-1128. Trois sources alimentent la file : `content-gen-worker.ts:2073`, `content-quality-improver-worker.ts:614`, `actions/content-gen/review.ts:100`.

| #   | Chemin                                                                                | Risque                                                    | Action                                                       |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | `review.ts:267` approbation groupée sur la note seule                                  | Contourne plagiat, doublon, longueur                      | Exclure `a_corriger` et `bloque`                             |
| 2   | `judge-outcome.ts:52-58` verdict « publish » sans revérifier la note                   | Publier sous 75                                           | La porte décide, le juge n'est qu'un critère (B16)           |
| 3   | Note ≥ 75 jamais jugée                                                                 | Aucune critique adverse sur la majorité des contenus      | B16 s'applique à **tous**                                    |
| 4   | `CONTENT_QUALITY_GATE_ENABLED` éteint                                                  | Complétude non bloquante                                  | Règles reprises dans B11, bloquantes                         |
| 5   | `content-qa-extract-worker.ts:126-150` (FAQ publiées directement)                      | Contenu public sans porte                                 | Porte « allégée » (B01, B02, B06) avant écriture             |
| 6   | `content-fact-check-worker.ts:319-347` (réécriture du corps publié)                    | Aucun contrôle des interdits                              | Porte mode « mise à jour »                                   |
| 7   | `equipe/mise-a-jour-reel.ts:184-188`                                                   | Corps écrasé sans copie ; pas de retour arrière           | Historique de révisions (P13 du pilotage) puis porte         |
| 8   | `actions/content-gen/article.ts:177, 381` ; `features/admin-blog/actions.ts:304`        | Édition et dépublication manuelles                        | Porte en **avertissement visible** (un humain assume) ; B01 reste bloquant |
| 9   | `GeneratedVilleCopy` approuvée par script, `knowledge/ingest.ts:203`                   | Contenu public hors pipeline                              | Hors périmètre du lot 1 ; recensé, traité au lot 3           |

⚠️ Chemin 8 : l'édition manuelle par un administrateur ne doit pas être bloquée à 100 % (Will doit pouvoir corriger une coquille en urgence), mais **B01 (doctrine) et B03 (faits canoniques)** s'y appliquent toujours.

## 12. Écran de console « Porte qualité », en adéquation avec le back-end

Emplacement : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/porte-qualite/`, entrée dans `src/lib/admin-nav.ts` près de « Qualité ». Toutes les actions passent par `requireAdmin`. Aucun JavaScript public.

### 12.1 Règle d'adéquation : l'écran n'a pas de vérité propre

1. **Le registre `CRITERES` est la source unique** : l'écran lit ce registre pour lister critères, libellés, seuils et gravités. Ajouter un critère le fait **apparaître** à l'écran sans autre PR.
2. **Les réglages** (seuil de note, quotas, paliers, seuils d'indexation) vivent dans **une seule clé** `ContentGenConfig` `porte_qualite`, validée par **un seul schéma Zod** importé par le back-end **et** par l'action de l'écran.
3. **Les verdicts affichés sont les lignes de la table** `ContentQualityVerdict`, sans recalcul côté écran.
4. **Trois tests de concordance** (verrouillent l'adéquation) :
   - tout critère du registre a un libellé non vide et une fonction, et apparaît dans la sortie de l'action de lecture ;
   - toute clé de réglage de l'écran existe dans le schéma du back-end, et réciproquement ;
   - un verdict enregistré par la porte est relu à l'identique par l'écran (aller-retour).
5. **`null` s'affiche « indisponible »**, jamais 0 (principe 4 du plan).
6. **Un test refuse un drapeau d'écran sans effet back-end** (la leçon de `CONTENT_QUALITY_GATE_ENABLED`).

### 12.2 Quatre onglets

| Onglet                  | Contenu                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vue d'ensemble**      | Palier actuel, quota du jour (publiés / autorisés), état du coupe-circuit, indicateurs de la dernière cohorte avec leur seuil, **bouton « Proposer le palier suivant »** (désactivé si un indicateur est « indisponible » ou sous son plancher), liste des intentions libres générables |
| **Contenus**            | Liste des verdicts : titre, type, note, critères en échec avec la phrase en français et la **preuve** (extrait, source, cosinus et titre du voisin), **actions** : corriger, relire, dérogation motivée (si permise), retirer. Filtre par verdict |
| **Cohortes**            | Par semaine : publiés, indexés à 7, 14, 28 jours, impressions, dérogations, note moyenne. Les courbes sont des **tableaux** avant d'être des graphiques                                                      |
| **Réglages et journal** | Seuils, quotas, liste « formules interdites » (D1), version de la porte, journal des changements (qui, quand, avant, après), liste des **dérogations**                                                    |

L'écran `review-queue/[id]` affiche aussi le verdict de la porte (aujourd'hui il n'affiche ni barrières ni fautes de doctrine).

## 13. Données à créer (migrations additives)

| Table / colonne                         | Contenu                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ContentQualityVerdict`                 | `id`, `jobId?`, `articleId?`, `contentKind`, `versionPorte`, `mode` (`ombre`, `reel`, `maj`), `verdict`, `note`, `criteres` (JSON), `seuilsFiges` (JSON), `embeddingVoisinId?`, `cosinusMax?`, `decidePar?`, `motifDerogation?`, `createdAt` |
| `ContentIntention`                      | Registre § 7.1                                                                                                                      |
| `PorteCohorte` (instantané hebdomadaire) | Semaine, publiés, indexés à 7/14/28 j, impressions, note moyenne, dérogations. Écrit par le worker, **lu** par l'écran               |
| `ArticleTranslationRevision`            | Copie avant écrasement : retour arrière des mises à jour (déjà prévu par le pilotage, P13). **Prérequis du palier 3**                |
| `ContentGenConfig` clé `porte_qualite`  | Réglages § 12.1, avec valeurs par défaut sûres (palier 0)                                                                           |

Toutes nullables ou avec défaut. **Aucune valeur ajoutée aux énumérations `ContentGenJobStatus` / `ReviewStatus`.**

## 14. Sources et niveau de confiance

Recherche web du 27/11/2026. ⚠️ Les pages de `developers.google.com` n'ont pas pu être ouvertes en entier : les affirmations « confirmées » reposent sur les extraits renvoyés par la recherche. **Relire les pages d'origine avant toute décision engageante** (en particulier celles marquées ‡).

### 14.1 Confirmé

- **Contenu produit en masse** : politique de mars 2024, appliquée par algorithme et par action manuelle, quel que soit le mode de production. Google Search Central, « March 2024 core update and new spam policies » (03/2024).
- **15/05/2026** : les politiques anti-spam couvrent aussi les réponses génératives (AI Overviews, AI Mode) ; aucune nouvelle catégorie. Search Engine Land, SERoundtable (05/2026).
- **01/10/2026** : il est « critical » de faire vérifier manuellement les faits et de relire tout contenu généré, métadonnées comprises. SERoundtable, Search Engine Land (10/2026) ‡.
- **Guide d'optimisation pour l'IA générative de Google** (vers 05/2026) : `llms.txt`, découpage en fragments et schémas spécifiques non nécessaires ; GEO et AEO « still SEO ». Google Search Central ‡.
- **Search Console, rapports « Generative AI performance »** (annonce 03/06/2026, ouverts à tous le 31/08/2026) : **impressions uniquement**, sans clics ni requêtes, données depuis le 18/05/2026.
- **Quality Rater Guidelines du 23/01/2025** : définition de l'IA générative ; contenu produit en masse sans valeur ajoutée = « Lowest ». Les évaluateurs n'agissent pas directement sur le classement.
- **Déclarations de Google** : publier en masse n'est pas du spam en soi ; les sites de « programmatic SEO » peuvent perdre la confiance de Google, longue à regagner ; les pages anciennes de faible valeur peuvent peser sur le rétablissement d'un site (Mueller, SERoundtable, SEJ).
- **Doublons** : Google les regroupe et choisit une URL canonique ; il insiste sur des pages réellement distinctes.
- **Indexation** : « Explorée / Découverte, actuellement non indexée » : cause fréquente = qualité globale du site (Splitt, Mueller).
- **Crawlers** : OAI-SearchBot (ChatGPT Search), GPTBot (entraînement), ChatGPT-User ; ClaudeBot, Claude-SearchBot, Claude-User. Respect de robots.txt. Aucun grand moteur n'a documenté `llms.txt` comme signal.
- **Marché** : Insee Première n° 2120 (07/2026), Bpifrance Le Lab (06/2025) ; règlement (UE) 2026/1744 (JO du 24/07/2026, en vigueur le 27/07/2026) ‡.
- **Études publiées** (méthodes non comparables) : Ahrefs (−58 % de CTR en position 1 avec AI Overview, déc. 2025) ; Seer Interactive (CTR organique 1,3 % → 2,4 %, fév. 2026) ; Ahrefs 2026 (38 % des pages citées dans le top 10 contre 76 % en 2025) ; Ahrefs mai 2026 (JSON-LD sans gain notable de citations) ; Ahrefs mai 2026 (97 % des `llms.txt` jamais lus) ; Princeton/IIT Delhi KDD 2024 (statistiques et citations, jusqu'à +40 % de visibilité, moteur simulé).

### 14.2 Hypothèses

- Aucun seuil officiel de volume, de cadence, de cosinus ou d'indexation. **Tous les seuils de ce document sont des points de départ à calibrer.**
- Seuils de similarité cosinus : 0,85 à 0,95 selon les outils (Screaming Frog 0,95, tutoriels 0,90, praticiens 0,85) ; dépendent du modèle d'embeddings.
- « Information gain » : brevet réel (2018), usage en production jamais confirmé.
- Un pic de publication est pénalisé en soi : **non démontré**.
- Spam update du 24/09/2026 : source unique (SEJ), entrée du tableau de bord non vue.
- Révisions de septembre 2025 et octobre 2026 des Quality Rater Guidelines : non confirmées.
- Formats favorisant la citation (réponse en tête, titres en questions, tableaux, auteur, données originales) : consensus de praticiens, sans étude causale. Seul appui expérimental : statistiques et citations (Princeton).
- Intentions de recherche des dirigeants (financement, réglementation, usage, confiance) : plausibles, **non mesurées**. À mesurer dans la Search Console.
- Calendrier exact de l'article 4 après l'Omnibus : formulation à relire au Journal officiel.

## 15. Découpage en petites PR

Principes : une PR = une idée, aucune ne change un comportement public avant le drapeau, chaque PR est brouillon pendant le travail (`AGENTS.md`), les migrations sont additives et livrées **seules**, les drapeaux sont `"true"` exact et éteints par défaut.

| PR   | Contenu                                                                                                                              | Dépend de         | Risque |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------ |
| Q0   | **Décisions D1 à D5** (§ 17) inscrites dans un ADR. Aucun code                                                                        | Will              | —      |
| Q1   | Migration additive : `ContentQualityVerdict`, `PorteCohorte`, clé `porte_qualite` (défauts palier 0). Aucune lecture                  | —                 | Faible |
| Q2   | Squelette pur de la porte : registre `CRITERES`, types, schéma Zod des réglages, décision (§ 5). Critères B01, B03, B08, B11, B13, B14 (déjà calculables) | Q1                | Faible |
| Q3   | Critères « faits » : extraction des affirmations, liste de contrôle réglementaire datée, vérification de la source retrouvée (B02, B04, B09) | Q2                | Moyen  |
| Q4   | Embedding du brouillon avant publication et comparaison (B06) ; seuils et 50 paires de calibrage                                       | Q2                | Moyen  |
| Q5   | Registre `ContentIntention` (migration + remplissage depuis la carte des requêtes) et critère B05                                       | Q1, Q2            | Moyen  |
| Q6   | Apport original (B07) : réservation par le brief, marquage, contrôle ; exemple « type » étiqueté                                      | Q2                | Moyen  |
| Q7   | Branchement **en ombre** : `gen-worker` + boucle d'amélioration appellent la porte, écrivent le verdict, **ne bloquent rien**           | Q2 à Q6           | Faible |
| Q8   | Écran « Porte qualité », onglets 1 à 2 (lecture seule) + les trois tests de concordance                                              | Q7                | Faible |
| Q9   | Palier 0 : analyse de l'écart entre verdicts d'ombre et pipeline actuel ; calibrage des seuils ; rapport dans `docs/`                  | Q7, Q8            | —      |
| Q10  | **Point final P3** dans `content-publish-worker.ts` (mode réel, drapeau `CONTENT_PORTE_QUALITE`) ; approbation groupée corrigée ; juge ne décide plus | Q9, Will          | **Élevé** |
| Q11  | Cadence : paliers, quota du jour (B17), **clé `min()` avec les plafonds existants**, raccordement du quota équipe éditoriale           | Q10               | Moyen  |
| Q12  | Cohortes : worker de l'instantané hebdomadaire et onglet 3 (dépend de l'ingestion Search Console P2 à P5 du pilotage ; sinon « indisponible ») | Q10, pilotage P4-P5 | Moyen |
| Q13  | Coupe-circuit, proposition de passage de palier, bouton de Will, alerte unique                                                        | Q11, Q12          | Moyen  |
| Q14  | Écran, onglet 4 : réglages, journal, dérogations ; liste des formules interdites paramétrable                                         | Q10               | Faible |
| Q15  | Chemins après publication : porte mode « mise à jour » sur fact-check réécrivain, mise à jour, FAQ extraites (après `ArticleTranslationRevision`, P13) | Q10, P13          | Moyen  |
| Q16  | Élagage à 90 jours (signalements) et suivi à J+28 / J+90                                                                              | Q12               | Faible |
| Q17  | Lot hors articles : villes, fiches de base de connaissances                                                                           | Q15               | Moyen  |

Chaque PR a au minimum : un test de non-régression de la doctrine (`interdits-publication`), un test du cas « source indisponible = non évalué » et, pour Q7, Q10, Q15, un test de **chemins de contournement** (aucun chemin ne publie sans verdict quand le drapeau est allumé).

**Ordre recommandé.** Q0, Q1, Q2, Q7 en brouillon d'abord, puis Q3 à Q6 en parallèle, Q8, **14 jours de palier 0**, puis Q10. Les PR Q10 et Q15 ne se fusionnent jamais le même jour (fenêtre app/worker).

## 16. Critique et réserves

Voir `.pr/docs-porte-qualite-contenus.md` pour le verdict de la critique indépendante et la liste des corrections intégrées. Les risques que cette conception **assume** :

- **Faux négatifs de la porte** : un seuil à 85 peut refuser de bons contenus ; la calibration du palier 0 existe pour cela.
- **Relecture humaine = goulot** : voulu (§ 10.5).
- **Données Search Console pauvres** (site jeune) : les paliers s'appuient d'abord sur l'**indexation** et un contrôle sémantique interne, pas sur les clics.
- **Dépendance au pilotage** : Q12 et Q13 attendent P2 à P5 ; sans eux, le palier maximal est 2.
- **Dépendance aux faits en ligne** : une source qui change ou disparaît bloque la page ; prévu comme « non évalué = bloquant ».

## 17. Décisions à demander à Will

| Id  | Question                                                                                                                                                  | Par défaut dans la conception                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| D1  | « Partout en France » : consigne vs formule imposée par le code (§ 9.1)                                                                                    | Doctrine du code (formule autorisée)               |
| D2  | Journée IA dans les contenus : bloc normalisé autorisé, relecture humaine pour le texte libre (§ 9.2)                                                      | Bloc normalisé                                     |
| D3  | Qui relit, et peut-on afficher « relu par » en nom propre (§ 9.4) ?                                                                                        | Aucun nom affiché tant qu'il n'y a pas de relecteur |
| D4  | Les paliers (§ 10.1) et leurs durées minimales : acceptés ?                                                                                                | Oui, avec validation à chaque passage              |
| D5  | Modèle d'écriture : la voie Claude (Sonnet 5.5 écrit, Opus 5.5 relit) pour les contenus soumis à la porte, au lieu de `gpt-4o` qui écrit **et** juge ?     | Voie Claude, plafonds existants (10 $/jour, 200 $/mois) à relever pour le palier 3 et au-delà |
| D6  | Qui saisit les actions manuelles de la Search Console (pas d'API fiable) ?                                                                                 | Will, depuis l'écran                               |
