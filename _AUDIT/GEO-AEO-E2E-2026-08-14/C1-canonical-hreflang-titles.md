# C1 — canonical / hreflang / titles

- **Date** : 2026-08-14, mesures live 18:02–18:08 UTC (build servi : `x-axion-build-sha: e754f69` — deploy 17:33 UTC pas encore atterri, donc état stable du deploy ~14:57 UTC).
- **Périmètre couvert** : `buildProductMetadata()` (`src/lib/seo.ts`), `metadataBase` (layout racine + not-found + maintenance), politique hreflang avec EN désactivé (HTML **et** en-têtes HTTP), canonicals absolus, longueurs title/description (`meta-length.ts`, `truncateMetaDescription`), A/B meta (`ab-test-meta.ts`), 26 URLs live testées (20 stratégiques + galerie/blog paginé/noindex/EN).
- **Hors périmètre** (laissé aux agents dédiés) : chaînes de redirections (C3), facettes/pagination canonique (C5), OG images (C2), sitemaps (A2-A4).

## Résumé exécutif

La fondation est saine : `metadataBase` correct partout (filet anti-localhost `site-url.ts`), canonicals **absolus** et auto-référents sur les 20 pages stratégiques, hreflang `en` correctement **omis du HTML** site-wide via `isEnLocaleDisabled()`. Mais un **P0 contredit tout ce travail** : le middleware next-intl émet sur **chaque page** un en-tête HTTP `Link` avec `hreflang="en"` pointant vers des URLs qui 301, et un `x-default` vers des URLs non préfixées qui redirigent — l'inverse exact de la policy HTML. Côté titres, le template racine `%s · Axion-IA` double le suffixe de marque sur **~870 pages indexables** (867 pages galerie + blog paginé + hub galerie filtré). Enfin, les pages sans `alternates` héritent silencieusement du canonical `/fr` (home) du layout — confirmé live sur 3 pages.

## Findings

### [P0] En-tête HTTP `Link` : hreflang `en` vers des 301 + `x-default` vers des URLs redirigeantes, sur TOUTES les pages

- **Symptôme** : chaque réponse HTML porte un header `Link: <…/fr/audit>; hreflang="fr", <…/en/audit>; hreflang="en", <…/audit>; hreflang="x-default"`. Or `/en/*` répond 301 → FR (EN désactivé) et l'URL non préfixée (`/audit`) redirige aussi. Le HTML, lui, n'émet QUE `fr` + `x-default=/fr` (gating volontaire). Google lit le hreflang **dans les deux canaux** (HTML + HTTP header) → signaux contradictoires site-wide, alternates vers des redirections (gaspillage crawl, impressions résiduelles `/en/*` en GSC), et deux `x-default` différents pour la même page.
- **Preuve code** :
  - `src/proxy.ts:36` — `const handleI18nRouting = createIntlMiddleware(routing);` sans désactivation des alternate links.
  - `src/i18n/routing.ts:12-15` — `defineRouting({ … localePrefix: "always" })` **sans** `alternateLinks: false` (défaut next-intl = `true`).
  - `node_modules/next-intl/dist/esm/development/middleware/middleware.js:159` — le header est émis dès que `resolvedRouting.alternateLinks && locales.length > 1` ; `routing.locales = ["fr","en"]` reste déclaré (décision actée, à ne pas toucher).
  - Contraste avec le gating HTML : `src/lib/seo.ts:262-297` (omission `languages.en` si `isEnLocaleDisabled()`) et `src/app/[locale]/layout.tsx:148-157` (même gate).
- **Preuve live** (2026-08-14 18:06:48 UTC) : header `Link` avec `hreflang="en"` observé sur `/fr`, `/fr/audit`, `/fr/formations`, `/fr/a-propos` (→ `/en/about`, qui 301 → `/fr/a-propos`, vérifié 18:03:13 UTC), `/fr/blog`, `/fr/components`. `x-default` = `https://axion-ia.com/audit` (URL sans locale, redirigeante) alors que le HTML déclare `x-default = https://axion-ia.com/fr/audit`.
- **Root-cause** : l'option `alternateLinks` de next-intl (défaut `true`) n'a jamais été alignée sur la désactivation runtime d'EN — le gating a été implémenté dans les metadata HTML uniquement.
- **Patch prescrit** : ajouter `alternateLinks: false` dans `defineRouting()` (`src/i18n/routing.ts`). Le hreflang reste alors porté exclusivement par le HTML (`buildProductMetadata` + layout), qui gère déjà le toggle `EN_LOCALE_ENABLED` correctement. Ne PAS retirer `en` de `routing.locales` (décision actée : garder la toggle).
- **Effort** : S (1 ligne + redeploy).
- **Impact GEO/AEO** : fort — supprime un signal hreflang mensonger émis sur 100 % des pages.
- **Risque de régression** : très faible. `alternateLinks` n'affecte QUE ce header (pas le routing, pas les redirects). Seul « coût » : à la ré-activation d'EN, le hreflang restera porté par le HTML seul — c'est déjà le canal de référence. **Do-not-touch** : le bloc 301 `/en/*` (`src/proxy.ts:39-55`), `routing.locales`, les `pathnames` mappings, `mapEnToFr`.

### [P1] Double suffixe de marque « · Axion-IA · Axion-IA » sur ~870 pages indexables

- **Symptôme** : le layout racine déclare `title.template = "%s · Axion-IA"` ; toute page qui renvoie une string de titre contenant DÉJÀ la marque (mais pas exactement le suffixe ` · Axion-IA` en fin — ou hors `buildProductMetadata`) se voit ré-apposer la marque. Titres SERP/Google Images sales sur un corpus massif.
- **Preuve code** :
  - `src/app/[locale]/layout.tsx:143` — template `"%s · Axion-IA"`.
  - `src/lib/seo.ts:277-279` — le bypass `{ absolute }` ne protège que les appels `buildProductMetadata` ET seulement le suffixe exact ` · Axion-IA`.
  - `src/app/[locale]/galerie/[slug]/page.tsx:66` — `title: tr.metaTitle ?? \`${tr.title} | Axion-IA\`` (string simple, marque « | Axion-IA » déjà dans la donnée) → template ré-appose.
  - `src/app/[locale]/galerie/page.tsx:56,67,72` — idem hub galerie (« · Axion-IA » et « | Axion-IA » en dur, retour string simple, hors `buildProductMetadata`).
  - `src/app/[locale]/blog/_views/BlogListingView.tsx:50` — `page > 1` : `"${titleBase} · page ${page}"` où `titleBase` finit par « · Axion-IA » → le titre ne finit plus par le suffixe → template ré-appose.
  - Pages noindex touchées aussi : `src/app/[locale]/not-found.tsx:24`, `src/app/[locale]/diagnostic/page.tsx:65`, `src/app/[locale]/simulateur/page.tsx` (~l.36).
- **Preuve live** (18:03–18:08 UTC) :
  - `/fr/galerie/axion-ia-hero-ville-villeurbanne-…` → `<title>Consultant IA Villeurbanne — Formation PME | Axion-IA · Axion-IA</title>` (3/3 slugs galerie testés touchés ; **867 URLs `/fr/galerie/` dans `/sitemaps/images-fr.xml`**, comptées 18:07:36 UTC — toutes indexables `index, follow`).
  - `/fr/galerie` (hub) → `Banque d'images IA — Visuels libres CC BY · Axion-IA · Axion-IA`.
  - `/fr/blog/page/2` → `Blog · méthodologie & cas d'usage IA · Axion-IA · page 2 · Axion-IA` (7 pages de pagination live → 6 touchées).
  - Noindex : `/fr/diagnostic`, `/fr/simulateur`, 404 (`Page introuvable · Page not found · Axion-IA · Axion-IA`).
- **Root-cause** : titres « pré-brandés » (données galerie générées avec `| Axion-IA`, constantes en dur) renvoyés en string simple sous un template racine, sans passer par le bypass de `buildProductMetadata`.
- **Patch prescrit** (au choix par surface, modèle correct existant : `certification-qualiopi/page.tsx:97` fait `title: { absolute: title }`) :
  1. `galerie/[slug]` + `galerie/page.tsx` : envelopper le titre en `{ absolute: … }` (la donnée DB `metaTitle` contient déjà la marque — ne pas la réécrire en masse).
  2. `BlogListingView.buildBlogListingMetadata` : construire `"Blog · méthodologie & cas d'usage IA · page N · Axion-IA"` (suffixe en DERNIER → le bypass de `buildProductMetadata` s'applique).
  3. `not-found.tsx` / `diagnostic` / `simulateur` : `{ absolute }` ou retirer la marque de la string (le template l'ajoutera une fois).
- **Effort** : S-M (5 fichiers, mécanique).
- **Impact GEO/AEO** : moyen-fort — 867 pages galerie sont un levier Google Images assumé ; un titre dupliqué dégrade CTR et crédibilité (Google réécrit souvent ces titres).
- **Risque de régression** : faible. **Do-not-touch** : la logique `TITLE_SUFFIX`/bypass de `src/lib/seo.ts:271-279` (elle est correcte), le template du layout (les ~135 pages `buildProductMetadata` en dépendent), les données `metaTitle` DB.

### [P1] Canonical hérité du layout : pages sans `alternates` annoncent `canonical = /fr` (home)

- **Symptôme** : le layout racine exporte `alternates: { canonical: "/fr", … }`. Next Metadata hérite les champs top-level absents de la page → toute page qui ne définit pas `alternates` déclare la **home** comme canonique d'elle-même.
- **Preuve code** : `src/app/[locale]/layout.tsx:153-156` (alternates au niveau layout) ; pages sans `alternates` : `src/app/[locale]/diagnostic/page.tsx:63-69` (title + robots, pas d'alternates), `src/app/[locale]/simulateur/page.tsx` (idem), `src/app/[locale]/components/page.tsx` (aucun export metadata).
- **Preuve live** (18:03:34 et 18:05:54 UTC) :
  - `/fr/diagnostic` → `canonical https://axion-ia.com/fr` + `noindex, nofollow` (signaux contradictoires : « je suis un duplicata de la home » + « ne m'indexe pas »).
  - `/fr/simulateur` → idem.
  - `/fr/components` → **200, `robots index, follow` hérités, `canonical → /fr`, title = title par défaut de la home** ; aucune `X-Robots-Tag` (la route n'est couverte que par `Disallow` robots.txt, vérifié 18:06:48 UTC — hors périmètre `isNoindexStubRoute`, `src/lib/seo-noindex-routes.ts:163-196` ne couvre que les stubs pSEO).
- **Root-cause** : `alternates` posé au layout pour la home, alors que la home définit déjà son propre canonical via `buildProductMetadata` (`src/app/[locale]/page.tsx:84-86`, `path: "/"`). Le bloc layout ne sert donc qu'à fuiter vers les enfants.
- **Patch prescrit** : retirer le bloc `alternates` du `generateMetadata` du layout (`layout.tsx:148-157`) — la home garde son canonical via `buildProductMetadata` ; les pages sans `alternates` n'annonceront plus RIEN (Google auto-sélectionne, comportement sain) au lieu d'un canonical faux. En complément : donner un `alternates.canonical` explicite à `/fr/diagnostic` et `/fr/simulateur` (self) et un `robots noindex` en dur à `/fr/components` (ou le retirer du build prod).
- **Effort** : S.
- **Impact GEO/AEO** : moyen (pages touchées aujourd'hui = noindex/disallow, dégât limité) mais **piège systémique** : toute future page sans `alternates` hérite silencieusement d'un canonical → home.
- **Risque de régression** : faible — vérifier après patch que la home émet toujours son canonical (elle le fait via `buildProductMetadata`). **Do-not-touch** : le `metadataBase` du layout (`layout.tsx:135-138`, vital pour résoudre les URLs relatives), le gate `isEnLocaleDisabled()` des `languages`.

### [P2] Meta descriptions stratégiques systématiquement tronquées avec « … »

- **Symptôme** : 11 des 26 pages testées (dont home, `/fr/audit`, `/fr/formations`, `/fr/tarifs`, `/fr/implementation`, `/fr/a-propos`, `/fr/appel`, `/fr/methodologie`, `/fr/implantations`, `/fr/sites-web-augmentes`) servent une description finissant par « … » : la source dépasse 158 caractères et `truncateMetaDescription` (`src/lib/seo.ts:176-181`) coupe. Le garde-fou fonctionne, mais la SERP affiche une phrase amputée sur les pages les plus stratégiques.
- **Preuve live** : home 18:02:27 UTC — `"…dès le lendemain de l'intervention…"`. Preuve code : les descriptions sources dans chaque `page.tsx` dépassent le budget.
- **Patch** : réécrire les ~11 descriptions sources sous 158 caractères (éditorial, pas de code). Incohérence associée : `truncateMetaDescription` coupe à **158** alors que le SSOT generator `META_LENGTH.metaDescription.max` = **160** (`src/server/content-gen/shared/meta-length.ts:27`) — une description générée à 159-160 car. conforme au prompt sera ellipsée au rendu. Aligner les deux constantes (158 partout, ou 160 partout).
- **Effort** : S. **Impact** : faible-moyen. **Risque** : nul.

### [P2] Descriptions pSEO villes coupées MI-MOT

- **Symptôme** : `/fr/audit/par-ville/lyon` (18:02:48 UTC) : `"…Quatre niv…"` — coupe en plein mot.
- **Preuve code** : `src/components/sections/VilleServicePageTemplate.tsx:231-233` — `serviceCopy.fr.hero.slice(0, 157) + "…"` (slice brut, sans frontière de mot), alors que `truncateMetaDescription` (coupure au dernier mot) existe et est appliquée APRÈS (donc sans effet, la string fait déjà ≤ 158).
- **Patch** : remplacer le `slice(0,157)` par `truncateMetaDescription(hero)` (import déjà disponible via `@/lib/seo`). Touche les ~480 villes indexables × 3-4 services.
- **Effort** : S. **Impact** : faible (cosmétique SERP à l'échelle pSEO). **Risque** : nul. **Do-not-touch** : la logique noindex/canonical hub du même fichier (l.248-262).

### [P2] Titres stratégiques > 60 caractères

- Mesures live : `/fr/implantations` = 84 car., `/fr/roi` = 82, `/fr/implantations/auvergne-rhone-alpes/grenoble` = 79, `/fr/un-a-un` = 68 — au-delà de la fourchette SSOT `META_LENGTH.metaTitle` 50-60 (`meta-length.ts:25`) : Google tronque ou réécrit. Marque en double dans le texte + suffixe sur `/fr/methodologie` (« Méthodologie Axion-IA · … · Axion-IA »), `/fr/avis`, `/fr/stack-ia`, `/fr/carrieres`, `/fr/guides`.
- **Patch** : passe éditoriale sur ~8 titres (raccourcir, retirer la marque du corps — le template la pose). **Effort** : S. **Impact** : faible-moyen (CTR). **Risque** : nul.

### [P2] Module A/B meta : code mort, cloaking-safe mais jamais branché

- **Preuve code** : `src/lib/seo/ab-test-meta.ts:42` — `selectMetaVariant` n'a **aucun appelant** hors tests (grep `selectMetaVariant|getActiveMetaABTest` = 0 usage) ; `getActiveMetaABTest` promis dans l'en-tête (l.9) **n'existe pas**. Design intrinsèquement cloaking-safe (hash SHA-256 déterministe de l'URL → même variant pour Googlebot et humains, `ab-test-meta.ts:42-50`) — aucun risque actif puisque rien n'est branché.
- **Patch** : soit brancher (Sessions 10+ du plan), soit corriger l'en-tête/retirer le module pour ne pas laisser croire qu'un test A/B tourne. **Effort** : S. **Impact** : nul aujourd'hui. **Risque** : nul.

### [P2] Codes hreflang incohérents : `fr` vs `fr-FR` selon la surface

- **Preuve live** (18:03:34 UTC) : `/fr/galerie` et `/fr/galerie/[slug]` émettent `hreflang="fr-FR"` ; tout le reste du site émet `hreflang="fr"`. Preuve code : `src/app/[locale]/galerie/page.tsx:84` (`"fr-FR"`) et `galerie/[slug]/page.tsx:87` vs `src/lib/seo.ts:291-294` (`fr`). Les deux sont valides isolément, mais l'hétérogénéité complique le débogage GSC et la cohérence des clusters.
- **Patch** : uniformiser sur `fr` (la granularité régionale n'apporte rien sur un site mono-pays). **Effort** : S. **Impact** : faible. **Risque** : nul.

## Mesures brutes

Toutes mesures GET sur `https://axion-ia.com`, 2026-08-14 18:02–18:08 UTC, build `e754f69`.

| URL | Status | Canonical | hreflang HTML | Title (verdict) |
|---|---|---|---|---|
| `/fr` | 200 | `/fr` self abs. | fr + x-default | 50 car. OK |
| `/fr/audit` | 200 | self abs. | fr + x-default | OK ; desc « … » |
| `/fr/interventions` | **308 → /fr/formations** (1 hop) | — | — | rename volontaire |
| `/fr/implementation` | 200 | self | fr + x-default | OK ; desc « … » |
| `/fr/un-a-un` | 200 | self | fr + x-default | 68 car. |
| `/fr/sites-web-augmentes` | 200 | self | fr + x-default | OK ; desc « … » |
| `/fr/appel` | 200 | self | fr + x-default | OK ; desc « … » |
| `/fr/contact` | 200 | self | fr + x-default | OK |
| `/fr/a-propos` | 200 | self | fr + x-default | OK ; desc « … » |
| `/fr/methodologie` | 200 | self | fr + x-default | marque ×2 ; desc « … » |
| `/fr/faq` | 200 | self | fr + x-default | OK |
| `/fr/blog` | 200 | self | fr + x-default | OK |
| `/fr/blog/page/2` | 200 | self | fr + x-default | **« · Axion-IA · page 2 · Axion-IA »** |
| `/fr/cas-concrets` | 200 | self | fr + x-default | OK |
| `/fr/tarifs` | 200 | self | fr + x-default | OK ; desc « … » |
| `/fr/implantations` | 200 | self | fr + x-default | 84 car. ; desc « … » |
| `/fr/audit/par-ville/lyon` | 200 | self | fr + x-default | OK ; desc « Quatre niv… » (mi-mot) |
| `/fr/formations` | 200 | self | fr + x-default | OK ; desc « … » |
| `/fr/glossaire` | 200 | self | fr + x-default | OK |
| `/fr/guides` | 200 | self | fr + x-default | OK |
| `/fr/stack-ia` | 200 | self | fr + x-default | OK |
| `/fr/secteurs` | 200 | self | fr + x-default | OK |
| `/fr/certification-qualiopi` | 200 | self | fr + x-default | OK (`{absolute}` bien utilisé) |
| `/fr/avis` | 200 | self | fr + x-default | OK |
| `/fr/roi` | 200 | self | fr + x-default | 82 car. |
| `/fr/connaissances`, `/fr/centre-aide`, `/fr/comparaisons`, `/fr/carrieres`, `/fr/implantations/auvergne-rhone-alpes/grenoble` | 200 | self | fr + x-default | OK (grenoble 79 car.) |
| `/fr/galerie` | 200 | self (query incluse si filtres) | **fr-FR** + x-default | **double suffixe** |
| `/fr/galerie/[slug]` ×3 | 200 | self | **fr-FR** + x-default | **double suffixe ×3/3** |
| `/fr/diagnostic` | 200 noindex | **→ `/fr` (home)** | fr + x-default (hérités) | double suffixe |
| `/fr/simulateur` | 200 noindex | **→ `/fr` (home)** | fr + x-default (hérités) | double suffixe |
| `/fr/components` | 200 **index,follow** | **→ `/fr` (home)** | header Link seul | title home hérité |
| `/en/about` | 301 → `/fr/a-propos` | — | — | conforme |
| `/en/audit` | 301 → `/fr/audit` | — | — | conforme |
| `/en/interventions/team-trainings` | 301 → `/fr/interventions/collectives` → **308** → `/fr/formations` (2 hops) | — | — | chaîne (à C3) |

**Header HTTP `Link` hreflang (P0)** — observé 18:06:48 UTC sur `/fr`, `/fr/audit`, `/fr/formations`, `/fr/a-propos`, `/fr/blog`, `/fr/components` : triplet `fr` / **`en` (URL qui 301)** / **`x-default` = URL sans préfixe locale (redirigeante)**, en contradiction avec le HTML.

**Volumes** : 867 URLs `/fr/galerie/` dans `/sitemaps/images-fr.xml` (18:07:36 UTC) ; blog paginé : 7 pages (« Page 1 sur 7 » live) ; ~135 pages passent par `buildProductMetadata` (saines), 10 `generateMetadata` hors factory (auditées une à une), 17 `page.tsx` sans metadata (espaces privés/redirects, sauf `/components`).

## Limites

- **DB non consultée** (C1 non autorisé) : impossible de vérifier si les 867 `metaTitle` galerie contiennent TOUS la marque « | Axion-IA » — extrapolation depuis 3/3 échantillons live + le fallback code. À confirmer par B6/D-squad si besoin d'un chiffrage exact.
- **GSC non consultée** (pas d'accès outillé en audit-only) : l'impact réel du header `Link` hreflang en (impressions `/en/*` résiduelles) n'est pas quantifié.
- `/fr/blog/categorie/audit-ia` répond 404 (18:04:29 UTC) — hors de ma surface (maillage/facettes → C4/C5), signalé sans investigation.
- Longueurs mesurées en **caractères**, pas en pixels SERP — la troncature Google réelle peut différer à ±5 car.
- Déploiement en vol (parti 17:33 UTC) : toutes les mesures datent d'AVANT l'atterrissage (~18:30+), donc reflètent le dernier état stable ; aucune surface testée ici n'est DB-driven-vide-sensible.
