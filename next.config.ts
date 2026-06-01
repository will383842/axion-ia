import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl plugin wires `src/i18n/request.ts` so Server Components can
// call `getMessages()` / `getTranslations()` without explicit context.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Headers de sécurité OWASP — Sprint 21 (M10) + Sprint 24 (B1/B2 durcissement).
//
// Sprint 24 :
//  - Content-Security-Policy n'est PLUS posée ici. Elle est calculée par
//    `src/proxy.ts` per-request avec un nonce (mode strict pour /admin/*,
//    mode soft pour le SSG public). Voir `src/lib/csp.ts`.
//  - Cross-Origin-Embedder-Policy `require-corp` est posée par proxy.ts pour
//    pouvoir varier (`credentialless` fallback si Plausible CORP bug).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), accelerometer=(), gyroscope=(), magnetometer=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// P-310 — Vary header pour CDN (Cloudflare). Permet aux POPs de servir la
// bonne variante (HTML vs RSC payload, prefetch vs full nav, encoding).
// Sans ce header, CF peut servir un payload RSC à un browser qui veut HTML.
const cdnHeaders = [
  {
    key: "Vary",
    value: "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding",
  },
  // Phase 8.bis bonus — runbook deploy recovery 2026-05-17 §15.3.
  // Header `x-axion-build-sha` exposé sur toutes les routes pour permettre
  // l'assertion `prod SHA === HEAD main` post-deploy (smoke 30+ routes).
  // BUILD_SHA est injecté via build-arg dans le Dockerfile depuis github.sha
  // dans deploy-coolify.yml. Fallback `dev` en local sans build prod.
  {
    key: "x-axion-build-sha",
    value: process.env["BUILD_SHA"] ?? "dev",
  },
];

// Sprint SEO 2026-05-14 — BUILD_TIME stable pour `lastModified` sitemap.
//
// Sans cette injection, `new Date()` dans `app/sitemap.ts` produit un timestamp
// différent à chaque appel (= à chaque page sitemap rendue), ce que Google
// détecte vite (« le site signale tous ses pages comme modifiées alors
// qu'aucun contenu ne change ») → Google arrête de faire confiance au
// `<lastmod>` et le crawl budget se dégrade.
//
// Solution : un seul timestamp ISO figé au build, propagé via `next.config.ts`
// `env`. Webpack DefinePlugin remplace `process.env.BUILD_TIME` partout dans
// le code par la valeur littérale au build (non préfixé `NEXT_PUBLIC_` → reste
// strictement côté serveur Node.js, pas inliné dans les bundles client).
//
// Ordre de fallback :
//   1. `process.env.BUILD_TIME` set par le CI/CD (Coolify/GHActions injecte
//      `BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)` ou hash commit timestamp)
//   2. À défaut → `new Date().toISOString()` évalué une fois au chargement de
//      `next.config.ts` (= une fois par build, partagé par toutes les pages
//      sitemap du même build). Fallback safe en dev local.
const BUILD_TIME_ISO = process.env.BUILD_TIME ?? new Date().toISOString();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Expose BUILD_TIME au runtime serveur via DefinePlugin. Non `NEXT_PUBLIC_`,
  // donc accessible UNIQUEMENT dans les Server Components / route handlers
  // (sitemap.ts). N'est PAS inliné dans les bundles client.
  env: {
    BUILD_TIME: BUILD_TIME_ISO,
  },
  // P1-22 (audit re-run 2026-05-15 AGENT 7) — compress: false.
  // Caddy 2 compresse avec brotli 9 + zstd + gzip 6 en amont (Caddyfile
  // `encode { zstd ; br 9 ; gzip 6 ; minimum_length 4096 }`). Garder Next
  // compress: true = double compression CPU-coûteuse (Next re-gzip → Caddy
  // décompresse + re-compresse en brotli). Le passage à false économise
  // ~5-8 % CPU avg 24h selon AGENT 7 §7.11 P1-3.
  compress: false,
  // P-508 — explicite (déjà default false en Next 16, mais clarté config).
  productionBrowserSourceMaps: false,
  // P-302 — build artifact léger pour Docker Hetzner standalone.
  output: "standalone",
  // P-400 — verrouille les deps Server-only contre tout leak vers le client.
  // Si un import client utilise par erreur l'un de ces paquets, le build fail
  // explicitement au lieu d'embarquer ~200-500 KB de code Node.js dans le
  // bundle browser.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "argon2",
    "bullmq",
    "ioredis",
    "otplib",
    "sharp",
    "pino",
    "@react-email/render",
    "nodemailer",
    // isomorphic-dompurify dépend de jsdom qui charge des assets statiques
    // (browser/default-stylesheet.css). Si bundlé par webpack, ces assets
    // ne sont pas copiés dans `.next/standalone` → ENOENT au build SSG.
    // Externaliser → Node loader natif depuis node_modules → assets résolus.
    "isomorphic-dompurify",
    "jsdom",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Unsplash : portraits clients testimonials home (libres de droits Unsplash License)
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // D4 cert 2026-05-08 — anti-pattern Next 16 self-hosted : default
    // minimumCacheTTL = 60 sec → invalidation transforms AVIF/WebP toutes
    // les minutes côté disk cache, pression I/O CX/CPX32 inutile. Cible
    // doctrine = 1 an immutable (les hashes URL `next/image` garantissent
    // invalidation sur changement de source).
    minimumCacheTTL: 31536000,
  },
  experimental: {
    // ViewTransition disabled until we actually wrap route transitions in
    // <ViewTransition>. The flag alone changes Next's navigation behavior
    // (waits for render before swap) and adds perceived latency without
    // any visual benefit. Re-enable when we adopt the API explicitly.
    // viewTransition: true,
    // PPR (Partial Prerendering) deferred — needs per-route Suspense
    // boundaries before flipping. Re-evaluate Sprint 17 after server
    // actions land.
    // ppr: "incremental",
    //
    // Sprint 24bis (2026-05-14) — fix render-blocking-resources LHCI gate.
    // Next 16 app-router prod : inline les CSS imports directement dans
    // <style> dans le <head> au lieu de générer des <link rel="stylesheet">
    // synchrones (render-blocking par défaut). Élimine la cause unique des
    // 1-2 ressources render-blocking détectées par Lighthouse sur toutes les
    // pages stratégiques (audit Web Vitals 2026-05-08 + run LHCI 25856318570).
    //
    // Trade-off : le HTML grossit (~5-10 KB de CSS inline par route SSG)
    // mais Cloudflare Brotli compresse bien le CSS répété, et on évite 1
    // round-trip critique (FCP/LCP gain ~50-150 ms p75 selon URL).
    //
    // Natif Next 16 — pas de dep externe (vs `optimizeCss` qui nécessite
    // critters/beasties peer). App-router prod only (no-op en dev).
    inlineCss: true,
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
    // Sprint X.2 (Booking V1) — Server Actions cross-origin guard (Agent 8 P0-4).
    // Liste blanche stricte des origins autorisées à invoquer une Server Action.
    // En dev, Next ajoute automatiquement `localhost:PORT` — pas besoin de l'ajouter ici.
    serverActions: {
      allowedOrigins: ["axion-ia.com", "www.axion-ia.com"],
    },
  },
  // React Compiler deferred (PERF-004) — requires `babel-plugin-react-compiler`
  // devDep + Babel takeover that slows Turbopack builds. Re-evaluate Sprint 17
  // when we measure RUM baseline. Until then, Next 16's SWC optimizer + manual
  // memoization in hot paths are sufficient.
  // reactCompiler: true,
  // Sprint 14.10.8 (Will 2026-05-12) — Redirects 301.
  // `/audit/process` (ancien slug refactoré en `/audit/cible`) → 301 propre
  // au niveau edge, sans frapper le rendu Next. Évite que `routing.pathnames`
  // expose l'URL legacy au sitemap auto + au crawler.
  async redirects() {
    return [
      // FAQ — slugs legacy faibles → slugs keyword-rich (perfection FAQ 2026-05-31).
      // 301 pour préserver toute URL déjà connue de Google. Cf. FAQ_GLOBAL ids.
      {
        source: "/:locale(fr|en)/faq/definition",
        destination: "/:locale/faq/definition-axion-ia",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/faq/modules",
        destination: "/:locale/faq/les-3-modules-axion-ia",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/faq/tools",
        destination: "/:locale/faq/outils-ia",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/faq/billing",
        destination: "/:locale/faq/facturation",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/faq/secteurs",
        destination: "/:locale/faq/secteurs-ia",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/faq/data-security",
        destination: "/:locale/faq/securite-donnees-ia",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/audit/flash",
        destination: "/:locale/audit/tpe-1-jour",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/audit/process",
        destination: "/:locale/audit/cible",
        permanent: true,
      },
      // /sitemap.xml → /sitemap-index.xml (Sprint X bugs SEO 2026-05-14).
      // Next 16 réserve `/sitemap.xml` à la convention metadata `app/sitemap.ts`
      // qui ne génère que `/sitemap/<id>.xml` (pas d'index racine). On expose
      // l'index à `/sitemap-index.xml` et on redirige 301 le chemin canonique
      // pour les outils qui sondent encore /sitemap.xml par habitude
      // (Bing, vieux crawlers, scripts externes).
      {
        source: "/sitemap.xml",
        destination: "/sitemap-index.xml",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/audit/cibl%C3%A9",
        destination: "/:locale/audit/cible",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/audit/ciblé",
        destination: "/:locale/audit/cible",
        permanent: true,
      },
      // Refonte villes 2026-05-26 — les 10 750 pages `/implantations/[region]/[ville]/[verticale]`
      // ont été supprimées (risque doorway HCU 2024 + cannibalisation des pages services).
      // 5 redirects 301 par verticale vers la page service canonique correspondante.
      // L'autorité crawl Google est ainsi transférée vers les pages commerciales principales.
      // Note : `audits` (pluriel ville) → `/audit` (singulier service). `implementations` → `/implementation`.
      // `sites-web-ia` → `/sites-web-augmentes`.
      {
        source: "/:locale(fr|en)/implantations/:region/:ville/audits",
        destination: "/:locale/audit",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/implantations/:region/:ville/interventions",
        destination: "/:locale/interventions/collectives",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/implantations/:region/:ville/implementations",
        destination: "/:locale/implementation",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/implantations/:region/:ville/un-a-un",
        destination: "/:locale/un-a-un",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/implantations/:region/:ville/sites-web-ia",
        destination: "/:locale/sites-web-augmentes",
        permanent: true,
      },
      // EN miroir (path `/locations` au lieu de `/implantations`)
      {
        source: "/:locale(fr|en)/locations/:region/:ville/audits",
        destination: "/:locale/audit",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/locations/:region/:ville/interventions",
        destination: "/:locale/interventions/collectives",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/locations/:region/:ville/implementations",
        destination: "/:locale/implementation",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/locations/:region/:ville/un-a-un",
        destination: "/:locale/un-a-un",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/locations/:region/:ville/sites-web-ia",
        destination: "/:locale/sites-web-augmentes",
        permanent: true,
      },
      // Refonte /interventions 2026-05-28 — simplification radicale du hub.
      // Le hub des 4 familles `/interventions` est supprimé (devenu redondant
      // après extraction du 1-to-1 vers `/un-a-un` et suppression de la
      // famille Conférence). La page formations équipe `/interventions/collectives`
      // devient la destination par défaut de `/interventions`. La famille
      // Conférence est entièrement supprimée (3 pages : hub + 2 formats).
      {
        source: "/:locale(fr|en)/interventions",
        destination: "/:locale/interventions/collectives",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/conference",
        destination: "/:locale/interventions/collectives",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/conference-pleniere",
        destination: "/:locale/interventions/collectives",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/conference-keynote",
        destination: "/:locale/interventions/collectives",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...cdnHeaders] },
      // P1 fix audit Web Vitals — Cache-Control explicites sinon Cloudflare
      // revalide à chaque hit (sitemap-index 9 fichiers + OG images statiques).
      //
      // Audit indexation 2026-05-18 P1-13 — `s-maxage=600` (10 min) au lieu de
      // 86400 (24h) pour refresh CDN rapide après publish. Sub-sitemaps (Next 16
      // metadata) gardent ce header car ils sont SSG (changent au build).
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/sitemap/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/opengraph-image",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }],
      },
      {
        source: "/twitter-image",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }],
      },
    ];
  },
};

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env["ANALYZE"] === "true",
});

// Audit E2E 2026-05-11 P0-CONF-05 — réintégration `withSentryConfig`.
// Sans ce wrapper, `SENTRY_AUTH_TOKEN` n'est jamais consommé au build et les
// sourcemaps ne sont pas uploadées → stacks prod minifiées illisibles.
//
// Toggle d'opt-out pour les builds d'audit / dev / CI :
//   SENTRY_DISABLE_AUTO_UPLOAD=true npx next build
// désactive l'upload + le release-creation mais garde le SDK runtime.
const sentryDisableAutoUpload =
  process.env["SENTRY_DISABLE_AUTO_UPLOAD"] === "true" ||
  process.env["NEXT_PUBLIC_SENTRY_RELEASE_DISABLE"] === "true";

const sentryOrg = process.env["SENTRY_ORG"];
const sentryProject = process.env["SENTRY_PROJECT"];
const sentryBuildOptions = {
  ...(sentryOrg ? { org: sentryOrg } : {}),
  ...(sentryProject ? { project: sentryProject } : {}),
  // Silencieux quand pas en CI pour ne pas polluer dev local.
  silent: !process.env["CI"],
  // Skip upload si toggle d'audit OU si AUTH_TOKEN absent (CI sans secrets).
  disableServerWebpackPlugin: sentryDisableAutoUpload || !process.env["SENTRY_AUTH_TOKEN"],
  disableClientWebpackPlugin: sentryDisableAutoUpload || !process.env["SENTRY_AUTH_TOKEN"],
  // Tunnel optionnel — bypass adblockers (ajouter une route /monitoring si désiré
  // Sprint 16). Pour l'instant on n'active pas pour éviter d'augmenter la
  // surface d'attaque sans monitoring tunnelé en place.
  // tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: false },
};

const composedConfig = withNextIntl(bundleAnalyzer(nextConfig));

// Audit E2E 2026-05-11 fix dev — `withSentryConfig` n'est appliqué qu'en
// build prod. En dev (Turbopack), le wrapper casse la résolution des routes
// (toutes les routes hors /[locale] root retournent 404). Le SDK Sentry
// runtime reste actif via `instrumentation.ts` même sans wrapper de build —
// seul l'upload des sourcemaps + le release tracking dépend du wrapper.
//
// Toggle pour forcer en dev (debug) : `FORCE_SENTRY_BUILD_PLUGIN=true pnpm dev`.
const enableSentryBuildPlugin =
  process.env["NODE_ENV"] === "production" || process.env["FORCE_SENTRY_BUILD_PLUGIN"] === "true";

export default enableSentryBuildPlugin
  ? withSentryConfig(composedConfig, sentryBuildOptions)
  : composedConfig;
