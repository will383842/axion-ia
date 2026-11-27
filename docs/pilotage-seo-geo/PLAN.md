# Pilotage SEO et GEO en continu : plan

> Phase de conception, 27/11/2026. Ce plan est la synthèse de :
>
> - l'audit (`AUDIT.md`) ;
> - cinq expertises menées en parallèle : données Search Console, intentions et mots-clés, GEO / citations IA, boucle d'amélioration, critique.
>
> Les désaccords entre experts sont tranchés au § 9. **Aucun code sous `src/` ni `prisma/` n'est écrit dans cette phase.**

## 1. But et principes

**Le but.** Être présent sur Google **et** cité par les moteurs IA, sur les bonnes requêtes et les bonnes intentions, pour **tout le site** : articles, actualités, guides, pages villes, offres, FAQ, pages institutionnelles. Le système s'améliore en continu, et les garde-fous sont plus stricts que la vitesse.

Sept principes, non négociables :

1. **Mesurer avant d'agir.** Le site est jeune : ~428 impressions par semaine sur 118 pages du top 10 en août. Le chantier démarre en **mode observation seule, pendant au moins 8 semaines**. Aucune décision n'est prise sous les planchers statistiques (§ 4.2) : l'écran l'affiche au lieu d'agir.
2. **Réutiliser plutôt qu'empiler.** Les deux workers GSC actuels (`site-route-gsc`, `content-keyword-sync`) sont **remplacés** par une ingestion unique, et non complétés par une troisième. L'équipe éditoriale est réutilisée : carte des requêtes, éditeur SEO, mode mise à jour, chargé de liens, conformité. Il n'y a **aucun nouveau client HTTP Google**, seulement une extension de `gsc-client.ts`.
3. **Tout est éteint par défaut**, avec trois niveaux distincts : observation, propositions, automatique borné.
4. **`null` ≠ 0.** Une source absente (identifiants, API, table pas encore migrée) s'affiche « indisponible ». Elle ne produit jamais de zéros ni d'alerte, pour éviter de répéter l'échec `checkIndexationStagnant`.
5. **Aucune URL ne change jamais.** Une fusion, une redirection ou un noindex n'existent que sous la forme de **signalements** destinés à un humain.
6. **Aucune modification sans son « avant »** (journal et retour arrière), et **aucune date seule** : `dateModified` n'avance que si le corps change.
7. **Zéro JS sur les pages publiques.** Tout est serveur, worker ou console admin (`server-only`). Le budget Web Vitals reste intact.

## 2. Architecture en quatre couches

```
 MESURE (worker, file `seo-pilotage`)        ANALYSE (fonctions pures)          ACTION                          RESTITUTION
 ─────────────────────────────────           ─────────────────────────          ──────                          ───────────
 GSC Search Analytics par lot ──┐            opportunités (6 détecteurs)  ──►  propositions ─► validation  ──► console « Pilotage SEO & IA »
 URL Inspection (rotation)      ├─► tables ─►  intention des requêtes           (journal SeoModification)       rapport hebdo (section)
 Bing WMT (hebdo, facultatif)   │  d'histo-   courbe CTR du site               application (même transaction)  alertes rares (anti-répétition)
 Visites IA (Plausible, existe) │  rique      score de citabilité (HTML)       mesure d'effet + témoin
 Robots IA (Cloudflare, agrégé) │             cohérence des faits              retour arrière (bouton / auto)
 Panel GEO (Claude web_search) ─┘
```

**Une seule file nouvelle : `seo-pilotage`.** Elle a un seul worker et une charge minimale `{ tache, tick }`. Le worker **ignore** toute `tache` qu'il ne connaît pas, en le journalisant, ce qui est l'inverse du défaut actuel de `content-refresh` (AUDIT § 5 bis-4).

| Tâche            | Fréquence (heure de Paris)                       | Rôle                                                 |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `ingestion-gsc`  | tous les jours, 06:30                            | Import Search Analytics du dernier jour final        |
| `rattrapage-gsc` | 1 jour d'historique par passage, jusqu'à 16 mois | Remplir l'historique, une seule fois                 |
| `inspection`     | tous les jours, 07:00                            | Rotation de l'inspection d'URL, sous quota partagé   |
| `opportunites`   | le lundi, 05:00                                  | Calcul des opportunités, après la fin de l'ingestion |
| `robots-ia`      | tous les jours                                   | Collecte Cloudflare (si le jeton est disponible)     |
| `panel-geo`      | le mardi                                         | Panel de questions GEO                               |
| `mesure-effets`  | tous les jours                                   | Mesure de l'effet des modifications                  |
| `purge`          | le dimanche                                      | Purge par lots                                       |

Le rapport hebdomadaire (lundi 07:00 UTC) **lit** les tables : il n'appelle aucune API.

## 3. Couche mesure

### 3.1 Search Console : ingestion par lot (remplace les boucles « une URL »)

- **Le jour D** est le dernier jour où `dataState: "final"` rend des données : on le **détecte**, on ne le code pas en dur à J-3.
- **Appels pour le jour D**, en `type: web` :
  - **A** `[date, page]` avec `aggregationType: byPage` : totaux exacts par page, **requêtes anonymisées comprises** ;
  - **B** `[date, page, query]` : détail par requête ;
  - **C** `[date]` : total de la propriété, comme contrôle.
- **Pagination** : `rowLimit 25000` et `startRow`.
- **Erreurs** :
  - 429 : délai exponentiel et `Retry-After` ;
  - `403 quotaExceeded` : arrêt propre du passage ;
  - erreur sur un lot : le jour est noté « en échec » dans `GscImportRun` et repris au passage suivant.
- **Position** : on stocke `positionSum = position × impressions`, ce qui rend les cumuls exacts.
- **Chemins** : `normaliserChemin` traite l'hôte, `www`, le slash final, la query string et le fragment. Les anciennes URL `/en/…` (301) sont rattachées à leur équivalent FR via `mapEnToFr`, ou isolées.
- **Type de page** : `typePageDepuisChemin` est **dérivé** de `site-explorer/categories.ts` (une seule source de vérité). Valeurs : article, actualité, guide, ville, offre, faq, institutionnel, conversion, galerie, autre.
- **Filtre de données personnelles à l'ingestion, avant tout stockage** :
  - requêtes contenant un e-mail, un numéro de téléphone ou un nom de personne connu en base (formateurs, salariés, clients, candidats, via jointure) : **non stockées**, seulement comptées dans l'agrégat de la page ;
  - requêtes à moins de 10 impressions sur la journée : regroupées sous « autres », jamais stockées en texte.
- **Filtre « Grenoble »** : la requête est stockée telle quelle, car c'est une mesure, mais elle est **exclue de toute proposition**.
- **Après l'ingestion, on recalcule sans appel réseau :**
  - `SiteRoute.gsc*` sur une fenêtre de 28 j **identique pour toutes les URL** ;
  - `KeywordTracking`, pour garder la compatibilité avec la carte des requêtes et l'écran existant ;
  - les entrées du `tier-lifecycle`.

  `site-route-gsc` et `content-keyword-sync` sont ensuite **retirés de la planification**, en deux PR distinctes, une fois l'historique rempli.

- **Les quotas** sont à confirmer dans la page « Usage limits » de Google au moment de coder. De mémoire : ~1 200 requêtes/min par site, un quota de « charge » qui pèse surtout sur `page+query` multi-jours, et un plafond d'environ 50 000 lignes par jour et par type de recherche. Des requêtes d'un jour à la fois coûtent peu.

### 3.2 URL Inspection : rotation sous quota partagé

- **Compteur Redis unique** `gsc:inspection:quota:<jour Pacifique>`. Google donne 2 000 inspections par jour et par propriété, 600 par minute.
- **Découpage du quota** :

  | Usage                                                     | Inspections par jour |
  | --------------------------------------------------------- | -------------------- |
  | Suivi après publication existant (il passe à ce compteur) | 200                  |
  | Rotation                                                  | 1 400                |
  | Inspections manuelles depuis la console                   | 400                  |

- **Priorités de la rotation**, dans l'ordre :
  1. pages publiées ou modifiées depuis moins de 48 h ;
  2. pages dont les impressions chutent, ou nulles depuis 14 jours ;
  3. les 15 pages stratégiques (budget Web Vitals), chaque semaine ;
  4. pages jamais inspectées, puis les plus anciennes ;
  5. pages en noindex, une fois par mois.
- **Table `GscInspection`** : une ligne n'est écrite **que si un champ change** (verdict, couverture, canonique Google ou déclarée, dernier passage du robot).

### 3.3 Bing Webmaster Tools (facultatif, hebdomadaire)

- Brancher le client aujourd'hui inutilisé. Cela suppose d'ajouter les lectures de statistiques par page et par requête, dont **les noms exacts sont à vérifier dans la documentation Microsoft**.
- Intérêt : l'index Bing alimente Copilot.
- Si Bing expose un rapport de citations IA (**incertain**), c'est l'indicateur GEO le plus direct disponible, et il passe en priorité.
- La clé ne doit **jamais** apparaître dans un journal.

### 3.4 GEO : trois indicateurs, présentés pour ce qu'ils sont

| Indicateur                             | Source                                                                                                                                                                                         | Coût                                                                 | Limite affichée à l'écran                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Visites venues des IA**              | Plausible, `visites-ia.ts` (existe). Ajout : page d'arrivée × IA, tendance sur 12 semaines                                                                                                     | 0                                                                    | Sous-comptage : applications sans référent ; AI Overviews et AI Mode comptés comme « Google »               |
| **Passages des robots d'IA**           | API GraphQL Analytics de Cloudflare, agrégats `{jour, robot, famille de chemins, nombre}`. Ni IP ni user-agent brut                                                                            | 0 (droit `Analytics:Read` à ajouter au jeton : **décision de Will**) | Rétention et champs selon l'offre Cloudflare : **à vérifier**. Le passage d'un robot ≠ une citation         |
| **Présence dans les réponses (panel)** | 40 questions **figées** (versionnées dans le code), posées à **Claude + `web_search`** (`content-gen/clients/claude-search.ts`), 2 fois chacune, toutes les deux semaines, localisation France | ~0,03 $ par question en Haiku : **≈ 5 $/mois**                       | « Échantillon de N questions, réponses d'API ≠ ce que voit l'utilisateur, tendance sur 4 passages minimum » |

- **Moteurs du panel.** En V1, Claude seul : c'est le seul déjà branché, avec une porte de coût. Perplexity (Sonar) et OpenAI (outil de recherche web) sont techniquement possibles, mais **payants hors plafond Claude** : décision de Will (§ 10).
- **Gemini avec ancrage Google.** Ses conditions limitent le stockage des résultats : exclu tant qu'elles ne sont pas validées.
- **AI Overviews / AI Mode.** Il n'existe **aucune API**, et à notre connaissance la Search Console les fond dans « Web » (**à revérifier**). Aucun scraping d'interface grand public.
- **Stockage du panel** : question, moteur, date, URL citées, présence d'`axion-ia.com` et rang, domaines concurrents cités. **Pas le texte intégral.**

### 3.5 Score de citabilité, sans modèle

Fonction pure, sur 100 points, calculée sur le **HTML rendu** : le worker fait un fetch de la page publique, ce qui revient à un simple visiteur, sans JS ajouté.

| Critère                                                                                    | Points |
| ------------------------------------------------------------------------------------------ | ------ |
| H1 unique, au moins 3 H2, dont au moins 30 % formulés en question                          | 10     |
| Réponse directe de 40 à 90 mots dans les 200 premiers mots                                 | 15     |
| Au moins 3 passages autonomes de 40 à 120 mots, sans renvoi du type « comme vu plus haut » | 15     |
| Chiffres sourcés (nombre et lien externe dans le même paragraphe)                          | 10     |
| Date visible et `dateModified` de moins de 365 jours                                       | 10     |
| JSON-LD relié à `/#organization`, sans second nœud `Organization`                          | 10     |
| FAQ visible concordant avec `FAQPage`                                                      | 5      |
| Tableau ou liste structurée                                                                | 5      |
| Page indexable, canonique sur elle-même, dans le sitemap                                   | 10     |
| Au moins 2 liens internes vers des pages fortes                                            | 5      |
| Variante Markdown présente                                                                 | 5      |

Pénalités :

- **−20** si un fait « canon » diverge (prix, durée) : il est **lu** dans `pricing.ts` et `journee-ia-commun.ts`, jamais recopié ni modifié ;
- **−20** pour un mot interdit ou « Grenoble ».

Le score sert à **prioriser le travail éditorial**, pas à agir automatiquement. Il remplace le stub `scripts/seo-audit.ts` et corrige la checklist, qui annonce un gate qui n'existe pas.

## 4. Couche analyse : le moteur d'opportunités

Module pur `src/server/seo-pilotage/opportunites/*`. Les règles sont détaillées par l'expert « intentions ». Toutes les constantes sont exportées, puis **calibrées sur les 8 semaines d'observation**.

### 4.1 Détecteurs

| Détecteur                       | Règle                                                                                                                                                                                                  | Action proposée                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **a. Quasi-gagnante**           | Position pondérée entre 5 et 20, ≥ 100 impressions sur 28 j, page propriétaire de la requête                                                                                                           | Positions 5 à 10 : titre/méta, FAQ. Positions 11 à 20 : mise à jour, liens internes                               |
| **b. CTR anormal**              | Borne haute de Wilson (90 %) < 0,6 × CTR attendu, ≥ 200 impressions. La courbe CTR est **celle du site** : marque exclue, régression isotone, détecteur en veille s'il y a moins de 3 tranches valides | Titre/méta                                                                                                        |
| **c. Requête sans page dédiée** | L'intention de la requête ne correspond pas au type de la page qui sort, ≥ 50 impressions, position ≤ 30                                                                                               | Lien interne vers la bonne page si elle existe. Sinon, **brief** de nouvelle page (jamais publié automatiquement) |
| **d. Cannibalisation**          | Au moins 2 URL ≥ 20 % des impressions **et** au moins 3 bascules en 28 j, ≥ 100 impressions. Le propriétaire est choisi par `construireCarte`                                                          | Liens internes vers le propriétaire. Fusion : **signalement**                                                     |
| **e. Déclin**                   | −30 % de clics **et** ≥ 20 clics perdus, comparé à la période précédente, normalisé par la tendance du site entier, et à N−1 quand 13 mois d'historique existent                                       | Position stable : demande en baisse, aucune action. Position dégradée : mise à jour                               |
| **f. Jamais affichée**          | Page publique de plus de 45 j, 0 impression **au niveau de la page** sur 90 j. Catégories `legal` et `conversion` exclues                                                                              | Inspection, puis liens internes. Noindex ou fusion : **signalement**                                              |

### 4.2 Planchers et durcissement de l'existant

- **Plancher par requête** : ≥ 30 impressions sur 28 j, et présence au moins 3 semaines sur 4.
- **Plancher d'attribution d'un effet** : ≥ 300 impressions sur 28 j **pour la page**.
- **`declencheursMiseAJour`** (`suivi-publication.ts`) : ajouter un plancher de **100 impressions** à la règle « baisse de 3 positions », qui n'en a aucun. C'est une PR courte et séparée.
- **Alertes** : délai anti-répétition Redis de 30 jours par URL et par motif. Aucune alerte horaire.

### 4.3 Intention des requêtes

- **Règles lexicales françaises**, sur un texte **non trié** : une variante de `normaliserRequete` qui retire les accents sans trier les mots.
- **Ordre** : navigationnelle (marque), transactionnelle (prix, tarif, devis, financement), locale (référentiel `City`, homonymes gérés), commerciale (meilleur, comparatif, avis), informationnelle (c'est quoi, comment, définition), sinon inconnue.
- **Formats en drapeaux** : `question`, `definition`, `liste`. `voice_search`, `ai_overview` et `featured_snippet` ne sont pas des intentions.
- **Claude en dernier recours** : seulement pour les requêtes « inconnue » à ≥ 30 impressions, par lots de 100, réponse limitée à l'énumération, mise en cache, et après le filtre de données personnelles.

### 4.4 Score de priorité

`priorité = gain de clics estimé × confiance / effort`

| Action           | Effort |
| ---------------- | ------ |
| Titre/méta, lien | 1      |
| FAQ              | 2      |
| Mise à jour      | 3      |
| Nouvelle page    | 5      |

Les signalements sont listés à part. Un coefficient de valeur métier par catégorie est **à arbitrer par Will**.

### 4.5 Garde-fous de sortie, appliqués à toutes les propositions

- Le type `Action` **n'a aucune variante** « changer d'URL ».
- `CHEMINS_PROTEGES` couvre la section tarifs, la catégorie `legal`, et les pages alimentées par `pricing.ts`, `journee-ia-commun.ts` et `positionnement.ts` (**liste à dériver des imports, et verrouillée par test**). Sur ces pages, toute action devient un signalement.
- « Grenoble » est filtré avec `evaluerSujetCible` et `detecterInterdits`.

## 5. Couche action : la boucle d'amélioration

### 5.1 Ce que le système peut faire, par type de page

| Type de page                        | Titre / méta                                                                 | FAQ                                               | Liens internes                                                     | Mise à jour (mode existant)              | Nouvelle page       |
| ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------- | ------------------- |
| Article, actualité, guide (en base) | **Validation**, puis **auto borné** après 20 validations sans retour arrière | Validation                                        | Validation (insertion de lien contrôlée par `verifierLienInterne`) | Validation, puis auto borné (1 par jour) | Brief en validation |
| FAQ (table `FAQ`)                   | Validation                                                                   | Validation, jetons de prix intacts à l'octet près | —                                                                  | —                                        | Validation          |
| Page ville                          | **Recommandation** : titre calculé dans le code                              | Validation si `GeneratedVilleCopy`                | Recommandation                                                     | Interdit                                 | Recommandation      |
| Page offre                          | **Interdit** : prix, positionnement, Qualiopi                                | Interdit                                          | Interdit                                                           | Interdit                                 | Interdit            |
| Institutionnelle, légale            | Recommandation (code), légal **interdit**                                    | Recommandation                                    | Recommandation                                                     | Interdit                                 | Recommandation      |

- **« Recommandation »** : la carte apparaît dans la console avec le texte proposé, et un humain l'applique par une PR. Le système **n'écrit jamais de fichier**, ce qui rend `pricing.ts`, `legal.ts`, `positionnement.ts` et `journee-ia-commun.ts` intouchables par construction.
- **JSON-LD** : les gabarits sont dans le code. Seules les données qui les nourrissent (`faqJson`, `keyTakeaway`) passent par la validation.

### 5.2 Garde-fous d'écriture

- **Liste blanche de champs par type de cible.** Le slug est comparé avant et après dans la même transaction, et la transaction est annulée s'il a changé.
- **Contrôle de conformité de chaque texte proposé** : `controlerConformite` (interdits, Grenoble, prix hors source de vérité, vouvoiement). Un **chiffre nouveau** entraîne un refus.
- **Une seule modification par page tous les 28 jours.** Verrou : un index unique partiel sur le journal.
- **Quota** : `pilotage_modifs_max_jour` = 3, distinct de `equipe_maj_max_jour`.
- **Pas de date seule** : une écriture de méta ou de FAQ **réécrit l'ancien `updatedAt`** (AUDIT § 5 bis-3).
- **Pages modifiées** : `revalidatePath` et purge Cloudflare ciblée, avec le même mécanisme que les surcharges d'aperçu. Le comportement exact est à vérifier dans la PR.
- **Arrêt d'urgence** : `readKillSwitchFailSafe` est lu avant chaque écriture.

### 5.3 Journal et retour arrière : table `SeoModification`

- **Champs** :
  - cible : `cibleType`, `cibleId`, `url`, `champ` ;
  - contenu : `avant` et `apres` (Json), `hashAvant`, `hashApres` ;
  - suivi : `etat` (**chaîne de caractères**, pas une énumération, pour tolérer deux versions du code), `origine`, `raison`, `coutUsd` ;
  - cycle de vie : `proposeeLe`, `appliqueeLe`, `decidePar` (identifiant admin seulement), `mesureAvant` et `mesureApres`, `groupe`.
- **Écriture atomique** avec la modification elle-même.
- **Le mode mise à jour existant est modifié** pour écrire l'« avant » du corps dans ce journal, ce qui **comble l'absence actuelle de retour arrière**.
- **Bouton « Annuler »** : refusé si la valeur actuelle ≠ `hashApres` (retouche entre-temps). Dans ce cas, le conflit est affiché.
- **Retour arrière automatique** (`retour_auto`, éteint par défaut) :
  - immédiat si l'inspection passe à « exclue » ou si la page est en erreur avant J+7 ;
  - sur la mesure, seulement si la page avait ≥ 300 impressions et que deux relevés consécutifs (J+21 et J+28) montrent clics(après/avant) ÷ médiane du témoin ≤ 0,70, avec ≥ 20 clics perdus et une position dégradée d'au moins 2 places.
  - Sinon : verdict « **non concluant** », et la modification est conservée.

### 5.4 Mesure de l'effet

- **Fenêtres comparées** : [J−31, J−3] contre [J+3, J+31]. Le client GSC reçoit une variante avec dates explicites.
- **Groupe témoin** : 20 % des pages éligibles, tirées de façon déterministe par hachage de l'identifiant, **jamais modifiées**. La différence de différences neutralise la saisonnalité et les mises à jour de Google.
- **GEO** : l'effet sur les citations **n'est pas attribuable** page par page avec un panel de 40 questions. On l'affiche comme une tendance globale, sans attribution.

### 5.5 File de validation dans la console

Chaque carte de proposition montre :

- la page ;
- **« Ce que nous proposons »**, avec l'avant et l'après surlignés ;
- **« Pourquoi »**, en une phrase chiffrée ;
- **« Contrôles passés »** ;
- **« Coût »** ;
- trois boutons : **Appliquer**, **Modifier puis appliquer**, **Refuser**.

Règles de la file :

- une proposition **expire au bout de 14 jours** ;
- **10 propositions ouvertes au maximum** : au-delà, le système n'en produit plus, pour que la file ne pourrisse pas. Le temps humain estimé est de ~5 min par carte, soit **< 1 h par semaine**.

## 6. Coûts Claude (dans les plafonds existants)

**Tout appel passe par la porte existante** (`assertPlafondsClaude` puis `reserverCout` et `solderReservation`). Le coût est donc compté dans les **mêmes 10 $/jour et 200 $/mois**, et la réserve Qualiopi est respectée. Deux réglages s'y ajoutent dans `ContentGenConfig` :

- **`pilotage_cout_max_jour_usd`**, défaut 1 $ ;
- **`pilotage_cout_max_mois_usd`**, défaut 20 $.

Le pilotage ne peut donc **jamais prendre plus de 10 % du budget mensuel** de la production.

| Poste                                                                                     | Estimation                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------- |
| Panel GEO (40 questions × 2 passages, toutes les deux semaines, Haiku 5.5 + `web_search`) | ≈ 5 $/mois                            |
| Propositions titre/méta/FAQ (Sonnet 5.5, ≤ 3 par jour, remplacements ciblés)              | ≈ 3-6 $/mois                          |
| Classement des intentions inconnues (Haiku, par lots, mis en cache)                       | < 1 $/mois                            |
| Mises à jour d'articles                                                                   | Déjà comptées par l'équipe éditoriale |
| **Total**                                                                                 | **≈ 10-12 $/mois**                    |

Mesure, opportunités et score de citabilité : **0 $** (aucun modèle).

**Rattachement d'un appel hors génération à la porte.** `reserverCout` exige une ligne `content_gen_jobs` d'un type autorisé (AUDIT § 5 bis-2). La PR 0 tranche entre deux options :

- **(a) job porteur par passage**, d'un type existant, statut terminal, `inputPayload.origine = "pilotage"` et `plafondJobUsd`, invisible pour l'orchestrateur et les balayages de récupération (à vérifier dans `content-gen/recovery`) ;
- **(b) option `porteur` explicite dans le registre.**

Option (a) recommandée : pas de nouvelle valeur d'énumération, donc pas de risque pendant la fenêtre app/worker. Le même correctif répare le mode mise à jour (`maj-<id>`) et l'éditeur SEO (`blog_edition_seo`).

## 7. Restitution

### 7.1 Console : un écran « Pilotage SEO & IA »

Chemin : `content-gen/pilotage`, `force-dynamic`, composants serveur. Le nom **« geo » est exclu** : il est déjà pris par les villes.

| Onglet                | Contenu                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vue d'ensemble**    | Clics, impressions, position et CTR sur 28 jours contre les 28 jours précédents, **par type de page**. « Données jusqu'au JJ/MM ». État de chaque source (disponible / indisponible / en retard) |
| **Pages**             | Tableau filtrable par type de page, avec le score de citabilité                                                                                                                                  |
| **Requêtes**          | Intention, page propriétaire, cannibalisation                                                                                                                                                    |
| **Opportunités**      | Triées par priorité, signalements à part                                                                                                                                                         |
| **Propositions**      | La file de validation                                                                                                                                                                            |
| **En mesure**         | Verdicts en mots simples : « +18 % de clics, conservé »                                                                                                                                          |
| **Moteurs IA**        | Visites venues des IA, robots, panel, chacun avec sa limite écrite                                                                                                                               |
| **Santé des données** | Derniers imports, quotas consommés, erreurs                                                                                                                                                      |

`content-gen/keyword-tracking` renvoie vers l'onglet Requêtes une fois celui-ci livré. Aucun écran n'est supprimé dans ce chantier.

Textes en français simple, sans jargon : « position moyenne dans Google », « part des personnes qui cliquent ».

### 7.2 Rapport hebdomadaire

Une **section** ajoutée à `content-weekly-report-worker.ts`. Pas de second e-mail.

- les 5 chiffres clés et leur évolution ;
- les 5 meilleures opportunités ;
- les modifications appliquées et leurs verdicts ;
- les moteurs IA (avec leurs limites) ;
- les sources indisponibles.

**Si le pilotage est éteint, la section n'apparaît pas.**

## 8. Interrupteurs

| Interrupteur                               | Où                                          | Défaut          | Effet                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT_PILOTAGE_SEO`                     | variable d'environnement, **worker et app** | absent (éteint) | Seul `"true"` exact allume la file `seo-pilotage` et l'écran (sinon : « Pilotage éteint »)                                                                       |
| `pilotage_seo.mode`                        | `ContentGenConfig`                          | `observation`   | `observation` : mesure et analyse seulement. `proposition` : en plus, la file de validation. `auto_borne` : en plus, l'application automatique des champs listés |
| `pilotage_seo.auto_champs`                 | idem                                        | `[]`            | Ex. `["metaDescription"]`                                                                                                                                        |
| `pilotage_seo.retour_auto`                 | idem                                        | `false`         | Active le retour arrière automatique                                                                                                                             |
| `pilotage_seo.panel_geo`                   | idem                                        | `false`         | Active le panel GEO                                                                                                                                              |
| `pilotage_seo.part_temoin`                 | idem                                        | `0.2`           | Part des pages tirées dans le groupe témoin                                                                                                                      |
| `pilotage_cout_max_jour_usd` / `_mois_usd` | idem                                        | 1 / 20          | Sous-plafonds de coût du pilotage                                                                                                                                |
| `pilotage_modifs_max_jour`                 | idem                                        | 3               | Quota de modifications par jour                                                                                                                                  |

Dépendances entre interrupteurs :

- Les propositions qui utilisent l'éditeur SEO ou le mode mise à jour exigent en plus `CONTENT_EQUIPE_EDITORIALE=true` et `CONTENT_GEN_BLOG_CLAUDE=true`.
- Le kill switch global coupe tout ce qui écrit ou dépense.

## 9. Arbitrages entre experts

| Sujet                                          | Avis                                                                                       | Décision                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nouveau worker ?                               | Critique : « zéro worker ». Expert boucle : « file séparée obligatoire » (AUDIT § 5 bis-4) | **Une** file et **un** worker nouveaux, qui **en retirent deux** (`site-route-gsc`, `content-keyword-sync`). Bilan : −1                                                                                                                              |
| Branches `feat/equipe-ed-*` à attendre ?       | Critique : « attendre leur fusion »                                                        | **Faux** : les PR 2, 14, 16 et 18 sont fusionnées (#2351, #2359, #2389, #2379). Il reste des branches distantes périmées (voir DECOUPAGE)                                                                                                            |
| Type de contenu dédié au panel (`geo_panel`) ? | Expert GEO : oui. Expert boucle : non (énumération = migration et risque app/worker)       | **Non** : job porteur (§ 6)                                                                                                                                                                                                                          |
| Coût du panel                                  | Critique : 10-40 $/semaine. Expert GEO : 5-20 $/mois                                       | Le critique s'appuyait sur `src/server/clients/claude-search.ts`, qui **n'a pas** de recherche web, et sur un Sonnet à 30 k jetons. Retenu : Haiku, 40 questions, toutes les deux semaines, ≈ 5 $/mois, **plafonné à 20 $/mois** par le sous-plafond |
| Historique sans migration ?                    | Expert données : impossible proprement                                                     | **Migration additive** (tables nouvelles seulement), justifiée § 3 de DECOUPAGE                                                                                                                                                                      |
| Noindex automatique du `tier-lifecycle`        | Critique : risque sur bruit                                                                | Il a déjà un plancher de 100 impressions (`tier-decisions.ts:68`). On le **laisse**, mais il lit désormais la table d'historique (28 j homogènes)                                                                                                    |

## 10. Questions ouvertes pour Will

1. **Identifiants GSC présents en production ?** C'est à vérifier **sans lire les valeurs**, par la sonde de la PR 1. C'est la condition n° 1.
2. Donner le droit `Analytics:Read` au jeton Cloudflare (aujourd'hui limité à la purge, probablement), ou créer un second jeton en lecture seule.
3. Une clé Bing Webmaster ?
4. Panel GEO : Claude seul en V1, ou ajouter Perplexity / OpenAI (payants **hors** plafond Claude) ?
5. Coefficient de valeur métier par type de page (ex. villes et offres × 1,5) ?
6. Liste des 40 questions du panel, à valider : un premier jet est fourni dans la PR 9.
7. Persona d'auteur (« Manon ») contre une personne réelle pour l'E-E-A-T : décision éditoriale, hors code.
8. **Hors chantier, mais signalé** : l'envoi d'articles à l'API Google Indexing (réservée à `JobPosting` et `BroadcastEvent`) est à arrêter.

## 11. Conditions de démarrage (avant d'allumer quoi que ce soit)

| Mode                  | Conditions                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observation**       | Sonde GSC verte. Migration vérifiée par `prisma migrate status` après l'atterrissage (l'entrypoint migre en best-effort). Écran « Santé des données » vert depuis 7 jours |
| **Propositions**      | 8 semaines d'observation. Planchers calibrés sur les données réelles. Journal et retour arrière livrés **et testés**. Défauts AUDIT § 5 bis 1 à 3 corrigés                |
| **Automatique borné** | 20 propositions validées sans retour arrière. Groupe témoin actif. Champ par champ, en commençant par `metaDescription` des articles                                      |
