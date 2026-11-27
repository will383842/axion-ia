# S10 · Suivi des liens reçus : conception

> Phase de conception, 27/11/2026, branche `docs/seo-s6-s10-conception`. Fiche rattachée au chantier « Pilotage SEO et GEO » (`AUDIT.md`, `PLAN.md`, `DECOUPAGE.md`). Inventaire fait en **lisant le code** (copie superficielle de `main` au commit `0f98ce51`). **Aucun code n'est écrit dans cette phase.**
>
> **Objectif.** Savoir **quels sites citent Axion IA** (lien suivi ou non), suivre leur évolution, et **classer les occasions** de nouvelles citations (presse régionale, annuaires, institutions…), avec les seuls outils **gratuits** déjà branchés.
>
> Règles dures de la fiche, en plus des règles communes de `DECOUPAGE.md` :
>
> - **aucune source payante** (ni Ahrefs, ni Majestic, ni Semrush, ni Moz, ni API de recherche payante) ;
> - **aucun envoi automatique** : chaque prise de contact est un **brouillon** validé par Will, **jamais envoyé par le système** ; ni e-mail, ni formulaire rempli par un robot ;
> - aucun achat ni échange de liens, aucun commentaire de blog, aucune ferme de liens (règles de `charge-de-liens.ts`) ;
> - RGPD et prospection : minimisation, oppositions respectées, effacement possible (§ 6) ;
> - migrations **additives** (tables nouvelles seulement), états en chaînes de caractères, fenêtre app/worker tolérée dans les deux sens.

## 0. En une phrase

**Rien ne mesure aujourd'hui les liens reçus.** Le client Search Console sait lire les performances et inspecter une URL, **pas le rapport « Liens »**, que l'API publique n'expose pas. Il existe pourtant trois briques gratuites et sous-utilisées (le champ `referringUrls` de l'inspection d'URL, les référents de Plausible, l'export CSV manuel de la Search Console) et un **« chargé de liens »** déjà fusionné qui propose des occasions de liens **sans rien envoyer**. S10 relie ces briques, ajoute un registre des liens reçus et une vérification « suivi / non suivi », et **réutilise** le chargé de liens au lieu d'en créer un second.

## 1. Inventaire vérifié

### 1.1 Search Console (`src/server/content-gen/seo/gsc-client.ts`)

| Fonction exportée                   | API appelée                                                                       | Ce qu'elle donne                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gscTopKeywordsForUrl`              | `webmasters/v3` `searchanalytics.query`                                           | Requêtes d'une page                                                                                                                              |
| `gscPageMetricsForUrl`              | idem                                                                              | Agrégat d'une page                                                                                                                               |
| `gscPageMetricsForUrlDates`         | idem                                                                              | Agrégat d'une page à dates explicites (P1)                                                                                                       |
| `gscSearchAnalytics`                | idem, par lot, paginé (dimensions `date`, `page`, `query`, `country`, `device`, `searchAppearance`) | Performances par lot (P1, **non branché**)                                                                                                       |
| `gscDernierJourFinal`, `gscSonde`   | idem                                                                              | Dernier jour final ; état des identifiants (`ok`, `identifiants_absents`, `refus`, `quota`, `erreur`)                                           |
| `gscInspectUrl`                     | `searchconsole/v1` `urlInspection/index:inspect` (2 000 par jour, 600 par minute) | État d'indexation d'une URL. Le type `GscUrlInspectionResult` déclare **`indexStatusResult.referringUrls`** (l. 326), **lu par aucun code** (grep) |
| `getGscCachedToken`                 | —                                                                                 | Jeton en cache                                                                                                                                   |

**Ce que la Search Console peut et ne peut pas donner, honnêtement :**

- L'**API publique** (Search Analytics, Sitemaps, Sites, URL Inspection) **n'expose pas le rapport « Liens »**. Aucun appel du client ne s'en approche, et le client n'a pas à en inventer un. (Affirmation fondée sur la documentation Google connue à ce jour : **à revérifier** au moment de coder, sans changer le plan si elle tient.)
- `referringUrls` de l'inspection donne **quelques** pages qui mènent à l'URL inspectée. C'est un **échantillon** de découverte (il peut contenir des pages internes ou des sitemaps), pas une liste de liens. Contenu réel : **à vérifier sur des réponses de production**.
- Le **rapport « Liens » de l'interface** (liens externes, principaux sites associés, principaux textes d'ancrage, pages les plus liées) est **exportable à la main** en CSV, Google Sheets ou Excel par Will. C'est la seule source Google « liens » exploitable. Limites : échantillon (Google ne promet pas l'exhaustivité), **aucune indication « suivi / non suivi »**, mise à jour irrégulière, en-têtes de colonnes dans la langue de l'interface (**noms exacts à vérifier sur un export réel**).
- La propriété est un **domaine** (`GSC_PROPERTY_URL=sc-domain:axion-ia.com` dans `.env.example` l. 473) : le rapport couvre tous les sous-domaines.

### 1.2 Bing Webmaster Tools (`src/server/content-gen/seo/bing-wmt-client.ts`)

- Trois fonctions : `bingWmtGetCrawlStats`, `bingWmtGetUrlInfo`, `bingWmtGetQuota`, plus `isBingWmtReady`. **Importé par aucun fichier** (grep : code mort, comme le note l'AUDIT).
- Aucune lecture de liens. L'API Bing documente, à notre connaissance, des lectures de liens entrants (noms du type « GetLinkCounts » / « GetUrlLinks ») : **à vérifier dans la documentation Microsoft**. Gratuit, mais **non branché** et suspendu à la clé (PLAN § 10, question 3) : hors V1, PR facultative S10-8.
- La clé part dans la query string (l. 65, 103, 139) : jamais d'URL appelée dans un journal.

### 1.3 Référents déjà collectés

| Source                                                                      | Ce qui existe                                                                                                                                                                                                                                                                           | Utilité pour S10                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plausible auto-hébergé, API Stats v2 (`src/server/analytics/visites-ia.ts`) | Lecture serveur (`server-only`), variables `PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`, `NEXT_PUBLIC_PLAUSIBLE_API_URL`. Interroge déjà `visit:source` et `visit:referrer`, **filtré sur les IA**. État « indisponible » explicite, aucun appel au build, cache 5 min                           | **Même requête sans filtre IA** = les sites qui **envoient des visites**, donc qui portent un lien **cliqué**. Gratuit, déjà branché                                                                                                                                                       |
| `src/lib/tracking-referer.ts`                                               | Classe le référent côté navigateur (moteurs, IA, `direct`, `other`) et l'envoie comme événement Plausible                                                                                                                                                                               | Aucune : le seau `other` ne garde pas le domaine. **Ne pas toucher** (verrou `referents-ia.spec.ts`, budget JS public)                                                                                                                                                                   |
| `Submission.referer` (`prisma/schema.prisma` l. 538)                        | Colonne texte                                                                                                                                                                                                                                                                           | **Aucun écrivain trouvé** (grep) : à vérifier. Même si elle était remplie, elle est liée à une personne (formulaire) : **exclue** de S10                                                                                                                                                  |
| Cloudflare                                                                  | Aucune collecte (AUDIT § 4) ; droit `Analytics:Read` suspendu à Will (PLAN § 10, question 2)                                                                                                                                                                                            | Hors V1. Le champ de référent disponible dans l'API GraphQL est **à vérifier**                                                                                                                                                                                                           |

**Limite structurelle des référents** : la politique par défaut des navigateurs (`strict-origin-when-cross-origin`) n'envoie que l'**origine** d'un site tiers. Plausible donne donc surtout un **domaine**, rarement la page exacte qui porte le lien. Et seuls les liens **cliqués** y apparaissent.

### 1.4 Briques voisines à réutiliser

| Brique                                                                                                                                                                                                       | Constat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chargé de liens** (PR 18, #2379) : `src/server/content-gen/equipe/charge-de-liens.ts`, `charge-de-liens-donnees.ts`, `src/server/actions/content-gen/charge-liens.ts`, écran `content-gen/charge-liens` | **C'est déjà un générateur d'occasions de liens externes**, pas seulement du maillage interne (l'AUDIT § 5 le résume à tort par « maillage interne vérifié »). Par article publié : au plus 5 occasions (`MAX_OCCASIONS_PAR_ARTICLE`), types `media-region`, `annuaire`, `partenaire`, `page-citante`, états `proposee` / `validee` / `ecartee`, un message de 700 caractères au plus rédigé par Claude (plafond 3 $ par article) et contrôlé par `messageValide` (vouvoiement, aucun prix, aucun « échange / backlink / achat / sponsoris », aucune autre URL). **Rien n'est envoyé** (« ce module n'importe aucun envoi »). Contrôle d'opposition `estOppose` : `EmailOpposition` (par empreinte `hashEmailForLookup`), `ProspectionSuppressionEntry` (type `email`) **et** `ProspectionContact` dont la personne a `optOut`. Accès réservé aux rôles `super_admin` et `admin`. Derrière `CONTENT_EQUIPE_EDITORIALE`. Lancé par la tâche `liens-hebdo` de `content-refresh-worker.ts` (20 articles au plus par passage) |
| Ses limites                                                                                                                                                                                                  | Les occasions vivent dans `ContentGenJob.outputJsonRaw.chargeLiens` (JSON, **par article**), avec un risque d'écrasement accepté et documenté (en-tête de `charge-de-liens-donnees.ts`). Aucune vue **par domaine**, aucun dédoublonnage entre articles, aucun suivi « lien obtenu ». Le type `partenaire` n'est produit par aucune source (`chargerCandidats` ne rend que `page-citante`, `annuaire`, `media-region`). « Aucun candidat ne porte encore de `contactEmail` » (aucune base de contacts presse dans le dépôt)                                     |
| **Couverture médias** : modèle `MediaCoverage` (`prisma/schema.prisma` ~l. 11982), lecture `src/server/press/media-coverage-queries.ts`, écran `presse/couverture`                                          | Retombées presse saisies à la main (média, URL, date, statut). Ce sont des **citations** : chaque retombée publiée est un candidat « lien reçu » à vérifier                                                                                                                                                                                                                                                                                                                                                                                  |
| **Fiches locales** des villes (`src/content/villes/fiches-locales/`)                                                                                                                                         | Institutions publiques sourcées (pôles, technopoles, French Tech, CCI, universités…) : déjà utilisées par le chargé de liens comme « annuaires » (`CATEGORIES_ANNUAIRE`)                                                                                                                                                                                                                                                                                                                                                                       |
| `src/server/content-gen/kb-ingest/robots-respect.ts`                                                                                                                                                         | `checkUrlAllowed`, `getRobotsRules` : respect de `robots.txt` et du délai d'exploration, déjà utilisé par `url-extractor.ts` (délai 8 s, 2 Mo maximum)                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/server/qualiopi/presence/_csv-utils.ts`                                                                                                                                                                 | `parseCsvRows(content, separator)` : analyseur CSV existant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/server/seo-pilotage/donnees/chemins.ts`                                                                                                                                                                 | `normaliserChemin` (P3) : normaliser la page cible d'un lien                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/rgpd-erase.ts`                                                                                                                                                                                      | Effaceurs par type de donnée (`eraseSubmissionsForEmail`, `eraseNewsletterForEmail`…) : S10 y ajoute le sien                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Catalogue `content-gen/external-links` + `external-links-monitor-worker.ts`                                                                                                                                  | Liens **sortants** (sources citées). Hors sujet, à ne pas confondre                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Grep `backlink|liens entrants|referring|netlinking|inbound link|ahrefs|majestic|semrush` sur `src`, `scripts`, `prisma` : aucun suivi de liens reçus. Les occurrences sont des commentaires (`links/trust-tier.ts` : « zéro dep externe Ahrefs/Moz/SemRush », `sitemap.ts`, `liens-internes.ts`…), des listes de mots-clés (`content/keywords/*.ts`), des textes commerciaux de l'offre « visibilité entreprise » (« backlink dofollow » vendu aux clients : `page-images.ts`, `formations/entreprise`), un faux positif (« Majestic », hôtel de `copy/cannes.ts`), le motif interdit du chargé de liens, et le champ `referringUrls` non lu. Aucune ne mesure un lien reçu.

## 2. Ce que S10 mesure, et avec quelle confiance

| Source (toutes gratuites)                                            | Ce qu'elle trouve                                          | « Suivi / non suivi » ?        | Confiance                                | Branchée ?                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------ | ---------------------------------------- | ---------------------------------- |
| **A. Export CSV du rapport « Liens »** de la Search Console, déposé par Will | Pages liantes (échantillon), sites, ancres, pages ciblées | Non                            | Bonne sur l'existence, partielle         | À construire (import manuel)       |
| **B. Plausible**, référents hors moteurs et hors IA                  | Domaines qui envoient des visites (liens cliqués)          | Non                            | Bonne sur le domaine, rarement la page   | Client existant, requête à ajouter |
| **C. `referringUrls`** de l'inspection d'URL                        | Quelques pages de découverte                               | Non                            | Faible, à mesurer                        | Client existant, champ non lu      |
| **D. Retombées presse** (`MediaCoverage`) et saisie manuelle         | Citations connues                                          | Non                            | Bonne                                    | Existant                           |
| **E. Vérification polie de la page liante** (S10-4)                  | Présence réelle du lien, attribut `rel`, ancre             | **Oui** : `nofollow`, `ugc`, `sponsored` ou rien | Bonne pour le HTML servi ; **aveugle** aux liens injectés en JavaScript | À construire                       |

**Ce que S10 ne saura jamais** : le nombre total de liens (aucune source gratuite exhaustive), l'« autorité » d'un domaine au sens des outils payants, les liens derrière une connexion ou un mur payant, les mentions **sans lien** (sauf saisie à la main), les citations dans les réponses des moteurs IA (c'est le panel GEO, P11).

L'écran l'écrit en toutes lettres : « Échantillon : Google ne liste pas tous les liens, et Plausible ne voit que les liens cliqués. »

## 3. Modèle de données (additif : tables nouvelles seulement)

Une migration `prisma/migrations/<date>_pilotage_liens_recus/`, **aucune table existante modifiée**, états en **chaînes de caractères** (pas d'énumération : deux versions du code peuvent coexister pendant la fenêtre app/worker).

### 3.1 `LienRecu` : un lien (page source → page cible)

| Champ                                   | Type                      | Remarque                                                                                                          |
| --------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`                                    | uuid                      |                                                                                                                   |
| `pageSource`                            | texte (≤ 2 000), nullable | URL de la page qui porte le lien ; **null** quand seule l'origine est connue (Plausible)                         |
| `domaineSource`                         | texte (≤ 255)             | Hôte normalisé (minuscules, sans `www.`)                                                                         |
| `cheminCible`                           | texte (≤ 500), nullable   | `normaliserChemin` ; null si inconnu                                                                             |
| `ancre`                                 | texte (≤ 200), nullable   | Tronquée                                                                                                          |
| `rel`                                   | texte (≤ 30)              | `suivi` / `nofollow` / `ugc` / `sponsored` / `inconnu` (combinaisons en liste triée, ex. `nofollow,ugc`)          |
| `etat`                                  | texte (≤ 30)              | `a_verifier` / `present` / `absent` / `bloque_robots` / `erreur` / `non_verifiable`                              |
| `origines`                              | tableau de textes         | `gsc_csv`, `plausible`, `inspection`, `presse`, `saisie`, `bing` (facultatif)                                    |
| `premiereVueLe`, `derniereVueLe`        | date                      | Dates d'apparition dans une source                                                                               |
| `derniereVerifLe`                       | date, nullable            | Dernière vérification (S10-4)                                                                                     |
| `mediaCoverageId`                       | uuid, nullable, sans clé étrangère stricte | Rattachement à une retombée presse                                                                  |
| `occasionId`                            | uuid, nullable            | Lien obtenu à la suite d'une occasion (§ 3.4)                                                                    |
| `@@unique([domaineSource, pageSource, cheminCible])`, index `[etat]`, `[domaineSource]` |  | Postgres traite les `NULL` comme distincts dans un index unique : l'unicité des lignes « domaine seul » est faite par le code (à vérifier dans la PR, ou colonne `cleUnique` calculée) |

**Jamais** : texte de la page liante, nom d'une personne, adresse e-mail, IP, agent utilisateur.

### 3.2 `LienRecuImport` : trace d'un import CSV

`id`, `typeExport` (`gsc_liens_externes_recents`, `gsc_sites_principaux`, `gsc_ancres`, `gsc_pages_cibles` : **libellés à aligner sur les exports réels**), `empreinte` (SHA-256 du fichier, **unique** : réimporter le même fichier ne fait rien), `nomFichier`, `lignesLues`, `lignesCreees`, `lignesMisesAJour`, `lignesIgnorees`, `erreurs` (JSON, 20 premières, sans contenu de cellule au-delà de 200 caractères), `importePar` (identifiant admin), `importeLe`.

### 3.3 `LienDomaineReleve` : courbe par domaine

`id`, `domaine`, `releveLe` (date), `source` (`gsc_csv` / `plausible`), `nbPagesLiantes` (nullable), `nbVisites` (nullable), unique `[domaine, releveLe, source]`. Sert la courbe « domaines qui nous citent » sans recompter les lignes.

### 3.4 `OccasionLien` : une occasion, **par domaine** (pas par article)

| Champ                                  | Type                         | Remarque                                                                                                                         |
| -------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `domaine` (unique), `urlPage`    |                              | Page où le lien aurait du sens (rubrique, annuaire, page partenaires)                                                            |
| `categorie`                            | texte                        | § 4.1                                                                                                                            |
| `origine`                              | texte                        | `charge_de_liens`, `fiche_locale`, `retombee_presse`, `referent_plausible`, `lien_recu`, `saisie`                               |
| `pertinence`, `portee`, `effort`       | entiers 1 à 3                | Saisis ou corrigés par un humain ; § 4.2                                                                                         |
| `score`                                | décimal                      | Calculé, jamais saisi                                                                                                            |
| `statut`                               | texte                        | § 4.3                                                                                                                            |
| `canal`                                | texte                        | `formulaire_public` / `adresse_generique` / `adresse_nominative` / `aucun`                                                       |
| `contactUrl`                           | texte, nullable              | Page « contact » ou « proposer un sujet » publique                                                                               |
| `contactEmail`                         | texte, nullable              | **Seulement** une adresse publiée par l'organisation pour ce type de demande ; nominative : voir § 6                            |
| `contactSourceUrl`                     | texte, nullable              | Où l'adresse a été lue (preuve de source publique)                                                                              |
| `notes`                                | texte (≤ 1 000), nullable    | Saisie humaine                                                                                                                   |
| `creeLe`, `majLe`, `decidePar`, `dernierContactLe` |                  | `decidePar` = identifiant admin seulement                                                                                        |

### 3.5 `BrouillonContact` : le texte que Will enverra lui-même, ou non

`id`, `occasionId`, `texte` (≤ 700 caractères, comme le chargé de liens), `version`, `origine` (`modele` / `humain`), `statut` (`brouillon` / `valide` / `abandonne`), `valideLe`, `validePar`. **Aucun statut `envoye` posé par le système** : quand Will a envoyé depuis sa propre messagerie, il passe **l'occasion** en `contacte_par_will` d'un clic.

### 3.6 Lien avec le chargé de liens

Le chargé de liens **reste tel quel** en V1 (JSON par article, sous `CONTENT_EQUIPE_EDITORIALE`). L'écran S10 offre un bouton « Suivre ce domaine » sur une occasion `validee` du chargé : il crée ou complète l'`OccasionLien` du domaine (dédoublonnage par domaine). Écrire directement le chargé de liens dans les nouvelles tables est une PR ultérieure (S10-9), à faire **après** la fusion de la PR 12 de l'équipe éditoriale (`DECOUPAGE.md` § 3) et en tolérant les deux versions du worker.

## 4. Classement des occasions

### 4.1 Catégories

| Catégorie            | Exemples (génériques)                                                                    | Source des idées dans le dépôt                       | Attention                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `presse_regionale`   | Quotidiens et hebdomadaires régionaux, rubriques économie                               | `MediaCoverage`, saisie                              | Jamais le nom de la ville du siège dans un brouillon (motif du chargé de liens)                               |
| `presse_pro`         | Médias RH, formation, PME, numérique                                                    | saisie                                               |                                                                                                               |
| `annuaire_public`    | Annuaires d'institutions publiques, CCI, French Tech, technopoles                       | fiches locales (`CATEGORIES_ANNUAIRE`)               | Jamais d'annuaire payant ni de « fermes » d'annuaires                                                         |
| `annuaire_pro`       | Annuaires professionnels gratuits et modérés                                            | saisie                                               | **Aucune** inscription qui affirme une certification (verrou Qualiopi du dépôt) ni un financement             |
| `institution`        | Pôles de compétitivité, universités, écoles (pages partenaires, ressources)             | fiches locales                                       | Pas de partenariat suggéré qui n'existe pas                                                                   |
| `association_pro`    | Fédérations, clubs d'entreprises, réseaux de dirigeants                                 | saisie                                               |                                                                                                               |
| `evenement`          | Salons, conférences, rencontres locales (pages intervenants)                            | saisie                                               |                                                                                                               |
| `ressource_citee`    | Pages qui citent déjà le sujet d'un article (le chargé de liens les appelle `page-citante`) | `ContentCitation` via le chargé de liens            |                                                                                                               |
| `mention_sans_lien`  | Page qui cite Axion IA sans lien                                                         | saisie, retombées presse                             | La demande d'ajout de lien est un brouillon comme les autres                                                  |
| `autre`              |                                                                                          |                                                      |                                                                                                               |

Les réseaux sociaux, forums et commentaires ne sont **pas** des occasions (liens `nofollow` ou `ugc`, et commentaires interdits).

### 4.2 Score

`score = pertinence × portée × probabilité / effort`, chaque terme de 1 à 3, constantes exportées et testées :

- **pertinence** : thème (IA, formation, PME, transformation) et zone (une des villes indexées de S6, ou national) ;
- **portée** : estimation **humaine**, sans métrique payante (1 = site confidentiel, 3 = média régional ou institution de référence) ; Plausible peut l'étayer si le domaine nous envoie déjà des visites ;
- **probabilité** : 3 si le domaine nous cite déjà (lien reçu ou mention), 2 si une rubrique accepte les propositions, 1 sinon ;
- **effort** : 1 (formulaire public), 2 (rédaction d'une proposition), 3 (contenu à produire).

Une occasion dont le contact est en **opposition** a un score nul et n'apparaît que dans un onglet « écartées ».

### 4.3 Statuts

`idee` → `a_qualifier` → `qualifiee` → `brouillon_pret` → `brouillon_valide` → `contacte_par_will` → `reponse` → `lien_obtenu` | `refus` | `sans_reponse` ; à tout moment `ecartee` ou `en_opposition`.

- Seul un humain fait passer de `brouillon_valide` à `contacte_par_will` (il déclare avoir envoyé lui-même).
- `lien_obtenu` exige un `LienRecu` rattaché, dans l'état `present` (vérifié).
- `sans_reponse` est posé automatiquement 45 jours après `contacte_par_will` ; **aucune relance** n'est proposée avant 30 jours, et une seule au plus.

## 5. Aucun envoi : comment le garantir

- Les modules `src/server/seo-pilotage/liens/**` n'importent **aucun** module d'envoi (`@/lib/email/**`, `src/server/email/**`, `zoho-mail`, `nodemailer`, client HTTP vers un formulaire tiers). **Verrou par test** sur les imports, comme celui que prévoit P13 pour les fichiers gelés.
- Les brouillons sont **affichés** et **copiables** dans la console, rien d'autre : pas de bouton « Envoyer », pas de lien `mailto:` prérempli (il rendrait l'envoi trop facile à confondre avec un envoi du système ; **à confirmer avec Will**, Q4).
- La vérification de liens (S10-4) ne fait que des `GET` de lecture, jamais de `POST`.
- Le texte d'un brouillon passe `messageValide` du chargé de liens (ou une version qui en partage les motifs) : vouvoiement, aucun prix, aucune promesse de résultat, aucune proposition d'échange ou d'achat, nom de la ville du siège interdit, une seule URL (la page proposée).
- L'appel à Claude pour rédiger un brouillon est **facultatif** (un gabarit sobre suffit), passe par la porte de coût (`assertPlafondsClaude`, job porteur de P0) et par le sous-plafond du pilotage.

## 6. RGPD et prospection

Politique du dépôt prise comme référence : ADR 0052 (lettre, deux bases légales, conservation 3 ans après le dernier contact), ADR 0056 (conservation et effacement), module prospection (V1 « constitution de base + export uniquement », aucun envoi à froid depuis Axion IA), `EmailOpposition` et `ProspectionSuppressionEntry`.

- **Minimisation.** `LienRecu` ne contient aucune donnée personnelle par construction (URL publique, domaine, ancre tronquée). Une page source de blog personnel reste une URL publique : elle n'est jamais enrichie (pas de nom, pas d'auteur).
- **Contacts.** Priorité au **canal de l'organisation** (formulaire public, adresse générique du type rédaction ou contact). Une adresse **nominative** (journaliste, responsable de rubrique) n'est enregistrée **que** si elle est publiée par l'organisation pour ce type de demande, avec `contactSourceUrl`. Base : intérêt légitime d'une démarche professionnelle B2B, en rapport avec la fonction de la personne. **À valider par Will** (Q5), avec la mise à jour du registre des traitements (format dans `src/features/conformite-rgpd/schema.ts`) et, si besoin, de la politique de confidentialité, dont le texte est dans `legal.ts` (**gelé** : modification humaine hors chantier).
- **Information de la personne** (article 14 du RGPD, données non collectées auprès d'elle) : chaque brouillon adressé à une adresse nominative porte une phrase d'information et d'opposition. Texte **à valider par Will** ; le test vérifie sa présence.
- **Opposition.** `estOppose` (chargé de liens) est appelé avant d'afficher un brouillon et à chaque changement de statut ; une opposition fait passer l'occasion en `en_opposition` et **efface** `contactEmail` (on garde le domaine). Toute réponse du type « ne plus me contacter » saisie par Will crée une ligne `EmailOpposition` par le chemin existant.
- **Effacement.** Une fonction `eraseOccasionsLiensForEmail` rejoint `src/lib/rgpd-erase.ts` (met `contactEmail` à null, écrit l'opposition).
- **Conservation.** `contactEmail` nominatif : purgé 3 ans après `dernierContactLe` (alignement ADR 0052) ou 1 an après création sans contact. `LienRecu` : purgé 24 mois après `derniereVueLe` s'il n'est plus vu.
- **Pas d'enrichissement** : aucune recherche de nom, d'adresse ou de profil (ni LinkedIn, ni annuaire privé, ni moteur de recherche), conformément aux interdits du module prospection.

## 7. Découpage en PR

> Règles communes : celles de `DECOUPAGE.md`. Tout est **éteint par défaut** : `CONTENT_PILOTAGE_SEO="true"` exact pour les tâches du worker, et un réglage `pilotage_seo.liens` (`ContentGenConfig`, défaut `false`). Aucune nouvelle file BullMQ : les tâches rejoignent la file `seo-pilotage` (P4), dont le worker **ignore** une tâche inconnue (donc un ancien worker ignore les tâches S10 pendant la fenêtre app/worker).

```
Vague 0 (parallèle)  S10-1 module pur  ·  S10-2 migration additive
Vague 1              S10-3 import CSV + écran « Liens reçus » (lecture)  ·  S10-5 référents Plausible
Vague 2              S10-4 vérification « suivi / non suivi » (après P4)  ·  S10-6 referringUrls (après P5)
Vague 3              S10-7 occasions + brouillons (après S10-3, P0)
Facultatif           S10-8 Bing (clé de Will)  ·  S10-9 chargé de liens → tables (après PR 12 éditoriale)
```

### S10-1 · Module pur `src/server/seo-pilotage/liens/`

- **Fichiers** : `normaliser.ts` (domaine, page source, cible via `normaliserChemin`), `csv-gsc.ts` (reconnaissance du type d'export par ses en-têtes, FR et EN, lecture via `parseCsvRows`), `rel.ts` (lecture des jetons `rel`), `score.ts` (§ 4.2), `statuts.ts` (transitions autorisées du § 4.3), `brouillon.ts` (contrôle du texte : motifs du chargé de liens, mention d'information).
- **Tests** : en-têtes réels d'un export (**fixture fournie par Will**, anonymisée si besoin) ; fichier inconnu refusé ; `www.` et casse ; `rel="nofollow ugc"` ; transitions interdites (ex. `brouillon_pret` → `lien_obtenu`) ; score nul en opposition ; brouillon refusé s'il contient un prix, « échange », « backlink », le nom de la ville du siège ou une seconde URL.
- Parallélisable, aucune base.

### S10-2 · Migration additive « liens reçus »

- **Fichiers** : `prisma/schema.prisma`, `prisma/migrations/<date>_pilotage_liens_recus/`.
- **Tables** : `LienRecu`, `LienRecuImport`, `LienDomaineReleve`, `OccasionLien`, `BrouillonContact` (§ 3).
- **Tests** : schéma (`@@unique`, index) ; le texte SQL ne contient ni `DROP` ni `ALTER … DROP` ; le Proxy du stub Prisma couvre les méthodes utilisées par l'écran (`findMany`, `count`, `groupBy`).
- **Après atterrissage** : `prisma migrate status` en production (l'entrypoint migre en best-effort, AGENTS.md).

### S10-3 · Import CSV manuel et écran « Liens reçus » (lecture)

- **Fichiers** : onglet « Liens reçus » de l'écran `content-gen/pilotage` (P8) **ou**, si P8 n'est pas fusionnée, page `content-gen/liens-recus` déclarée dans `src/lib/admin-nav.ts` (vérifiée par `scripts/check-admin-nav-routes.ts`) ; Server Action d'import (`src/server/actions/content-gen/liens-recus.ts`), page en `force-dynamic`, rôles `super_admin` et `admin` (comme `roleAutoriseChargeLiens`).
- **Contenu** : dépôt d'un fichier CSV (taille maximale à fixer, ex. 5 Mo), aperçu des 20 premières lignes, puis import idempotent (empreinte). Un lien **absent** d'un export suivant n'est pas supprimé : il garde sa `derniereVueLe` (les exports sont des échantillons). Tableaux : domaines qui nous citent (nombre de pages, première et dernière vue, part vérifiée « suivi »), liens récents, pages d'Axion IA les plus citées, ancres. Le mode d'emploi pas à pas de l'export est écrit dans l'écran.
- **Tests** : réimport du même fichier : zéro création ; fichier d'un autre type : refus clair ; table absente (P2021) : « indisponible » ; accès refusé à l'éditeur ; aucune cellule au-delà de 2 000 caractères stockée.
- **Bundle** : console admin seulement. Le cliquet admin a été relevé depuis `DECOUPAGE.md` (ADR 0077) : lire la sortie de l'étape « Poids du bundle », pas un chiffre recopié.

### S10-4 · Vérification polie « suivi / non suivi »

- **Fichiers** : `src/server/seo-pilotage/liens/verifier.ts`, tâche `verif-liens` du worker `seo-pilotage` (hebdomadaire).
- **Contenu** : pour chaque `LienRecu` avec `pageSource` connue, `etat` à vérifier ou vérifié il y a plus de 30 jours : `checkUrlAllowed` (robots.txt, délai d'exploration), un seul `GET` (délai 8 s, 2 Mo maximum, comme `url-extractor.ts`), recherche des `<a href>` vers `axion-ia.com`, lecture de `rel` et de l'ancre. Au plus 200 pages par passage, au plus une requête par domaine toutes les 10 secondes. Rien d'autre n'est stocké que `etat`, `rel`, `ancre`, `cheminCible`, `derniereVerifLe`.
- **Agent utilisateur** : nom générique identifiant le robot et une page d'explication. Le motif existant (`+https://axion-ia.com/bot`, `url-extractor.ts` l. 36) pointe vers une page **introuvable** : aucune route `bot` sous `src/app`, aucune redirection trouvée dans `next.config.*` ni `src/proxy.ts`. S10-4 crée la page explicative (composant serveur, `noindex`) ou en choisit une existante.
- **Tests** : robots.txt interdit : `bloque_robots`, aucun `GET` ; `nofollow`, `sponsored`, `ugc`, rien ; lien absent : `absent` ; page trop lourde ou délai dépassé : `erreur` ; aucun appel réseau en test ; interrupteur éteint : aucun appel.
- **Limite affichée** : « Un lien ajouté par JavaScript n'est pas vu. »

### S10-5 · Référents Plausible

- **Fichiers** : `src/server/analytics/referents-sites.ts` (nouveau, `server-only`, même gestion d'erreurs et même état « indisponible » que `visites-ia.ts`, sans le modifier), tâche quotidienne qui écrit `LienDomaineReleve` (`source = plausible`) et crée un `LienRecu` « domaine seul » (`origines = [plausible]`, `etat = non_verifiable` tant que la page source est inconnue).
- **Exclusions** : moteurs de recherche, assistants IA (déjà mesurés), domaines d'Axion IA, messageries et réseaux sociaux (liste testée), domaines vus moins de 3 visites sur 30 jours (bruit).
- **Tests** : clé absente ou stub : aucun appel ; liste d'exclusion ; aucun IP ni agent utilisateur ; `tracking-referer.ts` inchangé (verrou existant).

### S10-6 · `referringUrls` de l'inspection d'URL

- **Dépend** de P5 (rotation d'inspection sous quota partagé) : **aucune inspection en plus**, on lit le champ des inspections déjà faites.
- **Contenu** : les URL hors `axion-ia.com` et hors sitemaps deviennent des `LienRecu` (`origines = [inspection]`, `etat = a_verifier`).
- **Tests** : URL internes et sitemaps ignorées ; champ absent : rien ; une semaine de relevés réels examinée **avant** d'activer l'écriture (le contenu de ce champ est à vérifier).

### S10-7 · Occasions et brouillons

- **Dépend** de S10-3 et, pour les brouillons rédigés par Claude, de P0 (job porteur). Le gabarit sans modèle est livré d'abord.
- **Fichiers** : `src/server/seo-pilotage/liens/occasions.ts`, onglet « Occasions » de l'écran, bouton « Suivre ce domaine » sur l'écran `content-gen/charge-liens`, `eraseOccasionsLiensForEmail` dans `src/lib/rgpd-erase.ts`.
- **Contenu** : saisie et qualification, score, file triée, brouillons copiables, changements de statut **humains** ; idées amorcées depuis les retombées presse publiées, les institutions des fiches locales et les domaines de S10-5 (statut `idee`, jamais au-delà sans humain). Au plus **10 occasions** en `brouillon_pret` à la fois, comme la file du PLAN § 5.5.
- **Tests** : aucun import d'un module d'envoi (verrou) ; brouillon refusé par les motifs ; opposition : contact effacé, score nul ; `lien_obtenu` impossible sans `LienRecu` présent ; relance impossible avant 30 jours ; effacement RGPD.

### S10-8 (facultatif) · Bing Webmaster Tools, liens entrants

- **Condition** : clé fournie par Will (PLAN § 10, question 3) ; noms et quotas des lectures de liens **vérifiés dans la documentation Microsoft**.
- **Contenu** : brancher `bing-wmt-client.ts` (aujourd'hui code mort) avec une lecture des liens entrants, `origines = [bing]`. La clé n'apparaît jamais dans un journal (elle est dans l'URL).

### S10-9 (plus tard) · Le chargé de liens écrit dans `OccasionLien`

- Après la fusion de la PR 12 de l'équipe éditoriale. Écriture **en plus** du JSON pendant une version (fenêtre app/worker), puis lecture depuis la table. Supprime le risque d'écrasement documenté dans `charge-de-liens-donnees.ts`.

## 8. Risques

| Risque                                                                                         | Parade                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lire un échantillon comme un total (« nous avons 12 liens »)                                   | Libellés « échantillon », dates de dernière vue, jamais de total présenté comme exhaustif                                |
| Un envoi part « par erreur »                                                                   | Aucun module d'envoi importé (verrou) ; aucun bouton d'envoi ; statut `contacte_par_will` seulement déclaratif           |
| Données personnelles de journalistes sans base solide                                          | Canal de l'organisation d'abord ; nominatif seulement si publié pour cela ; opposition, effacement, purge ; validation de Will |
| Robot de vérification perçu comme abusif                                                       | robots.txt, délai par domaine, 200 pages par semaine, `GET` seul, agent identifié                                       |
| Faux « absent » (lien injecté en JavaScript, page derrière un mur)                             | État `absent` jamais supprimé ; deux vérifications « absent » consécutives avant affichage en rouge                     |
| Pratiques de liens contraires aux consignes de Google                                          | Interdits du chargé de liens repris ; aucun échange, achat, sponsor, commentaire ; aucune ancre optimisée imposée        |
| Doublon avec le chargé de liens                                                                | Une occasion par **domaine** ; bouton de passage ; S10-9 pour unifier                                                    |
| Cliquet du bundle admin                                                                        | Composants serveur ; mesurer à la PR                                                                                      |
| Export CSV dont les colonnes changent                                                          | Reconnaissance par en-têtes, refus explicite, fixture mise à jour                                                        |

## 9. Questions ouvertes pour Will

1. Acceptez-vous d'**exporter à la main** le rapport « Liens » de la Search Console (par exemple une fois par mois) ? Quels exports : liens externes récents, principaux sites, ancres ? Un fichier d'exemple permettrait de figer les en-têtes.
2. Le robot de vérification (S10-4) peut-il visiter les pages qui nous citent (une fois par mois au plus par page, robots.txt respecté) ?
3. Contacts nominatifs : les autoriser (publiés par l'organisation pour ce type de demande), ou se limiter aux formulaires et adresses génériques ? Et le texte d'information et d'opposition des brouillons.
4. Brouillons : texte à copier seulement, ou aussi un lien `mailto:` prérempli que vous ouvrez vous-même ?
5. Rédaction des brouillons par Claude (coût dans le sous-plafond du pilotage), ou gabarit sobre seulement ?
6. Clé Bing Webmaster (déjà demandée par le PLAN) ?
7. Les annuaires professionnels gratuits acceptables : liste blanche à établir par vous (aucune inscription qui mentionne une certification ou un financement).

## 10. Exactitude

| Affirmation                                                                                         | Où                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fonctions exportées du client GSC, API appelées (`webmasters/v3`, `urlInspection/index:inspect`)    | `src/server/content-gen/seo/gsc-client.ts` l. 30, 114, 211, 293, 339-384, 504, 652, 680, 706                      |
| `referringUrls` déclaré, lu par aucun code                                                          | `gsc-client.ts` l. 326 ; grep `referringUrls` hors de ce fichier : aucun résultat                                 |
| Propriété de domaine dans l'exemple d'environnement                                                 | `.env.example` l. 473                                                                                             |
| Client Bing : 3 lectures, importé nulle part, clé dans l'URL                                         | `src/server/content-gen/seo/bing-wmt-client.ts` l. 58-157 ; grep `bing-wmt-client`                                |
| Plausible v2, `visit:source` et `visit:referrer`, variables d'environnement, état « indisponible »   | `src/server/analytics/visites-ia.ts` l. 1-25, 236-257                                                             |
| `Submission.referer` sans écrivain trouvé                                                            | `prisma/schema.prisma` l. 538 ; grep dans `src/server`, `src/app/api`                                             |
| Chargé de liens : types, états, plafonds, aucun envoi, `messageValide`, motifs interdits, rôles       | `src/server/content-gen/equipe/charge-de-liens.ts` l. 1-60, 106-125, 159-252                                      |
| Persistance JSON, risque d'écrasement, sources des candidats, aucun `contactEmail`, `estOppose` (3 contrôles) | `src/server/content-gen/equipe/charge-de-liens-donnees.ts` l. 1-90                                                |
| Tâche `liens-hebdo`, 20 articles par passage                                                         | `src/server/queue/workers/content-refresh-worker.ts` l. 62, 179-209                                               |
| `MediaCoverage`, lecture publique                                                                    | `prisma/schema.prisma` ~l. 11982 ; `src/server/press/media-coverage-queries.ts`                                    |
| `EmailOpposition` (empreinte), `ProspectionSuppressionEntry`                                         | `prisma/schema.prisma` l. 14034, 12654 ; `src/lib/security/email-hash.ts` l. 63                                   |
| `checkUrlAllowed`, agent utilisateur existant, 8 s, 2 Mo                                             | `src/server/content-gen/kb-ingest/robots-respect.ts` l. 257 ; `url-extractor.ts` l. 7, 35-37                      |
| `parseCsvRows`                                                                                       | `src/server/qualiopi/presence/_csv-utils.ts` l. 24                                                                |
| Effaceurs RGPD                                                                                       | `src/lib/rgpd-erase.ts` l. 95, 193                                                                                |
| Format du registre des traitements                                                                   | `src/features/conformite-rgpd/schema.ts` l. 1                                                                     |
| Politique de confidentialité dans `legal.ts`                                                         | `src/content/legal.ts` l. 552 ; `src/app/[locale]/politique-confidentialite/page.tsx`                              |
| Navigation admin vérifiée par script                                                                 | `src/lib/admin-nav.ts` ; `scripts/check-admin-nav-routes.ts`                                                      |
| Cliquet admin relevé                                                                                 | `docs/adr/0077-cliquet-console-admin-releve-a-602-kb.md`                                                          |
| Aucun suivi de liens reçus dans le code                                                              | grep `backlink|liens entrants|referring|netlinking|inbound link|ahrefs|majestic|semrush` sur `src`, `scripts`, `prisma` |

**À vérifier** : absence d'un point d'API « liens » dans la Search Console (documentation Google au moment de coder) ; contenu réel de `referringUrls` ; en-têtes exacts des exports CSV du rapport « Liens » (FR et EN) ; lectures de liens de l'API Bing ; champ de référent de l'API GraphQL de Cloudflare ; la page `/bot` citée par l'agent utilisateur (aucune route trouvée : probable lien mort, à confirmer en production) ; base légale et texte d'information des contacts nominatifs (Will).
