# B2 — Offre commerciale (Course, Product, Service, Offer, AggregateOffer, HowTo)

- **Date** : 2026-08-14, mesures live 17:52–17:54 UTC (avant atterrissage du deploy parti à 17:33 UTC ; toutes les pages testées sont SSG/ISR non DB-driven, non affectées par la fenêtre stub).
- **Périmètre réellement couvert** : builders `src/lib/seo.ts` (buildServiceJsonLd, buildCourseJsonLd, buildProductJsonLd, buildHowToJsonLd), SSOT `src/content/pricing.ts` (1 261 l.), AggregateOffer villes, graph ville×service (`src/lib/seo/ville-service-jsonld.ts` + `VilleServicePageTemplate.tsx`), pages live : `/fr/tarifs`, `/fr/audit` + 4 fiches niveaux, `/fr/formations` + 1 fiche, `/fr/un-a-un`, hub ville Lyon + 4 pages par-ville Lyon, `/fr/implementation` (code), `/fr/roi` (code), stack-ia (code).

## Résumé exécutif

La chaîne SSOT prix (`pricing.ts` → helpers `formatTierPrice`/`formatAmount` → pages) est saine : les prix AFFICHÉS sont partout conformes aux décisions actées (« à partir de » sur les audits, prix publics formations 1 200–3 900 €, aucun prix en dur — test `no-hardcoded-prices.spec.ts` en garde). Le problème est côté MACHINE : (1) **P0** — tout le JSON-LD commercial des ~4 300+ pages villes (Service+Offer, AggregateOffer, LocalBusiness, FAQ, HowTo) est injecté en `afterInteractive` : il est ABSENT du HTML servi, donc invisible pour tout crawler qui n'exécute pas JS (PerplexityBot, OAI-SearchBot, Claude-SearchBot, bingbot partiel) ; (2) **P1** — l'AggregateOffer ville est incohérent (lowPrice 1 190 > offres à 990, « Coaching 1-to-1 dirigeant » au prix collaborateur, plateforme SaaS à 990 € contre 2 000 € ailleurs, naming « Audit IA Flash » aboli) ; (3) **P1** — la verticale formations par-ville dit « sur devis » alors que /tarifs et /formations jurent « prix publics et fixes » ; (4) **P1** — les 4 fiches audit et /tarifs n'exposent AUCUN prix machine-readable. Verdict : offre commerciale bien racontée aux humains, mal racontée aux machines.

## Findings

### [P0] JSON-LD offre commerciale absent du HTML servi sur ~4 300+ pages villes (injection client-side)

- **Symptôme** : sur toutes les pages ville×service (~4 verticales × ~2 150 villes, « ~17 200 SSG » selon le commentaire du code) et sur les ~2 150 hubs ville, le graph JSON-LD complet — Service **avec le prix d'entrée en Offer**, AggregateOffer 5 services, LocalBusiness/ProfessionalService, FAQPage, HowTo, Person, ItemList — n'existe pas dans le HTML renvoyé par le serveur. Il n'est injecté qu'après hydratation JS via `next/script`. Tout moteur/crawler qui n'exécute pas JavaScript (PerplexityBot, OAI-SearchBot, Claude-SearchBot, Mistral, la plupart des fetchers RAG) ne voit **aucune** donnée structurée d'offre commerciale sur ces pages — exactement les schémas que le code annonce comme « Signal AI engine SERP rich snippet (Perplexity, Google AI Overviews) ».
- **Preuve code** :
  - `src/components/sections/VilleServicePageTemplate.tsx:863-867` — `<JsonLdGraph schemas={jsonLdSchemas} strategy="afterInteractive" …/>` (graph 7 schémas dont Service+priceEur).
  - `src/app/[locale]/implantations/[region]/[ville]/page.tsx:909-942` — `<JsonLdGraph …strategy="afterInteractive"…>` incluant `aggregateOfferJsonLd` (l. 938, 940).
  - `src/components/marketing/JsonLdGraph.tsx:75-83` — `strategy !== "inline"` → rendu via `next/script` (donc pas dans le HTML SSR). Le docstring l. 18-19 avertit lui-même : « Pour les schemas critiques où l'on doute de la capacité crawler à executer JS (LLM bots), garder strategy="inline" ».
- **Preuve live (17:53–17:54 UTC)** : comptage `<script type="application/ld+json">` réels vs occurrences totales de la chaîne dans le HTML :
  - `/fr/formations/par-ville/lyon` : **1** vrai tag (le @graph Organization du layout) / 3 occurrences ; `/fr/audit/par-ville/lyon` : 1/3 ; `/fr/sites-web-augmentes/par-ville/lyon` : 1/3 ; `/fr/un-a-un/par-ville/lyon` : 1/3 ; `/fr/implantations/auvergne-rhone-alpes/lyon` : **2**/6.
  - L'AggregateOffer Lyon (`"@type":"AggregateOffer","@id":"https://axion-ia.com/implantations/auvergne-rhone-alpes/lyon#offers"`) n'apparaît QUE dans le flight payload RSC échappé (`self.__next_f`), jamais en tag ld+json. Idem pour les Offer `price:"1190"` (audit), `"990"` (un-a-un), `"2000"` (sites-web) des pages par-ville.
  - Contre-exemple sain : `/fr/audit` = 7 vrais tags, `/fr/formations` = 12, `/fr/un-a-un` = 10 (leurs Service/Course/Offer sont inline et visibles).
- **Root-cause** : arbitrage Web Vitals V-04 P0i (Sprint Correctif 2026-05-22) : le graph a été déféré pour gagner ~300-500 ms de TBT sur les pages pSEO. En 2026, ce troc sacrifie le canal GEO principal de ces mêmes pages.
- **Patch prescrit** : passer les graphs ville en `strategy="inline"` (au minimum le sous-ensemble Service+Offer + AggregateOffer + FAQPage ; Person/ItemList peuvent rester déférés). Mesurer l'impact TBT sur 2-3 villes pilotes AVANT généralisation ; si le budget TBT ≤ 150 ms est menacé → STOP & ASK Will + ADR (contrat AGENTS.md). Alternative sans coût TBT : découper en 2 JsonLdGraph (commercial inline ~1,5 KB + reste déféré).
- **Effort** : M. **Impact GEO/AEO** : fort (c'est le canal machine des ~4 300 pages les plus nombreuses du site). **Risque de régression** : moyen — gate Lighthouse CI post-deploy (lhci) peut rougir sur TBT ; do-not-touch : `src/components/marketing/JsonLd.tsx` (défaut inline, utilisé partout), `lighthouserc.json`, budgets `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`. Nota : `/fr/audit` a aussi un ItemList en afterInteractive (`audit/page.tsx:273`) — même mécanique, impact mineur (page par ailleurs bien couverte inline).

### [P1] AggregateOffer des hubs ville incohérent et partiellement mensonger (~2 150 pages)

- **Symptôme** : le nœud AggregateOffer « Services Axion-IA à {ville} » annonce des bornes fausses et deux offres au mauvais prix :
  1. `lowPrice: 1190` alors que deux des 5 offres du nœud sont à **990 €** (coaching 1-to-1, implémentation Pilote) — un moteur citera « à partir de 1 190 € » quand 990 € existe ;
  2. `highPrice: 1900` (= `priceMin` du tier ETI) : ne borne rien de réel — la plus chère des 5 offres listées est 1 200 €, et le catalogue public monte à 9 900 € (sous-tier audit PME 50-250) ;
  3. l'offre `"Coaching 1-to-1 dirigeant"` porte `price: 990` = prix **collaborateur** ; la journée dirigeant est à 1 390 € ;
  4. l'offre `"Plateforme web / SaaS IA sur mesure"` porte `minPrice: 990` (= entrée **implémentation**), contredisant le plancher SSOT codage 2 000 € ET le Service JSON-LD des pages `/sites-web-augmentes/par-ville/*` (Offer 2 000 €, vérifié live) ET `/fr/tarifs` (« Sur devis · cadrage offert ») ;
  5. name `"Audit IA Flash"` : naming aboli par l'harmonisation offre (2026-08-13, « audit flash » = **Audit sur place**).
- **Preuve code** : `src/app/[locale]/implantations/[region]/[ville]/page.tsx:451-521` — `lowPrice: auditFlashPrice` (l. 466, = 1 190), `highPrice: auditEtiHighPrice` (l. 467, = `priceMin` ETI 1 900, `pricing.ts:277`), offre dirigeant `price: unAUnEntryPrice` (l. 493, = `getEntryPriceEur(UN_A_UN_TIERS)` = 990 car le tier **Collaborateur** est premier, `pricing.ts:619-622` ; dirigeant = 1 390, `pricing.ts:470`), plateforme `minPrice: implEntryPrice` (l. 514, = 990, `pricing.ts:661`) au lieu de `CODAGE_TIERS` (2 000, `pricing.ts:757`), name « Audit IA Flash » l. 474.
- **Preuve live (17:53 UTC)** : flight payload `/fr/implantations/auvergne-rhone-alpes/lyon` : `"lowPrice":1190,"highPrice":1900,"offerCount":5` ; offres extraites : Audit IA Flash 1190, Formation 1200, Coaching dirigeant **990**, Implémentation 990, Plateforme minPrice **990**. En parallèle `/fr/sites-web-augmentes/par-ville/lyon` porte (déféré) `"@type":"Offer","price":"2000"` pour le même service.
- **Root-cause** : bornes câblées sur deux tiers arbitraires (audit-flash / ETI-priceMin) au lieu d'être dérivées des 5 offres émises ; réutilisation de `UN_A_UN_TIERS` (dont l'ordre a été inversé le 2026-06-23 pour mettre Collaborateur en premier) sous un libellé « dirigeant » ; mauvaise catégorie SSOT pour la plateforme.
- **Patch prescrit** : dériver `lowPrice = Math.min(...prix des 5 offres)` et `highPrice = Math.max(...)` (ou omettre highPrice) ; renommer l'offre 3 « Coaching IA 1-to-1 (collaborateur ou dirigeant) » OU passer son prix à 1 390 en gardant le libellé dirigeant ; plateforme `minPrice: getEntryPriceEur(CODAGE_TIERS)` ; name « Audit sur place ». `lowPrice` reste un **nombre brut** (décision actée n°4 respectée — seule la valeur est corrigée, pas le format).
- **Effort** : S. **Impact GEO/AEO** : fort (~2 150 pages, requêtes prix locales). **Risque de régression** : faible — aucun test ne verrouille ces bornes (grep `lowPrice` dans specs : 0 hit) ; do-not-touch : `pricing.ts` (ne PAS réordonner `UN_A_UN_TIERS`, l'ordre pilote le « À partir de 990 € » de la home/villes ; ne rien changer aux tokens `{{price:…}}` ni à `no-hardcoded-prices.spec.ts`).

### [P1] Formations par-ville annoncées « sur devis » alors que les prix sont publics partout ailleurs

- **Symptôme** : sur `/fr/formations/par-ville/{ville}` (~2 150 pages), les CTA disent « Demander une date · sur devis », la FAQ dit « Nos interventions sont facturées en direct sur devis HT », et **aucun prix** n'est déclaré en JSON-LD — pendant que `/fr/tarifs` (FAQPage JSON-LD inline) et `/fr/formations` affirment « Nos prix formations sont **publics et fixes**… de 1 200 € HT à 3 900 € HT ». Un moteur IA interrogé « combien coûte une formation IA à Lyon ? » reçoit deux réponses contradictoires du même site.
- **Preuve code** : `src/components/sections/VilleServicePageTemplate.tsx:301-309` — `const entryPriceEur = isFormationService ? undefined : getEntryPriceEur(meta.tiers);` avec le commentaire « Formations V2 : 100 % SUR DEVIS (décision Will **2026-07-17**) ». Or la refonte catalogue du **2026-07-19** a rendu les prix publics (`pricing.ts:1170-1173` : « les PRIX SONT PUBLICS — prix fixe HT par groupe » ; matrice l. 1196-1203) et `tarifs/page.tsx:254` + `formations/page.tsx:1447` s'en réclament.
- **Preuve live (17:52–17:53 UTC)** : `/fr/formations/par-ville/lyon` : « Demander une date · sur devis » (CTA), « facturées en direct sur devis HT » (FAQ, aussi dans le FAQPage JSON-LD déféré) — 7 occurrences « sur devis ». `/fr/tarifs` FAQPage inline : « prix publics et fixes… de 1 200 € HT… à 3 900 € HT ».
- **Root-cause** : la décision « sur devis » (07-17) est antérieure de 2 jours à la refonte « prix publics » (07-19) et n'a jamais été réconciliée dans le template ville.
- **Patch prescrit** : ⚠️ décision Will requise (deux décisions actées successives en conflit — ce finding documente la contradiction, il ne « corrige » pas une décision). Option recommandée : brancher le prix d'entrée matrice (générale 1 j = 1 900 € ou 4 h = 1 200 €) dans le template ville (affichage + Service.offers), aligné sur la promesse « prix publics » de /tarifs. Option inverse : assumer le sur-devis ville et retirer « publics et fixes » — mais cela dégraderait /tarifs.
- **Effort** : S (une fois tranché). **Impact GEO/AEO** : fort (cohérence des réponses prix = critère de confiance des moteurs de réponse). **Risque de régression** : faible ; do-not-touch : `FORMATION_PRICE_MATRIX` (SSOT), copy villes générée (les tokens `{{price:…}}` de la prose sont volontairement nus — décision actée n°4).

### [P1] Aucun prix machine-readable sur les 4 fiches audit ni sur /tarifs

- **Symptôme** : les 4 pages de niveaux d'audit affichent « À partir de 1 190 / 1 900 € HT » aux humains, mais leur JSON-LD Service n'a **pas de nœud offers** ; `/fr/tarifs` — la page qui répond nominalement à « combien coûte l'IA ? » — n'émet que CollectionPage + ItemList (sans prix) + FAQPage (prix en texte libre uniquement, et seulement pour les formations). Les requêtes AEO « combien coûte un audit IA » n'ont aucun signal structuré à citer.
- **Preuve code** : `src/components/sections/AuditDetailPage.tsx:136-142` — `buildServiceJsonLd({...})` sans `priceEur` (le builder n'émet `offers` que si `priceEur` est passé, `seo.ts:478-488`) ; `src/app/[locale]/audit/page.tsx:85-89` — retrait volontaire du `priceEur: 0` (Sprint 14.10.8, bien vu) avec la promesse « Le prix d'entrée est exposé sur les pages détail tier » — promesse **non tenue** (aucune fiche ne le passe) ; `src/app/[locale]/tarifs/page.tsx:320-342` — ItemList + CollectionPage seuls.
- **Preuve live (17:52–17:53 UTC)** : extraction JSON-LD des 4 fiches (`/fr/audit/tpe-1-jour`, `/cible`, `/strategique-pme`, `/strategique-eti`) : Service + HowTo présents, **zéro** nœud Offer/price. `/fr/tarifs` : 5 blocs (CollectionPage, ItemList, BreadcrumbList, FAQPage, @graph layout), zéro Offer. Affichage humain conforme : « À partir de 1 190 € HT » / « À partir de 1 900 € HT » présents dans le HTML.
- **Root-cause** : la doctrine « pas de prix ferme sur les audits » (décision actée n°4) a été traduite en « pas de prix du tout » côté machine, alors que Schema.org sait exprimer un plancher.
- **Patch prescrit** : sur les 4 fiches, émettre `offers: { "@type": "Offer", priceSpecification: { "@type": "PriceSpecification", minPrice: <priceFlat|priceMin>, priceCurrency: "EUR" } }` — sémantique « à partir de », AUCUN prix ferme (décision 4 intacte ; ne PAS utiliser `formatTierPrice` ici : usage transactionnel du NOMBRE, cf. avertissement `pricing.ts:963-964`). Sur /tarifs : optionnel, OfferCatalog chiffré par module (mêmes minPrice).
- **Effort** : S. **Impact GEO/AEO** : moyen-fort. **Risque de régression** : faible — étendre `buildServiceJsonLd` avec un paramètre `minPriceEur` optionnel plutôt que modifier le comportement de `priceEur` (26+ pages l'utilisent) ; do-not-touch : la branche `priceEur` existante de `seo.ts:478-488`, `jsonld-validation.spec.ts`.

### [P2] /un-a-un : trois planchers de prix différents sur la même page

- **Symptôme** : le Service JSON-LD dit en description « …Partout en France métropolitaine. **Dès 790 € HT**. » (inclut le coaching récurrent /session) mais porte `offers.price: "990"` (journée collaborateur) ; un badge visible dit « Dès 990 € HT ». 790 vs 990 dans le MÊME nœud machine.
- **Preuve code** : `src/app/[locale]/un-a-un/page.tsx:76,103` (`Math.min(DIRIGEANT, MEMBRE, RECURRING)` = 790 pour le texte), l. 192 (description avec `${entryPrice}`), l. 195 (`priceEur: Math.min(DIRIGEANT_PRICE, MEMBRE_PRICE)` = 990).
- **Preuve live (17:53 UTC)** : HTML `/fr/un-a-un` : `"description":"…Dès 790 € HT.","…offers":{"@type":"Offer","price":"990"…}` + badge « Dès 990 € HT ».
- **Root-cause** : deux formules de min différentes (avec/sans le tier récurrent 790 €/session).
- **Patch prescrit** : harmoniser — soit la description sans le « Dès … » (le prix est déjà dans offers), soit `priceEur` aligné sur le vrai plancher communiqué. Effort S, impact faible, risque nul. Do-not-touch : `UN_A_UN_RECURRING_TIER` (790 €/session est un prix ferme voulu).

### [P2] Offer 0 € latent sur les fiches interventions (`?? 0`)

- **Symptôme** : `buildServiceJsonLd({ …, priceEur: config.priceFlatEur ?? 0 })` — tout futur config sans prix émettra `offers.price: "0"` = « service gratuit », le piège exact que `/fr/audit` a purgé au Sprint 14.10.8.
- **Preuve code** : `src/components/sections/InterventionDetailPage.tsx:99` ; contre-exemple : `audit/page.tsx:86-88`. **Preuve live** : inoffensif aujourd'hui — l'unique config (`intervention-detail-configs.ts:204-208`, `dirigeant-vision-strategique`) a un prix (1 390) ; page non fetchée (finding statique, garde qui ne garde rien).
- **Patch** : `...(typeof config.priceFlatEur === "number" ? { priceEur: config.priceFlatEur } : {})`. Effort S, impact faible (préventif), risque nul.

### [P2] `@id` de l'AggregateOffer sans préfixe locale

- **Symptôme** : `"@id":"https://axion-ia.com/implantations/auvergne-rhone-alpes/lyon#offers"` — URL sans `/fr` (n'existe pas en tant que page, localePrefix always). Un `@id` n'est pas un lien, mais il diverge des `url` du même graph et casse la fusion d'entités si un autre nœud référence la version localisée.
- **Preuve code** : `implantations/[region]/[ville]/page.tsx:462` — `` `${SITE_URL}${path}#offers` `` (les `url` voisins l. 477+ utilisent `${SITE_URL}/${loc}…`). **Preuve live (17:53 UTC)** : flight payload Lyon, @id sans locale.
- **Patch** : `` `${SITE_URL}/${loc}${path}#offers` ``. Effort S, impact faible, risque nul.

### [P2] Hub /formations : 4 nœuds Course sans offers portant le même `@id` que les fiches

- **Symptôme** : le hub émet un Course par offre générale avec `@id = …/formations/<slug>#course` (via `buildCourseJsonLd`, `seo.ts:1752`) **sans** prix, tandis que la fiche émet le même `@id` **avec** `offers` (1 200 € vérifié live). Deux définitions divergentes de la même entité selon la page crawleée.
- **Preuve code** : `formations/page.tsx:276-289` (sans `priceEurHt`) vs `FormationDetailPage.tsx:289-303` (avec). **Preuve live (17:53 UTC)** : `/fr/formations` block8-11 Course sans offers (prix seulement en texte de description « 1 200 € HT par groupe ») ; `/fr/formations/ia-pour-bien-commencer` Course + `offers.price:"1200"`.
- **Patch** : passer `priceEurHt: getFormationV2EntryPrice(f)` dans le map du hub (SSOT déjà importée). Effort S, impact faible-moyen (rich results Course), risque nul.

### [P2] `buildProductJsonLd` : `priceRange` déclaré dans un nœud Offer (propriété invalide) — latent

- **Symptôme** : le builder place `priceRange` DANS `offers` ; `priceRange` n'est pas une propriété d'`Offer` en Schema.org (c'est une propriété LocalBusiness). Paramètre mort aujourd'hui : l'unique consommateur (stack-ia) ne passe pas `priceRange`.
- **Preuve code** : `src/lib/seo.ts:1611-1620` ; consommateur `stack-ia/[tool]/page.tsx:186-197` (offer = availability + url seulement). **Preuve live** : non applicable (chemin mort — marqué statique).
- **Patch** : remplacer par `priceSpecification` (min/max) ou supprimer le champ. Effort S, impact faible, risque nul (aucun call-site ne l'utilise).

## Mesures brutes

Toutes les requêtes : GET curl, prod `https://axion-ia.com`, 2026-08-14 17:52–17:54 UTC.

| URL (/fr/…) | HTTP | Taille | Tags ld+json réels / occurrences | Nœuds prix trouvés (inline) |
|---|---|---|---|---|
| tarifs | 200 | 1 222 307 | 5 / 10 | 0 Offer ; FAQPage texte « 1 200 → 3 900 € HT » ✓ matrice |
| audit | 200 | 2 165 902 | 7 / 16 | Service sans offers ; ItemList déféré |
| audit/tpe-1-jour | 200 | 1 854 522 | 8 / 16 | 0 Offer ; affiché « À partir de 1 190 € HT » ✓ SSOT |
| audit/cible | 200 | 1 859 591 | 8 / 16 | 0 Offer ; « À partir de 1 900 € HT » ✓ |
| audit/strategique-pme | 200 | 1 842 449 | 8 / 16 | 0 Offer |
| audit/strategique-eti | 200 | 1 861 064 | 8 / 16 | 0 Offer |
| formations | 200 | 2 090 549 | 12 / 24 | 4 Course sans offers (prix en texte desc ✓ 1200/1900/1900/3600) |
| formations/ia-pour-bien-commencer | 200 | 2 054 096 | 6 / 12 | Course offers.price **1200** ✓ matrice generale/4h |
| un-a-un | 200 | 2 940 180 | 10 / 20 | Service offers.price **990** vs desc « Dès 790 € HT » ✗ |
| implantations/auvergne-rhone-alpes/lyon | 200 | 1 266 182 | **2** / 6 | AggregateOffer **déféré** : lowPrice 1190, highPrice 1900, offres 1190/1200/990/990/min 990 |
| formations/par-ville/lyon | 200 | 1 215 561 | **1** / 3 | Aucun prix ; « sur devis » ×7 ✗ |
| sites-web-augmentes/par-ville/lyon | 200 | 1 209 464 | **1** / 3 | Offer 2000 **déféré** (vs 990 sur le hub ✗) |
| un-a-un/par-ville/lyon | 200 | 1 222 447 | **1** / 3 | Offer 990 **déféré** |
| audit/par-ville/lyon | 200 | 1 214 353 | **1** / 3 | Offer 1190 **déféré** |

Référentiel SSOT vérifié (`src/content/pricing.ts`) : audit-flash 1 190 `isFromPrice` (l. 240-241) ; audit-cible/PME/ETI priceMin 1 900 (l. 253, 266, 277) ; sous-tiers audits 1 900→9 900 (l. 139-227) ; un-a-un : collaborateur 990 (l. 491), dirigeant 1 390 (l. 470), récurrent 790/session (l. 635) ; impl-poc 990-4 900 (l. 661-662) ; codage 2 000-30 000 (l. 757-758) ; matrice formations 1 200/1 900/3 600 · 1 900/3 600 · 2 200/3 900 (l. 1200-1202).

## Limites

- **Pas de Rich Results Test / Schema Markup Validator API** : la validité Google des nœuds a été évaluée par lecture de spec, pas par l'outil officiel (soumission d'URL interdite en audit-only ; le validator public nécessite un POST).
- **Pas de mesure SERP/citations IA** (« est-ce que Perplexity cite le bon prix ? ») — surface des squads F/G.
- **DB non consultée** (B2 non autorisé) — les prix étant 100 % SSOT fichier, sans impact.
- **Échantillon villes = Lyon uniquement** (1 hub + 4 par-ville) ; le mécanisme `afterInteractive` étant dans le template partagé, l'extrapolation aux ~2 150 villes est structurelle, pas mesurée page par page.
- **EN non testé** : 301 → FR (décision actée n°1).
- Le déploiement parti à 17:33 UTC n'avait pas atterri pendant les mesures (fenêtre stable) ; aucune page testée n'est DB-driven.
- Les pages `/interventions/dirigeants`, `/interventions/individuel`, `/formations/entreprise`, `/roi`, `/implementation` et stack-ia ont été auditées **en code seulement** (pas de fetch) — aucun signal d'incohérence prix n'y a été détecté (roi : Offer 0 € légitime, `isAccessibleForFree: true`).
