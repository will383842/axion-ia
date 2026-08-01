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
// Note : `X-Frame-Options: DENY` n'est PAS dans cette liste universelle — il est
// posé via une source à exclusion (cf. `headers()` plus bas) pour laisser la
// route d'embed widget `/[locale]/carrieres/widget` framable. proxy.ts applique
// la même exclusion côté Edge (cf. `isEmbedPath`).
const securityHeaders = [
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
  // Fix workspace-root mis-detection (2026-06-02). Le home dir `C:\Users\willi`
  // est lui-même un projet pnpm (package.json + pnpm-lock.yaml + pnpm-workspace
  // .yaml). Sans `turbopack.root`, Next/Turbopack remonte les lockfiles et
  // choisit ce home dir comme racine workspace → lit/écrit un cache `.next`
  // corrompu à la mauvaise racine (SyntaxError `JSON.parse` → 500 sur TOUTES
  // les routes en dev). On épingle la racine sur le dossier projet.
  // Dev-only (Turbopack) — le build prod utilise `next build --webpack` et
  // ignore cette clé.
  turbopack: {
    root: import.meta.dirname,
  },
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
  // Recovery build OOM 2026-06-08 — désactive le cache webpack en build de
  // PROD. Le cache (mémoire + disque) retient tous les modules compilés pour
  // accélérer les builds incrémentaux ; en CI on repart TOUJOURS d'un cache
  // vide (build Docker propre), donc on ne perd aucune vitesse, mais on évite
  // de garder ~17,6k routes de modules en mémoire pendant la compilation →
  // réduit le pic heap. Recommandé par le guide mémoire Next (« Disable
  // Webpack cache »). Build only (`!dev`), dev inchangé.
  webpack: (config, { dev }) => {
    if (!dev && config.cache) {
      config.cache = false;
    }
    return config;
  },
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
    // Recovery build OOM 2026-06-08 — la compilation webpack (`next build
    // --webpack`) de ~17,6k routes SSG plafonnait le heap JS (6144 Mo) et
    // OOM'ait AVANT même la génération des pages (phase « Creating an optimized
    // production build »). Flag officiel Next ≥15 (low-risk) : réduit le pic
    // mémoire webpack au prix d'un build légèrement plus long. Cf. guide
    // node_modules/next/dist/docs/01-app/02-guides/memory-usage.md.
    webpackMemoryOptimizations: true,
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
      // Candidature emploi : upload CV (≤ 8 Mo) en multipart Server Action.
      // Défaut Next = 1 Mo → relevé à 10 Mo (marge headers/champs au-delà du fichier).
      bodySizeLimit: "10mb",
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
      // Taxonomies blog SUPPRIMÉES (tag/secteur/service/taille/auteur) — leurs
      // routes n'existent plus, toute URL résiduelle connue de Google servait un
      // 404 sec (vérifié en prod le 2026-08-01, audit indexation GSC). 301 de
      // consolidation vers le hub /blog : convertit le budget de crawl gaspillé
      // en signal permanent. `:rest*` couvre aussi les hubs nus (/blog/tag).
      // La taxonomie VIVANTE (/blog/categorie) n'est PAS dans le motif.
      {
        source: "/:locale(fr|en)/blog/:taxo(tag|secteur|service|taille|auteur)/:rest*",
        destination: "/:locale/blog",
        permanent: true,
      },
      // Pagination blog déplacée de `?page=N` vers `/blog/page/N` (audit
      // indexation GSC 2026-07-31, P1 « BYPASS /fr/blog ») : `searchParams`
      // rendait le hub dynamique → non cacheable CDN. 301 des anciennes URLs
      // `?page=N` (N ≥ 2) pour préserver l'index Google — la capture nommée
      // `num` CONSOMME le query param (sinon Next le repasserait à la
      // destination). Pas de règle pour `?page=1` : un query non consommé
      // serait ré-appendu → boucle de 301 ; la route `/blog` ignore désormais
      // toute query et sert la page 1 avec sa canonique `/blog`, Google
      // consolide seul.
      {
        source: "/:locale(fr|en)/blog",
        has: [{ type: "query", key: "page", value: "(?<num>[2-9]\\d*)" }],
        destination: "/:locale/blog/page/:num",
        permanent: true,
      },
      // Suppression page /reserver (Will 2026-06-26) — le calendrier de booking
      // est retiré ; toute prise de contact passe désormais par /appel
      // (réservation d'un appel) ou /contact. 301 vers /appel pour préserver les
      // liens entrants (favoris, chatbot historique, backlinks). Le pathname
      // `/reserver` a été retiré de routing.ts → cette règle edge porte le SEO.
      {
        source: "/fr/reserver",
        destination: "/fr/appel",
        permanent: true,
      },
      // Slug EN legacy de l'ancien /reserver (`/book`) → /appel EN (`/book-a-call`).
      // Pendant que EN est désactivé, proxy.ts (mapEnToFr) 301 déjà /en/book →
      // /fr/appel ; cette règle couvre le cas EN réactivé.
      {
        source: "/en/book",
        destination: "/en/book-a-call",
        permanent: true,
      },
      // Refonte offre AXION (2026-07, PR #327) PUIS refonte catalogue
      // 2026-07-19 (générales / métiers / secteurs). Les destinations des
      // anciens slugs (pré-#327) sont REMAPPÉES directement vers le catalogue
      // actuel pour éviter les 301 chaînés (ancien → AXION → actuel).
      ...[
        ["ia-express", "ia-pour-bien-commencer"],
        ["art-du-prompt", "ia-pour-les-equipes"],
        ["ia-securite", "ia-pour-bien-commencer"],
        ["ia-conformite", ""],
        ["ia-fondamentaux", "ia-pour-bien-commencer-journee"],
        ["ia-commercial", "ia-pour-les-commerciaux"],
        ["ia-au-bureau", "ia-pour-les-equipes"],
        ["ia-integration-metier", "ia-pour-les-equipes"],
        ["ia-commercial-avance", "ia-pour-les-commerciaux"],
        ["claude-decouverte", "ia-pour-bien-commencer"],
        ["claude-createur", "ia-pour-les-equipes"],
        ["claude-architecte", "ia-pour-l-automatisation"],
        // Sans équivalent direct → hub /formations
        ["ia-sur-le-terrain", ""],
        ["automatisations-decouverte", "ia-pour-l-automatisation"],
        ["ia-transformation-equipe", "seminaire-ia-toute-l-entreprise-1j"],
        ["agents-automatisations", "ia-pour-l-automatisation"],
        ["agents-automatisations-avance", "ia-pour-l-automatisation"],
      ].map(([from, to]) => ({
        source: `/fr/formations/${from}`,
        destination: to ? `/fr/formations/${to}` : "/fr/formations",
        permanent: true,
      })),
      // Refonte catalogue 2026-07-19 (Will) — les 17 formations AXIONs (hors
      // séminaire, conservé) sont remplacées par les 21 nouvelles (4 générales,
      // 9 métiers, 8 secteurs). 301 de chaque ancien slug vers la formation la
      // plus proche, ou vers le hub.
      ...[
        ["bien-demarrer-avec-l-ia-4h", "ia-pour-bien-commencer"],
        ["bien-demarrer-avec-l-ia-journee-7h", "ia-pour-bien-commencer-journee"],
        ["prompts-avances-et-assistants-ia-4h", "ia-pour-les-equipes"],
        ["gagner-du-temps-au-quotidien-avec-l-ia-7h", "ia-pour-les-equipes"],
        ["claude-prise-en-main-complete-7h", "ia-pour-bien-commencer-journee"],
        ["claude-maitrise-avancee-et-autonomie-2j", "ia-pour-les-equipes"],
        ["claude-code-creer-un-projet-3j", "ia-pour-l-it"],
        ["ia-act-conformite-et-securite-7h", ""],
        ["referent-ia-piloter-gouvernance-ia-7h", ""],
        ["ia-rh-recrutement-talents-7h", "ia-pour-les-rh"],
        ["ia-assistanat-mails-comptes-rendus-documents-7h", "ia-pour-les-equipes"],
        ["ia-marketing-contenus-seo-image-de-marque-7h", "ia-pour-le-marketing"],
        ["ia-vente-prospection-developpement-commercial-7h", "ia-pour-les-commerciaux"],
        ["ia-finance-reporting-analyses-pilotage-7h", "ia-pour-la-finance"],
        ["ia-supply-chain-achats-stocks-7h", "ia-pour-les-achats"],
        ["conduite-du-changement-ia-7h", ""],
        ["deployer-l-ia-en-entreprise-2j", "ia-pour-l-automatisation"],
      ].map(([from, to]) => ({
        source: `/:locale(fr|en)/formations/${from}`,
        destination: to ? `/:locale/formations/${to}` : "/:locale/formations",
        permanent: true,
      })),
      // Refonte 2026-07-19 — l'axe durée disparaît : les 4 listings
      // /formations/duree/<slug> 301 vers le hub (les 2 listings par catégorie
      // /formations/metiers et /formations/secteurs les remplacent).
      {
        source: "/:locale(fr|en)/formations/duree/:path*",
        destination: "/:locale/formations",
        permanent: true,
      },
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
      // Nettoyage doublons/cannibalisation blog Grenoble 2026-07-03 (audit contenu).
      // Le moteur avait généré, sur les mêmes mots-clés « X IA Grenoble », d'anciens
      // brouillons courts (2–5 k car., juin) PUIS des versions longues (12–18 k, fin
      // juin-juillet). Les deux restaient publiés → cannibalisation. On archive les
      // courts (retirés du sitemap + IndexNow URL_DELETED en base) et on 301 chaque
      // ancien slug vers la version canonique longue. Aucune chaîne : tout le cluster
      // audit pointe directement vers `cabinet-audit-ia-grenoble-faq`.
      {
        source: "/:locale(fr|en)/blog/cours-ia-grenoble-entreprise",
        destination: "/:locale/blog/cours-ia-grenoble-entreprise-faq",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/chatbot-ia-grenoble-entreprise",
        destination: "/:locale/blog/chatbot-ia-grenoble-entreprise-guide",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/coaching-ia-dirigeants-grenoble",
        destination: "/:locale/blog/coaching-ia-dirigeant-grenoble",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/formation-intelligence-artificielle-grenoble-pme",
        destination: "/:locale/blog/formation-intelligence-artificielle-entreprise-grenoble",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/formation-prompt-engineering-grenoble",
        destination: "/:locale/blog/formation-intelligence-artificielle-entreprise-grenoble",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/audit-ia-grenoble-guide",
        destination: "/:locale/blog/cabinet-audit-ia-grenoble-faq",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/audit-intelligence-artificielle-grenoble-entreprise",
        destination: "/:locale/blog/cabinet-audit-ia-grenoble-faq",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/audit-intelligence-artificielle-grenoble-entreprise-faq",
        destination: "/:locale/blog/cabinet-audit-ia-grenoble-faq",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/mentor-ia-dirigeant-grenoble",
        destination: "/:locale/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/blog/mentor-ia-dirigeant-auvergne-rhone-alpes",
        destination: "/:locale/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble",
        permanent: true,
      },
      // Slug cassé `glossaire/formation-ia-colombes` (contenait un `/` → 2 segments,
      // ne matchait pas la route `/blog/[slug]` mono-segment → 404). Le slug est
      // renommé en base vers `formation-ia-colombes` ; ce 301 couvre l'ancien chemin
      // au cas où il aurait été lié/soumis quelque part.
      {
        source: "/:locale(fr|en)/blog/glossaire/formation-ia-colombes",
        destination: "/:locale/blog/formation-ia-colombes",
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
        destination: "/:locale/formations",
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
        destination: "/:locale/formations",
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
      // Fusion 2026-06-01 (Will) — `/codage-developpement` (+ sa sous-page
      // `/web-digital`) fusionnés dans `/sites-web-augmentes` (page hub unique
      // anti-cannibalisation keyword). 301 plus spécifique d'abord. L'autorité
      // crawl est transférée vers la page service canonique.
      {
        source: "/:locale(fr|en)/codage-developpement/web-digital",
        destination: "/:locale/sites-web-augmentes",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/codage-developpement",
        destination: "/:locale/sites-web-augmentes",
        permanent: true,
      },
      // Formats Claude 1-to-1 retirés (Will 2026-06-13, centrés outil) → 301 vers
      // la prestation 1-to-1 équivalente (zéro lien mort, autorité SEO transférée).
      {
        source: "/:locale(fr|en)/interventions/claude-dirigeant",
        destination: "/:locale/interventions/dirigeant-vision-strategique",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/claude-implementation-individuel",
        destination: "/:locale/interventions/coaching-decouverte",
        permanent: true,
      },
      // Refonte /formations 2026-06-11 (Will) — l'offre de formations COLLECTIVES
      // de /interventions/* est remplacée par /formations (public/live). 301 des
      // anciennes URLs collectives → /formations (zéro lien mort, autorité SEO
      // transférée). Le 1-to-1 (/interventions/{dirigeants,individuel,coaching*,
      // dirigeant-vision-strategique,demande}) RESTE intact (chemins exacts).
      {
        source: "/:locale(fr|en)/interventions",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/collectives",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/collectives/4h",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/collectives/1-jour",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/collectives/2-jours",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/collectives/3-jours-plus",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/essentielle",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/approfondie",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/gagner-du-temps",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/intervention-claude",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/demarrage-ia-express",
        destination: "/:locale/formations",
        permanent: true,
      },
      // Formats 1-to-1 supprimés (Will 2026-06-11) → hubs famille survivants.
      // Slugs EN (executive-productivity / advanced-coaching) gérés par le proxy
      // en-to-fr (→ slug FR) puis ces règles (convention identique aux collectives).
      {
        source: "/:locale(fr|en)/interventions/dirigeant-productivite",
        destination: "/:locale/interventions/dirigeants",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/coaching-avance",
        destination: "/:locale/interventions/individuel",
        permanent: true,
      },
      // Pages formation par ville (verticale per-ville migrée /interventions → /formations).
      {
        source: "/:locale(fr|en)/interventions/par-ville/:ville",
        destination: "/:locale/formations/par-ville/:ville",
        permanent: true,
      },
      {
        source: "/en/interventions/by-city/:ville",
        destination: "/en/formations/by-city/:ville",
        permanent: true,
      },
      // Anciens slugs déjà redirigés (conférence, atelier) → repointés /formations.
      {
        source: "/:locale(fr|en)/interventions/conference",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/conference-pleniere",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/conference-keynote",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/:locale(fr|en)/interventions/atelier-ia-cible",
        destination: "/:locale/formations",
        permanent: true,
      },
      {
        source: "/en/interventions/targeted-ai-workshop",
        destination: "/fr/formations",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...cdnHeaders] },
      // X-Frame-Options: DENY partout SAUF la route d'embed widget
      // `/[locale]/carrieres/widget` (qui doit être framable sur sites tiers).
      // Le lookahead négatif `(?:/|$)` après `widget` n'exclut PAS
      // `/carrieres/widget-builder` (suivi de `-builder`). Aligné avec
      // `isEmbedPath` (src/lib/csp.ts) + proxy.ts.
      {
        source: "/((?!.*\\/carrieres\\/widget(?:\\/|$)).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
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
