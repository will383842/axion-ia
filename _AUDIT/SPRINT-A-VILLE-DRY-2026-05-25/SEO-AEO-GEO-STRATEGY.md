# SEO / AEO / GEO Strategy — 2 150 Ville Pages

**Sprint A · 2026-05-25 · Axion-IA**

---

## Executive Summary

Axion-IA operates 2 150 city hub pages (`/fr/implantations/{region}/{ville}`) plus up to
10 750 verticale pages (`/fr/implantations/{region}/{ville}/{verticale}`) — one per
city × 5 service verticals (audits, interventions, implementations, un-a-un, sites-web-ia).

The architecture is DRY: shared service components (`src/components/services/*/`) accept
an optional `VilleContext` prop, so a single edit to a main service page propagates
automatically to all 2 150 city variants. City-specific depth (ecosystem, secteurs,
FAQ étendue, cas d'usage) is LLM-generated per city and stored as `Article` rows in the
database, fetched at ISR render time.

**Anti-doorway protection (HCU 2024):** pages without a published Article render a
minimal stub with `noindex`. The sitemap filters on `getIndexableVilles()` — only pages
with real content are submitted to Google.

**Content tiers (Tier 1 / 2 / 3) govern depth, indexation and indexnow urgency.**

---

## Meta Tag Formula per Combo (verticale × ville)

### Hub page `/fr/implantations/{region}/{ville}`

```
title (pilot): {Ville} ({Departement}) · Cabinet IA opérationnel
title (non-pilot): {Ville} · Intervention IA opérationnelle ({Region})

description (pilot, ≤155 chars):
  {copy.directAnswerFr} — truncated at last word boundary

description (non-pilot, ≤155 chars):
  "Axion-IA intervient à {Ville} ({Region}). 5 modules : audit IA,
   intervention sur site, implémentation, accompagnement 1-to-1, sites web
   augmentés. Réservation en ligne."
```

### Verticale page `/fr/implantations/{region}/{ville}/{verticale}`

```
title (LLM article available):
  {article.metaTitle} (stripped of trailing " · Axion-IA" to avoid doublon
  with root layout template "%s · Axion-IA")
  → if already contains "Axion-IA": emitted as { absolute: title }

title (fallback):
  {VerticalLabel} à {Ville}

description (LLM article available): {article.metaDescription}

description (fallback, ≤155 chars):
  "Axion-IA propose {vertical_label} à {Ville} ({Region}).
   Tarifs publics, intervention rapide, ROI chiffré."
```

### Noindex rule

- No Article in DB → `robots: { index: false, follow: true }`
- Article with `indexationTier === "tier_3_noindex_nofollow"` → same noindex
- Stub pages (no `ville.copy`) → noindex via `generateMetadata`

---

## JSON-LD Schemas per Page (10 schemas; implemented vs gaps)

### Hub page — 5 schemas in `@graph` (via `JsonLdGraph`)

| #   | Schema                                                                             | Status      | Notes                                                                                                        |
| --- | ---------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `Service` (ProfessionalService) + `areaServed` [City, AdministrativeArea, Country] | IMPLEMENTED | `buildServiceJsonLd` — includes `Speakable` selector                                                         |
| 2   | `Place` (LocalBusiness facade) + `geo` + `containedInPlace`                        | IMPLEMENTED | `buildPlaceJsonLd`                                                                                           |
| 3   | `BreadcrumbList`                                                                   | IMPLEMENTED | `buildBreadcrumbJsonLd`                                                                                      |
| 4   | `ItemList` (5 verticales links)                                                    | IMPLEMENTED | `buildItemListJsonLd` — 5 ListItems with descriptions                                                        |
| 5   | `FAQPage` + `SpeakableSpecification`                                               | IMPLEMENTED | `buildFaqSpeakableJsonLd` — only when ≥1 ville FAQ entry                                                     |
| 6   | `WebPage`                                                                          | GAP         | Not emitted on hub page. Add `@id: {url}#webpage`, `inLanguage`, `dateModified`                              |
| 7   | `Organization` sameAs                                                              | GAP         | Should reference `{SITE_URL}/#organization` sameAs Wikidata                                                  |
| 8   | `LocalBusiness` SAB (Service Area Business)                                        | GAP         | Distinct from `Place`. Emit `ProfessionalService` with `areaServed` as `GeoCircle` radius 60km for T1 cities |
| 9   | `VideoObject` (if testimonial/demo present)                                        | GAP         | Not applicable on all pages; add when video component is present                                             |
| 10  | `Person` (William J.)                                                              | GAP         | Could be referenced from `Service.provider` for E-E-A-T                                                      |

### Verticale page — 3 schemas in `@graph`

| #   | Schema                               | Status                                             | Notes                                                                                                                                                                     |
| --- | ------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Service` + `areaServed`             | IMPLEMENTED                                        | 3-level: City + AdministrativeArea + Country                                                                                                                              |
| 2   | `BreadcrumbList`                     | IMPLEMENTED                                        | 4-level breadcrumb                                                                                                                                                        |
| 3   | `WebPage`                            | IMPLEMENTED                                        | `@id`, url, name, description, inLanguage, isPartOf, breadcrumb, datePublished                                                                                            |
| 4   | `FAQPage`                            | EMITTED by `VilleFaqGeolocalisee` component inline | Separate from @graph (anti-doublon)                                                                                                                                       |
| 5   | `HowTo`                              | GAP                                                | For implementation/audits vertical — process steps already in `AuditMethodology`/`ImplementationProcessSteps`                                                             |
| 6   | `SpeakableSpecification`             | PARTIALLY                                          | Emitted inside Service@graph; `VilleFaqGeolocalisee` adds FAQ speakable. Hero `[data-speakable-hero]` selector should be added to verticale pages (currently only on hub) |
| 7   | `LocalBusiness` SAB                  | GAP                                                | Same gap as hub                                                                                                                                                           |
| 8   | `DefinedTerm` (glossary terms cited) | GAP                                                | Only relevant if article references glossary terms                                                                                                                        |
| 9   | `ItemList` (villes proches)          | EMITTED by `VilleCommunesProches` component inline |                                                                                                                                                                           |
| 10  | `Article` (LLM content)              | GAP                                                | Should reference `article.publishedAt` and `author` for E-E-A-T                                                                                                           |

---

## AEO Strategy (Answer Engine Optimisation)

### FAQ Format

- **VilleFaqGeolocalisee** component emits FAQPage JSON-LD with up to 10 city-specific
  Q&A pairs sourced from LLM-generated `article.faqJson`.
- Verticale pages pass ≤3 `villeSpecificFaqs` to service components (`AuditFaq`,
  `InterventionsFaq`, etc.) which render them as visible `<details>` / `<dl>` elements
  alongside the static FAQ content.
- **Gap:** FAQ entries on verticale pages should target voice-query format:
  "Quel est le coût d'un audit IA à {Ville} ?" (question + direct answer ≤45 words).

### Speakable Selectors

Currently declared selectors:

- `[data-speakable-hero]` — hero pitch paragraph on hub page
- `[data-speakable-direct-answer]` — emitted by service components
- FAQPage entries are auto-speakable by Google (no additional selector needed)

**Gap:** `[data-speakable-hero]` is only added on the hub hero (`data-speakable-hero`
on `<p>` inside hub page). Verticale pages should add the same attribute to the hero
description paragraph (`AuditHero`, `InterventionsHero`, etc. — add `data-speakable-hero`
to the lead paragraph in each Hero component, with `villeContext` interpolation).

### Cite-worthy Paragraphs

LLM generators (`landing-ville-*`) should produce, per page:

1. A **direct answer** (≤60 words, no markdown) → stored as `article.directAnswer`,
   rendered at top of page, referenced in `Service.description`.
2. A **data paragraph** citing a concrete local stat (number of enterprises, secteur
   dominant) → rendered in `VilleTissuEconomique` / `VilleEcosystemeLocal`.
3. A **methodology paragraph** (≤80 words) explaining the Axion-IA process locally →
   rendered in verticale-specific methodology component.

Perplexity, Claude.ai and ChatGPT Search prefer short factual paragraphs with a clear
subject + predicate structure. Avoid markdown bullets in the `directAnswer` field.

---

## Local SEO / GEO Strategy

### Service Area Business (SAB) Pattern

**Current state:** `buildServiceJsonLd` emits `ProfessionalService` with `areaServed`
including the city as a `City` node. This is correct but not a full SAB pattern.

**Recommended addition (GAP):** Emit `LocalBusiness` → `ProfessionalService` with:

```json
{
  "@type": "ProfessionalService",
  "name": "Axion-IA",
  "url": "https://axion-ia.com/fr/",
  "address": { "@type": "PostalAddress", "addressLocality": "Paris", "addressCountry": "FR" },
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": { "@type": "GeoCoordinates", "latitude": 48.8566, "longitude": 2.3522 },
    "geoRadius": "600000"
  }
}
```

One global `LocalBusiness` in the root layout `@graph`. City pages add local
`areaServed: { "@type": "City", "name": "{Ville}" }` scoped to that page's `Service`.

### Hreflang

- Hub pages: `alternates: { fr: /implantations/{region}/{ville}, en: /locations/{region}/{ville} }`
  emitted via `buildProductMetadata`. EN locale is currently 301-redirected (EN_LOCALE_ENABLED=false)
  but hreflang tags remain in HTML for future re-activation.
- Verticale pages: **GAP** — no `alternates` declared in `generateMetadata`. Add
  `en: /locations/{region}/{ville}/{verticale}` mappings when EN re-enabled.

### Maillage Interne (Internal Linking)

Existing cross-links:

- Hub → 5 verticale cards (`ItemList` JSON-LD + visual grid)
- Hub → `VilleCommunesProches` links to neighboring cities (hub level, no verticale)
- Verticale → `VilleCommunesProches` links to neighboring city × same verticale
- Verticale → `OrangeContactBanner` → `/reserver`
- Verticale → `*CrossModules` → other service main pages

**Gap / recommendations:**

1. Hub page should link to the region page (`/implantations/{region}`) and to the
   national service page (`/audit`, `/interventions`, etc.) — not just to the 5 verticales.
2. `VilleCommunesProches` should also link to `/{ville}/{verticale}` (not just the hub)
   when rendering on a verticale page — already done via `verticale` prop.
3. Blog articles about a verticale should have a contextual CTA linking to the nearest
   T1 city page for that verticale.

### Geographic Breadth

- 13 regions, ~2 150 cities > 5 000 inhabitants
- Tier 1: ≥100K pop (40 cities) — full ISR + LLM content + sitemaps images T1
- Tier 2: 50K–100K (83 cities) — full ISR + LLM content + sitemaps images T2
- Tier 3: 5K–50K (~2 027 cities) — ISR on-demand + LLM content generated progressively
- Non-pilotes (no `ville.copy`): noindex stubs served on SSG

---

## AI Crawlers Strategy

### Allowed Bots (robots.ts — IMPLEMENTED)

All of the following are explicitly allowed (`Allow: /`, `Disallow:` matches common
private paths only):

| Bot                | Engine              | Purpose                                      |
| ------------------ | ------------------- | -------------------------------------------- |
| GPTBot             | OpenAI              | Training data                                |
| OAI-SearchBot      | ChatGPT Search      | Real-time search citations                   |
| ChatGPT-User       | ChatGPT browsing    | Live page fetch for chat answers             |
| ClaudeBot          | Anthropic           | Training data                                |
| anthropic-ai       | Anthropic (legacy)  | Training data                                |
| Claude-Web         | Claude.ai           | Citations in Claude.ai answers               |
| PerplexityBot      | Perplexity          | Training + real-time answers                 |
| Perplexity-User    | Perplexity          | Live fetch for answer cards                  |
| Google-Extended    | Google (Gemini/SGE) | AI training + AI Overviews                   |
| Applebot-Extended  | Apple Intelligence  | On-device AI training                        |
| Mistral-User       | Mistral Chat        | Live chat citations                          |
| Bingbot            | Bing + Copilot      | Search + Copilot citations (crawl-delay: 1s) |
| Meta-ExternalAgent | Meta AI             | Meta AI citations                            |
| YandexBot          | YandexGPT / Neuro   | Eastern Europe coverage                      |
| Googlebot-Image    | Google Images       | Image indexation                             |

### Blocked Bots

CCBot (CommonCrawl), Bytespider (TikTok), omgili, Diffbot — all `Disallow: /`.

### Additional AI Signals (IMPLEMENTED)

- `llms.txt` — machine-readable description, canonical pages, licensing
- `/.well-known/ai-policy.json` — structured AI policy
- `/ai.txt` — optional extended policy
- `<meta name="generator">` — AI Act art. 50 disclosure on all LLM-generated pages
  (via `AiContentDisclaimer` component + `aiGenerated:true` in Article JSON-LD)
- `/fr/transparence` page — human-readable AI Act transparency page

---

## Tier Stratification (Content Depth)

### Tier 1 — Cities ≥ 100K inhabitants (40 cities)

- Full `ville.copy` editorial block (pilot programme)
- LLM-generated: ecosystem + secteurs + FAQ étendue (8-10 entries) + 3 cas d'usage
- 5 verticale pages with rich Article content (indexation tier: `tier_1_index`)
- Sitemap images T1 (`sitemap-images-villes-t1.xml`)
- IndexNow push on publish + on ISR refresh
- JSON-LD: all 10 schemas target
- Internal links: region page + 4 neighbor cities + national service page

### Tier 2 — Cities 50K–100K (83 cities)

- LLM-generated: ecosystem + secteurs + FAQ (5-6 entries) + 1 cas d'usage
- 5 verticale pages (indexation tier: `tier_2_index`)
- Sitemap images T2
- IndexNow push on publish
- JSON-LD: 7 schemas (skip VideoObject + Article + Person)

### Tier 3 — Cities 5K–50K (~2 027 cities)

- LLM-generated on-demand: ecosystem stub + FAQ (3 entries)
- Verticale pages generated progressively by content-gen workers
- Anti-doorway: noindex until Article published and quality-gated
- No images sitemap (T3+T4 combined in `sitemap-images-villes-t3-t4.xml`)
- IndexNow push only on first publish (not on ISR refresh)
- JSON-LD: 5 schemas (Service + BreadcrumbList + WebPage + FAQPage + ItemList)

---

## IndexNow Implementation Status — FULLY IMPLEMENTED

**File:** `src/lib/indexnow.ts` — `pingIndexNow(urls, context)` utility

**Integration points:**

- `src/server/queue/workers/content-indexnow-worker.ts` — BullMQ worker,
  triggered after article publish by `content-publish-worker`
- `src/server/content-gen/indexing/enqueue.ts` — enqueues IndexNow job
- `src/app/api/indexnow/route.ts` — HTTP API endpoint (internal use)
- `src/app/api/indexnow/key/route.ts` — serves `/{INDEXNOW_KEY}.txt` for key verification
- `src/server/content-gen/seo/bing-wmt-client.ts` — Bing Webmaster Tools integration

**Env var:** `INDEXNOW_KEY` — declared optional in `src/env.ts` (z.string().min(8).max(128).optional()).

**Behavior:**

- No-op with console.warn in non-production when key is missing (safe for dev/preview)
- Validates all URLs match the configured host before sending (avoids IndexNow 422 rejection)
- `keyLocation` points to `https://axion-ia.com/{key}.txt` (spec-compliant `.txt` suffix)
- Fire-and-forget (does not block publish pipeline)
- Cascades to Bing + Yandex + Seznam + Naver via `api.indexnow.org`

**Action for Will:** Set `INDEXNOW_KEY` in Coolify env vars if not already set. Verify
`/{key}.txt` returns 200 by checking `https://axion-ia.com/{your_key}.txt`.

---

## E-E-A-T Signals

### Current E-E-A-T signals (implemented)

- **Author:** William J. persona referenced in `un-a-un` vertical, `/transparence` page
- **AI Act compliance:** `AiContentDisclaimer` on every page with LLM content
- **Case studies:** `/fr/cas-concrets` with measured ROI — referenced in service pages
- **Methodology:** `/fr/methodologie` 4-step process — `HowTo` JSON-LD implemented
- **Pricing transparency:** tariffs publics on all 5 service pages

### Gaps

1. **`Person` schema for William J.:** Not emitted on ville pages. Add to `Service.provider`
   on T1 city pages:
   ```json
   "provider": { "@type": "Person", "name": "William J.", "jobTitle": "Fondateur, Axion-IA",
     "url": "https://axion-ia.com/fr/un-a-un", "sameAs": ["https://linkedin.com/in/..."] }
   ```
2. **`Article` schema on verticale pages:** LLM articles should emit `Article` JSON-LD
   with `datePublished`, `dateModified`, `author` referencing the Person node.
3. **Experience mentions in LLM content:** Generator prompts should explicitly request
   "mention that Axion-IA founder has X years of operational AI experience and has
   worked with TPE/PME/ETI across France" to satisfy Experience + Expertise dimensions.
4. **Reviews/Testimonials schema:** `src/components/ville/VilleEcosystemeLocal` could
   integrate `AggregateRating` from verified case study data when available.

---

## Actions for Will (5 Key Actions)

### 1. Set INDEXNOW_KEY in Coolify (5 min)

Set `INDEXNOW_KEY` environment variable in Coolify Application → Env vars.
Generate a UUID-style key, create the file `public/{key}.txt` containing only the key,
then verify: `curl https://axion-ia.com/{key}.txt` should return the key string.

### 2. Add `[data-speakable-hero]` to Verticale Hero Components (30 min)

In `AuditHero`, `InterventionsHero`, `ImplementationHero`, `UnAUnHero`, `SitesWebHero`,
add `data-speakable-hero` attribute to the lead paragraph that renders
`villeContext`-interpolated description. This unlocks voice search on all 10 750
verticale pages for zero extra content generation cost.

### 3. Emit `WebPage` JSON-LD on Hub Pages (15 min)

The verticale page emits `WebPage` in the @graph but the hub page does not. Add a
`webPageJsonLd` object (same pattern as verticale) to the hub page's `JsonLdGraph`
schemas array. Include `dateModified: new Date().toISOString()` until ISR provides
a real lastModified signal.

### 4. Prioritise Tier 1 LLM Content Generation (1 day of worker time)

Trigger the content-gen worker for the 40 T1 cities × 5 verticals = 200 target pages.
Use the admin console → Content Generation → New Campaign → select "top 40 villes T1"
expansion mode. Each article costs ~$0.04 LLM compute. Total: ~$8 + ~2h generation.
These 200 pages are the highest-value for Google Discover + Bing Copilot citations.

### 5. Add `LocalBusiness` SAB to Root Layout @graph (45 min)

Add a single `ProfessionalService` with `areaServed: { "@type": "GeoCircle",
"geoRadius": "600000" }` centred on Paris to the root layout's JSON-LD `@graph`.
This tells Google/Bing/Perplexity that Axion-IA covers all of France, independent
of which city page is crawled. Complement with `streetAddress`, `postalCode`, `geo`
once the Paris office address is confirmed (required for LocalBusiness eligibility).
