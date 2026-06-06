# 02 — ANOMALIES (liste numérotée, preuve + correctif) — 2026-06-05

> Chaque anomalie : **Preuve** (`fichier:ligne` ou ligne CSV ou curl daté) · **Gravité** · **Type/nb d'URLs** · **Correctif** · **Fait prouvé / Hypothèse**.
> Convention gravité : 🔴 P0 (débloque le crawl ou casse une fonction) · 🟠 P1 · 🟡 P2 · ✅ non-anomalie (clarification).

---

## A-01 🔴 — Sitemap surdimensionné vs autorité = famine de crawl (CAUSE RACINE)

- **Preuve** : `Coverage/Graphique.csv` non-indexées 336→2953 le **2026-05-19** ; `Coverage-Validation/Tableau.csv` = **999/999 jamais crawlées** (1970-01-01) ; sitemap émis ~3,5-6,8 k URLs (`app/sitemap.ts`, `sitemap-index.xml/route.ts:42-54`) ; index plafonné à 47.
- **Type / nb** : structurel — impacte **les 2 558 « Détectée non indexée »** + les pages stratégiques saines.
- **Gravité** : 🔴 **P0** (racine).
- **Correctif** : sitemap de **cohortes piloté par l'indexation** (cf. `03b-STRATEGIE-RAMP-UP.md`). Geler l'élargissement drip calendaire ; n'exposer que Tier 0 + déjà-indexé.
- **Statut** : **Fait prouvé.**

---

## A-02 🔴 — `/opengraph-image` → 502 Bad Gateway **persistant en prod (live)**

- **Preuve** : `curl -I https://axion-ia.com/opengraph-image` (2026-06-05 06:27 UTC) → **`HTTP/1.1 502 Bad Gateway`**, `Content-Type: text/plain`, `Content-Length: 15`, `Server: cloudflare` (origine renvoie 502). GSC `Coverage-Drilldown (4)/Tableau.csv` : `/opengraph-image` 5xx (last-crawl 2026-05-13). À comparer : `curl https://axion-ia.com/api/og?title=Test` → **200 image/png** (même edge runtime ⇒ l'edge marche, le bug est spécifique au fichier).
- **Code** : `src/app/opengraph-image.tsx:23` `export const runtime = "edge"` ; le fix « inline brand » (lignes 12-22) **ne suffit pas** : le render échoue toujours à l'exécution en prod.
- **Type / nb** : 1 route (OG image par défaut de l'accueil + toute page sans OG explicite) → casse previews sociales LinkedIn/X/Discord + éligibilité Google Discover.
- **Gravité** : 🔴 **P0** (fonction cassée, pas SEO-only).
- **Correctif** (à valider en session impl) : aligner `opengraph-image.tsx` sur l'implémentation **prouvée fonctionnelle** de `src/app/api/og/route.tsx` (mêmes imports/fonts/JSX), **ou** passer `runtime="nodejs"`, **ou** supprimer toute dépendance edge non supportée par le standalone Coolify (police custom / fetch). Hypothèse de cause la plus probable : chargement de police/asset au render edge qui échoue côté standalone.
- **Statut** : **Fait prouvé (502 live)** ; *cause exacte = hypothèse à confirmer par logs Coolify*.

---

## A-03 🟠 — Signaux EN contradictoires : 301 **+** `Disallow: /en/` (viole Invariant #1d)

- **Preuve** : `robots.txt` live (2026-06-05) contient `Disallow: /en/` dans le groupe `*` ; **et** `curl -I /en/about` → `301 → /fr/a-propos`. Code : `src/app/robots.ts:95` (`dynamicDisallow = [...COMMON_DISALLOW, "/en/"]`) **vs** `src/proxy.ts:36-42` (301). GSC : 40 « bloquée robots » (majorité `/en/*`) **+** 38 « redirection » (dont `/en→/fr`) **+** 3 « 403 » `/en/*`.
- **Mécanisme du bug** : un `/en/*` `Disallow` **empêche Googlebot de crawler l'URL**, donc **il ne voit jamais le 301** → l'ancienne URL EN reste en index « indexée mais bloquée par robots » au lieu d'être **proprement remplacée par FR** + consolidation du link-equity. Le 403 (CF challenge) ajoute un 3ᵉ signal contradictoire.
- **Type / nb** : ~40-80 URLs EN connues de Google.
- **Gravité** : 🟠 **P0/P1** (Invariant #1 = règle dure).
- **Correctif** : **mécanisme unique = 301 1-hop**. Retirer `"/en/"` de `dynamicDisallow` (`robots.ts:95`) — togglable : ne l'ajouter QUE si `EN_LOCALE_ENABLED==="true"`… non : quand EN désactivé, **laisser crawler pour que Google voie le 301**. Garder le filtrage EN hors `<loc>` (déjà fait). Vérifier que le 403 CF sur `/en/*` Googlebot disparaît (Bot Fight / Managed Challenge).
- **Analyse d'impact** : retirer le Disallow autorise Google à crawler ~40-80 301 EN (coût crawl **trivial, one-time**, car EN absent des sitemaps → pas de re-découverte massive). Bénéfice : purge propre + transfert d'autorité vers FR.
- **Statut** : **Fait prouvé.**

---

## A-04 🟠 — Fuite `hreflang="en"` dans `sitemaps/images-fr.xml` (Invariant #1b)

- **Preuve** : `src/app/sitemaps/images-fr.xml/route.ts:122-124` (index galerie émet `<xhtml:link hreflang="en-US/x-default" href="/en/gallery/">` en dur) et `:138-141` (boucle sur **toutes** les translations, dont `en`). Ce Route Handler custom **ne passe pas** par `filterEnIfDisabled` (`sitemap.ts:362`). Corrélation GSC : `Coverage-Drilldown (1)/Tableau.csv` liste `/en/gallery`, `/en/gallery/…`, `/en/gallery/` (bloqués robots) = très probablement découverts **par ces alternates**.
- **Type / nb** : ~150 images × 1 alternate en + 1 index = fuite EN systématique côté banque d'images.
- **Gravité** : 🟠 **P1**.
- **Correctif** : conditionner l'émission des alternates `en` (et de `indexUrlOther`) à `EN_LOCALE_ENABLED==="true"` dans `images-fr.xml/route.ts` (et vérifier `sitemap-images-services.xml`, `-villes-t*.xml`, `knowledge-sitemap.ts` pour le même pattern). Togglable.
- **Statut** : **Fait prouvé.**

---

## A-05 🟡 — URLs littérales `/audit/*` et `/fr/audit/*` (astérisque) crawlées → noindex

- **Preuve** : `Coverage-Drilldown/Tableau.csv` (noindex) contient `https://axion-ia.com/audit/*` et `/fr/audit/*` (last-crawl 2026-05-30). Investigation code : **aucune source** dans le repo. `SpeculationRules.tsx:65,90` utilise `href_matches: "/{LOCALE}/audit/*"` = **pattern de matching de liens existants**, **pas** une URL littérale `urls:[...]` → ne crée pas d'URL crawlable. Vérifié.
- **Type / nb** : 2 URLs phantom.
- **Gravité** : 🟡 **P2** (bénin : noindex/404, ne consomme quasi rien).
- **Correctif** : aucun code requis. Optionnel : confirmer via GSC URL Inspection ; servir un **410 Gone** propre si elles persistent. Probable origine : test de pattern Googlebot ou lien externe malformé.
- **Statut** : **Hypothèse (origine externe), source code écartée par preuve.**

---

## A-06 🟡 — URLs legacy `/fr/ia-<ville>` (~67) + suffixes `-1`/`-2` noindexées

- **Preuve** : `Coverage-Drilldown/Tableau.csv` (noindex) : 67 occurrences `/(fr/)?ia-<ville>` (`/fr/ia-evreux`, `/fr/ia-brignoles`…), `/audit-1`, `/fr/audit-1`, `/implantations-1`, `/mes-donnees-1`, `/audit/demande-2`, `/audit/strategique-pme-2`, `/fr/blog/tag/quick-wins-2`. Investigation : **aucune route correspondante** dans `src/app` (le schéma villes actuel est `/[locale]/implantations/[region]/[ville]`, refactor 2026-05-26 qui a retiré 10 750 pages villes×verticales).
- **Type / nb** : ~70 phantoms.
- **Gravité** : 🟡 **P2** (déjà noindex ; n'empêchent rien).
- **Correctif** : laisser le 404/noindex purger (4-12 sem), **ou** (optionnel) ajouter un `redirects()` 301 `/:locale/ia-:city → /:locale/implantations` dans `next.config.ts` pour transférer un éventuel signal. Non prioritaire.
- **Statut** : **Fait prouvé (absents du code) ; origine = ancienne architecture (hypothèse forte).**

---

## A-07 ✅ — `/api/og?title=…` « bloqué robots » dans GSC = **stale, résolu**

- **Preuve** : `Coverage-Drilldown (1)/Tableau.csv` liste `/api/og?title=…` (last-crawl 2026-05-15→17). `robots.txt` live (2026-06-05) : `Allow: /api/og` présent dans le groupe `*` (longest-match > `Disallow: /api/`). `curl /api/og?title=Test` → **200 image/png**. Code `src/app/robots.ts:56` (`COMMON_ALLOW=["/", "/api/og"]`).
- **Gravité** : ✅ non-anomalie (résidu d'avant le fix du 2026-05-18).
- **Correctif** : aucun. Re-soumettre l'URL en GSC pour purger l'entrée stale.
- **Statut** : **Fait prouvé (résolu).**

---

## A-08 ✅ — 5xx `/fr/audit/demande?objet=…` et `/implementation/documents` = **transitoires, résolus**

- **Preuve** : `Coverage-Drilldown (4)/Tableau.csv` 5xx + `(3)` canonical (last-crawl 05-15/16). Live 2026-06-05 : `/fr/audit/demande` → **200** ; `/implementation/documents` → **301 → /fr/implementation/documents → 200**. Code : pages statiques sans appel DB (`audit/demande/page.tsx`, `implementation/documents/page.tsx`), ISR 3600.
- **Gravité** : ✅ non-anomalie (timeout ISR cold transitoire).
- **Correctif** : aucun (surveiller). Re-soumettre en GSC.
- **Statut** : **Fait prouvé (résolu).**

---

## A-09 🟠 — Galerie : pages saines + en sitemap, mais **0 crawl, 0 image indexée**

- **Preuve** : 58 `/fr/galerie` dans l'échantillon JC (`Coverage-Validation`). `sitemaps/images-fr.xml/route.ts:115` (hub) + `:132,158` (chaque détail `<loc>=/fr/galerie/<slug>`) → **les pages SONT dans le sitemap** (contredit l'hypothèse « absentes du sitemap »). Live `/fr/galerie` → 200. Métadonnées `galerie/page.tsx` : `index:true, max-image-preview:large`. Robots `Googlebot-Image` allowed (`robots.ts:81`).
- **Cause réelle** : (1) **famine de crawl** (cause racine A-01) ; (2) **profondeur 2 / footer-only** (`Footer.tsx:41`, absente du header & accueil) → priorité de crawl basse ; (3) **vide au build sous stub** (`images-fr.xml` early-exit `stub.invalid` ligne 77 ; galerie page `prisma.imageAsset.findMany` → `[]` au build) repeuplé ISR — si crawlée en fenêtre froide = vue vide.
- **Type / nb** : ~150 images + 58 pages.
- **Gravité** : 🟠 **P1**.
- **Correctif** : (a) inclure la galerie dans le **Tier 0** ramp-up ; (b) **lier la galerie depuis l'accueil + header** (≤1-2 clics) ; (c) IndexNow ping sur publication d'images ; (d) s'assurer que le 1er rendu ISR runtime n'est pas vide (warm-up post-deploy).
- **Statut** : **Fait prouvé** (correction de l'erreur d'un agent qui la disait « hors sitemap »).

---

## A-10 🟠 — `lastmod` build-time uniformes sur des milliers d'URLs villes/statiques

- **Preuve** : `app/sitemap.ts:348-355` `buildTimeOrNow()` → `BUILD_TIME` partagé par pages/villes/services-villes/glossaire/implementation/stack (cf. cartographie). `sitemap-index.xml/route.ts:79-143` différencie au niveau **index** par source DB (blog/knowledge/news réels), mais les **sub-sitemaps villes** restent à `BUILD_TIME` uniforme.
- **Mécanisme** : `lastmod` identiques en masse = signal de fraîcheur faible → Google **désactive le signal lastmod** pour le site (déjà constaté audit 05-18).
- **Type / nb** : milliers d'URLs villes.
- **Gravité** : 🟠 **P1** (n'aide pas le crawl ; pas un bug bloquant — gonfler artificiellement serait pire).
- **Correctif** : faire porter aux villes un `lastmod` = **date réelle de dernière modif de la copy** (champ à exposer dans `villes/*`), sinon laisser `BUILD_TIME` (honnête) mais **ne pas** falsifier. Prioriser plutôt la réduction de volume (A-01).
- **Statut** : **Fait prouvé.**

---

## A-11 🟡 — `X-Robots-Tag: noindex` stub villes **non câblé** dans le middleware

- **Preuve** : `src/lib/seo-noindex-routes.ts` documente `isNoindexStubRoute()` (Edge `X-Robots-Tag`) mais **`src/proxy.ts` ne l'importe pas** (aucun appel). Le noindex des villes hors cohorte repose donc uniquement sur le `<meta robots>` HTML → Google doit **rendre le HTML** pour voir le noindex (léger gaspillage de crawl vs en-tête HEAD).
- **Type / nb** : ~1 100 villes noindex.
- **Gravité** : 🟡 **P2** (optimisation crawl, pas un bug).
- **Correctif** : câbler `isNoindexStubRoute()` dans `proxy.ts` pour émettre `X-Robots-Tag: noindex, follow` côté Edge (économise le rendu). À faire **après** A-01.
- **Statut** : **Fait prouvé.**

---

## A-12 ✅ — Querystrings dans le sitemap : **RÉFUTÉ**

- **Preuve** : grep des exporters (`sitemap.ts`, `knowledge-sitemap.ts`, `images-*.xml`) → **aucun `?` émis** ; toutes les URLs sont des paths RESTful. Les URLs `?objet=`/`?ville=`/`?service=` vues en GSC (4 « canonique correcte ») sont **découvertes via formulaires/liens** et **self-canonical** (by-design).
- **Gravité** : ✅ non-anomalie.
- **Statut** : **Fait prouvé (réfute la suspicion du brief).**

---

## A-13 🟡 — DROM / villes Corse / `/fr/recherche` / `/fr/mes-donnees` noindex = **by-design**

- **Preuve** : `recherche/page.tsx:35` `robots:{index:false}` (page de résultats, duplicate-content) ; `mes-donnees/page.tsx:29` `index:false,follow:false` (RGPD privé) + `robots.ts:19` Disallow. DROM régions `noindex` via `getIndexableRegions`.
- **Gravité** : ✅ non-anomalie.
- **Statut** : **Fait prouvé (intentionnel, correct).**

---

## A-14 🟠 — Identité légale = PLACEHOLDERS (faille E-E-A-T « Trust » majeure)

- **Preuve** : `src/content/legal.ts:44-46` → `« société française ([forme juridique à préciser]). Siège social : [Ville — France]. RCS [Ville — France], SIREN [SIREN à compléter] »`. `src/lib/seo.ts:452-461` : `vatID`/`identifier` (SIREN/RCS) conditionnés à `env.COMPANY_VAT_NUMBER`/`COMPANY_REGISTRATION_NUMBER` = **undefined** actuellement. **Aucun numéro de téléphone** publié nulle part (NAP incomplet). Adresse = « Paris » au niveau ville seulement (pas de rue/CP).
- **Pourquoi ça compte (indexation + ranking)** : post-HCU, les systèmes qualité de Google évaluent si l'entité est une **vraie entreprise**. Une page « mentions légales » avec `[SIREN à compléter]` + pas de téléphone + pas d'adresse précise est un **signal de faible fiabilité** qui pèse sur la décision d'indexer/ranker un domaine jeune. C'est un déficit de **Trust** concret et corrigeable.
- **Type / nb** : site-wide (footer + mentions-légales + Organization JSON-LD).
- **Gravité** : 🟠 **P1** (Trust ; ne débloque pas le crawl mais conditionne la qualité perçue).
- **Correctif** : renseigner SIREN/SIRET réel, forme juridique (SAS), adresse siège complète, n° TVA, **téléphone** → propager dans `legal.ts`, `seo.ts` (Organization/LocalBusiness), footer, `contact` ContactPoint. (Valeurs = côté Will, cf. [[footer-audit-2026-06-03]].)
- **Statut** : **Fait prouvé.** **CODE CÂBLÉ 2026-06-05** (non poussé) : `seo.ts buildOrganizationJsonLd` émet désormais `vatID`/`identifier`/`telephone`/`address`/`email` par défaut depuis les env `COMPANY_*` (toutes optional, conditionnel → 0 régression). Typecheck OK, tests sameAs 7/7. **Reste côté Will** : (1) **set env Coolify** `COMPANY_REGISTRATION_NUMBER` (SIREN), `COMPANY_VAT_NUMBER`, `COMPANY_ADDRESS`, `COMPANY_PHONE`, `COMPANY_EMAIL` ; (2) remplir le **texte** placeholder de `legal.ts:44-46` (SIREN/forme/adresse — données légales, non fabriquées) ; (3) créer/confirmer le **vanity LinkedIn** `company/axion-ia`.

## A-15 🟡/🟠 — Reviews/AggregateRating : factories non appelées (OK) — mais avis villes à auditer (RISQUE)

- **Preuve** : `buildReviewJsonLd()` (`seo.ts:1241`) + `buildAggregateRatingJsonLd()` (`seo.ts:1292`) **définies mais JAMAIS appelées** (grep = 0 match) → **pas de faux `AggregateRating`** émis = **bon** (pas de risque de violation policy / action manuelle). Testimonials case-studies anonymisés « C. Lambert, DAF » (`case-studies.ts:56-96`) = crédibles.
- **Risque résiduel** : des **avis possiblement inventés** affichés (hors schema) dans les 4 verticales pré-existantes des hubs villes (cf. [[testimonials-villes-todo]]). S'ils existent en clair, c'est un risque E-E-A-T/Trust (et légal) même sans schema Review.
- **Gravité** : 🟡 actuel (pas de schema faux) → 🟠 si avis inventés visibles.
- **Correctif** : (a) **ne jamais** émettre `AggregateRating`/`Review` sans avis réels vérifiables (garder l'état actuel) ; (b) auditer/retirer/remplacer les avis inventés villes par de vrais témoignages (décision Will « plus tard »).
- **Statut** : **Fait prouvé (schema) + Hypothèse (avis villes, à auditer).**

## A-16 🟡 — Autorité faible : `sameAs` réduit + 0 certif/awards + LinkedIn à vérifier

- **Preuve** : Organization `sameAs` = LinkedIn (`linkedin.com/company/axion-ia`) + Wikidata optionnel ; Person Will = `linkedin.com/in/will-axion-ia` (`seo.ts:537`, **hardcodé**). Aucun X/Twitter, YouTube. Aucune certification (Qualiopi non émise en schema) ni award. **À vérifier que ces URLs LinkedIn existent réellement** (un `sameAs` vers un profil inexistant = signal négatif).
- **Gravité** : 🟡 **P2** (Authoritativeness).
- **Correctif** : créer/vérifier les profils sociaux réels, aligner `sameAs` Org↔Person, émettre Qualiopi quand certifié (cf. [[qualiopi-skill-package-2026-06-03]]). **Lié à la question backlinks** (les profils sociaux sont aussi des points d'ancrage off-site).
- **Statut** : **Fait prouvé (code) + Hypothèse (existence réelle des profils).**

## Synthèse anomalies

| # | Anomalie | Gravité | URLs | Action |
|---|---|:--:|---:|---|
| A-01 | Sitemap surdimensionné = famine crawl | 🔴 P0 | 2558+ | Sitemap cohorte (03b) |
| A-02 | `/opengraph-image` 502 live | 🔴 P0 | 1 | Fix render edge/nodejs |
| A-03 | EN 301 **+** Disallow (contradiction) | 🟠 P0/P1 | ~40-80 | 301 unique, retirer Disallow /en/ |
| A-04 | Fuite hreflang en (images-fr.xml) | 🟠 P1 | ~150 | Conditionner au flag |
| A-05 | `/audit/*` littéral | 🟡 P2 | 2 | Bénin / 410 optionnel |
| A-06 | `/fr/ia-*` + `-1`/`-2` legacy | 🟡 P2 | ~70 | Laisser purger / 301 optionnel |
| A-07 | `/api/og` bloqué (stale) | ✅ | — | Re-soumettre GSC |
| A-08 | 5xx audit/demande + impl/documents | ✅ | 2 | Résolus |
| A-09 | Galerie non crawlée | 🟠 P1 | ~210 | Tier 0 + maillage + IndexNow |
| A-10 | lastmod uniformes | 🟠 P1 | milliers | lastmod réel villes |
| A-11 | X-Robots-Tag stub non câblé | 🟡 P2 | ~1100 | Câbler après A-01 |
| A-12 | Querystrings sitemap | ✅ | — | RÉFUTÉ |
| A-13 | noindex privés/DROM | ✅ | — | by-design |
| A-14 | Identité légale placeholder (Trust) | 🟠 P1 | site-wide | Renseigner SIREN/adresse/tél |
| A-15 | Reviews schema OK / avis villes à auditer | 🟡→🟠 | villes | Ne pas falsifier ; auditer avis |
| A-16 | sameAs réduit / 0 certif / LinkedIn à vérifier | 🟡 P2 | site-wide | Profils réels + Qualiopi schema |
