# AGT-03 — PERFORMANCE

> Auditeur senior — Phase 2, AUDIT-ONLY (pondération ×1.5, timeout 90 min).
> Périmètre : Web Vitals, bundle, code-splitting, fonts, images, Sentry, third-parties, View Transitions, React Compiler, `next.config.ts`, caching côté code.
> Référence budgets : `AGENTS.md` + `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.
> **Aucun build, aucun Lighthouse, aucun curl prod lancés ici** (réservés Phase 4). Toute mesure runtime est notée `[NON MESURÉ — postbuild risk]` ou `[NON MESURÉ — Phase 4]`.

## Score : 70 / 100

## Confiance : moyenne

**Justification** : la lecture statique du code est riche et largement triangulable (next.config.ts, instrumentation Sentry, package.json size-limit, BookingCalendar, layout, proxy, Caddyfile). Mais je n'ai pas exécuté `pnpm build` (postbuild IndexNow + risque), `pnpm bundle:check` (size-limit), `pnpm bundle:analyze`, ni Lighthouse — donc la conformité **chiffrée** aux budgets ≤ 75 KB gz / ≤ 110 KB gz `/reserver` reste `[NON MESURÉ — Phase 4 P-06]`. Les findings perf sont en revanche cohérents avec la baseline `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md` (2026-05-08, 47,2 %), donc je m'appuie dessus pour les ordres de grandeur.

## Top findings

### P0 (bloquant)

- **P0-PERF-01 — Aucune mesure prod ne valide les budgets Web Vitals depuis Sprint 16/V3-V6**
  _Évidence statique_ : `lighthouserc.json` impose Perf ≥ 0,95, LCP ≤ 1 800 ms, INP ≤ 80 ms, CLS ≤ 0,05, TBT ≤ 150 ms (`lighthouserc.json:27-40`). Mais `lighthouserc.json:22` lance `pnpm start` localement, aucun snapshot CrUX RUM cumulé, **et** la baseline 2026-05-08 chiffre Perf home = 81 / TBT = 300 ms / CLS `/reserver` = 0,552 — soit 3 indicateurs en violation (`AUDIT-WEB-VITALS-2026-SYNTHESE.md:38-46`). Les patches `loading.tsx` granulaires `/reserver` (P-101) et lazy `BookingCalendar` (P-401) **sont** appliqués (`src/app/[locale]/reserver/loading.tsx`, `src/components/calendar/BookingCalendarLazy.tsx`), mais sans Lighthouse Phase 4 on n'a pas la preuve que CLS `/reserver` est repassé < 0,1 ni que Perf home ≥ 0,95. → cf. P-06 Phase 4.

- **P0-PERF-02 — `lhci` collect désactive le gate dans le pipeline CI (aucun `lhci:autorun` câblé)**
  `package.json:33-34` : `"lhci": "lhci collect"` et `"lhci:autorun": "lhci autorun"` existent **mais** `.github/workflows/` (cf. AGT-12) ne les invoquent pas dans `deploy-coolify.yml`. `lighthouserc.json` set des assertions `error` (bloquantes) mais elles ne tournent jamais en CI. Conséquence : la PR-gate Web Vitals décrite `AGENTS.md` (« Lighthouse CI gate les PR ») **n'existe pas en pratique**.
  Confidence moyenne : à confirmer Pass B via grep `.github/workflows/*.yml`.

### P1 (sérieux)

- **P1-PERF-03 — 0 `<Suspense>` boundary dans `src/app/`**
  Grep `Suspense` dans `src/app/**` = aucun résultat. Combiné à `next.config.ts:79-86` (PPR `incremental` commenté volontairement), tous les segments sont aujourd'hui full-SSG ou full-SSR. La doctrine `loading.tsx` granulaire compense partiellement (`reserver`, `audit`, `contact`, `implantations/[region]/[ville]`) mais n'a pas l'effet streaming d'un Suspense. Sur `/reserver` et toute page DB-touching, le TTFB visible client = TTFB serveur complet (pas de shell streamé).

- **P1-PERF-04 — Sentry tracesSampleRate prod = 0,1 sur SDK navigateur (~150 KB gz observé)**
  `src/instrumentation-client.ts:9` : `tracesSampleRate: isProd ? 0.1 : 1.0`. Replay correctement à 0 (lignes 16-17). Mais `@sentry/nextjs@10.51` charge sur le navigateur le SDK Performance + RouterTransitions (`captureRouterTransitionStart` ligne 21). Baseline mémoire `axionia_audit_web_vitals_2026-05-08` chiffre Sentry à **150 KB gz = 53 % du shell**. Statique : on ne peut pas vérifier sans `bundle:analyze` mais le SDK navigateur est bel et bien dans le shell (`instrumentation-client.ts` exporté → Next 16 le pull dans bundle browser).
  → Option non-prise : `dynamic()` lazy-load de l'init Sentry après `requestIdleCallback`, ou downgrade vers `@sentry/browser` light (perd RouterTransitions). À chiffrer `[NON MESURÉ — Phase 4 P-06]`.

- **P1-PERF-05 — Aucun `withSentryConfig` dans `next.config.ts` → pas de sourcemaps Sentry shippées**
  `next.config.ts` ne wrappe **pas** `nextConfig` avec `withSentryConfig` (vérifié grep `Sentry|sentry`). Conséquence côté **perf** : on évite l'upload sourcemaps au build (postbuild plus court), mais conséquence côté **observabilité** : les stack traces prod sont obfusquées. Le prompt master § 0.5bis évoque `SENTRY_DISABLE_AUTO_UPLOAD` — non câblé donc inutile. Documente le statut : Sentry est **runtime-only**, pas wrapped-bundler.
  Cross-check AGT-14 MONITORING.

- **P1-PERF-06 — Plausible chargé `afterInteractive` sur **toutes** les routes, **sans `preconnect`**, sans gating consent**
  `src/components/analytics/Plausible.tsx:13-22` : `<Script defer strategy="afterInteractive" src={apiUrl/js/script.outbound-links.js} />`. Pas de `rel="preconnect"` vers `https://plausible.axion-ia.com` → le hit DNS+TLS arrive sur la frame Interactive. Conséquence INP : un cold visit ajoute ~50-200 ms de DNS/TLS Plausible si l'utilisateur clique immédiatement après FCP. La script `outbound-links.js` ajoute ~7 KB gz + listener delegated.
  Mitigation présente côté CSP (`src/lib/csp.ts:84,91,100` autorise plausible). Pas de bandeau cookies prérequis (privacy-first, OK CNIL).

- **P1-PERF-07 — 5 `useForm()` non mémoïsés (React Compiler skip-list)**
  Lint phase 0 remonte 5× `react-hooks/incompatible-library` sur `AuditForm.tsx`, `BookingForm.tsx`, `ContactForm.tsx`, `ImplementationForm.tsx`, `NewsletterForm.tsx` (cf. `00-REALITY-CHECK.md:61`). React Compiler ne mémoïse pas ces composants → re-render branches non triviales à chaque frappe. Compiler désactivé volontairement (`next.config.ts:106-110`) donc le re-render frappe-par-frappe persiste. Impact INP minimisé sur forms simples mais cumul `BookingCalendar` (29 useState) + 4-step modal = à mesurer.

- **P1-PERF-08 — `BookingCalendar` toujours 2 131 lignes / 29 `useState` / pas de `useTransition`**
  `src/components/calendar/BookingCalendar.tsx` — wc -l : 2 131, grep `useState` : 29, grep `useTransition` : 0. Le P-202 (debounce 400 ms autosave localStorage) est correctement appliqué (lignes 431-465), mais le P-201 (`useTransition` autour de `router.replace`) **ne l'est pas** (`setSearchParams` direct ligne 324). Sur mobile bas de gamme, ce route-push synchrone peut ajouter +30-80 ms INP au clic « pickTier ».

- **P1-PERF-09 — Lighthouserc INP seuil 80 ms < budget AGENTS.md 100 ms**
  `lighthouserc.json:35` : `"interaction-to-next-paint": ["error", { "maxNumericValue": 80 }]` MAIS `AGENTS.md` Performance budget = INP ≤ 100 ms p75 et exception `/reserver` ≤ 150 ms. → le seuil CI **fail** systématiquement avant le budget interne. Soit (a) le budget est conservateur volontairement (intent : « si CI fail à 80 on a marge p75 100 »), soit (b) drift à corriger. À documenter.

- **P1-PERF-10 — Speculation Rules: prerender en `moderate`, prefetch en `eager` sur 15 URLs**
  `src/app/[locale]/layout.tsx:178-235` : `prerender: { eagerness: "moderate" }` (bonne maîtrise bandwidth) **mais** `prefetch: { eagerness: "eager" }` sur 15 URLs FR/EN = 30 URLs prefetchées au load. Comportement contrôlé : seulement en production (`process.env.NODE_ENV === "production"` ligne 176). OK mais peut consommer bandwidth sur mobile 4G. À surveiller dans CrUX.

### P2 (confort)

- **P2-PERF-11 — `Inconsolata` chargée pour tout le site alors qu'utilisée marginalement**
  `src/app/[locale]/layout.tsx:28-32` : `Inconsolata({ subsets: ["latin"], variable: "--font-inconsolata" })` — pas de `weight` spécifié = chargement default. Aucun `preload: false` détecté. Si Inconsolata n'est utilisée que par le footer/debug, P-110 (lazy via `preload: false`) gagne ~20 ms LCP. À mesurer impact.

- **P2-PERF-12 — `Fraunces` 3 poids × 2 styles = 6 WOFF2**
  Layout ligne 47 : `weight: ["400", "500", "600"], style: ["normal", "italic"]` → 6 subsets latin. ~50-80 KB cumul woff2 supplémentaire. `next/font/google` déduplique mais les **6** fichiers sont liés `<link>`. Vérifier `[NON MESURÉ — Phase 4]` lesquels sont effectivement utilisés (titleEm = italique 500, body = normal 400 prob.).

- **P2-PERF-13 — `productionBrowserSourceMaps: false` explicite + `compress: true`**
  Bonnes pratiques (`next.config.ts:49,46`). Note : `compress: true` redouble brotli Caddy (Caddyfile:48). Sur V3 Caddy live, le commentaire « V3 passera false » (next.config.ts:46) n'a pas été appliqué → double-compression coût CPU minor sur Hetzner CPX32.

- **P2-PERF-14 — `serverExternalPackages` bien défini, prévient leak vers client**
  `next.config.ts:56-67` : `@prisma/client`, `prisma`, `argon2`, `bullmq`, `ioredis`, `otplib`, `sharp`, `pino`, `@react-email/render`, `nodemailer`. Excellent guard-rail.

- **P2-PERF-15 — `optimizePackageImports` couvre 14 paquets Radix + lucide-react**
  `next.config.ts:88-104` : tree-shaking forcé pour Radix UI + lucide-react. Cohérent avec 81 fichiers important `lucide-react`. Bonnes mesures.

- **P2-PERF-16 — `images.minimumCacheTTL: 31536000` (1 an immutable) déjà appliqué**
  `next.config.ts:76`. Bonne config Cert D4. Pas de `remotePatterns` (toutes images locales `public/`).

- **P2-PERF-17 — `viewTransition: true` désactivé volontairement**
  `next.config.ts:79-83` commentaire explicite : « ViewTransition disabled until we actually wrap route transitions in <ViewTransition>. The flag alone changes Next's navigation behavior (waits for render before swap) and adds perceived latency without any visual benefit ». ✅ bonne maîtrise — pas un anti-pattern.

- **P2-PERF-18 — `motion` retiré, remplacé par IntersectionObserver + transition CSS**
  `src/components/motion/FadeInOnView.tsx:1-66` : `framer-motion`/`motion/react` plus importé nulle part (grep `from 'motion'` = 0 résultat dans src). `package.json:97` liste `motion@^11.18.2` mais aucun import → **dead dep**. P-410 du baseline appliqué côté code, **pas côté `package.json`**.

- **P2-PERF-19 — `compress: true` côté Next + brotli Caddy = double compression**
  Anti-pattern documenté à `next.config.ts:46-47` commentaire. À retirer V3 (Caddy live). Coût CPU CPX32 marginal mais à fixer.

- **P2-PERF-20 — Aucun `<link rel="preconnect">` vers Plausible / Sentry / fonts.gstatic.com**
  Layout ligne 138-242 : aucun `<head>` custom resource hint. `next/font/google` ajoute déjà `preconnect` fonts.gstatic.com automatiquement (NF 16 default), donc OK fonts. Mais **Plausible** (analytics) + **Sentry ingest** ne sont **pas** preconnect.

---

## Détail par sous-chapitre

### 1. `next.config.ts` (poids ×1.0)

| Aspect                                | Statut                         | Citation                 | Note              |
| ------------------------------------- | ------------------------------ | ------------------------ | ----------------- |
| `reactStrictMode`                     | ✅ true                        | `next.config.ts:43`      | OK                |
| `poweredByHeader: false`              | ✅                             | `next.config.ts:44`      | OK                |
| `compress: true`                      | ⚠️ double avec Caddy V3        | `next.config.ts:46`      | P2                |
| `productionBrowserSourceMaps: false`  | ✅                             | `next.config.ts:49`      | OK                |
| `output: "standalone"`                | ✅ Docker Hetzner              | `next.config.ts:51`      | OK                |
| `serverExternalPackages` (10 entries) | ✅ verrouillage server-only    | `next.config.ts:56-67`   | OK                |
| `images.formats` AVIF+WebP            | ✅                             | `next.config.ts:69`      | OK                |
| `images.minimumCacheTTL` 1 an         | ✅ Cert D4                     | `next.config.ts:76`      | OK                |
| `experimental.viewTransition`         | ❎ disabled (motivé)           | `next.config.ts:79-83`   | OK choix          |
| `experimental.ppr`                    | ❎ disabled (parqué Sprint 17) | `next.config.ts:84-87`   | À ré-évaluer      |
| `optimizePackageImports` 14 paquets   | ✅                             | `next.config.ts:88-104`  | OK                |
| `reactCompiler`                       | ❎ disabled (parqué Sprint 17) | `next.config.ts:106-110` | À ré-évaluer      |
| `headers()` sécurité + Vary           | ✅                             | `next.config.ts:111-133` | OK                |
| `Cache-Control` sitemap/og            | ✅ patches V2                  | `next.config.ts:116-131` | OK                |
| `withSentryConfig` wrapper            | ❌ absent                      | grep                     | P1 sourcemaps off |

**Note CSP** : la CSP n'est plus dans `next.config.ts` (Sprint 24 → calculée per-request dans `proxy.ts:43`). Voir AGT-08.

### 2. Sentry weight (poids ×1.5)

| Aspect                                   | Statut                                            | Citation                              |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| Edge runtime init conditionnel sur DSN   | ✅                                                | `src/sentry.edge.config.ts:3-11`      |
| Server runtime init conditionnel sur DSN | ✅                                                | `src/sentry.server.config.ts:3-11`    |
| Client runtime init conditionnel sur DSN | ✅                                                | `src/instrumentation-client.ts:6-19`  |
| Replay sample rate prod                  | ✅ 0 (sécurité défensive)                         | `src/instrumentation-client.ts:16-17` |
| Traces sample rate prod                  | ✅ 0,1                                            | `src/instrumentation-client.ts:9`     |
| `tunnelRoute` (anti-adblock)             | ❌ absent                                         | grep `tunnel` ⇒ 0 hit src/            |
| Lazy-load SDK navigateur                 | ❌ chargé eagerly via `instrumentation-client.ts` | Next 16 auto-pull                     |
| Sourcemaps upload                        | ❌ no `withSentryConfig`                          | next.config.ts                        |
| Baseline mémoire (poids gz)              | ~150 KB gz observé                                | `axionia_audit_web_vitals_2026-05-08` |
| `onRequestError` côté server             | ✅                                                | `src/instrumentation.ts:18-20`        |
| `onRouterTransitionStart`                | ✅ exporté                                        | `src/instrumentation-client.ts:21`    |

**STOP & ASK** : à mesurer en Phase 4 P-06. Si Sentry > 100 KB gz dans le shell, P0 à déclencher. Aujourd'hui `[NON MESURÉ — postbuild risk]`.

### 3. Fonts (poids ×1.0)

| Aspect                                     | Statut                            | Citation                              |
| ------------------------------------------ | --------------------------------- | ------------------------------------- |
| Self-host via `next/font/google`           | ✅ Manrope, Inconsolata, Fraunces | `src/app/[locale]/layout.tsx:2,21-49` |
| `display: "swap"` partout                  | ✅                                | layout.tsx:24,30,46                   |
| Manrope 2 weights (400, 600)               | ✅ optimisé                       | layout.tsx:25                         |
| Inconsolata pas de weight (default)        | ⚠️ peut être lazy si peu utilisé  | layout.tsx:28-32                      |
| Fraunces 3 weights × 2 styles              | ⚠️ 6 woff2 — vérifier usage       | layout.tsx:43-49                      |
| `--font-fraunces` (anti auto-ref)          | ✅ Cert P-105                     | layout.tsx:45, csp note               |
| `preload` font hero `<link rel="preload">` | ❌ absent                         | grep `rel="preload"` = 0 hit src/     |
| `font-display: swap` rule CSS custom       | N/A — next/font le gère           | OK                                    |
| `prefers-reduced-motion` fallback          | ✅                                | `globals.css:386-395`                 |

### 4. Images (poids ×1.0)

| Aspect                                       | Statut                                                                      | Citation                                       |
| -------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| `<Image>` wrapper helper `Illustration`      | ✅ avec dim explicites                                                      | `src/components/visual/Illustration.tsx:87-96` |
| AVIF + WebP automatiques                     | ✅                                                                          | next.config.ts:69                              |
| `priority` réservé aux LCP heros (4 pages)   | ⚠️ utilisé sur `/guide-ia`, `/roi`, `/presse` ; pas sur home/audit/reserver | grep                                           |
| `sizes` responsive                           | ✅ default par ratio                                                        | Illustration.tsx:51-57                         |
| `placeholder="blur"`                         | ❌ pas appliqué (P-008 différé V2)                                          | grep                                           |
| `blurDataURL`                                | ❌ idem                                                                     |
| Public assets bitmap                         | quasi-aucun (`public/` = 19 KB total)                                       | `00-REALITY-CHECK.md:84`                       |
| `next/image` sur composants admin uniquement | + Footer presse logo                                                        | grep                                           |

### 5. Bundle analysis (poids ×1.5)

| Aspect                            | Statut                                                   | Citation                                      |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `@next/bundle-analyzer` câblé     | ✅ via env `ANALYZE=true`                                | `next.config.ts:136-138`                      |
| Script `bundle:analyze`           | ✅                                                       | `package.json:54`                             |
| `size-limit` config               | ⚠️ unique entrée 100 KB                                  | `package.json:161-167`                        |
| Cible AGENTS.md                   | 75 KB gz / route                                         | `AGENTS.md` Performance budget                |
| Cible `/reserver`                 | 110 KB gz                                                | `AGENTS.md` Exception                         |
| Mesure réelle dernière            | 870 KB-1,02 MB uncompressed (~270-310 KB gz)             | `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md:44` |
| Gap vs cible                      | **3-4×**                                                 | idem                                          |
| Gate CI `pnpm bundle:check` câblé | ❌ pas dans `.github/workflows/` (à confirmer AGT-12)    |
| `size-limit` glob générique       | ⚠️ `path: ".next/static/chunks/**/*.js"` — pas per-route | package.json:164                              |

**Note** : la cible 75 KB gz / route impose un `size-limit` **par page** (config tableau). Aujourd'hui une seule entrée 100 KB globale = pas de protection per-route → drift facile.

### 6. Third-parties (poids ×1.0)

| Service                     | Chargement                                            | Bundle impact            | Citation                                       |
| --------------------------- | ----------------------------------------------------- | ------------------------ | ---------------------------------------------- |
| Plausible Analytics         | `<Script defer afterInteractive>` no-op si env absent | ~7 KB gz + 1 RTT DNS/TLS | `src/components/analytics/Plausible.tsx:12-29` |
| Cloudflare Turnstile        | client side `useEffect` injection ; widget asynchrone | ~30 KB gz quand affiché  | `src/lib/turnstile.ts` (à inspecter)           |
| Sentry `@sentry/nextjs`     | `instrumentation-client.ts` eager                     | ~150 KB gz baseline      | `src/instrumentation-client.ts:6`              |
| `next/og` (opengraph-image) | Edge runtime, build-time                              | 0 KB shell               | `src/app/opengraph-image.tsx:10,13`            |
| `web-vitals` v5             | via `useReportWebVitals` Next                         | ~3 KB gz                 | `src/components/analytics/WebVitals.tsx:5`     |
| Plausible `preconnect`      | ❌ manquant                                           | LCP-INP risk             | `<head>` layout                                |

### 7. RSC / `'use client'` / `dynamic()` (poids ×1.2)

| Aspect                             | Statut                                                                                                                    | Citation                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Composants `'use client'` total    | **54 fichiers**                                                                                                           | grep count                                              |
| Forms `'use client'`               | 6 (Audit/Booking/Contact/Implementation/Newsletter + AuditRequest)                                                        | grep forms/                                             |
| Calendar `'use client'`            | 4 (BookingCalendar 2131 LOC, BookingCalendarLazy wrapper, BookingFlow, HouseCalendar)                                     | grep calendar/                                          |
| Admin `'use client'`               | ~15 (16 forms + actions UI)                                                                                               | grep (admin)/                                           |
| Header nav `'use client'`          | 6 (NavLink, MobileNav, LocaleSwitcher, HeaderMegaMenu, HeaderImplantationsMenu, HeaderInterventionsMenu)                  | grep nav/                                               |
| Composants Radix UI `'use client'` | 14 (accordion, checkbox, dialog, dropdown, label, popover, radio, select, separator, slider, slot, switch, tabs, tooltip) | grep ui/                                                |
| `dynamic()` import                 | **1** seul (`BookingCalendarInner` via `BookingCalendarLazy`)                                                             | `src/components/calendar/BookingCalendarLazy.tsx:21-39` |
| `ssr: false` usage                 | ✅ 1 fois (BookingCalendar)                                                                                               | idem                                                    |
| `loading` skeleton sur `dynamic()` | ✅ avec dimensions réelles 800 px                                                                                         | idem:30-37                                              |

**Observation** : 54 islands `'use client'` est élevé pour un site marketing. La majorité sont des composants Radix UI génériques (qui se déplient en `'use client'` partout où ils sont importés). À surveiller : tout import Radix dans une page = la page touche au shell client.

### 8. View Transitions API (Next 16) (poids ×1.0)

- `experimental.viewTransition` désactivé volontairement (`next.config.ts:79-83`), commentaire détaillé.
- `globals.css:401-409` anticipe le futur (rule reduce-motion sur `::view-transition-*`).
- Aucun `<ViewTransition>` wrapper dans le code.
- **OK choix** : pas d'impact CLS aujourd'hui ; à activer Sprint 17 si décidé.

### 9. React Compiler 19 (poids ×1.0)

- `reactCompiler: true` désactivé (`next.config.ts:106-110`), commentaire détaillé (Babel takeover ralentit Turbopack +10-25 % cold build).
- Lint phase 0 remonte 5 forms incompatibles (cf. P1-PERF-07).
- Décision parquée Sprint 17. Bonne maîtrise.

### 10. Caching côté code (poids ×1.0)

| Aspect                                     | Statut                                                           | Citation                                            |
| ------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| `headers()` Cache-Control sitemap/og       | ✅ V2 patches                                                    | `next.config.ts:115-131`                            |
| `revalidate` exports détectés              | 4 fichiers : `sitemap-index.xml/route.ts:26` (3600), 3 feeds RSS | grep `export const revalidate`                      |
| `unstable_cache` usage                     | ❌ 0 hit                                                         | grep                                                |
| `Cache-Control` routes textuelles          | ✅ `llms.txt` 1h, `llms-full.txt` 1h, `feed.xml` 15min-1h        | `src/app/llms*.txt/route.ts`, `*/feed.xml/route.ts` |
| `fetch` cache (Next default `force-cache`) | Implicite — pas de surcharge `{ cache: "no-store" }` détectée    | grep                                                |
| ISR cron purge                             | ❌ pas observé                                                   | `.github/workflows/`                                |

### 11. CLS sources

| Source potentielle                       | Statut                                                    | Citation                                                                        |
| ---------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Fonts swap                               | ✅ `display: "swap"` + next/font auto fallback metrics    | layout.tsx:24-49                                                                |
| Images sans dim                          | ✅ `Illustration` impose width/height par aspectRatio     | `Illustration.tsx:41-49,87-96`                                                  |
| `loading.tsx` granulaires                | ✅ 5 fichiers (locale root + 4 strat)                     | grep `app/**/loading.tsx`                                                       |
| `BookingCalendar` skeleton 800px         | ✅ dim cohérentes                                         | `BookingCalendarLazy.tsx:30-37`                                                 |
| Animations Motion                        | ✅ remplacées par CSS transition `FadeInOnView`           | `FadeInOnView.tsx:50-64`                                                        |
| Cookie banner CLS                        | ❌ pas de gate consent ; pas de banner détectée code-side | `src/app/[locale]/preferences-cookies/page.tsx` (page legal, pas banner global) |
| Anti-CLS doctrine `.hero-schema` 576×576 | ✅ Cert                                                   | `axionia_hero_schema_v3_2.md` mémoire                                           |

### 12. Budgets et CI

| Fichier                     | Budget                | Conformité doctrine             | Citation             |
| --------------------------- | --------------------- | ------------------------------- | -------------------- |
| `lighthouserc.json` Perf    | ≥ 0,95 error          | strict                          | l. 30                |
| `lighthouserc.json` LCP     | ≤ 1 800 ms            | doctrine ok                     | l. 34                |
| `lighthouserc.json` INP     | ≤ 80 ms               | **drift** vs AGENTS 100 ms      | l. 35                |
| `lighthouserc.json` CLS     | ≤ 0,05                | doctrine strict 0               | l. 36                |
| `lighthouserc.json` TBT     | ≤ 150 ms              | doctrine ok                     | l. 37                |
| `package.json` size-limit   | 100 KB total          | drift vs doctrine 75 KB / route | l. 161-167           |
| Gate CI `pnpm lhci`         | ❓ à confirmer AGT-12 | non observé                     | `.github/workflows/` |
| Gate CI `pnpm bundle:check` | ❓ à confirmer AGT-12 | non observé                     | idem                 |

---

## Citations

| Évidence                                                     | Source                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `compress: true` double avec Caddy V3                        | `next.config.ts:46`, `Caddyfile:48-52`                                                                                 |
| Sentry SDK init client (3 fichiers)                          | `src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation.ts`  |
| Fonts Manrope/Inconsolata/Fraunces self-host                 | `src/app/[locale]/layout.tsx:2,21-49`                                                                                  |
| BookingCalendar 2131 LOC, 29 useState, 0 useTransition       | wc/grep `src/components/calendar/BookingCalendar.tsx`                                                                  |
| BookingCalendarLazy `dynamic()` + ssr:false + skeleton 800px | `src/components/calendar/BookingCalendarLazy.tsx:21-39`                                                                |
| Speculation Rules eager prefetch × 15 URLs                   | `src/app/[locale]/layout.tsx:178-235`                                                                                  |
| 4 `loading.tsx` granulaires + 1 root                         | `src/app/[locale]/{loading,reserver/loading,audit/loading,contact/loading,implantations/[region]/[ville]/loading}.tsx` |
| 0 `<Suspense>` dans app/                                     | grep                                                                                                                   |
| `size-limit` 100 KB globale                                  | `package.json:161-167`                                                                                                 |
| `lhci` autorun non câblé dans CI                             | `package.json:33-34` + absence dans `.github/workflows/` (à confirmer Pass B)                                          |
| Plausible `afterInteractive` sans preconnect                 | `src/components/analytics/Plausible.tsx:21-28`                                                                         |
| Motion `framer-motion` remplacé par CSS                      | `src/components/motion/FadeInOnView.tsx:1-65` ; package.json:97 dead dep                                               |
| `images.minimumCacheTTL` 1 an                                | `next.config.ts:76`                                                                                                    |
| Baseline 2026-05-08 — score perf 47.2 %                      | `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md:7,38-46`                                                                     |
| CLS `/reserver` 0,552 lab smoke                              | idem ligne 46                                                                                                          |
| Lighthouserc local 5 URLs × desktop+mobile × 3 runs          | `lighthouserc.json:4-26`                                                                                               |

---

## [INCONNU] — éléments non vérifiables sans build / Phase 4

- `[NON MESURÉ — postbuild risk]` First Load JS gz **réel** par route (`/`, `/reserver`, `/audit`, `/implantations/ile-de-france/paris`). Cible : ≤ 75 KB, exception `/reserver` ≤ 110 KB. Mesure exige `pnpm build` + `bundle:analyze` ou `size-limit` per-route.
- `[NON MESURÉ — postbuild risk]` Poids gz du SDK Sentry navigateur dans le shell. Baseline mémoire 150 KB. Mesure exige `next build` + inspection chunk.
- `[NON MESURÉ — Phase 4 P-06]` Lighthouse scores réels desktop+mobile (Perf, A11y, BP, SEO) sur les 10 URLs `lighthouserc.json`.
- `[NON MESURÉ — Phase 4]` CLS `/reserver` après P-101 + P-401 patches. Doit confirmer < 0,1 (idéalement 0).
- `[NON MESURÉ — Phase 4]` INP `/reserver` p75 — vérifier exception 150 ms tenue.
- `[NON MESURÉ — Phase 4]` Compteur de woff2 réellement chargés par page (Fraunces 6 fichiers, Inconsolata, Manrope).
- `[INCONNU]` Si `pnpm lhci` / `pnpm bundle:check` tournent en CI : à confirmer Pass B contre `.github/workflows/`.
- `[INCONNU]` Si Sentry replay JS est tree-shaké au build ou présent dans bundle (sample rate 0 doit le drop mais à vérifier `bundle:analyze`).
- `[INCONNU]` Taille gz exacte de `lucide-react` après tree-shake (81 fichiers l'importent, mais `optimizePackageImports` doit splitter).
- `[INCONNU]` `tunnelRoute` Sentry absent — vérifier en Pass B si désiré par doctrine (anti-adblock).

---

## Recommandations (≤ 10, classées effort × impact)

| #   | Recommandation                                                                                                                                                          | Effort | Impact perf                       | Risque | STOP&ASK              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------- | ------ | --------------------- |
| 1   | **Câbler `pnpm lhci:autorun` + `pnpm bundle:check` dans `.github/workflows/` PR-gate**                                                                                  | XS     | Empêche régression future         | Faible | non                   |
| 2   | **Découper `size-limit` per-route** (entrée par bundle de page critique : home, /audit, /reserver, /implantations/[ville]) avec budgets 75 KB / 110 KB exception        | XS     | Détecte drift dès la PR           | Faible | non                   |
| 3   | **Ajouter `<link rel="preconnect">` vers `plausible.axion-ia.com` + `*.ingest.sentry.io`** dans `<head>` du `layout.tsx` (4 lignes)                                     | XS     | LCP −30-60 ms p75                 | Faible | non                   |
| 4   | **Aligner `lighthouserc.json` INP 80 → 100 ms** ou amender `AGENTS.md` à 80 ms (résoudre drift)                                                                         | XS     | Cohérence doctrine                | Faible | ⚠️ Will arbitre seuil |
| 5   | **Tester en local `pnpm bundle:analyze` (env `ANALYZE=true`)** pour mesurer Sentry réel. Si > 100 KB gz → ADR Sprint 16 lazy-load Sentry ou downgrade `@sentry/browser` | M      | −50 à −100 KB shell potentiel     | Moyen  | ⚠️ ADR 0014           |
| 6   | **Retirer `motion@^11.18.2` de `package.json`** (dead dep, P-410 codé mais dep restée)                                                                                  | XS     | −30 KB devDep + clarté            | Faible | non                   |
| 7   | **Appliquer P-201 useTransition autour de `router.replace` BookingCalendar** (lignes 324, 346)                                                                          | S      | INP /reserver −30-80 ms p75       | Faible | non                   |
| 8   | **Ajouter `<link rel="preload" as="font">` pour Manrope 600 hero font** (poid LCP critique mobile)                                                                      | XS     | LCP −150 ms p75                   | Faible | non                   |
| 9   | **Décider statut PPR `experimental.ppr = "incremental"`** + ajouter `<Suspense>` boundaries sur `/reserver`, `/audit`, `/contact` (shell static + content streamé)      | L      | TTFB shell instantané sur dynamic | Élevé  | ⚠️ ADR 0011           |
| 10  | **Appliquer V3 du baseline : retirer `compress: true` une fois Caddy live confirmé** (le commentaire ligne 46 le prévoit)                                               | XS     | −5 % CPU CPX32                    | Faible | non vérifier ON Caddy |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-PERF-01** — INP seuil CI 80 ms (lighthouserc) vs budget AGENTS.md 100 ms : on durcit en CI à 80 ms ou on remonte AGENTS.md ?
- **Q-PERF-02** — ADR 0014 lazy-load Sentry / downgrade `@sentry/browser` : à valider seulement si Phase 4 P-06 confirme > 100 KB gz dans le shell. Ouvre une décision « observabilité Phase 4 P-06 vs poids shell » — Will arbitre.
- **Q-PERF-03** — ADR 0011 PPR `experimental.ppr = "incremental"` Sprint 16 : sortir de parking. Pré-requis = `<Suspense>` boundaries sur `/reserver`, `/audit`, `/contact`. Décision Will.
- **Q-PERF-04** — `tunnelRoute` Sentry (anti-adblock) : nice-to-have ou non-priorité ?
- **Q-PERF-05** — `motion` package retiré du JS bundle (P-410 codé) mais reste dans `package.json:97` (dead dep). Confirmer suppression `pnpm remove motion`.
- **Q-PERF-06** — `compress: true` (`next.config.ts:46`) double avec Caddy brotli. Le commentaire prévoit V3 = false. Le faire **maintenant** que Caddy est live (cf. `axionia_session_2026-05-09_stabilisation_complete`).
- **Q-PERF-07** — Lighthouse CI **n'a jamais tourné** sur main ? `.github/workflows/deploy-coolify.yml` à inspecter (AGT-12 le confirme). Si oui : on patche dans le sprint correctif.

---

**Verdict AGT-03** : 🟡 **70/100** — la doctrine perf est solide sur le papier (next.config bien configuré, fonts optimisées, BookingCalendar lazy, motion retiré du shell, anti-CLS skeleton, RSC majoritaire), mais **3 trous critiques** : (i) **aucun gate CI** Web Vitals/bundle effectif → drift facile en sprint backend, (ii) **Sentry weight** ~150 KB gz baseline non re-vérifié post-patches, (iii) **PPR/Suspense** absent → TTFB visible client = TTFB serveur full sur pages DB. La pondération ×1.5 du périmètre fait que ce score pèse sur le verdict global.
