# Audit Web Vitals Perfection 2026 — Budgets perf par route (CI)

**Date** : 2026-05-08
**Format** : YAML applicable en CI (Lighthouse CI assertions + size-limit)
**Cible interne stricte** : LCP ≤ 1 800 ms p75 / INP ≤ 100 ms p75 / CLS = 0 / Performance 100/100/100/100 sur 15 pages stratégiques (médiane sur 5 runs en environnement Hetzner CX32 + Caddy + Cloudflare prod simulé)
**Source baseline** : `.next/diagnostics/route-bundle-stats.json` (build 2026-05-08 13:02)

---

## Convention des budgets

- **`lighthouse.performance`** = score Lighthouse Performance minimum (cible 100, seuil CI 95 minimum)
- **`lighthouse.lcp_ms`** = Largest Contentful Paint max (ms)
- **`lighthouse.inp_ms`** = Interaction to Next Paint max (ms)
- **`lighthouse.cls`** = Cumulative Layout Shift max
- **`lighthouse.tbt_ms`** = Total Blocking Time max (ms)
- **`bundle.initial_kb_gzip`** = First Load JS gzipped max (cible interne agressive)
- **`bundle.initial_kb_uncomp`** = First Load JS uncompressed max (heuristique CI plus stable que gzip)
- **`field.crux_lcp_p75_ms`** = CrUX p75 LCP terrain (28 jours) — vérifié post-V5
- **`field.crux_inp_p75_ms`** = idem INP
- **`field.crux_cls_p75`** = idem CLS

---

## Budgets per route — V6 cible finale

```yaml
# _AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.yaml — Source of truth pour gates CI
# Applicable post-V6 (cible finale 100/100/100/100)

routes:
  # =========================================================
  # Hub stratégique — home (LCP critique mobile, gros traffic)
  # =========================================================
  /:
    locale: [fr, en]
    lighthouse:
      performance: 100
      accessibility: 100
      best_practices: 100
      seo: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0.05
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75 # cible interne ferme V6
      initial_kb_uncomp: 250
    field:
      crux_lcp_p75_ms: 1800
      crux_inp_p75_ms: 100
      crux_cls_p75: 0

  # =========================================================
  # Hub services principal
  # =========================================================
  /interventions:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /interventions/essentielle:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /audit:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /audit/flash:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /implementation:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /cas-concrets:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /methodologie:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /comparaisons:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /stack-ia:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  # =========================================================
  # Implantations (pSEO Sprint 14.9 — 4 562 SSG)
  # =========================================================
  /implantations:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /implantations/[region]:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250

  /implantations/[region]/[ville]:
    # Paris pilote : 98 / 96 / 96 / 92 en baseline → cible 100/100/100/100 V6
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 75
      initial_kb_uncomp: 250
    sampling:
      # 3 villes random (≥ 5 000 hab) + 2 régions random validés CI à chaque release
      villes_random_count: 3
      regions_random_count: 2

  # =========================================================
  # /reserver — exception : calendrier client-heavy → INP critique
  # =========================================================
  /reserver:
    lighthouse:
      performance: 95 # exception — calendrier inflexible sur Perf
      lcp_ms: 2000
      inp_ms: 150 # exception — interactions calendrier complexes
      cls: 0 # ZÉRO — V2 P-101 corrige la 0,552 actuelle
      tbt_ms: 200
    bundle:
      initial_kb_gzip: 110 # exception — BookingCalendar lazy mais incompressible
      initial_kb_uncomp: 350

  # =========================================================
  # /contact — formulaire simple
  # =========================================================
  /contact:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0
      tbt_ms: 150
    bundle:
      initial_kb_gzip: 80
      initial_kb_uncomp: 270

# =========================================================
# Globaux — appliquent à toutes les routes non listées
# =========================================================
defaults:
  lighthouse:
    performance: 95
    accessibility: 100
    best_practices: 100
    seo: 100
    lcp_ms: 2500 # Google "good" - safety net
    inp_ms: 200 # Google "good" - safety net
    cls: 0.1 # Google "good" - safety net
    tbt_ms: 200
  bundle:
    initial_kb_gzip: 90 # safety net pour les pages secondaires
    initial_kb_uncomp: 300

# =========================================================
# Gate CI bundle delta sur PR
# =========================================================
ci:
  bundle_delta_max_kb: 5 # +5 KB max gzip per PR (échec automatique si dépassé)
  baseline_branch: main
  diff_against_lighthouse_url: https://staging.axionia.eu # post-V3
```

---

## Cible chiffrée par vague (interpolation linéaire entre baseline et V6)

| Page                              | Baseline (uncomp) | V1 cible |                           V2 cible |  V3 cible | V4 cible |  V5 cible | V6 cible (final) |
| --------------------------------- | ----------------: | -------: | ---------------------------------: | --------: | -------: | --------: | ---------------: |
| `/` (home)                        |          1 022 KB |  ~870 KB |                            ~770 KB | (idem V2) |  ~720 KB | (idem V4) |      **~250 KB** |
| `/interventions`                  |            913 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/audit`                          |            915 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/cas-concrets`                   |            901 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/methodologie`                   |            901 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/comparaisons`                   |            901 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/stack-ia`                       |            901 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/implementation`                 |            915 KB |  ~770 KB |                            ~700 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/implantations`                  |            887 KB |  ~750 KB |                            ~680 KB |    (idem) |  ~640 KB |    (idem) |      **~250 KB** |
| `/implantations/[region]`         |            887 KB |  ~750 KB |                            ~680 KB |    (idem) |  ~640 KB |    (idem) |      **~250 KB** |
| `/implantations/[region]/[ville]` |            899 KB |  ~770 KB |                            ~690 KB |    (idem) |  ~650 KB |    (idem) |      **~250 KB** |
| `/reserver`                       |            942 KB |  ~800 KB | **~620 KB** (lazy BookingCalendar) |    (idem) |  ~580 KB |    (idem) |      **~350 KB** |
| `/contact`                        |          1 003 KB |  ~850 KB |                            ~750 KB |    (idem) |  ~700 KB |    (idem) |      **~270 KB** |

> **Note bandwidth** : sur 50 K visites/mois × 4 562 pages × Brotli (ratio ~25 % de gzip), une réduction de 1 022 KB → 250 KB uncomp ≈ ~190 KB gz économisés × 50 K = **~9,5 GB/mois** d'egress Cloudflare en moins (gratuit, mais accélère TTFB partout).

---

## Lighthouse CI assertions (à intégrer `lighthouserc.json` post-V6)

```json
{
  "ci": {
    "collect": {
      "url": [
        "https://axionia.eu/fr",
        "https://axionia.eu/fr/interventions",
        "https://axionia.eu/fr/audit",
        "https://axionia.eu/fr/cas-concrets",
        "https://axionia.eu/fr/methodologie",
        "https://axionia.eu/fr/comparaisons",
        "https://axionia.eu/fr/stack-ia",
        "https://axionia.eu/fr/implementation",
        "https://axionia.eu/fr/implantations",
        "https://axionia.eu/fr/implantations/ile-de-france",
        "https://axionia.eu/fr/implantations/ile-de-france/paris",
        "https://axionia.eu/fr/reserver",
        "https://axionia.eu/fr/contact",
        "https://axionia.eu/en",
        "https://axionia.eu/en/interventions",
        "https://axionia.eu/en/audit",
        "https://axionia.eu/en/case-studies",
        "https://axionia.eu/en/methodology",
        "https://axionia.eu/en/comparisons",
        "https://axionia.eu/en/ai-stack",
        "https://axionia.eu/en/implementation",
        "https://axionia.eu/en/locations",
        "https://axionia.eu/en/locations/ile-de-france",
        "https://axionia.eu/en/locations/ile-de-france/paris",
        "https://axionia.eu/en/book",
        "https://axionia.eu/en/contact"
      ],
      "numberOfRuns": 5,
      "settings": [
        { "preset": "desktop" },
        { "preset": "mobile", "throttling": { "cpuSlowdownMultiplier": 4 } }
      ]
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "categories:performance": ["error", { "minScore": 1.0 }],
        "categories:accessibility": ["error", { "minScore": 1.0 }],
        "categories:best-practices": ["error", { "minScore": 1.0 }],
        "categories:seo": ["error", { "minScore": 1.0 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 100 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "total-blocking-time": ["error", { "maxNumericValue": 150 }]
      },
      "assertMatrix": [
        {
          "matchingUrlPattern": ".*/reserver$",
          "assertions": {
            "categories:performance": ["error", { "minScore": 0.95 }],
            "interaction-to-next-paint": ["error", { "maxNumericValue": 150 }]
          }
        }
      ]
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./lhci"
    }
  }
}
```

---

## `size-limit` configuration finale (V6)

```javascript
// .size-limit.json
[
  {
    name: "First load JS — home (cible interne 75 KB gz)",
    path: ".next/static/chunks/app/[locale]/page-*.js",
    limit: "75 KB",
  },
  {
    name: "First load JS — /reserver (BookingCalendar lazy, exception)",
    path: ".next/static/chunks/app/[locale]/reserver/page-*.js",
    limit: "110 KB",
  },
  {
    name: "First load JS — /implantations/[region]/[ville] (Paris pilote)",
    path: ".next/static/chunks/app/[locale]/implantations/[region]/[ville]/page-*.js",
    limit: "75 KB",
  },
  {
    name: "Shared chunks (framework + RSC + next-intl)",
    path: ".next/static/chunks/framework-*.js",
    limit: "60 KB",
  },
  {
    name: "Sentry chunk (post-V1 Replay 0%)",
    path: ".next/static/chunks/*sentry*.js",
    limit: "100 KB",
  },
];
```

---

## CrUX p75 cibles terrain (post-V5)

```yaml
crux:
  measurement_window_days: 28
  origins:
    - https://axionia.eu
  thresholds:
    LCP_p75_ms_good: 1800 # cible interne (Google good = 2500)
    INP_p75_ms_good: 100 # cible interne (Google good = 200)
    CLS_p75_good: 0 # cible interne (Google good = 0.1)
  acceptance:
    # Pour valider V6 final : 95 % des origines vertes sur LCP/INP/CLS
    pages_green_min_pct: 95
  alerts:
    - condition: "LCP_p75_ms > 2500 over 24h"
      action: "PagerDuty Will + auto-escalate Sprint emergency"
    - condition: "INP_p75_ms > 200 over 7d"
      action: "Sentry alert + ticket auto"
    - condition: "CLS_p75 > 0.1 over 24h"
      action: "Slack #axionia-alerts"
```

---

## Gate CI bundle delta (P-407 — V2)

```yaml
# .github/workflows/bundle-delta.yml (extrait pertinent)
name: Bundle Delta Gate
on: [pull_request]
jobs:
  size-limit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          # +5 KB gzip max delta per PR
          # Échec automatique si dépassé
```

---

**Fin budgets.** Ces budgets seront durcis progressivement V1 → V6. Les exceptions `/reserver` reflètent la complexité incompressible du calendrier client. Toute évolution → ADR + STOP & ASK.
