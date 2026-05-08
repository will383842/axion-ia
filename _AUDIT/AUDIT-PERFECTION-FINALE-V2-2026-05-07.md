# Re-audit perfection finale V2 — post-fd91518

> Date : 2026-05-07
> HEAD : `fd91518` (feat(seo+aeo): step A — perfection infrastructure 76% → ~95%)
> Cwd auditée : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
> Audit précédent : `AUDIT-PERFECTION-FINALE-2026-05-07.md` (HEAD `c884adc`, score 76 %)
> Mission : confirmer perfection après patches étape A + détecter résidus
> Méthode : lecture-seule strict, build production lancé, dev server probé

Légende : ✅ perfection · 🟠 partiel/améliorable · 🔴 anomalie bloquante.

---

## 1. Vérification patches étape A

### 1.1 ✅ `app/icon.tsx` — propre

`src/app/icon.tsx:1-47`. Edge runtime, 32×32, terracotta `#c24a1b` + ivoire `#faf8f3`, serif italique. `hex-ok:` annotations correctes (4 occurrences, justification ImageResponse Edge runtime). Compile : OK (build 226/226 OK).

Dans la build output, route `/icon` apparaît bien comme `ƒ /icon` (dynamique Edge). HTML home injecte `<link rel="icon" href="/icon?a5af1da74c795800" type="image/png" sizes="32x32"/>` — câblage automatique Next 16.

### 1.2 ✅ `app/apple-icon.tsx` — propre

`src/app/apple-icon.tsx:1-49`. 180×180, gradient terracotta → terracotta-deep, `borderRadius: 36` (maskable cohérent). 3 `hex-ok:` annotations. Route servie : `ƒ /apple-icon`. HTML : `<link rel="apple-touch-icon" href="/apple-icon?bfebdf33810fa14f"...>`. ✅

### 1.3 ✅ `app/manifest.ts` — propre, mais une note

`src/app/manifest.ts:1-74`. PWA install OK. `theme_color: #c24a1b` + `background_color: #faf8f3` v3-cohérents. `start_url: "/"`, `scope: "/"`, 4 icons, 3 shortcuts (`/fr/reserver`, `/fr/audit`, `/fr/stack-ia`). `id: SITE_URL`. Build expose : `○ /manifest.webmanifest` (statique). HTML home : `<link rel="manifest" href="/manifest.webmanifest"/>`. ✅

🟠 **Note mineure** : les shortcuts pointent uniquement vers la version FR (`/fr/reserver`, etc). Sur un browser EN qui installe la PWA, les raccourcis tomberont sur la home FR. Acceptable (locale par défaut FR), mais perfectible si on veut un manifest par locale (Web App Manifest ne supporte pas hreflang nativement — il faudrait un manifest dynamique par locale, hors scope perfection).

### 1.4 ✅ `app/opengraph-image.tsx` — propre

`src/app/opengraph-image.tsx:1-122`. 1200×630, gradient + badge ivoire + Fraunces italic « IA », sous-titre « Interventions · Audits · Implémentation IA » + URL. 5 `hex-ok:` annotations. Route servie : `ƒ /opengraph-image`. HTML : `<meta property="og:image" content="http://localhost:3000/opengraph-image?...">`.

✅ La référence `${SITE_URL}/opengraph-image` sur `seo.ts:197,296,395,482` est désormais résolue (4 schemas Organization.logo, Person.image, Article.publisher.logo, LocalBusiness.image cessent de pointer vers 404).

### 1.5 ✅ `buildProductMetadata` patch émet `openGraph.images` + `twitter.images`

`src/lib/seo.ts:51-72`. Fallback dynamique sur `/api/og?title=${encodeURIComponent(title)}` (ligne 39). `openGraph.images[0]` typé `{ url, width: 1200, height: 630, alt: title }`. `twitter.images: [resolvedOgImage]`. ✅

Pas de régression sur les 62 pages : la signature `ProductSeoInput` ajoute deux champs **optionnels** (`ogImage?`, `ogAccent?`), aucun call site existant n'a besoin d'être modifié. Build OK.

🟠 **Encodage URL** : `encodeURIComponent(title)` traite les caractères spéciaux (`·`, `&`, accents). Vérifié sur `/methodologie:23-30` titre `"Méthodologie AxionIA · 4 étapes vers le ROI"` → URL générée propre.

### 1.6 🟠 Slug bug par-fonction EN — **partiellement** résolu

**Sitemap** : ✅ `src/app/sitemap.ts:299-312` émet correctement les URLs EN canoniques (probé via `curl http://localhost:3000/sitemap/implementation.xml`) :

```
<loc>https://axion-ia.com/en/implementation/by-function/customer-service</loc>
```

8 URLs FR + 8 URLs EN, hreflang bidirectionnel sur les 16 entrées. `slugsEn` correctement utilisé via `getAutomatisationByLocaleSlug`.

**generateStaticParams** : ✅ `src/app/[locale]/implementation/par-fonction/[slug]/page.tsx:20-27` produit les params traduits (FR=`service-client`, EN=`customer-service`). Build report (ligne 158-162) montre les 8 slugs FR + 8 slugs EN dans `[+13 more paths]` (= 16 paths générés, comme attendu).

**Probe runtime** :

- `GET /fr/implementation/par-fonction/service-client` → 200 ✅
- `GET /en/implementation/by-function/customer-service` → 200 ✅
- `GET /en/implementation/par-fonction/service-client` → 307 (redirect via next-intl) ✅
- `GET /fr/implementation/by-function/customer-service` → 307 (redirect) ✅

🟠 **Filesystem trompeur** : Next 16 build output affiche `/[locale]/implementation/par-fonction/[slug]` côté EN avec slugs EN (`/en/implementation/par-fonction/customer-service`). C'est le **path source** (filesystem), pas l'URL servie. next-intl translate au runtime via `routing.pathnames`. Pas un bug, juste une cosmétique dans le report — les 200 sont émis sur la bonne URL canonique EN (`/en/implementation/by-function/...`), confirmé via probe.

### 1.7 ✅ `/blog/[slug]` byline + dateModified visibles

`src/app/[locale]/blog/[slug]/page.tsx:81-103`. Imports OK : `Link` depuis `@/i18n/navigation` (cohérent avec routing pathnames). UI :

- Badge category (ligne 82).
- `<Link href={\`/blog/auteur/${post.author.toLowerCase()}\`}>`byline (ligne 83-88) avec hover state`hover:text-terracotta-deep`+ focus ring`focus-visible:ring-terracotta` (cohérent doctrine v3).
- `<time dateTime={post.publishedAt}>` (ligne 90-92).
- `{post.updatedAt && post.updatedAt !== post.publishedAt ? ...}` conditionnel propre (ligne 93-100).
- Reading time (ligne 102).

E-E-A-T 2026 byline visible : ✅ résolu.

### 1.8 ✅ `buildHowToJsonLd` câblé `/methodologie`

`src/app/[locale]/methodologie/page.tsx:14,70-118`. Structure JSON-LD valide schema.org :

- `@type: "HowTo"`, `name`, `description`, `url`, `inLanguage`.
- `totalTime: "P12W"` (ISO 8601 duration : 12 semaines).
- `estimatedCost: { @type: MonetaryAmount, currency: "EUR", value: "490" }`.
- 4 `step` avec `position` + `name` + `text` + auto-`url: ${url}#step-${idx+1}`.
- FR + EN parallèles (`isFr ? [...] : [...]`).

Émis via `<JsonLd data={howToJsonLd} />` ligne 381. Cohabite avec `articleJsonLd` + `breadcrumb`. ✅

### 1.9 ✅ 7 nouvelles factories `lib/seo.ts` propres

| Factory                      | Lignes           | Câblée ?                                                                                                                                           |
| ---------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildProductJsonLd`         | `seo.ts:626-657` | ❌ pas câblée                                                                                                                                      |
| `buildHowToJsonLd`           | `seo.ts:688-730` | ✅ `/methodologie:70-118`                                                                                                                          |
| `buildReviewJsonLd`          | `seo.ts:752-781` | ✅ `/cas-concrets/[slug]:68`                                                                                                                       |
| `buildAggregateRatingJsonLd` | `seo.ts:797-814` | ❌ pas câblée                                                                                                                                      |
| `buildDatasetJsonLd`         | `seo.ts:841-884` | ❌ pas câblée                                                                                                                                      |
| `buildImageObjectJsonLd`     | `seo.ts:904-923` | ❌ pas câblée                                                                                                                                      |
| `buildQAPageJsonLd`          | `seo.ts:941-978` | ❌ pas câblée (Note: `/faq/[slug]:48-63` utilise un QAPage inline avec une structure légèrement différente — opportunité d'harmoniser via factory) |

Toutes typées TypeScript strict, conventions cohérentes (`Locale` import, `SITE_URL`), `as const` partout. Build OK. Tests Vitest verts (96/96).

---

## 2. Re-scan 8 dimensions (deltas vs V1)

### 2.1 Hreflang — 75 % → 92 %

| Item V1                                              | V1  | V2  | File:line                                                                            |
| ---------------------------------------------------- | --- | --- | ------------------------------------------------------------------------------------ |
| `routing.pathnames` exhaustif                        | ✅  | ✅  | `src/i18n/routing.ts:11-138`                                                         |
| `buildProductMetadata.alternates.languages`          | ✅  | ✅  | `src/lib/seo.ts:43-50`                                                               |
| Sitemap EN `alternates` symétrique                   | 🟠  | ✅  | `src/app/sitemap.ts:117-128` (block dupliqué pour EN)                                |
| Sitemap segment EN `by-function` (au lieu `by-role`) | 🔴  | ✅  | `src/app/sitemap.ts:304`                                                             |
| Sitemap `:slug` translaté EN                         | 🔴  | ✅  | `src/app/sitemap.ts:103` (`slugsEn` field)                                           |
| `generateStaticParams` slug par locale               | 🔴  | ✅  | `src/app/[locale]/implementation/par-fonction/[slug]/page.tsx:20-27`                 |
| `inLanguage: "fr-FR"` hardcodé `/presse`             | 🟠  | 🟠  | `src/app/[locale]/presse/page.tsx:128, 192` (**non corrigé**, anti-pattern persiste) |
| Asymétrie `alternates` sitemap EN-version            | 🟠  | ✅  | sitemap.ts:117-128 émet bien le bloc bidirectionnel des 2 côtés                      |

**Delta** : +17 % (résolu 4/5 anomalies, reste `inLanguage: "fr-FR"` non patché côté `/presse`).

### 2.2 Slugs — 85 % → 87 %

✅ `pathFr` / `pathEn` sur `automatisations.ts:49-939` confirmés cohérents pour les 8 catégories (`service-client`/`customer-service`, `ventes-prospection`/`sales-prospecting`, `marketing-communication` (identique), `administratif`/`back-office`, `ressources-humaines`/`human-resources`, `donnees-pilotage`/`data-analytics`, `metier-production`/`operations`, `communication-interne`/`internal-communication`).

✅ Helpers `AUTOMATISATION_SLUGS_FR` + `AUTOMATISATION_SLUGS_EN` + `getAutomatisationByLocaleSlug` ajoutés (cf. diff `automatisations.ts:1064-1080`).

🟠 **Inchangé V1** : 18 slugs `BLOG_POSTS` / `CASE_STUDIES` / `PRESS_RELEASES` / `COMPARAISONS` partagent FR/EN (`industrie-comptabilite`, `cabinet-juridique-comptes-rendus`, `tpe-artisan-prospection`, etc.). Acceptable (next-intl ne translate pas les slugs dynamiques sans dict manuel par-slug). Pas une régression.

**Delta** : +2 % (slug bug FR/EN par-fonction résolu).

### 2.3 Breadcrumbs — 60 % → 60 % (statu quo)

✅ JSON-LD `BreadcrumbList` toujours sur **62 fichiers** (audit grep `buildBreadcrumbJsonLd` confirme).

🔴 **Inchangé V1** : `<Breadcrumbs>` composant `src/components/nav/Breadcrumbs.tsx:18-59` toujours **orphelin**. Audit grep `<Breadcrumbs` sur `src/app/**/page.tsx` → **0 occurrence**. Aucune page ne rend le composant visuel.

C'est l'**Action 3** de l'audit V1 (« reportée — nécessite design pass spécifique »). Le commit `fd91518` documente explicitement « Action 3 (Breadcrumbs visuel) reportée : nécessite design pass spécifique (intégration dans hero `<Section>` sans casser layout) ».

**Delta** : 0 % (assumé reporté par Will).

### 2.4 Performance — 75 % → 78 %

| Item                                                                                   | V1              | V2                    | Notes                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | --------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts` headers + compression + AVIF                                          | ✅              | ✅                    | `next.config.ts:10-66` (inchangé)                                                                                                                                                                               |
| `optimizePackageImports` 14 packages                                                   | ✅              | ✅                    | `next.config.ts:40-56`                                                                                                                                                                                          |
| `reactCompiler` + `viewTransition` + `ppr`                                             | 🟠 (commentés)  | 🟠 (commentés)        | Sprint 17 (justifié)                                                                                                                                                                                            |
| Speculation Rules production-gated                                                     | ✅              | ✅                    | `src/app/[locale]/layout.tsx:132-154`                                                                                                                                                                           |
| Fonts swap + minimal weights                                                           | ✅              | ✅                    | `src/app/[locale]/layout.tsx:19-41`                                                                                                                                                                             |
| `app/[locale]/loading.tsx`                                                             | ✅              | ✅                    | `src/app/[locale]/loading.tsx` (inchangé)                                                                                                                                                                       |
| `app/[locale]/error.tsx` + `not-found.tsx` + `global-error.tsx`                        | ✅              | ✅                    | inchangé                                                                                                                                                                                                        |
| Loading per-segment (`/blog/loading.tsx`, ...)                                         | 🟠              | 🟠                    | `find -name "loading.tsx"` → 1 seul fichier (inchangé)                                                                                                                                                          |
| `<img>` legacy                                                                         | 🔴              | 🔴                    | `PressSpokesperson.tsx:46` + `TeamGrid.tsx:29` (inchangé, attendu Sprint 5+ photos)                                                                                                                             |
| Hero `priority` LCP — `/blog`, `/guide-ia`, `/presse`, `/roi`                          | ✅ 4 pages      | ✅ 4 pages (inchangé) | grep `priority` confirmé                                                                                                                                                                                        |
| Hero `priority` LCP — `/interventions`, `/audit`, `/implementation` (3 hubs)           | 🟠 absent       | 🟠 absent             | grep `priority` page-level → 0                                                                                                                                                                                  |
| Hero `priority` LCP — sous-pages produit (interventions/_, audit/_, implementation/\*) | 🟠 absent       | 🟠 absent             | 11+ pages sans LCP hero priority                                                                                                                                                                                |
| Favicon + icon + apple-icon + manifest + opengraph-image                               | 🔴 favicon seul | ✅ COMPLET            | `app/icon.tsx`, `apple-icon.tsx`, `manifest.ts`, `opengraph-image.tsx` (4 fichiers ajoutés)                                                                                                                     |
| Bundle First Load JS baseline                                                          | ❌ inconnu      | ❌ inconnu            | Next 16.2.4 + Turbopack ne reporte pas First Load JS dans `pnpm build` (régression cosmétique vs Next 14/15). Bundle analyzer disponible via `ANALYZE=true pnpm build` (`next.config.ts:68-70`) — non lancé ici |

**Delta** : +3 % (4 fichiers metadata images débloqués). LCP `priority` toujours absent sur 11+ pages — opportunité. First Load JS toujours non-mesuré (limitation Next 16 / Turbopack).

🟠 **Nouveau warning build observé** : `metadataBase property in metadata export is not set... using "http://localhost:3000"` apparaît **11 fois** au build. Le `metadataBase: new URL(SITE_URL)` est défini à `src/app/[locale]/layout.tsx:60`, mais les 4 nouveaux route handlers (`icon.tsx`, `apple-icon.tsx`, `opengraph-image.tsx`, `manifest.ts`) + sitemap + RSS feeds + api/og sont sous `src/app/` racine et n'héritent pas du layout `[locale]`. Conséquence : les meta `og:image` URLs absolues construites en build par les routes hors-locale tombent sur `http://localhost:3000`. ⚠ Risque mineur en prod (les meta finales sont rendues côté `[locale]` qui a le metadataBase). À vérifier si critique en envoyant à un debugger Twitter Card / LinkedIn Post Inspector après deploy staging.

### 2.5 GSC schemas — 90 % → 93 %

| Schema                              | V1                   | V2                             | File:line                                                                                             |
| ----------------------------------- | -------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Organization                        | ✅                   | ✅                             | `seo.ts:182-230` + `[locale]/layout.tsx:99,118-121`                                                   |
| WebSite + SearchAction              | ✅                   | ✅                             | `seo.ts:238-263` + `[locale]/layout.tsx:100,122-125`                                                  |
| BreadcrumbList                      | ✅ 62 pages          | ✅ 62 pages                    | inchangé                                                                                              |
| FAQPage / FAQSpeakable              | ✅                   | ✅                             | `seo.ts:129-138, 420-437`                                                                             |
| Article                             | ✅                   | ✅                             | `seo.ts:358-405`                                                                                      |
| Service                             | ✅                   | ✅                             | `seo.ts:88-122`                                                                                       |
| ItemList                            | ✅                   | ✅                             | `seo.ts:585-601`                                                                                      |
| Person                              | ✅                   | ✅                             | `seo.ts:285-321` + `/a-propos:58,179`, `/presse:162-172`                                              |
| NewsArticle                         | ✅                   | ✅                             | `/presse:182-198`                                                                                     |
| QAPage                              | ✅ inline            | ✅ inline + factory dispo      | factory `seo.ts:941-978` (non encore câblée — `/faq/[slug]:48-63` utilise inline)                     |
| Review                              | ✅                   | ✅                             | factory `seo.ts:752-781` câblée `/cas-concrets/[slug]:68`                                             |
| ContactPage                         | ✅                   | ✅                             | `/contact:43-49`                                                                                      |
| LocalBusiness / ProfessionalService | 🟠 prête, non câblée | 🟠 idem (Sprint 15)            | `seo.ts:464-517`                                                                                      |
| Place                               | 🟠 prête, non câblée | 🟠 idem (Sprint 15)            | `seo.ts:533-571`                                                                                      |
| **HowTo**                           | ❌                   | ✅ câblée                      | `/methodologie:70-118`                                                                                |
| Product                             | ❌                   | 🟠 factory ajoutée, non câblée | factory `seo.ts:626-657`. Opportunité `/stack-ia` (11 outils → 11 Products dans un ItemList — manqué) |
| AggregateRating                     | ❌                   | 🟠 factory ajoutée, non câblée | `seo.ts:797-814`. Opportunité quand ≥3 reviews collectées                                             |
| Dataset                             | ❌                   | 🟠 factory ajoutée, non câblée | `seo.ts:841-884`. Opportunité `/roi` (calculator outputs en Dataset)                                  |
| ImageObject                         | ❌                   | 🟠 factory ajoutée, non câblée | `seo.ts:904-923`. Opportunité hero illustrations                                                      |
| VideoObject                         | ❌                   | ❌                             | Pas de vidéo sur le site (inchangé)                                                                   |
| Event                               | ❌                   | ❌                             | Pas d'événements (inchangé)                                                                           |

**Delta** : +3 % (HowTo câblé). 5 factories prêtes mais pas câblées : opportunités future Sprint 15+.

### 2.6 HTTPS + headers — 65 % → 65 % (statu quo)

`next.config.ts:10-20` inchangé. 6/10 headers présents (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS 2 ans, X-DNS-Prefetch-Control). 4 headers planifiés Sprint 16/22 :

- ❌ CSP (`Content-Security-Policy`) avec nonce dynamique — Sprint 16
- ❌ COOP (`Cross-Origin-Opener-Policy`)
- ❌ CORP (`Cross-Origin-Resource-Policy`)
- ❌ COEP (`Cross-Origin-Embedder-Policy`)

**Delta** : 0 %. Hors scope étape A (différé Sprint 16/22 par doctrine).

### 2.7 E-E-A-T 2026 — 88 % → 95 %

| Dimension                                    | V1                           | V2                | Action                                             |
| -------------------------------------------- | ---------------------------- | ----------------- | -------------------------------------------------- |
| Person Will (factory + câblage `/a-propos`)  | ✅                           | ✅                | `seo.ts:285-321` + `/a-propos:58,179`              |
| Person.knowsAbout 6 sujets                   | ✅                           | ✅                | `seo.ts:311-318`                                   |
| Person.knowsLanguage `["fr","en"]`           | ✅                           | ✅                | `seo.ts:319`                                       |
| Person.image (fallback OG)                   | ✅                           | ✅                | `seo.ts:296` (`/opengraph-image` désormais résolu) |
| Article.author Person                        | ✅                           | ✅                | `seo.ts:384-388`                                   |
| `Person.sameAs` étendu (X, Mastodon, GitHub) | 🟠 LinkedIn seul             | 🟠 LinkedIn seul  | inchangé                                           |
| `Organization.sameAs` (X, YouTube...)        | 🟠 LinkedIn + FB             | 🟠 LinkedIn + FB  | `seo.ts:201` inchangé                              |
| `Organization.legalName` AxionIA OÜ          | ✅                           | ✅                | `seo.ts:195`                                       |
| `Organization.foundingDate` 2024             | ✅                           | ✅                | `seo.ts:202`                                       |
| `Organization.foundingLocation` Tallinn EE   | ✅                           | ✅                | `seo.ts:203-210`                                   |
| `Organization.contactPoint`                  | ✅                           | ✅                | `seo.ts:213-218`                                   |
| `Organization.vatID` + `registrikood`        | 🟠 factory prête, non câblée | 🟠 idem           | bloqué — Will fournit                              |
| Author byline visible `/blog/[slug]`         | 🔴 absent                    | ✅ visible + lien | `/blog/[slug]:83-88`                               |
| `dateModified` visible `/blog/[slug]`        | 🔴 absent                    | ✅ visible        | `/blog/[slug]:93-100`                              |

**Delta** : +7 % (résolu byline + dateModified, 2 actions critiques V1).

### 2.8 Métadonnées images — 60 % → 92 %

| Item                                                                                                              | V1         | V2         | File                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | --------------------------------------------------------- |
| OG dynamique `/api/og` fonctionnel                                                                                | ✅         | ✅         | `src/app/api/og/route.tsx`                                |
| `buildProductMetadata` émet `openGraph.images`                                                                    | 🔴 absent  | ✅         | `seo.ts:51-72`                                            |
| Twitter card type `summary_large_image`                                                                           | ✅         | ✅         | `seo.ts:67-72`                                            |
| `twitter.images` câblé                                                                                            | 🔴 absent  | ✅         | `seo.ts:71`                                               |
| Alt text sur next/image                                                                                           | ✅         | ✅         | `Illustration.tsx:91`                                     |
| Alt text sur `<img>` legacy                                                                                       | 🟠 minimal | 🟠 minimal | `PressSpokesperson.tsx:46` + `TeamGrid.tsx:29` (inchangé) |
| Favicon                                                                                                           | ✅         | ✅         | `src/app/favicon.ico` (légitime cohabitation)             |
| Icon PNG                                                                                                          | 🔴         | ✅         | `src/app/icon.tsx`                                        |
| Apple touch icon                                                                                                  | 🔴         | ✅         | `src/app/apple-icon.tsx`                                  |
| Manifest PWA                                                                                                      | 🔴         | ✅         | `src/app/manifest.ts`                                     |
| `app/opengraph-image.tsx` statique                                                                                | 🔴 cassé   | ✅         | `src/app/opengraph-image.tsx`                             |
| `${SITE_URL}/opengraph-image` refs résolues (Org.logo, Person.image, Article.publisher.logo, LocalBusiness.image) | 🔴 404     | ✅ servi   | `seo.ts:197,296,395,482`                                  |

**Delta** : +32 % (5 fichiers/factory livrés, toutes les anomalies V1 résolues sauf images legacy attendu Sprint 5).

🔴 **NOUVELLE anomalie détectée** : `src/app/[locale]/presse/page.tsx:195` référence `${SITE_URL}/og/og-axionia.png` dans le `NewsArticle.image`. Le fichier n'existe pas (`public/og/` n'existe pas, `public/` ne contient que `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`, `press-kit/`). Conséquence : 8 NewsArticle JSON-LD `/presse` émettent une `image` 404.

**Fix simple** : remplacer `${SITE_URL}/og/og-axionia.png` par `${SITE_URL}/opengraph-image` (aligné sur les autres factories) ou par `${SITE_URL}/api/og?title=${encodeURIComponent(r.title)}` pour personnalisation par-release.

---

## 3. Build production analyse

```
▲ Next.js 16.2.4 (Turbopack)
✓ Compiled successfully in 25.4s
  Finished TypeScript in 28.5s
✓ Generating static pages using 11 workers (226/226) in 8.6s
```

### 3.1 Routes prerendered

- **226 pages SSG** (`●`) générées avec succès, dont 16 paths `/[locale]/implementation/par-fonction/[slug]` (8 FR + 8 EN slugs traduits via `slugsEn`).
- **8 routes dynamiques** (`ƒ`) attendues : `confirmation`, `desabonnement`, `recherche`, `cas-concrets`, `cas-concrets/feed.xml`, `blog/feed.xml`, `faq/feed.xml`, `api/og`, `api/indexnow`, `api/vitals`, `icon`, `apple-icon`, `opengraph-image`, `llms.txt`, `llms-full.txt`.
- **Routes statiques** (`○`) : `_not-found`, `maintenance`, `manifest.webmanifest`, `robots.txt`.
- **Sitemap-index** : `● /sitemap/[__metadata_id__]` avec 6 enfants (`pages.xml`, `blog.xml`, `help.xml`, `cas-concrets.xml`, `comparaisons.xml`, `implementation.xml`). ✅

### 3.2 Warnings build

- ⚠️ `metadataBase property in metadata export is not set` — **11 occurrences**. Émis par les route handlers / file conventions hors `[locale]/layout.tsx` (icon, apple-icon, opengraph-image, manifest, sitemap, RSS feeds, api/og). Le `metadataBase: new URL(SITE_URL)` du layout `[locale]` ne propage pas aux routes racine. Risque : `og:image` URLs construites en build avec fallback `http://localhost:3000`. À vérifier en staging avec Twitter Card Validator + LinkedIn Post Inspector.
- ⚠️ `Using edge runtime on a page currently disables static generation for that page` (1 occurrence). Attendu pour `app/icon.tsx` / `apple-icon.tsx` / `opengraph-image.tsx` (Edge runtime requis par `ImageResponse`).

### 3.3 Tests Vitest

`pnpm test` → **96/96 verts** (16 fichiers). Aucune régression suite aux patches étape A. Les 7 nouvelles factories `lib/seo.ts` ne sont pas couvertes par tests dédiés (test gap 🟠 mais pas de régression observée).

### 3.4 Probe runtime

Dev server (`pnpm dev`) lancé en parallèle, probes sur les routes critiques :

| URL                                                   | Code | Verdict                   |
| ----------------------------------------------------- | ---- | ------------------------- |
| `GET /fr/implementation/par-fonction/service-client`  | 200  | ✅ canonical FR           |
| `GET /en/implementation/by-function/customer-service` | 200  | ✅ canonical EN           |
| `GET /en/implementation/par-fonction/service-client`  | 307  | ✅ redirect via next-intl |
| `GET /fr/implementation/by-function/customer-service` | 307  | ✅ redirect via next-intl |

Sitemap probé `curl http://localhost:3000/sitemap/implementation.xml` → 16 URLs (8 FR + 8 EN), hreflang bidirectionnel cohérent, slugs traduits côté EN (`customer-service`, `sales-prospecting`, `marketing-communication`, `back-office`, `human-resources`, `data-analytics`, `operations`, `internal-communication`). ✅

### 3.5 Bundle First Load JS

❌ **Non mesurable** — Next 16.2.4 + Turbopack ne reporte plus la colonne « First Load JS » dans `pnpm build` (régression cosmétique vs Next 14/15 où chaque route avait sa taille). Le bundle analyzer reste disponible : `ANALYZE=true pnpm build` (cf. `next.config.ts:68-70`), mais non lancé dans cet audit (mission re-vérification, pas exploration perf).

---

## 4. Top 5 actions correctives encore prioritaires

Hors Sprint 15 backend / pSEO villes-régions / données légales Estonia (vatID + registrikood).

### Action 1 — 🔴 `presse/page.tsx:195` référence image inexistante

**Impact** : Les 8 `NewsArticle.image` `/presse` émettent une `image: ${SITE_URL}/og/og-axionia.png` qui retourne 404. Dégrade les rich results NewsArticle dans Google News + AI Overviews.

**Fix (3 LOC)** : remplacer par `${SITE_URL}/opengraph-image` (image statique homepage v3) ou `${SITE_URL}/api/og?title=${encodeURIComponent(r.title)}` pour personnalisation par-release.

```ts
// src/app/[locale]/presse/page.tsx:195
image: `${SITE_URL}/api/og?title=${encodeURIComponent(r.title)}&accent=primary`,
```

### Action 2 — 🟠 `inLanguage: "fr-FR"` / `"en-US"` hardcodé `/presse`

**Impact** : `src/app/[locale]/presse/page.tsx:128, 192` utilise `fr-FR`/`en-US` au lieu de `fr`/`en`. Anti-pattern : duplication de signal contre la doctrine du fichier `seo.ts` qui utilise `inLanguage: locale` partout (cf. `cas-concrets/[slug]:57`, `centre-aide/[slug]:53`, `methodologie:51`, `blog/[slug]:399`).

**Fix (2 LOC)** : remplacer `isFr ? "fr-FR" : "en-US"` par `locale` simple. Cohérence + `lang="fr"`/`lang="en"` HTML root préservé.

### Action 3 — 🔴 Câbler `<Breadcrumbs>` visuel sur les pages détail

**Impact** : composant `src/components/nav/Breadcrumbs.tsx:18-59` orphelin, **0 page** ne le rend. JSON-LD émis mais aucune trace UX visible pour l'utilisateur. Perfection breadcrumb à 60 % vs cible 100 %. Action 3 V1 reportée explicitement par commit `fd91518` (« nécessite design pass spécifique »).

**Fix (~12 LOC × 8 pages) :**

Pages prioritaires : `/blog/[slug]`, `/cas-concrets/[slug]`, `/centre-aide/[slug]`, `/comparaisons/[slug]`, `/faq/[slug]`, `/implementation/par-fonction/[slug]`, `/blog/categorie/[slug]`, `/centre-aide/categorie/[slug]`. Insérer `<Breadcrumbs items={...} />` au-dessus du `<Section titleAs="h1">`. Supprimer le `<JsonLd data={breadcrumb} />` redondant (composant `<Breadcrumbs>` émet déjà son JSON-LD ligne 53-56).

### Action 4 — 🟠 Câbler `priority` sur les hero `<Illustration>` des 14 pages produit/hub sans LCP optimisé

**Impact** : Pages `/interventions`, `/audit`, `/implementation` (3 hubs) + 11 sous-pages produit (interventions/_, audit/_, implementation/\*) utilisent `<Illustration>` hero **sans** `priority` prop (vérifié grep `priority` → 0 occurrence sur ces fichiers vs 4 pages déjà câblées : `/blog`, `/guide-ia`, `/presse`, `/roi`). LCP -10-20 % perdable sur mobile.

**Fix (1 LOC × ~14 pages)** : ajouter `priority` sur le `<Illustration>` hero (le premier rendu en viewport mobile/desktop above-the-fold).

### Action 5 — 🟠 Câbler `buildProductJsonLd` sur `/stack-ia`

**Impact** : 11 outils IA listés en `ItemList` sur `/stack-ia` sans schéma `Product` individuel. Google AI Overviews / Perplexity ne peuvent pas citer chaque outil indépendamment quand un utilisateur demande « quel outil pour X ? ». Factory `buildProductJsonLd` (`seo.ts:626-657`) prête.

**Fix (~25 LOC)** : émettre 11 `Product` JSON-LD (ou un `ItemList` enrichi avec `item: Product`) sur `/stack-ia/page.tsx`. Champs : `name` outil, `description`, `brand` (Anthropic / OpenAI / etc), `category`, `offer.priceRange` (« €20-€200/mois »).

---

## 5. Verdict % perfection global V2

| Dimension                               | V1   | V2   | Pondération | Delta |
| --------------------------------------- | ---- | ---- | ----------- | ----- |
| 1. Hreflang                             | 75 % | 92 % | × 1.5       | +17 % |
| 2. Slugs                                | 85 % | 87 % | × 1.0       | +2 %  |
| 3. Breadcrumbs (JSON-LD ✅ / visuel 🔴) | 60 % | 60 % | × 1.0       | 0 %   |
| 4. Performance                          | 75 % | 78 % | × 1.5       | +3 %  |
| 5. GSC schemas                          | 90 % | 93 % | × 1.5       | +3 %  |
| 6. HTTPS + headers                      | 65 % | 65 % | × 1.0       | 0 %   |
| 7. E-E-A-T 2026                         | 88 % | 95 % | × 1.5       | +7 %  |
| 8. Métadonnées images                   | 60 % | 92 % | × 1.0       | +32 % |

**Calcul pondéré** :

- (92×1.5 + 87×1.0 + 60×1.0 + 78×1.5 + 93×1.5 + 65×1.0 + 95×1.5 + 92×1.0) / (1.5+1.0+1.0+1.5+1.5+1.0+1.5+1.0)
- (138 + 87 + 60 + 117 + 139.5 + 65 + 142.5 + 92) / 10
- 841 / 10 = **84.1 %**

**Score pondéré global V2 : ≈ 84 % de perfection** (vs 76 % V1, **+8 points**).

### Pourquoi pas 95 % comme annoncé par le commit fd91518 ?

Le commit fd91518 cible « infrastructure 76% → ~95% », mais :

- ✅ Les patches livrés sont **propres et fonctionnels** (build OK, 96/96 tests verts, runtime probé).
- 🟠 Le score réel global ressort à 84 % parce que **3 dimensions persistent à 60-65 %** :
  - Breadcrumbs visuel (60 %, Action 3 V1 reportée par décision du commit).
  - HTTPS + headers (65 %, différé Sprint 16/22 par doctrine).
  - **Et** les actions correctives V1 #6-#10 (icons/manifest/og statique) ont été magnifiquement traitées, mais l'audit V1 sous-estimait leur poids (32 % de gain sur la dimension Métadonnées images).

Pour atteindre 95 % global, il faudrait livrer les **5 actions correctives top** ci-dessus :

- Action 1 (image NewsArticle) → +2 % images
- Action 2 (`inLanguage`) → +3 % hreflang
- Action 3 (Breadcrumbs visuels) → +30 % breadcrumbs (passe à 90 %)
- Action 4 (priority LCP) → +10 % perf
- Action 5 (Product `/stack-ia`) → +5 % schemas

Score projeté après les 5 actions : **≈ 92 %** global (cible 95 % atteinte si on ajoute aussi : `Person.sameAs` étendu, `Organization.sameAs` étendu, `vatID`+`registrikood` Will-fournis, et CSP Sprint 16).

---

## 6. Conclusion factuelle

### Patches étape A — verdict global ✅

Les 5 actions correctives V1 + 7 factories ont été livrées proprement :

- ✅ 4 fichiers metadata images Next 16 (icon, apple-icon, manifest, opengraph-image) — propres, doctrine-cohérents, edge runtime, hex-ok annotés.
- ✅ `buildProductMetadata` patch (62 pages bénéficient sans régression).
- ✅ Slug bug par-fonction EN — sitemap + generateStaticParams + helper `getAutomatisationByLocaleSlug` — runtime probé OK.
- ✅ `/blog/[slug]` byline + dateModified visibles, focus ring doctrine.
- ✅ HowTo `/methodologie` avec totalTime + estimatedCost + 4 steps (FR + EN parallèles).
- ✅ 7 factories `lib/seo.ts` ajoutées (HowTo + Review déjà câblées, 5 prêtes pour Sprint 15+).
- ✅ Build 226/226 SSG OK, 96/96 tests Vitest verts, aucune régression typecheck/lint.

### Bug détecté post-fd91518 — 1 nouveau

🔴 `presse/page.tsx:195` référence `${SITE_URL}/og/og-axionia.png` (NewsArticle.image × 8 communiqués) qui n'existe pas dans `public/`. Fix trivial à inclure dans le prochain commit (Action 1 ci-dessus).

### Régressions détectées

❌ Aucune. Tous les call-sites existants restent fonctionnels, signature `ProductSeoInput` étendue de manière backward-compatible.

### Score V2 final

**84 % de perfection pondéré** (vs 76 % V1, **+8 points**).

Pour atteindre 95 % : exécuter les **Actions 1 à 5** listées en §4 (≈ 1.5-2 j-h cumulés), puis traiter les 4 sous-actions résiduelles (sameAs étendus, données Estonia, CSP Sprint 16, loading per-segment).

---

> Audit lecture-seule strict — aucune modification de code. Build production lancé (5 min), dev server probé curl, tests Vitest verts (96/96), grep audit sur 8 dimensions complet. Tous chemins absolus Windows. Pour ré-exécution : recharger en contexte avec `git diff fd91518..HEAD` pour observer la dérive éventuelle.
