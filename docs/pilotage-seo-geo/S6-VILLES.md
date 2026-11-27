# S6 · Carte des grandes villes, honnête : conception

> Phase de conception, 27/11/2026, branche `docs/seo-s6-s10-conception`. Fiche rattachée au chantier « Pilotage SEO et GEO » (`AUDIT.md`, `PLAN.md`, `DECOUPAGE.md`). Inventaire fait en **lisant le code** de la branche (copie superficielle de `main` au commit `0f98ce51`). **Aucun code n'est écrit dans cette phase.**
>
> **Objectif.** Être trouvé sur « formation IA entreprise + ville » dans **50 grandes villes**, **sans fausse présence locale**.
>
> Règles dures de la fiche, en plus des règles communes de `DECOUPAGE.md` :
>
> - aucune adresse, aucune équipe, aucun bureau inventés dans une ville ;
> - discours « partout en France », intervention **dans les locaux du client** ;
> - le nom de la ville du siège n'est **jamais** écrit dans la communication (ce document le désigne par « la ville du siège ») ;
> - **aucun frais de déplacement** sur les pages (ni montant, ni « inclus », ni « en sus ») ;
> - `journee-ia-commun.ts`, `legal.ts`, `pricing.ts`, `positionnement.ts` : lecture seule ;
> - aucun composant client ajouté sur une page publique ; contrat `stub.invalid` respecté ; aucune URL ne change.

## 0. En une phrase

Le socle est **déjà honnête et largement verrouillé** : une seule page indexée par ville (`/implantations/<région>/<ville>`), **40 villes indexées** (toutes les communes de 100 000 habitants ou plus), pas de `LocalBusiness`, la phrase « nous n'avons pas de bureau dans la ville » sur chaque page, et un test qui refuse frais de déplacement et fausse présence sur les **2 157 fichiers `copy`**, les 10 fiches locales et `journee-ia-locale.ts`. Mais :

- **30 des 40 pages indexées sont un gabarit** (nom, population, département, secteurs) : seules **10** ont une fiche locale sourcée. C'est le vrai risque « pages-doublons » ;
- passer à 50 villes oblige à **descendre sous 100 000 habitants**, ce que la règle écrite du 18/11/2026 interdit sans preuve d'intervention ;
- quelques textes hors du périmètre du test contredisent les règles (§ 2).

## 1. Inventaire vérifié

### 1.1 Routes

| Route                                                                                 | Fichier                                                                                                      | Indexation                                                                                                     | Remarque                                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/fr/implantations` (hub France)                                                      | `src/app/[locale]/implantations/page.tsx` (301 l.)                                                           | indexé                                                                                                         | « La Journée IA partout en France, dans vos locaux » ; 24 villes citées (`NB_VILLES_PRINCIPALES = 24`), filtrées par `estCitableDansLeMaillage`                                      |
| `/fr/implantations/<région>`                                                          | `src/app/[locale]/implantations/[region]/page.tsx` (376 l.)                                                  | indexé si `region.noindex === false` : **18 régions sur 18** (`src/content/regions.ts`, 13 métropole + 5 DROM) | 12 villes « principales » (`NB_VILLES_PRINCIPALES = 12`), filtre `!!v.copy` seulement. Importe `StickyMobileCta` (composant client, existant)                                        |
| `/fr/implantations/<région>/<ville>`                                                  | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (528 l.)                                          | `index` seulement si `ville.copy` **et** `isVilleIndexable(slug)` ; sinon `noindex, follow`                    | ISR `revalidate = 86400`, `dynamicParams = true`. Pré-rendu au build : population ≥ 100 000 (`villesPrerenduesAuBuild`, `src/content/villes/prerendu.ts`). Sans `copy` : `VilleStub` |
| `/fr/{audit,formations,implementation,un-a-un,sites-web-augmentes}/par-ville/<ville>` | 5 `page.tsx` de 25 à 32 lignes, logique dans `src/components/sections/VilleServicePageTemplate.tsx` (865 l.) | **toujours** `noindex, follow` (décision du 18/11/2026, l. 252-267)                                            | 5 × 2 157 ≈ 10 785 URL en ligne. `sites-web-augmentes` redirige (308) une commune sans contenu vers la ville-hub la plus proche (l. 335-337)                                         |
| `/fr/avis/ville/<ville>`                                                              | `src/app/[locale]/avis/ville/[ville]/page.tsx`                                                               | `notFound()` si avis non publiés ou moins de `FACET_MIN_COUNT` avis                                            | Hors périmètre                                                                                                                                                                       |
| `/fr/politique-deplacement`                                                           | `src/app/[locale]/politique-deplacement/page.tsx`, texte dans `src/content/legal.ts` (l. 1026-1079)          | indexé                                                                                                         | Voir § 2.4. **Gelé** (`legal.ts`)                                                                                                                                                    |

### 1.2 Données

| Source                                      | Contenu vérifié                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/villes/data/*.ts` (13 régions) | **2 157 communes** de 5 000 habitants ou plus (INSEE, fichiers générés par `scripts/import-insee-villes.ts`). Assemblées dans `VILLES_CORE` (`src/content/villes/core.ts`)                                                                                                                                                                                            |
| `src/content/villes/copy/*.ts`              | **2 157 contenus** rédigés ou générés (liste générée `src/generated/villes-slugs-with-copy.ts`, 2 157 entrées) ; ~29 Mo, 2 118 imports statiques (`core.ts`, en-tête). Toutes les communes ont donc un `copy`                                                                                                                                                         |
| `src/content/villes/villes-indexees.ts`     | **SOURCE UNIQUE** de l'indexation : **40 slugs** (décision du 18/11/2026). Règle écrite : communes de 100 000 habitants ou plus ; « une ville plus petite n'entre qu'avec une preuve écrite d'intervention et l'accord de la direction ». Pas d'Ajaccio                                                                                                               |
| `src/generated/indexable-villes.ts`         | Copie générée des 40 slugs pour l'en-tête Edge `X-Robots-Tag` (`src/lib/seo-noindex-routes.ts`), régénérée par `scripts/gen-indexable-villes.ts`                                                                                                                                                                                                                      |
| `src/content/villes/fiches-locales/*.ts`    | **10 fiches locales sourcées** (lot 1) : Marseille, Lyon, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes. Type `FicheLocale` : population et intercommunalité (geo.api.gouv.fr), établissements et salariés par secteur (open.urssaf.fr), institutions publiques à catégories fermées, prose (tissu, écosystème, zone), 3 questions locales |
| `src/content/villes/journee-ia-locale.ts`   | Tous les textes des pages implantations : `titreVille`, `descriptionVille`, `h1Ville`, `enBrefVille`, `faqVille`, `faqRegion`… Date de refonte `DATE_MAJ_IMPLANTATIONS = "2026-11-11"`                                                                                                                                                                                |
| `src/content/villes/resolve-with-copy.ts`   | `copy` statique d'abord, puis table `GeneratedVilleCopy` (`status=approved`), sinon stub `noindex`                                                                                                                                                                                                                                                                    |
| `src/content/villes/economic-data/`         | Secteurs INSEE vérifiés (`economicData.topSectorsNaf`), préférés aux secteurs du `copy` par `secteursDeLaVille` (page ville, l. 108-111)                                                                                                                                                                                                                              |

Répartition des 40 villes indexées par région (calcul sur `data/*.ts`) : Auvergne-Rhône-Alpes 6, Île-de-France 5, Grand Est 5, Provence-Alpes-Côte d'Azur 4, Occitanie 4, Pays de la Loire 3, Normandie 3, Nouvelle-Aquitaine 2, Hauts-de-France 2, Bretagne 2, Bourgogne-Franche-Comté 2, Centre-Val de Loire 2. Seuils : **40** communes ≥ 100 000 hab., **123** ≥ 50 000, **455** ≥ 20 000.

### 1.3 Ce qu'affiche une page ville indexée

Ordre de rendu (`[ville]/page.tsx`) : JSON-LD en ligne (`buildJourneeIaVilleJsonLd` : `Service` Journée IA avec `areaServed` = la ville, `BreadcrumbList`, `WebPage` ; **aucun `LocalBusiness`, aucune adresse**, `src/lib/seo/ville-service-jsonld.ts` l. 162-166 et 318), héros, « En bref » (`enBrefVille`), **fiche locale si elle existe** (`VilleFicheLocale`), déroulé en trois temps (texte commun), FAQ (`faqVille` + 3 questions de la fiche), communes proches (`VilleCommunesProches`), encart vidéo, jusqu'à 3 articles liés (`getBlogArticlesByVille`, rendu seulement s'il y en a), appel final.

**Sans fiche locale, la seule matière propre à la ville** est : nom, population, département, région, liste de secteurs, photo (58 villes ont une photo, d'après le commentaire l. 192) et articles liés. Tout le reste est identique d'une ville à l'autre, au nom près.

### 1.4 Composants

| Composant                                                                                                                | Utilisé par                                                                                    | Remarque                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ville/VilleFicheLocale.tsx`                                                                              | page ville                                                                                     | Section « Zone desservie et accès » avec lien « Notre politique de déplacement » (l. 199-206)                                                                                                        |
| `src/components/ville/VilleFaqGeolocalisee.tsx`, `VilleCommunesProches.tsx`                                              | page ville                                                                                     | `VilleCommunesProches` appelle `getNearbyVilles(…, { indexableOnly: true })` (12 villes)                                                                                                             |
| `src/components/ville/{VilleTissuEconomique,VilleEcosystemeLocal,AiToolsStack,CaseStudyMarquee,OrangeContactBanner}.tsx` | **aucun import** hors tests (grep)                                                             | Code mort                                                                                                                                                                                            |
| `src/components/sections/VilleServicePageTemplate.tsx`                                                                   | 5 routes `par-ville`                                                                           | Pages noindex. Le commentaire l. 404-408 annonce encore « LocalBusiness/ProfessionalService » alors que le constructeur l'a retiré le 11/11 (commentaire périmé)                                     |
| `src/components/sections/LocalCoverageSection.tsx`                                                                       | pages offres (`/audit`, `/formations`, `/implementation`, `/un-a-un`, `/sites-web-augmentes`…) | « Nous intervenons partout en France métropolitaine »                                                                                                                                                |
| `src/components/sections/LocalGeoFaqSection.tsx`                                                                         | **`/sites-web-augmentes` seulement** (`service="sites-web-augmentes"`, page l. 273-278)        | Contient des phrases contraires aux règles : voir § 2.3. Les variantes `audit`, `interventions`, `implementation`, `un-a-un` sont dans le code mais **aucune page ne les rend** (grep des appelants) |

### 1.5 Sitemaps et indexabilité

- `src/app/sitemap.ts` : `getVillesSitemapIds()` (l. 361) et `buildVillesByRegionSitemap()` (~l. 1570) n'émettent que les villes `!!v.copy && isVilleIndexable(slug)` ; un sous-sitemap `villes-<région>` par région ayant au moins une ville gardée ; aucun id `services-villes-*`. Garde : `src/app/__tests__/sitemap-villes.spec.ts`. Les commentaires « 12 régions, Corse noindex » (l. 87, 1527) sont **périmés** : `getIndexableRegions()` rend 18 régions.
- Sitemaps d'images : `src/app/sitemap-images-villes-{t1,t2,t3-t4}.xml/route.ts` via `src/server/image-bank/utils/villes-sitemap.ts`.
- `src/server/site-explorer/indexability.ts` (170 l.) : implantations → `isVilleIndexable` (l. 96-106) ; `par-ville` / `by-city` → toujours non indexable (l. 111-116).
- `src/lib/seo-noindex-routes.ts` : en-tête Edge, lit `INDEXABLE_VILLE_SLUGS_CAP`.
- Tests : `src/content/villes/__tests__/villes-indexees.spec.ts` (40 villes exactement, toutes ≥ 100 000, toutes les ≥ 100 000 présentes, 59 pages locales, ville du siège hors maillage).

### 1.6 Générateurs de contenu et console

- `src/server/content-gen/generators/ville-hub-copy.ts` (888 l.) et `landing-ville-economic-data.ts` (510 l.) : **actifs**, alimentent `GeneratedVilleCopy` et les données économiques.
- `landing-ville-{cas-usage,ecosystem,faq-extended,secteurs}.ts` : **gelés par défaut** (`src/server/content-gen/villes/generateurs-annexes-geles.ts`, réactivation par `VILLES_GENERATEURS_ANNEXES_ACTIFS=true`) : aucune page ne lit leurs tables, et le prompt « cas d'usage » demandait des gains chiffrés plausibles.
- `generators/anti-duplicate-check.ts` : Jaccard sur trigrammes, `DUPLICATE_THRESHOLD = 0.4`, `checkHubVsVerticalesDuplicate` (hub ↔ pages `par-ville`). Ne compare **pas** deux villes entre elles.
- `src/content/villes/__tests__/fiches-locales.spec.ts` : **le vrai garde anti-doublon** entre villes : moins de **30 %** de suites de 6 mots communes entre deux fiches (noms et nombres masqués), prose de 45 à 140 mots par bloc, 3 questions locales de 40 à 80 mots, aucun chiffre orphelin, sources sur liste blanche de domaines, consultation au 01/11/2026 ou après, catégories d'institutions fermées, mots interdits (dont le nom de la ville du siège, Qualiopi, OPCO, financement…). Il fige aussi « dix villes ».
- Console : `content-gen/{geo,cities-coverage,city-coverage,city-equity,cities-order,coverage-map}` (couverture **géographique** de la production d'articles, cf. AUDIT : « geo » ≠ GEO). Veille « Déséquilibre villes » dans `content-monitoring-worker.ts` (~l. 537-596). Phasage articles par ville : `src/server/content-gen/villes/phase-decision.ts`.
- Pilotage (déjà sur `main`) : `src/server/seo-pilotage/donnees/types-page.ts` range `implantations` et `par-ville` en type `ville` ; `opportunites/intention.ts` détecte l'intention `locale` via `VILLES_PAR_DEFAUT` (20 noms, injectable) ; `opportunites/garde-fous.ts` protège `/politique-deplacement` et `/implantations` (exact). Les tables d'historique (P2) **ne sont pas encore** dans `prisma/schema.prisma`.

### 1.7 Garde-fous existants (à réutiliser, jamais à affaiblir)

`src/content/villes/__tests__/villes-sans-frais-ni-fausse-presence.spec.ts` lit `copy/*.ts`, `fiches-locales/*.ts` et `journee-ia-locale.ts` (commentaires ignorés) et refuse : 12 motifs de frais (« déplacement inclus », « frais de déplacement », « en sus », « au même tarif »…), ~25 motifs de fausse présence (« nos consultants viennent de », « basé à », « depuis notre base », trajets en TGV/RER…), les trajets dans les réponses de FAQ, leurs miroirs anglais, et le nom de la ville du siège hors de sa propre page. ⚠️ Il **ne lit pas** : `implantations/page.tsx`, `[region]/page.tsx`, `LocalGeoFaqSection.tsx`, `VilleServicePageTemplate.tsx`, `regions.ts`. Le test `src/content/__tests__/allegations-non-prouvees.spec.ts` couvre `LocalGeoFaqSection.tsx` pour le nom de la ville du siège seulement.

## 2. Contradictions relevées dans l'existant

| #   | Où                                                                                        | Constat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Gravité                                                         |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2.1 | `villes-indexees.ts` + `copy/` de la ville du siège + page région Auvergne-Rhône-Alpes    | La page de la ville du siège **existe, est indexée** (dans les 40) et porte son nom (h1, title). La décision du 18/11 la garde « visible » mais hors maillage national ; la page région Auvergne-Rhône-Alpes peut la citer (filtre `!!v.copy` seul). Contraire à la règle de la fiche « jamais écrit dans la communication ».                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **Décision de Will** (Q1)                                       |
| 2.2 | Même page                                                                                 | `enBrefVille` et `faqVille` (`journee-ia-locale.ts` l. 246-292) écrivent pour **toutes** les villes « Nous n'avons pas de bureau à … ». Sur la page de la ville du siège, où se trouve le siège social (`legal.ts`), la phrase est **probablement inexacte** (domiciliation ou bureau : **à vérifier**).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Exactitude, Q1                                                  |
| 2.3 | `src/components/sections/LocalGeoFaqSection.tsx` (pages offres)                           | « font partie de nos premiers pôles d'intervention », « Paris est notre premier terrain d'intervention », « concentre une part importante de nos missions » (allégations non prouvées) ; « couvertes **aux mêmes conditions que Paris** » (promesse tarifaire géographique, motif interdit sur les villes) ; « Nos consultants sont mobiles : Lyon, Marseille… » (équipe suggérée) ; « Douze régions métropolitaines » (13 métropolitaines et 18 au total dans `regions.ts`) ; « plus de 5 000 habitants » (la politique de déplacement couvre aussi BE/LU/CH). Miroir anglais « no geographic surcharge » (non servi tant que l'anglais est coupé, mais dans le code). ⚠️ Ces phrases (l. 41, 52, 63, 87, 98, 133, 225) sont dans les variantes **non rendues** (§ 1.4) : code dormant aujourd'hui. La variante **servie** (`sites-web-augmentes`, l. 174 et suivantes) porte « au cœur de notre activité de développement », « La majorité de nos projets… » (allégations non prouvées) et, en anglais, « No geographic surcharge » (l. 194). | **À corriger** (S6-2)                                           |
| 2.4 | `/politique-deplacement` (texte dans `legal.ts`, **gelé**) liée depuis `VilleFicheLocale` | La page ne cite aucun montant (conforme), mais parle encore de « Module 1 / Module 2 » (offre ancienne) et le lien « Notre politique de déplacement » sur les pages villes attire l'attention sur le déplacement. Les CGV (`legal.ts`, art. 47.5) disent que le déplacement est compris **dans une seule région** et facturé ailleurs selon le devis : la région du siège est donc lisible depuis les CGV.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Décision de Will (Q4). Le chantier **ne touche pas** `legal.ts` |
| 2.5 | `VilleCommunesProches.tsx` + `src/lib/geo.ts` l. 45-49                                    | `indexableOnly` filtre sur `hasVilleCopy` : vrai pour **les 2 157** communes. Les pages indexées lient donc des pages `noindex` (ex. une ville indexée vers ses voisines non indexées). Le commentaire de la page (« liens vers des pages indexables seulement ») est faux depuis le 18/11.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Faible (pas de fausse présence), à corriger (S6-1)              |
| 2.6 | `[region]/page.tsx` l. 94                                                                 | Les 12 « villes principales » d'une région sont prises parmi les villes avec `copy` (toutes), pas parmi les indexées : en Île-de-France, la liste mêle 5 villes indexées et 7 pages `noindex`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Faible, S6-1                                                    |
| 2.7 | 30 pages indexées sans fiche locale (dont **Paris**)                                      | Contenu propre à la ville limité au nom, à la population et à la liste de secteurs : risque de pages jugées « doorway » / quasi-doublons.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Principal risque SEO**, S6-3 à S6-6                           |
| 2.8 | `copy/*.ts` (servis seulement par les pages `par-ville` noindex)                          | En-têtes de 28 fichiers : « les frais sont en sus… forfait trajet en sus » (commentaires seulement : aucun texte servi, vérifié par le test). Des affirmations chiffrées **non sourcées** dans les textes (ex. `lyon.ts` : « 27 316 établissements actifs »). Pages `noindex`, donc sans effet SEO, mais **à ne jamais recopier** dans une fiche.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Information                                                     |
| 2.9 | Commentaires périmés                                                                      | `sitemap.ts` (« 12 régions, Corse noindex »), `VilleServicePageTemplate.tsx` (LocalBusiness), `resolve-with-copy.ts` (« ~40 villes pilotes » alors que 2 157 `copy`), `fiches-locales/types.ts` cite un « PLAN-VILLES §3.1 » **introuvable dans le dépôt** (copie superficielle : à vérifier sur `main` complet).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Nettoyage                                                       |

Aucune page ville servie n'affiche d'adresse, d'équipe locale ni de montant de déplacement : le test du § 1.7 le garantit sur son périmètre.

## 3. Proposition : garder, fusionner, enrichir

### 3.1 Garder (ne pas toucher)

- **Une seule page indexée par ville** (`/implantations/<région>/<ville>`), les pages `par-ville` en `noindex, follow`, **en ligne** (aucune URL ne change, aucune suppression).
- `villes-indexees.ts` comme **source unique**, et sa chaîne de dérivation (meta robots, en-tête Edge, sitemaps, site-explorer).
- Le JSON-LD sans `LocalBusiness`, les phrases « partout en France » et « nous venons dans votre entreprise ».
- Le test « ni frais ni fausse présence » et le garde anti-doublon des fiches (< 30 % de 6-grammes communs) : on les **étend**, jamais on ne les assouplit.
- Le seuil de pré-rendu `SEUIL_PRERENDU_HUB_VILLE = 100 000` : les nouvelles villes (< 100 000) passent en **ISR au premier passage**, sans alourdir le build (AGENTS.md, durée de build et disque).
- Le gel des 4 générateurs annexes.

### 3.2 Fusionner (consolider les signaux, sans changer d'URL)

- **Pas de fusion d'URL.** Les ~10 785 pages `par-ville` restent `noindex, follow`, auto-canoniques. Rediriger ou recanoniser est une décision séparée (contraire au principe 5 du PLAN).
- **Un seul gabarit de contenu local** : la fiche locale (`FicheLocale`) devient le **seul** support du contenu propre à une ville indexée. Les textes de `copy/*.ts` ne sont **pas** recopiés (affirmations non sourcées, § 2.8) ; ils peuvent servir de **pistes** à sourcer.
- **Maillage** : les listes « villes principales » (région) et « communes proches » (ville) ne pointent que vers des pages **indexées** (S6-1). La ville du siège reste hors listes nationales (règle existante).

### 3.3 Enrichir (contenu utile, propre à la ville, non dupliqué)

Chaque bloc ne s'affiche que si sa donnée existe ; **rien n'est inventé**, chaque chiffre a une source consultable et une date.

| Bloc                    | Source                                                                                                                                     | Déjà là ?           | Règle                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------- |
| Tissu économique        | open.urssaf.fr (établissements, salariés par secteur), geo.api.gouv.fr (population, EPCI)                                                  | Oui, dans 10 fiches | Chiffres du type `FicheLocale` uniquement, millésime affiché                      |
| Secteurs → pages utiles | Secteurs de la fiche, pages `/secteurs/[secteur]` et `/cas-concrets/secteur` existantes                                                    | Non                 | Lien seulement si la page secteur existe ; table de correspondance testée         |
| Écosystème public       | Institutions publiques (catégories fermées : pôle, technopole, zone, université, école, French Tech, gare, aéroport, CCI)                  | Oui, 10 fiches      | Jamais d'entreprise privée, jamais de partenariat suggéré                         |
| Formats d'intervention  | **Textes communs** (`journee-ia-commun.ts`, lecture seule) : Journée IA dans vos locaux, Diagnostic IA de 45 min en visio ou par téléphone | Oui (déroulé)       | Aucun format inventé ; aucune durée ni prix recopiés en dur                       |
| FAQ locale              | 3 questions par fiche (40 à 80 mots), répondant à des questions réelles (voir la mesure, § 6)                                              | Oui, 10 fiches      | Aucune question de trajet, d'accès, de délai de déplacement (motifs du test)      |
| Liens internes          | Articles liés (`getBlogArticlesByVille`), page région, page Journée IA, communes proches indexées                                          | Oui                 | Ancres variées (`ancresJourneeIa`), aucune ancre « formation IA <ville> » répétée |
| Preuves d'intervention  | **Seulement** si Will fournit une preuve écrite et l'accord du client                                                                      | Non                 | Sinon rien. Jamais d'avis, de témoignage ou de logo inventés                      |

## 4. Les 50 villes : critères de choix

**Constat.** Les 40 villes indexées sont exactement les 40 communes de 100 000 habitants ou plus (dont la ville du siège). Pour 50, il faut **10 villes sous 100 000 habitants**, ce que `villes-indexees.ts` réserve aujourd'hui aux villes avec « une preuve écrite d'intervention et l'accord de la direction ». **La règle doit être changée par Will avant S6-8** (Q2).

Critères proposés, appliqués dans cet ordre :

1. **Bassin distinct** : à au moins **40 km** (vol d'oiseau, `geo` de `data/*.ts`) de toute ville déjà indexée. On écarte ainsi les communes de banlieue (Tourcoing, Roubaix, Nanterre, Vitry-sur-Seine, Asnières-sur-Seine, Créteil… rangs 41 à 46), qui cannibaliseraient Lille ou Paris.
2. **Taille** : population ≥ 50 000 (INSEE, `data/*.ts`).
3. **Équilibre régional** : priorité aux régions sous-représentées (Nouvelle-Aquitaine : 2 villes pour 12 départements ; Hauts-de-France, Bretagne, Centre-Val de Loire : 2 chacune).
4. **Fiche locale complète possible** : sources officielles disponibles (Urssaf, geo.api.gouv.fr, au moins 3 institutions publiques) : sinon la ville attend.
5. **Signal mesuré** (dès que l'historique GSC existe) : impressions sur des requêtes locales, même faibles.
6. **Exclusions** : Ajaccio (« la page Corse suffit », règle existante) ; toute commune du département du siège si Will le décide (Q1, voir aussi la règle « r01 » citée dans `src/app/[locale]/memo-isere/page.tsx` : « jamais de nom de grande ville de la région en communication »).

Application des critères 1 et 2 sur les données (calcul reproductible sur `data/*.ts`) : **28 candidates**, dont Ajaccio (76 320), écartée par le critère 6, soit **27** retenables. Les 10 premières par population, Ajaccio exclue : **Avignon** (92 188, à 41 km de Nîmes), **Poitiers** (89 916), **Dunkerque** (86 263), **Béziers** (81 545), **Pau** (80 441), **La Rochelle** (79 851), **Cherbourg-en-Cotentin** (78 258), **Saint-Nazaire** (74 568, à 51 km de Nantes), **Calais** (67 571), **Colmar** (66 970, à 40 km de Mulhouse). Avec le critère 3, des alternatives : Bourges, Troyes, Niort, Lorient, Vannes, Bayonne, Quimper, Valence (la plus proche ville indexée de Valence est la ville du siège : à arbitrer). **Liste à valider par Will** : elle illustre les critères, elle ne décide rien.

**Question préalable (Q3)** : la ville du siège compte-t-elle dans les 50 ? Si elle sort de l'index, il faut 11 villes nouvelles.

## 5. Seuil de qualité avant indexation (anti pages-doublons)

Une ville n'entre dans `villes-indexees.ts` que si **tous** ces critères passent, vérifiés par un test (pas par un humain qui relit) :

| Critère                                                                                                                         | Vérification                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Fiche locale présente, conforme au type `FicheLocale`                                                                           | `ficheLocale(slug) !== undefined`                 |
| Toutes les règles existantes de `fiches-locales.spec.ts` (sources, dates, catégories, longueurs, chiffres)                      | test existant, étendu à la nouvelle fiche         |
| Moins de **30 %** de 6-grammes communs avec **chaque** autre fiche (noms et nombres masqués)                                    | test existant                                     |
| Au moins **3 secteurs chiffrés**, **3 institutions**, **3 questions locales**                                                   | nouveau test « porte de qualité »                 |
| Part propre à la ville : au moins **250 mots** de texte visible qui n'existent sur aucune autre page ville (prose + FAQ locale) | nouveau test, réutilise le découpage en 6-grammes |
| Zéro faute du test « ni frais ni fausse présence »                                                                              | test existant                                     |
| Nom de la ville du siège absent                                                                                                 | test existant                                     |
| Title ≤ 60, description ≤ 155, uniques                                                                                          | test existant (`journee-ia-locale.spec.ts`)       |

**Transition.** Les 30 villes déjà indexées sans fiche sont listées dans une constante `VILLES_INDEXEES_SANS_FICHE` qui **ne peut que diminuer** (cliquet testé). Aucune n'est désindexée automatiquement : c'est une décision de Will après mesure (Q5).

## 6. Mesure via la Search Console

- **Source** : l'ingestion par lot du pilotage (P1 sur `main` : `gscSearchAnalytics`, `gscDernierJourFinal`, `gscSonde` ; P2 et P4 **pas encore fusionnées**). S6 **n'ajoute aucun appel à l'API** : il lit les tables d'historique quand elles existent. Avant P2, l'écran affiche « indisponible ».
- **Périmètre** : pages de type `ville` (`typePageDepuisChemin`), en ne comptant comme « indexées » que les slugs de `villes-indexees.ts`.
- **Requêtes locales** : `classerIntention` avec la liste des 50 villes injectée (le paramètre `villes` existe), homonymes gérés (Nice, Tours, Orange). La ville du siège est mesurée (c'est une mesure), jamais proposée (garde-fou existant du PLAN § 3.1).
- **Indicateurs par ville, sur 28 jours glissants homogènes** : impressions et clics de la page, position moyenne pondérée, nombre de requêtes locales distinctes, part des impressions venant de requêtes locales (« formation IA <ville> », « audit IA <ville> »…), requête locale qui atterrit sur une **autre** page que celle de la ville (cannibalisation, détecteur d existant).
- **Planchers** : ceux du PLAN § 4.2 (≥ 30 impressions sur 28 jours par requête). Sous plancher : « pas assez de données », jamais une conclusion.
- **Comparaison utile** : villes avec fiche contre villes sans fiche (10 contre 30 aujourd'hui), à population comparable, sur 8 semaines minimum. C'est ce qui permettra de trancher Q5.
- **Indexation** : la rotation d'inspection (P5) inclut les 50 pages villes au moins une fois par semaine pendant 4 semaines après leur entrée (priorité 1 du PLAN § 3.2 : « pages publiées ou modifiées depuis moins de 48 h »).

## 7. Découpage en PR

> Règles communes : celles de `DECOUPAGE.md` (brouillon jusqu'à la fin du lot, fichiers gelés, aucun composant client, `stub.invalid`, fenêtre app/worker). Aucune PR S6 n'ajoute de migration ni de file BullMQ.

```
Vague 0 (parallèle)  S6-1 cohérence du maillage  ·  S6-2 textes des pages offres  ·  S6-3 porte de qualité (test, sans effet)
Vague 1 (séquentielle, contenu)  S6-4 fiches lot 2 (Paris + 9)  ──►  S6-5 lot 3 (10)  ──►  S6-6 lot 4 (10 nouvelles villes, sans indexation)
Vague 2              S6-7 liens secteurs  ·  S6-9 mesure (après P2 + P4 + P8)
Vague 3 (décision de Will)  S6-8 passage à 50 villes
Après 8 semaines     S6-10 décision sur les pages sans fiche
```

### S6-1 · Maillage limité aux pages indexées, commentaires réalignés

- **Fichiers** : `src/lib/geo.ts` (option `indexableOnly` lue sur `isVilleIndexable`, ou nouvelle option `indexeesSeulement` pour ne pas changer les autres appelants : à trancher dans la PR après grep des appelants), `src/components/ville/VilleCommunesProches.tsx`, `src/app/[locale]/implantations/[region]/page.tsx` (principales = indexées d'abord, puis aucune autre), commentaires périmés de `sitemap.ts`, `VilleServicePageTemplate.tsx`, `resolve-with-copy.ts`.
- **Contenu** : aucune URL, aucun meta robots ni sitemap modifié. Le nombre de liens sortants des pages villes **baisse**.
- **Tests** : une page ville indexée ne lie aucune page `noindex` ; la ville du siège n'apparaît dans aucune liste hors région ; la page région Île-de-France ne liste que les 5 villes indexées ; instantané des listes.
- **Risques** : `getNearbyVilles` a d'autres appelants (pages `par-ville`, JSON-LD `ItemList`) : changer `indexableOnly` en place les modifierait aussi. Préférer une option nouvelle.

### S6-2 · Textes des pages offres conformes (allégations, conditions, équipe)

- **Fichiers** : `src/components/sections/LocalGeoFaqSection.tsx` ; extension de `villes-sans-frais-ni-fausse-presence.spec.ts` (ou nouveau test jumeau) à `LocalGeoFaqSection.tsx`, `LocalCoverageSection.tsx`, `implantations/page.tsx`, `[region]/page.tsx`, `VilleServicePageTemplate.tsx`.
- **Contenu** : retirer « premiers pôles / premier terrain d'intervention », « part importante de nos missions », « aux mêmes conditions que Paris », « nos consultants sont mobiles », et dans la variante servie « au cœur de notre activité », « La majorité de nos projets », ainsi que leurs miroirs anglais (« no geographic surcharge », « our consultants are mobile ») ; « Douze régions » réaligné sur les régions servies ; « plus de 5 000 habitants » remplacé par « partout en France ». Aucune phrase nouvelle qui promette un tarif, un délai ou une présence.
- **Tests** : mêmes motifs FRAIS, PRESENCE et ANGLAIS appliqués aux nouveaux fichiers ; motif ajouté « premier(s) (pôle|terrain) d'intervention » ; contrôle que `allegations-non-prouvees.spec.ts` passe toujours.
- **Risques** : pages offres = **15 pages stratégiques** possibles (budget Web Vitals) : changement de texte seulement, aucun JS, aucun effet attendu sur le bundle. Vérifier le CLS (longueur des réponses de FAQ).

### S6-3 · Porte de qualité des villes indexées (test seul, sans effet sur le site)

- **Fichiers** : `src/content/villes/qualite-indexation.ts` (pur, sans import du barrel de 29 Mo : `core.ts` et `fiches-locales` seulement), `src/content/villes/__tests__/qualite-indexation.spec.ts`.
- **Contenu** : `evaluerQualiteVille(slug)` rend la liste des critères du § 5 (passé / échoué / motif) ; constante `VILLES_INDEXEES_SANS_FICHE` (les 30 actuelles) ; le test exige que toute ville de `VILLES_INDEXEES` passe la porte **ou** figure dans cette constante, et que la constante ne grandisse jamais (cliquet par nombre et par contenu).
- **Tests** : une ville fictive sans fiche échoue ; une fiche dupliquée à 31 % échoue ; ajouter une ville à `VILLES_INDEXEES` sans fiche fait échouer le test.
- **Éteint par défaut** : aucun code servi ne l'importe.

### S6-4, S6-5 · Fiches locales, lots 2 et 3 (villes déjà indexées)

- **Fichiers** : `src/content/villes/fiches-locales/<slug>.ts` (10 par lot), `fiches-locales/index.ts`, liste blanche de domaines et compte « dix villes » dans `fiches-locales.spec.ts`, retrait des slugs traités de `VILLES_INDEXEES_SANS_FICHE`.
- **Ordre** : lot 2 commence par **Paris** (première ville, sans fiche), puis les plus peuplées restantes ; lot 3 termine les 30.
- **Contenu** : uniquement des données publiques sourcées (Urssaf, geo.api.gouv.fr, sites d'institutions publiques), consultées à la date de rédaction. Rédaction humaine ou session Claude **sans appel payant automatisé** ; relecture par Will.
- **Tests** : ceux de S6-3 et de `fiches-locales.spec.ts` ; aucune régression du test « ni frais ni fausse présence ».
- **Risques** : la section « Zone desservie et accès » de `VilleFicheLocale` porte le lien vers `/politique-deplacement` (§ 2.4, Q4) ; les institutions de catégorie `gare` et `aeroport` ne doivent jamais servir à décrire un trajet de l'équipe (motifs du test).

### S6-6 · Fiches locales, lot 4 (les 10 villes candidates, **non indexées**)

- Comme S6-4, pour les 10 villes retenues par Will. Les pages restent `noindex` : la fiche s'affiche (la page lit `ficheLocale` quel que soit l'index), ce qui permet une **relecture en ligne** avant indexation.
- ⚠️ À vérifier dans la PR : la fiche s'affiche sur une page `noindex` d'une ville < 100 000 rendue en ISR (`dynamicParams`), sans régression du stub.

### S6-7 · Secteurs reliés aux pages secteurs existantes

- **Fichiers** : `src/content/villes/secteurs-vers-pages.ts` (table code NAF ou libellé → slug de `/secteurs/[secteur]`, testée contre les pages qui existent), `VilleFicheLocale.tsx` (liens, composant serveur).
- **Tests** : aucun lien vers une page secteur inexistante ; au plus 3 liens ; aucune ancre identique sur deux villes voisines.

### S6-8 · Passage à 50 villes (après décision de Will)

- **Fichiers** : `src/content/villes/villes-indexees.ts` (10 slugs, en-tête et règle réécrits selon la décision), `src/generated/indexable-villes.ts` (régénéré), `villes-indexees.spec.ts` (40 → 50, « 59 pages locales » → 69, règle ≥ 100 000 remplacée par la porte de qualité).
- **Effets automatiques** : meta robots, en-tête Edge, sous-sitemaps `villes-<région>` (aucun découpage : jamais plus de 10 villes par région au total, à revérifier), site-explorer.
- **Build** : aucune page pré-rendue en plus (seuil 100 000 inchangé), donc aucun effet sur la durée du build ni sur le disque.
- **Retour arrière** : revert du fichier et du fichier généré (déjà documenté dans l'en-tête).
- **Après fusion** : soumettre `sitemap-index.xml` dans la Search Console (action de Will), surveiller l'inspection (P5).

### S6-9 · Mesure des villes dans le pilotage

- **Dépend** de P2, P4 et P8 (tables, ingestion, écran).
- **Fichiers** : `src/server/seo-pilotage/villes/mesure.ts` (pur), onglet ou filtre « Villes » de l'écran `content-gen/pilotage`, ligne du rapport hebdomadaire (P9).
- **Contenu** : indicateurs du § 6 ; comparaison « avec fiche / sans fiche » ; liste des villes sous plancher.
- **Tests** : table absente : « indisponible », jamais 0 ; une requête contenant le nom de la ville du siège n'apparaît dans aucune suggestion ; homonymes.

### S6-10 · Décision sur les pages indexées sans fiche

- Après 8 semaines de mesure (S6-9) et si des pages sans fiche restent : **signalement** dans l'écran, décision de Will (garder, rédiger la fiche, désindexer). Une désindexation est un retrait de slug dans `villes-indexees.ts`, par une PR humaine.

## 8. Risques

| Risque                                                                         | Parade                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Pages jugées « doorway » (gabarit + nom de ville)                              | Porte de qualité (S6-3) ; aucune nouvelle ville sans fiche ; mesure avec/sans fiche          |
| Affirmation inventée dans une fiche (chiffre, partenariat, client)             | Liste blanche de domaines, « aucun chiffre orphelin », catégories fermées, relecture de Will |
| Retour de la fausse présence par un fichier non couvert                        | S6-2 étend le test aux pages hub, région, offres et au gabarit `par-ville`                   |
| Cannibalisation hub / région / ville / pages `par-ville`                       | Pages `par-ville` noindex ; critère « 40 km » ; détecteur d du pilotage                      |
| Nom de la ville du siège écrit par une nouvelle fiche ou une suggestion        | Mots interdits des fiches, test existant, garde-fous du pilotage                             |
| Build plus long ou disque saturé                                               | Seuil de pré-rendu inchangé ; nouvelles villes en ISR                                        |
| Données Urssaf ou INSEE périmées                                               | Millésime affiché ; `consulteLe` ; revue annuelle                                            |
| Un lien vers `/politique-deplacement` lu comme « frais en plus »               | Q4 : retirer le lien des fiches ou le garder ; `legal.ts` reste intact                       |
| Recouvrement avec les branches `geo/*` (villes) citées dans `DECOUPAGE.md` § 3 | Vérifier les branches ouvertes avant S6-1 et S6-4 ; partir de `main`                         |

## 9. Questions ouvertes pour Will

1. **Ville du siège** : sa page est indexée, nommée, et dit « nous n'avons pas de bureau » dans la ville du siège social. Garder telle quelle, adapter la phrase (sans écrire le nom ailleurs), ou la sortir de l'index ? La règle de la fiche (« jamais écrit ») et la décision du 18/11 (« visible, hors maillage ») divergent.
2. **Règle d'entrée** : remplacer « ≥ 100 000 habitants, ou preuve d'intervention » par « porte de qualité + critères du § 4 » ? Sans cela, S6-8 est impossible.
3. La ville du siège compte-t-elle dans les 50 ?
4. **Lien `/politique-deplacement`** depuis les fiches : le garder ou le retirer ? (La page elle-même est dans `legal.ts`, hors chantier ; son vocabulaire « Module 1 / Module 2 » est ancien.)
5. Que faire, après 8 semaines, des pages indexées sans fiche qui restent ?
6. Avez-vous des **preuves écrites d'intervention** dans certaines villes (avec accord du client) ? Ce serait le seul contenu « local » non public autorisé.
7. Liste des 10 villes nouvelles : valider ou amender la liste illustrative du § 4.
8. Nettoyage du code mort (`src/components/ville/` : 5 composants non importés) dans S6-1, ou PR séparée ?

## 10. Exactitude

Affirmations vérifiées dans le code (branche à `0f98ce51`, copie superficielle) :

| Affirmation                                                                                          | Où                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 40 villes indexées, liste unique, règle ≥ 100 000, ville du siège hors maillage                      | `src/content/villes/villes-indexees.ts` ; `__tests__/villes-indexees.spec.ts` l. 59-101                                                                |
| 2 157 communes dans `data/*.ts`, 2 157 slugs avec `copy`                                             | `src/content/villes/data/*.ts` (2 157 `slug:`) ; `src/generated/villes-slugs-with-copy.ts` (2 157 entrées)                                             |
| 40 communes ≥ 100 000, 123 ≥ 50 000, 455 ≥ 20 000 ; les 40 indexées = les 40 ≥ 100 000               | calcul sur `data/*.ts`                                                                                                                                 |
| 10 fiches locales                                                                                    | `src/content/villes/fiches-locales/index.ts`                                                                                                           |
| Meta robots de la page ville : `index` si `copy` et `isVilleIndexable`                               | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` l. 139-145                                                                                  |
| Pré-rendu ≥ 100 000, ISR 24 h, `dynamicParams`                                                       | `src/content/villes/prerendu.ts` ; page ville l. 93-102                                                                                                |
| « Nous n'avons pas de bureau … » pour toutes les villes                                              | `src/content/villes/journee-ia-locale.ts` l. 246-292                                                                                                   |
| Siège social dans la ville du siège                                                                  | `src/content/legal.ts` (mentions)                                                                                                                      |
| Aucun `LocalBusiness` sur les pages implantations                                                    | `src/lib/seo/ville-service-jsonld.ts` l. 162-166, 318                                                                                                  |
| Pages `par-ville` toujours `noindex, follow`                                                         | `VilleServicePageTemplate.tsx` l. 252-267 ; `site-explorer/indexability.ts` l. 111-116                                                                 |
| `indexableOnly` filtre sur `hasVilleCopy`                                                            | `src/lib/geo.ts` l. 45-49                                                                                                                              |
| Lien « Notre politique de déplacement »                                                              | `src/components/ville/VilleFicheLocale.tsx` l. 199-206                                                                                                 |
| Texte de `/politique-deplacement` (« Module 1 / Module 2 », périmètre FR/BE/LU/CH, aucun montant)    | `src/content/legal.ts` l. 1026-1079                                                                                                                    |
| Phrases de `LocalGeoFaqSection` citées au § 2.3 ; seule la variante `sites-web-augmentes` est rendue | `src/components/sections/LocalGeoFaqSection.tsx` l. 41, 52, 63, 87, 98, 133, 174-215, 225 ; `src/app/[locale]/sites-web-augmentes/page.tsx` l. 273-278 |
| Test « ni frais ni fausse présence », périmètre de lecture                                           | `src/content/villes/__tests__/villes-sans-frais-ni-fausse-presence.spec.ts` l. 11-20                                                                   |
| Garde anti-doublon des fiches (< 30 % de 6-grammes), « dix villes »                                  | `src/content/villes/__tests__/fiches-locales.spec.ts` l. 113, 194, 217-230                                                                             |
| `DUPLICATE_THRESHOLD = 0.4`                                                                          | `src/server/content-gen/generators/anti-duplicate-check.ts`                                                                                            |
| Gel des 4 générateurs annexes                                                                        | `src/server/content-gen/villes/generateurs-annexes-geles.ts`                                                                                           |
| 5 composants de `src/components/ville/` non importés                                                 | grep des imports `@/components/ville/<Nom>` hors tests                                                                                                 |
| 18 régions `noindex: false`                                                                          | `src/content/regions.ts`                                                                                                                               |
| Type de page `ville`, intention `locale`, chemins protégés                                           | `src/server/seo-pilotage/donnees/types-page.ts` l. 40, 104 ; `opportunites/intention.ts` l. 43-66 ; `opportunites/garde-fous.ts` l. 37, 55             |
| Tables GSC d'historique absentes                                                                     | `prisma/schema.prisma` (aucun `model Gsc…`)                                                                                                            |

**À vérifier** : le « PLAN-VILLES §3.1 » cité par `fiches-locales/types.ts` (introuvable dans la copie superficielle) ; la nature du local du siège (bureau ou domiciliation) ; l'affichage de la fiche sur une page `noindex` rendue en ISR (S6-6) ; les autres appelants de `getNearbyVilles` (S6-1) ; les branches `geo/*` ouvertes au moment de coder.
