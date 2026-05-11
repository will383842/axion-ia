# R-06 — CACHE CHAIN

## Diagramme ASCII

```
┌──────────────────────────────────────┐
│ Next 16 SSG (default)                │
│ generateStaticParams() 22 routes     │
│ revalidate per route + ISR           │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ next.config.ts headers()             │
│ Cache-Control selon route family     │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Caddy 2 reverse-proxy (Coolify)      │
│ V1 : Next compress: true (origin)    │
│ V3 plan : Caddy brotli + retire next │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Cloudflare Free 6 Cache Rules        │
│ (AGT-12 mesuré API live, doctrine 5) │
│ 1. API never cache                   │
│ 2. Sitemaps 1h                       │
│ 3. Robots 7d (nouveau, drift)        │
│ 4. Static 1y                         │
│ 5. HTML SSG 1d                       │
│ 6. Admin bypass                      │
│ + Brotli + HTTP/3 + TLS 1.3 0-RTT    │
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│ Browser cache + sw (à confirmer)     │
└──────────────────────────────────────┘

Invalidation post-deploy :
  GH Actions deploy-coolify.yml → Coolify rebuild → next build
  → SSG régénéré → CF Cache purge ???  ⚠️ pas observé
  → CF Cache HTML expire selon Cache Rule (1d) en best-effort
```

## Findings clés

1. **AGT-12 P1** 6 Cache Rules CF live (doctrine § 0.1 dit 5) — drift à clarifier. La 6e (`Robots.txt - 7 days`) sert d'optimisation. Pas un bug, mais doctrine à mettre à jour.
2. **AGT-12 P2** `compress: true` (Next) double avec Caddy brotli annoncé V3 — à supprimer post-Caddy.
3. **AGT-03** Speculation Rules prefetch `eager` sur 30 URLs FR+EN + wildcards `/audit/*` `/interventions/*` qui inclut 2150+ routes par-ville → risque bandwidth Hetzner egress mobile (AGT-02 R-06 + AGT-03 P1).
4. **Aucune purge CF post-deploy automatique observée** — repose sur Cache Rule HTML SSG 1d. Acceptable pour MVP. À gating sprint Cache.
5. **CSP soft public + cache CDN compatible** : nonce per-request `cf-cache-status: MISS` observé sur `/fr/reserver` et `/fr/audit` (Phase 0 curl) — comportement attendu sur les routes dynamiques.
6. **CSP nonce + cache** : nonce posé par proxy.ts donc `Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding` essentiel — confirmé live header `vary: RSC, Next-Router-State-Tree, …` ✅.

## Cohérence chaîne

✅ 6 Cache Rules opérationnelles (AGT-12 API live mesurée).
✅ Brotli ON + HTTP/3 ON + TLS 1.3 0-RTT ON.
✅ Vary header propre.
⚠️ Pas de purge CF automatique post-deploy — TTL 1d sur HTML est ok mais visible pour Will sur la latence d'apparition des updates SSG.
⚠️ Speculation Rules eager sur wildcards → risque bande passante (P1 AGT-02 R-06 + AGT-03).
