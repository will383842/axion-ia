# Porte qualité des contenus générés : conception

> Phase de conception, 27/11/2026. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**
> Ce document complète `AUDIT.md`, `PLAN.md` et `DECOUPAGE.md` du même dossier (pilotage SEO et GEO). Il s'appuie sur :
>
> - une recherche web sur l'état de Google et des moteurs IA fin 2026 (§ 14) ;
> - une lecture du code du générateur (§ 2, § 11) ;
> - une critique indépendante (§ 16).
>
> **Décisions de Will (27/11/2026), qui priment sur tout le reste du document :**
>
> 1. **La qualité passe avant le volume. Il n'y a aucun quota** : aucune obligation de publier un nombre de contenus par jour. Le rythme découle de ce qui passe la qualité. On accélère **uniquement si Google et les IA suivent** (indexation, affichages, clics, citations IA).
> 2. **La porte est le dernier filet, pas l'outil principal.** La qualité se construit à la génération, par la chaîne éditoriale IA (`CONCEPTION-CHAINE-EDITORIALE-IA.md`, branche `docs/chaine-editoriale-ia`) : besoins réels, brief, faits sourcés, rédacteur, critique de dirigeant de PME, vérificateur de faits, éditeur, puis la porte. Sur un contenu issu de la chaîne, la porte doit presque toujours dire oui ; un taux de refus élevé est un signal d'alarme sur la chaîne amont.
> 3. **« Partout en France » est une formule voulue et autorisée.** Ce qui est interdit, c'est « Grenoble » (sauf mentions légales).
> 4. **Les refus et leurs raisons sont enregistrés** pour nourrir l'amélioration continue (visible en console).
> 5. **Autres règles de marque** : pas de faux témoignage, pas de prix barré, aucun frais de déplacement sur les pages, pas de réservation directe en ligne, couleur terracotta, aucun avocat (Will tranche lui-même : pas de « relecture avocat »).

## 1. En une page

1. **Il n'existe pas de porte unique aujourd'hui.** Il existe une douzaine de contrôles dispersés, dont certains sont éteints ou passifs (§ 2). Un contenu peut être publié par au moins sept chemins qui ne les traversent pas tous (§ 11).
2. **La porte proposée** (le **dernier filet** de la chaîne éditoriale) est un module pur `evaluerPorte(contenu, contexte)` qui rend un verdict `publiable`, `a_corriger` ou `bloque`, avec la liste des critères et leurs preuves. Elle est appelée à **quatre endroits**, dont un **point final obligatoire** dans `content-publish-worker.ts`, par lequel passent tous les articles. En cas d'erreur de la porte, le contenu **n'est jamais publié** (échec fermé).
3. **Deux familles de critères.** Des **bloquants** (un seul suffit à refuser) et des **avertissements** (ils retirent des points). Un contenu est publié s'il n'a aucun bloquant **et** une note d'au moins 85/100 **et** une relecture adverse favorable (§ 5).
4. **Les sources de vérité ne bougent pas.** Les mots interdits restent dans `src/lib/contenu/interdits-publication.ts`, les prix dans `pricing.ts`, la Journée IA dans `journee-ia-commun.ts`. La porte les **appelle**, elle ne les recopie pas.
5. **Aucun quota, aucun objectif de volume.** Le rythme découle de ce qui passe la qualité. Il n'accélère que si Google et les IA suivent (indexation, affichages, clics, citations IA), et un **coupe-circuit automatique** le fait redescendre (§ 10). Will valide d'un clic toute accélération.
6. **La limite du volume est le nombre d'intentions de recherche réellement distinctes** qu'Axion-IA peut couvrir avec un apport original. La porte ne laisse partir que ce qui a une intention libre et des apports vérifiés (§ 7.1, § 10.5) : le volume est un résultat, jamais une cible.
7. **Refus : réécriture ciblée, puis abandon.** Un contenu refusé repart en réécriture ciblée (essais plafonnés), puis est **abandonné, jamais publié faible**. Chaque refus et sa raison sont enregistrés pour la boucle d'amélioration hebdomadaire, visible en console (§ 5.1).

## 2. Ce qui existe déjà (lecture du code, commit `686f6b62` ; les numéros de ligne peuvent avoir glissé : les revérifier au moment de coder)

Légende : **[lu]** vérifié dans le code. Les numéros de ligne sont ceux de ce commit.

### 2.1 Chaîne de génération

- Création des tâches : orchestrateur (cron 15 min, plafond `daily_generation_cap`, 20 par défaut), flux RSS (5 par jour), actions de console. [lu]
- Worker `content-gen-worker.ts` : arrêt d'urgence, base de connaissances prête, dédoublonnage avant appel IA (titre, Levenshtein ≥ 0,85), verrou de mot-clé, génération, retouches déterministes, contrôles, décision de statut. [lu]
- Modèles : OpenAI `gpt-4o` par défaut pour écrire **et** pour juger. Voie Claude (Sonnet 5.5 écrit, Opus 5.5 relit) derrière `CONTENT_GEN_BLOG_CLAUDE`, avec plafonds de 10 $/jour et 200 $/mois. [lu]
- Équipe éditoriale (brief, gardien, vérificateur, mailleur, éditeur SEO, conformité, rédacteur en chef avec note 8,5) : **derrière `CONTENT_EQUIPE_EDITORIALE`, éteint par défaut.** [lu]

### 2.2 Contrôles existants et leur état réel

| Contrôle                                                         | Seuil actuel                           | État                                                                                                                      |
| ---------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Note de qualité (SEO + lisibilité, moins 30 si doctrine)         | ≥ 75 pour publier seul                 | Actif. Ne mesure ni l'utilité, ni l'originalité, ni les faits.                                                            |
| Plagiat (5-grammes) contre les 200 derniers articles             | 0,30 (0,10 actualités)                 | Actif, bloque l'auto-publication.                                                                                         |
| Plan dupliqué (SimHash h2/h3)                                    | Hamming ≤ 4                            | Actif.                                                                                                                    |
| Doublon de sujet (empreinte Voyage)                              | ≤ 8                                    | Actif.                                                                                                                    |
| Accroche trop proche                                             | ≥ 0,6 sur 300 caractères               | Actif.                                                                                                                    |
| Page mince                                                       | < 350 mots (280 avec données riches)   | Actif.                                                                                                                    |
| Longueur des articles longs                                      | ≥ 850 mots                             | Actif.                                                                                                                    |
| Aucun fait de la base de connaissances                           | `kbEntryIds` vide = refus              | Actif.                                                                                                                    |
| Fautes de doctrine (Grenoble, prix barré, faux témoignage, etc.) | Liste dans `interdits-publication.ts`  | Actif, rejoué à la publication.                                                                                           |
| Complétude (réponse directe ≥ 40 mots, FAQ ≥ 4, 2 citations…)    | Seuils dans `data-quality-gate.ts`     | **Journalise seulement** tant que `CONTENT_QUALITY_GATE_ENABLED` n'est pas `"true"`.                                      |
| Fidélité aux fiches de la base                                   | Règles + Claude                        | Derrière `CONTENT_FIDELITY_CHECK`.                                                                                        |
| Fact-check Claude avec recherche web                             | Preuve exigée si le drapeau est allumé | Derrière `CONTENT_GEN_FACTCHECK_CLAUDE`. La porte du score (`minScore 40`) est **passive** à la première publication.     |
| Juge sur 7 dimensions                                            | Publier ≥ 8,5, rejeter < 6,0           | **Ne tourne que sous la note 75**, dans la boucle d'amélioration. Un contenu ≥ 75 n'est jamais jugé.                      |
| Embeddings (pgvector, doublon 0,85, proche 0,80)                 | —                                      | **Calculés après publication.** Non utilisés par la porte avant publication. Le gardien reçoit `voisins: async () => []`. |
| Search Console                                                   | —                                      | Instantané `SiteRoute.gsc*`, une URL à la fois. Pas d'historique. Fonctions par lot (P1) **non branchées**.               |

### 2.3 Les écarts qui comptent

- La porte de complétude est **éteinte** par défaut : la réponse directe, les sources et les faits ne sont pas bloquants. (Une FAQ non obligatoire est voulue : § 4.1 B11.)
- Le juge peut faire publier une note inférieure à 75 (`judge-outcome.ts:52-58`).
- `bulkApproveReviews` (`review.ts:267-345`) approuve **sur la note**, sans regarder pourquoi le contenu était en relecture (plagiat, doublon, moins de 850 mots).
- Aucune vérification des faits **chiffrés** par une source externe avant publication, alors que Google écrit depuis le 01/10/2026 qu'il est « critical » de les vérifier (§ 14).
- Le plafond de 3 nouveaux articles par jour de l'équipe éditoriale n'est branché nulle part ; seul celui des mises à jour l'est. (Ces plafonds existants restent des **limites hautes de sécurité**, jamais des objectifs.)
- Aucune table ne garde les verdicts : on ne peut ni auditer, ni calibrer, ni afficher.

### 2.4 Le générateur injecte lui-même un lien vers `/appel`

`src/server/content-gen/quality/intent-enforcement.ts:67-68` injecte un appel de repli « Réserver un appel avec Axion-IA » vers `/appel` ; `lib/category-hub-content.ts:602` et `generators/v7-phase8-generators.ts:193` pointent aussi vers `/appel`, et `RECOGNIZED_CTA_RE` (l. 51) tient `/appel` et `<button>` pour des appels valides. Or `/appel` est une page de réservation en ligne (contraire à la règle de Will) et B10 refuse tout lien vers `/appel` : sans correction, B10 refuserait chaque article ayant reçu ce repli, et la réécriture ne toucherait pas le lien injecté (fausse alarme « chaîne amont »). **Chemin 10 du § 11, à corriger dans Q2 avant Q7.** La règle `reservation-paiement` (`interdits-publication.ts`) ne capte pas « Réserver un appel » : c'est B10 qui doit le faire.

## 3. Architecture de la porte

```
 chaîne éditoriale IA (besoin → brief → faits → rédacteur → critique → vérificateur → éditeur)
      │
      ▼
 [P1 avant écriture]   intention libre ? doublon ? voisins ?          (§ 7)
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
5. **Mode ombre d'abord** : la porte écrit son verdict sans rien bloquer, pendant la phase d'observation (§ 10.1). On compare ce qu'elle aurait refusé à ce que le pipeline actuel publie.
6. **Pas de nouvelle valeur d'énumération** dans `ContentGenJobStatus` ni `ReviewStatus` (fenêtre app/worker de ~50 min, `AGENTS.md`). Un contenu refusé reste `needs_review` ou `pending` ; le motif est dans la table de verdicts.
7. **Compatibilité des deux sens (app et worker sont deux conteneurs, chacun avec ses propres variables d'environnement).** Toute colonne est nullable. Le code qui lit ou écrit `ContentQualityVerdict` **tolère une table absente** (erreur Prisma `P2021`) : il saute le passage et journalise, sans publier ni bloquer à tort. Le drapeau `CONTENT_PORTE_QUALITE` est allumé **d'abord sur le worker**, au créneau qui suit l'atterrissage de la migration, après vérification en production (`prisma migrate status` et existence de la table, `AGENTS.md`). Si la table est absente alors que le drapeau est allumé, le point final **refuse de publier** (échec fermé) : c'est le seul cas où l'absence bloque.

## 4. Critères

### 4.1 Bloquants (un seul suffit à refuser)

Chaque critère est mesurable, a un identifiant stable (`B01`…), une preuve enregistrée, et un test.

| Id  | Critère                                                                    | Mesure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Seuil de départ                | Dérogation humaine ?     |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| B01 | **Doctrine et communication**                                              | `detecterInterdits` + doctrine de surface (§ 9) sur titre, méta, corps, alt, JSON-LD, FAQ                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 0 faute                        | **Non**                  |
| B02 | **Faits chiffrés sourcés et vérifiés**                                     | Chaque affirmation **statistique, réglementaire ou financière** (pourcentage, montant, effectif, nom et date d'un texte, délai légal) porte une source (URL, éditeur, date) **et** la vérification (§ 6.2) retrouve le chiffre, **nombres normalisés** (« 18 % » = « 18% » = « 18 pour cent »). Les dates et nombres banals (jour de l'événement, « 45 minutes ») relèvent de B03, pas de B02                                                                                                                                                            | 100 % des affirmations ciblées | **Non**                  |
| B03 | **Faits canoniques cohérents**                                             | Prix, durées, programme lus dans `pricing.ts` et `journee-ia-commun.ts` ; tout écart = refus                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 0 écart                        | **Non**                  |
| B04 | **Exactitude réglementaire**                                               | Liste de contrôle datée (§ 6.3) : AI Act article 4 et financement (au conditionnel). **Qualiopi et CPF/RNCP n'apparaissent jamais** (refusés par `detecterInterdits`, Axion-IA n'étant pas certifiée) ; OPCO seulement si `OF_PUBLIC_DISCLOSURE_ENABLED` est allumé. Une affirmation contraire à la liste = refus. **La liste ne s'active qu'après relecture de la source primaire (JO, texte officiel), inscrite dans le fichier avec sa date** ; avant, le critère est « non évalué » et les contenus touchant ces sujets partent en relecture humaine | 0 écart                        | **Non**                  |
| B05 | **Intention déclarée et libre**                                            | L'intention (§ 7.1) existe au registre et **n'est pas déjà couverte** par une page publiée ou en cours                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 1 intention = 1 page           | Oui, avec plan de fusion |
| B06 | **Unicité sémantique**                                                     | Cosinus maximal du brouillon contre tout contenu publié (embedding calculé **avant** publication)                                                                                                                                                                                                                                                                                                                                                                                                                                                        | < 0,85 (hyp. à calibrer)       | Oui, motivée             |
| B07 | **Apport original**                                                        | Au moins 2 apports distincts parmi 4 types, vérifiés (§ 8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ≥ 2                            | Oui, motivée             |
| B08 | **Réponse directe en tête**                                                | Réponse autonome de 40 à 60 mots dans les 150 premiers mots, qui répond à la question cible                                                                                                                                                                                                                                                                                                                                                                                                                                                              | présente                       | Non                      |
| B09 | **Sources externes primaires**                                             | ≥ 2 sources primaires (Insee, Bpifrance, texte officiel, étude datée), dont ≥ 1 de moins de 18 mois pour l'IA et la réglementation                                                                                                                                                                                                                                                                                                                                                                                                                       | ≥ 2                            | Non                      |
| B10 | **Un seul appel à l'action cohérent**                                      | Un appel principal : Diagnostic IA 45 min **ou** renseignements Journée IA, relié à l'intention (§ 9.2), lien correct, **aucune réservation ni achat direct dans le corps**, aucun prix hors source unique                                                                                                                                                                                                                                                                                                                                               | 1 exact                        | Non                      |
| B11 | **Complétude de la page**                                                  | Règles de `data-quality-gate` **rendues bloquantes, sauf la FAQ et la citation d'expert** (voir ci-dessous) + ≥ 850 mots (articles), page non mince, H1 unique, 3 à 8 H2                                                                                                                                                                                                                                                                                                                                                                                 | voir code                      | Non                      |
| B12 | **Métadonnées relues**                                                     | Title (unique sur le site), méta description, alt : présents, conformes, sans faute de doctrine. Google étend la relecture aux métadonnées (01/10/2026)                                                                                                                                                                                                                                                                                                                                                                                                  | 100 %                          | Non                      |
| B13 | **Maillage minimal**                                                       | ≥ 3 liens internes **sortants** vers des pages existantes et saines (HTTP 200, indexables), dont 1 vers la page « propriétaire » du thème ; **ancres variées** (pas la même ancre exacte plus de 2 fois sur 20 contenus) ; **les liens entrants à J+7 (≥ 2) ne sont pas mesurables avant publication** : ils font l'objet d'une tâche de maillage après publication (Q16), pas d'un blocage                                                                                                                                                              | conforme                       | Non                      |
| B14 | **Auteur et dates honnêtes**                                               | Auteur identifiable (§ 9.4), `datePublished` visible, pas de `dateModified` sans changement réel du corps                                                                                                                                                                                                                                                                                                                                                                                                                                                | conforme                       | Non                      |
| B15 | **Aucun texte caché ni consigne aux modèles**                              | Détection de texte invisible, de consignes adressées à une IA, de listes comparatives biaisées. Visé par la politique du 15/05/2026                                                                                                                                                                                                                                                                                                                                                                                                                      | 0                              | **Non**                  |
| B16 | **Relecture adverse favorable**                                            | Juge indépendant (modèle différent de l'auteur) : note « utile à un dirigeant » ≥ 8,5, aucun problème P0                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ≥ 8,5                          | Non                      |
| B17 | **Coupe-circuit non déclenché** (branché en Q10, absent du registre avant) | Le coupe-circuit (§ 10.3) n'est pas déclenché et le plafond de sécurité du jour n'est pas dépassé. Ce n'est **pas un quota** : aucun minimum à atteindre                                                                                                                                                                                                                                                                                                                                                                                                 | respecté                       | Non                      |

**B11, deux exclusions volontaires** : (1) la **FAQ ≥ 4 questions** n'est pas bloquante (elle reste W07) : imposer une FAQ produirait des FAQ décoratives, risque Google ; (2) la **citation d'expert nommé** (`expertQuote`) n'est pas exigée : une IA qui doit la produire invente un expert, c'est un faux témoignage (`citation-temoin`). Une citation n'est admise que donnée par une personne réelle, avec sa source.

### 4.2 Avertissements (retirent des points, jamais bloquants seuls)

| Id  | Critère                                                                                                                                                          | Points |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| W01 | Au moins 30 % des H2 formulés en question de dirigeant                                                                                                           | 6      |
| W02 | Au moins 3 passages autonomes de 40 à 120 mots, sans renvoi du type « comme vu plus haut »                                                                       | 8      |
| W03 | Un tableau ou une liste structurée quand le sujet s'y prête                                                                                                      | 4      |
| W04 | Sous-questions : au moins 3 sur 5 de la liste prévue sont traitées, sans remplissage                                                                             | 8      |
| W05 | Lisibilité adaptée à un dirigeant (phrases courtes, pas de jargon non défini)                                                                                    | 6      |
| W06 | Données structurées (Article, Person, Organization) **concordantes** avec le texte visible                                                                       | 4      |
| W07 | FAQ visible utile (≥ 4 vraies questions), **jamais décorative** (pénalisée seulement si présente et inutile, ou absente quand l'intention appelle des questions) | 4      |
| W08 | Variété : accroche, plan et CTA différents des 20 derniers contenus du même type                                                                                 | 6      |
| W09 | Exemple concret français (secteur, taille, situation) au-delà du minimum de B07                                                                                  | 4      |
| W10 | Image principale pertinente et texte alternatif descriptif (le terracotta relève des gabarits, § 9.3)                                                            | 4      |

### 4.3 Notation

- **Une seule formule** : `note = 100 − P_avertissements − P_preuves − P_proximité − P_intention`.
  - `P_avertissements` : somme des pénalités W01 à W10 (tableau 4.2, **54 points au plus**).
  - `P_preuves` (0 à 16) : densité de faits sourcés et vérifiés rapportée à la longueur (0 si ≥ 1 fait sourcé pour 250 mots ; 16 si aucun).
  - `P_proximité` (0 à 10) : proportionnelle au cosinus maximal entre 0,70 (0 point) et 0,85 (10 points, au-delà c'est B06).
  - `P_intention` (0 à 6) : résultat du contrôle existant `search-intent-validator`.
  - Total des pénalités possibles : 86 ; la note minimale théorique est 14. **Un test unitaire verrouille la formule** (cas limites : tout parfait = 100, chaque pénalité au maximum, somme des maxima = 86).
- **Seuil de publication : 85/100, relevé à 90 si le taux d'indexation de la dernière cohorte est sous 70 %** (§ 10.2).
- Un contenu avec 70 ≤ note < seuil est `a_corriger` : **réécriture ciblée** des seules sections en cause (2 essais au plus, plafond de coût existant de 3 $ par article), puis **abandon** s'il échoue encore (§ 5.1).
- Sous 70, ou avec un bloquant dur : `bloque`, avec motif en français simple.
- **Pourquoi 85** : le seuil actuel de 75 mesure surtout la forme (titre, méta, longueur). Les critères nouveaux mesurent le fond. 85 autorise 15 points de pénalités au plus. Le seuil est un **point de départ à calibrer** pendant la phase d'observation (§ 10.1), pas une valeur démontrée. [hypothèse]

## 5. Décision finale

```
publiable  = aucun bloquant (dur, corrigeable ou dérogeable non levé)  ET  note ≥ seuil  ET  B16 favorable
bloque     = au moins un bloquant « dur »  OU  note < 70  OU  critère bloquant non évalué (sauf exceptions : Search Console, § 7.3 ; B04 non évalué = relecture humaine, § 4.1)
a_corriger = tout le reste : bloquant « corrigeable » ou « dérogeable » seul, ou 70 ≤ note < seuil
```

**Classement unique des bloquants** (source unique ; le registre `CRITERES` porte la même colonne) :

| Classe                                    | Critères                               | Conséquence                                                                               |
| ----------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Dur** (aucune dérogation, aucun renvoi) | B01, B02, B03, B04, B09, B12, B14, B15 | `bloque`. Réécriture ciblée si la cause est localisable (essais plafonnés), sinon abandon |
| **Corrigeable** (réécriture ciblée)       | B08, B10, B11, B13, B16                | `a_corriger` : 2 essais au plus, puis **abandon**. Pas de dérogation                      |
| **Dérogeable** (humain, motif écrit)      | B05, B06, B07                          | `a_corriger` : dérogation motivée possible, ou fusion / abandon                           |

Les colonnes « Dérogation humaine » du tableau 4.1 doivent concorder avec cette table (un test le vérifie).

- **Dérogation humaine** : permise seulement sur la classe « dérogeable », avec **motif écrit, nom de l'approbateur et date** dans la table des verdicts. Compteur visible à l'écran. Plus de 5 % de dérogations sur 28 jours déclenche une alerte : la porte est trop dure ou trop contournée.

**B17 n'est pas une classe de refus : c'est un REPORT.** Un contenu retenu seulement parce que le plafond de sécurité du jour est atteint ou que le coupe-circuit est déclenché reste **en attente** (`pending` / `needs_review`), repris au jour suivant ou à la levée du coupe-circuit. Pas de réécriture, **pas d'abandon**, et **exclu du taux de refus** : un bon contenu n'est jamais détruit par un plafond. (Le § 17 de la chaîne place B17 parmi les durs : à aligner.)

### 5.1 Refus : réécriture ciblée, abandon, enregistrement

- **Réécriture ciblée** : sur `a_corriger` ou `bloque` dont la cause est localisable (hors B17, qui est un report), la liste des corrections localisées (section, critère, attendu) repart à la chaîne éditoriale, qui ne réécrit que les sections en cause. **2 essais au plus** et plafond de coût de 3 $ par contenu ; au-delà, le contenu est **abandonné**. Ces essais et ce plafond sont **le même compteur que celui de la chaîne** (2 réécritures, 3 tentatives au total), pas un second compteur. Un contenu faible n'est jamais publié « faute de mieux ».
- **Enregistrement de chaque refus** : critère (B01…), raison en français simple, preuve, tentative, version de la porte. Ils alimentent la **boucle d'amélioration hebdomadaire** de la chaîne (analyse des raisons de refus, propositions de changement de briefs et de prompts, appliquées après relecture de Will). **Alignement** : la porte emploie la **liste fermée de codes de raison** de la chaîne (`ContenuRefus`, un seul module partagé) ; chaque critère `Bnn` correspond à un code (`doctrine`, `fait_non_source`, `doublon_plan`, `generique`…). Tant que la chaîne n'est pas livrée, `ContentQualityVerdict` porte seule l'enregistrement. Un refus humain est saisi comme un refus machine.
- **Verdicts** : la porte rend `publiable`, `a_corriger` ou `bloque` (et **non** `passe` / `refuse`), comme l'écrit le § 8 de la chaîne. Rôle enregistré : `role = "porte"` (R8).
- **Codes de raison (table de correspondance unique)** : on reprend les codes de la chaîne (§ 8 de son document) : B01 `doctrine` ; B02, B03 `fait_non_source` ; B05, B06 `doublon_plan` ; B07 `generique` ; B09 `dossier_insuffisant` ; B13 `lien_mort` ; B16 `generique` ou `non_actionnable` selon la note. **Critères sans code dans la chaîne**, à ajouter au module partagé (PR C4 de la chaîne, modification de son § 8) : B04 `reglementation` ; B08, B11, B12 `style` (existant) ; B10 `appel_incoherent` ; B14 `date_ou_auteur` ; B15 `texte_cache` ; B02 `chiffre_retire` (existant côté chaîne). Tant que ces codes n'existent pas, le code est `autre` et le critère `Bnn` est enregistré dans le détail : aucun refus n'est perdu. **B17 n'est pas un refus** (voir § 5).
- **Visible en console** : onglet « Contenus » (§ 12.2), avec classement des raisons et tendance. Un taux de refus élevé sur les contenus issus de la chaîne est affiché comme **alarme sur les rôles amont**, pas comme normalité.

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

| Sujet                | Fait de référence au 27/11/2026                                                                                                                                                                             | Piège à bloquer                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| AI Act, article 4    | Applicable depuis le 02/02/2025. L'Omnibus numérique sur l'IA (règlement (UE) 2026/1744, en vigueur le 27/07/2026) l'assouplit : « promouvoir » la maîtrise de l'IA. **Formulation exacte à relire au JO.** | Présenter la formation comme une **obligation stricte** par salarié |
| AI Act, haut risque  | Obligations de l'annexe III reportées au 02/12/2027 (même source, à relire)                                                                                                                                 | Donner l'ancienne échéance                                          |
| Qualiopi, CPF, RNCP  | **Aucune mention publique** : refusés par `interdits-publication.ts` (Axion-IA n'est pas certifiée). Le contrôle vérifie leur absence                                                                       | Toute mention de ces termes                                         |
| Financement          | Toujours au conditionnel ; l'OPCO n'est nommé que si `OF_PUBLIC_DISCLOSURE_ENABLED` est allumé ; **aucune promesse de prise en charge** (règle code `financement-100`, `financement-public`)                | « Financé à 100 % »                                                 |
| Usage de l'IA en PME | Insee Première n° 2120 (07/2026) : 18 % des entreprises de 10 salariés ou plus utilisent l'IA en 2025, 15 % chez les 10-49 salariés. Bpifrance Le Lab (06/2025) : 32 % utilisent réellement l'IA            | Chiffre sans millésime ni source                                    |

### 6.4 Relecture humaine : dosage

Google ne chiffre rien. Le dosage proposé est une **hypothèse prudente**, liée à la **confiance acquise** et non à un volume :

| Phase (§ 10.1)                                | Relecture humaine                                                                                                                                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Observation et démarrage                      | **100 %** des contenus, avec l'écran « Porte qualité » qui présente verdict, faits et sources                                                                                                                   |
| Confiance établie (indicateurs verts, § 10.2) | 100 % des contenus qui touchent réglementation ou financement ; **30 %** tirés au sort pour le reste, **avant** publication, jamais après                                                                       |
| Confiance durable                             | 100 % réglementation et financement ; **10 %** tirés au sort ; 100 % des contenus à note 85-88. **Plafond de 20 publications par jour sans relecture humaine**, à relever seulement par décision écrite de Will |

La capacité de relecture est un **garde-fou naturel** : si elle manque, on publie moins (§ 10.5).

## 7. Doublons, cannibalisation, intention

### 7.1 Registre des intentions (avant d'écrire)

Nouvelle table `ContentIntention` : requête principale normalisée, **intention** (informationnelle, décision, financement, réglementation, comparaison…), persona (dirigeant de PME de 10 à 250 salariés), sous-questions attendues (3 à 5), page type, **page propriétaire** (URL, quand elle existe), état (`libre`, `reservee`, `couverte`, `a_fusionner`).

- **Une intention = une page.** Avant d'appeler le modèle d'écriture : si l'intention est `couverte` ou `reservee`, la tâche est **annulée** ou transformée en **mise à jour** de la page propriétaire (mécanisme du mode « mise à jour » existant).
- Le registre est alimenté par la carte des requêtes existante (`strategie/carte-requetes.ts`, « une requête = une URL »), la Search Console (§ 7.3) et les sous-questions que le brief génère.
- **Le stock d'intentions `libre` plafonne le rythme** (§ 10.5) : sans intention libre validée, aucune génération n'est lancée.

### 7.2 Après écriture : embeddings du brouillon

- Calcul de l'embedding du **brouillon avant publication** (aujourd'hui seulement après) avec le fournisseur déjà configuré, requête `<=>` sur `Article.embedding`.
- Seuils existants dans le code : doublon 0,85, proche 0,80. Les pratiques d'audit publiques vont de 0,85 à 0,95 selon l'outil [hypothèse, § 14]. **Départ : bloquer à 0,85 ; entre 0,80 et 0,85 : alerte « fusion à étudier »** ; calibrage sur 50 paires étiquetées à la main pendant la phase d'observation (§ 10.1).
- Pour les contenus **hors articles** (FAQ extraites, villes, fiches), même contrôle sur leur table respective (§ 11).
- Le comparateur doit aussi couvrir les **contenus en file** (pas seulement publiés), pour que deux brouillons du même jour ne se doublonnent pas.

### 7.3 Search Console

- Dépend des PR P2 à P4 du pilotage (historique jour × page × requête). **Tant qu'elles ne sont pas livrées, ce contrôle est « non évalué »** et le plafond de sécurité reste bas.
- Règle : si une **page existante** reçoit déjà des impressions pour la requête cible (position ≤ 20), la tâche devient une **mise à jour** de cette page, pas une nouvelle page.
- Règle : si, après publication, **deux URL alternent** sur la même requête (détecteur `detecterCannibalisation`, déjà fusionné et non branché), un **signalement de fusion** est créé pour un humain. **Aucune URL ne change automatiquement** (principe 5 du plan).
- Le site est jeune (~428 impressions par semaine **mesurées en août** (à actualiser avec la Search Console de novembre)) : la Search Console ne détecte **presque rien** avant des semaines. Le contrôle sémantique (§ 7.2) est donc le vrai garde-fou du début.

### 7.4 Intention de recherche

La porte vérifie que le **format** répond à l'intention déclarée : une question « comment financer » appelle des étapes et un tableau, pas un article d'opinion. Le contrôle existant `search-intent-validator.ts` est conservé et son résultat entre dans la note.

## 8. Apport original exigé (B07)

Un contenu doit contenir **au moins 2 apports distincts**, chacun vérifié et marqué dans le texte source (balise interne retirée au rendu ; un test de B15 vérifie qu'elle n'apparaît ni dans le HTML, ni dans le JSON-LD, ni dans le RSS, ni dans les exports) :

| Type                                    | Exigence vérifiable                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Exemple concret de PME française** | Secteur, taille (effectif), situation, étapes, résultat chiffré **ou** « exemple type » explicitement étiqueté. **Jamais présenté comme un client réel s'il ne l'est pas** (règles `temoignage-axion`, `citation-temoin`, `preuve-sociale-vague`).                                                                                                          |
| **B. Chiffre sourcé**                   | Un nombre avec source primaire datée (Insee, Bpifrance, texte officiel), contrôlé au § 6.2. Une étude pertinente est utile ; une compilation de chiffres déjà cités partout ne suffit pas seule.                                                                                                                                                            |
| **C. Angle PME française**              | Un point propre au contexte français que les contenus génériques anglophones n'ont pas : AI Act et calendrier français, obligations de l'employeur, fiscalité, droit du travail (jamais Qualiopi ni CPF ; OPCO seulement si le drapeau est allumé). Un test vérifie que le registre B04 et ce tableau ne citent aucun terme refusé par `detecterInterdits`. |
| **D. Donnée propre à Axion-IA**         | Une donnée **réelle et agrégée** (Diagnostic IA anonymisé, Observatoire). Interdit sans donnée réelle (règle `stat-axion`). Tant qu'aucune donnée n'existe, ce type est **indisponible**, pas simulé.                                                                                                                                                       |

Contraintes :

- A seul ne suffit pas : **A + B**, **B + C** ou **A + C** sont les combinaisons minimales de départ (D compte comme un apport supplémentaire quand il existe).
- Un exemple « type » doit être **plausible et utile** ; un exemple inventé qui ressemble à un client est un faux témoignage et bloque (B01).
- Le brief (équipe éditoriale) doit **réserver** les apports **avant** l'écriture : si aucun apport B ou C n'est disponible pour une intention, l'intention reste `libre` mais **non générable** (pas assez de matière).

## 9. Communication, appel à l'action, structure pour les IA

### 9.1 Règles de communication

Source unique : `src/lib/contenu/interdits-publication.ts`. **La porte appelle cette liste, elle ne la duplique pas.**

| Règle demandée                                                                                                                         | Règle de code déjà en place                                                          | Vérification de la porte                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Jamais « Grenoble » (sauf mentions légales : les pages légales, `src/content/legal.ts`, sont exclues de B01 et des lots hors articles) | `grenoble`, `ancrage-local`                                                          | Titre, méta, corps, alt, JSON-LD, URL, noms de fichiers d'images                                                           |
| Pas de faux témoignage                                                                                                                 | `temoignage-axion`, `citation-temoin`, `preuve-sociale-vague`, `stat-axion`          | Plus la règle B07 (exemple étiqueté)                                                                                       |
| Pas de prix barré                                                                                                                      | `prix-barre`                                                                         | Y compris dans le HTML et les images alternatives                                                                          |
| Aucun frais de déplacement                                                                                                             | `frais-deplacement`, `frais-venue`                                                   | Idem                                                                                                                       |
| Pas de réservation directe en ligne                                                                                                    | `reservation-paiement`                                                               | Aucun lien `/appel`, widget ni bouton de réservation ; **B10** capte « Réserver un appel », que la règle seule ne voit pas |
| Prix, durée, programme                                                                                                                 | `prix hors source unique`, barrière Journée IA                                       | B03 : comparaison à `pricing.ts` et `journee-ia-commun.ts`                                                                 |
| « Partout en France »                                                                                                                  | **Formule voulue et autorisée** (`positionnement.ts:20`, `interdits-publication.ts`) | **Jamais refusée.** Elle reste la formule de remplacement de toute mention locale                                          |

**Décision de Will (27/11/2026), tranchée : « partout en France » est autorisée.** Seul « Grenoble » est interdit (sauf mentions légales). Le code (`interdits-publication.ts`, `positionnement.ts:20`) est donc **juste** et ne change pas : la porte **n'interdit pas** « partout en France », ne la signale pas et ne la pénalise pas. Un test de non-régression vérifie qu'un texte contenant « dans vos locaux, partout en France » n'est refusé par aucun critère. (Une version antérieure de ce document, et la conception de la chaîne éditoriale (§ 9, § 13, § 14 décision 1 de `CONCEPTION-CHAINE-EDITORIALE-IA.md`, branche `docs/chaine-editoriale-ia`), traitaient à tort cette formule comme interdite : ce document de la chaîne est **déjà corrigé** (commit ff78ac7f).)

### 9.2 Appel à l'action : un seul, relié à l'intention, varié

- **Un seul appel principal par contenu**, choisi par l'intention déclarée :
  - décision, évaluation, « par où commencer » : **Diagnostic IA de 45 minutes**, par le lien vers la **page contact** (jamais `/appel`, qui est une page de réservation en ligne ; B10 refuse tout lien vers `/appel`) ; **aucun widget ni bouton de réservation intégré au corps**, aucun achat direct ;
  - formation, découverte, équipe : **renseignements Journée IA** (page dédiée) ;
  - informationnel pur sans intention d'achat : appel discret vers le Diagnostic.
- **Variété** : la phrase d'appel d'un contenu ne doit pas être identique (similarité ≥ 0,8) à celle des 20 précédents du même type (W08). Les angles d'entrée de `positionnement.ts` (8) sont la réserve de variété.
- **Tension à lever (décision D2, recommandation en § 17)** : le prompt demande d'expliquer la Journée IA, mais toute mention de la Journée IA dans le corps généré **force la relecture humaine** (`relecture-journee-ia.ts`). Proposition : autoriser un **bloc normalisé**, construit à partir de `journee-ia-commun.ts`, et garder la relecture humaine pour tout texte libre qui la mentionne.

### 9.3 Charte visuelle

La couleur de marque est le **terracotta** (jeton `@theme`, pas un code recopié). Contrôle (W10, avertissement) : les visuels générés (images dessinées, graphiques, bandeaux) utilisent les jetons du thème ; une image principale sans rapport avec le sujet est refusée. **Le terracotta n'est pas contrôlable dans le texte** : il relève de la génération d'images et des gabarits de page, pas de la porte de contenu.

### 9.4 Auteur et E-E-A-T

Aujourd'hui, la signature est « Plume IA d'Axion-IA », publiée en `Organization` (test `plume-ia-pas-une-personne`). Cela évite de faire passer un texte de modèle pour une personne. Pour l'E-E-A-T, la porte exige :

- une **relecture nominative** par une personne réelle d'Axion-IA, affichée (« relu par … le … ») **seulement quand elle a eu lieu** ;
- jamais de faux auteur, jamais de qualification inventée.

C'est un **point à trancher (D3)** : qui relit, et en son nom propre ? Sans cela, toute relecture par échantillon pose un problème d'honnêteté de l'affichage « relu par » : tant que D3 n'est pas tranchée, aucun nom n'est affiché.

### 9.5 Structure lisible par les IA

À mesurer dans W01 à W07, **sans en faire un dogme** : Google écrit (guide de mai 2026) que le découpage en fragments, les schémas spécifiques et `llms.txt` ne sont pas nécessaires [confirmé]. Les études GEO sont corrélationnelles, sauf Princeton/IIT Delhi qui est simulée [§ 14]. Retenu :

- réponse directe en tête, titres en questions, tableaux et listes **parce qu'ils servent le lecteur** ;
- données structurées **concordantes** avec le texte (exigence Google) ;
- **`llms.txt` n'est pas un critère** (étude Ahrefs de mai 2026 : 97 % des fichiers jamais lus) ;
- **FAQPage décorative proscrite** : Google a retiré les résultats enrichis FAQ, et une FAQ non visible ou non utile est un risque ;
- `dateModified` honnête (B14) : une étude montre un biais de fraîcheur des assistants, mais changer la date sans changer le texte n'a aucun effet démontré et serait trompeur.

## 10. Rythme : il découle de la qualité, jamais d'un quota

**Décision de Will : aucun quota.** Il n'y a ni objectif de contenus par jour, ni paliers chiffrés à atteindre. Le nombre de contenus publiés est **le résultat** de ce qui passe la chaîne éditoriale et la porte, et d'intentions réellement libres.

### 10.1 Phases (sans cible de volume)

| Phase                 | Ce qui se passe                                                                                                                                                                                | Sortie de phase                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Observation**       | La porte est en **mode ombre** : elle écrit son verdict sans rien bloquer. Le pipeline actuel continue, mais **toute publication passe en relecture humaine** (PR Q1b). On calibre les seuils. | Écart analysé et seuils calibrés (Q9), au moins 35 jours (7 de publication + 28 de recul d'une cohorte) |
| **Démarrage prudent** | Point final en mode réel. Seul ce qui passe la porte et la relecture humaine part. **Aucun minimum à publier**, un jour sans contenu publiable est un jour normal.                             | Indicateurs verts sur une cohorte à 28 jours (§ 10.2) et clic de Will                                   |
| **Accélération**      | Le **plafond de sécurité** (limite haute, pas un objectif) est relevé par Will, **uniquement** si Google et les IA suivent.                                                                    | Revue à chaque relèvement ; le coupe-circuit reste actif                                                |

Une cohorte doit avoir **28 jours** avant d'être jugée : on ne juge jamais plus vite. [hypothèse] Un pic soudain n'est pas pénalisé en tant que tel, mais il rend visible un défaut de qualité qui peut s'étendre au site entier (John Mueller sur le « programmatic SEO » et les pages de faible valeur, § 14). C'est une raison de plus pour ne **jamais** viser un volume.

**Le plafond de sécurité de la porte s'applique en plus** des plafonds existants (`daily_generation_cap`, `MAX_PUBLISH_PER_DAY`, rampe 150/300/1 000, plafonds de coût Claude) : on prend **le minimum**. Ce sont des limites hautes. La rampe existante, qui monte jusqu'à 1 000, est donc **neutralisée** tant que Will n'a pas relevé le plafond de la porte.

### 10.2 Indicateurs de montée en charge (cohorte = contenus publiés la même semaine)

Un relèvement du plafond de sécurité est **proposé** quand toutes les conditions sont vraies sur la **dernière cohorte arrivée à 28 jours** ; **Will valide d'un clic**, jamais d'automatisme. **Aucun indicateur n'est un volume à atteindre.**

| Indicateur                                                      | Seuil de départ [hypothèse à calibrer]                | Source                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Pages de la cohorte **indexées** à 28 jours                     | ≥ 70 %                                                | Inspection d'URL (P5 du pilotage)                                                       |
| Part « Explorée, actuellement non indexée » de la cohorte       | ≤ 20 %                                                | Inspection d'URL                                                                        |
| **Affichages** : pages de la cohorte avec ≥ 1 impression à 28 j | ≥ 50 %                                                | Search Console (P4)                                                                     |
| Impressions par page indexée, comparées à la cohorte précédente | pas en baisse de plus de 30 %                         | Search Console                                                                          |
| **Clics** et position, quand le volume le permet                | en hausse ou stables ; « pas assez de données » sinon | Search Console                                                                          |
| **Citations et affichages dans les aperçus IA**                 | en hausse ou stables, avec intervalle et échantillon  | Rapport « Generative AI performance », échantillon de questions fixes (P10 du pilotage) |
| Pages **anciennes** (hors cohorte) : impressions sur 28 jours   | pas en baisse de plus de 15 % hors tendance du site   | Search Console                                                                          |
| Action manuelle ou message de qualité dans la Search Console    | **aucun**                                             | Saisie manuelle de Will (pas d'API fiable)                                              |
| Taux de dérogation humaine                                      | ≤ 5 %                                                 | Table des verdicts                                                                      |
| Taux de refus de la porte sur les contenus de la chaîne         | bas et en baisse (un taux élevé est une alarme amont) | Enregistrement des refus (§ 5.1)                                                        |

Les **clics** et les **citations IA** comptent comme signaux de succès, mais à quelques centaines d'impressions par semaine pour tout le site (mesure d'août, à actualiser) ils sont statistiquement muets au début : les indicateurs fiables sont d'abord l'**indexation** et les **affichages par page**. En dessous du plancher statistique, l'écran affiche « pas assez de données » et **le plafond ne monte pas** (principe « mesurer avant d'agir »).

### 10.3 Coupe-circuit (retour automatique en arrière)

Retour au **plafond de sécurité précédent** (ou à la relecture humaine à 100 %), publications mises en pause, alerte à Will (une seule, anti-répétition de 30 jours par motif) quand :

- l'indexation d'une cohorte à 28 jours tombe **sous 50 %** ;
- la part « Explorée, non indexée » **gagne plus de 15 points en une semaine** ;
- les pages anciennes perdent **plus de 25 %** d'impressions hors tendance du site, dans les 21 jours qui suivent une vague de publications ;
- Will saisit une **action manuelle** ;
- le taux de dérogation dépasse 10 % ;
- une faute de doctrine (B01) **atteint le public** (échec du point final) : arrêt complet et enquête.

### 10.3b Objectifs de volume encore présents dans le code (à neutraliser en Q11)

`content-publish-worker.ts` (l. 130-137, commentaire « objectif ~100 contenus/jour ») et `lifecycle/tier-decisions.ts:61` (« cible volume 1500-3000 promus/mois ») : ce sont des cibles de volume contraires à la décision de Will. Q11 les neutralise (limites hautes seulement, jamais des cibles).

### 10.4 Élagage

Toute page publiée avec **0 impression après 90 jours** passe en revue : améliorer, fusionner (signalement) ou `noindex` (signalement). Mueller indique que les pages faibles pèsent sur le site entier [§ 14]. Les pages de la catégorie `legal` et `conversion` sont exclues (règle du détecteur « jamais affichée »).

### 10.5 Ce qui limite naturellement le rythme

`publications possibles = min(ce qui passe la porte, intentions libres générables, capacité de relecture humaine, plafonds existants)`.

Chaque contenu exige une intention réellement distincte et ≥ 2 apports originaux vérifiés. [hypothèse] Une thématique « IA pour dirigeants de PME » ne se fragmente pas à l'infini sans doublonner : le rythme stable sera celui que cette matière permet, sans fixer de nombre. **Pas de quota, pas de rattrapage** : une semaine à zéro publication n'est pas un échec.

## 11. Chemins de publication et contournements à fermer

Point de publication unique des articles : `content-publish-worker.ts`, `executePublishPipeline` (l. 302), transaction l. 915-1128. Trois sources alimentent la file : `content-gen-worker.ts:2073`, `content-quality-improver-worker.ts:614`, `actions/content-gen/review.ts:100`.

| #   | Chemin                                                                                                                    | Risque                                                             | Action                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `review.ts:267` approbation groupée sur la note, sans le motif de relecture                                               | Contourne plagiat, doublon, longueur                               | Exclure `a_corriger` et `bloque`                                                                                                                 |
| 2   | `judge-outcome.ts:52-58` verdict « publish » sans revérifier la note                                                      | Publier sous 75                                                    | La porte décide, le juge n'est qu'un critère (B16)                                                                                               |
| 3   | Note ≥ 75 jamais jugée                                                                                                    | Aucune critique adverse sur la majorité des contenus               | B16 s'applique à **tous**                                                                                                                        |
| 4   | `CONTENT_QUALITY_GATE_ENABLED` éteint                                                                                     | Complétude non bloquante                                           | Règles reprises dans B11, bloquantes, **sauf FAQ et citation d'expert** (§ 4.1)                                                                  |
| 5   | `content-qa-extract-worker.ts:126-150` (FAQ publiées directement)                                                         | Contenu public sans porte                                          | **Dès Q10** : B01, B02, B03 et B06 avant écriture, sans attendre aucune autre PR                                                                 |
| 6   | `content-fact-check-worker.ts:319-347` (réécriture du corps publié)                                                       | Aucun contrôle des interdits                                       | **Dès Q10** : B01 et B03 sur le texte réécrit, sinon la réécriture est refusée                                                                   |
| 7   | `equipe/mise-a-jour-reel.ts:184-188`                                                                                      | Corps écrasé sans copie ; pas de retour arrière                    | Copie avant écrasement (Q10b), puis porte mode « mise à jour » (Q15)                                                                             |
| 8   | `actions/content-gen/article.ts:177, 381` ; `features/admin-blog/actions.ts:304`                                          | Édition manuelle et désarchivage (`article.ts:381` remet en ligne) | Porte en **avertissement visible** (un humain assume) ; B01 reste bloquant                                                                       |
| 10  | `intent-enforcement.ts:67-68`, `category-hub-content.ts:602`, `v7-phase8-generators.ts:193` (lien de repli vers `/appel`) | Réservation en ligne injectée ; B10 refuserait à tort              | Dans Q2 : repli vers la page contact (« Diagnostic IA 45 min »), retirer `/appel`, aligner `RECOGNIZED_CTA_RE`                                   |
| 9   | `GeneratedVilleCopy` approuvée par script, `knowledge/ingest.ts:203`                                                      | Contenu public hors pipeline                                       | Hors périmètre du lot 1. **Aucune nouvelle page par ville** (risque de contenu en masse) ; les existantes passent la porte et l'élagage (§ 10.4) |

⚠️ Chemin 8 : l'édition manuelle par un administrateur ne doit pas être bloquée à 100 % (Will doit pouvoir corriger une coquille en urgence), mais **B01 (doctrine) et B03 (faits canoniques)** s'y appliquent toujours.

## 12. Écran de console « Porte qualité », en adéquation avec le back-end

Emplacement : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/porte-qualite/`, entrée dans `src/lib/admin-nav.ts` près de « Qualité ». Toutes les actions passent par `requireAdmin`. Aucun JavaScript public.

### 12.1 Règle d'adéquation : l'écran n'a pas de vérité propre

1. **Le registre `CRITERES` est la source unique** : l'écran lit ce registre pour lister critères, libellés, seuils et gravités. Ajouter un critère le fait **apparaître** à l'écran sans autre PR.
2. **Les réglages** (seuil de note, plafond de sécurité, seuils d'indexation) vivent dans **une seule clé** `ContentGenConfig` `porte_qualite`, validée par **un seul schéma Zod** importé par le back-end **et** par l'action de l'écran.
3. **Les verdicts affichés sont les lignes de la table** `ContentQualityVerdict`, sans recalcul côté écran.
4. **Trois tests de concordance** (verrouillent l'adéquation) :
   - tout critère du registre a un libellé non vide et une fonction, et apparaît dans la sortie de l'action de lecture ;
   - toute clé de réglage de l'écran existe dans le schéma du back-end, et réciproquement ;
   - un verdict enregistré par la porte est relu à l'identique par l'écran (aller-retour).
5. **`null` s'affiche « indisponible »**, jamais 0 (principe 4 du plan).
6. **Un test refuse un drapeau d'écran sans effet back-end** (la leçon de `CONTENT_QUALITY_GATE_ENABLED`).

### 12.2 Quatre onglets

| Onglet                  | Contenu                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vue d'ensemble**      | Phase actuelle, publiés aujourd'hui et plafond de sécurité (une limite, pas un objectif), état du coupe-circuit, indicateurs de la dernière cohorte avec leur seuil, **bouton « Proposer de relever le plafond de sécurité »** (désactivé si un indicateur est « indisponible » ou sous son plancher), liste des intentions libres générables                       |
| **Contenus**            | Liste des verdicts : titre, type, note, critères en échec avec la phrase en français et la **preuve** (extrait, source, cosinus et titre du voisin), **actions** : relire, dérogation motivée (si permise), abandonner. **Classement des raisons de refus**, tendance sur 8 semaines, taux de refus (alarme si élevé), tentatives de réécriture. Filtre par verdict |
| **Cohortes**            | Par semaine : publiés, indexés à 7, 14, 28 jours, impressions, dérogations, note moyenne. Les courbes sont des **tableaux** avant d'être des graphiques                                                                                                                                                                                                             |
| **Réglages et journal** | Seuils, plafond de sécurité, version de la porte, journal des changements (qui, quand, avant, après), liste des **dérogations**                                                                                                                                                                                                                                     |

L'écran `review-queue/[id]` affiche aussi le verdict de la porte (aujourd'hui il n'affiche ni barrières ni fautes de doctrine).

## 13. Données à créer (migrations additives)

| Table / colonne                          | Contenu                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentQualityVerdict`                  | `id`, `jobId?`, `articleId?`, `contentKind`, `versionPorte`, `mode` (`ombre`, `reel`, `maj`), `verdict`, `note`, `criteres` (JSON), `seuilsFiges` (JSON), `embeddingVoisinId?`, `cosinusMax?`, `decidePar?`, `motifDerogation?`, `createdAt`                     |
| `ContentIntention`                       | Registre § 7.1                                                                                                                                                                                                                                                   |
| `PorteCohorte` (instantané hebdomadaire) | Semaine, publiés, indexés à 7/14/28 j, impressions, note moyenne, dérogations. Écrit par le worker, **lu** par l'écran                                                                                                                                           |
| `ArticleTranslationRevision`             | Copie avant écrasement du corps. **Table nouvelle, propre à ce chantier** : `DECOUPAGE.md` P13 est le journal `SeoModification`, pas cette table (elle n'existe nulle part aujourd'hui). Livrée par la PR Q10b, **avant** tout relèvement du plafond de sécurité |
| Refus et raisons                         | Aligné sur la chaîne éditoriale : table `ContenuRefus` de la chaîne (liste fermée de codes de raison partagée). Sans elle, les refus sont dans `ContentQualityVerdict.criteres` (critère, raison, tentative)                                                     |
| `ContentGenConfig` clé `porte_qualite`   | Réglages § 12.1, avec valeurs par défaut sûres (phase d'observation)                                                                                                                                                                                             |

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

| PR   | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                           | Dépend de           | Risque    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------- |
| Q0   | **Décisions D2, D3, D5, D6** (§ 17) inscrites dans un ADR. Aucun code                                                                                                                                                                                                                                                                                                                                                             | Will                | —         |
| Q1   | Migration additive **seule** : `ContentQualityVerdict`, `PorteCohorte`, clé `porte_qualite` (défauts de la phase d'observation). Aucune lecture                                                                                                                                                                                                                                                                                   | —                   | Faible    |
| Q1b  | **Phase d'observation réelle** : plafond de sécurité bas (clé de config existante, une limite, pas un objectif) et passage de toute publication en `needs_review`. Fermeture de l'approbation groupée par la note seule                                                                                                                                                                                                           | —                   | Faible    |
| Q2   | Squelette pur de la porte (B11 reprend `data-quality-gate.ts` **sans** la règle FAQ ni la règle `expertQuote`, et les prompts cessent de demander ces champs ; correction du repli `/appel`, chemin 10) : registre `CRITERES` (avec la colonne de classe du § 5), types, schéma Zod des réglages, décision. Critères B01, B03, B08, B11, B13 (sortants), B14. Test de non-régression : « partout en France » n'est jamais refusée | —                   | Faible    |
| Q3   | Critères « faits » : extraction des affirmations, liste de contrôle réglementaire datée, vérification de la source retrouvée (B02, B04, B09)                                                                                                                                                                                                                                                                                      | Q2                  | Moyen     |
| Q4   | Embedding du brouillon avant publication et comparaison (B06) sur les articles **et** un index d'embeddings des pages statiques, services, offres, Journée IA, villes, FAQ ; seuils et 50 paires de calibrage                                                                                                                                                                                                                     | Q2                  | Moyen     |
| Q5a  | Migration **seule** : table `ContentIntention` (additive, nullable)                                                                                                                                                                                                                                                                                                                                                               | Q1                  | Faible    |
| Q5   | Registre `ContentIntention` : remplissage depuis la carte des requêtes et critère B05 (la **migration est la PR Q5a, seule**, avant)                                                                                                                                                                                                                                                                                              | Q1, Q2, Q5a         | Moyen     |
| Q6   | Apport original (B07) : réservation par le brief, marquage, contrôle ; exemple « type » étiqueté                                                                                                                                                                                                                                                                                                                                  | Q2                  | Moyen     |
| Q7   | Branchement **en ombre** : `gen-worker` + boucle d'amélioration appellent la porte, écrivent le verdict, **ne bloquent rien**                                                                                                                                                                                                                                                                                                     | Q2 à Q6             | Faible    |
| Q8   | Écran « Porte qualité », onglets 1 à 2 (lecture seule) + les trois tests de concordance                                                                                                                                                                                                                                                                                                                                           | Q7                  | Faible    |
| Q9   | _(étape de travail, pas une PR de code)_ Phase d'observation : analyse de l'écart entre verdicts d'ombre et pipeline actuel ; calibrage des seuils ; coût mesuré par contenu ; rapport dans `docs/`                                                                                                                                                                                                                               | Q7, Q8              | —         |
| Q10  | **Point final** dans `content-publish-worker.ts` (mode réel, drapeau `CONTENT_PORTE_QUALITE`), avec B17 (coupe-circuit) et le plafond de sécurité ; approbation groupée corrigée ; juge ne décide plus ; **chemins 5 et 6 fermés** (B01, B03)                                                                                                                                                                                     | Q9, Will            | **Élevé** |
| Q10b | Migration `ArticleTranslationRevision` **seule** (copie avant écrasement dans les écritures de corps : PR Q10c, après)                                                                                                                                                                                                                                                                                                            | Q1                  | Moyen     |
| Q11  | Plafond de sécurité (neutralise aussi `content-publish-worker.ts:125-137` et `tier-decisions.ts:61`, cibles de volume) : **`min()` avec les plafonds existants, la capacité de relecture et le coût**, raccordement de l'équipe éditoriale et du flux RSS d'actualités (B07 appliqué). **Aucun quota ni minimum**                                                                                                                 | Q10                 | Moyen     |
| Q12  | Cohortes : worker de l'instantané hebdomadaire et onglet 3 (dépend de l'ingestion Search Console P2 à P5 du pilotage ; sinon « indisponible »)                                                                                                                                                                                                                                                                                    | Q10, pilotage P4-P5 | Moyen     |
| Q13  | Coupe-circuit, proposition de relèvement du plafond, bouton de Will, alerte unique                                                                                                                                                                                                                                                                                                                                                | Q11, Q12            | Moyen     |
| Q14  | Écran, onglet 4 : réglages, journal, dérogations ; liste des interdits affichée en **lecture seule** (toute modification passe par une PR sur `interdits-publication.ts`)                                                                                                                                                                                                                                                         | Q10                 | Faible    |
| Q15  | Chemins après publication : porte mode « mise à jour » sur mise à jour, édition manuelle                                                                                                                                                                                                                                                                                                                                          | Q10, Q10b           | Moyen     |
| Q16  | Élagage à 90 jours (signalements), suivi à J+28 / J+90 et tâche de maillage après publication (liens entrants B13)                                                                                                                                                                                                                                                                                                                | Q12                 | Faible    |
| Q17  | Lot hors articles : villes, fiches de base de connaissances                                                                                                                                                                                                                                                                                                                                                                       | Q15                 | Moyen     |

Chaque PR a au minimum : un test de non-régression de la doctrine (`interdits-publication`, avec « partout en France » autorisée), un test du cas « source indisponible = non évalué » et, pour Q7, Q10, Q15, un test de **chemins de contournement** (aucun chemin ne publie sans verdict quand le drapeau est allumé).

**Ordre recommandé.** Q0, Q1b, Q1, Q2 ; puis Q3, Q4, Q5a puis Q5, Q6 en parallèle ; puis Q7 (qui dépend de Q2 à Q6) ; Q8 ; **35 jours d'observation** avec Q9 ; puis Q10 et Q10b. Q10 et Q15 ne se fusionnent jamais le même jour (fenêtre app/worker). Q12 et Q13 attendent l'ingestion Search Console du pilotage (P2 à P5, vague 2) ; **sans elles, le plafond de sécurité reste bas** (indexation non mesurable).

## 16. Critique et réserves

La critique indépendante (modèle Opus) a rendu « À CORRIGER » sur une première version ; **les 19 défauts ont été traités** dans ce document : P13 mal cité (B-1), durées de phases incompatibles avec les cohortes à 28 jours (B-2), phase d'observation incohérente (Q1b), formule de note (§ 4.3), classement des bloquants (§ 5), ordre des PR et règle 7 (§ 3, § 15), B17 déplacé en Q10, B02 restreint, B04 activée après relecture de la source primaire, relecture avant publication avec plafond, liens entrants et ancres, embeddings des pages statiques, D1, coût, flux RSS, dates. Une **première relecture Opus** de la révision a relevé 8 bloquants (Qualiopi/CPF, lien `/appel`, FAQ et citation d'expert imposées, alignement avec la chaîne, interdits modifiables), traités ; une **seconde** en a relevé 3 (codes de raison, repli `/appel` du générateur, B17 qui détruisait de bons contenus), traités. Une **seconde révision (27/11/2026)** applique les décisions de Will : suppression du quota et des paliers de volume, porte = dernier filet de la chaîne éditoriale, « partout en France » autorisée, enregistrement des refus. Les risques que cette conception **assume** :

- **Faux négatifs de la porte** : un seuil à 85 peut refuser de bons contenus ; la phase d'observation existe pour cela.
- **Relecture humaine = goulot** : voulu, le rythme n'est pas une cible (§ 10.5).
- **Données Search Console pauvres** (site jeune) : le relèvement du plafond s'appuie d'abord sur l'**indexation** et un contrôle sémantique interne, pas sur les clics.
- **Dépendance au pilotage** : Q12 et Q13 attendent P2 à P5 ; sans eux, le plafond de sécurité reste bas.
- **Dépendance aux faits en ligne** : une source qui change ou disparaît bloque la page ; prévu comme « non évalué = bloquant ».

## 17. Décisions restantes pour Will

D1 (« partout en France ») est **tranchée** : formule autorisée, rien à décider. D4 (paliers) est **supprimée** : il n'y a plus de paliers de volume. Restent D2, D3, D5 et D6, avec ma recommandation par défaut en français simple.

| Id  | Question                                                                        | Ma recommandation par défaut                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2  | La Journée IA peut-elle être décrite dans les contenus ? (§ 9.2)                | **Oui, mais seulement par un bloc de texte fixe**, construit à partir de la source unique de la Journée IA, **sans prix chiffré dans le texte généré**. Tout texte libre qui en parle repart en relecture humaine (comme le prévoit la chaîne éditoriale). Le bloc fixe est la seule exception : **Will l'approuve explicitement**.                              |
| D3  | Qui relit, et peut-on écrire « relu par » avec un nom ? (§ 9.4)                 | **Will relit par défaut** (la phase d'observation exige 100 % de relecture). Affichage : « rédigé avec l'aide de l'IA, relu par l'équipe Axion-IA », sans nom. Un nom n'apparaît que si cette personne a réellement relu ce contenu. Jamais de faux auteur.                                                                                                      |
| D5  | Quel modèle écrit les contenus ? Aujourd'hui le même (`gpt-4o`) écrit et juge.  | **Le tableau de la chaîne éditoriale** : Opus écrit et critique, Sonnet tient la porte (donc un juge différent de l'auteur, ce qu'exige B16). Ordre de grandeur : environ 3 $ par contenu au plafond, soit environ 3 contenus par jour avec la limite de 10 $ : **une limite, pas une cible**. Plafonds 10 $/jour et 200 $/mois inchangés sauf décision de Will. |
| D6  | Qui saisit les actions manuelles de Google (pas de source automatique fiable) ? | **Will, depuis l'écran de la porte**, avec un rappel hebdomadaire. Tant qu'il n'a rien saisi, le coupe-circuit reste actif et le plafond ne monte pas.                                                                                                                                                                                                           |
