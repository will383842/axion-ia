# G2 — Rendu sans JS (HTML brut servi aux crawlers)

- **Date/heure des mesures** : 2026-08-15, **00:35:24 → 00:54:51 UTC** (chaque
  mesure horodatée ci-dessous). Toutes les sondes sont des **GET/HEAD** avec
  `accept-encoding: identity` ou `br` — aucune écriture, aucune soumission.
- **Fenêtre deploy** : dernier workflow `deploy-coolify.yml` terminé
  **2026-08-14 20:00:36Z** (`gh run list -L 3`, lu à 00:55 UTC ; runs
  précédents 18:36:05Z succès, 18:55:24Z annulé). Mes mesures tombent
  **~4 h 35 après** l'atterrissage → **hors fenêtre ISR ≤ 1 h**. Build servi
  pendant toutes les mesures : `x-axion-build-sha: f51d544b64c8ad50fc870d87b9941d6ce5419d7e`
  (stable sur les 45 requêtes).
- **Périmètre réellement couvert** : HTML brut (sans exécution JS) de **25 URLs**
  couvrant 12 familles de gabarits — home, audit, formations, tarifs, à-propos,
  contact, blog (hub + article), FAQ (hub + fiche), glossaire (hub + fiche),
  avis, observatoire, connaissances (hub + fiche KB), cas-concrets (fiche),
  implantations (hub + ville), ville×service (`audit/par-ville`,
  `formations/par-ville`), `/appel`, `/recherche` — **× 3 user-agents**
  (Chrome, Googlebot, PerplexityBot) sur 15 d'entre elles. Analysé pour chacune :
  JSON-LD réellement présent dans le HTML servi, présence du contenu principal
  sans hydratation, anatomie octet par octet du document (head/style/flight
  RSC/DOM/texte), en-têtes CSP, comportement du bandeau de consentement,
  placeholders de streaming Suspense, et diff inter-UA (cloaking).
- **Non couvert** (voir « Limites ») : tout ce qui exige un build, un
  `next dev`, un Lighthouse ou un rendu headless — interdit cette nuit
  (machine partagée).

## Résumé exécutif

Le rendu serveur est **structurellement sain** : sur les 25 URLs sondées, le
contenu principal (h1, h2/h3, corps, réponses FAQ, textes des 77 avis, données
de l'observatoire, mega-menu et footer) est **intégralement présent dans le
HTML brut**, sans Suspense différé, sans `ssr:false` sur du contenu, sans
consentement bloquant, et **sans le moindre cloaking** (15 pages × 3 UA :
octet pour octet identiques, à l'exception des `<meta sentry-trace>` par
requête). La CSP publique est en mode « soft » (`unsafe-inline`) : elle
n'empêche ni le parsing du JSON-LD inline ni l'injection différée.
**Le vrai problème est le rapport signal/bruit du document** : sur chaque page,
**920 650 octets de CSS** sont sérialisés **4 fois** (1 `<style>` de 234 Ko en
tête + 3 copies intégrales dans le flux RSC), soit **76 à 81 % du HTML** d'une
fiche, dont le texte utile ne représente que **0,33 à 1,8 %** — et le `<body>`
ne commence qu'au **239ᵉ Ko**. S'y ajoute la confirmation, mesurée famille par
famille, que le JSON-LD des ~4 300 pages pSEO n'existe pas dans le HTML servi
(1 seul bloc résiduel de niveau layout sur `/audit/par-ville/lyon`).

## Findings

### [P1] Le HTML brut de chaque page transporte 920 Ko de CSS dupliqués 4 fois — 76 à 81 % du document, contenu utile 0,3 à 1,8 %

- **Symptôme** : sur toutes les familles sondées, le HTML servi contient la
  même feuille de style compilée **quatre fois** : une fois en `<style>` inline
  dans le `<head>` (**234 163 o**) et **trois fois de plus** ré-encodée dans le
  flux RSC (`self.__next_f.push`, **3 × 228 829 o = 686 487 o**). Total constant
  et identique sur toutes les pages : **920 650 o de CSS par document**. Le
  `<body>` ne commence donc qu'à l'octet **239 383** et le `<h1>` à l'octet
  **261 363** (fiche glossaire). Un fetcher qui tronque à 128 ou 256 Ko —
  pratique courante des agrégateurs et des fetchers LLM — ne récupère
  **strictement aucun contenu**, seulement du CSS et des `<meta>`.
- **Preuve code** :
  - `next.config.ts:215` — `inlineCss: true` (Next 16 natif, activé Sprint 24bis
    pour supprimer les ressources render-blocking détectées par LHCI).
  - `next.config.ts:209-211` — le commentaire d'accompagnement chiffre le
    trade-off à « **~5-10 KB de CSS inline par route SSG** ». La mesure live
    donne **920 Ko décodés**, soit **~100 ×** l'hypothèse retenue au moment de
    la décision. L'hypothèse « Cloudflare Brotli compresse bien le CSS répété »
    est exacte pour le réseau (cf. mesures) mais ne dit rien du coût **décodé**,
    qui est celui que paient les parseurs et les extracteurs de texte.
  - `src/app/[locale]/layout.tsx:26` — `import "../globals.css"` (import unique
    du chemin public) ; `src/app/not-found.tsx:10` et `src/app/global-error.tsx:8`
    importent également `globals.css` — piste probable de la **triple** copie
    dans le flux RSC (layout + page + frontière d'erreur), **[À CONFIRMER]**
    car non reproductible sans build local (interdit cette nuit).
- **Preuve live** (00:52:34Z, UA PerplexityBot, `accept-encoding: identity`) :

  | URL | HTML décodé | `<style>` head | copies CSS flight | % CSS | texte visible | % texte |
  |---|---|---|---|---|---|---|
  | `/fr/glossaire/agent` | 1 139 472 o | 234 163 o | 3 × 228 829 | **80,8 %** | 3 751 o | 0,33 % |
  | `/fr/audit/par-ville/lyon` | 1 212 386 o | 234 163 o | 3 × 228 829 | **75,9 %** | 11 337 o | 0,94 % |
  | `/fr/tarifs` | 1 220 419 o | 234 163 o | 3 × 228 829 | **75,4 %** | 7 361 o | 0,60 % |
  | `/fr/blog/mentor-ia-dirigeant-…-grenoble` | 1 335 997 o | 234 163 o | 3 × 228 829 | **68,9 %** | 23 230 o | 1,74 % |
  | `/fr` | 1 745 912 o | 234 163 o | 3 × 228 829 | 52,7 % | 31 887 o | 1,83 % |
  | `/fr/faq` | 3 428 379 o | 234 163 o | 3 × 228 829 | 26,9 % | 280 669 o | 8,19 % |
  | `/fr/implantations` | 8 754 441 o | 234 163 o | 3 × 228 829 | 10,5 % | 838 260 o | 9,58 % |

  Offsets (00:52:52Z) : `/fr/glossaire/agent` → `<body>` à 239 383, `<h1>` à
  261 363, `</main>` à 274 530, puis les 3 copies CSS aux offsets 301 024 /
  545 407 / 774 483. `/fr` → `</main>` à 593 991.
  Vérification directe du chunk (00:49:30Z) :
  `GET /_next/static/css/366c33068f15aaf4.css` → **222 977 o** (Tailwind v4.3.0),
  `GET /_next/static/css/67ab877011d196fb.css` → 11 090 o (font-face) ; les deux
  sont référencés par l'unique `<style data-precedence="next">` du `<head>`.
- **Root-cause** : `inlineCss: true` inline la feuille dans le `<head>` **et**
  fait sérialiser son contenu dans le flux RSC (pour que les navigations client
  disposent du style) ; la duplication ×3 du flux amplifie mécaniquement le
  coût. La feuille elle-même pèse 223 Ko parce que Tailwind v4 est invoqué sans
  périmètre de sources (cf. finding suivant).
- **Patch prescrit** — par ordre de risque croissant, **ne pas commencer par le
  dernier** :
  1. **(S, sans risque perf)** réduire la taille de la feuille à la source :
     voir le finding `[P2]` suivant (−28 Ko × 4 = **−112 Ko par page**).
  2. **(S, à instrumenter)** vérifier si les imports `globals.css` de
     `not-found.tsx:10` / `global-error.tsx:8` provoquent les copies RSC 2 et 3
     ; si oui, faire porter ces deux frontières par le CSS déjà chargé
     (ou par un fichier minimal dédié). Gain potentiel : **−457 Ko décodés par
     page** sans toucher au LCP.
  3. **(M, STOP & ASK Will + ADR obligatoire)** repasser `inlineCss: false`
     avec `<link rel="stylesheet">` + `preload`. **Cela contredit frontalement
     la décision Sprint 24bis** (suppression des ressources render-blocking,
     gain FCP/LCP ~50-150 ms p75 documenté dans le commentaire) et rougirait
     potentiellement la gate LHCI. À ne proposer que si 1 et 2 ne suffisent pas.
- **Effort** : S (1 et 2) / M (3). **Impact GEO/AEO** : **moyen-fort** — aucun
  moteur n'est « cassé » (Google traite jusqu'à 15 Mo de HTML, et le contenu
  est bien là), mais (a) tout fetcher LLM à cap d'octets ou de tokens ingère
  du CSS au lieu du texte, (b) le budget de crawl décodé est multiplié par ~6
  sur 17 629 routes, (c) le ratio texte/code de 0,3-1,8 % est un signal de
  qualité défavorable pour les heuristiques d'extraction de contenu principal.
- **Risque de régression** : **fort sur le patch 3**, faible sur 1 et 2.
  **Do-not-touch** : `lighthouserc.json`, `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`,
  le bloc `@theme` de `src/app/globals.css` (intouchable, ADR 0028),
  `src/app/admin.css` (cloisonnement admin, gate `qualiopi:isolation-check`),
  le contrat `stub.invalid`.

### [P2] ~28 Ko d'utilitaires Tailwind réservés à la console admin sont embarqués dans la feuille publique — donc ×4 sur les 17 629 routes publiques

- **Symptôme** : la feuille servie aux pages publiques contient **322
  occurrences** de `--color-admin-*` et **256** de `--space-admin-*` sous forme
  d'utilitaires arbitraires (`.bg-[color:var(--color-admin-accent)]`,
  `.bg-[color:var(--color-admin-bg-subtle)]`, …) — **291 règles, 27 864 octets**
  — alors qu'aucune page publique ne peut les utiliser. Avec la quadruple
  sérialisation du finding précédent, cela représente **~112 Ko décodés de CSS
  mort par page publique**.
- **Preuve code** :
  - `src/app/globals.css:1` — `@import "tailwindcss";` **sans aucune directive
    `@source`** (vérifié : `grep -n "@source" src/app/*.css` → 0 résultat).
    Tailwind v4 auto-détecte donc l'ensemble des sources du projet, y compris
    `src/app/[locale]/(admin)/**` et `src/components/admin/**`, et génère leurs
    utilitaires dans l'unique feuille publique.
  - `src/app/admin.css:19` (`@layer admin-tokens`) et son en-tête l. 6-13 : le
    fichier est importé **uniquement** par
    `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:96-97` — le cloisonnement
    des *déclarations* est bien respecté ; ce sont les **classes utilitaires
    générées** qui fuient, pas le fichier.
  - Confirmation : la feuille publique contient **0** occurrence de `.admin-`
    (les 1 250 classes relocalisées par l'ADR 0028 ne fuient pas) et **0**
    déclaration `:where(.admin-layout…)` — donc le vecteur est bien la
    génération Tailwind, pas un import parasite.
- **Preuve live** (00:49:30Z) : `GET /_next/static/css/366c33068f15aaf4.css`
  (chunk référencé par le `<style>` de `/fr/glossaire/agent`) → 222 977 o,
  322 × `color-admin`, 0 × `.admin-`. Extrait relevé :
  `.bg-\[color\:var\(--color-admin-bg\)\]{background-color:var(--color-admin-bg)}`.
- **Root-cause** : périmètre de scan Tailwind non restreint dans `globals.css`.
- **Patch prescrit** : déclarer explicitement les sources publiques dans
  `globals.css` (`@source "../components"; @source "../app";` + `@source not`
  sur les répertoires admin, syntaxe Tailwind v4), ou déplacer le scan admin
  dans `admin.css`. Vérifier ensuite par diff que **aucune** classe utilisée en
  admin ne disparaît (la console partage `src/components/admin/ui/**`).
- **Effort** : S. **Impact GEO/AEO** : faible-moyen (−112 Ko décodés/page,
  −12,5 % de la feuille, sans aucun effet visuel public attendu).
- **Risque de régression** : **moyen** — un `@source` trop restrictif casse
  visuellement la console admin (classes non générées) sans rien casser côté
  public ; à valider page par page en admin avant merge.
  **Do-not-touch** : `src/app/admin.css` (ADR 0028), le `@theme` de
  `globals.css`, `check-radius.ts`, la gate `qualiopi:isolation-check`.

### [P1 — CORROBORATION de B2/B4/D4, pas un nouveau finding] Le JSON-LD des familles pSEO est confirmé absent du HTML servi — mesure famille par famille

Je ne ré-ouvre pas le constat (établi par B2, B4, D4 et rappelé comme constat
transverse) ; j'apporte la **mesure brute par famille dans le HTML sans JS**,
qui manquait, et la quantification du différentiel.

- **Preuve live** (00:35:24 → 00:42:04Z, UA PerplexityBot et Googlebot,
  résultats identiques) — nombre de blocs `<script type="application/ld+json">`
  **réellement présents dans le HTML servi**, et types agrégés :

  | Famille (URL sondée) | blocs inline | types présents dans le HTML brut |
  |---|---|---|
  | `/fr/formations` | 12 | Course, ItemList, HowTo, FAQPage, Service, CollectionPage, BreadcrumbList, Organization, WebSite, SiteNavigationElement, ImageObject |
  | `/fr/blog/mentor-ia-…-grenoble` | 9 | BlogPosting, FAQPage, ItemList, Person, BreadcrumbList, … |
  | `/fr/audit` | 7 | Service, HowTo, FAQPage, CollectionPage, … (ItemList absent) |
  | `/fr` | 6 | Organization, WebSite, ProfessionalService, Service, FAQPage, ImageObject |
  | `/fr/implantations/auvergne-rhone-alpes/lyon` | **2** | Organization, WebSite, SiteNavigationElement, **Place** — rien d'autre |
  | `/fr/implantations/auvergne-rhone-alpes/annecy` | **2** | idem Lyon |
  | `/fr/audit/par-ville/lyon` | **1** | Organization, WebSite, SiteNavigationElement — **aucun schéma de page** |
  | `/fr/formations/par-ville/lyon` | **1** | idem |
  | `/fr/glossaire` (hub) | 3 | BreadcrumbList, DefinedTermSet — **ItemList absent** |
  | `/fr/connaissances` (hub) | 3 | BreadcrumbList, CollectionPage — **ItemList absent** |

  Autrement dit : sur les gabarits ville×service, **100 % du JSON-LD de page**
  (Service+Offer, AggregateOffer, LocalBusiness, FAQPage, HowTo, Person,
  ItemList) est absent du document ; ne subsiste que le graphe de layout.
- **Preuve code** : `src/components/marketing/JsonLd.tsx:39` et
  `src/components/marketing/JsonLdGraph.tsx:75` (`strategy !== "inline"` →
  rendu via `next/script`, donc hors HTML SSR) ; **54 appels `afterInteractive`
  répartis sur 31 fichiers** hors analytics/booking/chatbot (comptage
  `grep -rn afterInteractive --include=*.tsx src/app src/components`), dont
  `VilleServicePageTemplate.tsx`, `implantations/[region]/[ville]/page.tsx`,
  `VilleFaqGeolocalisee.tsx`, `secteurs/**`, `stack-ia/**`, `centre-aide/**`,
  `glossaire/page.tsx`, `connaissances/page.tsx`, `audit/page.tsx`.
  Nota : les occurrences `afterInteractive` de
  `src/app/[locale]/layout.tsx:317-327` concernent **Plausible/Clarity**, pas
  du JSON-LD — pas de faux positif à leur sujet.
- **Point positif mesuré** : le **contenu textuel** des FAQ ville, lui, est bien
  server-rendered (`/fr/audit/par-ville/lyon` : 11 337 o de texte visible,
  9 h2/h3) — seule la couche machine manque. La conversion `inline` est donc un
  gain net de lisibilité machine sans réécriture de contenu.
- **Patch prescrit** : celui de B4/D4 (basculer les schémas d'entité en
  `strategy="inline"` sur les gabarits indexables). **Mon apport de mesure
  change le calcul de risque** : un graphe ville inline pèse 2-10 Ko à comparer
  aux **920 650 o de CSS déjà présents dans le même document** — l'argument
  « TBT/poids HTML » qui a motivé `afterInteractive` est, à ce niveau de bruit,
  numériquement négligeable (+0,2 à +0,9 % du document).
- **Effort** : M. **Impact GEO/AEO** : fort. **Risque de régression** : moyen
  (gate `lhci` sur TBT). **Do-not-touch** : `JsonLd.tsx`/`JsonLdGraph.tsx`
  eux-mêmes (contrat partagé), `Plausible.tsx`, `Clarity.tsx`.

### [P2] Fiches courtes : ~300 mots de contenu unique dans le HTML brut, dont la moitié du texte de page est du chrome partagé

- **Symptôme** : mesure du texte visible extrait du HTML brut, préfixe (nav
  mega-menu) et suffixe (footer) communs isolés par comparaison inter-pages :
  **976 caractères de nav + 955 de footer = 1 931 c. de chrome identique sur
  toutes les pages**. Sur les fiches courtes, ce chrome représente **~52 %** du
  texte total.

  | URL | texte total | unique (hors chrome) | part unique | ≈ mots uniques |
  |---|---|---|---|---|
  | `/fr/glossaire/agent` | 3 751 c. | 1 820 c. | 48,5 % | ~303 |
  | `/fr/cas-concrets/industrie-comptabilite` | 3 594 c. | 1 663 c. | 46,3 % | ~277 |
  | `/fr/connaissances/kb-fact-roi-ia-050-fr` | 4 906 c. | 2 975 c. | 60,6 % | ~496 |
  | `/fr/faq/geo-france` | 7 788 c. | 5 857 c. | 75,2 % | ~976 |
  | `/fr/audit/par-ville/lyon` | 11 337 c. | 9 406 c. | 83,0 % | ~1 568 |

- **Preuve live** : 00:54:51Z, UA PerplexityBot, extraction du `<body>` après
  suppression de `<script>`/`<style>` et des balises.
- **Root-cause** : gabarits éditoriaux courts (glossaire, cas-concrets) + un
  chrome volumineux (mega-menu « 21 formations » + footer) rendus sur chaque
  page — comportement normal, mais qui laisse peu de matière unique.
- **Patch prescrit** : **aucun côté rendu** (le chrome est légitime et
  server-rendered, ce qui est le bon comportement). Signalé ici uniquement
  comme **entrée pour les squads D/C** (profondeur éditoriale des fiches
  glossaire/cas-concrets) — cf. D2 sur l'extractibilité et C5 sur la
  duplication. Ne pas traiter comme un défaut de rendu.
- **Effort** : n/a. **Impact GEO/AEO** : faible côté G2.

## Points vérifiés SAINS (résultats négatifs, à valeur de non-régression)

1. **Zéro cloaking.** 15 pages × 3 UA (Chrome / Googlebot / PerplexityBot),
   00:35:24 → 00:35:31Z : **longueurs de document identiques à l'octet** sur les
   12 pages en cache edge. Les 3 pages dynamiques (`/fr/appel`, `/fr/avis`,
   `/fr/observatoire-ia`) diffèrent de 27 à 74 octets ; diff réalisé à 00:51:07Z
   avec **le même UA deux fois** → la divergence apparaît toujours à l'offset
   ~239 000 sur `<meta name="sentry-trace">` / `baggage` (identifiant de trace
   par requête), **jamais sur du contenu**. Confirmation code : `src/proxy.ts`
   ne lit **aucun** `user-agent` (grep : seules occurrences = commentaires sur
   Googlebot et le header `X-Robots-Tag` des stubs pSEO, l. 320-337). Il n'y a
   donc pas de branche UA capable de produire du cloaking.
2. **La CSP n'empêche rien côté crawler.** Header relevé à 00:38:32Z sur
   `/fr/audit` (UA Googlebot) :
   `script-src 'self' 'unsafe-inline' 'unsafe-eval' …` — mode « soft ».
   `src/lib/csp.ts:180-186` (`isStrictCspPath`) réserve la CSP stricte
   (nonce + `strict-dynamic`) aux chemins contenant `/${ADMIN_URL_PREFIX}` ;
   `src/lib/csp.ts:60-80` documente explicitement pourquoi le public reste en
   soft (bug « pages vides » du 2026-05-09). Conséquence : le JSON-LD inline
   est parsable, et l'injection `afterInteractive` s'exécute correctement chez
   un moteur qui rend le JS (Googlebot 2ᵉ passe). **La CSP n'est donc pas une
   cause aggravante du finding JSON-LD.**
3. **Le bandeau de consentement ne masque rien aux robots.**
   `src/components/analytics/CookieConsent.tsx:26-32` : « le banner n'est
   JAMAIS rendu côté serveur » (garde `useIsHydrated`, l. 227). Vérifié live :
   aucune trace du bandeau ni d'overlay dans le HTML brut des 25 URLs ; aucun
   contenu éditorial n'est gaté derrière le consentement (seuls Clarity et le
   widget Calendly le sont).
4. **Aucun contenu différé par Suspense.** 00:53:54Z, 6 pages :
   `$RC(` = 0, `<template` = 0, marqueurs `B:0` = 0 → tout le contenu est
   servi **à sa place définitive** dans le flux initial, aucun déplacement DOM
   par script n'est requis.
5. **Un seul `ssr: false` dans tout le code public** :
   `src/components/chatbot/ChatWidgetMount.tsx:30` (widget de chat) — aucun
   contenu indexable concerné.
6. **Les réponses RSC ne peuvent pas être servies à un crawler.** 00:53:28Z,
   `GET /fr/avis` avec `RSC: 1` → `content-type: text/x-component`,
   `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`,
   `cf-cache-status: DYNAMIC`. Le risque classique « le CDN ignore `Vary: rsc`
   et sert le flux RSC en HTML » est donc **neutralisé à la source** par le
   `no-store`. (Le `Vary: rsc, next-router-state-tree, …` est bien émis sur
   toutes les réponses HTML.)
7. **Cohérence FAQ visible ↔ FAQPage JSON-LD** : 00:51:44Z, sur `/fr`,
   `/fr/audit`, `/fr/formations`, `/fr/tarifs` → **33 questions** déclarées en
   FAQPage inline, **0 réponse absente du DOM visible** (test : les 60 premiers
   caractères de chaque `acceptedAnswer.text` retrouvés dans le texte extrait).
   Aucune exposition au motif « FAQ structurée non visible sur la page ».
8. **Contenu principal intégralement server-rendered** sur les gabarits à
   risque : `/fr/avis` (texte intégral des avis + réponses d'Axion-IA présents,
   16 072 c.), `/fr/observatoire-ia` (séries de données présentes en clair,
   16 160 c.), `/fr/faq` (280 669 c., 1 656 liens internes),
   `/fr/implantations` (838 260 c.). `/fr/recherche` est quasi vide (2 293 c.)
   mais est `noindex, follow` (confirmé par C4) — comportement attendu.
9. **`AggregateRating` présent dans le HTML brut de `/fr`** à 00:54:18Z
   (`ratingValue: 4.9, reviewCount: 77`, `cf-cache-status: HIT`, `age: 1135`),
   ~4 h 50 après le deploy → **corrobore le diagnostic A3/G3** : la disparition
   est bien un phénomène de fenêtre post-deploy, pas un défaut de rendu. À noter
   pour B6 : `/fr/a-propos` n'en porte pas (choix de gabarit, hors G2).

## Mesures brutes

### Sonde multi-UA (00:35:24 → 00:35:31Z) — 15 pages × 3 UA

| URL | statut | HTML (o) | texte (o) | blocs JSON-LD | h2 | liens internes | `cf-cache-status` | identique Googlebot/Chrome/Perplexity |
|---|---|---|---|---|---|---|---|---|
| `/fr` | 200 | 1 745 912 | 30 727 | 6 | 11 | 150 | HIT (age 2) | **oui** |
| `/fr/audit` | 200 | 2 161 709 | 18 992 | 7 | 16 | 140 | HIT | **oui** |
| `/fr/formations` | 200 | 2 085 498 | 19 302 | 12 | 19 | 138 | HIT | **oui** |
| `/fr/tarifs` | 200 | 1 220 419 | 7 256 | 5 | 7 | 94 | MISS→HIT | **oui** |
| `/fr/a-propos` | 200 | 1 192 947 | 8 121 | 6 | 3 | 89 | MISS→HIT | **oui** |
| `/fr/contact` | 200 | 1 147 141 | 3 429 | 3 | 0 | 88 | HIT (age 6943) | **oui** |
| `/fr/blog` | 200 | 1 346 637 | 5 905 | 5 | 3 | 116 | MISS→HIT | **oui** |
| `/fr/faq` | 200 | 3 428 379 | 268 779 | 6 | 11 | 1 656 | EXPIRED→HIT | **oui** |
| `/fr/glossaire` | 200 | 1 228 961 | 11 864 | 3 | 0 | 148 | MISS→HIT | **oui** |
| `/fr/avis` | 200 | 1 465 534 | 16 135 | 6 | 7 | 125 | BYPASS | oui (Δ 91 o = sentry-trace) |
| `/fr/implantations/auvergne-rhone-alpes/lyon` | 200 | 1 264 095 | 11 461 | **2** | 8 | 105 | MISS→HIT | **oui** |
| `/fr/observatoire-ia` | 200 | 1 506 815 | 16 231 | 5 | 12 | 88 | BYPASS | oui (Δ ≤ 74 o = sentry-trace) |
| `/fr/connaissances` | 200 | 1 308 097 | 20 405 | 3 | 1 | 136 | EXPIRED→HIT | **oui** |
| `/fr/plan-du-site` | **404** | — | — | — | — | — | BYPASS | oui (404 pour les 3 UA — déjà relevé P2 par C4, page inexistante) |
| `/fr/recherche` | 200 | 1 111 078 | 2 293 | 2 | 0 | 87 | BYPASS | **oui** |

### Sonde pages profondes (00:42:01 → 00:42:04Z, UA PerplexityBot)

| URL | statut | HTML (o) | flux RSC (o / %) | texte (o / %) | blocs JSON-LD | h1 présent |
|---|---|---|---|---|---|---|
| `/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` | 200 | 1 335 997 | 934 303 / 70 % | 22 925 / 1,7 % | 9 | oui |
| `/fr/faq/geo-france` | 200 | 1 219 150 | 878 787 / 72 % | 7 521 / 0,6 % | 4 | oui |
| `/fr/connaissances/kb-fact-roi-ia-050-fr` | 200 | 1 183 454 | 857 260 / 72 % | 4 691 / 0,4 % | 7 | oui |
| `/fr/glossaire/agent` | 200 | 1 139 472 | 838 259 / 74 % | 3 612 / 0,3 % | 3 | oui |
| `/fr/audit/par-ville/lyon` | 200 | 1 212 386 | 885 383 / 73 % | 11 084 / 0,9 % | **1** | oui |
| `/fr/formations/par-ville/lyon` | 200 | 1 213 538 | 885 962 / 73 % | 11 317 / 0,9 % | **1** | oui |
| `/fr/implantations/auvergne-rhone-alpes/annecy` | 200 | 1 263 528 | 912 591 / 72 % | 11 025 / 0,9 % | **2** | oui |
| `/fr/appel` | 200 | 2 082 913 | 1 347 724 / 65 % | 5 327 / 0,3 % | 3 | oui |
| `/fr/cas-concrets/industrie-comptabilite` | 200 | 1 138 398 | 838 205 / 74 % | 3 487 / 0,3 % | 4 | oui |
| `/fr/secteurs/sante` | **404** | — | — | — | — | — (slug probablement inexistant ; hors périmètre G2, cf. C3) |

### Poids réseau réel vs poids décodé (00:52:18Z, `accept-encoding: br, gzip`)

| URL | transféré (compressé) | décodé | facteur | TTFB |
|---|---|---|---|---|
| `/fr` | 131 263 o | 1 745 912 o | ×13,3 | 106 ms |
| `/fr/faq` | 305 995 o | 3 428 379 o | ×11,2 | 161 ms |
| `/fr/implantations` | **640 529 o** | 8 754 441 o | ×13,7 | 185 ms |
| `/fr/glossaire/agent` | 87 116 o | 1 139 472 o | ×13,1 | 104 ms |
| `/fr/audit/par-ville/lyon` | 94 761 o | 1 212 386 o | ×12,8 | 87 ms |
| `/fr/blog/mentor-ia-…-grenoble` | 109 068 o | 1 335 997 o | ×12,3 | 88 ms |

Lecture honnête : **le coût réseau reste maîtrisé** (Brotli fait très bien son
travail sur du CSS répété — l'hypothèse du commentaire `next.config.ts:210`
est exacte sur ce point) ; c'est le **coût décodé** (parseurs, extracteurs,
budgets de tokens des fetchers LLM) qui est hors norme. `/fr/implantations` est
la seule page dont le coût réseau est lui-même problématique (640 Ko compressés).

### En-têtes constants relevés (00:35 → 00:54Z)

- `content-security-policy` présent sur 15/15 pages, **mode soft** partout ;
  `content-security-policy-report-only` : absent.
- `x-robots-tag` : **absent** de toutes les pages sondées (aucun noindex
  parasite).
- `vary: Accept-Encoding` + `vary: rsc, next-router-state-tree,
  next-router-prefetch, next-router-segment-prefetch` sur 100 % des réponses.
- `cache-control` HTML : `s-maxage=3600, stale-while-revalidate=31532400`.
- `x-axion-build-sha` : `f51d544b64c8ad50fc870d87b9941d6ce5419d7e` (constant).
- `<noscript>` : **0 occurrence** sur toutes les pages (cohérent : le contenu
  étant intégralement SSR, aucun fallback noscript n'est nécessaire).

## Limites

- **Aucune mesure de laboratoire.** Interdiction explicite de lancer un build,
  `pnpm dev`, Lighthouse local ou une suite de tests (machine de Will, nuit).
  Je ne peux donc **pas** chiffrer le delta TBT/LCP réel d'un passage
  `inlineCss: false` ni d'un basculement `afterInteractive → inline` : ces deux
  patchs restent à instrumenter en CI (`pnpm lhci`) avant merge.
- **La triple copie CSS dans le flux RSC est mesurée mais sa cause exacte est
  une hypothèse** (imports `globals.css` de `not-found.tsx` /
  `global-error.tsx` créant des frontières supplémentaires). Non reproductible
  sans build → marquée **[À CONFIRMER]** dans le finding.
- **Les seuils de troncature des fetchers LLM ne sont pas documentés
  publiquement** (Perplexity, OAI-SearchBot, Claude-SearchBot). L'affirmation
  « un fetcher qui tronque à 256 Ko ne voit rien » est un **calcul d'exposition**
  fondé sur les offsets mesurés (contenu entre les octets 239 000 et 300 000),
  pas une perte observée. Le seul moyen de la confirmer serait de croiser avec
  les logs de crawl (F7) — hors de mon périmètre.
- **Rendu de 2ᵉ passe non testé.** Je mesure le HTML **sans** exécution JS
  (c'est ma mission) ; je ne peux pas confirmer par observation que Googlebot
  finit par voir le JSON-LD `afterInteractive` — outils navigateur réservés à
  la session principale, aucun rendu headless lancé.
- **Échantillonnage** : 25 URLs / 12 familles. Les familles non sondées
  (carrières, presse, comparaisons, guides, implementation par-fonction,
  stack-ia, secteurs, centre-aide) partagent le même `[locale]/layout.tsx`
  donc les mêmes 920 Ko de CSS — l'extrapolation du finding P1 est structurelle.
  En revanche leur inventaire JSON-LD inline n'a **pas** été mesuré ici (il
  l'est partiellement par B4).
- **`/fr/secteurs/sante` → 404** : je n'ai pas cherché le slug correct (surface
  C3/D-squad) ; ce n'est pas un constat de rendu.
- **Pas de vérification DB** (non autorisée pour G2) : les chiffres d'avis
  (77 / 4,9) sont repris du JSON-LD servi, pas de la base — la vérification
  source appartient à B6.
