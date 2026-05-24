# A1 — SEO core | Score 82/100

| Sous-dim            | Score | Verdict                                                                                       | path:line                                    |
| ------------------- | ----- | --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1. Title            | 90    | FR 56c, EN 52c (ideal 50-60), keyword "Cabinet IA Paris" présent, brand suffix OK             | page.tsx:87-88                               |
| 2. Description      | 78    | FR 158c, EN 145c, CTA implicite faible, USP dilué, prix d'entrée présent                      | page.tsx:89-91                               |
| 3. Canonical URL    | 100   | Absolu, format cohérent, aligné SITE_URL, trailing-slash normalized                           | seo.ts:128-143                               |
| 4. Hreflang         | 60    | FR + x-default émis ✓, EN ABSENT (isEnLocaleDisabled), signal Google ambigu transition        | seo.ts:119-138, robots.ts:95                 |
| 5. OG (Open Graph)  | 85    | og:title/desc/image 1200x630/type/url/locale ✓, OG image dynamique `/api/og` (risque)         | seo.ts:146-161                               |
| 6. Twitter Card     | 90    | summary_large_image, title/description/images ✓                                               | seo.ts:162-167                               |
| 7. Robots meta      | 100   | index:true, follow:true ✓, robots.ts whitelist AI bots, Disallow /en/\*                       | seo.ts:168, robots.ts:14-56                  |
| 8. Internal linking | 45    | 10 destinations uniques, 0 vers /a-propos, /methodologie, /transparence, /cas-concrets, /blog | page.tsx:143,154,165,176,187,391-402,901-913 |
| 9. URL structure    | 100   | Racine /fr, pas de trailing slash, pas de query parasites                                     | page.tsx:85                                  |
| 10. Crawlability    | 100   | Sitemap include home ✓, robots.txt Allow /, meta refresh ABSENT                               | sitemap.ts:136-149                           |

## Forces (top 3)

1. Canonical + hreflang discipline — URLs absolues, trailing-slash normalized, x-default cohérent
2. OG + Twitter complets — Images 1200x630, fallback dynamique `/api/og`
3. Robots.txt + crawlability — whitelist AI bots (Claude/Perplexity/GPT Search), blocage scrapers

## P0

1. **Description trop générique, USP dilué** (page.tsx:89-91) — manque "100% seniors, zéro intermédiaire" ou "Implémentation 90 jours" — 15min
2. **Internal linking diversité insuffisante** — ajouter 4-5 liens contextuels vers /a-propos, /methodologie, /cas-concrets, /transparence — 1h
3. **Hreflang FR-only signal ambigu** post-EN-disable — documenter window réactivation ou accélérer fix next-intl

## P1

1. VideoTestimonials uploadDate dynamique = stale signal — 15min
2. AggregateRating + Review retirés sans signal de non-validité — réactiver quand ≥5 avis Will valide — 1h
3. OG image dynamique perf risk si `/api/og` timeout — passer ogImage statique OU cache SWR Redis — 1-2h

## P2

1. Service x5 areaServed granularité (Île-de-France) — 30min
2. LocalBusiness description expansion si Will valide — 10min
3. FAQ home 12Q vs 30+ global — vérifier canonicals GSC

## Centralisation opportunities

- `buildProductMetadata()` enum pour descriptions templates (SSOT tone voice)
- `buildPageContext(pagePath)` pour internal linking strategy normalisée
- `src/lib/i18n/locale-feature-flags.ts` singleton pour `isEnLocaleDisabled()` (dedup 3 callsites)
- JSON-LD factories invariants TS-strict pour éviter oublis areaServed
