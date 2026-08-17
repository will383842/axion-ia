# C4 — Maillage interne

- **Date** : 2026-08-14, mesures live 18:03 → 18:16 UTC (toutes AVANT l'atterrissage du deploy parti à 17:33 UTC — l'état mesuré est celui du deploy stable de ~14:57 UTC, fenêtre ISR expirée → mesures fiables).
- **Périmètre couvert** : `src/server/content-gen/links/**` (internal-link-catalog, inject-deep-links, related-articles, anchor-safe-link), `scripts/audit-link-graph.ts` (exécuté en lecture contre la prod, rapport JSON : `_AUDIT/GEO-AEO-E2E-2026-08-14/C4-link-graph.json`), sitemap HTML `/plan-du-site`, recherche interne `/recherche`, hubs de maillage (blog, catégories, FAQ, implantations, carrières, connaissances, cas-concrets, guides, glossaire, avis), liens in-body des articles persistés, profondeur de clic, liens vers 404/redirections, ancres.

## Résumé exécutif

Le maillage souffre de **deux casses franches** : (1) ~48 % des articles blog échantillonnés portent un lien in-body vers `/implementations` qui atterrit en **404** (aucune règle de redirect top-level, alors que le prompt générateur v7-phase8 IMPOSE ce lien) ; (2) le silo FAQ (surface AEO majeure, 87 fiches) a ses CTA de navigation hub↔thématiques rendus en `/fr/fr/*` → **404** (double préfixe locale via `Cta`+next-intl). En dessous, un défaut systémique : **tous les liens internes injectés dans les corps d'articles sont locale-less** (`/audit`, `/blog/…`) → un 301 par lien sur tout le corpus, et le hub carrières émet ses 54 liens d'offres pareillement (`next/link` au lieu de next-intl). 3 des 5 hubs catégorie blog listent **0 article**. Le hub `/fr/implantations` pèse 8,8 MB avec 2 279 liens dont ~78 % vers des villes noindex. Points sains : home → toutes pages stratégiques en 1 clic, villes pSEO à profondeur ≤ 2, `/recherche` correctement noindex,follow, glossaire et avis bien maillés, garde anti-ancres-imbriquées opérante.

## Findings

### [P0] Liens in-body `/implementations` → 404 sur ~la moitié du corpus blog

- **Symptôme** : les corps d'articles persistés contiennent `<a href="/implementations">` ; en prod `/implementations` → 301 → `/fr/implementations` → **404**. Lien interne mort massif, sur des pages indexables tier-1.
- **Preuve code** :
  - `src/server/content-gen/generators/v7-phase8-shared.ts:210` — le prompt impose « ≥ 3 liens internes vers /audit, /interventions/essentielle, /implementations, /un-a-un » ; `:382` — le feedback de re-gen ré-insiste sur `/implementations`.
  - `src/server/content-gen/kb/implementations.ts:23-69` — `sourceUrl: "https://axion-ia.com/implementations"` (les citations KB fournies au LLM pointent la même URL morte).
  - `next.config.ts:494-533` — seules les variantes ville `/implantations/:region/:ville/implementations` sont redirigées ; **aucune règle** pour `/implementations` top-level. La vraie route est `/implementation` (singulier, `src/i18n/routing.ts`).
- **Preuve live (UTC)** : 18:05 — `/fr/implementations` → 404 ; `/implementations` → 301 → `/fr/implementations` (donc 301→404). 18:06 — article `formation-ia-montmorency-definition` porte `href="/implementations"` en clair. 18:12 — échantillon de 23 articles du sitemap-blog : **11/23 contiennent le lien 404**.
- **Root-cause** : divergence singulier/pluriel entre la route réelle `/implementation` et le chemin `/implementations` codé en dur dans les prompts générateurs + KB, sans filet de redirect.
- **Patch prescrit** : (a) ajouter dans `next.config.ts` une règle permanente `/:locale(fr|en)/implementations` → `/:locale/implementation` (+ source apex `/implementations`) — répare instantanément TOUT le stock persisté au prix d'un saut ; (b) corriger `v7-phase8-shared.ts:210,382`, `v7-phase8-generators.ts:136` et les `sourceUrl` de `kb/implementations.ts` vers les routes réelles ; (c) optionnel : backfill SQL `bodyHtml` (`REPLACE('href="/implementations"','href="/fr/implementation"')`).
- **Effort** : S (redirect + prompts) ; M avec backfill. **Impact GEO/AEO** : fort (liens morts in-body = signal qualité négatif + équité perdue vers le service implémentation).
- **Risque régression** : faible pour le redirect (vérifier qu'il ne capture pas `/implantations`). Do-not-touch : `src/lib/prisma.ts`, contrat `stub.invalid`, le test verrouillant les prix (`décision actée 4`).

### [P0] Silo FAQ — CTAs hub↔thématiques rendus `/fr/fr/*` → 404

- **Symptôme** : sur `/fr/faq`, le CTA héro « Par thématique » pointe `/fr/fr/faq/par-thematique` (404) et « S'abonner RSS » pointe `/fr/fr/faq/feed.xml` (404). Sur `/fr/faq/par-thematique` et chaque page catégorie, les CTA retour pointent `/fr/fr/faq` (404). La navigation interne du silo FAQ — pilier AEO (87 fiches) — est cassée pour crawlers et visiteurs.
- **Preuve code** : `src/app/[locale]/faq/page.tsx:311` et `:314`, `src/app/[locale]/faq/par-thematique/page.tsx:186,190`, `src/app/[locale]/faq/par-thematique/[categorie]/page.tsx:201,205,282` — `<Cta href={`/${locale}/…`}>` ; or `Cta` (`src/components/marketing/Cta.tsx:2,37`) rend via `Link` de `@/i18n/navigation` qui **re-préfixe le locale** → `/fr/fr/…`. (Les cartes catégories à `faq/page.tsx:346-347` utilisent un `<a>` brut → correctes ; l'anti-pattern était même documenté à `faq/page.tsx:67-68` pour le feed, audit 2026-05-15.)
- **Preuve live (UTC)** : 18:07 — `/fr/faq` rendu contient `href="/fr/fr/faq/par-thematique"` et `href="/fr/fr/faq/feed.xml"` ; `/fr/faq/par-thematique` contient `href="/fr/fr/faq"` + `href="/fr/fr/faq/feed.xml"` ; `/fr/faq/par-thematique/audit` contient 2× `/fr/fr/faq` et 1× `/fr/fr/faq/par-thematique`. Curl : `/fr/fr/faq/par-thematique` → 404, `/fr/fr/faq/feed.xml` → 404, `/fr/fr` → 404. Le crawl BFS (18:06) a détecté ces URLs comme dead-ends.
- **Root-cause** : hrefs pré-préfixés `/${locale}` passés à un composant qui préfixe déjà.
- **Patch prescrit** : passer les chemins NUS aux `Cta` (`/faq`, `/faq/par-thematique`) ; pour `feed.xml` (pas une route next-intl), un `<a>` brut `href={`/${locale}/faq/feed.xml`}` comme :347, ou l'URL absolue.
- **Effort** : S (7 lignes). **Impact GEO/AEO** : fort (silo FAQ = surface de citation LLM n°1 ; liens 404 entre ses étages).
- **Risque régression** : quasi nul. Do-not-touch : `Cta.tsx` lui-même (comportement attendu partout ailleurs) ; le `<a>` de :347 qui est correct.

### [P1] Tous les liens internes injectés in-body sont locale-less → un 301 par lien sur tout le corpus

- **Symptôme** : chaque lien interne injecté dans les corps d'articles (`/audit`, `/un-a-un`, `/blog/<slug>`, CTA `/appel`) subit un 301 vers `/fr/...` — à l'échelle de milliers de liens. Le commentaire de `intent-enforcement.ts` interdit lui-même ce gaspillage (« un lien INTERNE ne doit jamais … gaspiller un saut de redirection »).
- **Preuve code** : `src/server/content-gen/links/internal-link-catalog.ts:22-85` (catalogue entier sans préfixe locale) ; `inject-deep-links.ts:106` (`/blog/…`, `/guides/…` nus) ; `quality/intent-enforcement.ts:68-69` (`FALLBACK_CTA_HTML` → `href="/appel"`) ; aucun rewrite au rendu : `src/app/[locale]/blog/[slug]/page.tsx:318,324,592` (sanitize + tokens prix seulement) et `html-sanitizer.ts:106-146` (ne touche pas les hrefs internes).
- **Preuve live (UTC)** : 18:03 — `/audit` → 301 → `/fr/audit` ; 18:04 — article Grenoble : `href="/audit"`, `href="/un-a-un"`, 7 liens `/blog/*` locale-less (contre 6 liens `/fr/blog/*` corrects du bloc « articles connexes ») ; 18:12 — **22/23 articles échantillonnés** portent au moins un lien locale-less.
- **Root-cause** : le pipeline d'injection écrit des chemins canoniques FR sans préfixe et rien ne les localise au rendu.
- **Patch prescrit** : au choix — (a) post-process au RENDU dans `blog/[slug]/page.tsx` (et pages sœurs actualites/guides) : réécrire `href="/x"` → `href="/${loc}/x"` pour les hrefs relatifs non préfixés (couvre TOUT le stock persisté, zéro backfill, 1 seul point de code) ; ou (b) préfixer à l'injection (ne couvre que le futur). (a) recommandé.
- **Effort** : S-M. **Impact GEO/AEO** : moyen-fort (Google consolide les 301 mais l'équité et le crawl gaspillent un saut partout ; certains crawlers LLM ne suivent pas les redirects).
- **Risque régression** : moyen — le rewrite doit ignorer ancres `#`, `mailto:`, URLs absolues, et ne pas double-préfixer. Tests requis. Do-not-touch : `anchor-safe-link.ts` (garde anti-imbrication, saine).

### [P1] Hub carrières : les 54 liens d'offres sont locale-less (`next/link` au lieu de next-intl)

- **Symptôme** : `/fr/carrieres` émet ses 54 liens d'offres en `href="/carrieres/<slug>"` → 301 chacun ; idem les offres similaires en bas de chaque page offre, et les petits CTAs (`/audit`, `/formations`…) des mêmes pages.
- **Preuve code** : `src/app/[locale]/carrieres/page.tsx:5` — `import Link from "next/link"` (pas `@/i18n/navigation`) ; `:377` — `href={`/carrieres/${o.slug}`}` ; `src/app/[locale]/carrieres/[slug]/page.tsx:6` et `:681` — même schéma.
- **Preuve live (UTC)** : 18:13-18:14 — `/fr/carrieres` : 54 `href="/carrieres/*"` distincts sans `/fr`, 0 lien `/fr/carrieres/<offre>` ; + `href="/audit"`, `href="/formations"` etc. locale-less sur la même page. Le crawl BFS comptait de ce fait les 54 URLs offres du sitemap comme « orphelines » (mismatch d'URL, pas vraie orphandom).
- **Root-cause** : mauvais import Link.
- **Patch prescrit** : remplacer par `Link` de `@/i18n/navigation` avec chemins nus dans les deux fichiers (attention aux hrefs dynamiques `/carrieres/${slug}` : typage `as never` comme ailleurs).
- **Effort** : S. **Impact GEO/AEO** : moyen (Google for Jobs découvre via sitemap + JSON-LD, mais l'équité interne des offres passe par des 301 ; fraîcheur carrières = chantier récent).
- **Risque régression** : faible. Do-not-touch : `careers/freshness.ts`, `datePosted` (décision actée 5).

### [P1] 3 des 5 hubs catégorie blog listent 0 article

- **Symptôme** : `/fr/blog/categorie/blog-formations-ia`, `blog-coaching-1-to-1`, `blog-implementations-ia` ne listent **aucun article** (0 lien `/fr/blog/<slug>`), alors que le site publie des centaines d'articles « formation-ia-* » et « coaching-ia-* ». `blog-audits-ia` en liste 19. Hubs quasi vides indexables + articles privés de leur hub d'appartenance (contribue aux orphelines).
- **Preuve code** : `src/app/[locale]/blog/categorie/[slug]/page.tsx:72-91` + `src/server/content-gen/blog/category-loader.ts:127-155` — la requête filtre `categoryId` exact de la `Category` au slug donné : si les articles générés sont rattachés à une autre catégorie (ou aucune), le hub sort vide.
- **Preuve live (UTC)** : 18:09 — `blog-formations-ia` = 0 article, `blog-coaching-1-to-1` = 0, `blog-implementations-ia` = 0, `blog-audits-ia` = 19 ; deploy en vol PAS encore atterri (run 17:33 en cours à 18:09) → l'état mesuré est le déploiement stable de 14:57, hors fenêtre ISR.
- **Root-cause `[À CONFIRMER]`** : rattachement `categoryId` défaillant côté content-gen (C4 n'a pas l'accès DB — à vérifier par D1/A3 : `SELECT c.slug, count(a.id) FROM categories c LEFT JOIN articles a ON a."categoryId"=c.id GROUP BY 1`).
- **Patch prescrit** : après confirmation DB — corriger l'assignation catégorie dans les générateurs (ou backfill `categoryId` par heuristique de slug), sinon gater les hubs vides hors sitemap/noindex tant que < N articles.
- **Effort** : M. **Impact GEO/AEO** : fort (silo blog inopérant sur 3/5 familles ; pages fines indexables).
- **Risque régression** : faible. Cross-ref : C5 (facettes), D1 (orchestration).

### [P1] Chaînes de redirection doubles dans les corps persistés (`/reserver`, `/interventions/*`)

- **Symptôme** : liens in-body `/reserver` → 301 → `/fr/reserver` → 308 → `/fr/appel` (2 sauts) et `/interventions/essentielle` → 301 → `/fr/interventions/essentielle` → 308 → `/fr/formations` (2 sauts).
- **Preuve code** : `src/server/content-gen/generators/v7-phase8-generators.ts:136-137` — la config `how_to_x_in_y` prescrit **encore** le CTA `/interventions/essentielle` ; `v7-phase8-shared.ts:210` idem ; les `/reserver` viennent du stock persisté pré-funnel-2026-06-26 (`intent-enforcement.ts:62-66` documente la suppression ; `next.config.ts:280-292` porte le 308 edge).
- **Preuve live (UTC)** : 18:05 — chaînes mesurées ci-dessus ; 18:12 — échantillon 23 articles : `/reserver` présent dans 5/23, `/interventions/*` dans 13/23 ; 18:04 — 3 occurrences `/reserver` sur le seul article Grenoble.
- **Root-cause** : configs générateurs jamais mises à jour après la refonte du funnel + corps persistés figés.
- **Patch prescrit** : (a) `v7-phase8-generators.ts:136` et `v7-phase8-shared.ts:210,382` → routes actuelles (`/appel`, `/formations`, `/implementation`) ; (b) le rewrite-au-rendu du P1 locale-less réduit mécaniquement chaque chaîne à 1 saut ; (c) backfill SQL optionnel pour zéro saut.
- **Effort** : S. **Impact GEO/AEO** : moyen. **Risque régression** : nul sur les prompts. Do-not-touch : les règles 308 de `next.config.ts` (liens ENTRANTS externes en dépendent).

### [P1] Hub `/fr/implantations` : 8,8 MB, 2 279 liens dont ~78 % vers des pages noindex

- **Symptôme** : le hub implantations émet 2 157 liens directs vers des pages ville, alors que seules 480 villes sont tier-1 (présentes dans les sitemaps régionaux) — ~1 677 liens (78 %) pointent des pages `noindex, follow`. La page fait 8,8 MB de HTML.
- **Preuve code** : surface D4 pour le tiering ; côté C4 le fait mesurable est le volume de liens du hub (pas de fichier unique cité — rendu dynamique).
- **Preuve live (UTC)** : 18:10-18:11 — `/fr/implantations` : 8 792 194 octets, 2 279 `<a>`, 2 157 liens villes ; somme des 13 sitemaps villes = 480 URLs ; `/fr/implantations/auvergne-rhone-alpes/albertville` (liée du hub, absente du sitemap) = `<meta name="robots" content="noindex, follow">`.
- **Root-cause** : le hub lie exhaustivement toutes les villes quel que soit leur tier.
- **Patch prescrit** : ne lier en dur depuis le hub national que les régions + villes tier-1 ; laisser les tier-2+ maillées depuis leur hub RÉGIONAL (profondeur 3, suffisant pour des noindex-follow). Diviserait le poids par ~4 et concentrerait l'équité sur les 480 indexables. ⚠️ NE PAS retirer les liens vers les tier-2 partout (elles irriguent le maillage) ni toucher au tiering lui-même (décision pSEO — valider avec D4 avant patch).
- **Effort** : M. **Impact GEO/AEO** : moyen-fort (crawl budget + dilution + 8,8 MB indigeste pour les crawlers LLM qui tronquent tôt).
- **Risque régression** : moyen — coordonner avec D4/G1. Do-not-touch : le tiering pSEO, les sitemaps villes.

### [P2] Sitemap HTML `/plan-du-site` inexistant

- **Symptôme** : `/fr/plan-du-site` → 404 (18:03 UTC) ; `/plan-du-site` → 301 → 404 ; **zéro occurrence** dans `src/` et `messages/`. Le prompt maître le référençait comme surface à auditer — il n'existe pas. Avec 61 articles blog et 452 entrées KB non atteintes par le BFS (cap 400 pages), une page plan-du-site (hubs + sections, pas les 17 k URLs) fournirait un étage de rattrapage d'équité. Effort M, impact faible-moyen.

### [P2] Pages publiques orphelines : `/fr/podcast`, `/fr/politique-deplacement`, hubs secteur cas-concrets

- `/fr/podcast` : dans le sitemap, mais aucun lien entrant public (seule référence : sidebar admin `AdminSidebarNav.tsx:434`) — orpheline stricte, confirmée BFS 18:06. `/fr/politique-deplacement` : idem (orpheline BFS, aucun lien composant public trouvé). `/fr/cas-concrets/secteur/{industrie,juridique,retail,banque,artisan}` : 5 hubs facette au sitemap, non liés depuis `/fr/cas-concrets` (18:15 — le hub ne lie que les 5 études). `/fr/demande-devis/confirmation` présente au sitemap (page funnel — à sortir du sitemap, cross-ref A2/C5). Patch : 1 lien footer (podcast), liens facettes sur le hub cas-concrets. Effort S.

### [P2] Hub KB `/fr/connaissances` : 48 entrées liées sur 507, sans pagination

- 18:13 UTC — sitemap-knowledge = 507 URLs, hub = 48 liens `/fr/connaissances/*`, aucun `?page=`. Chaque entrée lie 6 consœurs (18:14, `kb-fact-roi-ia-009-fr`) → découverte par chaînes uniquement ; 452 entrées non atteintes par le BFS. La KB étant la matière première de citation LLM (llms.txt l'expose, cross-ref A5), une pagination ou des hubs par type (`kb-fact-roi`, `kb-fact-ua`…) consoliderait la découverte. Effort M.

### [P2] Hub `/fr/guides` : 3 enfants liés, guides.xml toujours à 1 URL

- 18:15 UTC — `/fr/guides` lie 3 guides ; ≥ 9 slugs `guide-*` vivent dans le sitemap-blog ; `sitemap/guides.xml` déclare **1 URL** (bug connu 2026-07-20 apparemment toujours vivant — propriété A2, cité ici car le hub sous-maille aussi). Effort S côté hub.

### [P2] Divers

- `/fr/espace-formateur` : lié du footer home → 307 (auth) — lien crawlable vers une porte fermée ; passer en `nofollow` ou retirer du footer public. (18:08 UTC)
- Ancres d'injection quasi exact-match (« audit », « formation », « coaching ») répétées à l'échelle du corpus (`internal-link-catalog.ts:26-73`) — risque faible en interne, à surveiller ; les deep-links (bigrammes de titres, `inject-deep-links.ts:45-64`) sont sains.
- Admin : `qualiopi/{clients,sessions}/page.tsx:88/:85` — même anti-pattern double-préfixe que la FAQ (`/${locale}/${adminPrefix}/…` dans un Link next-intl) ; surface noindex, cosmétique mais casse la navigation console.
- Bon point vérifié : `/fr/recherche` = `robots: { index: false, follow: true }` (`recherche/page.tsx:35`) + hors sitemap + liée du footer → hygiène correcte, rien à faire.

## Mesures brutes

### Statuts URLs testées (curl, 2026-08-14 UTC)

| URL | Heure | Statut | Redirection |
|---|---|---|---|
| /fr/plan-du-site | 18:03 | 404 | — |
| /plan-du-site | 18:03 | 301 | → /fr/plan-du-site (404) |
| /fr/recherche | 18:03 | 200 | — |
| /audit | 18:03 | 301 | → /fr/audit (200) |
| /reserver | 18:05 | 301 | → /fr/reserver → 308 → /fr/appel |
| /interventions/essentielle | 18:05 | 301 | → 308 → /fr/formations |
| /implementations | 18:05 | 301 | → /fr/implementations = **404** |
| /fr/implementation | 18:05 | 200 | — |
| /fr/fr/faq/par-thematique | 18:07 | **404** | — |
| /fr/fr/faq/feed.xml | 18:07 | **404** | — |
| /fr/fr | 18:07 | 404 | — |
| /fr/espace-formateur | 18:08 | 307 | auth |
| /fr/recrutement | 18:13 | 404 | (pas une route ; sitemap-recrutement pointe /devenir-commercial-ia) |
| Catalogue interne (10 cibles : /fr/audit, /fr/formations, /fr/implementation, /fr/un-a-un, /fr/sites-web-augmentes, /fr/contact, /fr/demande-devis, /fr/glossaire, /fr/blog, /fr/appel, /fr/equipe/manon) | 18:05 | tous 200 | — |
| 96 liens internes de la home | 18:08 | tous 200 sauf /fr/espace-formateur (307) | — |

### Échantillon corps d'articles (23 articles du sitemap-blog, 18:12 UTC)

| Motif in-body | Articles touchés | Devenir du lien |
|---|---|---|
| `href="/implementations"` | 11/23 (48 %) | 301 → **404** |
| `href="/interventions/…"` | 13/23 (57 %) | 301 → 308 → /fr/formations |
| `href="/reserver"` | 5/23 (22 %) | 301 → 308 → /fr/appel |
| lien locale-less quelconque | 22/23 (96 %) | 301 chacun |

### Crawl BFS (`scripts/audit-link-graph.ts`, depth 6, cap 400 pages, généré 18:06:44 UTC — rapport : `C4-link-graph.json`)

| Métrique | Valeur | Remarque |
|---|---|---|
| URLs sitemaps (tous sub-sitemaps) | 1 928 | |
| URLs atteintes (découvertes) | 4 911 | dont non crawlées (cap 400 fetchs) |
| Profondeur : d0/d1/d2/d3 | 1 / 94 / 4 134 / 682 | pages stratégiques toutes à ≤ 1 ; villes ≤ 2 |
| « Orphelines » (sitemap ∖ atteintes) | 854 | **surestimé** : cap 400 pages + liens locale-less normalisés sans /fr (les 54 offres carrières en font partie à tort) |
| — dont /connaissances | 452 | hub ne lie que 48/507 |
| — dont /blog | 61 (sur 134 au sitemap) | |
| — dont /carrieres | 54 | faux positif d'URL (liens locale-less), vrai coût 301 |
| Dead-ends | 4 | dont les 2 URLs `/fr/fr/faq/*` (404) |
| Atteintes hors sitemap | 3 837 | villes tier-2 noindex + `/fr/formations/par-ville/*` (cross-ref A2/D4) |

### Hubs (18:09 → 18:15 UTC)

| Hub | Liens enfants dans le HTML | Attendu | Verdict |
|---|---|---|---|
| /fr/blog | 28 articles + 5 catégories | 134 au sitemap | via catégories… |
| /fr/blog/categorie/blog-audits-ia | 19 | — | OK |
| /fr/blog/categorie/blog-formations-ia | **0** | ≫ 0 | cassé |
| /fr/blog/categorie/blog-coaching-1-to-1 | **0** | ≫ 0 | cassé |
| /fr/blog/categorie/blog-implementations-ia | **0** | ≫ 0 | cassé |
| /fr/implantations | 2 157 villes + 18 régions (8,8 MB, 2 279 `<a>`) | 480 tier-1 | surdimensionné |
| /fr/implantations/auvergne-rhone-alpes | 284 sous-pages | 57 tier-1 | dense |
| /fr/carrieres | 54 offres **locale-less** | 54 | 301 partout |
| /fr/connaissances | 48 | 507 | sous-maillé |
| /fr/guides | 3 | ≥ 9 | sous-maillé |
| /fr/glossaire | 60 | — | OK |
| /fr/avis | 37 + pagination `?page=2` | 77 avis | OK |
| /fr/cas-concrets | 5 études, 0 hub secteur | 5 hubs secteur au sitemap | facettes orphelines |

## Limites

- **Pas d'accès DB** (C4 non listé) : le root-cause des hubs catégorie vides (rattachement `categoryId`) et le volume exact d'articles portant chaque lien mort restent `[À CONFIRMER]` par D1/A3 ; mes taux sont extrapolés d'un échantillon de 23/134 URLs sitemap-blog.
- **Crawl BFS capé à 400 pages fetchées** (machine partagée + politesse origin) : la liste « orphelines » est un majorant ; les profondeurs > 3 n'ont pas été explorées. Le rapport JSON complet est conservé pour re-analyse.
- Le crawler du script normalise les liens locale-less sans suivre la redirection dans son graphe → les cibles de liens locale-less apparaissent comme URLs distinctes (biais documenté, exploité pour détecter carrières).
- Deploy en vol pendant tout l'audit (parti 17:33 UTC, non atterri à 18:16) : toutes les mesures reflètent le deploy stable de ~14:57 UTC ; aucune mesure n'a été faite dans une fenêtre ISR post-deploy.
- Les ancres « sur-optimisées » n'ont été évaluées que qualitativement (pas de distribution d'ancres exhaustive — nécessiterait un crawl complet du corpus).
- `/fr/formations/par-ville/*` (49 pages liées hors sitemap) constaté mais non audité en profondeur — surface D4/A2.
