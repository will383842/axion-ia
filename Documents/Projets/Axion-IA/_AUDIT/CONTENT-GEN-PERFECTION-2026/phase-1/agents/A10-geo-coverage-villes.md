# A10 — COUVERTURE GÉOGRAPHIQUE VILLES · Audit Forensique

**HEAD audité :** `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
**Date :** 2026-05-21
**Périmètre :** Matrice ville × verticale × type contenu, Local SEO, KB villes, cannibalisation, sub-sitemaps.
**Mode :** AUDIT-ONLY STRICT — 0 invention, toutes citations fichier:ligne.

---

## Mission

Mesurer la couverture actuelle de la matrice ville × verticale × type contenu. Identifier gaps, détecter cannibalisation potentielle, auditer Local SEO.

---

## Méthode

1. Inventaire fichiers `src/content/villes/copy/*.ts` (39 fichiers) et `src/content/villes/economic-data/*.ts` (40 fichiers incl. index.ts)
2. Lecture `src/content/villes/index.ts` — COPY_BY_SLUG + RAW_VILLES
3. Lecture `src/content/villes/copy/types.ts` — type VilleCopy + VilleServicesLong
4. Lecture `src/components/sections/VilleServicePageTemplate.tsx` — logique indexabilité + JSON-LD
5. Lecture `src/lib/seo/ville-service-jsonld.ts` — stack JSON-LD 8 schémas
6. Lecture `src/app/sitemap.ts` — sub-sitemaps dynamiques villes × région
7. Lecture `src/app/[locale]/implantations/[region]/[ville]/page.tsx` — LocalBusiness JSON-LD + hreflang
8. Lecture `src/server/actions/content-gen/city-coverage.ts` — PILOT_CITY_SLUGS + dashboard
9. Lecture `src/content/legal.ts` — mentions légales entité/adresse
10. Lecture `src/lib/seo.ts` — buildOrganizationJsonLd, buildLocalBusinessJsonLd
11. Lecture `src/lib/geo.ts` — getRelatedBlogPosts, getNearbyVillesExtended
12. Recherche déduplication dans `src/server/content-gen/dedup/`

---

## État Observé

### Q1 — Inventaire villes

**copy/*.ts :** 39 fichiers (hors types.ts) = **39 villes avec contenu éditorial**.
**economic-data/*.ts :** 39 fichiers (hors index.ts) = **39 villes avec data économique**.
**data/*.ts :** 13 fichiers régions = **2 157 communes totales** dans la DB structurelle :
- auvergne-rhone-alpes : 284
- bourgogne-franche-comte : 66
- bretagne : 134
- centre-val-de-loire : 73
- corse : 9
- grand-est : 170
- hauts-de-france : 222
- ile-de-france : 377
- normandie : 97
- nouvelle-aquitaine : 191
- occitanie : 201
- pays-de-la-loire : 148
- provence-alpes-cote-d-azur : 185

**Fonction `getIndexableVilles()`** (`src/content/villes/index.ts:179`) : retourne uniquement les villes avec `copy` présent → **39 villes indexables** sur 2 157 totales.

### Q2 — Liste des 39 villes pilote

**Confirmé présent dans `PILOT_CITY_SLUGS`** (`src/server/actions/content-gen/city-coverage.ts:55`) et `COPY_BY_SLUG` (`src/content/villes/index.ts:89`) :

| # | Slug | Région | copy | economic-data |
|---|------|--------|------|--------------|
| 1 | paris | ile-de-france | ✅ | ✅ |
| 2 | marseille | provence-alpes-cote-d-azur | ✅ | ✅ |
| 3 | lyon | auvergne-rhone-alpes | ✅ | ✅ |
| 4 | toulouse | occitanie | ✅ | ✅ |
| 5 | nice | provence-alpes-cote-d-azur | ✅ | ✅ |
| 6 | nantes | pays-de-la-loire | ✅ | ✅ |
| 7 | montpellier | occitanie | ✅ | ✅ |
| 8 | strasbourg | grand-est | ✅ | ✅ |
| 9 | bordeaux | nouvelle-aquitaine | ✅ | ✅ |
| 10 | lille | hauts-de-france | ✅ | ✅ |
| 11 | rennes | bretagne | ✅ | ✅ |
| 12 | toulon | provence-alpes-cote-d-azur | ✅ | ✅ |
| 13 | reims | grand-est | ✅ | ✅ |
| 14 | saint-etienne | auvergne-rhone-alpes | ✅ | ✅ |
| 15 | le-havre | normandie | ✅ | ✅ |
| 16 | villeurbanne | auvergne-rhone-alpes | ✅ | ✅ |
| 17 | dijon | bourgogne-franche-comte | ✅ | ✅ |
| 18 | angers | pays-de-la-loire | ✅ | ✅ |
| 19 | grenoble | auvergne-rhone-alpes | ✅ | ✅ |
| 20 | nimes | occitanie | ✅ | ✅ |
| 21 | aix-en-provence | provence-alpes-cote-d-azur | ✅ | ✅ |
| 22 | clermont-ferrand | auvergne-rhone-alpes | ✅ | ✅ |
| 23 | le-mans | pays-de-la-loire | ✅ | ✅ |
| 24 | brest | bretagne | ✅ | ✅ |
| 25 | tours | centre-val-de-loire | ✅ | ✅ |
| 26 | amiens | hauts-de-france | ✅ | ✅ |
| 27 | annecy | auvergne-rhone-alpes | ✅ | ✅ |
| 28 | limoges | nouvelle-aquitaine | ✅ | ✅ |
| 29 | metz | grand-est | ✅ | ✅ |
| 30 | perpignan | occitanie | ✅ | ✅ |
| 31 | boulogne-billancourt | ile-de-france | ✅ | ✅ |
| 32 | besancon | bourgogne-franche-comte | ✅ | ✅ |
| 33 | orleans | centre-val-de-loire | ✅ | ✅ |
| 34 | rouen | normandie | ✅ | ✅ |
| 35 | montreuil | ile-de-france | ✅ | ✅ |
| 36 | caen | normandie | ✅ | ✅ |
| 37 | argenteuil | ile-de-france | ✅ | ✅ |
| 38 | mulhouse | grand-est | ✅ | ✅ |
| 39 | nancy | grand-est | ✅ | ✅ |

**Verdict : 39/39 villes pilote confirmées avec copy ET economic-data. Paris → Nancy — toutes présentes.**

### Q3 — Villes avec economic-data sans articles publiés

Le système articles DB est pilonné par `mentionedCities[]` (champ Prisma `Article.mentionedCities`, `schema.prisma:945`). La relation est via le champ array JSON — il n'existe pas de FK `cityId` dans le model `Article`. Les articles publiés via content-gen qui ciblent une ville ont `anchorVilleSlug` injecté dans la query KB (`landing-ville.ts:43`), mais la DB n'est pas consultable sans connexion live.

**OBSERVÉ STATIQUEMENT :** Toutes les 39 villes ont des landing pages statiques avec `copy.services.*` complet (4 verticales × FR+EN = 8 copies/ville). Le générateur `landing_ville` est disponible pour produire du contenu DB par ville. La présence de 0 articles DB par ville est **UNKNOWN** (voir section UNKNOWNs).

### Q4 — Pattern DB query articles par ville

**`getRelatedBlogPosts(ville, 3)`** (`src/lib/geo.ts:95`) : filtre `BLOG_POSTS` (fichiers TS statiques) via `post.relatedCities?.includes(ville.slug)` ou `post.tags.some(t => wantedTags.has(slugify(t)))`.

**`getBlogArticlesByVille`** (mentionné `src/lib/geo.ts:90-92`) : helper async DB via `mentionedCities[]`. Index GIN requis (`schema.prisma:952`) : `WHERE 'paris' = ANY(mentioned_cities)`.

La page ville appelle `getRelatedBlogPosts(ville, 3)` (`/implantations/[region]/[ville]/page.tsx:147`), limitée à 3 articles max. **Pas de pagination blog par ville observable côté code.**

### Q5 — Matrice ville × verticale × type

**Routes par-ville disponibles :**
- `/[locale]/interventions/par-ville/[ville]` — 4 services × 39 villes = **312 pages FR** (+ 312 EN désactivé temporairement)
- `/[locale]/audit/par-ville/[ville]`
- `/[locale]/implementation/par-ville/[ville]`
- `/[locale]/un-a-un/par-ville/[ville]`

**Structure `VilleServicesLong`** (`copy/types.ts:130`) : 4 champs `audit | interventions | implementation | unAUn`, chacun `{ fr: VilleServiceCopyLocale; en: VilleServiceCopyLocale }`.

**Résultat vérification :** TOUS les 39 fichiers copy/*.ts ont 8 "hero:" (4 services × 2 locales) — vérification exhaustive par shell :
```
FULL: [39/39 villes] (8 heroes chacune)
```

**Matrice complète observée :**
- 39 villes × 4 verticales × 2 locales = **312 pages services** (FR) indexables (EN désactivé)
- 39 villes × 1 page hub = **39 pages implantations** indexables
- **Total pages géo-localisées actives : 351 FR** (stub noindex pour les 2 157-39 = 2 118 communes sans copy)

**Types de contenu non couverts par ville :**
- `blog_from_rss` × ville → pipeline découplé de `landing_ville` (mentionné `src/content/villes/copy/paris.ts:1` "découplés")
- `case_study` × ville → via `getNearbyCases` (geo-based, pas par ville)
- `glossary_term` × ville → aucune relation explicite
- `guide` × ville → aucune relation explicite

### Q6 — Cannibalisation

**Pour les landing pages statiques (copy/*.ts) :**
- Chaque ville a **1 seul fichier copy** — pas de doublon slug possible (COPY_BY_SLUG `src/content/villes/index.ts:89` = Record unique)
- Chaque service × ville a **1 URL canonique** strictement (`/audit/par-ville/[ville]`, etc.)
- Cannibalisation intra-ville (ex : `audit IA Paris` ciblé à la fois par `/implantations/ile-de-france/paris` et `/audit/par-ville/paris`) : **structurelle mais intentionnelle** — les 2 pages ciblent des intents distincts (`localisation` vs `service-spécifique`)

**Pour les articles DB (content-gen) :**
Déduplication via `topic-fingerprint.ts` (SimHash 64-bit) et `embedding-similarity.ts` (cosine similarity). Seuils : `≤ 8 bits hamming = block, 9-12 = warn` (`src/server/content-gen/dedup/topic-fingerprint.ts:31`). Champ `Article.topicFingerprint` Nullable (`schema.prisma:930`) — rempli progressivement, pas backfillé.

**Risk cannibalisation identifié :**
- Villeurbanne ↔ Lyon : 2 villes distinctes mais géographiquement contiguës. Keywords proches (`audit IA Lyon` vs `audit IA Villeurbanne`). Pas de garde-fou explicite dans le générateur `landing_ville.ts` contre les villes mères/filles du même tissu urbain.
- Montreuil ↔ Paris, Argenteuil ↔ Paris, Boulogne-Billancourt ↔ Paris : même problème banlieue dense.

### Q7 — Doctrine KB villes, sources citées

**`economic-data/*.ts`** : contrat explicite "ZÉRO INVENTION" (`economic-data/index.ts:8`) — chaque entrée a `source` vérifiable + `verifiedOn`. Vérifié sur `paris.ts` (lignes 27-63) : URLs INSEE `https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056`, `verifiedOn: "2026-05-18"`.

**`copy/*.ts`** : sources citées en commentaire d'en-tête (ex `marseille.ts:4` : `INSEE COM-13055 : 31 646 établissements actifs`). Doctrine ~95% Axion-IA-centric + ~5% data INSEE anti-doorway explicite (`paris.ts:22-23`). Les sources ne sont pas des champs structurés dans les copy files — citées uniquement en header commentaires.

**`rouen.ts`** (exemple Manon) : header cite INSEE + sources spécifiques (`rouen.ts:15-19`) — doctrine respectée.

### Q8 — Contenu copy : démographie, secteurs, écosystème IA

**VilleCopy** (`copy/types.ts:144`) contient :
- `pitchFr/pitchEn` (30-50 mots avec données INSEE)
- `topSectorsNaf[]` (secteurs B2B pertinents)
- `ecosystemFr/ecosystemEn` (écosystème économique local)
- `distancesFr/distancesEn` (transport)
- `directAnswerFr/directAnswerEn` (réponse LLM-citable)
- `faqGeolocalisee[]` (4-6 Q/R localisées)

**`VilleEconomicData`** (`economic-data/types.ts`) couvre 16 dimensions : topSectorsNaf, statsInsee, polesCompetitivite, polesRechercheRD, grandesEcolesEtUniversites, grandsGroupesImplantes, zonesActivitesParcs, labelsEpvEtArtisanat, marquesHistoriques, produitsIgpAop, patrimoineNotable, vignoblesProches, salonsSectoriels, communesBassin, distances, kbSectorTags.

**Démographie :** présente via `statsInsee.etablissementsActifs` (champ VilleEconomicData) + `pitchFr` (données INSEE synthétiques). La population est dans `VilleData.population` (champ structurel).

**Écosystème IA local :** présent dans `ecosystemFr` et dans les services long-form `whyHere[]` — cités explicitement pour Paris (Mistral, Hugging Face, Owkin, `paris.ts:73`), Rouen (INSA, ESIGELEC, French Tech Normandie, `rouen.ts:18`).

### Q9 — Local SEO : NAP, adresse FR, GBP

**NAP = Name, Address, Phone :**

**Name :** "Axion-IA" — cohérent partout.

**Address :** La page `/mentions-legales` déclare `"société française ([forme juridique à préciser]). Siège social : [Ville — France]. RCS [Ville — France], SIREN [SIREN à compléter]"` (`src/content/legal.ts:44`). **L'adresse est un placeholder non rempli.**

**JSON-LD LocalBusiness** (`src/lib/seo.ts:765`) : ne contient PAS de `streetAddress` — seuls `addressLocality`, `addressRegion`, `postalCode` (conditionnel), `addressCountry`. **Aucune rue/numéro de rue.**

**Phone :** Absent de tous les schémas JSON-LD. `buildLocalBusinessJsonLd` ne prend pas de paramètre `telephone` (`seo.ts:729-731`).

**`buildOrganizationJsonLd`** (`seo.ts:375`) : `foundingLocation.address.addressLocality = "[Ville — France]"` — **placeholder non résolu**.

**FLAG P0 CRITIQUE :** AxionIA OÜ = entité estonienne (0 SIREN, SIREN non fourni), adresse FR inexistante → NAP incohérent → impossibilité de créer un profil Google Business Profile (GBP) valide → 0 visibilité Local Pack Google pour toutes les 39 villes.

### Q10 — JSON-LD LocalBusiness par page ville

**Page hub `/implantations/[region]/[ville]`** : oui, `buildLocalBusinessJsonLd` appelé (`page.tsx:150`) → émet `@type: "ProfessionalService"`.

**Pages services `/audit|interventions|implementation|un-a-un/par-ville/[ville]`** : via `buildVilleServiceJsonLdGraph` (`ville-service-jsonld.ts:162`) → émet `@type: ["LocalBusiness", "ProfessionalService"]` avec `@id`, `geo`, `email`, sans `telephone` ni `streetAddress`.

**Constat :** LocalBusiness présent mais incomplet (pas de `streetAddress`, pas de `telephone`, `priceRange: "€€€"` hard-codé, pas de lien GBP).

### Q11 — Sub-sitemaps par ville

**Sitemap implantations :** `sitemap/villes-<regionSlug>.xml` dynamique par région (`sitemap.ts:236`) — émet les 39 villes indexables, chunké si >500 URLs. Toutes les 39 villes présentes dans au moins 1 chunk.

**Sitemaps services villes :** 4 sub-sitemaps dédiés (`sitemap.ts:92-97`) :
- `services-villes-audit`
- `services-villes-interventions`
- `services-villes-implementation`
- `services-villes-un-a-un`

`buildServicesVillesSitemap` (`sitemap.ts:980`) : émet uniquement les villes avec `copy.services.<service>` présent. Depuis toutes les 39 villes ont 8 heroes, **39 × 4 services = 156 URLs FR dans les sitemaps services** (EN filtré par `EN_LOCALE_DISABLED`).

**Sitemaps images villes :** 3 route handlers (`sitemap-images-villes-t1.xml`, `t2.xml`, `t3-t4.xml`) — trouvés dans `src/app/`.

### Q12 — Hreflang FR/EN par page ville

**`buildProductMetadata`** (`seo.ts:102`) : génère hreflang `fr` + `x-default` systématiquement. Hreflang `en` conditionnel `if (!enDisabled)` (`seo.ts:135`). **EN LOCALE DÉSACTIVÉ** (`EN_LOCALE_ENABLED !== "true"`) depuis 2026-05-16 (bug next-intl 307 loop).

**Conséquence :** Les pages villes n'ont actuellement **qu'un seul hreflang `fr`**. Le hreflang EN est supprimé via `filterEnIfDisabled` (`sitemap.ts:326`). Quand EN sera réactivé, hreflang reviendra automatiquement.

### Q13 — Pagination si 50+ articles sur Paris

**La page hub implantations** appelle `getRelatedBlogPosts(ville, 3)` max 3 articles. Pas de pagination prévue (`/implantations/[region]/[ville]/page.tsx:147`). Si la DB contient 50+ articles mentionnant Paris, seuls 3 seront affichés. **Pas de pagination ni de page `/fr/implantations/ile-de-france/paris/blog`.**

### Q14 — Cluster topology : hub ville → cluster sub-topics

**Hub ville** (`/implantations/[region]/[ville]`) → liens vers :
- 4 pages services par-ville (via sections internes)
- Villes proches (via `buildItemListJsonLd` + `getNearbyVillesExtended`)
- 3 articles blog maximum

**Manque observé :** Pas de page `/blog/paris` (hub articles ville), pas de `/glossaire` by ville, pas de `/cas-concrets` by ville filtré. La cluster architecture existe pour les services (4 pages/ville) mais pas pour les autres types de contenu.

### Q15 — Session Manon (Rouen WIP)

**`rouen.ts`** est présent dans le repo courant (commit `2b98a70`) et figure dans `COPY_BY_SLUG` (`index.ts:122`). Le fichier est complet avec 8 heroes (`rouen.ts` vérifié). La mémoire indique que Rouen était "WIP Manon" mais au HEAD audité, le fichier est livré et intégré.

**Conséquence :** Pas d'impact actuel. Si la session Manon avait des modifications non pushées, elles sont absentes de ce HEAD.

### Q16 — Dashboard admin `/content-gen/city-coverage`

**Route** : `/fr/<adminPrefix>/content-gen/city-coverage` — page.tsx existe (`city-coverage/page.tsx`). Rend `CityCoverageV2` (`_v2/CityCoverageV2.tsx`). La page est `force-dynamic`, protégée par auth. Le composant appelle `getCityCoverage()` qui lit les 39 `PILOT_CITY_SLUGS` et calcule les scores sur `VilleEconomicData`.

**Verdict : opérationnel** — dashboard admin V2 live avec 39 villes, 8 dimensions, scoring vert/jaune/rouge.

---

## Findings — Tableau P0/P1/P2

| Sévérité | ID | Constat | Fichier:ligne | Impact |
|----------|----|---------|----|--------|
| **P0** | G01 | Adresse siège FR = placeholder `[Ville — France]` non rempli → NAP incomplet → GBP impossible → 0 Local Pack Google 39 villes | `src/content/legal.ts:44` + `src/lib/seo.ts:402` | Critique — 0 visibilité Local SEO pour 39 villes |
| **P0** | G02 | Pas de `streetAddress` dans `buildLocalBusinessJsonLd` → JSON-LD LocalBusiness sans adresse postale complète → Google ne peut pas confirmer l'établissement → Local Pack dégradé | `src/lib/seo.ts:729-731` | Critique — Local SEO bloqué sans adresse |
| **P0** | G03 | `telephone` absent de tous les schémas LocalBusiness/ProfessionalService → NAP incomplet (N=nom A=adresse P=phone) → critère minimum GBP non satisfait | `src/lib/seo.ts:765-827` | Critique — Google Business Profile non créable valide |
| **P1** | G04 | Cannibalisation structurelle Villeurbanne ↔ Lyon, Montreuil ↔ Paris, Argenteuil ↔ Paris, Boulogne-Billancourt ↔ Paris : mêmes keywords de service (`audit IA`) sur 2 URL distinctes sans garde-fou dans le générateur `landing_ville` | `src/server/content-gen/generators/landing-ville.ts:43` | SEO — risque de cannibalisation inter-ville dans le même tissu urbain |
| **P1** | G05 | EN locale désactivée depuis 2026-05-16 → hreflang EN absent de toutes les 39 pages villes → 0 signal international → perd le trafic anglophone (cabinets internationaux, expatriés) | `src/lib/seo.ts:121` + `AGENTS.md` §4 | SEO — manque trafic EN entrant |
| **P1** | G06 | Pas de pagination blog par ville → si content-gen produit 50+ articles ciblant Paris, seuls 3 sont affichés sur le hub ville → UX dégradée + crawl budget non optimisé | `src/app/[locale]/implantations/[region]/[ville]/page.tsx:147` | UX/SEO |
| **P1** | G07 | `Article.topicFingerprint` nullable non backfillé (`schema.prisma:930`) → dédup sémantique SimHash non actif sur articles existants → risque de cannibalisation sémantique sur les prochains batch landing_ville | `prisma/schema.prisma:930` | Content Quality |
| **P1** | G08 | `buildOrganizationJsonLd` : `foundingLocation.addressLocality = "[Ville — France]"` — placeholder non résolu → Knowledge Graph Organisation sans adresse vérifiable | `src/lib/seo.ts:402` | SEO/AEO — entité ambiguë pour AI Overviews |
| **P1** | G09 | Cluster blog par ville : pas de hub `/blog/[ville]` ni de section listant tous les articles DB par ville → articles générés par content-gen non rattachés visuellement au hub ville | `src/app/[locale]/implantations/[region]/[ville]/page.tsx:147` | SEO — maillage interne incomplet |
| **P1** | G10 | `sameAs` dans LocalBusiness (`ville-service-jsonld.ts:186`) pointe vers Wikipedia ville en français hard-codé (`fr.wikipedia.org`) même pour les pages EN (désactivées certes, mais la logique persiste) | `src/lib/seo/ville-service-jsonld.ts:127` | Mineur EN |
| **P2** | G11 | Sources INSEE dans copy/*.ts en commentaires d'en-tête non structurés → non vérifiables automatiquement → risk drift si chiffres vieillissent | `src/content/villes/copy/marseille.ts:4` | Data Quality |
| **P2** | G12 | Matrice ville × types autres que services non couverte : `blog_from_rss`, `glossary_term`, `case_study`, `guide` ne sont pas filtrés par ville dans le sitemap ni dans les pages hub | `src/app/sitemap.ts:980-1009` | Content Strategy |
| **P2** | G13 | `priceRange: "€€€"` hard-codé dans `buildLocalBusinessJsonLd` (`seo.ts:773`) sans condition liée au service → toutes les villes affichent le même niveau tarifaire même pour les services d'entrée de gamme | `src/lib/seo.ts:773` | Local SEO |
| **P2** | G14 | Corse a 9 communes dans data mais aucune dans les villes indexables → 0 couverture pour la Corse → 0 sub-sitemap `villes-corse` généré (région filtrée par `getIndexableRegions()`) | `src/content/villes/index.ts:131` | Coverage gap |

---

## Scoring /55

### Inventaire villes + matrice /20 → **17/20**

- 39/39 villes pilote avec copy ET economic-data ✅ (+5)
- 39/39 villes avec services long-form 4 verticales × FR+EN (8 copies/ville) ✅ (+5)
- Sub-sitemaps villes × région dynamiques fonctionnels ✅ (+3)
- Dashboard admin `/content-gen/city-coverage` opérationnel ✅ (+2)
- 2 157 communes structurelles avec noindex sécuritaire anti-doorway ✅ (+2)
- **Gaps :** Cluster blog/glossaire/cas-concrets par ville absent (-2). Corse 0 ville indexable (-1).

### Cannibalisation detection /12 → **7/12**

- Dédup sémantique SimHash + cosine similarity présent dans content-gen ✅ (+3)
- COPY_BY_SLUG avec slugs uniques = 0 doublon structurel ✅ (+2)
- Index GIN `mentionedCities` prévu pour filtre DB ✅ (+1)
- **Gaps :** Risque cannibalisation banlieues (Villeurbanne/Lyon, Montreuil/Paris) sans garde-fou dans le générateur (-2). `topicFingerprint` non backfillé sur articles existants (-2). Cannibalisation structurelle hub-implantation vs page-service non documentée comme intentionnelle (-1).

### Local SEO (NAP, LocalBusiness, GBP) /12 → **4/12**

- JSON-LD LocalBusiness/ProfessionalService présent sur toutes les pages villes ✅ (+2)
- Geo coordinates lat/lon présents ✅ (+1)
- Email contact@axion-ia.com présent ✅ (+1)
- `sameAs` LinkedIn présent ✅ (+1)
- **Gaps (P0) :** Adresse siège FR = placeholder → NAP rompu (-3). `telephone` absent (-2). `streetAddress` absent (-2). GBP inexistant → 0 Local Pack Google (-3). `foundingLocation` placeholder (-1).

### Stratégie KB villes + sources citées /7 → **5/7**

- Contrat ZÉRO INVENTION documenté et appliqué economic-data ✅ (+2)
- Sources URL + `verifiedOn` structurés dans economic-data ✅ (+2)
- Sources INSEE en commentaires header copy files (non structurées) ✅ partiel (+1)
- **Gaps :** Sources copy non structurées = non vérifiables automatiquement (-1). Vignobles/IGP/patrimoine absents de quelques villes industrielles (notApplicableFields) (-1 partiel, documenté).

### Sub-sitemaps + hreflang ville /4 → **3/4**

- 4 sub-sitemaps services-villes dédiés par verticale ✅ (+1)
- Sub-sitemaps villes-<région> dynamiques chunked ✅ (+1)
- Hreflang FR + x-default systématique ✅ (+1)
- **Gaps :** EN locale désactivée → hreflang EN absent temporairement (-1).

### **Score total : 36/55 (65.5%) — ORANGE / SPRINT CORRECTIF**

---

## Délégations

- **A09 (Dédup anti-thin)** : confirmer que le SimHash est actif pour les landing_ville futurs (topicFingerprint backfill).
- **A11 (KB zéro invention)** : vérifier alignement kbSectorTags des 39 villes avec la KB réelle (champ souvent absent).
- **A02 (Pipeline E2E)** : vérifier que l'anchorVilleSlug est bien injecté pour les 39 villes dans les jobs content-gen existants.

---

## UNKNOWNs

| ID | Question | Raison |
|----|----------|--------|
| U1 | Nombre d'articles DB publiés par ville (via `mentionedCities`) | Requiert connexion DB live — non consultable en audit statique |
| U2 | Score moyen city-coverage par ville (83% cité dans mémoire) | Calculé dynamiquement par `getCityCoverage()` côté serveur |
| U3 | Activation de GBP / Wikidata — état réel | Action humaine Will (décision A4 ouverte selon mémoire) |
| U4 | Volume d'articles `landing_ville` lancés par ville en prod | Requiert accès DB jobs content-gen |
| U5 | État du bug next-intl / date de ré-activation EN locale | Decision technique externe (upgrade next-intl) |

---

## Références

| Fichier | Lignes clés |
|---------|------------|
| `src/content/villes/index.ts` | 89-128 (COPY_BY_SLUG), 147-153 (VILLES composite), 179-181 (getIndexableVilles) |
| `src/content/villes/copy/types.ts` | 130-142 (VilleServicesLong), 144-182 (VilleCopy) |
| `src/content/villes/copy/paris.ts` | 1-24 (doctrine + corrections Will), 27-86 (pitchFr, services, ecosystemFr) |
| `src/content/villes/copy/rouen.ts` | 1-60 (Manon, sources citées, doctrine respectée) |
| `src/content/villes/economic-data/index.ts` | 56-96 (39 villes branchées) |
| `src/components/sections/VilleServicePageTemplate.tsx` | 149-200 (logique noindex/indexable), 217-325 (JSON-LD graph) |
| `src/lib/seo/ville-service-jsonld.ts` | 158-204 (LocalBusiness JSON-LD), 228-250 (FAQPage+Speakable) |
| `src/lib/seo.ts` | 102-145 (buildProductMetadata + hreflang), 375-424 (buildOrganizationJsonLd placeholder), 765-827 (buildLocalBusinessJsonLd sans streetAddress/telephone) |
| `src/app/sitemap.ts` | 92-97 (IDs services-villes-*), 218-244 (getVillesSitemapIds), 920-1009 (builders villes) |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | 150-165 (LocalBusiness JSON-LD), 147 (relatedPosts 3 max) |
| `src/server/actions/content-gen/city-coverage.ts` | 55-95 (PILOT_CITY_SLUGS 39 villes) |
| `src/content/legal.ts` | 44 (adresse placeholder) |
| `prisma/schema.prisma` | 874-955 (model Article + mentionedCities + topicFingerprint) |
| `src/server/content-gen/dedup/topic-fingerprint.ts` | (SimHash 64-bit, seuils) |
| `src/server/content-gen/generators/landing-ville.ts` | 34-95 (anchorVilleSlug, KB retrieve, economic-data injection) |
