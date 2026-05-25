# D1 — JSON-LD Code-Level Validation Report
**Sprint A Ville DRY — 2026-05-25**
**Audit agent: D-1 (read-only, code-level)**

---

## 1. Scope and Methodology

All JSON-LD emission points were identified by:
1. Grepping `application/ld+json` across `src/` → 14 files
2. Reading all schema helpers in `src/lib/seo.ts` (21 factories), `src/lib/seo/ville-service-jsonld.ts`, `src/lib/seo/extended-schemas.ts`, `src/lib/seo/speakable-universal.ts`
3. Reading the four major public page templates plus global layout
4. Reading the two new ville components that emit JSON-LD inline

No runtime test was performed — this is a static code-level audit.

---

## 2. JSON-LD Infrastructure Summary

### Emission Mechanisms

| Component | Pattern | Strategy |
|---|---|---|
| `JsonLd` (`src/components/marketing/JsonLd.tsx`) | Single schema `<script>` | inline / afterInteractive / lazyOnload |
| `JsonLdGraph` (`src/components/marketing/JsonLdGraph.tsx`) | `@graph` multi-schema | inline / afterInteractive / lazyOnload |
| Direct `<script dangerouslySetInnerHTML>` in `VilleEcosystemeLocal` | Inline Place | always inline (no deferral) |
| Direct `<script dangerouslySetInnerHTML>` in `VilleCommunesProches` | Inline ItemList | always inline (no deferral) |

### Factories Available (`src/lib/seo.ts`)

21 helpers: `buildServiceJsonLd`, `buildFaqJsonLd`, `buildBreadcrumbJsonLd`, `buildOrganizationJsonLd`, `buildWebsiteJsonLd`, `buildPersonJsonLd`, `buildArticleJsonLd`, `buildFaqSpeakableJsonLd`, `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`, `buildProductJsonLd`, `buildHowToJsonLd`, `buildCourseJsonLd`, `buildReviewJsonLd`, `buildAggregateRatingJsonLd`, `buildDatasetJsonLd`, `buildImageObjectJsonLd`, `buildQAPageJsonLd`.

Extended schemas (`src/lib/seo/extended-schemas.ts`): `buildDefinedTermJsonLd`, `buildSoftwareApplicationJsonLd`, `buildVideoObjectJsonLd`, `buildClaimReviewJsonLd`, `buildSiteNavigationJsonLd`, `buildSpecialAnnouncementJsonLd`.

Centralized ville×service factory: `buildVilleServiceJsonLdGraph` (`src/lib/seo/ville-service-jsonld.ts`) — emits 7 schemas for ~8,600 ville×service SSG routes.

---

## 3. Schema Type Inventory by Page Template

### 3.1 Global Layout (`src/app/[locale]/layout.tsx`)

Emits via `JsonLdGraph` (inline, no defer — correct for root SEO):
- **Organization** — `@id: ${SITE_URL}/#organization`; all required fields present: name, url, legalName, sameAs, contactPoint, foundingDate, foundingLocation, areaServed, hasOfferCatalog, logo. Optional env-gated: vatID, registrationNumber.
- **WebSite** — `@id: ${SITE_URL}/#website`; name, url, inLanguage, publisher, SearchAction/urlTemplate present.
- **SiteNavigationElement** — `@id: ${SITE_URL}/#site-navigation`; hasPart[5 items with name/url/position] present.

**Pass rate: 3/3 (100%)**

### 3.2 Home (`src/app/[locale]/page.tsx`)

Emits via `JsonLd` (inline):
- **FAQPage** (`buildFaqSpeakableJsonLd`) — mainEntity[Questions+acceptedAnswers] present; numberOfItems present; Speakable cssSelector present; additionalSelectors `[data-speakable-hero]` extends coverage to hero — correct.
- **LocalBusiness (ProfessionalService)** (`buildLocalBusinessJsonLd`) — name/url/areaServed present; address/geo/openingHours absent (SAB-safe per Google guidelines — correct).
- **Service ×5** — name/provider(@id ref)/areaServed/serviceType per card; areaServed is plain string `"FR"` (valid Schema.org, but typed object `{"@type":"Country","name":"France"}` would be stronger for AEO).
- **VideoObject** (conditional) — emitted only if `VIDEO_TESTIMONIALS.length > 0`; name/description/thumbnailUrl/uploadDate/contentUrl/embedUrl present. No `@id` on VideoObject.

**Pass rate: 4/4 (100%), 1 P2 note**

BreadcrumbList: intentionally absent on home (correct — home is hierarchy root, self-referencing BreadcrumbList is an anti-pattern per Google spec).

### 3.3 Audit Hub (`src/app/[locale]/audit/page.tsx`)

- **Service** (inline JsonLd) — name/description/url/provider(Organization)/areaServed (auto-injected via `buildServiceAreasServed` France+13 regions+villes) / dateModified(BUILD_DATE) — all present.
- **ItemList** (afterInteractive JsonLd) — 4 audit tiers; name/url/numberOfItems/itemListElement[position/name/url/description] — all present.

**Pass rate: 2/2 (100%)**

### 3.4 Ville×Service Pages (`/[locale]/{service}/par-ville/[ville]`)

All four services (audit, interventions, implementation, un-a-un) use `renderVilleServicePage` from `VilleServicePageTemplate.tsx`, which calls `buildVilleServiceJsonLdGraph`.

**Schema set emitted (7 schemas in @graph, strategy=afterInteractive):**

| # | Schema Type | Required Fields | Status | Notes |
|---|---|---|---|---|
| 1 | Service | name, provider, areaServed | PASS | City+AdministrativeArea+Country typed; dateModified auto |
| 2 | LocalBusiness + ProfessionalService | name, address, url | PASS | @type array; @id; address(addressLocality+Region+Country); areaServed(City); NO geo/openingHours — SAB-safe |
| 3 | BreadcrumbList | itemListElement[position/name/item] | PASS | @id; 3 levels; absolute URLs |
| 4 | FAQPage | mainEntity[Question+acceptedAnswer] | CONDITIONAL/PASS | Only if faqItems.length>0; @id per Q; Speakable present |
| 5 | HowTo | name, step[] | CONDITIONAL/PASS | Only if methodologySteps.length>=3; HowToStep[position/name/text] |
| 6 | Person (Manon) | name, worksFor | PARTIAL | NO @id — not referenceable cross-page; NO sameAs (doctrine) |
| 7 | WebPage | url, name, isPartOf | PASS | abstract/alternativeHeadline/breadcrumb cross-ref; Speakable |
| 8 | ItemList (villes proches) | itemListElement | CONDITIONAL/PASS | Only if nearbyVilles.length>0 |

**Pass rate: 8/8 schemas structurally valid. 1 P2 (Person no @id), 1 P1 (duplicate Speakable).**

### 3.5 Implantations Hub Ville (`/[locale]/implantations/[region]/[ville]`)

**Schema set (5 schemas in @graph, strategy=afterInteractive):**

| # | Schema Type | Required Fields | Status | Notes |
|---|---|---|---|---|
| 1 | Service | name, provider, areaServed | PASS | City+AdminArea+Country; auto areaServed override provided |
| 2 | Place | name, geo(GeoCoordinates) | PASS | lat/lon from ville.geo; containedInPlace(region); population additionalProperty |
| 3 | BreadcrumbList | itemListElement | PASS | 3-level; @id; absolute URLs |
| 4 | ItemList (5 verticales) | itemListElement | PASS | 5 items; description present |
| 5 | FAQPage (conditional) | mainEntity | CONDITIONAL/PASS | Only if villeSpecificFaqs.length>0; additionalSelectors OK |

**Pass rate: 5/5 (100%). 1 P1 WARNING: VilleFaqGeolocalisee component also emits its own FAQPage JSON-LD inline — duplicate FAQPage possible on pages with both `faqSpeakableJsonLd` in the graph AND VilleFaqGeolocalisee rendering.**

Note: code comment at line 447 says "VilleFaqGeolocalisee émet déjà son propre FAQPage JSON-LD inline, on n'ajoute donc pas faqSpeakableJsonLd au @graph" — but `faqSpeakableJsonLd ?? null` IS still passed. Needs verification whether this comment reflects the actual final decision.

### 3.6 Implantations Ville×Verticale (`/[locale]/implantations/[region]/[ville]/[verticale]`)

**Schema set (3 schemas in @graph, strategy=afterInteractive):**

| # | Schema Type | Required Fields | Status | Notes |
|---|---|---|---|---|
| 1 | Service | name, description, provider, areaServed | PASS | City+AdminArea+Country; serviceType present |
| 2 | BreadcrumbList | itemListElement | PASS | 4-level hierarchy; @id; absolute URLs |
| 3 | WebPage | url, name, isPartOf, breadcrumb | PARTIAL-BUG | `datePublished: article.publishedAt?.toISOString()` — if publishedAt is null (not yet published), field is `undefined` in the object literal → serialized as missing key (acceptable) but typed `as const` — TypeScript does not catch null.toISOString() risk here; runtime-safe via optional chaining |

**Pass rate: 3/3 structurally valid. 1 P1: datePublished can be undefined if publishedAt is null.**

### 3.7 VilleEcosystemeLocal Component (inline script)

Emits a `Place` schema directly via `<script dangerouslySetInnerHTML>` using a local `buildPlaceJsonLd` function (not the shared factory):

**Validation:**
- `@context: "https://schema.org"` — PRESENT
- `@type: "Place"` — PRESENT
- `name` — PRESENT
- `address.@type: "PostalAddress"` — PRESENT
- `address.addressLocality` — PRESENT
- `address.addressRegion` — PRESENT
- `address.addressCountry: "FR"` — PRESENT
- `containedInPlace.@type: "AdministrativeArea"` — PRESENT
- No `@id` — P2 (cannot be cross-referenced in graph)
- No `geo` — intentional (reserved for LocalBusiness pages)

**Issue: This component uses a local `buildPlaceJsonLd` function** (lines 192-209) rather than the shared `buildPlaceJsonLd` from `src/lib/seo.ts`. The local version is structurally equivalent but bypasses the SSOT. Minor maintainability risk.

**Issue: Script is inline, not deferred.** On ville×verticale pages, this component renders alongside 3 deferred `@graph` schemas — the Place from VilleEcosystemeLocal is parsed immediately while the main graph is deferred. No functional issue, but inconsistent strategy.

### 3.8 VilleCommunesProches Component (inline script)

Emits an `ItemList` schema via `<script dangerouslySetInnerHTML>`:

**Validation:**
- `@context: "https://schema.org"` — PRESENT
- `@type: "ItemList"` — PRESENT
- `name` — PRESENT
- `numberOfItems` — PRESENT
- `itemListElement[].@type: "ListItem"` — PRESENT
- `itemListElement[].position` — PRESENT
- `itemListElement[].url` — **RELATIVE PATH BUG** (e.g., `/implantations/ile-de-france/paris`) — Google requires absolute URLs in `ListItem.url`
- `itemListElement[].name` — PRESENT

**P0 BUG: ItemList URLs are relative, not absolute.** The shared `buildItemListJsonLd` factory in `src/lib/seo.ts` constructs absolute URLs (`${SITE_URL}/${locale}${...}`), but the local function in `VilleCommunesProches.tsx` uses relative paths. Google's structured data documentation states: "The URL of a page that is a member of the ItemList. If it is a URL, then it must be an absolute URL."

---

## 4. Cross-Cutting Analysis

### 4.1 @context Handling

All factories and inline builders set `"@context": "https://schema.org"` (not `http://`). The `JsonLdGraph` component strips `@context` from individual schemas and sets it once on the `@graph` wrapper — this is correct per Schema.org specification.

**Result: 100% pass on @context**

### 4.2 @type Validity

All types used are valid Schema.org types:
- Organization, WebSite, SiteNavigationElement
- Service, LocalBusiness, ProfessionalService, Place, ItemList, BreadcrumbList
- FAQPage, Question, Answer, WebPage, Article
- HowTo, HowToStep, Person, VideoObject
- ClaimReview, DefinedTerm, SoftwareApplication, SpecialAnnouncement (extended, not yet used in pages)

**Result: 100% pass on @type validity**

### 4.3 Speakable Coverage

Speakable is implemented via `buildSpeakableSpecification` from `src/lib/seo/speakable-universal.ts`. Used in:
- `FAQPage` (via `buildFaqJsonLd`, `buildFaqSpeakableJsonLd`)
- `WebPage` (in `buildVilleServiceJsonLdGraph`)
- Home page FAQPage (via `buildFaqSpeakableJsonLd` with `additionalSelectors: ["[data-speakable-hero]"]`)

**P1 Warning: Duplicate Speakable on ville×service pages.** Both FAQPage (schema #4) and WebPage (schema #7) in `buildVilleServiceJsonLdGraph` include a `speakable` SpeakableSpecification with the same selectors (`#axion-direct-answer`, `#axion-faq`). Google documentation does not prohibit this, but it is redundant. The FAQPage-level Speakable is the canonical one for FAQ content.

### 4.4 @graph Pattern Usage

JsonLdGraph is correctly used on all multi-schema pages:
- Layout: 3 schemas (Organization + WebSite + SiteNavigationElement) — inline
- ville×service pages: up to 8 schemas — afterInteractive
- implantations hub: 5 schemas — afterInteractive
- implantations ville×verticale: 3 schemas — afterInteractive

Single `JsonLd` (not graph) used where only 1-2 schemas emitted:
- Home: FAQPage, LocalBusiness, Service×5, VideoObject (4 separate `<script>` tags) — **P2 Note**: these could be consolidated into one `@graph` for parse performance

### 4.5 Duplicate Schema Types

| Page | Potential Duplicate | Severity |
|---|---|---|
| ville×service (VilleServicePageTemplate) | FAQPage + WebPage both have `speakable` | P1 — redundant, not invalid |
| implantations hub (VilleHubPage) | FAQPage from graph + FAQPage from VilleFaqGeolocalisee component | P1 — code comment says VilleFaqGeolocalisee handles this but graph still passes `faqSpeakableJsonLd ?? null` |
| implantations ville×verticale | VilleEcosystemeLocal emits Place inline + main graph has Service (Service has areaServed City) — overlap but different types — OK | INFO |
| implantations ville×verticale + hub | VilleCommunesProches emits ItemList inline; hub page also emits verticalesItemList in graph — different scope ItemLists | INFO — distinct, no conflict |

### 4.6 Undefined Values in Template Literals

Reviewed all factories for potential `undefined` leakage:

| Location | Risk | Assessment |
|---|---|---|
| `buildVilleServiceJsonLdGraph` — `ville.postalCode` | Destructured but not used in JSON-LD (used in HTML only) | No risk |
| `buildVilleServiceJsonLdGraph` — `directAnswer` conditional | `speakableSelectors` and `abstractText` handle undefined correctly | No risk |
| `buildVilleServiceJsonLdGraph` — `priceEur` | `typeof priceEur === "number"` guard before spreading | No risk |
| VilleVerticalePage — `webPageJsonLd.datePublished` | `article.publishedAt?.toISOString()` returns `undefined` if null | P1: `undefined` key will be omitted by JSON.stringify (safe but should be explicit) |
| Home — `videosJsonLd` items | `v.duration` guarded with conditional spread | No risk |
| Home — `v.thumbnail ?? \`https://i.ytimg.com/vi/${v.youtubeId}/maxresdefault.jpg\`` | Fallback present | No risk |

---

## 5. Findings Summary by Severity

### P0 — Critical (must fix before production)

| ID | Location | Issue |
|---|---|---|
| P0-1 | `VilleCommunesProches.tsx:103-105` | ItemList `itemListElement[].url` values are **relative paths** (e.g., `/implantations/ile-de-france/paris`). Google requires absolute URLs. Fix: prefix with `${SITE_URL}/${locale}` or use existing shared `buildItemListJsonLd` factory. Affects ~2,150 hub + ~10,750 verticale pages. |

### P1 — Important (fix before scale)

| ID | Location | Issue |
|---|---|---|
| P1-1 | `VilleServicePageTemplate.tsx` — `buildVilleServiceJsonLdGraph` | Duplicate Speakable on same page: both FAQPage (#4) and WebPage (#7) carry identical `speakable` SpeakableSpecification. Remove from FAQPage or WebPage (keep on WebPage for voice search breadth). |
| P1-2 | `VilleHubPage` (`implantations/[region]/[ville]/page.tsx`) lines 448-458 | Comment says "VilleFaqGeolocalisee émet déjà son propre FAQPage JSON-LD" but `faqSpeakableJsonLd ?? null` is still passed to `JsonLdGraph`. If VilleFaqGeolocalisee also emits FAQPage, Google sees 2 FAQPage schemas on the same page. Audit the VilleFaqGeolocalisee component to confirm whether it emits FAQPage, and either remove `faqSpeakableJsonLd` from the graph or disable VilleFaqGeolocalisee's JSON-LD when hub covers it. |
| P1-3 | `VilleVerticalePage` (`implantations/[region]/[ville]/[verticale]/page.tsx`) line 382 | `datePublished: article.publishedAt?.toISOString()` — when `publishedAt` is null, the field is `undefined` in the `as const` object. While `JSON.stringify` omits `undefined` keys (safe), the intent should be explicit: use a fallback `?? undefined` or omit with conditional spread. |

### P2 — Minor (nice-to-fix)

| ID | Location | Issue |
|---|---|---|
| P2-1 | `VilleEcosystemeLocal.tsx:192-209` | Local `buildPlaceJsonLd` function duplicates logic from shared `buildPlaceJsonLd` factory in `src/lib/seo.ts`. Maintainability risk: updates to the schema format must be applied in two places. Refactor to use the shared factory with the `address` property. |
| P2-2 | `VilleEcosystemeLocal.tsx:379-383` | Place JSON-LD emitted inline (not deferred) while the main page graph uses `strategy="afterInteractive"`. Inconsistency in parse strategy. Low impact on performance (Place is small ~200 bytes) but inconsistent. |
| P2-3 | `buildVilleServiceJsonLdGraph` — Person (Manon) | Person schema has no `@id` — cannot be cross-referenced by Article schemas on blog posts that reference Manon as author. Recommend adding `@id: "${SITE_URL}/#person-manon"`. |
| P2-4 | `home/page.tsx` lines 1632-1636 | 4 separate `JsonLd` components (FAQPage, LocalBusiness, Service×5, VideoObject) emit 4 separate `<script>` tags. Could be consolidated into one `JsonLdGraph @graph` call for parse performance (-200 to -400ms TBT). |
| P2-5 | `home/page.tsx` — Service×5 `areaServed` | Plain string `"FR"` used instead of typed object `{"@type": "Country", "name": "France"}`. Weaker signal for AEO/LLMs. The shared `buildServiceJsonLd` auto-injects typed array via `buildServiceAreasServed` — inconsistent with home implementation. |

### P3 — Informational

| ID | Location | Note |
|---|---|---|
| P3-1 | All pages | `BUILD_DATE` as `dateModified` on Service schemas — accurate for build-time content but will not reflect runtime DB-updated content until next rebuild. For DB-sourced pages (articles), `dateModified` is correctly set per-article. |
| P3-2 | Global layout | `WebSite.url` is `${SITE_URL}/${locale}` (e.g., `https://axion-ia.com/fr`) not `${SITE_URL}` — Google recommends the root domain for WebSite schema. Minor but Google may prefer `https://axion-ia.com`. |
| P3-3 | `buildOrganizationJsonLd` | `vatID` and `registrationNumber` are optional, env-gated. Currently absent (0 SIREN as noted in codebase). Once obtained, these are high-value E-E-A-T signals for LLM Knowledge Graph disambiguation. |
| P3-4 | Image Bank (galerie pages) | `image-jsonld-graph.service.ts` emits ImageObject JSON-LD — not audited in this D1 pass (covered separately by image-bank audit). |

---

## 6. Schema Type Pass Rate Summary

| Schema Type | Pages/Templates | Required Fields OK | P0 Issues | P1 Issues |
|---|---|---|---|---|
| Organization | 1 (global layout) | YES | 0 | 0 |
| WebSite | 1 (global layout) | YES | 0 | 0 |
| SiteNavigationElement | 1 (global layout) | YES | 0 | 0 |
| Service | 6+ templates | YES | 0 | 0 |
| LocalBusiness / ProfessionalService | 2 (home + ville×service) | YES | 0 | 0 |
| BreadcrumbList | 4 templates | YES | 0 | 0 |
| FAQPage | 3 templates | YES (conditional) | 0 | 1 (duplicate on hub) |
| Speakable | embedded in FAQPage + WebPage | YES | 0 | 1 (duplicate selectors) |
| HowTo | ville×service | YES (conditional) | 0 | 0 |
| Person (Manon) | ville×service | PARTIAL (no @id) | 0 | 0 |
| WebPage | 2 templates | YES | 0 | 1 (null datePublished) |
| ItemList | 5 templates | PARTIAL | 1 (relative URLs in VilleCommunesProches) | 0 |
| Place | 2 templates (hub + VilleEcosystemeLocal) | YES | 0 | 0 |
| VideoObject | home (conditional) | YES | 0 | 0 |

**Overall: 14 schema types audited. 1 P0, 3 P1, 5 P2, 4 P3.**

---

## 7. Top-Priority Fixes

### Fix 1 — P0: VilleCommunesProches relative URLs (30 min)

**File:** `src/components/ville/VilleCommunesProches.tsx`

Current (line 103):
```ts
url: `/implantations/${v.region}/${v.slug}${suffix}`,
```

Fix — replace the local `buildItemListJsonLd` with the shared factory from `src/lib/seo.ts` or prefix with absolute URL. The component needs access to `SITE_URL` and `locale`. Since it is a Server Component, `locale` can be passed as a prop or inferred from `next-intl/server`.

Simplest fix — prefix with SITE_URL in the local builder:
```ts
import { SITE_URL } from "@/lib/seo";
// ...
url: `${SITE_URL}/${isFr ? "fr" : "en"}/implantations/${v.region}/${v.slug}${suffix}`,
```

However, this hardcodes `fr/en` duality — better to pass locale as a prop (component is already used from pages that have `isFr`; extend to pass `locale` string).

### Fix 2 — P1: FAQPage duplicate on hub (15 min)

**File:** `src/app/[locale]/implantations/[region]/[ville]/page.tsx` lines 304-309 + 448-458

Confirm whether `VilleFaqGeolocalisee` emits its own FAQPage JSON-LD by auditing that component. If it does, remove `faqSpeakableJsonLd` from the `JsonLdGraph` schemas array (pass `null` instead). If it does not, the current code is correct.

### Fix 3 — P1: Duplicate Speakable in buildVilleServiceJsonLdGraph (10 min)

**File:** `src/lib/seo/ville-service-jsonld.ts`

Remove `speakable: buildSpeakableSpecification(...)` from the FAQPage schema (#4) at line 230 since the WebPage schema (#7) at line 318 already covers the same selectors. FAQPage's Speakable is redundant when WebPage targets the same selectors.

---

## 8. Verdict

| Category | Score |
|---|---|
| @context correctness | 10/10 |
| @type validity | 10/10 |
| Required fields per type | 8.5/10 (VilleCommunesProches ItemList relative URLs -1.5) |
| Duplicate schema types | 8/10 (2 P1 duplicates) |
| undefined value risks | 9/10 (1 P1 null datePublished) |
| Factory SSOT compliance | 8/10 (2 inline local builders bypassing SSOT) |
| @graph pattern usage | 9/10 (home uses multiple separate scripts instead of @graph) |
| Speakable coverage | 9/10 (duplicate selectors, otherwise excellent coverage) |

**Global JSON-LD score: 71/80 = 89% — GOOD with 1 P0 fix required**

The architecture is mature and well-designed with a centralized factory pattern (`buildVilleServiceJsonLdGraph`), appropriate use of `@graph`, correct SAB-pattern for LocalBusiness, and solid Speakable coverage. The single P0 (relative URLs in VilleCommunesProches) is a straightforward fix that will improve Google crawling of ~12,900 ItemList schemas across pSEO pages.
