# Web Vitals integration in content-generator pipelines (v1.0)

> Référence créée 2026-05-14 (Sprint S0bis) pour aligner Web Vitals avec le pipeline content-gen. Voir aussi `checklists/web-vitals.md` pour la checklist budgets + 20 techniques imposées.

## Doctrine

**Aucune page tier-1 ne se publie si elle ne tient pas les budgets Web Vitals.** Le gate `pnpm content-gen:lighthouse <url>` est exécuté pre-publish + RUM mesure en continu post-publish.

## Budget Lighthouse (rappel checklist)

| Vital | Cible p75 | Hard cap |
|---|---|---|
| LCP | ≤ 1 800 ms | 2 500 ms |
| INP | ≤ 100 ms | 200 ms |
| CLS | = 0 (strict) | 0.05 |
| FCP | ≤ 1 000 ms | 1 800 ms |
| TTFB | ≤ 600 ms | 1 000 ms |
| First Load JS | ≤ 75 KB gz | 100 KB |

**Exception cachée CF agressive** : `/fr/blog/<slug>` (24 h edge), `/fr/implantations/<region>/<ville>` (7 j edge) → INP ≤ 150 ms p75.

## Schéma Prisma `WebVitalSample` (à ajouter Sprint 1)

```prisma
model WebVitalSample {
  id          String   @id @default(cuid())
  url         String                              // pathname canonique
  metric      WebVitalMetric                      // LCP|INP|CLS|FCP|TTFB|TBT
  value       Float                               // ms ou unitless (CLS)
  rating      WebVitalRating                      // good|needs-improvement|poor
  navigationType String?                          // navigate|reload|back-forward
  deviceType  String?                             // mobile|desktop|tablet
  userAgent   String?
  sessionId   String?                             // anonyme, généré côté client
  pageType    String?                             // landing-ville|blog|guide|faq
  knowledgeEntryId String?  @db.Uuid              // lien KB si applicable
  createdAt   DateTime @default(now())

  @@index([url, metric, createdAt(sort: Desc)])
  @@index([pageType, metric, createdAt(sort: Desc)])
}

enum WebVitalMetric {
  LCP
  INP
  CLS
  FCP
  TTFB
  TBT
}

enum WebVitalRating {
  good
  needs_improvement
  poor
}
```

→ À ajouter à `§ 5.1bis Inventaire complet` du master prompt content-gen.

## Pipeline d'intégration Web Vitals

### A. Lab (Lighthouse CI) — Pre-publish gate

```ts
// axionia/src/server/content-gen/quality/web-vitals-gate.ts (Sprint 1 Day 3)
import { runLighthouse } from "lighthouse";

export async function webVitalsGate(url: string): Promise<{ pass: boolean; report: LhReport }> {
  const report = await runLighthouse(url, {
    budgetsPath: "./lighthouse-budget.json",
    onlyCategories: ["performance"],
    formFactor: "mobile",
  });

  const pass =
    report.lcp <= 1800 &&
    report.inp <= 100 &&
    report.cls <= 0.05 &&
    report.firstLoadJsGzKB <= 75;

  return { pass, report };
}
```

**Intégration `posts:validate`** : avant promotion tier-1, exécuter `webVitalsGate(canonicalUrl)`. Si pass=false → bloque promotion + flag `qualityScore -= 20`.

### B. RUM (Real User Monitoring) — Post-publish continu

```ts
// axionia/src/components/web-vitals-reporter.tsx ('use client')
'use client';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { useEffect } from 'react';

export function WebVitalsReporter({ pageType, knowledgeEntryId }: Props) {
  useEffect(() => {
    const send = (metric: Metric) => {
      const body = JSON.stringify({
        url: location.pathname,
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
        pageType,
        knowledgeEntryId,
      });

      // sendBeacon (non-blocking, survit au unload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/rum', body);
      } else {
        fetch('/api/rum', { method: 'POST', body, keepalive: true });
      }
    };

    onCLS(send);
    onFCP(send);
    onINP(send);
    onLCP(send);
    onTTFB(send);
  }, [pageType, knowledgeEntryId]);

  return null;
}
```

```ts
// axionia/src/app/api/rum/route.ts (Sprint 1 Day 5)
export async function POST(req: Request) {
  const data = await req.json();
  const validated = WebVitalSampleSchema.parse(data);

  // Rate limit IP (Upstash Redis) — 100/min/IP
  await rateLimit(req, "rum", 100, 60);

  await prisma.webVitalSample.create({ data: validated });

  // Plausible custom event
  await trackPlausible("web_vital", {
    metric: validated.metric,
    rating: validated.rating,
    pageType: validated.pageType,
  });

  return new Response(null, { status: 204 });
}
```

### C. Aggregation cron + alerts Telegram (post-publish monitoring)

```ts
// axionia/src/server/queue/workers/web-vitals-aggregator-worker.ts (cron 1h)
async function aggregateAndAlert() {
  const last24h = subHours(new Date(), 24);

  // p75 LCP par page-type sur 24 h glissantes
  const samples = await prisma.webVitalSample.groupBy({
    by: ["pageType", "metric"],
    where: { createdAt: { gte: last24h } },
    _count: true,
    _avg: { value: true },
  });

  const p75s = await Promise.all(
    samples.map(async (row) => {
      const p75 = await percentile(row, 0.75);
      return { ...row, p75 };
    }),
  );

  // Alertes Telegram si dégradation détectée
  for (const m of p75s) {
    if (m.metric === "LCP" && m.p75 > 2000) {
      await alertTelegram({
        tag: "WEB_VITALS_DEGRADED",
        severity: "warn",
        message: `LCP p75 ${m.p75}ms > 2000ms sur ${m.pageType} (24h)`,
        adminLink: adminPath("fr", "/content-gen/web-vitals"),
      });
    }
    if (m.metric === "INP" && m.p75 > 200) {
      await alertTelegram({
        tag: "WEB_VITALS_DEGRADED",
        severity: "warn",
        message: `INP p75 ${m.p75}ms > 200ms sur ${m.pageType} (24h)`,
        adminLink: adminPath("fr", "/content-gen/web-vitals"),
      });
    }
    if (m.metric === "CLS" && m.p75 > 0.1) {
      await alertTelegram({
        tag: "WEB_VITALS_DEGRADED",
        severity: "critical",
        message: `CLS p75 ${m.p75} > 0.1 sur ${m.pageType} (24h)`,
        adminLink: adminPath("fr", "/content-gen/web-vitals"),
      });
    }
  }
}
```

→ À ajouter aux **13 alertes Telegram § 12.3bis** master prompt content-gen :
- **Alerte 14** : LCP p75 dégradé > 2000 ms (warn)
- **Alerte 15** : INP p75 dégradé > 200 ms (warn)
- **Alerte 16** : CLS p75 dégradé > 0.1 (critical)

Total : **16 alertes Telegram** au lieu de 13.

## Câblage par sub-prompt content-gen

Chaque sub-prompt doit **mentionner** le Web Vitals gate :

| Sub-prompt | Gate WV pre-publish | Notes |
|---|---|---|
| `landing-ville.md` | ✅ Strict (mobile p75 ≤ 1800 LCP) | Hero AVIF + preload + skip iframes |
| `blog-article.md` | ✅ Exception cache CF (INP ≤ 150 OK) | 24 h edge cache |
| `comparatif.md` | ✅ Strict | Tableaux non-virtuels |
| `guide-pilier.md` | ✅ Strict | Long-form, attention TBT |
| `faq-standalone.md` | ✅ Strict | `<details>` natif (pas de JS accordion) |
| `qa-derived.md` | ✅ Strict | Pages auto Q/R ≥ 300 mots |

## Wired dans Sprint 1 Day-by-Day

- **Day 1** : ajout schéma `WebVitalSample` + enums dans migration `add_content_gen_core`
- **Day 3** : module `quality/web-vitals-gate.ts` + tests Vitest mock
- **Day 5** : API `/api/rum` + Server Component `<WebVitalsReporter />` wirée dans layouts content-gen
- **Day 5** : worker `web-vitals-aggregator-worker.ts` + 3 alertes Telegram
- **Day 6** : gate `pnpm content-gen:lighthouse <url>` dans `pnpm verify:all`

## Dashboard admin `/[adminPrefix]/content-gen/web-vitals` (V2)

- p50 / p75 / p95 par page-type (landing-ville, blog, etc.)
- Filtre date range + device type (mobile/desktop)
- Top 10 URLs avec LCP > 2 s
- Heatmap CLS sources (LCP element selector)
- Export CSV pour bug reports

V1 = juste collecte. V2 (Sprint 6+) = dashboard interactif.

## Lien skill `axionia-mobile-first`

Voir aussi `axionia-mobile-first` skill du megapack pour : touch targets WCAG, viewports test, Tailwind bottom-up convention, drawer/bottom-sheet patterns.
