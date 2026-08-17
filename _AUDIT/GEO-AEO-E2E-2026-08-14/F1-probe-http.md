# F1 — Probe HTTP exhaustive

- **Date/heure des mesures** : 2026-08-14, 18:57:03 → 19:03:28 UTC (chaque ligne horodatée).
- **Périmètre réellement couvert** : robots.txt, ai.txt, llms.txt, llms-full.txt, `.well-known/ai-policy.json`, `.well-known/security.txt` (+ `/security.txt` racine), `sitemap-index.xml` + les **38 sub-sitemaps** qu'il déclare + les 2 sub-sitemaps gatés hors index (`sitemap-news.xml`, `sitemaps/images-en.xml`), les **7 feeds** RSS/JSON, `/api/markdown/` sur **6 types** (5 avec slug réel + guides sans contenu publié), **15 pages stratégiques** (+ variantes de redirection), plus sondes ciblées (glossaire, FAQ Track B). GET/HEAD uniquement, UA `AxionAuditF1/1.0`.

## ⚠️ Contexte deploy (à lire avant d'interpréter)

Vérifié via `gh run view 31824504716 --json jobs` à 18:56 UTC :

- Dernier deploy **atterri ~18:26 UTC** (job « Trigger Coolify deploy » terminé 18:26:02Z ; purge CF = step de ce job ; job `warm` 18:26:04→18:35:25 ; LHCI vert 18:36:04). Le « 18:36 » annoncé dans le brief = fin du workflow complet, pas l'atterrissage.
- Run 31829452492 (18:36 UTC) : **cancelled** après 18m45s.
- Run 31830868520 (**in progress**, parti 18:54:44 UTC, commit L5 CRM) : atterrissage estimé ~19:55+ UTC — **postérieur à toutes mes mesures**, aucune interférence.
- **Toutes mes mesures tombent dans la fenêtre post-deploy ≤ 1 h** (31–37 min après 18:26). Malgré cela, **aucun sitemap DB-driven n'était vide** (le job `warm` + `force-dynamic` de l'index ont fait leur travail) — aucun finding ci-dessous ne repose sur un contenu vide de fenêtre ISR.
- Build servi pendant les mesures : `x-axion-build-sha: 99ba93a0` (= commit du push 17:33, « feat(L4) consentements v2 »).

## Résumé exécutif

La surface HTTP GEO/AEO est **globalement saine** : 40/40 sitemaps répondent 200 en < 0,55 s, XML valides, index gaté proprement (news vide et images-en exclus), lastmod différenciés par famille, 7/7 feeds valides (XML + JSON), zéro `x-robots-tag` parasite, fichiers de politique IA tous 200 et cohérents. **Mais le canal d'ingestion markdown pour LLM est cassé sur 3 des 8 types qui l'annoncent** : `centre-aide` → 404 sur 100 % des fiches, `cas-concrets` → 200 avec corps **vide**, `glossaire` → 404 « Unknown content type » (type jamais enregistré). C'est la même classe de bug que le fix FAQ du 2026-08-10 (source de la page ≠ source de l'API). Par ailleurs `guides.xml` et `glossaire.xml` ne déclarent toujours qu'**1 URL chacun** (bug connu 2026-07-20, non résolu), et le `max-age` navigateur des sitemaps est réécrit 300→3600 à l'edge.

## Findings

### [P1] `/api/markdown/centre-aide/*` répond 404 sur 100 % des fiches publiées (canal annoncé mais mort)

- **Symptôme** : les 12 pages `/fr/centre-aide/<slug>` (déclarées dans `sitemap/help.xml`) annoncent un alternate markdown qui répond 404 — les crawlers LLM qui suivent le lien tombent sur `Not found`.
- **Preuve code** :
  - `src/app/[locale]/centre-aide/[slug]/page.tsx:133` — émet `<link rel="alternate" type="text/markdown" href="/api/markdown/centre-aide/${slug}">`.
  - La page publique lit `@/lib/help-articles/reader` (contenu éditorial statique, `page.tsx:20`).
  - `src/app/api/markdown/[type]/[slug]/route.ts:157-174` — la branche `centre-aide` interroge `prisma.helpArticleTranslation` (table vide/non peuplée pour ces fiches) → `null` → 404.
  - Même classe de bug que celui corrigé pour FAQ le 2026-08-10 (commentaire `route.ts:177-183` : « chaque fiche éditoriale annonçait aux crawlers LLM une ressource qui répondait 404 »). Le fix FAQ n'a pas été étendu à centre-aide.
- **Preuve live** (horodatée) : 18:59:30Z `GET /api/markdown/centre-aide/preparer-une-intervention` → **404** (49 o, « Not found ») ; ~19:01Z `GET /api/markdown/centre-aide/perimetre-audit-ia` → **404** (42 o). Indépendant de la fenêtre post-deploy (contenu éditorial statique, résultat déterministe).
- **Root-cause** : divergence de source — la page lit le reader éditorial, l'API lit une table Prisma non peuplée.
- **Patch prescrit** : dans `route.ts`, branche `centre-aide`, lire la MÊME source que la page (`@/lib/help-articles/reader`), avec fallback DB pour `updatedAt` — calquer exactement le pattern du fix FAQ (`route.ts:176-201`).
- **Effort** : S. **Impact GEO/AEO** : fort (canal d'ingestion LLM annoncé dans le HTML et dans la doctrine llms.txt, mais 404 sur tout le centre d'aide — signal de fiabilité négatif pour les crawlers IA).
- **Risque de régression** : faible. **Do-not-touch** : branches `blog`/`actualites`/`faq` du même fichier (fonctionnelles, vérifiées live), `resolvePriceTokens` (décision actée n°4), contrat stub.invalid.

### [P1] `/api/markdown/cas-concrets/*` répond 200 mais avec un corps VIDE (pire qu'un 404)

- **Symptôme** : l'API sert un document markdown « réussi » ne contenant que le titre + le footer — zéro contenu. Un LLM l'ingère sans erreur et conclut que la page est vide.
- **Preuve code** :
  - `src/app/api/markdown/[type]/[slug]/route.ts:134-155` — branche `cas-concrets` lit `prisma.caseStudyTranslation` avec `body: bodyText ?? body ?? ""` (fallback chaîne vide, ligne 148-151).
  - La page publique lit `@/content/case-studies` (`src/app/[locale]/cas-concrets/[slug]/page.tsx:15`, `getCaseStudy`) — contenu statique riche (contexte/solution/résultats).
  - `page.tsx:119` annonce l'alternate markdown.
- **Preuve live** : 18:59:29Z `GET /api/markdown/cas-concrets/industrie-comptabilite` → **200**, **293 octets** ; corps intégral relevé = `# Industriel · -32% temps administratif comptable` + footer Source/Last modified — aucun contenu entre les deux. (La row DB existe — le titre en vient — mais body/bodyText vides.)
- **Root-cause** : même divergence de source que centre-aide ; le fallback `?? ""` masque le vide en 200 au lieu de 404.
- **Patch prescrit** : brancher la branche `cas-concrets` sur `@/content/case-studies` (composer le markdown depuis les champs structurés du cas), et/ou retourner 404 si le corps résolu est vide (garde anti-« 200 vide »).
- **Effort** : S-M. **Impact GEO/AEO** : fort (les cas concrets sont le contenu preuve-sociale le plus citable ; servi vide aux LLM).
- **Risque de régression** : faible. **Do-not-touch** : décision actée n°8 (obligation de moyens — ne pas reformuler les résultats chiffrés en garanties), branches fonctionnelles du fichier.

### [P1] Type `glossaire` annoncé en alternate markdown mais jamais enregistré → 404 systématique

- **Symptôme** : chaque page `/fr/glossaire/<slug>` (des dizaines, live 200) annonce `/api/markdown/glossaire/<slug>` qui répond 404 « Unknown content type: glossaire ».
- **Preuve code** :
  - `src/app/[locale]/glossaire/[slug]/page.tsx:192` — émet le link alternate `type="text/markdown"` vers `/api/markdown/glossaire/${slug}`.
  - `src/app/api/markdown/[type]/[slug]/route.ts:48-55` — `ALLOWED_TYPES = {blog, actualites, guides, cas-concrets, centre-aide, faq}` : **`glossaire` absent** → 404 dès la garde `route.ts:243-248`.
- **Preuve live** : 19:01:18Z `GET /fr/glossaire/agent` → **200** ; 19:01:19Z `GET /api/markdown/glossaire/agent` → **404**, corps « Unknown content type: glossaire ».
- **Root-cause** : le link alternate a été ajouté aux pages glossaire sans implémenter le type côté API.
- **Patch prescrit** : ajouter `glossaire` à `ALLOWED_TYPES` + un loader lisant la même source que la page glossaire (à localiser par l'agent qui patchera — probablement contenu statique comme cas-concrets) ; à défaut, retirer le link alternate de `page.tsx:192` (moins bon pour GEO).
- **Effort** : S. **Impact GEO/AEO** : moyen-fort (le glossaire est un aimant à citations IA ; promesse cassée sur toutes ses fiches).
- **Risque de régression** : faible. **Do-not-touch** : idem findings précédents.

### [P1] `guides.xml` et `glossaire.xml` déclarent toujours 1 seule URL (le hub) — enfants absents (cross-ref A2)

- **Symptôme** : le bug connu du 2026-07-20 (« 1 URL chacun ») est **toujours présent** : les fiches enfants ne sont déclarées dans aucun sitemap.
- **Preuve live** : 18:57:53Z `sitemap/guides.xml` → 200, **1 URL** (`/fr/guides` seul) ; 18:57:54Z `sitemap/glossaire.xml` → 200, **1 URL** (`/fr/glossaire` seul). Or 19:01:18Z `/fr/glossaire/agent` → 200 (et le hub liste des dizaines de fiches : ab-test-llm, agent, ai-act, batching, benchmark-mmlu…). Aucune URL `/fr/glossaire/<slug>` ni `/fr/guides/<slug>` dans les 2 603 URLs des 38 sub-sitemaps téléchargés.
- **Preuve code** : [À CONFIRMER par A2] — la root-cause vit dans `src/app/sitemap.ts` (builders des ids `guides`/`glossaire`) ; F1 fournit la mesure live, A2 doit confirmer le mécanisme (et si une exclusion volontaire existe).
- **Patch prescrit** : côté A2 — faire émettre les enfants par les builders `guides`/`glossaire` (ou documenter l'exclusion si volontaire).
- **Effort** : M. **Impact GEO/AEO** : fort (découvrabilité de tout le glossaire dépend du seul maillage interne).
- **Risque de régression** : moyen (volume d'URLs ajouté d'un coup ; vérifier `buildExcludeSlugsByType`). **Do-not-touch** : gating anti-vide de `sitemap-index.xml/route.ts`.

### [P2] `max-age` navigateur des sitemaps réécrit 300 → 3600 à l'edge [À CONFIRMER mécanisme]

- **Symptôme** : le code émet `max-age=300` mais la prod sert `max-age=3600` (les autres directives `s-maxage=600, stale-while-revalidate=3600` sont intactes).
- **Preuve code** : `src/app/sitemap-index.xml/route.ts:354` = `public, max-age=300, s-maxage=600, swr=3600` — **vérifié présent dans le sha déployé** (`git show 99ba93a0:…` → max-age=300, ligne 354) ; idem `next.config.ts:704-720` pour `/sitemap.xml` + `/sitemap/:path*`.
- **Preuve live** : 18:57:08Z `sitemap-index.xml` → `Cache-Control: public, max-age=3600, s-maxage=600, swr=3600`, `cf-cache-status: HIT` ; même réécriture sur `sitemap/pages.xml`, `sitemap-blog.xml`, etc. (18:57-18:58Z). À l'inverse, les feeds en `cf=MISS` conservent leur max-age d'origine (900/300/600).
- **Root-cause probable** : réglage zone Cloudflare « Browser Cache TTL = 1 h » appliqué aux réponses servies depuis le cache edge. [À CONFIRMER — accès dashboard CF requis, hors périmètre F1.]
- **Patch prescrit** : vérifier le réglage CF Browser Cache TTL et le passer à « Respect Existing Headers ».
- **Effort** : S (réglage plateforme, zéro code). **Impact GEO/AEO** : faible (Googlebot suit son propre agenda ; seuls les re-fetch rapprochés de crawlers respectant max-age sont retardés de 55 min).
- **Risque de régression** : faible. **Do-not-touch** : aucun fichier repo.

### [P2] `/fr/faq/feed.xml` : 1,15 Mo / 1 550 items — et expose ~1 450 URLs FAQ hors sitemap [À CONFIRMER si curation volontaire]

- **Symptôme** : le feed FAQ pèse 1 154 175 octets avec 1 550 items (les 6 autres feeds : 2–46 Ko, 5–50 items). 1 551 `<link>` uniques dont la quasi-totalité de type Track B (`/fr/faq/mentor-ia-dirigeant-grenoble-…`) alors que `sitemap/faq.xml` ne déclare que 97 URLs.
- **Preuve live** : 18:59:24Z feed → 200, 1 154 175 o, 1 550 `<item>`, XML valide ; 19:03:28Z spot-check `/fr/faq/mentor-ia-dirigeant-grenoble-qu-est-ce-qu-un-mentor-ia-pour-dirigeant` → **200** (page réelle, absente des sitemaps).
- **Preuve code** : [À CONFIRMER par A5/B] — `src/app/[locale]/faq/feed.xml/route.ts` (source du corpus) vs builder `faq` de `sitemap.ts` (97 URLs = probable curation anti-thin-content volontaire).
- **Root-cause** : le feed publie le corpus intégral (éditorial + Track B) quand le sitemap est curé — incohérence de périmètre entre les deux canaux de découverte.
- **Patch prescrit** : décision à arbitrer (A5) : soit caper le feed aux N derniers items / au corpus curé, soit assumer le canal large. Pas de patch unilatéral.
- **Effort** : S. **Impact GEO/AEO** : moyen (coût d'ingestion du feed ; incohérence de signaux).
- **Risque de régression** : moyen si on retire des items déjà consommés par des agrégateurs. **Do-not-touch** : le fix markdown FAQ du 2026-08-10 (dépend de `listFaqs()`).

### [P2] Page 404 servie à ~707 Ko

- **Symptôme** : toute URL inexistante reçoit ~707 Ko de HTML (page 404 complète avec payload RSC).
- **Preuve live** : 18:57:07Z `GET /security.txt` (racine, non déclaré — seul `.well-known/` compte, RFC 9116) → 404 avec **707 130 octets** téléchargés.
- **Preuve code** : non investigué (page not-found globale) — [À CONFIRMER par squad E/Web Vitals si déjà connu].
- **Patch prescrit** : alléger la page 404 (elle est crawlée massivement par les bots qui sondent des chemins).
- **Effort** : M. **Impact GEO/AEO** : faible (budget crawl marginal). **Risque de régression** : faible.

### [P2] Poids HTML très élevés sur les hubs stratégiques (mesure pour squads E/perf)

- **Mesures live 18:59 + 19:03 UTC (brut / gzip)** : `/fr/implantations` = **8 792 194 o / 680 567 o gz** ; `/fr/implantations/auvergne-rhone-alpes` = 2 758 380 / 175 917 ; `/fr/appel` = 2 087 257 / 158 646 ; `/fr/audit` = 2 079 159 / 184 818 ; `/fr` = 1 577 128 / 124 404 ; `/fr/glossaire` = 1 230 387 / 98 866.
- F1 livre la mesure ; l'arbitrage budget (LCP/ingestion LLM — un crawler IA qui parse 8,8 Mo de HTML pour une page hub) appartient aux squads E/G. Aucun `x-robots-tag` ni problème de status sur ces pages.

## Mesures brutes

### 1. Fichiers de politique (18:57:03–18:57:08 UTC)

| URL | Status | Taille (o) | Temps (s) | Notes |
|---|---|---|---|---|
| /robots.txt | 200 | 5 952 | 0,080 | `Sitemap: https://axion-ia.com/sitemap-index.xml` ; `Allow: /api/og`, `/api/avis/photo`, `/api/markdown/` présents ; `Disallow: /logos/clients/` présent ; 48 lignes `Disallow: /en/…` |
| /ai.txt | 200 | 2 563 | 1,281 | |
| /llms.txt | 200 | 10 499 | 1,166 | En-tête sain (disambiguation axionai.fr, langue FR canonique, pointeur llms-full) |
| /llms-full.txt | 200 | 136 905 | 0,756 | |
| /.well-known/ai-policy.json | 200 | 1 647 | 0,114 | **JSON valide** |
| /.well-known/security.txt | 200 | 214 | 0,115 | Expires 2027-05-16 (valide), Canonical OK |
| /security.txt (racine) | 404 | 707 130 | 0,379 | Normal (RFC 9116 = .well-known) ; cf. P2 poids 404 |
| /sitemap-index.xml | 200 | 5 293 | 0,138 | 38 sub-sitemaps ; cf=HIT, Age=1863 (généré 18:26 = warm post-deploy) ; lastmod différenciés (8+ valeurs distinctes) |

### 2. Sub-sitemaps — 40/40 en 200 (18:57:48–18:58:20 UTC)

Tous `cf-cache-status: HIT`. « lastmod max » = plus récent `<lastmod>` du fichier.

| Sitemap | Status | URLs | `<image:loc>` | lastmod max | Taille (o) | Temps (s) | Age (s) |
|---|---|---|---|---|---|---|---|
| /sitemap/pages.xml | 200 | 86 | 0 | 2026-08-14T17:33 | 31 204 | 0,091 | 561 |
| /sitemap/faq.xml | 200 | 97 | 0 | 2026-08-10 | 37 808 | 0,115 | 561 |
| /sitemap/help.xml | 200 | 12 | 0 | 2026-08-13 | 5 196 | 0,083 | 561 |
| /sitemap/cas-concrets.xml | 200 | 10 | 0 | 2026-05-24 | 4 230 | 0,074 | 562 |
| /sitemap/comparaisons.xml | 200 | 3 | 0 | 2026-06-22 | 1 446 | 0,076 | 562 |
| /sitemap/guides.xml | 200 | **1** | 0 | 2026-06-08 | 482 | 0,088 | 562 |
| /sitemap/glossaire.xml | 200 | **1** | 0 | 2026-08-04 | 492 | 0,102 | 563 |
| /sitemap/implementation.xml | 200 | 8 | 0 | 2026-08-04 | 3 744 | 0,085 | 563 |
| /sitemap/implantations.xml | 200 | 19 | 0 | 2026-08-13 | 7 575 | 0,078 | 563 |
| /sitemap/stack-ia-tools.xml | 200 | 11 | 0 | 2026-07-04 | 4 140 | 0,079 | 563 |
| /sitemap/secteurs.xml | 200 | 61 | 0 | 2026-06-21 | 26 055 | 0,106 | 564 |
| /sitemap/formations.xml | 200 | 27 | 0 | 2026-08-13 | 10 995 | 0,083 | 564 |
| /sitemap/villes-auvergne-rhone-alpes.xml | 200 | 57 | 0 | 2026-08-13 | 25 809 | 0,096 | 564 |
| /sitemap/villes-bourgogne-franche-comte.xml | 200 | 12 | 0 | 2026-08-13 | 5 532 | 0,095 | 565 |
| /sitemap/villes-bretagne.xml | 200 | 11 | 0 | 2026-08-13 | 4 602 | 0,078 | 565 |
| /sitemap/villes-centre-val-de-loire.xml | 200 | 12 | 0 | 2026-08-13 | 5 457 | 0,079 | 565 |
| /sitemap/villes-corse.xml | 200 | 2 | 0 | 2026-08-13 | 936 | 0,081 | 566 |
| /sitemap/villes-grand-est.xml | 200 | 23 | 0 | 2026-08-13 | 9 726 | 0,094 | 565 |
| /sitemap/villes-hauts-de-france.xml | 200 | 40 | 0 | 2026-08-13 | 17 361 | 0,075 | 566 |
| /sitemap/villes-ile-de-france.xml | 200 | 177 | 0 | 2026-08-13 | 76 893 | 0,092 | 566 |
| /sitemap/villes-normandie.xml | 200 | 14 | 0 | 2026-08-13 | 6 069 | 0,079 | 567 |
| /sitemap/villes-nouvelle-aquitaine.xml | 200 | 39 | 0 | 2026-08-13 | 17 235 | 0,103 | 567 |
| /sitemap/villes-occitanie.xml | 200 | 29 | 0 | 2026-08-13 | 11 976 | 0,094 | 568 |
| /sitemap/villes-pays-de-la-loire.xml | 200 | 23 | 0 | 2026-08-13 | 10 236 | 0,092 | 568 |
| /sitemap/villes-provence-alpes-cote-d-azur.xml | 200 | 41 | 0 | 2026-08-13 | 19 230 | 0,102 | 568 |
| /sitemap-blog.xml | 200 | 134 | 0 | 2026-08-11 | 59 246 | 0,079 | 1900 |
| /sitemap-news-evergreen.xml | 200 | 32 | 0 | 2026-07-20 | 7 169 | 0,212 | 569 |
| /sitemap-knowledge.xml | 200 | 507 | 0 | 2026-08-11 | 223 152 | 0,120 | 570 |
| /sitemaps/images-fr.xml | 200 | 289 | 288 | 2026-08-14T16:33 | 310 501 | 0,118 | 1918 |
| /sitemap-images-services.xml | 200 | 54 | 141 | (aucun lastmod) | 81 295 | 0,094 | 590 |
| /sitemap-images-blog.xml | 200 | 129 | 129 | 2026-08-11 | 87 328 | 0,099 | 1450 |
| /sitemap-images-villes-t1.xml | 200 | 40 | 40 | (aucun lastmod) | 28 033 | 0,069 | 1931 |
| /sitemap-images-villes-t2.xml | 200 | 83 | 83 | (aucun lastmod) | 58 124 | 0,075 | 571 |
| /sitemap-images-villes-t3-t4.xml | 200 | 357 | 357 | (aucun lastmod) | 250 069 | 0,104 | 1599 |
| /sitemap-recrutement.xml | 200 | 3 | 0 | 2026-08-12 | 684 | 0,072 | 571 |
| /sitemap-carrieres.xml | 200 | 55 | 54 | 2026-08-13 | 29 564 | 0,070 | 571 |
| /sitemap-presse.xml | 200 | 1 | 0 | 2026-07-14 | 752 | 0,076 | 572 |
| /sitemap-avis.xml | 200 | 103 | 0 | 2026-07-06 | 21 674 | 0,077 | 571 |
| /sitemap-news.xml (hors index) | 200 | **0** | 0 | — | 171 | 0,073 | 571 | 
| /sitemaps/images-en.xml (hors index) | 200 | **0** | 0 | — | 222 | 0,082 | 572 |

**Total : 2 603 URLs** déclarées dans les 38 sub-sitemaps de l'index (+ 1 102 `<image:loc>`). Gating conforme : les 2 seuls urlset vides (`news` en creux 48 h, `images-en` EN désactivé) sont bien **exclus** de l'index — cohérent avec `sitemap-index.xml/route.ts:297-307`. `sitemap-presse.xml` (1 URL) et `sitemap-blog.xml` (134) listés = gates non-vides passés. Aucun effet « fenêtre post-deploy » observé (tous non vides à 18:57, 31 min post-atterrissage).

### 3. Feeds RSS/JSON — 7/7 en 200, XML/JSON valides (18:59:20–18:59:27 UTC)

| Feed | Status | Items | Taille (o) | Temps (s) | Content-Type | Cache-Control | cf/age |
|---|---|---|---|---|---|---|---|
| /fr/blog/feed.xml | 200 | 30 | 12 941 | 0,249 | application/rss+xml | max-age=900, swr=86400, sie=604800 | MISS |
| /fr/actualites/feed.xml | 200 | 32 | 17 022 | 0,076 | application/rss+xml | max-age=300, swr=3600, sie=604800 | UPDATING/812 |
| /fr/cas-concrets/feed.xml | 200 | 5 | 2 468 | 1,223 | application/rss+xml | max-age=900, swr=86400, sie=604800 | MISS |
| /fr/faq/feed.xml | 200 | **1 550** | **1 154 175** | 0,450 | application/rss+xml | max-age=3600, swr=86400, sie=604800 | MISS |
| /fr/avis/feed.xml | 200 | 48 | 34 478 | 0,287 | application/rss+xml | max-age=3600, swr=86400 | MISS |
| /fr/ressources/feed.xml | 200 | 50 | 37 476 | 0,246 | application/rss+xml | max-age=600, swr=86400, sie=604800 | MISS |
| /fr/ressources/feed.json | 200 | 50 | 45 936 | 0,195 | application/feed+json | max-age=600, swr=86400, sie=604800 | MISS |

Avis : 48 items — cohérent avec la base (77 avis, feed plafonné) ; aucun `x-robots-tag` sur les feeds.

### 4. `/api/markdown/` (18:59:27–19:01:19 UTC) — tous `cf=DYNAMIC`

| URL | Status | Taille (o) | Temps (s) | Verdict |
|---|---|---|---|---|
| /api/markdown/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble | 200 | 10 644 | 0,143 | ✅ contenu complet, text/markdown, cache 1h/24h/7j |
| /api/markdown/actualites/souverainete-numerique-syndicats-donnees-assemblee-nationale | 200 | 2 376 | 0,122 | ✅ |
| /api/markdown/faq/geo-france | 200 | 1 328 | 0,231 | ✅ (fix 2026-08-10 opérant) |
| /api/markdown/cas-concrets/industrie-comptabilite | 200 | **293** | 0,113 | 🔴 corps VIDE (titre + footer seulement) — P1 |
| /api/markdown/centre-aide/preparer-une-intervention | **404** | 49 | 1,137 | 🔴 P1 (2e slug `perimetre-audit-ia` → 404 aussi) |
| /api/markdown/glossaire/agent | **404** | 40 | 0,121 | 🔴 « Unknown content type » — P1 (page HTML 200 à 19:01:18Z) |
| /api/markdown/guides/guide-inexistant-test | 404 | 40 | 0,121 | ✔ attendu (aucun guide `guide-*` publié — cf. Limites) |

### 5. Pages stratégiques (18:59:33–18:59:47 UTC + gzip 19:03:07 UTC)

Aucun `x-robots-tag` sur aucune page. Build servi : `99ba93a0`.

| Page | Status | Taille brute (o) | gzip (o) | Temps (s) | cf-cache / age | Cache-Control |
|---|---|---|---|---|---|---|
| / | 301 → /fr | 23 | — | 0,102 | DYNAMIC | — |
| /fr | 200 | 1 577 128 | 124 404 | 0,157 | HIT / 1886 | s-maxage=3600, swr=31532400 |
| /fr/interventions | 308 → /fr/formations | — | — | 0,171 | BYPASS | — |
| /fr/interventions/essentielle | 308 → /fr/formations | — | — | 0,192 | BYPASS | — |
| /fr/audit | 200 | 2 079 159 | 184 818 | 0,362 | MISS | s-maxage=3600, swr=31532400 |
| /fr/audit/flash | 308 → /fr/audit/tpe-1-jour | — | — | 0,174 | BYPASS | — |
| /fr/implementation | 200 | 2 044 236 | — | 0,373 | MISS | s-maxage=3600, swr=31532400 |
| /fr/cas-concrets | 200 | 1 163 246 | — | 0,154 | HIT / 1905 | s-maxage=86400, swr=31449600 |
| /fr/methodologie | 200 | 1 226 362 | — | 0,180 | HIT / 2016 | s-maxage=31536000 |
| /fr/comparaisons | 200 | 1 148 861 | — | 0,147 | HIT / 2010 | s-maxage=31536000 |
| /fr/stack-ia | 200 | 1 377 107 | — | 0,173 | HIT / 2012 | s-maxage=31536000 |
| /fr/implantations | 200 | **8 792 194** | 680 567 | 0,525 | MISS | s-maxage=86400, swr=31449600 |
| /fr/implantations/auvergne-rhone-alpes | 200 | 2 758 380 | 175 917 | 0,446 | MISS | s-maxage=86400, swr=31449600 |
| /fr/implantations/auvergne-rhone-alpes/grenoble | 200 | 1 266 831 | — | 0,321 | MISS | s-maxage=86400, swr=31449600 |
| /fr/contact | 200 | 1 148 455 | — | 0,234 | HIT / 878 | s-maxage=86400, swr=31449600 |
| /fr/reserver | 308 → /fr/appel | — | — | 0,243 | BYPASS | — |
| /fr/appel | 200 | 2 087 257 | 158 646 | 2,718 | BYPASS | private, no-cache, no-store |
| /fr/glossaire (bonus) | 200 | 1 230 387 | 98 866 | ~0,3 | — | — |

Notes : les 4 redirections 308 sont **saines** (single-hop vers des 200) — la liste « 15 pages » du budget (2026-05-08) est antérieure aux renommages `/interventions`→`/formations`, `/audit/flash`→`/audit/tpe-1-jour`, `/reserver`→`/appel`. `/fr/appel` en `no-store` + BYPASS + 2,7 s = choix assumé (Calendly, exception budget documentée). Les Age ~1886–2016 s des HIT correspondent au job `warm` post-deploy (18:26–18:35 UTC) — comportement nominal.

## Limites

- **Type markdown `guides` non testable avec un slug réel** : aucun article `guide-*` publié (grep sur les 134 URLs de sitemap-blog + 507 de knowledge = zéro slug préfixé `guide-` ; guides.xml ne liste que le hub). Testé seulement le 404 attendu sur slug fictif. Si des pages `/fr/guides/<slug>` existent hors sitemaps, leur alternate markdown n'a pas pu être vérifié.
- **Mécanisme exact de la réécriture max-age 300→3600** non confirmable sans accès au dashboard Cloudflare (réglage zone) — marqué [À CONFIRMER].
- **Échantillonnage** : 1 slug par type markdown (2 pour centre-aide), 1 spot-check FAQ Track B, 1 spot-check glossaire — pas de balayage exhaustif des 2 603 URLs (rôle des squads B/D). Les `<image:loc>` n'ont pas été fetchés individuellement (périmètre A4/E).
- **Fenêtre temporelle** : toutes les mesures en fenêtre post-deploy ≤ 1 h (18:57–19:03 UTC, deploy atterri 18:26 UTC). Aucun contenu vide observé, mais les valeurs `Age`/`cf-cache-status` reflètent un edge fraîchement réchauffé — un run en régime de croisière donnerait des HIT plus nombreux sur les MISS observés. Le run 31830868520 (in progress, atterrissage ~19:55+ UTC) n'affecte aucune mesure.
- **Pas de mesure sous UA Googlebot/GPTBot** (test des règles robots par UA = périmètre A1/F4) ; UA neutre unique `AxionAuditF1/1.0`.
