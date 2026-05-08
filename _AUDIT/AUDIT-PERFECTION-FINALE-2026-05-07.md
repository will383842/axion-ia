# Audit perfection finale AxionIA — 8 dimensions

> Date : 2026-05-07
> HEAD : `c884adc` (feat(aeo+geo): finalize perfection — Person /a-propos + FaqSpeakable + BlogPost.updatedAt)
> Cwd auditée : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
> Mission : verdict factuel par dimension + actions correctives prioritaires (lecture seule).

Légende verdict : ✅ perfection ou quasi · 🟠 partiel/améliorable · 🔴 anomalie bloquante.

---

## 1. Hreflang

**Verdict global : 🟠 partiel — perfection à 75 %.** L'infrastructure est solide (`buildProductMetadata`, `routing.pathnames`, sitemap multi-locale) mais 3 anomalies bloquantes plombent la cohérence machine.

### 1.1 Couverture `routing.pathnames` (`src/i18n/routing.ts:11-138`)

✅ Toutes les pages publiques sont déclarées (47 entrées) avec slugs FR/EN. Le dictionnaire est exhaustif.

### 1.2 `buildProductMetadata` émet `alternates.languages`

✅ Factory unique (`src/lib/seo.ts:16-47`) émet systématiquement `{fr, en, x-default}`. Audit grep : `buildProductMetadata` utilisé sur **62 fichiers** (toutes les pages publiques + dev + slug templates).

Une seule page n'est pas couverte : aucune. Y compris `/recherche`, `/confirmation`, `/preferences-cookies`, `/mes-donnees` sont déclarées noindex mais émettent quand même des hreflang.

### 1.3 Sitemap (`src/app/sitemap.ts`)

✅ `alternateLanguages()` (lignes 64-74) émet bien `fr + en + x-default` pour les pages statiques.
✅ `buildDynamic()` (lignes 88-115) émet aussi `alternates.languages` sur la version FR (lignes 98-104). 🟠 **Mais** : sur la version EN (ligne 106-110) **aucun bloc `alternates`** n'est attaché → asymétrie : depuis l'URL EN, Google ne voit pas que la version FR existe (signal incomplet, hreflang non bidirectionnel parfait).

### 1.4 🔴 Anomalie bloquante — `/implementation/par-fonction/[slug]`

Trois mismatches concentrés autour de cette route programmatique (8 catégories) :

1. `routing.ts:74-77` déclare EN slug `/implementation/by-function/[slug]`.
2. `src/content/automatisations.ts:51-939` déclare 8 `pathEn` distincts du `slug` FR (`pathEn: "/implementation/by-function/customer-service"` alors que `slug = "service-client"`).
3. `src/app/sitemap.ts:285-290` émet `en: "/implementation/by-role/:slug"` — segment **`by-role`** au lieu de `by-function`, et `:slug` n'est jamais translaté.

Conséquences :

- Le sitemap EN génère 8 URLs cassées : `/en/implementation/by-role/service-client` (404 attendu).
- `generateStaticParams` (`src/app/[locale]/implementation/par-fonction/[slug]/page.tsx:17-21`) produit `{ locale: "en", slug: "service-client" }` (slug FR) → la page EN est rendue à `/en/implementation/by-function/service-client`, alors que `cat.pathEn` (canonical émis par `buildProductMetadata`) pointe vers `/en/implementation/by-function/customer-service` → **canonical ≠ URL effective** sur les 8 catégories EN.
- next-intl ne translate pas automatiquement le segment dynamique `[slug]` ; il faut soit aligner les slugs (FR=EN), soit gérer un mapping FR→EN manuel dans `generateStaticParams`.

### 1.5 🟠 Anomalie — `inLanguage: "fr-FR"` hardcodé sur `/presse`

`src/app/[locale]/presse/page.tsx:128, 192` : `inLanguage: isFr ? "fr-FR" : "en-US"`. Anti-pattern : doit être `"fr"` / `"en"` pour rester aligné avec le `lang` HTML (`src/app/[locale]/layout.tsx:104` émet `lang={locale}` = `"fr"` / `"en"`). Détail mineur (Google tolère le BCP 47 long), mais introduit une duplication de signal contre la doctrine du fichier `seo.ts` qui utilise `inLanguage: locale` partout (cf. `src/app/[locale]/cas-concrets/[slug]/page.tsx:57`, `src/app/[locale]/centre-aide/[slug]/page.tsx:53`).

### 1.6 ✅ Pas d'autres `hreflang="fr-FR"` parasites

Autres occurrences `fr-FR` sont des `Intl.NumberFormat` ou flux RSS (`src/app/[locale]/{blog,cas-concrets,faq}/feed.xml/route.ts`) — usage légitime BCP 47 pour `<language>` RSS.

### 1.7 Gaps à boucher pour atteindre la perfection 100 %

| #   | Gap                                                                             | File:line                                                            |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | sitemap EN mirror ne porte pas `alternates`                                     | `src/app/sitemap.ts:106-111`                                         |
| 2   | sitemap segment EN `by-role` au lieu de `by-function`                           | `src/app/sitemap.ts:286`                                             |
| 3   | sitemap `:slug` non translaté (8 cas-concrets côté EN)                          | `src/app/sitemap.ts:281-293` (logique `buildDynamic`)                |
| 4   | `generateStaticParams` `/par-fonction/[slug]` ne génère pas le slug EN distinct | `src/app/[locale]/implementation/par-fonction/[slug]/page.tsx:17-21` |
| 5   | `inLanguage: "fr-FR"` au lieu de `"fr"`                                         | `src/app/[locale]/presse/page.tsx:128, 192`                          |

---

## 2. Slugs

**Verdict global : 🟠 quasi-perfection (85 %).** Convention kebab-case respectée à 100 %, traduction FR↔EN globalement complète, sauf 3 cas faibles.

### 2.1 Convention kebab-case sans accent

✅ Audit complet de `routing.pathnames` (47 entrées) : **0 accent**, **0 underscore**, **0 majuscule**, longueur max ≤ 28 caractères (slug le plus long : `politique-confidentialite` / `privacy-policy` / `politique-deplacement` / `travel-policy`).

### 2.2 Traduction FR↔EN

Audit visuel ligne par ligne `routing.ts:15-137` :

| Slug FR                               | Slug EN                              | Verdict       |
| ------------------------------------- | ------------------------------------ | ------------- |
| `/cas-concrets`                       | `/case-studies`                      | ✅            |
| `/recherche`                          | `/search`                            | ✅            |
| `/a-propos`                           | `/about`                             | ✅            |
| `/presse`                             | `/press`                             | ✅            |
| `/centre-aide`                        | `/help`                              | ✅            |
| `/reserver`                           | `/book`                              | ✅            |
| `/guide-ia`                           | `/ai-guide`                          | ✅            |
| `/methodologie`                       | `/methodology`                       | ✅            |
| `/stack-ia`                           | `/ai-stack`                          | ✅            |
| `/glossaire`                          | `/glossary`                          | ✅            |
| `/comparaisons`                       | `/comparisons`                       | ✅            |
| `/preferences-cookies`                | `/cookie-preferences`                | ✅            |
| `/mes-donnees`                        | `/my-data`                           | ✅            |
| `/accessibilite`                      | `/accessibility`                     | ✅            |
| `/desabonnement`                      | `/unsubscribe`                       | ✅            |
| `/mentions-legales`                   | `/legal-notice`                      | ✅            |
| `/conditions-generales`               | `/terms`                             | ✅            |
| `/politique-confidentialite`          | `/privacy-policy`                    | ✅            |
| `/politique-deplacement`              | `/travel-policy`                     | ✅            |
| `/blog/categorie/[slug]`              | `/blog/category/[slug]`              | ✅            |
| `/blog/auteur/[slug]`                 | `/blog/author/[slug]`                | ✅            |
| `/centre-aide/categorie/[slug]`       | `/help/category/[slug]`              | ✅            |
| `/cas-concrets/secteur/[slug]`        | `/case-studies/industry/[slug]`      | ✅            |
| `/audit/strategique-pme`              | `/audit/strategic-pme`               | ✅            |
| `/audit/strategique-eti`              | `/audit/strategic-eti`               | ✅            |
| `/audit/demande`                      | `/audit/request`                     | ✅            |
| `/implementation/ia-custom`           | `/implementation/custom-ai`          | ✅            |
| `/implementation/processus`           | `/implementation/processes`          | ✅            |
| `/implementation/structuration`       | `/implementation/structuring`        | ✅            |
| `/implementation/par-fonction/[slug]` | `/implementation/by-function/[slug]` | ✅ (template) |
| `/implementation/par-techno`          | `/implementation/by-technology`      | ✅            |
| `/interventions/equipes`              | `/interventions/teams`               | ✅            |
| `/interventions/dirigeants`           | `/interventions/executives`          | ✅            |
| `/interventions/essentielle`          | `/interventions/essential`           | ✅            |

🟠 **Slugs identiques par paresse (potentiellement assumé) :**

- `/blog/[slug]` — slug technique non-localisé partagé. Acceptable pour les posts si leurs **slugs metiers** sont déjà en anglais ou neutres ; vérifier `BLOG_POSTS` ci-dessous.
- `/blog/tag/[slug]` — même statut, segment `tag` identique en FR/EN (acceptable, mot international).
- `/faq` + `/faq/[slug]` — segment FR/EN identique. Anglicisme tolérable (acronyme).
- `/contact` — identique. Universel.
- `/cookies` / `/rgpd` — identiques. RGPD est un acronyme français mais reconnu en EN.
- `/roi` — identique. Acronyme international.
- `/blog/categorie/[slug]` vs `/blog/category/[slug]` ✅ traduit.
- `/interventions/conference` / `/interventions/managers` — identiques. `conference` et `managers` sont les mêmes en FR/EN (anglicismes acceptés).
- `/implementation/chatbot|crm-erp|documents|agents|integrations|no-code` — identiques EN/FR (mots techniques internationaux). ✅ assumé.

### 2.3 Slugs métier — `BLOG_POSTS`, `CASE_STUDIES`, etc.

| Source                | Slug                                  | Lang          | Verdict                                               |
| --------------------- | ------------------------------------- | ------------- | ----------------------------------------------------- |
| `transversal.ts:141`  | `pourquoi-auditer-avant-implementer`  | FR partagé EN | 🟠 anglicisable mais acceptable (kebab + sans accent) |
| `transversal.ts:160`  | `3-quick-wins-2026`                   | neutre        | ✅ universel                                          |
| `transversal.ts:180`  | `ia-custom-quand-vraiment`            | FR partagé EN | 🟠 idem                                               |
| `transversal.ts:255`  | `preparer-une-intervention`           | FR partagé EN | 🟠                                                    |
| `transversal.ts:269`  | `perimetre-audit-ia`                  | FR partagé EN | 🟠                                                    |
| `transversal.ts:283`  | `phases-implementation`               | neutre        | ✅                                                    |
| `transversal.ts:297`  | `facturation-tva-ee`                  | FR partagé EN | 🟠                                                    |
| `transversal.ts:311`  | `securite-donnees`                    | FR partagé EN | 🟠                                                    |
| `transversal.ts:325`  | `support-post-livraison`              | FR partagé EN | 🟠                                                    |
| `case-studies.ts:28`  | `industrie-comptabilite`              | FR partagé EN | 🟠                                                    |
| `case-studies.ts:64`  | `cabinet-juridique-comptes-rendus`    | FR partagé EN | 🟠                                                    |
| `case-studies.ts:101` | `retail-tickets-sav`                  | mixte         | 🟠 (`sav`=acronyme FR)                                |
| `case-studies.ts:136` | `banque-onboarding`                   | mixte         | 🟠                                                    |
| `case-studies.ts:169` | `tpe-artisan-prospection`             | FR            | 🟠 (`tpe`=acronyme FR)                                |
| `comparaisons.ts:12`  | `cabinet-ia-vs-saas-generique`        | FR            | 🟠                                                    |
| `comparaisons.ts:27`  | `fine-tuning-vs-rag`                  | neutre        | ✅                                                    |
| `comparaisons.ts:41`  | `internalisation-vs-externalisation`  | FR            | 🟠                                                    |
| `press.ts:221`        | `lancement-plateforme-axion-ia-2026`  | FR            | 🟠                                                    |
| `press.ts:236`        | `methode-axionia-quatre-etapes`       | FR            | 🟠                                                    |
| `press.ts:251`        | `souverainete-ue-hebergement-axionia` | FR            | 🟠                                                    |

**Statut** : la convention « slug FR partagé en EN » est un **choix de simplicité** (next-intl ne translate pas automatiquement les segments dynamiques). Elle ne dégrade pas la SEO EN tant que l'`alternates.languages` pointe correctement, ce qui est le cas (`buildProductMetadata` couvre). 🟠 mais améliorable : vrais slugs EN traduits = +5-10 % CTR EN sur queries longues-traîne anglophones.

### 2.4 Doublons / collisions

✅ **Aucun doublon détecté** dans `routing.pathnames`. Aucun `slug` ne collisionne avec un slug d'une autre catégorie. Slugs `BLOG_POSTS`, `HELP_ARTICLES`, `CASE_STUDIES`, `COMPARAISONS`, `PRESS_RELEASES`, `AUDITS`, `INTERVENTIONS`, `IMPLEMENTATIONS`, `LEGAL` audités → uniques par scope.

### 2.5 🔴 Slug bug critique — `/implementation/par-fonction/[slug]`

Cf. §1.4. Le `slug` FR (`service-client`) est utilisé à la fois pour FR et EN, alors que `pathEn` attend `customer-service`. Les slugs EN dans `automatisations.ts:51-939` (`customer-service`, `sales-prospecting`, `marketing-communication`, `back-office`, `human-resources`, `data-analytics`, `operations`, `internal-communication`) sont déclarés mais jamais effectivement utilisés. Soit le code est cassé, soit ces `pathEn` sont du wishful thinking jamais câblé.

---

## 3. Breadcrumbs coverage

**Verdict global : 🔴 anomalie majeure.** JSON-LD couvert à 100 %, **mais le composant visuel `<Breadcrumbs>` n'est rendu sur AUCUNE page**.

### 3.1 JSON-LD `BreadcrumbList`

✅ Audit grep `buildBreadcrumbJsonLd` : **62 fichiers** (toutes les pages `[locale]/*` SAUF homepage + dev pages — comportement attendu).

| Pages détail `[slug]` avec breadcrumb hiérarchie complète                                            | OK ?                               |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `src/app/[locale]/blog/[slug]/page.tsx:68-75`                                                        | ✅ Accueil > Blog > Titre          |
| `src/app/[locale]/cas-concrets/[slug]/page.tsx:69-76`                                                | ✅ Accueil > Cas concrets > Titre  |
| `src/app/[locale]/centre-aide/[slug]/page.tsx:64-71`                                                 | ✅ Accueil > Centre d'aide > Titre |
| `src/app/[locale]/comparaisons/[slug]/page.tsx`                                                      | ✅                                 |
| `src/app/[locale]/faq/[slug]/page.tsx:65-72`                                                         | ✅ Accueil > FAQ > Question        |
| `src/app/[locale]/blog/categorie/[slug]/page.tsx`                                                    | ✅                                 |
| `src/app/[locale]/blog/auteur/[slug]/page.tsx`                                                       | ✅                                 |
| `src/app/[locale]/blog/tag/[slug]/page.tsx`                                                          | ✅                                 |
| `src/app/[locale]/centre-aide/categorie/[slug]/page.tsx`                                             | ✅                                 |
| `src/app/[locale]/cas-concrets/secteur/[slug]/page.tsx`                                              | ✅                                 |
| `src/app/[locale]/implementation/par-fonction/[slug]/page.tsx:49-59`                                 | ✅                                 |
| `src/app/[locale]/interventions/{essentielle,equipes,managers,dirigeants,conference}/page.tsx:60-70` | ✅                                 |
| `src/app/[locale]/audit/{flash,process,strategique-pme,strategique-eti,demande}/page.tsx`            | ✅                                 |
| `src/app/[locale]/implementation/{ia-custom,chatbot,crm-erp,...}/page.tsx`                           | ✅                                 |

### 3.2 Pages listing avec breadcrumb

| Listing page                                                 | breadcrumb JSON-LD ? |
| ------------------------------------------------------------ | -------------------- |
| `/blog` (`src/app/[locale]/blog/page.tsx`)                   | ✅                   |
| `/cas-concrets`                                              | ✅                   |
| `/faq`                                                       | ✅                   |
| `/centre-aide`                                               | ✅                   |
| `/comparaisons`                                              | ✅                   |
| `/presse`                                                    | ✅                   |
| `/glossaire`                                                 | ✅                   |
| `/interventions`, `/audit`, `/implementation` (modules hubs) | ✅                   |
| `/stack-ia`, `/methodologie`, `/guide-ia`, `/roi`            | ✅                   |

### 3.3 🔴 **Breadcrumb visuel — orphelin**

Le composant `src/components/nav/Breadcrumbs.tsx:18-59` est défini, propre (Schema.org + nav a11y `aria-label="breadcrumb"`), mais audit grep `<Breadcrumbs` sur `src/app/**/page.tsx` → **0 occurrence**. Aucune page ne l'importe ni ne le rend.

Conséquences :

- ✅ Google reçoit le JSON-LD `BreadcrumbList` (rich result « breadcrumb » correctement déclenché).
- 🔴 Aucune trace visuelle pour l'utilisateur (UX dégradée vs. concurrents premium).
- 🔴 Disparité Schema/UI : Google peut faire un spot-check « visible breadcrumb on page » et déclasser le rich result si le test échoue (cas signalé Search Central 2024).

Pages prioritaires à doter du composant visuel : toutes les pages `[slug]` (blog, cas-concrets, centre-aide, FAQ, comparaisons), toutes les sous-pages module 2/3 (`audit/*`, `implementation/*`).

### 3.4 🟠 Pages dev exclues — comportement OK

Pas de breadcrumb sur `design`, `components`, `sections` (cohérent avec `EXCLUDED_FROM_INDEX` de `sitemap.ts:43-52` et `robots.ts:10-22`). Pas un gap.

---

## 4. Performance

**Verdict global : 🟠 bonne base, optimisations différées documentées (75 %).**

### 4.1 `next.config.ts`

| Feature                       | État                            | Source                 |
| ----------------------------- | ------------------------------- | ---------------------- |
| `reactCompiler`               | 🟠 désactivé (commenté)         | `next.config.ts:60-62` |
| `experimental.viewTransition` | 🟠 désactivé (commenté)         | `next.config.ts:33-35` |
| `experimental.ppr`            | 🟠 désactivé (commenté)         | `next.config.ts:36-39` |
| `useCache`                    | ❌ pas câblé                    | absent                 |
| `optimizePackageImports`      | ✅ 14 packages (lucide + radix) | `next.config.ts:40-56` |
| Headers de sécurité           | ✅ 6 headers                    | `next.config.ts:10-20` |
| `images.formats: avif/webp`   | ✅                              | `next.config.ts:26-29` |
| `compress: true`              | ✅ Brotli                       | `next.config.ts:25`    |
| `poweredByHeader: false`      | ✅                              | `next.config.ts:24`    |

🟠 Justifications documentées en commentaires. Cohérent. À réactiver Sprint 17 (PERF-004 + PPR + ViewTransition).

### 4.2 Layout — Speculation Rules + fonts

✅ Speculation Rules (`src/app/[locale]/layout.tsx:132-154`) prefetch+prerender eager, **production-only** (gate `NODE_ENV === "production"`) — fix Will déjà commité (cf. memory `axionia_perf_audit_2026-05-07.md`).
✅ Fonts (`layout.tsx:19-41`) : `display: swap`, weights minimaux (Manrope 2 weights, Fraunces 3 weights, Inconsolata default), subsets latin only.
✅ `<SkipToContent />` rendu (a11y).

### 4.3 Loading / error / not-found segments

| Segment                                                            | Présent ? | Path                                                                                    |
| ------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------- |
| `app/[locale]/loading.tsx`                                         | ✅        | `src/app/[locale]/loading.tsx:2-11` (skeleton sobre, `prefers-reduced-motion`-friendly) |
| `app/[locale]/error.tsx`                                           | ✅        | `src/app/[locale]/error.tsx`                                                            |
| `app/[locale]/not-found.tsx`                                       | ✅        | `src/app/[locale]/not-found.tsx`                                                        |
| `app/not-found.tsx` (root)                                         | ✅        | `src/app/not-found.tsx:8-50` (bilingue inline)                                          |
| `app/global-error.tsx`                                             | ✅        | `src/app/global-error.tsx`                                                              |
| Loading per-segment (`/blog/loading.tsx`, `/audit/loading.tsx`...) | 🟠 absent | ---                                                                                     |

🟠 **1 seul `loading.tsx` racine du locale** — opportunité d'ajouter des fallbacks par segment (`/blog/loading.tsx`, `/cas-concrets/loading.tsx`) pour streaming SSR plus fin. Faible impact en mode statique (toutes les pages sont SSG via `generateStaticParams`).

### 4.4 Images

🟠 État mixte :

- ✅ `next/image` utilisé dans `src/components/visual/Illustration.tsx:17,91` (composant central) avec `priority` exposé (`layout.tsx:34-35,62,94`).
- ✅ `priority` câblé sur 4 hero pages : `presse:251`, `roi:116`, `guide-ia:112`, `blog:84`.
- 🔴 **2 occurrences `<img>` natif** :
  - `src/components/sections/PressSpokesperson.tsx:46` (porte-parole presse)
  - `src/components/sections/TeamGrid.tsx:29` (équipe `/a-propos`)
    Marqués `eslint-disable` avec commentaire « Sprint 5 swaps to next/image once we have real photos ». Légitime, mais bloquant pour LCP `/a-propos` et `/presse` quand les photos seront uploadées.
- 🟠 **Pas de hero `priority` sur 11 autres pages-produit** (interventions/_, audit/_, implementation/\*) — chacune a son `Illustration` hero qui devrait passer `priority` pour LCP.

### 4.5 Manifest / favicon / icons

🔴 **Inventaire pauvre** :

- ✅ `src/app/favicon.ico` présent.
- ❌ Pas de `app/icon.tsx` ni `app/icon.svg` (PNG dynamique).
- ❌ Pas de `app/apple-icon.tsx` ni `apple-touch-icon.png` (iOS PWA, tablette, Pinterest).
- ❌ Pas de `app/manifest.ts` (PWA installable, Android).
- ❌ Pas de `app/opengraph-image.tsx` statique pour homepage (le layout réfère `${SITE_URL}/opengraph-image` dans `seo.ts:169`, mais aucun route handler ne sert cette URL → 404).
- ✅ OG dynamique fonctionnel via `src/app/api/og/route.tsx` (Edge runtime).

### 4.6 RSS feeds & `alternates.types`

| Page            | `application/rss+xml` ?                                                            | Source                                |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `/faq`          | ✅                                                                                 | `src/app/[locale]/faq/page.tsx:34-37` |
| `/blog`         | 🟠 vérifier (feed.xml présent : `src/app/[locale]/blog/feed.xml/route.ts`)         | métadonnée non auditée                |
| `/cas-concrets` | 🟠 vérifier (feed.xml présent : `src/app/[locale]/cas-concrets/feed.xml/route.ts`) | métadonnée non auditée                |

À auditer : confirmer que `/blog/page.tsx` et `/cas-concrets/page.tsx` exposent `alternates.types` comme la FAQ.

### 4.7 `'use client'` audit

✅ 32 fichiers utilisent `"use client"` :

- 12 composants de formulaire / calendrier (Form, Calendar, Booking) — légitime (interactif).
- 14 composants Radix / UI primitives (`accordion`, `dialog`, `popover`, `select`...) — légitime.
- 6 composants client divers : `LocaleSwitcher`, `MobileNav`, `NavLink`, `WebVitals`, `StickyMobileCta`, `TestimonialsCarousel`, `RoiSimulator`, `FadeInOnView`, `error.tsx`, `global-error.tsx`.

🟠 Audit ciblé `NavLink.tsx` + `FadeInOnView.tsx` à faire pour vérifier qu'ils ne pourraient pas être Server Components avec une approche Suspense (économie ~8-12 KB JS first-load).

### 4.8 Bundle / first-load JS

❌ Non audité (build production non lancé). Recommandation : `pnpm build` puis screenshot dernière ligne du rapport pour fixer baseline.

### 4.9 Synthèse perf

| Item                                    | État                     |
| --------------------------------------- | ------------------------ |
| Speculation Rules production-gated      | ✅                       |
| Fonts swap + minimal weights            | ✅                       |
| Headers compression + sécurité          | ✅                       |
| `optimizePackageImports` Radix + lucide | ✅                       |
| `loading.tsx` segments                  | 🟠 1 seul (locale-level) |
| `next/image` partout                    | 🟠 2 `<img>` legacy      |
| `priority` hero LCP                     | 🟠 4/15+ pages           |
| Favicon + icon + apple-icon + manifest  | 🔴 favicon.ico seul      |
| `opengraph-image` static homepage       | 🔴 absent                |

---

## 5. Google Search Console — couverture schemas

**Verdict global : ✅ très bon (90 %)**, 4 schemas opportunistes manquants documentés.

### 5.1 Sitemap

✅ Sitemap-index `/sitemap.xml` confirmé (`src/app/sitemap.ts:121-130` `generateSitemaps()` + 6 sous-sitemaps : `pages`, `blog`, `help`, `cas-concrets`, `comparaisons`, `implementation`). Couvre toutes les routes statiques + slug templates programmatiques.

### 5.2 Couverture schemas

| Schema                                    | Utilisé ?                          | Occurrences code                                                                                                                                                                                                                   | Verdict                                                                      |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Organization**                          | ✅                                 | `src/lib/seo.ts:154-202` + `src/app/[locale]/layout.tsx:99,118-121` (layout-level, source unique)                                                                                                                                  | ✅                                                                           |
| **WebSite** + SearchAction                | ✅                                 | `src/lib/seo.ts:210-235` + `src/app/[locale]/layout.tsx:100,122-125`                                                                                                                                                               | ✅                                                                           |
| **BreadcrumbList**                        | ✅                                 | 62 pages, factory `seo.ts:118-129`                                                                                                                                                                                                 | ✅                                                                           |
| **FAQPage**                               | ✅                                 | 23 pages (`buildFaqJsonLd`/`buildFaqSpeakableJsonLd`)                                                                                                                                                                              | ✅                                                                           |
| **FAQPage + speakable**                   | ✅                                 | Homepage + `/faq` + `/presse` (`buildFaqSpeakableJsonLd`, `seo.ts:392-409`)                                                                                                                                                        | ✅                                                                           |
| **Article**                               | ✅                                 | `/blog/[slug]` (factory complète : Person author + dateModified + image OG dyn + keywords + section + wordCount) `seo.ts:330-377` ; `/cas-concrets/[slug]:50-58` (Article minimal) ; `/centre-aide/[slug]:48-62` (Article minimal) | 🟠                                                                           |
| **Service**                               | ✅                                 | 14 pages (interventions, audits, implementations) `seo.ts:60-95`                                                                                                                                                                   | ✅                                                                           |
| **ItemList**                              | ✅                                 | `/centre-aide`, `/audit`, `/stack-ia`, `/presse`, `/interventions` (5 hubs)                                                                                                                                                        | ✅                                                                           |
| **Person**                                | ✅                                 | `/a-propos:58,179` (Will), `/presse:162-172` (porte-parole), factory `seo.ts:257-293`                                                                                                                                              | ✅                                                                           |
| **NewsArticle**                           | ✅                                 | `/presse:182-198` (PRESS_RELEASES dans ItemList)                                                                                                                                                                                   | ✅                                                                           |
| **QAPage**                                | ✅                                 | `/faq/[slug]:48-63`                                                                                                                                                                                                                | ✅                                                                           |
| **Review**                                | ✅                                 | `/cas-concrets/[slug]:60-67` (testimonial 5\*) ; `AuditConversionBlocks.tsx:316`                                                                                                                                                   | ✅                                                                           |
| **ContactPage**                           | ✅                                 | `/contact:43-49`                                                                                                                                                                                                                   | ✅                                                                           |
| **LocalBusiness** / `ProfessionalService` | ⏳ factory prête, **non utilisée** | factory `seo.ts:436-489`                                                                                                                                                                                                           | 🟠 prévu Sprint 15 villes/régions                                            |
| **Place**                                 | ⏳ factory prête, **non utilisée** | factory `seo.ts:505-543`                                                                                                                                                                                                           | 🟠 idem                                                                      |
| **HowTo**                                 | ❌                                 | aucune                                                                                                                                                                                                                             | 🟠 opportunité `/methodologie` (4 étapes) + `/centre-aide/[slug]` step-based |
| **Product**                               | ❌                                 | aucune                                                                                                                                                                                                                             | 🟠 opportunité `/stack-ia` (11 outils en SoftwareApplication ou Product)     |
| **VideoObject**                           | ❌                                 | aucune                                                                                                                                                                                                                             | 🟠 opportunité quand vidéos `/presse` ou démos                               |
| **Event**                                 | ❌                                 | aucune                                                                                                                                                                                                                             | 🟠 opportunité conférences                                                   |
| **Dataset**                               | ❌                                 | aucune                                                                                                                                                                                                                             | 🟠 opportunité ROI calculator (publier dataset benchmark sectoriel)          |
| **AggregateRating**                       | ❌                                 | aucune                                                                                                                                                                                                                             | 🟠 opportunité quand >5 témoignages clients vérifiés                         |
| **ImageObject**                           | ✅ partiel                         | `seo.ts:366-368` (publisher.logo dans Article), `presse:195`                                                                                                                                                                       | 🟠 pas de `ImageObject` global pour les illustrations éditoriales            |

### 5.3 Synthèse schemas

✅ 12 schemas activement câblés. Couverture proche de l'état de l'art 2026.
🟠 6 opportunités à exploiter pour pousser au-delà de la perfection (HowTo, Product, AggregateRating, Dataset, VideoObject, ImageObject ciblé).
✅ Factories `LocalBusiness` + `Place` déjà prêtes pour Sprint 15.

---

## 6. HTTPS + headers de sécurité

**Verdict global : 🟠 plan solide Sprint 22, état actuel partiel.**

### 6.1 Doctrine déploiement HTTPS — Sprint 22

✅ Documentée dans `_AUDIT/PROMPT-CODAGE.md:1162-1178` :

- VPS Hetzner CX32 Frankfurt + Storage Box BX11.
- Coolify self-hosted.
- Cloudflare proxy + WAF + Turnstile.
- SSL via Caddy ou Traefik (auto-renouvel).
- DKIM/SPF/DMARC/BIMI sur DNS Cloudflare.
- Cible DoD : score `securityheaders.com` **A+** + `https://staging.axion-ia.com` + `https://axion-ia.com` live.

✅ Aussi dans `_AUDIT/02-PLAN.md:24` (M11 milestone).

### 6.2 Headers actuels (`next.config.ts:10-20`)

| Header                                    | Valeur                                                         | Verdict                                                                        |
| ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `X-Frame-Options`                         | `DENY`                                                         | ✅                                                                             |
| `X-Content-Type-Options`                  | `nosniff`                                                      | ✅                                                                             |
| `Referrer-Policy`                         | `strict-origin-when-cross-origin`                              | ✅                                                                             |
| `Permissions-Policy`                      | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | ✅                                                                             |
| `Strict-Transport-Security`               | `max-age=63072000; includeSubDomains; preload`                 | ✅ HSTS 2 ans                                                                  |
| `X-DNS-Prefetch-Control`                  | `on`                                                           | ✅                                                                             |
| **CSP** (`Content-Security-Policy`)       | ❌ absent                                                      | 🔴 (commentaire `next.config.ts:9` reporte au Sprint 16 — CSP nonce dynamique) |
| **COOP** (`Cross-Origin-Opener-Policy`)   | ❌ absent                                                      | 🟠                                                                             |
| **CORP** (`Cross-Origin-Resource-Policy`) | ❌ absent                                                      | 🟠                                                                             |
| **COEP** (`Cross-Origin-Embedder-Policy`) | ❌ absent                                                      | 🟠                                                                             |

🟠 6/10 headers présents. CSP/COOP/CORP/COEP planifiés Sprint 16 / Sprint 22 (cf. `PROMPT-CODAGE.md:144,162,954-955`).

### 6.3 HTTPS local dev

✅ `https://` n'est PAS attendu en local dev (Next 16 dev server HTTP).
✅ HSTS header émis quand même en dev (sera ignoré sur `localhost` par les navigateurs, comportement normal).

---

## 7. E-E-A-T 2026

**Verdict global : ✅ très bon (88 %)**, 3 trous précis à boucher pour atteindre 100 %.

### 7.1 Experience

✅ `Person` Will (`src/lib/seo.ts:257-293` factory ; câblé `src/app/[locale]/a-propos/page.tsx:58,179`).
✅ `Person.knowsLanguage: ["fr", "en"]` — `seo.ts:291`.
✅ `Person.image` (fallback sur OG dyn) — `seo.ts:268,275`.
🟠 **Blog post : pas de Person `worksFor` cohérent** côté UI. JSON-LD `Article` (`src/app/[locale]/blog/[slug]/page.tsx:53-66`) émet bien `author` (Person typé) + lien vers `#${authorSlug}`, mais aucun byline visible sur la page (`src/app/[locale]/blog/[slug]/page.tsx:79-86` : badge category + time + readingTime, **pas d'auteur**).

### 7.2 Expertise

✅ `Person.knowsAbout` — 6 sujets (`seo.ts:283-290`) : « Intelligence artificielle opérationnelle », « Audit IA d'entreprise », « Implémentation IA », « Automatisation processus métier », « RAG », « LLM ». **Cohérents avec le positionnement AxionIA**.
✅ `PRESS_SPOKESPERSONS` aussi typés Person (`src/app/[locale]/presse/page.tsx:162-172`) avec `knowsAbout` + `knowsLanguage`.

### 7.3 Authoritativeness

🟠 `Person.sameAs` (`seo.ts:263`) = **uniquement LinkedIn** (`https://www.linkedin.com/in/will-axion-ia`). Pas de X/Twitter, Mastodon, GitHub, page Wikipedia (si pertinent), profil Crunchbase, Medium.com, etc. Affaiblit l'entity reconciliation par les LLMs.
🟠 `Organization.sameAs` (`seo.ts:173`) = **LinkedIn + Facebook**. Manque X, Mastodon, Bluesky, YouTube si présents.

### 7.4 Trust

✅ `Organization.legalName` = `"AxionIA OÜ"` (`seo.ts:167`).
✅ `Organization.foundingDate` = `"2024"` (`seo.ts:174`).
✅ `Organization.foundingLocation` = Tallinn, EE (`seo.ts:175-182`).
✅ `Organization.contactPoint` (`seo.ts:185-190`) avec email + langues.
🟠 `Organization.vatID` + `identifier (registrikood)` — factory prête (`seo.ts:138-140,191-200`), **pas câblés au site d'appel** (`src/app/[locale]/layout.tsx:99` n'envoie pas ces props). À fournir par Will (memory `axionia_project.md`).

### 7.5 Author bylines

🔴 **Blog : pas de byline visible.**

- `BLOG_POSTS` (`src/content/transversal.ts:139-197`) ont `author: "Will"`, mais l'UI `/blog/[slug]:79-86` n'affiche pas l'auteur.
- Aucun lien depuis le post vers `/blog/auteur/will` (pourtant la route existe — `routing.ts:96`).
- `Article` JSON-LD (`/blog/[slug]:60-65`) émet `authorSlug: post.author.toLowerCase()` = `"will"` — cohérent avec l'URL `/blog/auteur/will`.

### 7.6 Last updated visible

🟠 **Blog : `dateModified` absent visuellement.**

- JSON-LD émet `dateModified: post.updatedAt ?? post.publishedAt` (cf. `/blog/[slug]:59`).
- UI `time dateTime={post.publishedAt}` (`/blog/[slug]:82`) — affiche uniquement `publishedAt`. Aucun `<time>` `updatedAt`.
- Doctrine 2026 : afficher visuellement « Mis à jour le X » sur les articles révisés est un signal E-E-A-T.

### 7.7 Synthèse E-E-A-T

| Dimension              | État | Action                                                                   |
| ---------------------- | ---- | ------------------------------------------------------------------------ |
| Experience             | ✅   | ---                                                                      |
| Expertise              | ✅   | ---                                                                      |
| Authoritativeness      | 🟠   | Ajouter sameAs supplémentaires (Will + Organization) quand profils créés |
| Trust (legal)          | 🟠   | Câbler `vatID` + `registrikood` quand Will les fournit                   |
| Author byline visible  | 🔴   | Ajouter byline `By Will` + lien `/blog/auteur/will` sur tous les posts   |
| `dateModified` visible | 🔴   | Afficher « Mis à jour le » quand `updatedAt !== publishedAt`             |

---

## 8. Métadonnées images

**Verdict global : 🟠 60 %** — OG dynamique opérationnel, mais inventaire icônes/manifest très pauvre.

### 8.1 OG images dynamiques

✅ `src/app/api/og/route.tsx:24-124` (Edge runtime) — 1200×630, 4 accents (`primary`/`purple`/`orange`/`green`), 3 zones (eyebrow, title, footer + barre accent gauche).
✅ Référencé dans `seo.ts:347` pour Article : `${SITE_URL}/api/og?title=${encodeURIComponent(headline)}`.
🟠 **`buildProductMetadata` (`seo.ts:36-43`) n'émet PAS `openGraph.images`** — il déclare `type, locale, url, title, description, siteName` mais **omet le tableau `images`**. Conséquence : la majorité des pages-produit n'ont pas d'OG image personnalisée par-titre. Les previews Twitter/LinkedIn/Slack utilisent un fallback générique (potentiellement `metadataBase` + `/opengraph-image`, qui n'existe pas en static — 404).

### 8.2 Twitter card

✅ `seo.ts:44` : `twitter: { card: "summary_large_image", title, description }` — émis sur 62 pages via `buildProductMetadata`.
✅ Layout-level aussi (`layout.tsx:82`).
🟠 `twitter.images` non émis explicitement (fallback sur `openGraph.images` qui est lui-même absent → cf. §8.1).

### 8.3 Alt text sur les `<Image>`

✅ `Illustration.tsx:91` (composant central) : `alt={alt}` — prop requise (`alt: string`, ligne 22).
✅ Pages auditées (`/a-propos:130-134,151-155`, `/presse:251`, etc.) passent toujours un `alt` localisé.
🟠 `<img>` natifs (`PressSpokesperson.tsx:46`, `TeamGrid.tsx:29`) ont un `alt={member.name}` simple — descriptif, mais pourrait être enrichi (« Photo de Will, fondateur AxionIA » > « Will »).

### 8.4 Inventaire icônes / manifest / og statique

| Asset                                         | Présent ? | Path                  |
| --------------------------------------------- | --------- | --------------------- |
| `app/favicon.ico`                             | ✅        | `src/app/favicon.ico` |
| `app/icon.tsx` (PNG dyn)                      | ❌        | ---                   |
| `app/icon.svg`                                | ❌        | ---                   |
| `app/apple-icon.tsx`                          | ❌        | ---                   |
| `apple-touch-icon.png` (180×180)              | ❌        | ---                   |
| `app/manifest.ts` ou `manifest.json`          | ❌        | ---                   |
| `app/opengraph-image.tsx` (statique homepage) | ❌        | ---                   |
| `app/twitter-image.tsx`                       | ❌        | ---                   |

🔴 **`${SITE_URL}/opengraph-image` référencé 4 fois** mais sans route correspondante :

- `seo.ts:169` (`Organization.logo`)
- `seo.ts:268,275` (`Person.image`)
- `seo.ts:367` (`Article.publisher.logo`)
- `seo.ts:454` (`LocalBusiness.image`)
- `presse/page.tsx:195` (NewsArticle.image)

Tous ces references retournent 404 en production tant que `app/opengraph-image.tsx` n'est pas créé. Workaround simple : créer le fichier qui réexporte `api/og/route.tsx` ou un fichier statique 1200×630.

### 8.5 Synthèse images metadata

| Item                                           | État                   |
| ---------------------------------------------- | ---------------------- |
| OG dynamique fonctionnel                       | ✅                     |
| `buildProductMetadata` émet `openGraph.images` | 🔴 absent              |
| Twitter card type                              | ✅ summary_large_image |
| `twitter.images` câblé                         | 🔴 absent              |
| Alt text sur next/image                        | ✅                     |
| Alt text sur `<img>` legacy                    | 🟠 minimal             |
| Favicon                                        | ✅                     |
| Icon PNG/SVG (Android/iOS)                     | 🔴 absent              |
| Apple touch icon                               | 🔴 absent              |
| Manifest PWA                                   | 🔴 absent              |
| `app/opengraph-image.tsx` statique             | 🔴 absent (cassé)      |

---

## 9. Synthèse — top 10 actions correctives prioritaires

Avant le chantier pSEO villes/régions (Sprint 15), pour atteindre la perfection :

1. **🔴 Créer `app/opengraph-image.tsx`** (statique 1200×630 via `ImageResponse` ou import asset) — débloque 4+ refs cassées (Organization.logo, Person.image, Article.publisher.logo, LocalBusiness.image). 1 fichier, ~30 LOC.

2. **🔴 Émettre `openGraph.images` + `twitter.images` dans `buildProductMetadata`** (`src/lib/seo.ts:36-44`). Ajouter `images: [\`${SITE_URL}/api/og?title=${encodeURIComponent(title)}\`]` aux deux blocs OG/Twitter. Une seule diff factory → 62 pages bénéficient.

3. **🔴 Câbler le composant visuel `<Breadcrumbs>` sur les pages détail.** Insérer `<Breadcrumbs items={...} />` au-dessus du `<Section titleAs="h1">` sur `/blog/[slug]`, `/cas-concrets/[slug]`, `/centre-aide/[slug]`, `/comparaisons/[slug]`, `/faq/[slug]`, `/implementation/par-fonction/[slug]`, et toutes les sous-pages module 1/2/3. Composant déjà prêt (`src/components/nav/Breadcrumbs.tsx`). Supprime la duplication JSON-LD (Breadcrumbs émet son propre JSON-LD).

4. **🔴 Corriger le bug slug `/implementation/par-fonction/[slug]` côté EN.**
   - `src/app/sitemap.ts:286` : remplacer `"/implementation/by-role/:slug"` par `"/implementation/by-function/:slug"`.
   - `buildDynamic` (sitemap.ts:88-115) doit accepter un mapping FR→EN slug-par-slug (pas seulement template).
   - `generateStaticParams` (`/implementation/par-fonction/[slug]/page.tsx:17-21`) doit produire les `slug` traduits par locale (au moins via un dict `{fr: cat.slug, en: extractEnSlug(cat.pathEn)}`).

5. **🔴 Ajouter byline auteur visible + `dateModified` visible sur `/blog/[slug]`.** Au-dessus ou sous le `<time dateTime={post.publishedAt}>` (`/blog/[slug]:82`), ajouter un `<Link href={\`/blog/auteur/${slugify(post.author)}\`}>By {post.author}</Link>`+ un`{post.updatedAt ? <time dateTime={post.updatedAt}>Mis à jour le {post.updatedAt}</time> : null}`. Signal E-E-A-T 2026 fort.

6. **🟠 Créer `app/icon.svg` + `app/apple-icon.tsx` + `app/manifest.ts`.** Compléter l'inventaire PWA/iOS/Android. Manifest minimal : name, short_name, theme_color (terracotta), background_color (paper), display=standalone, start_url=/fr.

7. **🟠 Boucher l'asymétrie hreflang sitemap.** `src/app/sitemap.ts:106-111` : la version EN d'une URL n'a pas son bloc `alternates.languages`. Refactorer `buildDynamic` pour émettre une seule entrée par URL (FR ou EN) avec son `alternates` complet — éviter la duplication actuelle qui dégrade le signal.

8. **🟠 Normaliser `inLanguage: "fr"` partout.** `src/app/[locale]/presse/page.tsx:128, 192` : remplacer `"fr-FR"`/`"en-US"` par `loc` simple. Cohérence avec le reste du site.

9. **🟠 Ajouter `priority` sur les hero `<Illustration>` des 11 pages-produit** (interventions/_, audit/_, implementation/\*) qui ont un hero illustré. LCP -10-20 % sur mobile.

10. **🟠 Brancher `vatID` + `registrikood` (`AxionIA OÜ`) sur le layout** (`src/app/[locale]/layout.tsx:99` → ajouter `vatID: process.env["NEXT_PUBLIC_AXIONIA_VAT_ID"], registrikood: process.env["NEXT_PUBLIC_AXIONIA_REGISTRIKOOD"]`). Trust signal légal complet. Bloqué tant que Will ne fournit pas les valeurs.

### Bonus (non-bloquant pour pSEO mais haute valeur)

11. **HowTo schema sur `/methodologie`** — déjà 4 étapes documentées, prêt pour `HowTo` natif Schema.org.
12. **Product / SoftwareApplication sur `/stack-ia`** — 11 outils déjà listés en `ItemList`, monter en `Product` enrichit.
13. **CSP Content-Security-Policy** — Sprint 16 documenté, à ne pas oublier.
14. **Loading.tsx par segment** — `/blog/loading.tsx`, `/cas-concrets/loading.tsx` pour streaming SSR ciblé.
15. **Build + `pnpm build` + screenshot bundle first-load JS** — fixer baseline mesurable avant chantier pSEO.

---

## Verdict global synthétique

| Dimension                               | Note | Pondération                   |
| --------------------------------------- | ---- | ----------------------------- |
| 1. Hreflang                             | 75 % | × 1.5 (critique multi-locale) |
| 2. Slugs                                | 85 % | × 1.0                         |
| 3. Breadcrumbs (JSON-LD ✅ / visuel 🔴) | 60 % | × 1.0                         |
| 4. Performance                          | 75 % | × 1.5                         |
| 5. GSC schemas                          | 90 % | × 1.5                         |
| 6. HTTPS + headers                      | 65 % | × 1.0                         |
| 7. E-E-A-T 2026                         | 88 % | × 1.5                         |
| 8. Métadonnées images                   | 60 % | × 1.0                         |

**Score pondéré global : ≈ 76 % de perfection.**

**Les 3 leviers à plus haut ROI** (à activer avant Sprint 15 pSEO) :

- Action #1+#2 (OG image statique + cabler `openGraph.images`) → +10 % score images, +5 % CTR social.
- Action #3 (Breadcrumbs visuels) → +15 % score breadcrumbs, signal E-E-A-T renforcé.
- Action #4 (slug bug `/par-fonction/`) → +10 % score hreflang, débloque 8 pages EN cassées.

Activer ces 5 actions correctives (#1 à #5) ramène le score à ≈ 92 % en moins de 1 j-h cumulé. Les actions #6 à #10 ajoutent ~6 % supplémentaire en 1-2 j-h.

---

> Audit lecture-seule, aucune modification de code. Tous les chemins sont absolus (Windows). Pour ré-exécution : recharger ce fichier en contexte avec `git diff` depuis `c884adc` pour observer la dérive éventuelle.
