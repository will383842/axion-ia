# C5 — Duplication & facettes

- **Date** : 2026-08-14, mesures live 18:13–18:17 UTC (déploiement en vol depuis 17:33 UTC — voir Limites).
- **Périmètre réellement couvert** : pagination `?page=` et `/blog/page/[num]`, facettes blog (tag, categorie, secteur, service, taille, auteur), facettes avis (ville, departement, secteur, service + filtres query du hub `/avis`), filtres query des hubs `/galerie`, `/carrieres`, `/presse`, `/observatoire-ia`, `/cas-concrets`, `/recherche`, paramètres UTM et variantes d'URL → canonical. Hors périmètre (autres agents) : maillage vers redirections (C4), trailing slash/casse/chaînes 301 génériques (C3), pSEO villes noindex (D4), contenu des avis vs DB (B6).

## Résumé exécutif

La surface duplication/facettes est **globalement saine et au-dessus des standards** : pagination blog path-based exemplaire (canonical self, 404 hors bornes, 308 `page/1`→hub, zéro pollution sitemap), facettes avis validées contre SSOT + seuil anti-thin (`FACET_MIN_COUNT=3`) + sitemap cohérent, variantes UTM neutralisées partout par des canonicals path-only. **Une exception nette : `/galerie`**, qui recopie N'IMPORTE QUEL paramètre de query (UTM compris) dans sa canonical auto-référente, avec `robots index` inconditionnel et zéro validation des filtres → espace d'URLs indexables infini + pages 0-résultat en 200 auto-canoniques (soft-404/doorway). C'est le seul vrai trou, patch S. À côté : 3 polish P2 (query `?page` non consommée par le 308 blog, quasi-duplication ville⊂département sur les petites facettes avis, routes taxonomie blog mortes encore buildées).

## Findings

### [P1] `/galerie` : canonical auto-référente sur paramètres arbitraires + variantes 0-résultat indexables (crawl trap / soft-404)

- **Symptôme** : toute variante de query de `/fr/galerie` — y compris UTM et paramètres inventés — est servie en 200, `robots index, follow`, avec une **canonical qui recopie la query sale**. Les valeurs de filtres ne sont pas validées : un filtre bidon rend une page « 0 image libres » indexable et auto-canonique. Espace d'URLs indexables non borné, à la main de n'importe quel lien externe (partage social avec UTM, lien hostile).
- **Preuve code** :
  - `src/app/[locale]/galerie/page.tsx:77` — `const canonicalPath = \`/${locale}/galerie${buildQueryString(filters)}\`` (canonical = URL avec query) ;
  - `src/app/[locale]/galerie/page.tsx:233-240` — `buildQueryString` itère `Object.entries(filters)` = **tous** les searchParams runtime (le type `Filters` n'est qu'une assertion compile-time), seule `page` est exclue → `utm_source`, `foo`, tout passe dans la canonical ;
  - `src/app/[locale]/galerie/page.tsx:104-109` — `robots: { index: true, follow: true, … }` inconditionnel (jamais de noindex, même 0 résultat) ;
  - `src/app/[locale]/galerie/page.tsx:129-142` — les filtres sont passés **bruts** au `where` Prisma (aucune validation ; `isValidModule` en ligne 63 ne sert qu'au title) ; champ `module` = `String?` (`prisma/schema.prisma:4167` env.) donc pas de crash, juste 0 résultat ;
  - Contraste : tout le reste du site canonicalise path-only via `buildProductMetadata` (`src/lib/seo.ts:318` — `canonical: \`/${locale}${pathNorm}\``).
- **Preuve live** (UTC) :
  - 18:14:56 — `GET /fr/galerie?utm_source=test&utm_campaign=aud` → 200, `<link rel="canonical" href="https://axion-ia.com/fr/galerie?utm_source=test&utm_campaign=aud"/>`, `robots index, follow` ;
  - 18:14:56 — `GET /fr/galerie?targetCity=xyzzy-abc` → 200, canonical `…/fr/galerie?targetCity=xyzzy-abc`, index ;
  - 18:15:20 — `GET /fr/galerie?module=nimportequoi` → 200, corps « **0 image libres** », canonical auto-référente, index ;
  - 18:15:20 — `GET /fr/galerie?module=audits` (valide) → 200, « 34 images libres », canonical `…?module=audits` (facette voulue, OK si assumée).
- **Root-cause** : la page galerie a sa propre metadata artisanale (hors `buildProductMetadata`) écrite pour des « filtres URL SEO-friendly », sans whitelist des clés ni validation des valeurs ni gate anti-vide — l'anti-pattern exact que `/avis` (noindex filtres), `/carrieres`, `/presse`, `/observatoire-ia` (canonical propre + valeurs validées SSOT) évitent déjà.
- **Patch prescrit** : (1) whitelist stricte des clés de filtre dans `buildQueryString` (ignorer toute clé hors `Filters` connus) ; (2) valider les valeurs (`isValidModule`, listes SSOT ville/région/secteur) — valeur invalide → param ignoré dans le `where` ET dans la canonical ; (3) si `total === 0` ou paramètre non reconnu présent → `robots: { index: false, follow: true }` + canonical `/[locale]/galerie` propre ; (4) décider si les facettes `?module=` valides restent auto-canoniques indexables (alors les ajouter au sitemap images-fr) ou canonicalisent vers le hub.
- **Effort** : S (1 fichier). **Impact GEO/AEO** : moyen-fort (la banque d'images est une surface Google Images/citation dédiée ; le crawl budget de la galerie part aujourd'hui dans des variantes infinies). **Risque de régression** : faible — ne pas toucher `src/app/sitemaps/images-fr.xml/route.ts`, `src/app/[locale]/galerie/[slug]/**`, `buildGalleryHubGraph` (JSON-LD), ni le contrat stub ADR 0026.

### [P2] Redirect blog `?page=N` : la query n'est PAS consommée (contrairement au commentaire du code)

- **Symptôme** : `/fr/blog?page=2` → 308 vers `/fr/blog/page/2?page=2` — le `?page=2` reste collé à la destination. Pas de boucle (aucune règle ne re-matche `/blog/page/2`), atterrissage 200 avec canonical propre, mais le commentaire de `next.config.ts` affirme que « la capture nommée num CONSOMME le query param » — c'est faux en Next 16 live, et chaque ancienne URL `?page=N` engendre une variante `…/page/N?page=N` crawlable de plus.
- **Preuve code** : `next.config.ts:265-279` (règle `has: [{ type: "query", key: "page", value: "(?<num>[2-9]\\d*)" }]`, destination `/:locale/blog/page/:num`, commentaire lignes 268-270 erroné).
- **Preuve live** (UTC) : 18:13:56 — `GET /fr/blog?page=2` → `308 → https://axion-ia.com/fr/blog/page/2?page=2` ; 18:14:13 — suivi complet : final `…/page/2?page=2`, 200, 1 redirect ; 18:14:17 — cette URL sert `canonical https://axion-ia.com/fr/blog/page/2` propre + `robots index, follow`. Idem `?page=3`.
- **Root-cause** : comportement Next (les query params de la requête sont ré-appendus à la destination d'un redirect ; la capture dans `has` ne les consomme pas).
- **Patch prescrit** : au choix (a) rien — la canonical propre du point d'atterrissage consolide déjà, Google digère ; (b) si l'on veut des chaînes parfaitement propres, déplacer ce redirect dans `src/proxy.ts` (qui construit la Location à la main, query strippée). Corriger au minimum le commentaire mensonger de `next.config.ts`.
- **Effort** : S. **Impact GEO/AEO** : faible (cosmétique, signaux finaux corrects). **Risque de régression** : faible en (a)/commentaire ; moyen en (b) — do-not-touch : l'ordre des règles de `next.config.ts:260-279` (le 308 taxonomies) et le pipeline `src/proxy.ts` (EN 301, slug-history).

### [P2] Facettes avis ville ⊂ département : paires quasi-dupliquées indexables

- **Symptôme** : quand un département n'a d'avis que dans une ville, la page département est un clone de la page ville (mêmes avis, texte intégral dans le HTML — le `line-clamp-5` de `ReviewCard.tsx:46` n'est que du CSS), différenciée par ~2 phrases (title + answer). Les deux sont indexables et dans le sitemap → duplication interne / dilution, doorway-risk léger au sens HCU.
- **Preuve code** : `src/app/[locale]/avis/ville/[ville]/page.tsx:48-52` et `src/app/[locale]/avis/departement/[code]/page.tsx` (même requête `getPublishedReviews` à filtre près, même composant `FacetReviewsPage`) ; inclusion sitemap des deux : `src/app/sitemap-avis.xml/route.ts:87-98`.
- **Preuve live** (UTC) : 18:15:49 — `/fr/avis/ville/paris` et `/fr/avis/departement/75` : **3 avis identiques / 3 (overlap 100 %)** ; 18:15:20→:49 — `/fr/avis/ville/grenoble` (15 avis) ⊂ `/fr/avis/departement/38` (37 avis) : 15/15 inclus. Sitemap-avis (18:14:37) : 103 `<loc>` = hub + deposer + 77 avis + 24 facettes (5 services, 4 villes, 10 secteurs, 5 départements) — volumes cohérents avec l'état connu 77 avis.
- **Root-cause** : `FACET_MIN_COUNT = 3` (`src/lib/reviews/config.ts:17`) gate le thin mais pas la **distinctivité** entre facettes géographiques imbriquées.
- **Patch prescrit** : dans la page département (et le sitemap-avis), n'indexer le département que s'il apporte de la valeur propre — p.ex. `si (avis du département − avis de sa plus grosse ville) < 2` ou overlap ≥ 90 % avec une seule ville → `robots noindex, follow` + retrait du sitemap (garder la page et le maillage). Alternative : canonical du département vers la ville quand les ensembles sont identiques.
- **Effort** : S-M. **Impact GEO/AEO** : faible-moyen (peu de pages concernées aujourd'hui : 4 villes / 5 départements ; grandit avec les avis). **Risque de régression** : faible — do-not-touch : `FACET_MIN_COUNT` (SSOT partagé), `orgAggregateJsonLd` (B6), l'ordre des URLs du sitemap-avis.

### [P2] Routes taxonomie blog mortes (tag/auteur/secteur/service/taille) encore présentes et pré-rendues

- **Symptôme** : `next.config.ts` 308 toute la taxonomie `/blog/(tag|secteur|service|taille|auteur)/*` vers `/blog`, mais les fichiers de routes existent toujours avec `generateStaticParams` → pages pré-rendues au build (FR+EN) puis jamais servies. Zéro impact live (le redirect edge passe avant le routing), mais du SSG gaspillé sur un build déjà à 17 629 routes, et un risque de divergence si quelqu'un retire la règle redirect sans savoir que les routes ressusciteraient.
- **Preuve code** : `next.config.ts:260-264` (source `/:locale(fr|en)/blog/:taxo(tag|secteur|service|taille|auteur)/:rest*` → `/blog`, permanent) vs `src/app/[locale]/blog/tag/[slug]/page.tsx:24-28` (`dynamicParams = false` + `generateStaticParams` actifs), idem `auteur/[slug]/page.tsx`, `secteur/[slug]`, `service/[slug]`, `taille/[slug]`.
- **Preuve live** (UTC) : 18:13:56 — `/fr/blog/tag/ia-generative`, `/fr/blog/auteur/williams`, `/fr/blog/taille/pme`, `/fr/blog/secteur/sante`, `/fr/blog/service/audit` → tous `308 → https://axion-ia.com/fr/blog` (1 saut, propre). La taxonomie vivante `/fr/blog/categorie` → 200 ; `/fr/blog/categorie/blog-audits-ia` → 200 (18:16:55) ; slug inconnu → 404.
- **Root-cause** : dépréciation faite côté edge (signal permanent) sans purge des fichiers de routes.
- **Patch prescrit** : supprimer les 5 répertoires de routes mortes (garder la règle redirect, qui porte le signal SEO) — ou, si on les garde volontairement pour ré-activation future, le documenter en tête de fichiers.
- **Effort** : S. **Impact GEO/AEO** : faible (hygiène/build). **Risque de régression** : faible — do-not-touch : la règle redirect `next.config.ts:260-264`, `/blog/categorie/**` (taxonomie VIVANTE), `getRenderableBlogCategorySlugs`.

### [P2] Traitement hétérogène des variantes filtrées entre hubs (et combo noindex + canonical sur /avis)

- **Symptôme** : trois politiques coexistent pour la même situation « hub + filtres query » : `/avis` → `noindex, follow` + canonical hub ; `/carrieres`, `/presse`, `/observatoire-ia`, `/cas-concrets` → `index, follow` + canonical hub ; `/galerie` → self-canonical sale (cf. P1). Sur `/avis`, le combo `noindex` + canonical vers une page indexable envoie des signaux mixtes (Google déconseille de canonicaliser une page noindex — risque marginal de propagation du noindex, en pratique toléré).
- **Preuve code** : `src/app/[locale]/avis/page.tsx:170-173` (noindex si filtre actif, y compris `page>1` — ligne 144-145) ; `src/app/[locale]/carrieres/page.tsx:59-67` (noindex seulement EN/0 offres, pas sur filtres) ; `src/app/[locale]/observatoire-ia/page.tsx:69-80` (canonical path fixe, valeurs validées SSOT lignes 98-106) ; `src/app/[locale]/presse/page.tsx:59-70` ; `/recherche` : `src/app/[locale]/recherche/page.tsx:35` (noindex — correct).
- **Preuve live** (UTC, 18:14:33 et 18:16:10) : `/fr/avis?page=2`, `?note=5`, `?service=audits&secteur=sante` → `noindex, follow` + canonical `/fr/avis` ; `/fr/avis?utm_source=test` → `index` + canonical propre (UTM ≠ filtre : correct) ; `/fr/carrieres?category=tech&q=video`, `/fr/presse?region=bretagne`, `/fr/observatoire-ia?size=junk&sector=sante`, `/fr/cas-concrets?page=2` → `index, follow` + canonical hub propre ; `/fr/recherche?q=audit` → `noindex`.
- **Root-cause** : chaque hub a implémenté sa politique à des dates différentes ; aucune n'est fausse isolément (sauf galerie), mais il n'y a pas de doctrine unique.
- **Patch prescrit** : documenter une doctrine unique (canonical hub propre pour toute variante query ; noindex optionnel réservé aux combinaisons de filtres réellement crawlables depuis le HTML, comme `/avis`) et l'appliquer lors du fix P1 galerie. Aucun changement urgent sur les hubs sains.
- **Effort** : S (doc) . **Impact GEO/AEO** : faible. **Risque de régression** : nul si doc seule.

## Constats sains (anti-faux-positifs pour la squad H)

- **Pagination blog path-based = état de l'art** : `/fr/blog/page/2` self-canonical `index,follow` + `rel prev/next` (18:14:17) ; `/fr/blog/page/1` → 308 `/fr/blog` ; `/fr/blog/page/01` et `/999` → 404 franc (18:13:56) ; **0** URL `blog/page/` dans sitemap-blog (134 locs, 18:17:04). Code : `src/app/[locale]/blog/page/[num]/page.tsx:25-29,41-42`, `BlogListingView.tsx:113-114`.
- **UTM inoffensifs sur tout le site** hors galerie : canonical path-only `src/lib/seo.ts:318` ; live `/fr/tarifs?utm_source=perplexity&utm_medium=llm` et `/fr/blog?utm_source=chatgpt…` → canonical propres (18:14:17, 18:16:10).
- **Facettes avis correctement gatées** : valeurs validées (isDeptCode, `isClientSectorSlug`, `isServiceLine`, DB pour ville) + `FACET_MIN_COUNT=3` → 404 sur tout slug invalide/faible (9 URLs testées 18:14:50 : les 4 valides 200, les 5 invalides/casse 404). Sitemap-avis n'émet que les facettes ≥ seuil (`sitemap-avis.xml/route.ts:82-98`) — cohérence page/sitemap garantie par le même seuil.
- `/fr/avis/ville/Grenoble` (casse) → 404, pas d'alias dupliqué.

## Mesures brutes

| URL testée (https://axion-ia.com) | Heure UTC | Status | Canonical observée | Robots |
|---|---|---|---|---|
| /fr/blog?page=2 | 18:13:56 | 308 → /fr/blog/page/2?page=2 | — | — |
| /fr/blog/page/2 | 18:14:17 | 200 | /fr/blog/page/2 | index, follow |
| /fr/blog/page/2?page=2 | 18:14:17 | 200 | /fr/blog/page/2 | index, follow |
| /fr/blog/page/1 | 18:13:56 | 308 → /fr/blog | — | — |
| /fr/blog/page/01 · /999 | 18:13:56 | 404 · 404 | — | — |
| /fr/blog?page=1 | 18:14:17 | 200 | /fr/blog | index, follow |
| /fr/blog?utm_source=chatgpt&utm_medium=referral | 18:14:17 | 200 | /fr/blog | index, follow |
| /fr/blog/{tag,auteur,taille,secteur,service}/* (5 URLs) | 18:13:56 | 308 → /fr/blog | — | — |
| /fr/blog/categorie · /categorie/blog-audits-ia · /categorie/inexistante | 18:13:56–18:16:55 | 200 · 200 · 404 | — | — |
| /fr/avis | 18:14:33 | 200 | /fr/avis | index, follow |
| /fr/avis?page=2 · ?note=5 · ?service=audits&secteur=sante | 18:14:33 | 200 | /fr/avis | **noindex**, follow |
| /fr/avis?utm_source=test | 18:14:33 | 200 | /fr/avis | index, follow |
| /fr/avis/ville/grenoble · /departement/38 · /secteur/juridique · /service/audits | 18:14:50 | 200 ×4 | self propres | index, follow |
| /fr/avis/ville/Grenoble · ville-inexistante · dept/99 · secteur/nawak · service/plomberie | 18:14:50 | 404 ×5 | — | — |
| /fr/galerie | 18:14:56 | 200 | /fr/galerie | index, follow |
| /fr/galerie?utm_source=test&utm_campaign=aud | 18:14:56 | 200 | **…?utm_source=test&utm_campaign=aud** | index, follow |
| /fr/galerie?page=2 | 18:14:56 | 200 | /fr/galerie | index, follow |
| /fr/galerie?module=nimportequoi | 18:15:20 | 200 (« 0 image libres ») | **…?module=nimportequoi** | index, follow |
| /fr/galerie?targetCity=xyzzy-abc | 18:14:56 | 200 | **…?targetCity=xyzzy-abc** | index, follow |
| /fr/galerie?module=audits | 18:15:20 | 200 (34 images) | …?module=audits | index, follow |
| /fr/tarifs?utm_source=perplexity&utm_medium=llm | 18:16:10 | 200 | /fr/tarifs | index, follow |
| /fr/cas-concrets?page=2 · /fr/carrieres?category=tech&q=video · /fr/presse?region=bretagne · /fr/observatoire-ia?size=junk&sector=sante | 18:16:10 | 200 ×4 | hubs propres | index, follow |
| /fr/recherche?q=audit | 18:16:10 | 200 | /fr/recherche | noindex, follow |

**Volumes** : sitemap-avis.xml (18:14:37) = 103 `<loc>` (hub + deposer + 77 avis + 24 facettes : 5 services, 4 villes, 10 secteurs, 5 départements) — cohérent avec l'état connu 77 avis. sitemap-blog.xml (18:17:04) = 134 `<loc>`, 0 URL de pagination. **Overlaps facettes** : paris∩75 = 3/3 (100 %) ; grenoble(15)⊂38(37) = 15/15.

## Limites

- **Déploiement en vol** (parti 17:33 UTC) : mes mesures 18:13–18:17 UTC tombent avant/pendant l'atterrissage estimé 18:30–19:00 ; toutes les réponses étaient stables et non vides (sitemap-avis plein), donc non affectées, mais un re-test post-restart confirmerait.
- **GSC/Bing non consultés** (hors de ma surface) : je ne peux pas dire si des variantes `?module=`/UTM de `/galerie` sont **déjà** indexées — le P1 est prouvé côté émission de signaux, pas côté dégât constaté dans l'index.
- **DB SELECT non autorisé pour C5** : counts de facettes déduits du sitemap et des pages, pas de la DB.
- Similarité inter-facettes mesurée par ensembles d'avis (liens `href`), pas par diff full-text ; échantillon de facettes (9 avis + 6 galerie + 6 hubs), pas un crawl exhaustif des combinaisons.
- Les chaînes trailing-slash/casse/UTM sur redirections legacy relèvent de C3 ; le maillage interne pointant vers des 308 (ex. anciens liens `?page=`) relève de C4.
