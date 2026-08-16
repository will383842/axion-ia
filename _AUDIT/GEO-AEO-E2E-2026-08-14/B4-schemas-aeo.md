# B4 — Schémas d'autorité AEO (FAQPage, QAPage, DefinedTerm, Dataset, ImageObject, BreadcrumbList, SiteNavigationElement)

- **Date** : 2026-08-14, mesures live 17:50–17:58 UTC (⚠️ toutes AVANT l'atterrissage du deploy en vol prévu ~18:30 UTC ; dernier deploy stable atterri ~14:57 UTC).
- **Périmètre réellement couvert** : `src/lib/seo/extended-schemas.ts` (6 helpers), `buildFaqJsonLd` + `buildFaqSpeakableJsonLd` + `buildBreadcrumbJsonLd` + `buildQAPageJsonLd` (×2) + `buildPageImageGraphJsonLd` / `buildPrimaryImageOfPage` (`src/lib/seo.ts`), `seo-content-gen-factories.ts` (QAPage), `src/lib/seo/page-images.ts`, `src/lib/seo/manon-person.ts`, `src/components/nav/Breadcrumbs.tsx`, `src/components/marketing/JsonLd.tsx`, pages `/faq` (hub, par-thematique, [slug]), `/glossaire` (hub + [slug]), `/observatoire-ia` (+ exports CSV/JSON), `layout.tsx` (SiteNavigationElement), échantillon ville + centre-aide (pour le vecteur d'émission JSON-LD). Live : 11 URLs prod en GET.

## Résumé exécutif

La stack de schémas d'autorité est **riche et globalement bien construite** (QAPage complet avec answerCount/upvoteCount/auteur Manon, FAQPage cappé à 50 éditoriales, DefinedTerm/DefinedTermSet cohérents, Dataset avec distribution CSV/JSON, ImageObject graph SSOT 3-consommateurs, BreadcrumbList systématique, SiteNavigationElement global). Mais **trois fuites de valeur** : (1) une trentaine de gabarits — dont les villes pSEO, secteurs, centre-aide, stack-ia, glossaire hub — émettent leurs FAQPage/QAPage/ItemList en `strategy="afterInteractive"`, donc **invisibles aux crawlers IA non-JS** (Perplexity, OAI-SearchBot, Claude-SearchBot) qui sont la cible même de l'AEO ; (2) le nœud **Person Manon dépend de la DB** et manque du rendu ISR post-build sur les fiches FAQ éditoriales (author `@id` orphelin servi aux crawlers pendant des heures après chaque deploy — vérifié live) ; (3) les **exports du Dataset observatoire sont bloqués par robots.txt** (`Disallow: /api/`). Verdict : socle prod-grade, ~3 patches S/M pour convertir l'investissement JSON-LD en signal réellement ingéré par les moteurs IA.

## Findings

### [P1] Schémas d'autorité (FAQPage/QAPage/ItemList/Place-graph) émis en `afterInteractive` → invisibles aux crawlers IA non-JS sur ~30 gabarits dont les villes pSEO

- **Symptôme** : sur les gabarits concernés, le `<script type="application/ld+json">` n'existe PAS dans le HTML serveur ; il est injecté par `next/script` après hydratation. Googlebot (rendu JS 2ᵉ passe) le voit ; PerplexityBot, OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Mistral — autorisés par la doctrine robots précisément pour la citation — ne l'ingèrent jamais.
- **Preuve code** :
  - `src/components/marketing/JsonLd.tsx:39-47` — `strategy !== "inline"` → `<Script strategy="afterInteractive">` (injection client).
  - Sites d'appel (grep `strategy="afterInteractive"`, ~30 call sites JSON-LD) : `src/components/sections/VilleServicePageTemplate.tsx:865` (graph complet des pages ville-service), `src/app/[locale]/implantations/[region]/[ville]/page.tsx:940`, `src/components/ville/VilleFaqGeolocalisee.tsx:120` (FAQPage géolocalisée), `src/app/[locale]/secteurs/[secteur]/page.tsx:529-532` (FAQPage secteur), `src/app/[locale]/centre-aide/[slug]/page.tsx:244` (QAPage), `src/app/[locale]/stack-ia/page.tsx:859` + `stack-ia/[tool]/page.tsx:291` (FAQPage), `src/app/[locale]/audit/page.tsx:273` (ItemList), `src/app/[locale]/glossaire/page.tsx:164-168` (ItemList des 60 termes), `sites-web-augmentes`, `implementation/**`, `devenir-commercial-ia`, `connaissances`, `secteurs/[secteur]/[activite]`…
- **Preuve live (2026-08-14)** :
  - 17:57 UTC — `GET https://axion-ia.com/fr/implantations/auvergne-rhone-alpes/grenoble` (200) : blocs ld+json parseables du HTML brut = `['Place', [Organization, WebSite, SiteNavigationElement]]` — **aucun FAQPage, aucun BreadcrumbList, aucun graph ville** (la chaîne "FAQPage" n'apparaît que dans le payload RSC, pas en `<script ld+json>`).
  - 17:58 UTC — `GET /fr/centre-aide/preparer-une-intervention` (200) : `['BreadcrumbList', 'Article', [layout graph]]` — **QAPage absent** du HTML brut.
  - 17:50 UTC — `GET /fr/glossaire` (200) : `['BreadcrumbList', 'DefinedTermSet', [layout graph]]` — **ItemList des 60 termes absent**.
- **Root-cause** : optimisation TBT V-04 P0i (Sprint Correctif 2026-05-22) qui a arbitré perf > visibilité crawler, à une époque où la cible AEO « crawlers IA sans JS » n'était pas le critère. Le commentaire de `JsonLd.tsx:11-13` reconnaît explicitement que seul « Googlebot (qui exécute JS) » lira ces blocs.
- **Patch prescrit** : repasser en `strategy="inline"` (défaut) les schémas d'AUTORITÉ (FAQPage, QAPage, ItemList, graph ville) sur les gabarits indexables — un JSON-LD de 2-10 KB inline ne bloque pas le parsing de façon mesurable ; si le graph ville complet est trop lourd, ne « inliner » que FAQPage + BreadcrumbList et garder afterInteractive pour le reste. Vérifier le delta TBT via `pnpm lhci` (budget TBT ≤ 150 ms).
- **Effort** : M (mécanique mais ~30 call sites + gate Lighthouse à surveiller).
- **Impact GEO/AEO** : **fort** — c'est le canal structuré vers les moteurs de réponse sur les surfaces pSEO les plus volumineuses (~1 816 villes × variantes services, secteurs, centre-aide).
- **Risque de régression** : moyen — TBT/First Load sur les 15 pages stratégiques (gate `lhci` + `size-limit`). Do-not-touch : `JsonLd.tsx` lui-même (garder l'option), `Plausible.tsx`/`Clarity.tsx` (analytics restent afterInteractive), budgets AGENTS.md.

### [P1] Nœud Person « Manon » DB-dépendant : `author @id` orphelin sur les fiches FAQ servies depuis le rendu de build (stub) — vérifié live 3 h après le deploy

- **Symptôme** : le QAPage de chaque fiche `/fr/faq/[slug]` référence `author: {"@id": ".../equipe/manon#person"}` ; le nœud Person qui résout cet `@id` est co-émis **seulement si la DB répond** (`authorProfile.findUnique`). Au build GH Actions (DATABASE_URL stub) il vaut `null` → les ~91 fiches éditoriales pré-rendues sortent SANS Person. Ce HTML dégradé est ensuite servi par ISR/Cloudflare jusqu'à la première visite qui déclenche la revalidation — donc le **premier crawler** après chaque deploy reçoit un `@id` insoluble (warning GSC « Missing field name in author », perte E-E-A-T).
- **Preuve code** : `src/lib/seo/manon-person.ts:19-24` (fetch Prisma, `.catch(() => null)`, commentaire « Stub-safe : retourne null si la DB est inaccessible (build stub.invalid) → l'ISR runtime réhydrate ») ; `src/app/[locale]/faq/[slug]/page.tsx:159` + `:789` (`{personJsonLd ? <JsonLd .../> : null}`). Le job `warm` (`.github/workflows/deploy-coolify.yml:747` et `:778`) ne liste AUCUNE fiche `/fr/faq/*` dans ses deux listes (revalidate + purge CF).
- **Preuve live (2026-08-14)** :
  - 17:52-17:53 UTC — `GET /fr/faq/definition-axion-ia` (via cache) : 3 blocs ld+json = BreadcrumbList + QAPage + layout graph, **Person absent** ; headers `x-nextjs-cache: STALE`, `cf-cache-status: HIT`, `Age: 75` — soit ~3 h après l'atterrissage du dernier deploy stable (14:57 UTC), l'origin servait encore le rendu de build sans Person.
  - 17:53:46 UTC — même URL avec `?b4audit=1` (bypass cache) : 4 blocs dont **Person présent** (`@id .../equipe/manon#person`, name=Manon) et `manon#person` ×8 — le rendu runtime est correct.
- **Root-cause** : une donnée 100 % statique (persona éditoriale) est allée chercher son SSOT en DB, la rendant victime du contrat stub/ISR (ADR 0026) sur des pages que le job `warm` ne couvre pas (1 500+ fiches, impossible à lister).
- **Patch prescrit** : dans `getManonPersonJsonLd()`, si `DATABASE_URL` contient `stub.invalid` OU si le fetch échoue, retourner un nœud Person minimal depuis un SSOT fichier (name, jobTitle, url, @id — mêmes valeurs que `buildPersonManonJsonLd`) au lieu de `null`. Aucun changement d'URL, aucun impact DB runtime.
- **Effort** : S.
- **Impact GEO/AEO** : moyen-fort (E-E-A-T/author resolution sur tout le silo FAQ + toutes les surfaces qui réutilisent ce helper : actualités, guides, centre-aide — même mécanique).
- **Risque de régression** : faible — risque de divergence si le profil DB évolue (mitiger : le fallback ne s'applique qu'en stub/échec). Do-not-touch : `prisma.ts` (Proxy stub), listes du job `warm`, `buildPersonManonJsonLd`.

### [P1] Dataset observatoire : les deux `DataDownload.contentUrl` (CSV/JSON) sont bloqués par robots.txt

- **Symptôme** : le JSON-LD `Dataset` de `/fr/observatoire-ia` déclare `distribution` → `https://axion-ia.com/api/observatoire/export-csv` et `.../export-json`, mais robots.txt émet `Disallow: /api/` dans les 12 blocs user-agent avec pour seules exceptions `/api/og`, `/api/avis/photo`, `/api/markdown/`. Google Dataset Search et les crawlers IA autorisés ne peuvent donc pas récupérer les données que le schéma leur annonce — l'actif « dataset citable » (1 147 réponses, CC BY 4.0, attribution intégrée) est publié puis verrouillé.
- **Preuve code** : `src/app/robots.ts:16` (`"/api/"` dans COMMON_DISALLOW) et `:107-109` (COMMON_ALLOW = og, avis/photo, markdown — pas d'observatoire) ; `src/app/[locale]/observatoire-ia/page.tsx:65-66` (CSV_URL/JSON_URL) et `:262-275` (distribution DataDownload).
- **Preuve live (2026-08-14 17:50-17:58 UTC)** : `robots.txt` prod = 12× `Disallow: /api/`, allows limités aux 3 chemins ci-dessus ; les deux exports répondent 200 (JSON : `"license": "https://creativecommons.org/licenses/by/4.0/"`, `"generatedAt": "2026-08-14T12:00:00Z"` ; CSV : 1 147 réponses agrégées) — contenu sain, seule la politique crawl bloque.
- **Root-cause** : même mécanique que le trou `/api/markdown/` comblé le 2026-07-20 (robots.ts:80-104) — une nouvelle route `/api/` publiée comme invitation à ingérer, sans l'`Allow` longest-match correspondant.
- **Patch prescrit** : ajouter `"/api/observatoire/"` à `COMMON_ALLOW` dans `src/app/robots.ts` (exactement le pattern `/api/markdown/`), + mettre à jour la spec robots. Ne touche PAS à la doctrine décision 2 (les bots training gardent `Disallow: /`).
- **Effort** : S.
- **Impact GEO/AEO** : moyen-fort (Dataset Search + citabilité des chiffres par les moteurs IA — l'observatoire est l'actif « données propriétaires » du site).
- **Risque de régression** : faible — vérifier que seul `/api/observatoire/export-*` devient crawlable (l'Allow sur `/api/observatoire/` couvre aussi d'éventuelles routes futures du préfixe : préférer `/api/observatoire/export-` si on veut être strict). Do-not-touch : les invariants `Allow: /api/og` + `/api/markdown/` (décision 2), blocs bots training.

### [P2] Hub glossaire : `DefinedTermSet` sans `@id` + termes sans `url` — fusion de graphe et énumération d'URLs perdues pour les non-JS

- **Symptôme** : le nœud hub (`glossaire/page.tsx:57-74`) n'a pas d'`@id`, alors que chaque fiche référence `inDefinedTermSet: {"@id": ".../fr/glossaire"}` (`glossaire/[slug]/page.tsx:136-141`) — les deux nœuds ne se consolident pas. De plus `hasDefinedTerm` liste name+description mais pas `url` par terme, et l'ItemList qui portait les 60 URLs est en afterInteractive (cf. P1 n°1) : un crawler non-JS ne reçoit AUCUNE URL de fiche via JSON-LD.
- **Preuve code** : fichiers/lignes ci-dessus. **Preuve live** 17:50 UTC : `SET @id= None`, 60 `hasDefinedTerm`, ItemList absent du HTML brut ; fiche `rag` : `inDefinedTermSet.@id = https://axion-ia.com/fr/glossaire`.
- **Patch** : ajouter `"@id": SITE_URL/{locale}/glossaire` au nœud hub + `url` sur chaque `hasDefinedTerm`. Effort S, impact faible-moyen, risque quasi nul. Do-not-touch : `@id` des fiches (`#term`).

### [P2] Dataset : `dateModified` figée au 2026-06-08 alors que le dataset bouge quotidiennement, et `numberOfItems` n'est pas une propriété Dataset

- **Symptôme** : le snapshot live est régénéré (`generatedAt: 2026-08-14T12:00Z` dans l'export JSON, n=1 147) mais le JSON-LD annonce `dateModified: 2026-06-08` (SITE_EDITORIAL_DATE) — signal de fraîcheur faux dans le mauvais sens pour un baromètre vivant (Dataset Search valorise la fraîcheur). `numberOfItems` (`observatoire-ia/page.tsx:261`) est une propriété d'ItemList, pas de Dataset (préférer omission ou `distribution`-level info).
- **Preuve code** : `observatoire-ia/page.tsx:248` + `:261`. **Preuve live** 17:56 UTC : Dataset `dateModified=2026-06-08`, export `generatedAt=2026-08-14T12:00Z`.
- **Patch** : alimenter `dateModified` avec la date du dernier snapshot (donnée réelle → pas de date-gaming, compatible doctrine fraîcheur 2026-06-08) ; retirer `numberOfItems`. Effort S, impact faible-moyen, risque nul. (Note : contrairement à la constante figée volontairement sur FAQ/glossaire, ici une vraie date de données existe.)

### [P2] Hub FAQ : FAQPage émet 50 réponses complètes quand la page ne montre que des extraits tronqués (~108 caractères)

- **Symptôme** : parité contenu visible / structuré imparfaite : `buildFaqSpeakableJsonLd` reçoit les réponses intégrales (`faq/page.tsx:139-149`) alors que le hub rend des `snippet` (`faq/page.tsx:104`) et pointe vers les fiches. Les sélecteurs Speakable `[itemprop='name']/[itemprop='text']` ne matchent d'ailleurs rien sur ce DOM (0 occurrence live, seuls 2 `data-faq-q/a`). Risque faible (rich results FAQ retirés par Google) mais signal « structured data ≠ contenu visible » pour les validateurs.
- **Preuve live** 17:50 UTC : FAQPage mainEntity=50 (réponse 1 = 1 037 caractères) vs DOM : extraits ~108 c., `itemprop` ×0.
- **Patch** : soit tronquer les réponses du schéma au même extrait + `url` vers la fiche, soit assumer (les fiches QAPage portent déjà la réponse complète). Effort S, impact faible. Ne pas toucher au cap SCHEMA_MAX=50 (anti-payload documenté).

### [P2] `extended-schemas.ts` : 5 helpers sur 6 jamais branchés + double implémentation `buildQAPageJsonLd` divergente

- **Symptôme** : `buildDefinedTermJsonLd`, `buildSoftwareApplicationJsonLd`, `buildVideoObjectJsonLd`, `buildClaimReviewJsonLd`, `buildSpecialAnnouncementJsonLd` ne sont importés QUE par leur spec (grep src : seuls tests + `layout.tsx` pour SiteNavigation) — les pages ont réimplémenté à la main (glossaire inline son DefinedTerm, `/roi` son WebApplication inline `roi/page.tsx:350-352`). Par ailleurs deux `buildQAPageJsonLd` coexistent et sont TOUTES DEUX en usage : `seo-content-gen-factories.ts:336` (riche : speakable, publisher, author Manon, @id, flag AI Act) sur `/faq/[slug]`, et `seo.ts:2191` (sans speakable/publisher/@id) sur `/centre-aide/[slug]` — divergence silencieuse de qualité de schéma entre deux silos Q/R.
- **Preuve code** : imports cités ; `centre-aide/[slug]/page.tsx:21` vs `faq/[slug]/page.tsx:32`. **Preuve live** : QAPage centre-aide absent du HTML brut (afterInteractive, cf. P1 n°1) donc non comparable live — `[À CONFIRMER]` pour le différentiel de rendu Google.
- **Patch** : converger centre-aide sur la factory riche (ou documenter la dualité) ; supprimer ou brancher les helpers morts (ClaimReview/SpecialAnnouncement restent des opportunités AEO 2026 réelles pour actualités/comparaisons). Effort S-M, impact faible-moyen.

### [P2] Dates `SITE_EDITORIAL_DATE` (2026-06-08) identiques sur les 60 fiches glossaire (`subjectOf.datePublished/dateModified`)

- **Symptôme** : chaque DefinedTerm déclare la même paire de dates figées (`glossaire/[slug]/page.tsx:153-154`) — signal de fraîcheur sans valeur discriminante (même défaut que celui corrigé sur les FAQ le 2026-08-10 via `reviewedAt` par entrée).
- **Preuve live** 17:50 UTC (fiche rag) : `2026-06-08T00:00:00.000Z` ×2. 
- **Patch** : ajouter un `reviewedAt` optionnel par terme dans `glossary-extension` (même pattern que `FaqEntry.reviewedAt`), repli sur la constante. Effort S-M, impact faible. Interdit : réintroduire `BUILD_DATE`/`new Date()` (doctrine fraîcheur 2026-06-08).

## Mesures brutes

| URL (GET, prod) | Heure UTC | Status | Blocs ld+json parseables dans le HTML brut |
|---|---|---|---|
| /fr/faq | 17:50 | 200 | BreadcrumbList, FAQPage (50/50, speakable 5 sél.), CollectionPage (primaryImageOfPage OK), ItemList (8 thématiques), @graph ImageObject (1, `hub.avif#image`, CC BY), layout graph |
| /fr/faq/definition-axion-ia (cache edge) | 17:52 | 200 | BreadcrumbList, QAPage, layout graph — **Person ABSENT** (`x-nextjs-cache: STALE`, `cf-cache-status: HIT`, Age 75) |
| /fr/faq/definition-axion-ia?b4audit=1 | 17:53 | 200 | + **Person présent** ; QAPage : datePublished/dateModified=2026-08-12 (reviewedAt), answerCount=1, upvoteCount=0, isPartOf hub, speakable 4 sél. |
| /fr/faq/3-quick-wins…quick-win-ia?b4=1 (Track B) | 17:55 | 200 | QAPage `aiGenerated:true` + `additionalType AIGeneratedContent`, Person présent, meta robots `noindex, follow` (tier-2 conforme) |
| /fr/glossaire | 17:50 | 200 | BreadcrumbList, DefinedTermSet (60 termes, @id absent, dateModified 2026-06-08), layout graph — ItemList ABSENT (afterInteractive) |
| /fr/glossaire/rag | 17:50 | 200 | BreadcrumbList (Accueil›Glossaire›RAG), DefinedTerm (`#term`, termCode=rag, subjectOf+speakable), layout graph |
| /fr/observatoire-ia | 17:50 | 200 | BreadcrumbList, Dataset (license CC BY, temporal 2026-01-06/.., 10 variables, 2 DataDownload, numberOfItems=1147, dateModified 2026-06-08), WebPage, FAQPage (4/4), layout graph |
| /api/observatoire/export-json | 17:58 | 200 | JSON licencié CC BY, `generatedAt: 2026-08-14T12:00Z` — mais **bloqué robots** |
| /api/observatoire/export-csv | 17:58 | 200 | CSV 1 147 réponses — **bloqué robots** |
| /fr/implantations/auvergne-rhone-alpes/grenoble | 17:57 | 200 | Place + layout graph SEULEMENT — FAQPage/graph ville absents du HTML brut |
| /fr/centre-aide/preparer-une-intervention | 17:58 | 200 | BreadcrumbList, Article, layout graph — QAPage absent du HTML brut |
| robots.txt | 17:53 | 200 | 12× `Disallow: /api/` ; Allow : `/api/og`, `/api/avis/photo`, `/api/markdown/` uniquement |

Volumes : hub /fr/faq liste 1 529 URLs de fiches (Track A ~91 éditoriales dont 88 avec `reviewedAt` dans `transversal.ts`, + Track B DB noindex tier-2) ; glossaire = 60 termes ; SiteNavigationElement (layout.tsx:238-249) présent sur les 5 pages testées (5 services + Tarifs, SSOT `SERVICES`). Speakable : sélecteurs présents dans le DOM sur fiche FAQ (`faq-answer` ×4, `tldr-answer` ×4), fiche glossaire (`data-aeo` ×8) et observatoire (`data-faq-q/a` ×10).

## Limites

- **Pas de validation Rich Results / validator.schema.org** (pas d'outil navigateur pour cet agent ; parsing JSON local uniquement — la validité syntaxique JSON est vérifiée, pas le verdict Google).
- **Rendu Googlebot 2ᵉ passe non mesuré** : l'invisibilité `afterInteractive` est prouvée sur le HTML brut ; l'hypothèse « Googlebot le voit quand même » repose sur son rendu JS documenté, non re-testé ici.
- **Échantillon ville/centre-aide limité** (1 page chacun) — le pattern est établi par le code partagé (gabarits), pas par un échantillonnage large.
- **Pas d'accès DB** (B4 non autorisé) : le count `authorProfile` manon en prod est inféré du rendu bypass-cache (Person présent → la ligne existe), pas d'un SELECT.
- **Fenêtre deploy** : un deploy atterrit ~18:30 UTC ; toutes les mesures datent d'avant (17:50–17:58) et reflètent le deploy stable de 14:57 UTC — le finding Person (rendu stub servi 3 h après deploy) est d'autant plus probant.
- La couverture des sitemaps images et de la galerie DB (`image-jsonld-graph.service.ts`) est laissée à A4 ; les JobPosting à B5 ; les avis/AggregateRating à B6.
