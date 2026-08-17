# A2 — sitemap-index & sitemaps statiques

- **Date** : 2026-08-14, mesures live 17:48–18:09 UTC (AVANT l'atterrissage du deploy en vol estimé 18:30–19:00 UTC ; état mesuré = deploy stable atterri ~14:57 UTC).
- **Périmètre réellement couvert** : `src/app/sitemap-index.xml/route.ts` (358 l.), `src/app/sitemap.ts` (1 567 l.), les 12 sub-sitemaps statiques (`pages`, `faq`, `help`, `cas-concrets`, `comparaisons`, `guides`, `glossaire`, `implementation`, `implantations`, `stack-ia-tools`, `secteurs`, `formations`) + les 13 chunks `villes-*`, le manifeste de fraîcheur (`src/generated/content-freshness.ts` + `scripts/gen-content-freshness.mjs` + workflow), le gating anti-vide de l'index, `buildExcludeSlugsByType`, la redirection `/sitemap.xml`. Hors périmètre (autres agents) : contenus des sitemaps DB-driven (A3), sitemaps images (A4), robots/llms (A1), pings (A6).

## Résumé exécutif

La surface sitemap-index + statiques est **globalement saine et très au-dessus de la moyenne** : index 200 en 0,36 s, 38 sub-sitemaps déclarés, gating anti-vide opérant (news vide correctement retiré, presse gaté entrant avec 1 URL, `images-en` absent), zéro URL `/en/` fuitée, zéro trailing slash, IDs non déclarés en 404 propre, lastmod différenciés par famille via fraîcheur git réelle. Sur 134 URLs échantillonnées en live (49 + 85 pages.xml), **une seule anomalie d'incohérence** : `/fr/demande-devis/confirmation` est `noindex` mais déclarée dans `pages.xml` (P1). Le bug connu 2026-07-20 « guides/glossaire = 1 URL » est **résolu pour guides** (les 9 guides vivent dans sitemap-blog) mais **toujours vrai pour glossaire** : les 60 termes restent noindex/hors sitemap (substance < 80 mots — arbitrage Will documenté en code, en attente). Reste un risque structurel : `faq.xml` est le dernier sub-sitemap DB-aware encore servi par la convention metadata bakée sous stub.

## Findings

### [P1] `/fr/demande-devis/confirmation` est noindex ET déclarée dans `sitemap/pages.xml`

- **Symptôme** : incohérence GSC « URL noindexée dans le sitemap » — exactement la classe de défaut que `EXCLUDED_FROM_INDEX` a été construite pour éliminer (précédents corrigés : `/mes-donnees/export`, `/carrieres/widget`, `/simulateur`, `/diagnostic`).
- **Preuve code** : `src/app/[locale]/demande-devis/confirmation/page.tsx:36` → `robots: { index: false, follow: true }` ; `src/app/sitemap.ts:175-218` : `EXCLUDED_FROM_INDEX` contient `/confirmation` (l.185) mais PAS `/demande-devis/confirmation` (clé distincte déclarée `src/i18n/routing.ts:100`).
- **Preuve live (17:50–17:53 UTC)** : `https://axion-ia.com/fr/demande-devis/confirmation` présent dans `sitemap/pages.xml` ET répond 200 avec `<meta name="robots" content="noindex, follow">`. Scan exhaustif des 85 URLs de pages.xml : c'est la SEULE URL noindex du fichier.
- **Root-cause** : la clé a été oubliée lors de l'ajout de la page (le pattern d'exclusion existait déjà, il n'a pas été appliqué à cette clé).
- **Patch prescrit** : ajouter `"/demande-devis/confirmation"` à `EXCLUDED_FROM_INDEX` (`src/app/sitemap.ts` ~l.186, à côté de `/confirmation`, avec le même commentaire type `/mes-donnees/export`).
- **Effort** : S (1 ligne + commentaire). **Impact GEO/AEO** : moyen (confiance sitemap côté Google, crawl budget ; aucune page ne perd de visibilité). **Risque de régression** : quasi nul — la page reste servie, seul le sitemap change. Do-not-touch : le reste de la liste `EXCLUDED_FROM_INDEX`, la page elle-même.

### [P1] Glossaire : 60 termes noindex, `glossaire.xml` n'émet que le hub — le bug connu 2026-07-20 persiste côté glossaire

- **Symptôme** : `sitemap/glossaire.xml` = **1 URL** (le hub `/fr/glossaire`). Les 60 pages `/glossaire/[slug]` — surface de citation LLM/AEO idéale (définitions courtes, factuelles) — sont invisibles : noindex côté page ET absentes de tout sitemap.
- **Preuve code** : `src/content/glossary-extension.ts:855` (`GLOSSARY_MIN_INDEX_WORDS = 80`) + `:875-879` (`isGlossaryTermIndexable`) + le bloc doc `:827-849` : « AUCUN des 60 termes n'atteint ce seuil. Cumule FR+EN+exemples : min 45, moyenne 60,3, max 75 » (constat F49, mesuré 2026-07-26). Filtre appliqué au sitemap : `src/app/sitemap.ts:1152`.
- **Preuve live (17:49 UTC)** : `curl https://axion-ia.com/sitemap/glossaire.xml` → 1 seul `<loc>` (`/fr/glossaire`).
- **Root-cause** : ce n'est PAS un bug de plomberie — la doctrine éditoriale (≥ 80 mots) n'a jamais été appliquée au contenu. Deux « correctifs » sont explicitement INTERDITS par le code (`glossary-extension.ts:834-839`) : baisser le seuil, ou retirer le filtre — les deux mettraient 60 pages thin (~41 mots FR uniques, même gabarit) en index = profil doorway HCU 2024.
- **Patch prescrit** : ÉCRIRE le contenu — enrichir les définitions FR des 60 termes (ou d'un premier lot de ~15 termes à plus fort volume de recherche) au-dessus du seuil, ET trancher l'arbitrage métrique documenté (le comptage inclut le texte EN non rendu ; passer FR-only impose de recalibrer la barre ~55 ou 300 — décision Will en attente, cf. `glossary-extension.ts:841-849`). Ne rien toucher à la métrique tant que l'arbitrage n'est pas rendu.
- **Effort** : L (rédaction 60 × ~60 mots FR supplémentaires) ; S pour l'arbitrage seul. **Impact GEO/AEO** : fort (le glossaire est le format le plus cité par les moteurs IA ; 60 pages prêtes en infrastructure, zéro visible). **Risque de régression** : nul si on n'ajoute que du contenu ; do-not-touch : `GLOSSARY_MIN_INDEX_WORDS`, `glossaryTermWordCount()`, le `.filter(isGlossaryTermIndexable)` de `sitemap.ts:1152`.
- NB : le versant « guides » du bug connu 2026-07-20 est RÉSOLU : `guides.xml` hub-only est un choix documenté (`sitemap.ts:1049-1061`), les 9 guides sont émis dans `sitemap-blog.xml` sous `/guides/` (vérifié live 17:52 UTC : 9 `<loc>` `/guides/` sur 134 URLs).

### [P1] [À CONFIRMER] `faq.xml` : dernier sub-sitemap DB-aware resté sur la convention metadata bakée sous stub — les Q/R DB-only peuvent disparaître du sitemap à chaque deploy

- **Symptôme** : les migrations blog (2026-07-06), presse (2026-07-31) et knowledge ont toutes fui la convention metadata pour la même raison : pré-rendu au build `stub.invalid` → contenu DB absent, resservi jusqu'à `revalidate=86400` (24 h), re-baké vide au deploy suivant. `buildFaqSitemap` lit la DB (`listFaqs()`) mais est TOUJOURS servi par la convention (`sitemap.ts:561,974-1005` + `export const revalidate = 86400` l.122). Avec des deploys quasi quotidiens, la fenêtre stub peut être quasi permanente pour la part DB.
- **Preuve code** : `src/app/sitemap.ts:122` (revalidate 86400), `:974-1005` (builder DB via `listFaqs`), `src/lib/knowledge/readers.ts:240-301` (merge legacy FS + `prisma.fAQ.findMany`) ; job `warm` `.github/workflows/deploy-coolify.yml:747` — les DEUX listes (`PATHS`, `FILES` l.778) ne couvrent QUE des pages (`/fr/actualites`, `/fr/connaissances`, `/fr/ressources`, `/fr/galerie`, `/fr/diagnostic`), **aucun `/sitemap/*.xml`**.
- **Preuve live (17:49 UTC, deploy atterri 14:57)** : `sitemap/faq.xml` = 97 URLs = **exactement** les 88 FAQ legacy FS (`FAQ_GLOBAL`, comptées 88 dans `src/content/transversal.ts:148-5158`) + 9 URLs `par-thematique` (catégories dérivables du legacy seul). Zéro slug DB supplémentaire ~3 h après le deploy — compatible avec un rendu stub-baké OU avec une table `faqs` publiée vide/entièrement dédupliquée. **Indécidable sans DB (A2 non autorisé SELECT)**.
- **Root-cause** : `faq` est resté dans `generateSitemaps()` quand blog/presse/knowledge ont migré ; le job warm (#599) ne revalide que des pages, pas des sitemaps.
- **Patch prescrit** : (1) demander à A3 de confirmer côté DB : `SELECT count(*) FROM faqs WHERE status='published' AND slug IS NOT NULL AND "indexationTier"='tier_1_indexable'` et diff avec les 88 ids legacy ; (2) si > 0 slugs DB-only : migrer `faq` vers un Route Handler runtime `/sitemap-faq.xml` (copier le pattern `sitemap-blog.xml/route.ts` : `force-dynamic`, réutilise `sitemap({id:"faq"})`, entrée `CUSTOM_SITEMAPS` gatée anti-vide, retrait de l'ID de `generateSitemaps()`).
- **Effort** : M (~1 h, pattern déjà écrit 3 fois). **Impact GEO/AEO** : moyen-fort si des Q/R DB-only existent (QAPage = surface AEO primaire), nul sinon. **Risque de régression** : faible — do-not-touch : `buildExcludeSlugsByType` (dédup KB), le `case "faq"` du switch (le handler le réutilise), le gate anti-vide de l'index.

### [P2] `guides.xml` : sub-sitemap redondant à 1 URL, lastmod figé au 2026-06-08 pour toujours

- **Symptôme** : `guides.xml` contient uniquement `/fr/guides`, déjà déclarée dans `pages.xml` (doublon vérifié live). Son lastmod dans l'index = `2026-06-08T00:00:00.000Z` (seule entrée aussi ancienne) car la famille `guides` est ABSENTE de `FAMILIES` dans `scripts/gen-content-freshness.mjs:49-69` → fallback `EDITORIAL_BASELINE` à vie, alors que le hub change à chaque guide publié (9 guides actuellement).
- **Preuve code** : `sitemap.ts:1094-1108` (hub only) + TODO l.1059-1060 (« passer à max(publishedAt) DB ») ; `gen-content-freshness.mjs:49-69` (pas de clé `guides`). **Preuve live (17:48 UTC)** : index → `/sitemap/guides.xml 2026-06-08T00:00:00.000Z` ; fichier → 1 `<loc>`.
- **Patch prescrit** : au choix (a) retirer l'ID `guides` de `generateSitemaps()` (le hub reste dans pages.xml — supprime doublon ET lastmod menteur d'un coup), ou (b) mapper `guides.xml` → `lastmods.blog` dans `lastmodForGeneratedId` (`sitemap-index.xml/route.ts:209-222`) puisque le hub suit les publications d'articles-guides. Option (a) préférée (moins de code).
- **Effort** : S. **Impact** : faible. **Risque** : GSC verra disparaître un sub-sitemap (1 URL, sans historique de valeur) — négligeable ; do-not-touch : l'émission des guides dans `buildBlogSitemap` (`sitemap.ts:881-890`).

### [P2] 7 URLs double-déclarées entre `pages.xml` et les sub-sitemaps dédiés

- **Symptôme** : dédup globale sur les 26 sitemaps statiques + blog fetchés (17:49–17:53 UTC) → 7 doublons : `/fr/formations`, `/fr/formations/entreprise`, `/fr/formations/metiers`, `/fr/formations/secteurs`, `/fr/formations/tarifs` (pages.xml × formations.xml), `/fr/guides` (pages.xml × guides.xml), `/fr/implantations` (pages.xml × implantations.xml).
- **Preuve code** : les hubs formations sont émis par `buildFormationsSitemap` (`sitemap.ts:1333-1360`) ET par `buildPagesSitemap` (clés `routing.pathnames` non exclues) ; le précédent V-11 (`sitemap.ts:196-199`) a traité exactement ce cas pour `/glossaire` (retiré de pages.xml).
- **Root-cause** : les clés formations/implantations/guides n'ont pas suivi le précédent V-11 quand leurs sub-sitemaps dédiés ont été créés.
- **Patch prescrit** : ajouter `/formations`, `/formations/entreprise`, `/formations/tarifs`, `/formations/metiers`, `/formations/secteurs`, `/implantations` (et `/guides` si l'option (a) du finding précédent n'est pas retenue) à `EXCLUDED_FROM_INDEX` avec un commentaire de type V-11. Attention : NE PAS retirer du sub-sitemap dédié (c'est là qu'ils sont canoniques pour le diagnostic GSC).
- **Effort** : S. **Impact** : faible (Google tolère, mais Search Console double-compte et le code s'est fixé lui-même ce standard). **Risque** : nul si l'exclusion vise pages.xml seulement ; do-not-touch : `buildFormationsSitemap`, `buildImplantationsHubSitemap`.

### [P2] Lastmod d'index en fallback « pages » pour 8 sitemaps custom → quasi-BUILD_TIME réintroduit sur ces entrées

- **Symptôme** : dans l'index, `sitemaps/images-fr.xml`, `sitemap-images-services.xml`, `sitemap-images-villes-t1/t2/t3-t4.xml`, `sitemap-recrutement.xml`, `sitemap-carrieres.xml`, `sitemap-presse.xml`, `sitemap-avis.xml` portent TOUS `2026-08-14T13:56:27.000Z` = la date de fraîcheur de la famille `pages`. Or cette famille couvre `src/content` + `src/app/[locale]` entiers (`gen-content-freshness.mjs:68`) → elle avance à presque chaque deploy. Pour ces 8 entrées (plus `pages.xml` lui-même), le signal lastmod redevient de facto un BUILD_TIME — le date-gaming que l'audit 2026-06-08 avait éliminé.
- **Preuve code** : `sitemap-index.xml/route.ts:159-161` (`getFallbackLastmod()` = famille `pages`) + `:319-332` (les customs hors news/knowledge/blog → `lastmods.fallback`). **Preuve live (17:48 UTC)** : 9 entrées d'index à la même seconde `13:56:27`.
- **Patch prescrit** : différencier — presse → `MAX(publishedAt)` PressRelease, carrieres → `MAX(updatedAt)` offres, avis → `MAX(publishedAt)` avis (queries fail-soft comme `getDifferentiatedLastmod`), images-villes/services/recrutement → constante ou famille dédiée (`villes` pour images-villes). Alternative minimale : restreindre la famille `pages` à `src/app/[locale]` hors sous-arbres à sitemap dédié.
- **Effort** : M. **Impact** : faible-moyen (crédibilité du signal lastmod de l'index entier — Google désactive le signal quand trop d'entrées bougent ensemble, cf. le propre historique du fichier `:132-152`). **Risque** : faible, queries fail-soft obligatoires (l'index ne doit JAMAIS 500 — doctrine `:241-247`) ; do-not-touch : le gating anti-vide, `editorialLastmodForSitemapId`.

### [P2] Anti-vide structurel absent pour les chunks `villes-<region>` (non déclenché à ce jour)

- **Symptôme** : `getVillesSitemapIds()` déclare un chunk dès qu'une région a ≥ 1 ville **avec copy** (`sitemap.ts:331-349`), mais le contenu filtre en plus sur `isVilleIndexable` = `RANKED_INDEXABLE` (villes uniques, `sitemap.ts:1463-1464` + `src/content/villes/index.ts:317-320`). Une région dont toutes les villes à copy seraient des quasi-doublons (hors `RANKED_INDEXABLE`) produirait un `<urlset>` VIDE listé dans l'index — le flag GSC « Balise XML manquante : url » que le gating combat partout ailleurs.
- **Preuve live (17:53 UTC)** : non déclenché — les 13 chunks émettent tous ≥ 2 URLs (min : `villes-corse` = 2 ; total 480 URLs FR, 0 EN). Finding structurel, pas d'impact actuel.
- **Patch prescrit** : dans `getVillesSitemapIds()`, baser le compte sur `withCopy.filter(v => isVilleIndexable(v.slug))` — depuis le retrait du drip (P0 2026-06-14, `isVilleIndexable` est devenu statique/déterministe), la « structure stable » des IDs n'est plus menacée par un filtre temporel.
- **Effort** : S. **Impact** : faible (préventif). **Risque** : faible — un chunk disparaîtrait de l'index si une région perdait toutes ses villes uniques (comportement voulu) ; do-not-touch : `buildVillesByRegionSitemap`, `RANKED_INDEXABLE`.

### [P2] Hygiène : commentaires périmés + exports contradictoires + Cache-Control servi ≠ code

- (a) **Commentaires mensongers** dans `sitemap.ts` : l.76 « 12 régions indexable (Corse noindex) » et l.1419 « 12 métropole en V1, Corse reste noindex » — FAUX depuis que `regions.ts` met Corse ET les 5 DROM en `noindex: false` (`src/content/regions.ts:467,504,535,566,597,628`) : l'index liste `villes-corse.xml` et `implantations.xml` porte 19 URLs (hub + 18 régions, vérifié live 17:49 UTC). Idem l.116-121 (« drip +50/jour, la cohorte s'élargit toute seule ») — le drip est retiré depuis le 2026-06-14 (`villes/index.ts:308-320`). Un futur agent/dev peut prendre de mauvaises décisions sur la foi de ces commentaires (le présent audit a failli signaler Corse comme fuite).
- (b) `sitemap-index.xml/route.ts:124-125` exporte `dynamic = "force-dynamic"` ET `revalidate = 600` — le second est inerte sous force-dynamic (le cache est porté par les headers CDN). Dead code trompeur.
- (c) **Cache-Control servi ≠ code** : le code émet `max-age=300, s-maxage=600` (`route.ts:354`) mais la prod sert `max-age=3600, s-maxage=600` sur l'index ET les sub-sitemaps (mesuré 18:09 UTC, `cf-cache-status: HIT`, chaîne introuvable dans le repo → réécriture Caddy/Cloudflare côté plateforme). Sans impact crawl (s-maxage CDN = 600 respecté), mais à documenter pour éviter un futur faux diagnostic.
- **Patch prescrit** : (a) corriger 3 blocs de commentaires ; (b) supprimer l'export `revalidate` inerte ; (c) tracer la réécriture d'en-tête (config Caddy/CF) et l'annoter dans `route.ts`. **Effort** : S. **Impact** : faible (dette de compréhension). **Risque** : nul (doc/dead code uniquement).

## Mesures brutes

Toutes mesures via `curl` GET, UTC. Deploy stable de référence atterri ~14:57 UTC ; deploy suivant en vol (non atterri pendant les mesures).

### Sitemap-index (17:48:47)

| Mesure | Valeur |
|---|---|
| `/sitemap-index.xml` | 200, 0,356 s, 38 `<sitemap>` |
| `/sitemap.xml` | 308 → `/sitemap-index.xml` (18:06) |
| `robots.txt` → `Sitemap:` | `https://axion-ia.com/sitemap-index.xml` (18:06) |
| Gating vérifié | `sitemap-news.xml` ABSENT de l'index (urlset vide valide servi en direct, 171 o, 18:09) ; `sitemap-presse.xml` PRÉSENT (1 communiqué) ; `images-en.xml` ABSENT (EN off) |
| IDs non déclarés | `/sitemap/knowledge-1.xml`, `/sitemap/blog.xml`, `/sitemap/presse.xml`, `/sitemap/foo.xml` → 404 (18:09) |
| Cache | code `max-age=300, s-maxage=600` ; servi `max-age=3600, s-maxage=600`, `cf-cache-status: HIT`, Age 1243 (18:09) |

### Sub-sitemaps statiques (17:49:34)

| Sitemap | HTTP | URLs | Réfs `/en/` | Lastmod (index) | Attendu / commentaire |
|---|---|---|---|---|---|
| pages | 200 | 85 | 0 | 2026-08-14T13:56:27 | 1 seule URL noindex (finding P1) ; hreflang fr+x-default OK ; `/fr/equipe/williams` présent ; pages Qualiopi présentes et `index,follow` (flags Phase B actifs — conforme) |
| faq | 200 | 97 | 0 | 2026-08-10T18:07:44 | = 88 slugs (exactement les 88 legacy `FAQ_GLOBAL`) + hub + 8 catégories — zéro slug DB-only (finding P1 À CONFIRMER) |
| help | 200 | 12 | 0 | 2026-08-13T18:19:25 | 6 articles + 6 catégories ✓ |
| cas-concrets | 200 | 10 | 0 | 2026-05-24T09:18:53 | fraîcheur honnête (famille inchangée) ✓ |
| comparaisons | 200 | 3 | 0 | 2026-06-22T09:40:36 | = 3 slugs source ✓ |
| guides | 200 | 1 | 0 | 2026-06-08T00:00:00 | hub only (design) ; doublon pages.xml + lastmod figé (P2) |
| glossaire | 200 | 1 | 0 | 2026-08-04T07:30:10 | hub only — 60 termes absents (P1) |
| implementation | 200 | 8 | 0 | 2026-08-04T07:30:10 | = 8 slugs automatisations ✓ |
| implantations | 200 | 19 | 0 | 2026-08-13T12:24:03 | hub + 18 régions (12 métro + Corse + 5 DROM) ✓ |
| stack-ia-tools | 200 | 11 | 0 | 2026-07-04T07:53:49 | = 11 outils ✓ |
| secteurs | 200 | 61 | 0 | 2026-06-21T09:56:15 | hub + 10 piliers + 50 croisées ✓ |
| formations | 200 | 27 | 0 | 2026-08-13T07:33:23 | 3 hubs + 2 listings + 22 fiches ✓ (5 doublons vs pages.xml, P2) |

### Chunks villes (17:53:55)

| Chunk | URLs | | Chunk | URLs |
|---|---|---|---|---|
| ile-de-france | 177 | | normandie | 14 |
| auvergne-rhone-alpes | 57 | | bourgogne-franche-comte | 12 |
| provence-alpes-cote-d-azur | 41 | | centre-val-de-loire | 12 |
| hauts-de-france | 40 | | bretagne | 11 |
| nouvelle-aquitaine | 39 | | corse | 2 |
| occitanie | 29 | | **Total** | **480** (0 `/en/`) |
| grand-est | 23 · pays-de-la-loire 23 | | | |

Aucun chunk vide ; aucun chunk multi-parties (`-N`) nécessaire aux volumes actuels. Pas de villes DROM en données (`src/content/villes/data/` = 13 fichiers métropole) → pas de trou de découverte.

### Échantillon live (statuts + robots)

- 85/85 URLs de `pages.xml` : 200, `index,follow` sauf `/fr/demande-devis/confirmation` (noindex) — scan 17:52:33→17:53:40.
- 49 URLs échantillonnées (faq, help ×12, cas-concrets, secteurs, stack-ia, formations, implantations DROM ×6, villes dont corse ×2 + idf ×4) : **49/49 en 200 + indexables** — 18:04:29→18:06:23.
- Doublons inter-sitemaps (dédup globale) : 7 URLs (cf. finding P2).
- `sitemap-blog.xml` (17:52) : 134 URLs dont 9 `/guides/` et 5 `/blog/categorie/blog-*` ; 0 URL de taxonomie supprimée (tag/auteur/secteur/taille/service — code d'émission encore présent `sitemap.ts:898-931` mais inerte car `BLOG_POSTS` vidé → getters retournent `[]`, cohérent avec les 301 `next.config.ts:260-264`).

## Limites

1. **DB prod non autorisée pour A2** (liste : A3, B6, D1, D5, D8, F7) → impossible de trancher si la table `faqs` contient des slugs publiés hors des 88 legacy. Le finding faq.xml est marqué [À CONFIRMER] avec la requête exacte à exécuter — **handoff A3**, qui doit aussi vérifier si les deux listes du job `warm` devraient couvrir des sitemaps.
2. **GSC inaccessible** (audit read-only, pas de navigateur) : l'impact réel des findings (buckets « noindexed URL in sitemap », couverture) n'est pas mesuré côté Google.
3. **Fenêtre de mesure unique** (17:48–18:09 UTC, un seul deploy de référence) : le comportement de `faq.xml` juste après un atterrissage de deploy (fenêtre stub) n'a pas pu être observé en direct — le deploy en vol atterrissait après la clôture des mesures.
4. Contenus détaillés des sitemaps DB-driven (blog/news/knowledge/carrieres/avis/presse : volumes vs DB) = **A3** ; sitemaps images (`<image:loc>` valides) = **A4** ; je n'ai vérifié que leur présence/gating dans l'index.
5. `pages.xml` : le compte attendu exact (137 clés routing − exclusions − templates − gated + williams = 85) n'a pas été recalculé clé par clé ; le scan live exhaustif (85/85 en 200) couvre le risque résiduel.
