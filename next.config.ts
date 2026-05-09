import type { NextConfig } from "next";
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
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // V1 garde compress: true (Next compresse pour `next start`). V3 passera
  // false quand Caddy 2 prendra le relais en amont (anti-double-compression).
  compress: true,
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
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
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
  },
  // React Compiler deferred (PERF-004) — requires `babel-plugin-react-compiler`
  // devDep + Babel takeover that slows Turbopack builds. Re-evaluate Sprint 17
  // when we measure RUM baseline. Until then, Next 16's SWC optimizer + manual
  // memoization in hot paths are sufficient.
  // reactCompiler: true,
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...cdnHeaders] },
      // P1 fix audit Web Vitals — Cache-Control explicites sinon Cloudflare
      // revalide à chaque hit (sitemap-index 9 fichiers + OG images statiques).
      {
        source: "/sitemap.xml",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }],
      },
      {
        source: "/sitemap/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }],
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

export default withNextIntl(bundleAnalyzer(nextConfig));
