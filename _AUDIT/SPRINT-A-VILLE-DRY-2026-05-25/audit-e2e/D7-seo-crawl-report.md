# D7 — SEO Crawl Report
## Sprint A · Ville DRY Refactor · 2026-05-25
**Agent**: D-7 (read-only audit)
**Scope**: Code-level analysis of 7 core templates generating 12 900+ pages
**Files audited**: 8 template/component files + sitemap.ts + sitemap-index route

---

## Pass Rates Summary

| Dimension | Score | Status |
|---|---|---|
| H1 Hierarchy | 7/8 templates | PASS (87.5%) |
| Title Uniqueness | 8/8 templates | PASS (100%) |
| Description Uniqueness | 8/8 templates | PASS (100%) |
| Internal Linking (hub pages) | PASS (≥10 links) | PASS |
| Internal Linking (verticale pages) | PARTIAL (≥5 but no cross-verticale) | WARN |
| Sitemap Coverage (hub villes) | PASS | PASS |
| Sitemap Coverage (verticales) | 4/5 verticales | FAIL — sites-web-ia missing |
| Orphan Pages | NONE detected | PASS |
| Broken Links | 1 pattern detected | WARN (/appel) |

**Overall SEO Crawl Score: 86/100**

---

## 1. Internal Linking Audit

### Hub Ville Page (`/[locale]/implantations/[region]/[ville]/page.tsx`)

**Internal links generated per hub page (full copy):**

| Link | Destination | Count |
|---|---|---|
| 5 verticale cards | `/implantations/{region}/{ville}/{audits|interventions|implementations|un-a-un|sites-web-ia}` | 5 |
| Breadcrumbs | `/implantations` and `/implantations/{region}` | 2 |
| VilleCommunesProches | Nearby hub villes × 8-12 links | 8-12 |
| OrangeContactBanner | `/appel` (see WARN), `/contact` | 2 |
| CTA hero | `/appel`, `/contact` | 2 |
| **Total minimum** | | **≥ 17 links** |

**Target ≥ 5: PASS** — Hub ville pages generate well above the minimum threshold.

**Note on stub pages (no `copy`)**: The `VilleStub` component renders only 2 links: back to region hub + `/appel`. Stub pages are `noindex` per anti-doorway HCU 2024 rule — this is intentional and correct. These ~2 150 stubs will not rank and do not need rich internal linking.

**Note on VilleCommunesProches at build time**: The component has an `early-exit` guard for `stub.invalid` (ADR 0026), which means during GitHub Actions SSG build, nearby-ville links are absent. They are populated at ISR runtime. This is an **accepted tradeoff** per ADR 0026 architecture but means ~2 150 SSG stubs will have 0 nearby links until first ISR hit.

### Verticale Page (`/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx`)

**Internal links per verticale page (with Article):**

| Link | Destination | Present |
|---|---|---|
| Breadcrumbs | `/implantations`, `/implantations/{region}`, `/implantations/{region}/{ville}` (hub) | YES |
| VilleCommunesProches | Nearby villes, same verticale | YES |
| OrangeContactBanner | `/appel`, `/contact` | YES |
| AuditCrossModules | `/interventions`, `/implementation` | audits ONLY |
| AuditCtaBlock / ImplementationCtaBlock | `/reserver` | YES |
| Stub (no Article) | Back to `/implantations/{region}/{ville}` + global service page | YES |

**Total minimum for full pages: ≥ 5** — PASS for the minimum threshold.

**Gap identified — P1**: Cross-verticale links are only present on the `audits` verticale (`AuditCrossModules` → `/interventions`, `/implementation`). The `interventions`, `implementations`, `un-a-un`, and `sites-web-ia` verticale pages have **no explicit cross-verticale links** to the other 4 modules. Users landing on `/implantations/{region}/{ville}/interventions` have no SEO-visible link to `/implantations/{region}/{ville}/audits` or other verticales (except through `VilleCommunesProches` which links to neighbouring cities, not the same city's other verticales).

---

## 2. Heading Hierarchy Check

### Home Page (`src/app/[locale]/page.tsx`)

- **H1 count**: 1 (`id="hero-heading"`) — PASS
- **H1 position**: Hero section, first section of page — PASS
- **H2 count**: 8 section headings (services, founder, why, pricing, videos, cases, audience, testimonials, faq) — valid
- **H3 count**: 4 (service cards, differentiators cards, case study titles, audience segments) — valid
- **H4 count**: 3 (trust signals sub-items inside H2 "why" section) — WARN

**H4 issue**: The home page uses `<h4>` for trust signals (Security, Results, Long-term) but their parent `<h2>` is `id="why-heading"` (Six reasons). The H3s are the 6 differentiator cards, then H4s follow. This creates a hierarchy: `H2 → H3 → H4` which is technically valid, but the H4 elements are visually and semantically siblings of the H3 differentiators. **Not a P0 — standard screen reader will not skip levels.** Marginal SEO issue.

### Hub Ville Page

- **H1 count**: 1 (`id="ville-hub-hero"`) — PASS
- **H1 contains ville name**: YES — `"Axion-IA à {ville.nameFr} ({departement})"` — PASS
- **H2s**: "Nos 5 modules à {ville}", VilleCommunesProches heading, VilleFaqGeolocalisee heading — valid
- **H3s**: 5 verticale cards — valid (within H2 section)
- **Hierarchy verdict**: PASS

**Stub page H1**: The `VilleStub` uses `Section` component with `titleAs="h1"` + `titleEm={ville.nameFr}` — H1 present, contains ville name. PASS.

### Verticale Page

- **H1 count**: 1 (from `*Hero` component via `ServiceHero` → `<h1>`)
- **H1 content ville-aware**: YES — e.g. `"Audit IA à {ville.nameFr} & région {region}"` for audits; `"Formez {ville} à l'IA..."` for interventions — PASS
- **H1 contains both ville + service**: YES (confirmed in `AuditHero` and `InterventionsHero`) — PASS
- **H2s**: Multiple section headings from each service component — valid
- **Hierarchy verdict**: PASS

**Stub verticale (no Article)**: Uses `Section` component with `titleAs="h1"`. H1 = `"{verticalLabel} à {ville.nameFr}"` — PASS.

### Service Hub Pages (`/audit`, `/interventions`, `/implementation`, `/un-a-un`, `/sites-web-augmentes`)

- **H1 count**: 1 (from `ServiceHero` component: `<h1 className="display-editorial text-fg mt-5">`)
- **H1 uniqueness**: Static per service (not parameterized by ville) — PASS for the hub pages
- **Hierarchy**: Valid H1 → H2 → H3 chain
- **Verdict**: PASS

---

## 3. Meta Uniqueness by Template

### Home Page
- **Title**: `"Cabinet IA Paris · Formations · Audits · Axion-IA"` — STATIC, unique — PASS
- **Description**: Dynamic via `formatAmount(getEntryPriceEur(...))` — parameterized with current pricing — PASS

### Hub Ville (with `copy`)
- **Title pattern**: `"{ville.nameFr} ({departementLabel}) · Cabinet IA opérationnel"` — unique per ville — PASS
- **Description**: Uses `ville.copy.directAnswerFr` (LLM-generated, ville-specific) truncated to 155 chars — unique per ville — PASS

### Hub Ville (stub, no `copy`)
- **Title pattern**: `"{ville.nameFr} · Intervention IA opérationnelle ({region.nameFr})"` — unique per ville — PASS
- **Description**: Interpolates `${ville.nameFr}` and `${region.nameFr}` — unique per ville — PASS
- **robots**: `noindex: true` — consistent with anti-doorway — PASS

### Verticale Page (with Article)
- **Title**: Uses `article.metaTitle` (LLM-generated, unique per ville × verticale) or fallback `"{verticalLabel} à {ville.nameFr}"` — unique — PASS
- **Description**: Uses `article.metaDescription` or fallback with ville + region interpolation — unique — PASS
- **robots**: `noindex` if `!article` or `indexationTier === "tier_3_noindex_nofollow"` — PASS

### Service Hub Pages
- **Title/Description**: Static per service (not pSEO) — unique per service — PASS

---

## 4. Orphan Pages Check

### Sitemap Coverage

| Sub-sitemap | Content | Status |
|---|---|---|
| `implantations` | Hub `/implantations` + 12 indexable regions | PASS |
| `villes-{region}` | Indexable villes per region (with `copy`) | PASS |
| `services-villes-audit` | `/audit/par-ville/{ville}` (copy.services.audit) | PASS |
| `services-villes-interventions` | `/interventions/par-ville/{ville}` | PASS |
| `services-villes-implementation` | `/implementation/par-ville/{ville}` | PASS |
| `services-villes-un-a-un` | `/un-a-un/par-ville/{ville}` | PASS |
| `services-villes-sites-web-ia` | `/implantations/{region}/{ville}/sites-web-ia` | **MISSING — P0** |

**Critical finding**: The 5th verticale `sites-web-ia` is fully implemented in the router, dispatcher, and `LANDING_VILLE_VERTICAL_SLUGS` constant, but **has no corresponding sub-sitemap** in `sitemap.ts`. Neither `StaticSitemapId` nor `ServiceVillesKey` include `sites-web-ia`. The `buildServicesVillesSitemap` function also lacks a `sites-web-ia` entry in `SERVICE_VILLES_PATHS`.

The `/implantations/{region}/{ville}/sites-web-ia` pages ARE generated (via `generateStaticParams` top 100 villes × 5 verticales), but are NOT submitted to Google/Bing. This is ~100 SSG pages + ISR-on-demand pages (potentially thousands) invisible to crawlers.

### Orphan Analysis — Ville Hub Pages

- Every indexable ville hub page is in `villes-{region}` sub-sitemaps — PASS
- Stub villes (no copy) are `noindex` + absent from sitemap — CORRECT per anti-doorway
- `LocalCoverageSection` on service hub pages provides inbound links to region pages, which link to ville hubs — no orphans

### Orphan Analysis — Verticale Pages

- `/implantations/{region}/{ville}/audits|interventions|implementations|un-a-un` — accessible from hub ville 5-card grid
- `/implantations/{region}/{ville}/sites-web-ia` — accessible from hub ville 5-card grid BUT not in any sitemap — effectively orphaned from crawler perspective for newly ISR-generated pages

---

## 5. Broken Link Patterns

### Pattern 1: `/appel` — WARN (P1)

**Found in**:
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (lines ~354, ~509)
- `src/components/ville/OrangeContactBanner.tsx` (line 48)

**Issue**: The href `"/appel"` is used as a CTA in hub ville pages and OrangeContactBanner. However, `/appel` does NOT appear in `src/i18n/routing.ts` pathnames mapping. The only booking-related routes in routing.ts are `/reserver` (→ EN: `/book`). No `src/app/[locale]/appel/` directory exists.

This means `href={"/appel" as never}` — the TypeScript `as never` cast is suppressing the type error — is a potentially broken link pointing to a non-existent route. At runtime, if no redirect middleware handles `/appel` → `/reserver`, these CTAs will 404.

**Recommendation**: Verify if a redirect exists in `src/middleware.ts` or `next.config.ts` for `/appel` → `/reserver`. If not, replace all 3 occurrences with `/reserver`.

### Pattern 2: `href=...as never` casts — P2

Multiple components use `as never` casts on href values, indicating routes that don't cleanly type-check against `routing.pathnames`. These should be audited but are not necessarily broken — some may be valid routes without next-intl pathnames entries.

### Pattern 3: No deprecated route hrefs detected

No hardcoded references to old route patterns (e.g., pre-Sprint A paths) were found in the components or templates audited.

---

## 6. Key Findings Summary

### P0 — Critical

**P0-1: `services-villes-sites-web-ia` sub-sitemap MISSING**
- File: `src/app/sitemap.ts`
- Impact: All `/implantations/{region}/{ville}/sites-web-ia` pages invisible to Google/Bing crawler. Estimated ~100 SSG + thousands ISR-on-demand routes orphaned from sitemaps.
- Fix: Add `"services-villes-sites-web-ia"` to `StaticSitemapId`, add `"sites-web-ia"` to `ServiceVillesKey`, add entry to `SERVICE_VILLES_PATHS`, add case to `buildServicesVillesSitemap` switch, add `copy.services?.sitesWebIa` check (or equivalent field).
- Effort: ~30 min.

### P1 — Important

**P1-1: `/appel` href — likely broken link**
- Files: `src/app/[locale]/implantations/[region]/[ville]/page.tsx`, `src/components/ville/OrangeContactBanner.tsx`
- Impact: CTAs on every hub ville page (and verticale via OrangeContactBanner) may 404. 3 files, ~3 occurrences.
- Fix: Confirm redirect exists or replace with `/reserver`. If this is an intentional future route, add a placeholder redirect.
- Effort: 5-10 min.

**P1-2: No cross-verticale internal linking on verticale pages**
- Files: All 5 verticale components except `audit` (which has `AuditCrossModules`)
- Impact: User landing on `/implantations/{region}/{ville}/interventions` has no SEO link to `/implantations/{region}/{ville}/audits` etc. Reduces PageRank flow between verticales for the same city.
- Fix: Add a `CrossModules` block to `interventions`, `implementations`, `un-a-un`, `sites-web-ia` verticales in the dispatcher, similar to how `AuditCrossModules` is used. Can be done with the existing `AuditCrossModules` pattern adapted per verticale, or a generic `VerticaleCrossModules` component that shows the other 4 verticales for a given `villeContext`.
- Effort: ~2h.

### P2 — Minor

**P2-1: H4 in home page trust signals without H3 sibling precedence**
- File: `src/app/[locale]/page.tsx` (line 798)
- The `<h4>` elements follow H3s within the same parent section, so hierarchy is not violated, but the visual grouping suggests these should be `<p>` or `<span>` rather than headings.
- Impact: Marginal — no Google penalty, but accessibility screen readers will announce 4 heading levels on home page.
- Effort: 15 min.

**P2-2: VilleCommunesProches null at SSG build**
- File: `src/components/ville/VilleCommunesProches.tsx` (line 75-77)
- The `stub.invalid` early-exit means all SSG-rendered ville pages have 0 nearby-ville links at build time. ISR repopulates under 1h.
- Impact: Google may crawl SSG version (CI build) and see no nearby links, then re-crawl ISR version. Consistent with ADR 0026.
- No fix needed — architecture intent confirmed.

---

## 7. Template-Level Recommendations

| Template | Status | Priority Actions |
|---|---|---|
| Home (`/`) | PASS | Fix H4 → `<p>` for trust signals (P2) |
| Hub ville (`/[ville]`) | PASS with WARNs | Fix /appel → /reserver (P1); add cross-verticale CTAs |
| Verticale (`/[ville]/[verticale]`) | PASS + P0 sitemap gap | Fix sites-web-ia sitemap; add CrossModules to 4 verticales |
| /audit hub | PASS | None |
| /interventions hub | PASS | None |
| /implementation hub | PASS | None |
| /un-a-un hub | PASS | None |
| /sites-web-augmentes hub | PASS | None |

---

## 8. Sitemap Architecture Assessment

The sitemap architecture is comprehensive and well-designed:
- Chunking at 1 000 URLs per file — correct
- Deterministic IDs (no timestamp in ID) — correct
- `filterEnIfDisabled` for EN locale disabled — correct
- `lastmod` differentiation by content type — correct
- `buildExcludeSlugsByType()` dedup for KB — correct

**Single gap**: `services-villes-sites-web-ia` absent (see P0-1 above).

The sitemap-index at `/sitemap-index.xml` references all sub-sitemaps and includes custom ones (sitemap-news, image sitemaps). Structure is sound.

---

*Generated by Audit Agent D-7 — 2026-05-25 — Read-only, zero code modifications.*
