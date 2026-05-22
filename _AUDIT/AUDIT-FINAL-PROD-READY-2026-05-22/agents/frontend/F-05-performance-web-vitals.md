# F-05 Performance Web Vitals
## Score : 20/25 — 🟢

## Findings (preuves)

1. **Cibles documentées strictes** (AGENTS.md root) : LCP ≤ 1800ms p75, INP ≤ 100ms p75, CLS = 0, TBT ≤ 150ms lab, First Load JS ≤ 75 KB gz/route. Exception `/reserver` : INP ≤ 150ms, JS ≤ 110 KB gz.

2. **LHCI gate** (`lighthouserc.json:30-45`) :
   - `largest-contentful-paint`: error si > 1800ms ✅ aligné cible
   - `cumulative-layout-shift`: error si > 0.1 (relâché vs cible interne 0 → assumé +acceptable)
   - `total-blocking-time`: error > 200ms (relâché vs cible 150ms — doc dans `_assert_doctrine` ligne 72)
   - `first-contentful-paint`: error > 1500ms
   - INP : OFF (lab non mesuré, RUM uniquement)

3. **Next.js 16 prod optimizations** (`next.config.ts`) :
   - `compress: false` (l. 88) — Caddy fait Brotli + zstd
   - `output: "standalone"` (l. 92)
   - `experimental.inlineCss: true` (l. 149) — élimine 1-2 render-blocking par page
   - `optimizePackageImports: [lucide-react, @radix-ui/*]` (l. 150-166)
   - `images.formats: ["image/avif", "image/webp"]` (l. 116)
   - `images.minimumCacheTTL: 31536000` (1 an, l. 123)
   - `serverExternalPackages` (l. 97-114) : Prisma, BullMQ, Sharp, etc. — pas de leak côté bundle client

4. **Fonts** (`src/app/[locale]/layout.tsx:26-62`) :
   - Manrope `weight: ["400", "600"]` (trimmed -50 KB woff2)
   - Inconsolata `preload: false` (l. 44) — code font no-preload (audit P3-35)
   - Fraunces `display: "swap"`
   - 3 fonts subsets latin only + display swap → no FOIT

5. **Resource Hints preconnect** (`layout.tsx:207-215`) : Plausible, Sentry ingest, Cloudflare Turnstile, fonts Google — réduit TBT ~60-150ms p75 (audit P1-14).

6. **Image LCP `priority`** : 6 occurrences détectées dans le code (Header.tsx logo l. 89, /roi:139, /presse:248, /guide-ia:156, /galerie/[slug]:186, blog/[slug]). Pages stratégiques avec hero image ont bien `priority`.

7. **WebVitals component** (`src/components/analytics/WebVitals.tsx`) : monté dans layout l. 230 → mesure RUM côté visiteur (route `/api/vitals`).

8. **SpeculationRules client-side** (`SpeculationRules.tsx`, mounted l. 250) : gating route publique uniquement (skip /admin/*) — gain LCP soft-nav -800/-1200ms (V-04 P3).

9. **JsonLdGraph @graph consolidé** (l. 257) : 2 JSON-LD scripts inline → 1 script `@graph` → gain doc-parse -300/-500ms (V-04 P5).

10. **Sentry build plugin** prod-only (`next.config.ts:285-290`) — pas de bloat dev runtime + traces sampling 0.02 prod (memory V-04 P6).

11. **Bundle gate** : `package.json:79` `bundle:check: size-limit` + doctrine ligne 199-200 « 75 KB gz/route shell, 110 KB /reserver ». `@size-limit/preset-app ^12.1.0` installé.

12. **Cache headers SEO** (`next.config.ts:212-238`) : sitemap.xml + sitemap/* cachés `max-age=300, s-maxage=600, swr=3600` ; OG images `max-age=86400, s-maxage=604800`.

## P0 bloquants prod
- **Aucun**.

## P1 importants
- LHCI gate CLS relâché de 0 à 0.1 (vs cible interne stricte AGENTS.md = 0). Cible doctrine non gated en error → on accepte 0.1 (Google good threshold).
- LHCI TBT relâché 150 → 200ms — décalage avec doctrine AGENTS.md.
- INP non testé en LHCI (off lab). Confiance dépend du RUM Plausible/`api/vitals`.
- L’illustration SVG hero (~554 lignes inline dans `src/app/[locale]/page.tsx:267-824`) = ~10-15 KB HTML compressé. Cachée mobile mais parsée toujours. Pourrait être lazy-rendered.

## P2 polish
- `legacy-javascript` / `unused-javascript` / `dom-size` audits passés en WARN (doctrine acceptée ligne 74 du LHCI).
- `bf-cache` WARN : false positive Auth.js cookies (doctrine doc ligne 77).
- `productionBrowserSourceMaps: false` (l. 90) — OK pour perf, source maps Sentry uploadées au build.

## Verdict
Setup performance excellent : Next 16 standalone + inlineCss + optimizePackageImports + AVIF/WebP + 3 fonts swap + serverExternalPackages strict + JsonLdGraph consolidé + SpeculationRules client-side + LCP priority sur hero pages + size-limit gate + LHCI gate strict (LCP/CLS/FCP/SI). Plausible Web Vitals monitoring actif. Quelques cibles internes (CLS=0, TBT=150ms) relâchées dans gate effectif (0.1/200ms). Score 20/25 ; -5 pour le décalage cible doctrine/gate effectif + INP non lab-testé + SVG hero inline pesant.
