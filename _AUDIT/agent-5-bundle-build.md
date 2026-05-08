# Agent 5 — Bundle JS & Build & Tooling

> Audit lecture-seule du chapitre 6 (Bundle JS) du prompt PROMPT-WEB-VITALS-PERFECTION-2026
>
> - recommandations cross-cutting tooling.
>   Build référencé : `.next/BUILD_ID = E3PP2kWtZKG7UfgwwGBdi` (2026-05-08 13:02 CEST).
>   Aucun fichier source modifié.

## Score chapitre 6 : 31 / 150

Détail par critère sur les 15 pages stratégiques (10 critères × 15 pages).
Agrégat (tous critères, toutes pages confondues) :

| Critère | Sujet                                                        |       Pts/15 | Constat synthétique                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------ | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1     | Bundle initial route home ≤ 90 KB gzip                       |   **0** / 15 | Home First Load 1 022 KB uncomp. ≈ 305 KB gzip / 230 KB Brotli — gap +215 KB gzip.                                                                                                                                                                                                                                                                                       |
| 6.2     | Aucun paquet > 30 KB gz importé sans `dynamic()` côté client |   **0** / 15 | Sentry SDK = ~150 KB gz dans le shell global (chunk 447 KB). Motion 109 KB chunk = ~28 KB gz **mais** pénètre le shell global. BookingCalendar (2095 lignes, lucide + Dialog + form) importé statiquement dans `/reserver`.                                                                                                                                              |
| 6.3     | `lucide-react` tree-shaké                                    |  **15** / 15 | `optimizePackageImports` actif (next.config.ts L40) + 72 fichiers utilisent `from "lucide-react"` avec named imports. Chunk `008~m8cwczh71.js` (48 KB) montre des icônes route-spécifiques (Calendar pour /reserver). OK.                                                                                                                                                |
| 6.4     | Radix UI sub-paquets utilisés uniquement                     |  **15** / 15 | 14 sub-paquets dans `optimizePackageImports`, tous utilisés (cf. `src/components/ui/`).                                                                                                                                                                                                                                                                                  |
| 6.5     | Pas de `moment.js` / `lodash`                                |  **15** / 15 | Aucun moment / lodash dans dependencies. Pas vu non plus de date-fns.                                                                                                                                                                                                                                                                                                    |
| 6.6     | `next-intl` messages chunked par locale                      | **0,5** / 15 | `src/i18n/request.ts` utilise `await import(\`../messages/${locale}.json\`)`✅ chunké, MAIS`[locale]/layout.tsx`passe TOUS les messages au`NextIntlClientProvider`. Chaque page hydrate ~13 KB de JSON + le runtime next-intl client (~5-7 KB gz). À auditer plus fin sur le périmètre (passer namespaces partiels). Score moitié = chunking OK mais pas de namespacing. |
| 6.7     | Code-splitting BookingCalendar                               |   **0** / 15 | `src/app/[locale]/reserver/page.tsx` L7 : `import { BookingCalendar }` static. 2 095 lignes de client-only avec Dialog + Input + form state + 14 lucide icons. PAS de `dynamic()`. Le composant pollue le shell sur /reserver (chunk `123c55odke32p.js` 7 KB pour wiring + `008~m8cwczh71.js` 48 KB pour icônes).                                                        |
| 6.8     | Aucune polyfill inutile                                      |  **15** / 15 | Next 16 cible navigateurs evergreen, pas de polyfill manuel détecté.                                                                                                                                                                                                                                                                                                     |
| 6.9     | Source maps désactivés en prod                               |  **15** / 15 | `productionBrowserSourceMaps` non précisé → défaut Next 16 = `false`. Vérifié : aucun `.js.map` dans `.next/static/chunks/`. ✅                                                                                                                                                                                                                                          |
| 6.10    | Bundle delta < +5 KB par PR (gate CI)                        |   **0** / 15 | `package.json` size-limit = 1 budget global "100 KB total" sur `.next/static/chunks/**/*.js` — **fail d'office** (la home seule est à ~290 KB gz). Aucun gate per-route. Aucune Action GitHub size-limit.                                                                                                                                                                |

**TOTAL chapitre 6 : 75,5 / 150** (51 %).

> Détail granulaire par page : les 15 pages partagent le même shell géant. Les scores 6.1/6.2/6.7 sont **0** sur toutes les pages parce que les chunks problématiques sont dans le shell commun → impact homogène. Les scores 6.3/6.4/6.5/6.8/6.9 sont 1 sur toutes les pages.

---

## TOTAL : 75,5 / 150 + recommandations tooling cross

### Tooling cross-cutting (hors scoring 6, mais critique)

- **Bundle analyzer cassé** : `@next/bundle-analyzer 16.2.4` (devDep + plugin webpack via `withBundleAnalyzer` ligne 68 de `next.config.ts`). Next 16 utilise **Turbopack** par défaut → le plugin va soit déclencher un fallback build webpack lent, soit ne rien produire. **Action P-404 ci-dessous**.
- **Lighthouse CI mobile preset absent** : `lighthouserc.json` ne configure que `preset: "desktop"` → critère 1.8 du chapitre 1 fail d'office. **Action P-406**.
- **`bundle:check` script** : `pnpm size-limit` sur 1 budget global `100 KB` qui couvre `.next/static/chunks/**/*.js`. Configuration intenable : (a) on regarde le total des chunks et pas le bundle First Load par route ; (b) seuil 100 KB inatteignable sur le total. **Action P-405**.
- **`serverExternalPackages` absent** dans `next.config.ts` → aucune protection si une dep backend (`@prisma/client`, `bullmq`, `ioredis`, `argon2`, `otplib`, `sharp`) finit importée côté client par erreur. **Action P-400**.

---

## Inventaire deps client-leak suspectées (chiffrage)

| Dep                                                    | Version                   | Impact estimé client KB gz                                                                                                                | Présent dans le bundle prod ?                                                                               | Justifiée client ?                                                                                                                            | Patch                                                                                |
| ------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@sentry/nextjs`                                       | 10.51.0                   | **~150 KB gz** (chunk 447 KB uncompressed = ~52 % du shell global)                                                                        | **OUI** — confirmé via grep `sentry / sentry.io / replay / browserTracing` dans `0umi.ac91gj7p.js`          | Oui (RUM erreurs prod), MAIS Replay + tracing 10 % = trop pour V1                                                                             | P-403 (Replay 0 % + lazy load Sentry SDK), P-415 (alternative gratuite : custom RUM) |
| `motion` (Framer Motion v11)                           | 11.18.2                   | ~28-32 KB gz (chunk 108 881 B uncompressed)                                                                                               | **OUI** — chunk `0e2om08_u_puj.js` confirmé via `framerAppearId / motionComponentSymbol / spring / inertia` | **NON** — utilisé uniquement par `FadeInOnView.tsx` (fade + translate 8px) sur 2 pages (home + /sections). IntersectionObserver + CSS = 0 KB. | P-410 (remplacer motion par CSS+IO)                                                  |
| `next-auth`                                            | 5.0.0-beta.31             | 0 KB (non utilisé src/)                                                                                                                   | NON détecté dans bundle                                                                                     | Pas encore wiré (Sprint 17 ?)                                                                                                                 | P-411 (déclarer optionalDependency ou retirer jusqu'au Sprint qui l'utilise)         |
| `@tanstack/react-query`                                | 5.100.9                   | 0 KB                                                                                                                                      | NON détecté                                                                                                 | Pas wiré (aucun `useQuery / useMutation / QueryClient` dans src/)                                                                             | P-411                                                                                |
| `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit`   | 3.22.5                    | 0 KB                                                                                                                                      | NON détecté                                                                                                 | **Aucun** import dans src/                                                                                                                    | P-411                                                                                |
| `zustand`                                              | 4.5.7                     | 0 KB                                                                                                                                      | NON détecté                                                                                                 | Aucun `zustand / create()` dans src/                                                                                                          | P-411                                                                                |
| `bullmq` + `ioredis`                                   | 5.76.5 / 5.10.1           | 0 KB                                                                                                                                      | NON détecté côté client                                                                                     | Backend uniquement (queue worker — `pnpm worker` script)                                                                                      | P-400 (verrouiller via `serverExternalPackages`)                                     |
| `argon2` + `otplib`                                    | 0.44.0 / 13.4.0           | 0 KB                                                                                                                                      | NON détecté côté client                                                                                     | Backend (auth)                                                                                                                                | P-400                                                                                |
| `prisma` + `@prisma/client`                            | 5.22.0                    | 0 KB                                                                                                                                      | NON détecté côté client                                                                                     | Backend uniquement                                                                                                                            | P-400                                                                                |
| `@vercel/og`                                           | 0.11.1                    | 0 KB                                                                                                                                      | NON détecté côté client                                                                                     | **Server-only** — utilisé uniquement dans `src/app/api/og/route.tsx`. ✅                                                                      | aucun                                                                                |
| `react-hook-form` + `@hookform/resolvers` + `zod`      | 7.75.0 / 3.10.0 / 3.25.76 | ~22-25 KB gz pour zod (chunk `0l5w54vrhrfdq.js` 65 KB confirmé via grep zod helpers `assertEqual / arrayToEnum / objectKeys`). RHF léger. | OUI partiellement                                                                                           | OUI sur formulaires client (`/contact`, `/audit/demande`, `/reserver`, `/contact`)                                                            | P-412 (faire en sorte que zod ne pénètre pas le shell global)                        |
| `class-variance-authority` + `tailwind-merge` + `clsx` | 0.7.1 / 3.5.0 / 2.1.1     | ~3 KB gz cumulés                                                                                                                          | OUI                                                                                                         | OUI (utility runtime UI)                                                                                                                      | aucun                                                                                |
| `web-vitals`                                           | 5.2.0                     | ~3 KB gz                                                                                                                                  | OUI (via `useReportWebVitals` dans `WebVitals.tsx`)                                                         | OUI (RUM)                                                                                                                                     | aucun                                                                                |
| `lucide-react`                                         | 1.14.0                    | route-dépendant : ~2-15 KB gz (treeshaké)                                                                                                 | OUI partiellement (selon icônes utilisées)                                                                  | OUI (icônes UI)                                                                                                                               | aucun (déjà optimizé)                                                                |
| `@radix-ui/react-*` (15 sub-paquets)                   | 1.x-2.x                   | ~15-25 KB gz total (treeshaké)                                                                                                            | OUI partiellement                                                                                           | OUI (UI primitives)                                                                                                                           | aucun                                                                                |
| `next-intl`                                            | 4.11.0                    | ~5-7 KB gz runtime + 13 KB JSON par locale                                                                                                | OUI                                                                                                         | OUI (i18n FR/EN)                                                                                                                              | P-413 (namespacer les traductions client vs server)                                  |

**Verdict** : le shell global de ~870 KB uncompressed (~280 KB gz) est dominé par **Sentry (~150 KB gz, 53 % du shell), Next.js framework (~80 KB gz, 28 %), motion (~30 KB gz, 11 %), zod+RHF (~25 KB gz, 9 %)**. Les ~5 % restants sont next-intl + Turbopack runtime + Radix shared.

**Cible 70 KB gz** sur la home = retirer Sentry full-load + motion = **~280 KB gz - 180 KB = 100 KB gz** atteignable réaliste, soit 70 KB après Brotli front Caddy/CF. Cible exacte 70 KB gz reste serrée mais réalisable avec : (a) Sentry lazy + Replay 0 %, (b) motion → CSS, (c) zod côté server uniquement où possible, (d) cleanup deps non utilisées.

---

## Diagnostic per-page (Top 15 stratégiques)

Toutes les pages partagent le même shell global. Les chunks distinctifs sont à droite ("Δ shell").

| Page                                       | First Load uncomp | Estimé gz (~30 %) | Estimé Brotli (~22 %) |        Cible doctrine | Top contributeurs estimés (gz)                                      | Δ shell (chunk route-spécifique)                                                |
| ------------------------------------------ | ----------------: | ----------------: | --------------------: | --------------------: | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/[locale]` (home)                         |         1 022 125 |           ~307 KB |               ~225 KB |              70 KB gz | Sentry 150 + Next 80 + motion 30 + zod 22 + lucide ~5 + next-intl 7 | `0umzhzvb.2o9s.js` (26 KB) — page chunk + content fixtures                      |
| `/[locale]/sections`                       |         1 010 851 |           ~303 KB |               ~222 KB |              70 KB gz | idem + motion (FadeInOnView aussi présent)                          | `0a7jzrwne2gp2.js` (15 KB)                                                      |
| `/[locale]/guide-ia`                       |         1 003 978 |           ~301 KB |               ~221 KB |              70 KB gz | idem (motion absent)                                                | `0y039rto-icbh.js` (22 KB) + `1557.74dxcpdg.js` (30 KB) — fixtures glossaire IA |
| `/[locale]/contact`                        |         1 002 905 |           ~301 KB |               ~220 KB |              70 KB gz | idem + RHF/zod renforcé                                             | `0.yfxzop-dbs3.js` (21 KB) — ContactForm                                        |
| `/[locale]/audit/demande`                  |           985 340 |           ~296 KB |               ~217 KB |              70 KB gz | idem + AuditForm                                                    | `0cdlwqc3.z7ow.js` (33 KB)                                                      |
| `/[locale]/reserver`                       |           941 728 |           ~283 KB |               ~207 KB | 95 KB gz (calendrier) | idem + calendrier client                                            | `123c55odke32p.js` (7 KB) + `008~m8cwczh71.js` (48 KB lucide icons)             |
| `/[locale]/audit`                          |           914 850 |           ~274 KB |               ~201 KB |              70 KB gz | shell only + variation produit                                      | `0~d9w4m00q~cg.js` (28 KB) — ProductPageTemplate                                |
| `/[locale]/implementation`                 |           914 850 |           ~274 KB |               ~201 KB |              70 KB gz | idem                                                                | `0~d9w4m00q~cg.js` (28 KB, mutualisé)                                           |
| `/[locale]/interventions`                  |           913 244 |           ~274 KB |               ~201 KB |              70 KB gz | idem                                                                | shell only                                                                      |
| `/[locale]/interventions/essentielle`      |           899 104 |           ~270 KB |               ~198 KB |              70 KB gz | idem                                                                | shell + sub-page chunk                                                          |
| `/[locale]/audit/flash`                    |           899 104 |           ~270 KB |               ~198 KB |              70 KB gz | idem                                                                | shell + sub-page chunk                                                          |
| `/[locale]/cas-concrets`                   |           901 285 |           ~270 KB |               ~198 KB |              70 KB gz | idem                                                                | shell + content chunk                                                           |
| `/[locale]/methodologie`                   |           901 285 |           ~270 KB |               ~198 KB |              70 KB gz | idem                                                                | shell + MethodologyHeroSchema chunk                                             |
| `/[locale]/comparaisons`                   |           901 285 |           ~270 KB |               ~198 KB |              70 KB gz | idem                                                                | shell + comparison chunk                                                        |
| `/[locale]/stack-ia`                       |           901 285 |           ~270 KB |               ~198 KB |              70 KB gz | idem                                                                | shell + tools chunk                                                             |
| `/[locale]/implantations`                  |           887 031 |           ~266 KB |               ~195 KB |              70 KB gz | shell only                                                          | shell only                                                                      |
| `/[locale]/implantations/[region]`         |           887 031 |           ~266 KB |               ~195 KB |              70 KB gz | shell only                                                          | shell only                                                                      |
| `/[locale]/implantations/[region]/[ville]` |           899 104 |           ~270 KB |               ~198 KB |              70 KB gz | shell only                                                          | shell + ville chunk                                                             |

**Constat** : la variance per-route est faible (±15 %). Le levier décisif est sur le shell global.

---

## Patches P-400 → P-499

### P-400 — `serverExternalPackages` setup (verrouillage anti-leak)

**Effort** : XS (5 min)
**Gain estimé** : prévention. Pas de gain immédiat (les deps ne fuient pas aujourd'hui), mais protège contre une future régression. Si un développeur importe `import { hashPassword } from "argon2"` par erreur côté client, le build casse au lieu de leak ~70 KB gz dans le shell.
**Risque** : Faible. Annotation explicite des deps déjà server-only.
**Dépendances** : aucune.

**Fichier** : `next.config.ts`

**Diff** :

```diff
 const nextConfig: NextConfig = {
   reactStrictMode: true,
   poweredByHeader: false,
   compress: true,
+  // Verrouille les deps strictement Node.js — empêche tout leak côté
+  // client si un import est mal placé. Liste alignée sur les deps backend
+  // installées (BACKLOG Sprint 15+ : auth + queue + DB).
+  serverExternalPackages: [
+    "@prisma/client",
+    "prisma",
+    "argon2",
+    "otplib",
+    "bullmq",
+    "ioredis",
+    "nodemailer",
+    "pino",
+    "sharp",
+  ],
   images: {
     formats: ["image/avif", "image/webp"],
     remotePatterns: [],
   },
```

**Validation** : `pnpm build` doit produire le même bundle (pas de delta). Test négatif : importer `import bcrypt from "argon2"` dans un Client Component → build doit échouer avec erreur explicite.

---

### P-401 — Lazy-load BookingCalendar via `next/dynamic`

**Effort** : S (30 min)
**Gain estimé** : `/reserver` First Load **−55 à −70 KB gz** (lucide icons calendrier route-isolés + Dialog + form state ne sont chargés qu'au mount du composant). Pas d'impact sur les 14 autres pages (BookingCalendar n'y était pas).
**Risque** : Faible. Le composant est déjà `"use client"` et n'a pas besoin de SSR (calendar interactif).
**Dépendances** : aucune.

**Fichier** : `src/app/[locale]/reserver/page.tsx`

**Diff** :

```diff
 import type { Metadata } from "next";
 import { setRequestLocale } from "next-intl/server";
 import { hasLocale } from "next-intl";
 import { notFound } from "next/navigation";
+import dynamic from "next/dynamic";
 import { routing, type Locale } from "@/i18n/routing";
 import { Container } from "@/components/layout/Container";
-import { BookingCalendar, type BookedSlot } from "@/components/calendar/BookingCalendar";
+import type { BookedSlot } from "@/components/calendar/BookingCalendar";
 import { Cta } from "@/components/marketing/Cta";
 import { CtaBlock } from "@/components/sections/CtaBlock";
 import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
 import { buildProductMetadata } from "@/lib/seo";
+
+// Lazy : 2 095 lignes de UI client (Dialog + form 4 étapes + 14 lucide icons).
+// Skeleton aux dimensions réelles pour CLS = 0 pendant le swap.
+const BookingCalendar = dynamic(
+  () => import("@/components/calendar/BookingCalendar").then((m) => m.BookingCalendar),
+  {
+    ssr: false,
+    loading: () => (
+      <div className="bg-border h-[640px] w-full animate-pulse rounded-md" aria-hidden="true" />
+    ),
+  },
+);
```

**Validation** :

- `pnpm build` → vérifier que `/reserver` First Load chute de ~50 KB gz (≈ −170 KB uncompressed).
- DevTools Network sur `/reserver` : le chunk BookingCalendar n'apparaît qu'après hydration.
- `re-export type BookedSlot` toujours utilisé par `buildFixtureBookedSlots` (typecheck OK).

---

### P-402 — Lazy-load TipTap éditeur (préventif Sprint 17+)

**Effort** : S (à appliquer **uniquement si** TipTap commence à être utilisé)
**Gain estimé** : si TipTap est wiré sur une page admin, sans lazy il chargerait ~80-120 KB gz dans le shell. Avec lazy : 0 KB hors page admin.
**Risque** : Faible.

**Statut actuel** : **TipTap n'est pas importé dans `src/`**. La dépendance reste dans `package.json` sans usage. Recommandation : retirer `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit` si Sprint 17 admin n'arrive pas avant V1 prod.

**Diff** (si conservée pour Sprint 17 admin) :

```diff
+// Pattern à appliquer dès le premier usage (placeholder du futur fichier)
+const TipTapEditor = dynamic(() => import("./TipTapEditorClient"), {
+  ssr: false,
+  loading: () => <div className="h-96 w-full animate-pulse bg-border" />,
+});
```

---

### P-403 — Sentry Replay → 0 % en prod + lazy SDK

**Effort** : M (1-2 h)
**Gain estimé** : **−15-25 KB gz** sur le shell global (Replay add-on pèse ~40-60 KB uncompressed même à 1 % sample).
**Risque** : Moyen — perte de la capacité Replay (mais à 1 % on-error elle est de toute façon sous-utilisée pour V1).
**Dépendances** : aucune. Si on veut aller plus loin (P-403b lazy load complet du SDK Sentry), nécessite refactor `instrumentation-client.ts` en lazy.

**Fichier 1** : `src/instrumentation-client.ts`

**Diff (P-403a — désactiver Replay V1)** :

```diff
 import * as Sentry from "@sentry/nextjs";

 const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

 if (dsn) {
   Sentry.init({
     dsn,
     tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
     environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
-    replaysSessionSampleRate: 0,
-    // Replays add ~30 KB to the client bundle and capture overhead on errors.
-    // 1% on errors is enough to debug regressions without weighing nav perf.
-    replaysOnErrorSampleRate: 0.01,
+    // V1 — Replay désactivé (gain ~20 KB gz bundle). Réactiver Sprint 18+
+    // si besoin de debug visuel (1% on-error) sur incidents prod.
+    // replaysSessionSampleRate: 0,
+    // replaysOnErrorSampleRate: 0,
+    // Lazy-load Replay integration on demand (V2) :
+    // integrations: () => [],
   });
 }

 export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

**Note** : Sentry V10 ne supprime PAS automatiquement le code Replay du bundle même quand `replaysSessionSampleRate: 0` — il faut explicitement ne pas charger l'intégration. Cf. Sentry docs : `Sentry.init({ integrations: [Sentry.browserTracingIntegration()] })` sans `Sentry.replayIntegration()`.

**Diff complémentaire (P-403b — drop Replay integration)** :

```diff
 if (dsn) {
   Sentry.init({
     dsn,
     tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
     environment: process.env["NEXT_PUBLIC_APP_ENV"] ?? "development",
+    // V1 : pas de Replay → exclut explicitement l'intégration.
+    // Sentry next/sentry charge auto Replay sinon — il faut override la
+    // liste des integrations pour forcer le tree-shaking.
+    integrations: [Sentry.browserTracingIntegration()],
   });
 }
```

**Validation** :

- Bundle analyzer (ou `pnpm next experimental-analyze` après P-404) : chunk Sentry doit chuter de ~447 KB → ~280-320 KB uncompressed.
- DevTools Network : aucune requête vers `https://browser.sentry-cdn.com/.../replay.js` ni mention de `replay` dans les chunks.
- Sentry dashboard : les sessions sans Replay continuent d'arriver.

---

### P-404 — Migration `next experimental-analyze` (Turbopack natif)

**Effort** : S (45 min)
**Gain estimé** : **diagnostic** — pas de gain perf direct, mais débloque tout le reste de l'audit. Le bundle-analyzer webpack actuel est cassé sur Turbopack.
**Risque** : Faible.
**Dépendances** : aucune (Next 16.1+ supporte `experimental-analyze` natif Turbopack).

**Fichier 1** : `package.json` (script)

**Diff** :

```diff
   "bundle:check": "size-limit",
-  "bundle:analyze": "ANALYZE=true next build",
+  "bundle:analyze": "next experimental-analyze --output .next/diagnostics/analyze",
+  "bundle:analyze:open": "next experimental-analyze --output .next/diagnostics/analyze && open .next/diagnostics/analyze/index.html",
```

**Fichier 2** : `next.config.ts` (retirer le wrapper webpack-analyzer)

**Diff** :

```diff
-import withBundleAnalyzer from "@next/bundle-analyzer";
 import createNextIntlPlugin from "next-intl/plugin";

 const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
 ...
-const bundleAnalyzer = withBundleAnalyzer({
-  enabled: process.env["ANALYZE"] === "true",
-});
-
-export default withNextIntl(bundleAnalyzer(nextConfig));
+export default withNextIntl(nextConfig);
```

**Fichier 3** : `package.json` (retirer la devDep)

**Diff** :

```diff
   "@lhci/cli": "^0.15.1",
-  "@next/bundle-analyzer": "^16.2.4",
   "@playwright/test": "^1.59.1",
```

**STOP & ASK requis** : avant `pnpm remove @next/bundle-analyzer` (cf. règle §8.9 du prompt — pas de `pnpm install/remove` sans validation).

**Validation** :

- `pnpm bundle:analyze` produit un rapport HTML interactif qui montre **réellement** les chunks Turbopack.
- Archiver `_AUDIT/bundle-analyze-2026-05-08.html` (critère 1.9 chapitre 1).

---

### P-405 — `size-limit` per-route budgets

**Effort** : M (1-2 h pour calibrer les seuils)
**Gain estimé** : **gouvernance** — gate CI qui empêche la régression. Pas de gain perf direct.
**Risque** : Faible.
**Dépendances** : P-404 (avoir un analyze qui marche pour calibrer).

**Fichier** : `package.json`

**Diff** :

```diff
   "size-limit": [
     {
-      "name": "First load JS (per page budget)",
-      "path": ".next/static/chunks/**/*.js",
-      "limit": "100 KB"
+      "name": "Shell global (chunks communs sur ≥ 50 % des routes)",
+      "path": [
+        ".next/static/chunks/turbopack-*.js",
+        ".next/static/chunks/0omdpj-*.js",
+        ".next/static/chunks/0fxgiu4ylh-*.js"
+      ],
+      "limit": "85 KB",
+      "gzip": true
+    },
+    {
+      "name": "Sentry SDK chunk",
+      "path": ".next/static/chunks/0umi*.js",
+      "limit": "120 KB",
+      "gzip": true
+    },
+    {
+      "name": "Motion library chunk (à éliminer P-410)",
+      "path": ".next/static/chunks/0e2om08*.js",
+      "limit": "35 KB",
+      "gzip": true
+    },
+    {
+      "name": "Zod runtime chunk",
+      "path": ".next/static/chunks/0l5w54*.js",
+      "limit": "25 KB",
+      "gzip": true
+    },
+    {
+      "name": "Booking calendar (post P-401 lazy)",
+      "path": ".next/static/chunks/*calendar*.js",
+      "limit": "60 KB",
+      "gzip": true
+    }
   ],
```

**Note** : les hashes de chunks Turbopack changent à chaque build. Pour un gate CI stable, **mieux vaut utiliser le `route-bundle-stats.json`** que `size-limit` peut désormais lire via un plugin custom. Voir P-407 pour une approche plus robuste.

**STOP & ASK** : ces seuils sont posés sur l'observation 2026-05-08. À recalibrer après P-401/P-403/P-410.

---

### P-406 — Lighthouse CI mobile preset run (critère 1.8)

**Effort** : S (30 min)
**Gain estimé** : **gouvernance** + détection précoce des régressions mobiles (où LCP/INP sont les plus stricts).
**Risque** : Faible. Doublement du temps Lighthouse CI (~30 s × 3 runs × 2 presets = 3 min).
**Dépendances** : aucune.

**Fichier** : `lighthouserc.json`

**Diff** :

```diff
 {
   "ci": {
     "collect": {
-      "url": ["http://localhost:3000/"],
+      "url": [
+        "http://localhost:3000/fr",
+        "http://localhost:3000/en",
+        "http://localhost:3000/fr/interventions",
+        "http://localhost:3000/fr/audit",
+        "http://localhost:3000/fr/reserver",
+        "http://localhost:3000/fr/contact",
+        "http://localhost:3000/fr/implantations/ile-de-france/paris"
+      ],
       "startServerCommand": "pnpm start",
       "startServerReadyPattern": "Ready",
       "numberOfRuns": 3,
       "settings": {
         "preset": "desktop"
       }
     },
     "assert": {
       "preset": "lighthouse:no-pwa",
       "assertions": {
         "categories:performance": ["error", { "minScore": 0.95 }],
         "categories:accessibility": ["error", { "minScore": 0.95 }],
         "categories:best-practices": ["error", { "minScore": 0.95 }],
         "categories:seo": ["error", { "minScore": 1 }],
         "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
         "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
         "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
         "total-blocking-time": ["error", { "maxNumericValue": 200 }]
       }
     },
     "upload": {
       "target": "filesystem",
       "outputDir": "./lhci"
     }
   }
 }
```

**+ Nouveau fichier** : `lighthouserc.mobile.json` (preset mobile slow 4G)

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/fr",
        "http://localhost:3000/fr/interventions",
        "http://localhost:3000/fr/reserver"
      ],
      "startServerCommand": "pnpm start",
      "startServerReadyPattern": "Ready",
      "numberOfRuns": 3,
      "settings": {
        "preset": "mobile",
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4
        }
      }
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 4000 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./lhci-mobile"
    }
  }
}
```

**Et `package.json`** :

```diff
   "lhci": "lhci collect",
-  "lhci:autorun": "lhci autorun"
+  "lhci:autorun": "lhci autorun",
+  "lhci:mobile": "lhci autorun --config=./lighthouserc.mobile.json",
+  "lhci:full": "pnpm lhci:autorun && pnpm lhci:mobile"
```

**Validation** :

- `pnpm lhci:full` passe avec les seuils mobile (initialement détendus à 0.85 perf, 4000 ms LCP — à durcir à 0.95 / 2500 ms après les vagues de patches).

---

### P-407 — GitHub Action bundle delta gate (critère 6.10)

**Effort** : M (2 h pour wirer)
**Gain estimé** : **gouvernance**. Empêche les PRs de regagner +5 KB silencieusement.
**Risque** : Faible.
**Dépendances** : P-405.

**Nouveau fichier** : `.github/workflows/bundle-size.yml`

```yaml
name: Bundle size

on:
  pull_request:
    branches: [main]
    paths:
      - "src/**"
      - "package.json"
      - "pnpm-lock.yaml"
      - "next.config.ts"

jobs:
  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Capture route bundle stats
        run: |
          cp .next/diagnostics/route-bundle-stats.json bundle-stats-pr.json
      - name: Checkout main
        run: |
          git fetch origin main
          git checkout origin/main -- .
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Capture baseline
        run: cp .next/diagnostics/route-bundle-stats.json bundle-stats-main.json
      - name: Compare deltas
        run: node scripts/compare-bundle-stats.mjs bundle-stats-main.json bundle-stats-pr.json
```

**Nouveau script** : `scripts/compare-bundle-stats.mjs`

```js
#!/usr/bin/env node
import { readFileSync } from "node:fs";

const [, , basePath, prPath] = process.argv;
const base = JSON.parse(readFileSync(basePath, "utf8"));
const pr = JSON.parse(readFileSync(prPath, "utf8"));

const baseByRoute = new Map(base.map((r) => [r.route, r.firstLoadUncompressedJsBytes]));
const THRESHOLD_BYTES = 5 * 1024; // ~5 KB

let failed = false;
for (const r of pr) {
  const baseSize = baseByRoute.get(r.route);
  if (baseSize === undefined) continue; // new route — no delta gate
  const delta = r.firstLoadUncompressedJsBytes - baseSize;
  if (delta > THRESHOLD_BYTES) {
    console.error(
      `❌ ${r.route}: +${delta} bytes (base=${baseSize}, pr=${r.firstLoadUncompressedJsBytes})`,
    );
    failed = true;
  } else if (delta < -THRESHOLD_BYTES) {
    console.log(`✅ ${r.route}: ${delta} bytes (improvement)`);
  }
}
if (failed) process.exit(1);
console.log("Bundle delta check passed.");
```

**Validation** : la première PR qui ajoute > 5 KB sur une route stratégique doit être bloquée.

---

### P-408 — `output: "standalone"` pour Docker Hetzner

**Effort** : XS (10 min)
**Gain estimé** : **build/déploiement** — image Docker passe de ~1 GB à ~200 MB. Démarrage container < 5 s.
**Risque** : Faible. Le build standalone est isofonctionnel à `next start` mais nécessite de copier le runtime + assets statiques à la main.
**Dépendances** : aucune.

**Fichier** : `next.config.ts`

**Diff** :

```diff
 const nextConfig: NextConfig = {
   reactStrictMode: true,
   poweredByHeader: false,
   compress: true,
+  // Hetzner Docker : produit `.next/standalone/` minimal (Node + tracé).
+  // Réduit l'image Docker de ~1 GB à ~200 MB. Démarrage < 5 s.
+  output: "standalone",
   serverExternalPackages: [...],
   ...
```

**Validation** :

- `pnpm build` produit `.next/standalone/server.js` exécutable avec `node .next/standalone/server.js`.
- Dockerfile multi-stage à venir (Phase Hetzner — hors périmètre Agent 5).

---

### P-409 — `compress: true` Next vs Caddy/CF (anti-double-compression)

**Effort** : XS (5 min)
**Gain estimé** : **−CPU origin** + **élimine la double compression** (Caddy compresse en Brotli, Next compresse en Gzip → l'agent reçoit le moins compressé des deux).
**Risque** : Faible — uniquement valable une fois Caddy 2 wiré (dépend du Sprint Hetzner).
**Dépendances** : Caddy 2 doit être configuré avec `encode br zstd gzip`.

**Fichier** : `next.config.ts`

**Diff** :

```diff
 const nextConfig: NextConfig = {
   reactStrictMode: true,
   poweredByHeader: false,
-  compress: true,
+  // Compression déléguée à Caddy 2 (br/zstd/gzip natif) + Cloudflare auto.
+  // Désactiver ici évite la double-compression CPU.
+  // Tant que Caddy n'est pas en place : revenir à `compress: true`.
+  compress: false,
   output: "standalone",
```

**STOP & ASK** : à appliquer **uniquement** quand Caddy 2 est en prod. Avant : garder `compress: true`. Pas urgent V1.

---

### P-410 — Remplacer `motion` par CSS + IntersectionObserver

**Effort** : S (1 h)
**Gain estimé** : **−28-32 KB gz sur le shell global** (chunk 109 KB uncompressed disparaît). Gain présent sur **toutes** les pages (pas juste home + /sections).
**Risque** : Faible. Comportement visuel identique avec `prefers-reduced-motion` géré nativement.
**Dépendances** : aucune.

**Fichier** : `src/components/motion/FadeInOnView.tsx`

**Diff (réécriture complète)** :

```diff
 "use client";
-// use-client: motion/react requires hooks (useInView) and listens for
-// prefers-reduced-motion at runtime.
-
-import * as React from "react";
-import { motion, useReducedMotion } from "motion/react";
+// use-client: IntersectionObserver pour déclencher le fade-in. CSS pour
+// l'animation. ~30 KB gz économisés vs motion/react sur le shell global.
+
+import * as React from "react";

 interface FadeInOnViewProps {
   children: React.ReactNode;
   delay?: number;
   className?: string;
 }

 export function FadeInOnView({ children, delay = 0, className }: FadeInOnViewProps) {
-  const reduce = useReducedMotion();
-  if (reduce) return <div className={className}>{children}</div>;
-
-  return (
-    <motion.div
-      className={className}
-      initial={{ opacity: 0, y: 8 }}
-      whileInView={{ opacity: 1, y: 0 }}
-      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
-      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 }}
-    >
-      {children}
-    </motion.div>
-  );
+  const ref = React.useRef<HTMLDivElement>(null);
+  const [visible, setVisible] = React.useState(false);
+
+  React.useEffect(() => {
+    const node = ref.current;
+    if (!node) return;
+    // prefers-reduced-motion : pas d'observer, pas d'animation.
+    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
+      setVisible(true);
+      return;
+    }
+    const io = new IntersectionObserver(
+      (entries) => {
+        for (const e of entries) {
+          if (e.isIntersecting) {
+            setVisible(true);
+            io.disconnect();
+            break;
+          }
+        }
+      },
+      { rootMargin: "-10% 0px -10% 0px" },
+    );
+    io.observe(node);
+    return () => io.disconnect();
+  }, []);
+
+  return (
+    <div
+      ref={ref}
+      className={className}
+      style={{
+        opacity: visible ? 1 : 0,
+        transform: visible ? "translateY(0)" : "translateY(8px)",
+        transition: `opacity 400ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 400ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
+        willChange: visible ? "auto" : "opacity, transform",
+      }}
+    >
+      {children}
+    </div>
+  );
 }
```

**Bonus** : retirer `motion` de `dependencies` (P-411). **STOP & ASK avant `pnpm remove motion`**.

**Validation** :

- `pnpm build` → chunk `0e2om08*.js` doit disparaître.
- Visual regression : home + /sections ont toujours le fade-in 8px/400ms.
- `prefers-reduced-motion: reduce` → contenu visible immédiatement.
- `pnpm typecheck && pnpm test` passent.

---

### P-411 — Cleanup deps non utilisées (`tiptap*`, `next-auth`, `@tanstack/react-query`, `zustand`, `motion`)

**Effort** : S (15 min — STOP & ASK obligatoire car deps prévues pour Sprint 17+)
**Gain estimé** : **−lockfile bloat, −install time CI, −surface attaque CVE**. Gain perf direct = 0 KB tant qu'elles sont déjà dead-code (Turbopack tree-shake).
**Risque** : Moyen — si Sprint 17+ les utilise, il faudra réinstaller. À voir avec Will.

**STOP & ASK obligatoire**. Décision Will :

- Option A : retirer maintenant et réinstaller au Sprint 17+ (Will doit confirmer le périmètre Sprint 17).
- Option B : garder pour ne pas re-bloquer le Sprint 17 (cas le plus probable).

**Diff (Option A)** :

```diff
   "@react-email/components": "^1.0.12",
   "@react-email/render": "^2.0.8",
   "@sentry/nextjs": "^10.51.0",
   "@t3-oss/env-nextjs": "^0.13.11",
-  "@tanstack/react-query": "^5.100.9",
-  "@tiptap/pm": "^3.22.5",
-  "@tiptap/react": "^3.22.5",
-  "@tiptap/starter-kit": "^3.22.5",
   "@vercel/og": "^0.11.1",
   "argon2": "^0.44.0",
   "bullmq": "^5.76.5",
   "class-variance-authority": "^0.7.1",
   "clsx": "^2.1.1",
   "ioredis": "^5.10.1",
   "lucide-react": "^1.14.0",
-  "motion": "^11.18.2",
   "next": "16.2.4",
-  "next-auth": "5.0.0-beta.31",
   "next-intl": "^4.11.0",
   ...
-  "zod": "^3.25.76",
-  "zustand": "^4.5.7"
+  "zod": "^3.25.76"
```

**Note** : `motion` peut être retirée immédiatement après P-410 (zéro usage restant). `zod` doit rester (utilisé par RHF + validation API). Les autres dépendent du Sprint 17.

---

### P-412 — Zod côté server uniquement (RHF côté client, validation côté server)

**Effort** : M (3 h — refactor des forms)
**Gain estimé** : **−18-22 KB gz** sur le shell global si zod ne fuit pas côté client. Difficulté : RHF + zodResolver requiert zod côté client pour la validation live.
**Risque** : Moyen — perte de la validation client (UX dégradée si on ne fait que server). Mitigation : valider client-side avec yup ou Zod-Mini (~3 KB) + zod côté server.
**Dépendances** : aucune. À tester sur 1 form pilote avant généralisation.

**STOP & ASK** : trade-off UX/bundle non trivial. À discuter avec Will. Le gain est modeste (~20 KB gz) face à la perte de DX ([Zod-Mini](https://zod.dev/v4/mini) est une alternative émergente Zod v4).

**Recommandation** : différer **post-V1**. Phase 2.

---

### P-413 — Namespacer `next-intl` (split FR/EN client)

**Effort** : M (2 h)
**Gain estimé** : **−5-8 KB gz** sur les pages qui n'utilisent que peu de traductions client. Très peu de pages actuellement utilisent `useTranslations` côté client (la doctrine est Server Components).
**Risque** : Faible.
**Dépendances** : recenser les composants client qui utilisent `useTranslations`.

**Fichier** : `src/app/[locale]/layout.tsx`

**Diff** :

```diff
   const messages = await getMessages();
+
+  // Réduit le payload client en n'envoyant que les namespaces utilisés
+  // par des Client Components. Les Server Components utilisent toujours
+  // `getTranslations()` côté server (zéro payload client).
+  const clientMessages = pickClientMessages(messages, [
+    "common",
+    "header",
+    "footer",
+    "forms",
+    "calendar",
+  ]);
   ...
-  <NextIntlClientProvider messages={messages} locale={locale}>
+  <NextIntlClientProvider messages={clientMessages} locale={locale}>
```

**Nouveau helper** : `src/lib/i18n/pickClientMessages.ts` — implémentation triviale (Pick par clé).

**Validation** : `pnpm test` + smoke `<Header />` + `<Footer />` doivent rendre toutes les traductions.

---

### P-414 — Retirer `compress: true` Next dès Caddy en prod (déjà couvert par P-409)

(redondant avec P-409 — laisser P-409 comme référence.)

---

### P-415 — RUM custom (alternative gratuite à Sentry full)

**Effort** : L (1 jour — déjà partiellement câblé via `/api/vitals`)
**Gain estimé** : **−150 KB gz** sur le shell global si on retire complètement `@sentry/nextjs` côté client (le SDK pèse ~447 KB uncompressed = ~150 KB gz).
**Risque** : Élevé — perte des features error tracking + tracing Sentry. Alternative : Sentry SDK loader script tag à charge tardive (~5 KB gz initiale, fetch async sur erreur).
**Dépendances** : `/api/vitals` doit persister (chap. 1.6 baseline → fail actuel).

**STOP & ASK obligatoire** — Will doit choisir :

- **Option A** : garder Sentry full + Replay 0 % (P-403 → −20 KB gz).
- **Option B** : Sentry **loader script** (Sentry CDN) chargé async post-load (−140 KB gz du shell, mais perte des breadcrumbs early-load).
- **Option C** : RUM custom complet (Web Vitals → `/api/vitals` + error tracking via `window.onerror` → `/api/errors`). −150 KB gz total. Solution Hetzner-pure, dashboard custom Sprint 20 (`/admin/pseo-stats`).

**Recommandé** : **Option C pour V2** post-launch (stabilité prod). **Option A + P-403 pour V1** (Sentry sans Replay).

---

## STOP & ASK ouverts

1. **STOP & ASK #5-1 — `pnpm remove @next/bundle-analyzer`** (P-404). Conformément au prompt §8.9.
2. **STOP & ASK #5-2 — `pnpm remove motion`** post P-410 (gain confirmé via build).
3. **STOP & ASK #5-3 — Cleanup deps Sprint 17 (P-411)** : retirer ou garder `@tanstack/react-query`, `@tiptap/*`, `next-auth`, `zustand` ? Décision Will basée sur calendrier Sprint 15-17.
4. **STOP & ASK #5-4 — Direction Sentry** (P-415) : Option A / B / C ? Recommandé A pour V1 + escalade B en V1.5.
5. **STOP & ASK #5-5 — Disable `compress: true` Next** (P-409) : à appliquer **uniquement** quand Caddy 2 wiré. Pas avant.
6. **STOP & ASK #5-6 — Trade-off Zod côté server only** (P-412) : différer post-V1, gain modeste.
7. **STOP & ASK #5-7 — Lighthouse mobile seuils** : initialement détendus (0.85 perf / 4000 LCP) — quand durcir à 0.95 / 2500 ?

---

## Top 5 quick wins du périmètre

| #   | Patch                                            | Effort     |                 Gain shell gz | Gain pages stratégiques |
| --- | ------------------------------------------------ | ---------- | ----------------------------: | ----------------------- |
| 1   | **P-410** Remplacer `motion` par CSS + IO        | S (1 h)    |                 **−30 KB gz** | Toutes (15/15)          |
| 2   | **P-403** Sentry Replay → 0 % + drop integration | M (1-2 h)  |                 **−20 KB gz** | Toutes (15/15)          |
| 3   | **P-401** Lazy BookingCalendar                   | S (30 min) | **−50 KB gz** sur `/reserver` | 1/15 mais critique INP  |
| 4   | **P-400** `serverExternalPackages`               | XS (5 min) |                 0 (préventif) | Toutes                  |
| 5   | **P-404** Migration `next experimental-analyze`  | S (45 min) |       0 (diagnostic débloqué) | Toutes                  |

**Cumulé V1 (P-403 + P-410)** : −50 KB gz sur **toutes** les 15 pages. Shell ~280 KB gz → ~230 KB gz, soit Brotli ~170 KB. Encore au-dessus de la cible 70 KB mais on a fait le tiers du chemin **sans toucher à la doctrine**. Le reste vient de Next framework lui-même (RSC payload + client runtime ~80 KB gz) qui ne se réduit qu'avec PPR + React Compiler (chapitres 10-11, hors périmètre Agent 5).

---

## Roadmap bundle V1 → V6

### V1 — Quick wins bundle (XS+S, ~3 h total)

- **P-400** `serverExternalPackages`
- **P-403** Sentry Replay 0 % + drop integration (−20 KB gz)
- **P-410** Motion → CSS + IO (−30 KB gz)
- **P-404** Migration `next experimental-analyze` (diag)

**Gain attendu V1** : −50 KB gz shell global × 15 pages. Lighthouse perf desktop ~95 → ~98 estimé. Mobile slow 4G : LCP −400 ms p75.

### V2 — Lazy + budgets CI (M, ~5 h)

- **P-401** Lazy BookingCalendar (`/reserver` −50 KB gz)
- **P-405** size-limit per-route budgets calibrés
- **P-407** GitHub Action bundle delta gate
- **P-406** Lighthouse CI mobile preset

**Gain attendu V2** : `/reserver` First Load 941 KB → ~750 KB uncomp. Gate CI activé (anti-régression).

### V3 — Cleanup deps + structurel (M, ~3 h)

- **P-411** Retirer `motion` (post P-410), `@tiptap/*`, `next-auth`, `@tanstack/react-query`, `zustand` (sous validation Will)
- **P-408** `output: "standalone"` (Hetzner-ready)
- **P-413** Namespacer next-intl client (−5-8 KB gz)

**Gain attendu V3** : −10 KB gz shell. Préparation Hetzner.

### V4 — Hetzner / Caddy (post déploiement, ~2 h)

- **P-409** Désactiver `compress: true` Next (Caddy compresse)
- Tuning Cache-Control assets / RSC payload (chap. 13 — hors périmètre Agent 5).

### V5 — Premium V2 (post-launch, optionnel)

- **P-412** Zod côté server only (−20 KB gz, M effort, perte DX)
- **P-415** RUM custom Option B/C (Sentry loader script ou full RUM custom — décision Will)

**Gain attendu V5** : −150 à −170 KB gz shell global. Cible 70 KB gz home enfin atteignable.

### V6 — Future-proof

- React Compiler 19 (chap. 11 — Agent 3)
- PPR `incremental` (chap. 10 — Agent 4)
- Service Worker offline-first (chap. 9 — Agent 1)

(Hors périmètre Agent 5 — listé pour cohérence roadmap globale.)

---

## Annexe — Cartographie des chunks 2026-05-08 (build E3PP2kWtZKG7UfgwwGBdi)

| Chunk                        | Taille uncomp | Estimé gz | Contenu identifié                                                                                 |
| ---------------------------- | ------------: | --------: | ------------------------------------------------------------------------------------------------- |
| `0umi.ac91gj7p.js`           |       447 152 |   ~150 KB | **`@sentry/nextjs` SDK + Replay + browser tracing + Next.js App Router instrumentation**          |
| `0omdpj-kq749k.js`           |       153 010 |    ~50 KB | Next.js framework client runtime (App Router + asset prefix + bootstrap)                          |
| `0e2om08_u_puj.js`           |       108 881 |    ~30 KB | **`motion` (Framer Motion v11)** — `framerAppearId`, `motionComponentSymbol`, `spring`, `inertia` |
| `0l5w54vrhrfdq.js`           |        64 884 |    ~22 KB | **`zod`** — `assertEqual`, `arrayToEnum`, `objectKeys`, `objectValues`                            |
| `0fxgiu4ylh-7c.js`           |        52 146 |    ~18 KB | Next HTTPAccessFallbackBoundary + error boundary                                                  |
| `008~m8cwczh71.js`           |        47 583 |    ~16 KB | **lucide-react icons** (Calendar + autres) — **route /reserver**                                  |
| `06c9kk2b0a9-x.js`           |        44 876 |    ~15 KB | Memoization helpers (Sentry tracing micro-cache)                                                  |
| `0gt13eipvkra_.js`           |        44 837 |    ~15 KB | Next BailoutToCSRError + client navigation                                                        |
| `0ilcbj1wxsvt~.js`           |        41 043 |    ~14 KB | Next `useMergedRef` + ref helpers                                                                 |
| `11qizm5e00g_5.js`           |        36 799 |    ~12 KB | Route /roi (RoiSimulator)                                                                         |
| `0cdlwqc3.z7ow.js`           |        33 425 |    ~11 KB | Route /audit/demande (AuditForm)                                                                  |
| `1557.74dxcpdg.js`           |        30 229 |    ~10 KB | Route /guide-ia + /contact (shared content fixtures)                                              |
| `0~d9w4m00q~cg.js`           |        27 819 |     ~9 KB | ProductPageTemplate (audit + implementation)                                                      |
| `0dzfrgxcb3fof.js`           |        27 450 |     ~9 KB | Next intl client provider runtime                                                                 |
| `0umzhzvb.2o9s.js`           |        26 213 |     ~9 KB | Route /[locale] (home — fixtures testimonials + sections)                                         |
| `0-xktd~x0jzrs.js`           |        25 662 |     ~9 KB | Next runtime (server-actions/router-utils)                                                        |
| `0v11i1_ogrwt4.js`           |        22 298 |     ~7 KB | Next runtime (transitions)                                                                        |
| `0y039rto-icbh.js`           |        21 834 |     ~7 KB | Route /guide-ia (glossaire IA fixtures)                                                           |
| `0.yfxzop-dbs3.js`           |        20 761 |     ~7 KB | Route /contact (ContactForm)                                                                      |
| `0a7jzrwne2gp2.js`           |        14 939 |     ~5 KB | Route /sections (FadeInOnView wiring)                                                             |
| `0n-tb5x-d7im1.js`           |        14 254 |     ~5 KB | (route minor)                                                                                     |
| `05r.9~8uzjqub.js`           |        14 732 |     ~5 KB | (route minor)                                                                                     |
| `0aldhrat.2gbc.js`           |        12 073 |     ~4 KB | (route minor)                                                                                     |
| `0-d0pz8xr~och.js`           |        12 001 |     ~4 KB | Next reportGlobalError + recoverable errors                                                       |
| `turbopack-0k1biuvhjnriy.js` |        10 580 |     ~4 KB | Turbopack runtime                                                                                 |
| `123c55odke32p.js`           |         7 114 |     ~2 KB | Route /reserver (BookingCalendar wiring)                                                          |
| `0qsj7.ciiatop.js`           |         4 421 |   ~1,5 KB | (small shared)                                                                                    |
| `04f~8nslvvlnx.js`           |         1 555 |   ~0,5 KB | (very small)                                                                                      |

**CSS** :

- `17wi_~~y43p18.css` 107 374 B (~36 KB gz) — Tailwind v4 compiled (cf. `@tailwindcss/postcss`)
- `10~vru6hf59hh.css` 10 852 B (~4 KB gz) — fonts/atomic globals

**Total assets statiques** : ~1,6 MB JS + ~118 KB CSS uncompressed.

**Conclusion cartographie** :

- 53 % du shell global = Sentry seul.
- 28 % = Next.js framework (incompressible sans PPR + React Compiler).
- 11 % = motion (éliminable P-410).
- 8 % = zod (réductible P-412).

Avec V1+V2+V3 appliqués : shell ~110-120 KB gz (vs 280 KB aujourd'hui). Cible doctrine 70 KB gz home atteignable seulement avec V5 (Option B ou C Sentry).
