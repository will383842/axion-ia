# Pr-07 — Performance / Cache / CDN

**HEAD** : 81f6ea0e
**Score** : 20 / 25

## Évidence

### Bundle ≤ 75 KB gz / route (target V6)
- `AGENTS.md` budget Web Vitals 2026 source de vérité (15 pages stratégiques) : LCP ≤ 1800ms p75, INP ≤ 100ms p75, CLS = 0, TBT ≤ 150ms, First Load JS ≤ 75 KB gz / route. Exception `/reserver` (calendrier client-heavy) ≤ 110 KB.
- `next.config.ts:150-167` `optimizePackageImports` 15 packages (lucide-react + 14 radix-ui) — tree-shake granulaire.
- `next.config.ts:97-114` `serverExternalPackages` 9 (Prisma, argon2, bullmq, ioredis, sharp, otplib, pino, react-email/render, nodemailer, isomorphic-dompurify, jsdom) — empêche leak server-only vers client.
- `next.config.ts:88` `compress: false` — Caddy fait Brotli 9 + Gzip 6 + zstd amont (`Caddyfile:73-78`), évite double compression CPU.
- `next.config.ts:149` `experimental.inlineCss: true` — fix render-blocking-resources LHCI gate (Sprint 24bis 2026-05-14).
- Pre-compress static `scripts/precompress-static.ts` (Brotli 11 + Gzip 9 build-time).
- Gate B `pnpm bundle:check` (size-limit) + delta vs main `size-limit-action` (continue-on-error pour l'instant, cf. Pr-05).

### LCP / INP / CLS gates
- `lighthouserc.json:32-44` assertions strictes :
  - `categories:performance` ≥ 0.9 error
  - `largest-contentful-paint` ≤ 1800ms error
  - `cumulative-layout-shift` ≤ 0.1 error (doctrine interne 0 conservée mais gate accepte 0.1)
  - `total-blocking-time` ≤ 200ms error
  - `first-contentful-paint` ≤ 1500ms error
  - `speed-index` ≤ 2500ms error
- INP gate `"off"` (ligne 38) — Lab Lighthouse n'a pas d'interaction utilisateur réelle ; mesuré via CrUX field data (RUM `/api/vitals`).

### Cache-Control headers
- `next.config.ts:213-237` Cache-Control explicites :
  - `/sitemap.xml` : `public, max-age=300, s-maxage=600, stale-while-revalidate=3600`
  - `/sitemap/:path*` : idem
  - `/opengraph-image` : `max-age=86400, s-maxage=604800`
- `Caddyfile:91-100` `/_next/static/*` : `max-age=31536000, immutable` (1 an immutable hash-based). Public assets `*.ico *.png *.svg *.webp *.avif *.woff2 *.txt` : 1 jour.
- `images.minimumCacheTTL: 31536000` (`next.config.ts:123`) — anti-pattern Next 16 self-hosted résolu (D4 cert 2026-05-08).

### Cloudflare CDN
- Proxied DNS axion-ia.com (Caddyfile commentaire ligne 16-18). Workflow `cloudflare-purge-weekly.yml` + job `purge` post-deploy auto.
- `Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding` (`next.config.ts:38-42`) — variantes payload CDN propres (P-310).

### Image Sharp pipeline
- `next.config.ts:116-124` `formats: ["image/avif", "image/webp"]`, `remotePatterns: []` (anti-SSRF), TTL 1 an.
- Sharp `serverExternalPackages` (ligne 105) — runtime natif.

### Edge runtime middleware
- `src/proxy.ts` Edge runtime (commentaire ligne 14 "aucun import Node-only").
- COEP credentialless, CSP nonce per-request, X-* headers OWASP.

### Streaming SSR / RSC default Next 16
- Next 16 RSC default (`AGENTS.md` "NOT the Next.js you know" prompt).
- PPR `experimental.ppr` désactivé (commentaire ligne 131-133 "deferred — needs per-route Suspense boundaries"). React Compiler désactivé aussi (ligne 174-177 "deferred PERF-004").

### Brotli 11 build-time
- `Caddyfile:53-72` documentation Brotli 11 + Gzip 9 pre-compress build-time. Bascule file_server `precompressed br gzip` différée (effort opérationnel > gain estimé).

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (LHCI continue-on-error)** : `ci.yml:162` LHCI tourne en `continue-on-error: true` actuellement. Doctrine ratchet progressive correcte mais gate non-bloquant pour PR aujourd'hui — quote AGENTS.md "Lighthouse CI (`pnpm lhci`) gate les PR" n'est pas factuellement vrai aujourd'hui (gate en warn-only). À ratifier.
- **P1 (bundle:check continue-on-error)** : `ci.yml:150` + size-limit-action ligne 153-156 idem `continue-on-error: true`. Le contrat AGENTS.md "Bundle delta gate (`size-limit`) bloque les PR avec > +5 KB gz vs `main`" ne s'applique pas factuellement. À ratifier.
- **P1 (PPR désactivé)** : Next 16 PPR pourrait gagner ~100-300ms TTFB sur pages dynamiques DB-bound (sub-sitemaps, /ressources). Reporté Sprint 17 (commentaire next.config.ts:131-133). Pas un fail prod, mais opportunité significative connue.
- **P2 (React Compiler désactivé)** : optimisation perceived mais slowdown Turbopack build cited. RUM baseline mesuré → Sprint 17 décision (commentaire ligne 174-177).
- **P2 (CF cache HIT rate)** : pas d'évidence dashboard cache HIT rate dans le repo. Visible côté Cloudflare Analytics seulement.

## Verdict (paragraphe)

Stack perf très soignée Next 16-native : optimizePackageImports 15 + serverExternalPackages 9 + inlineCss + serverExternalPackages strict (anti-leak) + Brotli 11 build-time + Caddy zstd/br/gzip runtime + images AVIF+WebP minimumCacheTTL 1 an + Cloudflare proxied + Vary header complet. LHCI assertions CWV strict alignées AGENTS.md budget. Edge runtime middleware avec COEP credentialless. Le seul vrai gap est que LHCI + bundle:check tournent en `continue-on-error: true` en CI aujourd'hui (cf. Pr-05) — les gates sont warn-only, le contrat AGENTS.md n'est pas factuellement enforced sur PR. PPR + React Compiler désactivés (decisions architecturales documentées Sprint 17). Score 20/25 — production-ready côté primitive, polish ratchet gate-bloquant à finaliser.
