# SEO / AEO 60-items checklist per generated URL

> Validated automatically by `pnpm content-gen:html-audit <url>`. Failure = blocks tier-1 promotion.

See § 9.7 of master prompt for full detail. This is the actionable summary.

## `<head>` — 32 mandatory tags

- [ ] `<meta charset="UTF-8">`
- [ ] `<meta http-equiv="content-type" content="text/html; charset=UTF-8">`
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- [ ] `<meta name="theme-color" content="#C45A3E" media="(prefers-color-scheme: light)">`
- [ ] `<meta name="color-scheme" content="light">`
- [ ] `<meta name="format-detection" content="telephone=no">`
- [ ] `<meta name="apple-mobile-web-app-capable" content="yes">`
- [ ] `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- [ ] `<meta name="mobile-web-app-capable" content="yes">`
- [ ] `<meta name="application-name" content="Axion-IA">`
- [ ] `<title>` 50-60 chars, primary KW début, `| Axion-IA` fin
- [ ] `<meta name="description" content="...">` 140-160 chars
- [ ] `<meta name="robots" content="...">` (conditional tier)
- [ ] `<meta name="googlebot" content="...">`
- [ ] `<meta name="bingbot" content="...">`
- [ ] `<meta name="author" content="Manon">`
- [ ] `<meta name="publisher" content="Axion-IA">`
- [ ] `<meta name="generator" content="Axion-IA Content Engine">`
- [ ] `<meta name="rating" content="general">`
- [ ] `<meta name="referrer" content="strict-origin-when-cross-origin">`
- [ ] `<link rel="canonical" href="https://axion-ia.com/fr/<path>">` absolute
- [ ] `<link rel="alternate" hreflang="fr-FR" href="...">`
- [ ] `<link rel="alternate" hreflang="x-default" href="...">` (FR-only V1)
- [ ] `<link rel="alternate" type="application/rss+xml" title="Blog Axion-IA" href="/blog/feed.xml">`
- [ ] `<link rel="alternate" type="text/markdown" href="/fr/<path>.md">`
- [ ] `<link rel="icon" sizes="any" href="/favicon.ico">`
- [ ] `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
- [ ] `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`
- [ ] `<link rel="manifest" href="/manifest.webmanifest">`
- [ ] `<link rel="preconnect">` (fonts, CDN)
- [ ] `<link rel="dns-prefetch">`
- [ ] `<link rel="preload" as="image" fetchpriority="high">` (LCP)

## Open Graph — 14 mandatory tags

- [ ] og:type, og:title, og:description, og:url, og:site_name, og:locale (`fr_FR`)
- [ ] og:image (1200×630), og:image:width, og:image:height, og:image:alt, og:image:type
- [ ] article:published_time, article:modified_time, article:author (`https://axion-ia.com/fr/equipe/manon`)
- [ ] article:section, article:tag (×N max 8)

## Twitter Cards — 7 tags

- [ ] twitter:card (`summary_large_image`)
- [ ] twitter:title, twitter:description, twitter:image, twitter:image:alt
- [ ] twitter:site, twitter:creator (only if real handle — else omit)

## Geo meta — 4 tags (landings villes only)

- [ ] geo.region (`FR-<dept_code>`)
- [ ] geo.placename
- [ ] geo.position (`<lat>;<lng>`)
- [ ] ICBM (`<lat>, <lng>`)

## Headings hierarchy

- [ ] Exactly 1 `<h1>` per page
- [ ] 3-8 `<h2>` per page, all unique, ≤ 70 chars
- [ ] `<h3>` only as direct child of `<h2>` (no level skip)
- [ ] 0 `<h5>`, 0 `<h6>`

## Semantic HTML5

- [ ] `<html lang="fr" dir="ltr">`
- [ ] 1 `<main id="main">`
- [ ] `<article itemscope itemtype="https://schema.org/Article">`
- [ ] `<nav aria-label="Fil d'Ariane">` breadcrumb
- [ ] `<aside data-aeo="tldr">` TL;DR block
- [ ] `<section aria-labelledby>` per major section
- [ ] `<figure>` + `<figcaption>` for contextual images
- [ ] `<table><caption>` + `<th scope="col">` for tables
- [ ] `<details>/<summary>` for FAQ items
- [ ] `<time datetime="...">` for dates
- [ ] Skip link `<a href="#main">Aller au contenu</a>`

## AEO blocks (mandatory)

- [ ] TL;DR encadré 2-4 lines (`<aside data-aeo="tldr">`)
- [ ] Direct Answer 40-80 mots citable LLMs (`<p data-aeo="answer">`)
- [ ] Key Facts list 3-7 bullets atomic figures (`<ul data-aeo="facts">`)
- [ ] TOC auto-generated for guides and long articles
- [ ] FAQ embed 4-12 items at end

## JSON-LD blocks

- [ ] WebSite + SearchAction (in layout)
- [ ] Organization (in layout, `@id`)
- [ ] Person (Manon, `@id` referenced)
- [ ] BreadcrumbList (every page)
- [ ] Article / BlogPosting / TechArticle (or variant) for articles
- [ ] Place + LocalBusiness + Service × N for landings villes
- [ ] HowTo + HowToStep for guides
- [ ] QAPage + Question + Answer for FAQ standalone
- [ ] FAQPage + Speakable for FAQ embed
- [ ] ItemList for neighbouring communes / listings

## Images rules

- [ ] `width` + `height` HTML attributes mandatory (anti-CLS)
- [ ] `alt` attribute mandatory (non-empty for content images)
- [ ] LCP image: `loading="eager"` + `fetchpriority="high"` + preload
- [ ] All other images: `loading="lazy"` + `decoding="async"`
- [ ] `<picture>` with AVIF / WebP / JPG fallback
- [ ] `srcset` 3 variants minimum: 320w, 768w, 1280w
- [ ] `sizes` responsive

## Author Manon

- [ ] Byline `<header class="article-byline">` at top
- [ ] Author card `<aside class="author-card">` at bottom
- [ ] `rel="author"` link to `/fr/equipe/manon`
- [ ] All `Article.author` JSON-LD reference Manon by `@id`

## i18n

- [ ] `<html lang="fr">`
- [ ] Canonical = `/fr/<path>`
- [ ] hreflang: only `fr-FR` + `x-default` (= FR)
- [ ] No `en-US` hreflang on generated content

## Validation script

```bash
pnpm content-gen:html-audit https://axion-ia.com/fr/implantations/ile-de-france/paris
```

Outputs CSV with each item pass/fail. Aggregate score / 100. < 95 = blocks tier-1.
