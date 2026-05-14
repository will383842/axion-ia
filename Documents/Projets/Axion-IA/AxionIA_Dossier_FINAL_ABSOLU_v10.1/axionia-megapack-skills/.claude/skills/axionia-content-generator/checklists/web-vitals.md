# Web Vitals checklist per generated URL

> See § 9.10 of master prompt for full detail. Lighthouse budget gate before tier-1 promotion.

## Targets (p75)

| Vital | Target | Hard cap |
|---|---|---|
| LCP | ≤ 1 800 ms | 2 500 ms |
| INP | ≤ 100 ms | 200 ms |
| CLS | = 0 (strict) | 0.05 |
| TBT | ≤ 150 ms | 300 ms |
| FCP | ≤ 1 000 ms | 1 800 ms |
| TTFB | ≤ 600 ms | 1 000 ms |
| First Load JS | ≤ 75 KB gz/route | 100 KB |

Exception: `/fr/blog/<slug>` and `/fr/implantations/<region>/<ville>` cached aggressively CF → INP ≤ 150 ms p75 allowed.

## 20 imposed perf techniques

- [ ] Critical CSS inline ≤ 14 KB (1 RTT) — Beasties
- [ ] Other CSS async (`<link rel="preload" as="style" onload="this.rel='stylesheet'">`)
- [ ] Font-display: swap + preload font subset latin-ext only
- [ ] Self-host fonts (no Google Fonts CDN runtime)
- [ ] LCP image: preload + `fetchpriority="high"` + AVIF
- [ ] Non-LCP images: `loading="lazy"` + `decoding="async"` + `width`/`height`
- [ ] No iframes V1
- [ ] `content-visibility: auto` on below-fold sections
- [ ] CSS `contain: layout style paint` on isolated components
- [ ] No JS layout shift post-hydration
- [ ] Server Components default, `'use client'` minimal
- [ ] Tree-shaking strict, no `import *`
- [ ] Bundle analyzer CI gate (+5 KB delta = warn)
- [ ] HTTP/3 + Brotli (Cloudflare configured)
- [ ] Cache CF aggressive: `/fr/blog/<slug>` 24h edge, `/fr/implantations/...` 7d edge
- [ ] No render-blocking JS
- [ ] No polyfill global (dynamic import only)
- [ ] Touch targets ≥ 44×44 px
- [ ] Mobile reading: 60-75 chars/line, ≥ 16 px body
- [ ] web-vitals RUM wired to `/api/rum` + Plausible

## Pre-publish gate

```bash
pnpm content-gen:lighthouse https://axion-ia.com/fr/<path>
```

Reads `lighthouse-budget.json` and fails if budget exceeded:

```json
{
  "resourceSizes": [
    { "resourceType": "script", "budget": 75 },
    { "resourceType": "image", "budget": 200 },
    { "resourceType": "stylesheet", "budget": 30 },
    { "resourceType": "font", "budget": 60 },
    { "resourceType": "total", "budget": 500 }
  ],
  "timings": [
    { "metric": "largest-contentful-paint", "budget": 1800 },
    { "metric": "interactive", "budget": 2500 },
    { "metric": "cumulative-layout-shift", "budget": 0 }
  ]
}
```

Failure = blocks tier-1 promotion.

## RUM monitoring

- `web-vitals` lib (~2 KB gz) sends LCP/INP/CLS/FCP/TTFB to `/api/rum` via `navigator.sendBeacon`.
- Stored in `WebVitalSample` Prisma table + Plausible custom props.
- Dashboard `/admin/content-gen/web-vitals` (V2): p50/p75/p95 per page type.
- Telegram alert if p75 LCP > 2 000 ms over 7d rolling.
