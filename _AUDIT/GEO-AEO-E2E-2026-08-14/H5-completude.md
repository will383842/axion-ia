# H5 — complétude : ce qui n'a été couvert par PERSONNE

**Date** : 2026-08-15, mesures live entre 02:08 et 02:12 UTC (hors fenêtre
post-deploy : dernier atterrissage 2026-08-14 19:49:58 UTC, soit +6 h 20 —
aucun « vide DB-driven » ne peut être imputé à l'ISR ici).

**Périmètre réellement couvert** :

1. Les 60 items de `docs/content-gen/seo-aeo-60-items-checklist.md` cochés
   contre les 43 fichiers de rapport présents dans le dossier d'audit.
2. La cartographie de surfaces de l'auto-vérification du prompt maître
   (l. 496-506), y compris ses deux affirmations de couverture.
3. `git log --oneline -25` (lecture seule) — fichiers récents touchant le SEO/GEO.
4. Les 13 angles morts structurels nommés dans ma mission.

---

## Résumé exécutif

**8 trous réels comblés, 9 fausses alertes éliminées, 3 trous assumés non comblés.**

- 🔴 **La découverte majeure est méta** : *personne, en Phase 0 comme en Phase 1,
  n'a ouvert la checklist des 60 items* — alors que le prompt maître l'impose en
  lecture Phase 0 (l. 188). En l'ouvrant, on découvre que **son unique exécutant
  est un stub de 195 octets** : `scripts/seo-audit.ts` se résume à un
  `console.warn("[seo:audit] stub")`, `pnpm seo:audit` n'apparaît dans **aucun**
  workflow GitHub, et le composant de revue `<Seo60Checklist>` n'existe nulle
  part. Les 60 items — dont 22 marqués `[BLOQUANT]` — ne sont **gardés par rien**.
  C'est le cas d'école de la règle maison « une garde ne vaut que si elle rougit ».
- 🟠 **Deux items de la checklist sont des faux besoins** que j'élimine plutôt
  que de les faire remonter en dette : les 4 balises `geo.*`/`ICBM` (section D,
  `[BLOQUANT landings]`) sont **absentes du site à 100 %** — et il faut qu'elles
  le restent (Google ne les lit plus ; le signal moderne, `GeoCoordinates` dans
  le JSON-LD, **existe déjà**, `seo.ts:1457` et `1511`). Idem `dns-prefetch
  images.unsplash.com` (A14) : les images Unsplash transitent par l'optimiseur
  **same-origin**, le navigateur ne contacte jamais unsplash.com. **Un patch qui
  ajouterait ces balises à ~480 pages villes serait du bruit pur.**
- 🟠 Une asymétrie réelle et jamais relevée : `/actualites/[slug]` émet les
  `article:published_time` / `modified_time` / `author`, **`/blog/[slug]` non**
  (61 articles), alors que la mécanique existe dans `buildProductMetadata`.
- 🟡 Trois surfaces vivantes hors radar : `/qr/podcast` **404 en prod** (cible
  documentée du flyer papier), `/fr/memo-isere` indexable mais absente du sitemap
  ET sans lien entrant, `/fr/equipe/manon` — le `@id` `Person` de tout le JSON-LD
  éditorial — hors sitemap.
- ✅ 9 des 13 angles morts nommés dans ma mission étaient en réalité couverts :
  je les réfute plutôt que de gonfler le rapport final.

---

## Bloc 1 — Checklist des 60 items : items non traités

Méthode : chaque item cherché par motif dans les 43 rapports, puis vérifié en
code/live quand aucun rapport ne le portait.

| Section | Items | Couverture par les 40 rapports | Verdict H5 |
|---|---|---|---|
| A. Head & metadata (A1-A8) | title, description, canonical, robots/tier, viewport, charset, lang, hreflang | C1 (canonical/hreflang/longueurs), C3+C5 (robots/tier), G2 (lang/charset), G4 (viewport) | **couvert** |
| A9 theme-color | | G4-mobile-a11y.md:658 (`#c24a1b`, `layout.tsx:115`) | **couvert** |
| A10-A12 author / publisher / copyright meta | | aucun rapport | **trou — mais item obsolète**, cf. bloc 3 |
| A13 preload font swap | | G1 (LCP) ; vérifié live : 3 `<link rel="preload" as="font">` en tête de `/fr/blog/…` (02:10:44Z) | **couvert** |
| A14 dns-prefetch unsplash | | aucun rapport | **faux besoin**, cf. bloc 3 |
| A15 `<time datetime>` | | aucun rapport | **trou réel**, cf. bloc 5 |
| B1-B9 Open Graph de base | | C2 (og:title/desc/url/image/type/site_name/locale + dimensions + alt) | **couvert** |
| B10-B14 `article:*` | | aucun rapport | **trou réel**, cf. bloc 4 |
| C1-C7 Twitter Cards | | C2 (cards + doctrine « handle jamais inventé ») | **couvert** |
| D1-D4 geo meta `[BLOQUANT landings]` | | **aucun rapport**, 0 occurrence de `ICBM`/`geo.region` dans tout `_AUDIT/GEO-AEO-E2E-2026-08-14/` | **trou — mais à NE PAS combler**, cf. bloc 3 |
| E1-E6 hiérarchie Hn | | G4 (`heading-order` axe sur 5 pages), D2, D4 | **couvert partiellement** (échantillon, cf. Limites) |
| F1-F5 semantic HTML5 | | G4 (`landmark-*`, `main` dupliqué sur `/fr/galerie`) | **couvert** |
| F6 `<time datetime>` | | aucun rapport | **trou réel**, cf. bloc 5 |
| G1-G6 WCAG 2.2 AA | | G4 (751 l., axe-core) | **couvert** |
| H1-H8 JSON-LD | | B1 à B6 | **couvert** |
| I1-I5 direct answer / TL;DR / Key Facts / TOC / FAQ | | D2 (742 l., `ensure-direct-answer`) | **couvert** |
| J1-J5 sitemap / IndexNow / Indexing API / llms+md / RSS alternate | | A2, A3, A5, A6 | **couvert** |

**Items sans aucun porteur : A10, A11, A12, A14, A15, B10, B11, B12, B13, B14,
D1, D2, D3, D4, F6 — soit 15 des 60.** Sur ces 15, **8 sont des faux besoins
2026** (bloc 3) et **7 sont des trous réels** (blocs 4 et 5).

---

## Bloc 2 — [P1] La checklist des 60 items n'est gardée par RIEN

**Symptôme.** Le document se présente comme « source de vérité pour validation
HTML automatisée + revue humaine tier-1 » et annonce trois exécutants (§ Workflow
de validation, l. 121-133). Les trois sont fictifs ou morts.

**Preuve code.**

- `scripts/seo-audit.ts` — **195 octets**, daté du 8 mai, contenu intégral :

  ```
  // Sprint 0 stub — hreflang + sitemap + canonical audit script.
  // Sprint 14 wires real audit against the running dev server.
  console.warn("[seo:audit] stub — Sprint 14 enables real audit");
  ```

  Le script existe (`package.json:95` → `"seo:audit": "tsx scripts/seo-audit.ts"`),
  il ne fait **rien**. La checklist le qualifie de « script existant » (l. 130) :
  techniquement vrai, fonctionnellement mensonger.
- Grep `seo:audit|seo-audit` sur `.github/` : **0 occurrence** dans `ci.yml`,
  `deploy-coolify.yml`, `nightly.yml`. L'affirmation « CI gate : `pnpm seo:audit`
  … PR refusée si régression sur un bloquant » (l. 130-131) et « Pré-prod :
  `pnpm seo:audit --tier=tier_1_indexable` … avant `pnpm build` » (l. 132-133)
  décrivent des gates **inexistants**.
- Grep `Seo60Checklist` sur tout le dépôt (hors `node_modules`) : **0 fichier
  source**, seule la doc le mentionne (« à brancher Sprint S6.3 », l. 126). La
  revue humaine annoncée n'a jamais eu de support.

**Preuve live.** Indirecte mais décisive : c'est précisément parce que rien ne
mesure ces items que 15 d'entre eux n'ont jamais été mesurés par personne — y
compris par 40 agents d'audit à qui le prompt maître avait pourtant prescrit ce
fichier en Phase 0 (l. 188). Le document n'a été ouvert par aucun des 40 : grep
`60 items|checklist|seo:audit` sur les rapports → 2 occurrences, toutes deux
sans rapport avec ce fichier (D4:167, G4:491).

**Root-cause.** Doc écrite en Pass B (« Pass B P2-12 closed 2026-05-14 ») sur la
promesse d'un Sprint 14 / S6.3 qui n'a jamais été fait. Le seul filet réel est
partiel et ailleurs : les gates content-gen (`seo-score`, `soft-404-gate`,
`doctrine-check`, `search-intent-validator`…, audités par D3) couvrent le contenu
**généré**, pas les ~90 pages écrites à la main ni les items de `<head>`.

**Patch prescrit (adversarial — ne PAS « implémenter les 60 items »).**
Deux options, dans cet ordre de préférence :

1. **Vérité de documentation (effort S, risque nul)** : réécrire le § Workflow
   en « non implémenté — le seul contrôle actif est la suite content-gen `quality/` »,
   purger les 8 items obsolètes (bloc 3), et retirer la promesse `<Seo60Checklist>`.
   Une doc qui ment sur ses gardes est plus dangereuse qu'une doc absente : elle
   a fait croire à 40 auditeurs qu'un filet existait.
2. **Filet minimal réel (effort M)** : remplacer le stub par un audit Cheerio sur
   ~12 items réellement porteurs (title/description longueurs, canonical absolu,
   1×H1, `og:*` bloquants, JSON-LD parsable, `hreflang` cohérent) exécuté sur un
   échantillon d'URLs prod en `nightly.yml` (jamais en gate PR-time : les gates
   PR-time lhci/size-limit sont déjà non bloquants et mal calibrés,
   `ci.yml:269` et `:297` — n'en rajoutons pas un troisième décoratif).

**Effort** S (option 1) / M (option 2). **Impact GEO/AEO** moyen (indirect : ce
sont les 15 items non mesurés qui produisent les trous des blocs 4-6).
**Risque de régression** : nul en option 1 ; en option 2, **ne pas** brancher en
gate bloquant PR — do-not-touch : `ci.yml` steps `size-limit` et `lhci` (statut
non bloquant assumé et documenté), `lighthouserc.postdeploy.json`.

---

## Bloc 3 — [P2, à NE PAS combler] Les 8 items obsolètes de la checklist

Ce bloc existe pour **empêcher un patch coûteux et inutile** en Phase 3.

### D1-D4 — `geo.region` / `geo.placename` / `geo.position` / `ICBM`

- **Constat.** 0 occurrence dans `src/` sauf **une chaîne de message d'erreur** :
  `src/server/content-gen/quality/search-intent-validator.ts:78` →
  `hardFails.push("Intent local sans meta geo.region / geo.position")`.
  Aucune de ces 4 balises n'est émise nulle part sur le site.
- **La garde qui ne garde rien.** Le champ testé, `hasGeoMeta`, **ne regarde pas
  le HTML** : `content-gen-worker.ts:738` le calcule par
  `Boolean(dbJob.anchorVilleSlug || dbJob.anchorRegionSlug)`. C'est un proxy sur
  un champ de job. Le gate passe donc **toujours** dès qu'un job porte une ville,
  et n'a jamais pu détecter l'absence totale des balises qu'il nomme.
- **Verdict adversarial.** Le trou de couverture est réel ; **le besoin ne l'est
  pas**. Google a cessé d'utiliser les meta `geo.*` (héritage Geo Targeting
  Dublin Core) ; le signal moderne équivalent est déjà émis :
  `src/lib/seo.ts:1457-1458` et `1511-1512` (`geo: { "@type": "GeoCoordinates" }`),
  alimenté par les coordonnées réelles de `src/content/villes/data/*.ts`.
  **Ajouter 4 balises mortes sur ~480 pages villes déclarées serait un patch à
  risque non nul (touche le `<head>` de toutes les landings) pour un gain nul.**
- **Patch prescrit** : retirer D1-D4 de la checklist ; renommer le message du
  validator en « Intent local sans ancrage ville/région » (le code est correct,
  c'est son libellé qui ment). Effort S. Impact GEO nul. Do-not-touch : la
  logique `hasLocalBusinessJsonLd`/`hasGeoMeta` elle-même (elle sert de
  déclassement de tier, pas de mesure HTML).

### A10-A12 — `meta author` / `publisher` / `copyright`

Absentes (vérifié live sur `/fr/blog/cours-ia-grenoble-entreprise-faq`,
02:10:44Z : 0 occurrence de `name="author"`). Aucun moteur classique ni AEO ne
les consomme ; l'attribution qui compte est `author` dans le JSON-LD (`@id`
`…/equipe/manon#person`), déjà émis (`seo.ts:537`) et audité par B3/D6.
**Verdict : items à supprimer de la checklist, pas à implémenter.**

### A14 — `dns-prefetch images.unsplash.com`

Faux besoin **prouvé** : le hero d'un article est servi par l'optimiseur
same-origin — `<link rel="preload" as="image" imageSrcSet="/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2F…">`
(live 02:10:44Z). Le navigateur ne résout jamais `images.unsplash.com`. Les 3
`preconnect` réellement présents visent `axion-ia.com`,
`o4510557298294784.ingest.de.sentry.io` et `challenges.cloudflare.com` (sujet
G1, hors mon périmètre). **Verdict : item à supprimer.**

---

## Bloc 4 — [P2] `article:*` absent sur les 61 articles de `/blog/` (présent sur `/actualites/`)

- **Symptôme.** Checklist B10-B14. Un article de blog ne publie ni
  `article:published_time`, ni `article:modified_time`, ni `article:author`, ni
  `article:section`, ni `article:tag`. Les actualités, elles, les publient.
- **Preuve code.** La mécanique existe et fonctionne :
  `src/lib/seo.ts:300-311` n'émet le bloc `ogArticleFields` que si
  `ogType === "article"` **ET** qu'un objet `article` est passé.
  - `src/app/[locale]/actualites/[slug]/page.tsx:196-199` → passe
    `publishedTime`, `modifiedTime`, `authors` ✔
  - `src/app/[locale]/blog/[slug]/page.tsx:118-133` → passe `ogType: "article"`
    **sans** objet `article` ✘ (seul `ogImage` est ajouté)
- **Preuve live** (02:10:44Z, `/fr/blog/cours-ia-grenoble-entreprise-faq`,
  200, 1,3 Mo) : `og:type` = `article` présent ; `article:published_time`,
  `article:modified_time`, `article:author`, `article:section`, `article:tag` :
  **0 occurrence**. `speakable` présent (18 occurrences) — le JSON-LD, lui, est
  complet.
- **Root-cause.** Oubli d'appel, pas de défaut d'architecture : la page blog a
  déjà `view.publishedAt` / `view.updatedAt` / l'auteur en main pour son JSON-LD.
- **Patch prescrit.** Ajouter le bloc `article: { publishedTime, modifiedTime,
  authors }` à l'appel `buildProductMetadata` de `blog/[slug]/page.tsx`, en
  réutilisant **exactement** les mêmes valeurs que le JSON-LD de la page (pas de
  recalcul : une divergence `article:modified_time` ≠ `dateModified` est pire
  que l'absence). `section`/`tags` optionnels. Effort **S**.
- **Impact GEO/AEO** : **faible-moyen**. Ce ne sont pas des signaux de
  classement Google ; ils servent aux previews sociales (LinkedIn — canal actif
  d'Axion-IA) et sont lus par plusieurs parseurs d'article utilisés en amont
  des moteurs de réponse. Ne pas le vendre plus cher que ça.
- **Risque de régression** : faible, mais **non nul** — `buildProductMetadata`
  applique `ensureArticleMetaTitle` dès `ogType === "article"` (`seo.ts:277`) :
  le patch ne doit pas toucher au chemin du titre. Do-not-touch : la dérivation
  `robots` par tier (`blog/[slug]/page.tsx:134-139`), le `ogImage` hero.

---

## Bloc 5 — [P2] Aucune date d'article n'est balisée `<time datetime>`

- **Symptôme.** Checklist A15 + F6. Les dates s'affichent en texte nu.
- **Preuve live** (02:10:44Z, même article) : 4 occurrences de « Publié le »,
  **0 occurrence** de `datetime=` dans tout le document.
- **Nuance adversariale — pourquoi c'est P2 et pas P1** : la date machine-lisible
  qui compte pour Google et pour les moteurs de réponse est
  `datePublished`/`dateModified` du JSON-LD, **présente et auditée** (B3), plus
  le `lastmod` du sitemap (A2/D7). `<time>` est un renfort sémantique, pas le
  porteur du signal. Ne pas le remonter comme un manque de fraîcheur.
- **Patch prescrit** : wrapper les dates affichées dans les gabarits d'article
  (`<time dateTime={iso}>`). Effort S. Impact faible. Risque : nul (aucun
  changement de layout si la balise est inline).

---

## Bloc 6 — Angles morts structurels : verdicts un par un

### 6.1 [RÉFUTÉ] Sitemap HTML `/plan-du-site`

Couvert : `C4-maillage-interne.md:84-86` — page **inexistante** (404 live 18:03
UTC, 0 occurrence dans `src/`), déjà classée P2 avec patch. Recoupé par
`G2-rendu-sans-js.md:321` (404 pour les 3 UA). Rien à ajouter.

### 6.2 [RÉFUTÉ] Recherche interne `/recherche`

Triplement couvert : `C4:105` (noindex+follow, hors sitemap, liée du footer →
« hygiène correcte »), `C5:60-61` + `:99` (live `?q=audit` → noindex),
`D5:68-72` (P2 latent : href KB en dur vers `/connaissances/`). Confirmé aussi
côté code : `EXCLUDED_FROM_INDEX` contient `/recherche` (`sitemap.ts:194`).

### 6.3 [COMBLÉ — RAS] QR codes avis

Aucun rapport ne le traite (l'auto-vérification du prompt maître, l. 500,
affirme « QR-avis » couvert par B1-B6 : **c'est faux**, grep `qr` sur les
rapports B → 0). Vérifié moi-même :

- Composant `src/components/reviews/ReviewQrCta.tsx` — server component pur,
  `alt` non vide, dimensions fixes (CLS-safe), asset statique
  `/qr/laisser-un-avis.svg`.
- Live 02:09:00Z : `/qr/laisser-un-avis.svg` → **200**, 4 713 o (= 4 714 o du
  fichier local, cohérent).
- Cible encodée, live 02:11:40Z :
  `/fr/avis/deposer?utm_source=qr&utm_medium=onsite&utm_campaign=avis-clients`
  → **200**. Le paramètre UTM ne casse pas la canonicalisation (C5 a déjà
  vérifié que UTM ≠ facette).
- **Verdict : RAS.** Aucun finding.

### 6.4 [COMBLÉ — P2 réel] `/qr/podcast` → 404 en production

- **Symptôme.** `src/i18n/routing.ts:213` documente `/podcast` comme « Cible du
  flyer papier + du QR dynamique `/qr/podcast` », et
  `src/app/[locale]/podcast/page.tsx:5` répète « QR dynamique `/qr/podcast`
  (créé côté console admin QR) ». Ce QR **ne résout pas**.
- **Preuve live** (02:09:00Z) : `GET https://axion-ia.com/qr/podcast` → **404**,
  35 octets (« QR code introuvable ou désactivé. »). Contrôle négatif :
  `/qr/slug-inexistant-audit-h5` → 404, 35 o — réponse **identique**, donc le
  slug `podcast` n'existe pas ou est inactif en base.
- **Preuve code.** `src/app/qr/[slug]/route.ts:24-34` — le 404 est émis quand
  `prisma.qrLink.findUnique({ where: { slug } })` est nul **ou** `active: false`.
  La route elle-même est saine (302 jamais 301, exclusion correcte du matcher
  i18n `proxy.ts:461`, `no-store` sur le 404, 35 o — à comparer aux 707 130 o du
  404 racine relevé par F1-P2 : ici c'est exemplaire).
- **Root-cause** : enregistrement `QrLink` jamais créé (ou désactivé) dans la
  console admin. **[À CONFIRMER]** — l'accès DB prod n'est pas ouvert à H5.
- **Patch prescrit** : **aucun patch de code**. C'est un **reste-Will** : créer
  le lien `podcast` dans la console QR (admin → QR codes → nouveau) avec
  destination `https://axion-ia.com/fr/podcast`. À vérifier **avant** toute
  nouvelle impression de flyers. Effort S, impact GEO nul mais impact
  acquisition réel (chaque flyer déjà distribué envoie sur un 404).
- **Risque** : nul. Do-not-touch : ne pas transformer le 404 en redirection
  générique — le 404 explicite est le bon comportement pour un slug inconnu.

### 6.5 [COMBLÉ — P2 réel] `/fr/memo-isere` : indexable, hors sitemap, orpheline

- **Symptôme.** Landing commerciale live et indexable, invisible pour la
  découverte : ni sitemap, ni lien entrant.
- **Preuve live** (02:12:17Z) : `/fr/memo-isere` → **200**, 1 495 860 o ;
  `/memo-isere` → 301 (règle 0bis, correct).
  `sitemap/pages.xml` récupéré à 02:11:40Z (200, 31 204 o) : **0 occurrence** de
  `memo-isere` (contrôle positif sur le même fichier : `/fr/podcast` l. 388,
  `/fr/accessibilite` l. 604, `/fr/certification-qualiopi` l. 396…).
- **Preuve code.** `buildPagesSitemap` (`sitemap.ts:696-727`) n'itère que
  `routing.pathnames` ; grep `memo-isere` sur `src/i18n/routing.ts` → **0
  occurrence** → la page ne peut structurellement pas entrer dans `pages.xml`.
  La page n'émet **aucun** `robots: noindex` (`memo-isere/page.tsx:102-120`,
  `buildProductMetadata` + `title.absolute`), donc canonical
  `/fr/memo-isere` auto-référent et indexable.
- **Couverture partielle existante** : l'URL figure bien dans le tableau
  `orphans` de `C4-link-graph.json:794`, mais la **narration** de C4-P2
  (`C4:88`) ne cite que `/fr/podcast`, `/fr/politique-deplacement` et les hubs
  secteur — `memo-isere` est passée sous le radar, et **son absence du sitemap
  n'est relevée nulle part**.
- **Deux lectures, je ne tranche pas seul** :
  (a) *volontaire* — landing de campagne, trafic amené par pub/QR, on ne veut
  pas l'indexer : alors elle doit porter `robots: noindex` comme `/diagnostic`
  et `/simulateur` (`EXCLUDED_FROM_INDEX`, `sitemap.ts:186-193`) ;
  (b) *oubli* — c'est une page de recrutement d'apporteurs d'affaires à fort
  potentiel local : alors il faut la déclarer dans `routing.pathnames` et lui
  donner au moins un lien entrant depuis `/devenir-commercial-ia`.
  **Aujourd'hui elle est dans un troisième état, le seul qui n'a aucun sens :
  indexable, non déclarée, non liée.**
- **Effort** S. **Impact** faible-moyen. **Risque** : en option (b), une
  nouvelle clé `pathnames` ajoute 1 URL au sitemap et 2 pages SSG (FR+EN) —
  vérifier que la page ne casse pas le build EN (elle a déjà ses libellés EN).
  Do-not-touch : `EXCLUDED_FROM_INDEX` (chaque entrée y répare une incohérence
  GSC documentée).

### 6.6 [COMBLÉ — P2 mineur] `/fr/equipe/manon` hors sitemap

- **Symptôme.** `…/fr/equipe/manon#person` est le `@id` de l'auteur dans le
  JSON-LD éditorial (`src/lib/seo.ts:537`,
  `src/app/[locale]/comparaisons/[slug]/page.tsx:83`) — c'est-à-dire le nœud
  d'entité que Google doit résoudre pour créditer l'E-E-A-T des contenus. La
  page cible n'est déclarée dans aucun sitemap.
- **Preuve code.** `sitemap.ts:728-738` ajoute **explicitement** `/fr/equipe/williams`
  (« page d'autorité d'entité », audit sitelinks 2026-07-06) et **seulement**
  lui ; `/equipe/[slug]` est écarté par `isSlugTemplate`.
- **Preuve live.** `pages.xml` (02:11:40Z) : `/fr/equipe/williams` l. 684, aucune
  entrée `manon`. B1 avait bien mesuré `/fr/equipe/manon` → 200 (17:50:31Z) sans
  relever l'absence sitemap.
- **Pourquoi P2 et pas P1** : la page **est** liée en interne (`/transparence`
  l. 89 et 104, `/charte-editoriale` l. 292) — elle est donc découvrable ; ce
  n'est pas une orpheline. Le manque est un signal de priorité, pas un blocage.
- **Patch** : ajouter une entrée explicite jumelle de celle de Williams. Effort
  S. Impact faible. Risque : nul. Do-not-touch : ne PAS lever
  `isSlugTemplate` sur `/equipe/[slug]` (rouvrirait des slugs arbitraires).

### 6.7 [COMBLÉ — RAS] Les 6 pages institutionnelles jamais auditées individuellement

`/fr/accessibilite`, `/fr/podcast`, `/fr/transparence`, `/fr/corrections`,
`/fr/charte-editoriale`, `/fr/certification-qualiopi`. Live 02:09:00Z :
**200 toutes les six**. Vérifications :

- Metadata par le SSOT `buildProductMetadata` sur chacune ; **aucun `robots:` /
  `noindex`** (grep sur les 4 pages non déjà couvertes → 0 occurrence).
- JSON-LD `WebPage` présent (`podcast/page.tsx:52-59` avec `speakable: true`,
  `accessibilite/page.tsx:113-123`).
- Toutes présentes dans `pages.xml` (l. 164, 172, 180, 388, 396, 604) → **aucune
  incohérence « URL noindexée dans le sitemap »**.
- Point d'attention **écarté** : `/fr/podcast` n'émet pas de `PodcastSeries`.
  C'est **correct** — la page est une *offre de tournage* gratuite
  (`podcast/page.tsx:2-3`), il n'existe aucun épisode. Émettre `PodcastSeries`
  serait un balisage mensonger. **Ne pas le prescrire.**
- `/fr/certification-qualiopi` et `/fr/financement-opco-france-travail` sont
  **dans** `pages.xml` (l. 396, 404) : le gating Phase-A/Phase-B
  (`sitemap.ts:705-716`) est donc bien en Phase B en prod, cohérent avec le 200.

Verdict : **RAS**, aucun finding. Ces pages étaient un trou de *couverture*, pas
un trou de *qualité*.

### 6.8 [RÉFUTÉ] `/observatoire-ia`

Couvert par B4 (Dataset + exports JSON/CSV) et C5:60-61 (canonical fixe,
paramètres `?size=junk&sector=…` → `index, follow` + canonical propre), plus
G3:241 et H3:818 (worker `observatoire-snapshot`).

### 6.9 [RÉFUTÉ] `/transparence`, `/corrections`, `/charte-editoriale` (E-E-A-T)

Couverts par D6 (740 l., 26 occurrences ; périmètre déclaré l. 25 ; engagements
de la charte confrontés au code l. 448 et 595). Mon apport se limite au contrôle
sitemap/robots du 6.7.

### 6.10 [RÉFUTÉ] `/equipe/[slug]`

Couvert en live par B1:100 (`/fr/equipe/williams` et `/fr/equipe/manon` → 200).
Seule l'absence sitemap de Manon manquait (6.6).

### 6.11 [RÉFUTÉ] `manifest.webmanifest`

Couvert par C2:68 et C2:111 (200, `application/manifest+json`, 1 094 o,
identique au code). Re-mesuré 02:09:00Z : **200, 1 094 o** — inchangé.

### 6.12 [RÉFUTÉ] `/.well-known/security.txt`

Couvert **trois fois** par A1 (`Policy` pointe la politique RGPD A1-P2 ;
`Expires: 2027-05-16` figé A1-P2 ; `/security.txt` racine 404 A1-P2), recoupé
par F1:93 et :114-115, arbitré par H1:1115. Rien à ajouter.

### 6.13 [RÉFUTÉ] `/accessibilite` (a11y)

La *page* n'était couverte par personne (traitée en 6.7) ; le *sujet*
accessibilité est couvert par G4 (751 l., axe-core sur 5 pages).

---

## Bloc 7 — Commits récents : du code SEO/GEO a-t-il échappé à l'audit ?

`git log --oneline -25` (lecture seule). Les 25 derniers commits remontent à
`3a065042` (2026-08-12). Tri par surface GEO :

| Commit | Surface GEO/SEO | Couvert par |
|---|---|---|
| `308171ae` CGV médiation | aucune | — (hors périmètre, contenu légal) |
| `99ba93a0` L4 consentements/RGPD | aucune (CRM inerte, drapeaux OFF) | — |
| `a8e3d8aa` harnais E2E CRM | aucune | — |
| `e754f69d` CGV produits numériques | aucune | — |
| `66c20a32` **revalidate + purge `/fr/diagnostic` post-deploy (#599)** | job `warm`, revalidate, purge CF | A3, A3-ADDENDUM, G3, **et acquis (b) de la session** |
| `90d429bc` outbox CRM (inerte) | aucune | — |
| `2b5a9c24` **`/fr/diagnostic` VSL** | page noindex (`EXCLUDED_FROM_INDEX`) | C5, G3 |
| `2dfbd8c7` CGV clauses | aucune | — |
| `db16be3d` **`/roi` refonte tunnel (#594)** | slots images | **E2:27** (4 entrées `grid` orphelines relevées) |
| `4df39084`, `cd0a8541`, `a50a55eb` e-mails/FAQ | FAQ `les-3-modules` | B4 |
| `2e921b7d`, `e098ef6d`, `91a5098c` purges de promesses | prose villes / prix | D4, B2 |
| `484569ce`, `6a671ca7`, `ccdb7d1f` offres d'emploi | JobPosting, fraîcheur, sitemap-carrieres | **B5 (282 l.)** |
| `a2ab78d3` rendu mobile tunnels | mobile | G4 |
| `c8ebb8b1` RGPD + pilotage tunnels | aucune surface publique | — |
| `d6b9a661` **build worker webpack (#581)** | build/bundle | G1 |
| `3a065042` retrait garantie de résultat | prose | décision actée 8 |

**Verdict : aucun commit récent n'a échappé à l'audit.** Le seul point sensible
— `#599` (warm/revalidate/purge) — est au contraire le mieux couvert du lot, et
l'acquis (b) de la session (sérialiser `lhci` après `warm`, `needs: [deploy, warm]`)
reste la bonne lecture : le job `lhci` de `deploy-coolify.yml:554` n'a toujours
pas de dépendance sur `warm`.

---

## Bloc 8 — Workers jamais cités par aucun rapport

Grep des 50 workers de `src/server/queue/workers/` contre les 43 rapports. Non
cités : `site-route-discovery-worker`, `content-psi-monitor-worker`,
`chatbot-ingest-worker`, `brand-voice-drift-monitor`, `content-qa-extract-worker`,
`content-rss-fetch-worker`, `content-weekly-report-worker`.

Contrôle fait : les 7 sont **bien enregistrés** dans `src/server/queue/worker.ts`
(donc pas du code mort — je ne crée pas de faux positif « worker orphelin »).

Classement :

- **Hors périmètre assumé (6/7)** : observabilité interne, aucune surface
  d'émission vers un moteur. `site-route-discovery` alimente
  `site-route-inspector`/`-anomaly` (eux couverts par F7:89 et :105) ;
  `content-psi-monitor` et `brand-voice-drift` sont des moniteurs internes ;
  `chatbot-ingest` alimente le RAG du chatbot du site (consommation, pas
  émission) ; `content-rss-fetch` **ingère** des flux tiers ; `content-weekly-report`
  produit un rapport interne.
- **Trou réel non comblé (1/7)** : `content-qa-extract-worker` — c'est lui qui
  dérive les Q/R (surface `QAPage`, cœur AEO). B4 a audité le **schéma** produit,
  personne n'a audité le **producteur**. Non comblable ici : le diagnostiquer
  demande la DB prod (volumes de Q/R extraites, taux d'échec), accès non ouvert
  à H5. Voir Limites. **À traiter en Phase 3 comme reste-d'audit, pas comme
  finding** — et en gardant l'acquis (f) en tête : la production de contenu est
  arrêtée depuis le 2026-07-20, un worker « qui ne tourne pas » n'est pas un bug.

---

## Mesures brutes

| # | URL | Heure UTC | Statut | Taille | Note |
|---|---|---|---|---|---|
| 1 | `/fr/accessibilite` | 02:09:00 | 200 | 1 123 585 o | dans `pages.xml` l. 604 |
| 2 | `/fr/podcast` | 02:09:00 | 200 | 1 125 104 o | dans `pages.xml` l. 388 |
| 3 | `/fr/transparence` | 02:09:00 | 200 | 1 146 414 o | `pages.xml` l. 164 |
| 4 | `/fr/corrections` | 02:09:00 | 200 | 1 130 979 o | `pages.xml` l. 180 |
| 5 | `/fr/charte-editoriale` | 02:09:00 | 200 | 1 156 030 o | `pages.xml` l. 172 |
| 6 | `/fr/certification-qualiopi` | 02:09:00 | 200 | 1 374 107 o | `pages.xml` l. 396 → Phase B active |
| 7 | `/qr/podcast` | 02:09:00 | **404** | 35 o | slug absent/inactif |
| 8 | `/qr/slug-inexistant-audit-h5` | 02:09:00 | 404 | 35 o | contrôle négatif — réponse identique |
| 9 | `/qr/laisser-un-avis.svg` | 02:09:00 | 200 | 4 713 o | = fichier local 4 714 o |
| 10 | `/manifest.webmanifest` | 02:09:00 | 200 | 1 094 o | identique à C2 |
| 11 | `/fr/blog/cours-ia-grenoble-entreprise-faq` | 02:10:44 | 200 | 1,3 Mo | `og:type=article`, 0 `article:*`, 0 `datetime=`, 18 `speakable`, 3 `preconnect` |
| 12 | `/fr/avis/deposer?utm_source=qr&…` | 02:11:40 | 200 | 1 135 871 o | cible du QR avis |
| 13 | `/sitemap/pages.xml` | 02:11:40 | 200 | 31 204 o | `lastmod` uniforme `2026-08-14T18:54:41.000Z` |
| 14 | `/fr/memo-isere` | 02:12:17 | **200** | 1 495 860 o | **absente de `pages.xml`** |
| 15 | `/memo-isere` | 02:12:17 | 301 | 34 o | règle 0bis, correct |

Comptages statiques :

| Mesure | Valeur |
|---|---|
| Rapports Phase 1 présents | 40 (A1→G4) + H1 + H3 + 2 fichiers de service |
| Items de la checklist sans aucun porteur | **15 / 60** (A10-A12, A14, A15, B10-B14, D1-D4, F6) |
| … dont faux besoins 2026 | 8 (A10, A11, A12, A14, D1, D2, D3, D4) |
| … dont trous réels | 7 (A15, F6, B10-B14) |
| Occurrences de `ICBM|geo.region|geo.placename|geo.position` dans les 43 rapports | **0** |
| Occurrences de `seo:audit` dans `.github/` | **0** |
| Taille de `scripts/seo-audit.ts` | **195 octets** (stub) |
| Occurrences de `Seo60Checklist` hors doc | **0** |
| Workers non cités par aucun rapport | 7 / 50 |

---

## Limites

- **Pas d'accès DB.** Le digest réserve la DB prod à A3, B6, D1, D5, D8, F7. Je
  n'ai donc pas pu : confirmer que le `QrLink` `podcast` est absent plutôt
  qu'inactif (6.4), ni mesurer l'activité réelle de `content-qa-extract-worker`
  (bloc 8). Les deux sont marqués **[À CONFIRMER]** sur la root-cause — pas sur
  le symptôme, qui est prouvé en live pour le premier.
- **Échantillon d'un seul article** pour les blocs 4 et 5. La preuve code
  (`blog/[slug]/page.tsx:118-133` vs `actualites/[slug]/page.tsx:196-199`) est
  structurelle, donc généralisable aux 61 articles ; la preuve live ne porte
  que sur `cours-ia-grenoble-entreprise-faq`.
- **Items E1-E6 (hiérarchie Hn) et G1-G6 (WCAG) non mesurés à l'échelle** :
  G4 les a mesurés sur 5 pages, personne sur les ~480 villes déclarées ni sur
  les 61 articles. Un crawl complet est hors périmètre (machine de Will, nuit,
  interdiction de charger la machine). **Trou assumé.**
- **Aucun outil navigateur ni recherche web** utilisé (réservés à la session
  principale) : les items de la checklist qui exigent un rendu (G1 contraste,
  G3 focus visible, H8 Rich Results Test) reposent sur les mesures de G4/B*.
- Je n'ai **pas** re-débattu des acquis (a) à (f) de la session ni des 11
  décisions actées. Deux « trous » apparents ont été écartés à ce titre :
  l'absence de hreflang EN enrichi (décision 1) et l'absence de citation
  Gemini (décision 2 / F4).
