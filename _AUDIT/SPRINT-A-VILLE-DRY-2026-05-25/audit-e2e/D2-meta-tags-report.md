# D2 — Meta Tags Audit Report
**Sprint A · Ville DRY 2026-05-25 — Audit Agent D-2**
**Date**: 2026-05-25
**Scope**: Static code audit — 11 key templates across `src/app/[locale]/`
**Mode**: Read-only, zero code modification

---

## Executive Summary

| Field | Pass Rate | Critical Issues |
|---|---|---|
| has-title | 10/11 (91%) | Admin layout has no title (acceptable) |
| title-length (30-60 chars final) | 6/10 (60%) | 4 templates produce titles > 60 chars |
| has-description | 9/11 (82%) | Admin has no description (acceptable) |
| desc-length (140-158 chars) | 3/10 (30%) | Most descriptions are too long or too short |
| has-canonical | 9/11 (82%) | Admin correctly has no canonical |
| has-og (full) | 9/11 (82%) | Root layout OG incomplete (no image/title/desc) |
| robots-correct | 11/11 (100%) | All pages have correct robots setting |

**Overall score: ~71% pass rate** — 2 CRITICAL bugs, multiple P1 issues.

---

## SSOT: `buildProductMetadata` (src/lib/seo.ts)

All public pages use `buildProductMetadata()` which centrally provides:
- `alternates.canonical`: `/{locale}{path}` (normalized, no trailing slash) — **CORRECT**
- `alternates.languages`: `fr: /fr{path}`, `x-default: /fr{path}` (EN omitted when EN disabled via `isEnLocaleDisabled()`) — **CORRECT**
- `openGraph`: type/locale/url/title/description/siteName/images (1200×630 with `/api/og` dynamic fallback) — **CORRECT**
- `twitter`: card=summary_large_image/title/description/images — **CORRECT**
- `robots`: index:true follow:true — **CORRECT**

The factory is well-designed. Issues arise from callers passing non-compliant title/description strings.

---

## Root Layout (`src/app/[locale]/layout.tsx`)

```
generateMetadata returns:
  title: { default: 'Axion-IA — Cabinet IA opérationnel', template: '%s · Axion-IA' }
  description: 'Cabinet IA opérationnel · interventions, audit et implémentation IA pour entreprises.'
  alternates.canonical: '/{locale}'
  alternates.languages: { fr: '/fr', en: '/en', 'x-default': '/fr' }
  openGraph: { type: 'website', locale: 'fr_FR', url: '{SITE_URL}/{locale}', siteName: 'Axion-IA' }
  twitter: { card: 'summary_large_image' }
  robots: { index: true, follow: true }
```

**Issues:**
- P1: `alternates.languages` includes `en: '/en'` even though EN is disabled. At runtime, proxy.ts issues 301s for `/en/*`, so crawlers who follow this hreflang hit a 301. Not a hard SEO error (301 is handled) but technically incorrect for disabled locale.
- P1: Root OG block is missing `og:title`, `og:description`, and `og:image`. These defaults are inherited by child pages via Next.js metadata merging, but the root layout itself would render without them if a page returns empty metadata.
- P2: Default description is 85 chars — below the 140-char target. This shows on pages where no child `generateMetadata` is defined.
- INFO: `template: '%s · Axion-IA'` — works correctly for pages that do NOT include "Axion-IA" in their title string. **CRITICAL bug when pages already include brand (see below).**

---

## CRITICAL Bug: Double Axion-IA in Title

**Affected files:**
- `src/app/[locale]/page.tsx` (home)
- `src/app/[locale]/audit/page.tsx`

**Problem:** These pages pass a plain string containing "Axion-IA" to `buildProductMetadata`, which returns `{ title: 'Foo · Axion-IA' }`. Next.js then applies the root layout template `'%s · Axion-IA'`, producing:

```
Final title: "Cabinet IA Paris · Formations · Audits · Axion-IA · Axion-IA"  [60 chars]
Final title: "Audit IA PME & ETI · 4 niveaux · Flash dès 890 € · Axion-IA · Axion-IA"  [70+ chars]
```

**Only one page handles this correctly:** `implantations/[region]/[ville]/[verticale]/page.tsx` uses `title: { absolute: titleWithBrand }` to bypass the template when the LLM-generated title already contains "Axion-IA". This pattern should be applied to home and audit pages.

**Fix (read-only recommendation):** In `page.tsx` (home) and `audit/page.tsx`, either:
1. Remove "Axion-IA" from the title string and let the template add it: `'Cabinet IA Paris · Formations · Audits'` → renders as `'Cabinet IA Paris · Formations · Audits · Axion-IA'`
2. Or use `title: { absolute: 'Cabinet IA Paris · Formations · Audits · Axion-IA' }` to bypass the template.

---

## Template-by-Template Analysis

### 1. Home Page (`src/app/[locale]/page.tsx`)
- **title**: `'Cabinet IA Paris · Formations · Audits · Axion-IA'` (49 chars in code)
- **Final rendered title**: `'Cabinet IA Paris · Formations · Audits · Axion-IA · Axion-IA'` (60 chars) — CRITICAL DOUBLE BRAND
- **description**: Dynamic (~188 chars) — exceeds 158-char limit
- **canonical**: YES via `buildProductMetadata`
- **alternates.languages**: FR + x-default only (correct, EN disabled)
- **OG**: Full set via `buildProductMetadata`
- **Twitter**: Full set via `buildProductMetadata`
- **robots**: index:true follow:true — correct
- **Verdict**: FAIL — 2 issues (double brand + desc too long)

### 2. Audit Hub (`src/app/[locale]/audit/page.tsx`)
- **title**: `'Audit IA PME & ETI · 4 niveaux · Flash dès {price} · Axion-IA'` (~59 chars in code, dynamic)
- **Final rendered title**: ~70 chars with double Axion-IA — CRITICAL DOUBLE BRAND
- **description**: ~180 chars — exceeds 158-char limit
- **canonical**: YES via `buildProductMetadata`
- **OG/Twitter**: Full set
- **robots**: index:true follow:true — correct
- **Verdict**: FAIL — 2 issues (double brand + desc too long)

### 3. Interventions Hub (`src/app/[locale]/interventions/page.tsx`)
- **title**: `'Interventions IA en entreprise · 4 familles · France & international'` (69 chars in code)
- **Final rendered title**: `'Interventions IA en entreprise · 4 familles · France & international · Axion-IA'` (79 chars) — exceeds 70-char soft cap
- **description**: ~220 chars (dynamic with price) — significantly exceeds 158-char limit
- **canonical**: YES
- **OG/Twitter**: Full set
- **robots**: index:true follow:true — correct
- **Verdict**: FAIL — 2 issues (title too long + desc too long)

### 4. Implantations Hub (`src/app/[locale]/implantations/page.tsx`)
- **title**: `'Implantations · Cabinet IA opérationnel partout en France'` (57 chars) → 68 chars with template
- **Final rendered title**: 68 chars — borderline OK (under 70)
- **description**: `'Axion-IA intervient sur site dans 12 régions et plus de 2 150 communes françaises...'` (166 chars) — marginally over 158
- **canonical**: YES
- **OG/Twitter**: Full set
- **robots**: index:true follow:true — correct
- **Verdict**: PASS with minor issues — desc 8 chars over limit

### 5. Region Page (`src/app/[locale]/implantations/[region]/page.tsx`)
- **title**: Dynamic `'{region.nameFr} · Cabinet IA opérationnel'` → ~39-50 chars + template = ~50-61 chars
- **Final rendered title**: Variable — depends on region name length. Short regions (e.g. "PACA") produce 50-char titles. Long regions may exceed 60.
- **description**: Uses `region.pitchFr` — length not bounded in code
- **canonical**: YES via `buildProductMetadata` with correct FR/EN alternates
- **OG/Twitter**: Full set
- **robots**: CONDITIONAL — `{ index: false, follow: true }` if `region.noindex=true`, else `index:true follow:true` — correct
- **Verdict**: CONDITIONAL PASS — description length uncontrolled (depends on content authoring)

### 6. Ville Hub (`src/app/[locale]/implantations/[region]/[ville]/page.tsx`) — SPRINT A NEW
- **title**: Two variants:
  - Pilot (with copy): `'{ville.nameFr} ({deptLabel}) · Cabinet IA opérationnel'` → ~47-58 chars + template = ~58-69 chars — OK
  - Stub (no copy): `'{ville.nameFr} · Intervention IA opérationnelle ({region.nameFr})'` → ~54 chars + template = ~65 chars — OK
- **description**:
  - Pilot: Uses `ville.copy.directAnswerFr` truncated to 155 chars via `truncateForSerp()` — CORRECT
  - Fallback: `'Axion-IA intervient à {ville} ({region})...'` — hardcoded ~171 chars — **exceeds 158**
- **canonical**: YES via `buildProductMetadata`
- **alternates.languages**: FR + x-default only (no EN — correct)
- **OG/Twitter**: Full set
- **robots**: `{ index: false, follow: true }` for stubs (no copy) — correct anti-doorway pattern
- **uniqueness**: YES — each ville produces a unique title via `ville.nameFr`
- **Verdict**: NEAR PASS — fallback description 171 chars exceeds limit (13 chars over)

### 7. Ville Verticale (`src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx`) — SPRINT A NEW
- **title**: 
  - LLM article metaTitle (preferred): uses `{ absolute: titleWithBrand }` — CORRECT pattern
  - Fallback: `'{verticalLabel} à {ville.nameFr}'` → ~29 chars + brand = ~40 chars — OK
- **description**:
  - LLM article metaDescription (preferred): uncontrolled length
  - Fallback: `'Axion-IA propose {label} à {ville} ({region})...'` → ~140 chars — borderline
- **canonical**: YES via `buildProductMetadata`
- **alternates.languages**: FR + x-default only (no EN — correct, no alternates passed)
- **OG/Twitter**: Full set
- **robots**: `{ index: false, follow: true }` if no article or tier_3 — correct
- **uniqueness**: YES — unique per ville × verticale combination
- **Verdict**: GOOD — best-practice title handling (`absolute` bypass); minor risk on LLM-generated description lengths

### 8. Blog Post (`src/app/[locale]/blog/[slug]/page.tsx`)
- **title**: Uses `article.metaTitle ?? article.title` — length uncontrolled, depends on DB content
- **description**: Uses `article.metaDescription ?? article.excerpt` — length uncontrolled
- **canonical**: YES via `buildProductMetadata`
- **OG/Twitter**: Full set
- **robots**: Tiered (tier-1: index, tier-2: noindex follow, tier-3: noindex nofollow) — correct
- **uniqueness**: YES — slug-based
- **Verdict**: CONDITIONAL — quality depends on content pipeline enforcing length limits

### 9. VilleServicePageTemplate (par-ville pages: audit/interventions/implementation/un-a-un)
- **title**: 
  - hasCopy: `'{serviceName} à {ville} ({dept})'` → ~43 chars with template — OK
  - No copy: `'{serviceName} à {ville} — disponible sur devis'` → ~39 chars with template — OK
- **description**:
  - hasCopy: `serviceCopy.fr.hero.slice(0, 157) + '…'` — max 158 chars — CORRECT
  - No copy: Hardcoded ~133 chars — **below 140-char minimum**
- **canonical**: YES via `buildProductMetadata`
- **OG/Twitter**: Full set
- **robots**: `{ index: false, follow: true }` if !hasCopy — correct anti-doorway pattern
- **uniqueness**: YES — ville slug ensures uniqueness
- **Verdict**: NEAR PASS — no-copy fallback description 133 chars under 140-char minimum

### 10. Admin Layout (`src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`)
- **metadata**: `export const metadata: Metadata = { robots: { index: false, follow: false } }`
- **title**: Not set (inherits layout default) — acceptable for admin
- **description**: Not set — acceptable for admin
- **canonical**: Not set — acceptable for admin
- **OG**: Not set — acceptable for admin
- **robots**: `{ index: false, follow: false }` — CORRECT (noindex + nofollow)
- **Verdict**: PASS — deliberately minimal, covers all 109+ child admin pages

---

## Title Uniqueness Analysis

All public templates generate unique titles via dynamic segments (ville.nameFr, region.nameFr, verticale, slug). No templates produce identical titles across different routes.

**Risk of near-collision**: Stub villes (no copy) all follow the pattern `'{ville} · Intervention IA opérationnelle ({region})'`. This is semantically correct for each page but the template string is shared. Since villes are geographically distinct, collision is impossible.

---

## hreflang Audit

| Context | Status | Notes |
|---|---|---|
| Root layout | ISSUE | Declares `en: '/en'` despite EN being disabled (proxy 301). Technically incorrect but handled at runtime. |
| `buildProductMetadata` | CORRECT | EN hreflang omitted when `isEnLocaleDisabled()` returns true |
| Region page | CORRECT | Passes explicit `alternates: { fr: '...', en: '...' }` to `buildProductMetadata` which respects EN flag |
| Ville hub | CORRECT | Only FR + x-default set |
| Ville verticale | CORRECT | Only FR + x-default set |
| VilleServiceTemplate | CORRECT | Both `pathFr` and `pathEn` passed, but EN omitted when disabled |

---

## Robots / Indexation

All anti-doorway HCU 2024 patterns are correctly implemented:

| Condition | robots setting | Correct? |
|---|---|---|
| Public page with full copy | `index: true, follow: true` | YES |
| Ville stub (no editorial copy) | `index: false, follow: true` | YES |
| Ville verticale (no LLM article) | `index: false, follow: true` | YES |
| Blog tier-2 | `index: false, follow: true` | YES |
| Blog tier-3 | `index: false, follow: false` | YES |
| Blog tombstone | `index: false, follow: false` | YES |
| Admin all pages | `index: false, follow: false` | YES |

---

## Issues Summary by Priority

### CRITICAL (P0)

| ID | Template | Issue | Fix |
|---|---|---|---|
| D2-P0-1 | `page.tsx` (home) | Title `'...· Axion-IA'` + layout template = double brand: `'... · Axion-IA · Axion-IA'` (60 chars) | Remove brand from title string OR use `title: { absolute: '...' }` |
| D2-P0-2 | `audit/page.tsx` | Same double brand issue (~70 chars with duplicate) | Same fix as above |

### HIGH (P1)

| ID | Template | Issue | Fix |
|---|---|---|---|
| D2-P1-1 | `page.tsx` (home) | Description ~188 chars — exceeds 158-char limit (Google truncates at ~155-160) | Shorten to ≤ 155 chars |
| D2-P1-2 | `audit/page.tsx` | Description ~180 chars — exceeds 158-char limit | Shorten to ≤ 155 chars |
| D2-P1-3 | `interventions/page.tsx` | Title 79 chars (with template) — exceeds 60-char target | Shorten title text before passing |
| D2-P1-4 | `interventions/page.tsx` | Description ~220 chars — significantly exceeds 158-char limit | Shorten description |
| D2-P1-5 | `implantations/[region]/[ville]/page.tsx` (ville hub) | Fallback description 171 chars — exceeds 158 | Shorten fallback string to ≤ 155 chars |
| D2-P1-6 | `VilleServicePageTemplate.tsx` | No-copy fallback description ~133 chars — below 140-char minimum | Extend fallback description or lower threshold to 130 |

### MEDIUM (P2)

| ID | Template | Issue |
|---|---|---|
| D2-P2-1 | Root layout `layout.tsx` | `alternates.languages.en` present despite EN disabled. Signals incorrect alternate to crawlers. |
| D2-P2-2 | Root layout `layout.tsx` | Default description only 85 chars — below 140-char target |
| D2-P2-3 | `implantations/page.tsx` | Description 166 chars (8 chars over limit) |
| D2-P2-4 | `blog/[slug]/page.tsx` | No length enforcement on DB-sourced metaTitle/metaDescription — relies on content pipeline |
| D2-P2-5 | Region page | `region.pitchFr` description length uncontrolled (no truncation in generateMetadata) |

---

## Pass Rate Summary

```
Title present:                    10/11 = 91%  (admin excluded)
Title length OK (30-60):           6/10 = 60%  (4 templates have length issues)
Description present:               9/11 = 82%  (admin excluded)
Description length OK (140-158):   3/10 = 30%  (most too long or too short)
Canonical present:                 9/11 = 82%  (admin excluded)
hreflang correct (FR + x-default): 9/11 = 82%  (root layout EN issue)
OG full set:                       9/11 = 82%  (admin excluded)
Twitter full set:                  9/11 = 82%  (admin excluded)
Robots correct:                   11/11 = 100% 
Uniqueness per template:           10/10 = 100%
```

**Aggregate pass rate: ~79%**

---

## Files Audited

- `src/app/[locale]/layout.tsx` — root locale layout
- `src/app/[locale]/page.tsx` — home
- `src/app/[locale]/audit/page.tsx`
- `src/app/[locale]/interventions/page.tsx`
- `src/app/[locale]/implantations/page.tsx`
- `src/app/[locale]/implantations/[region]/page.tsx`
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (**Sprint A new**)
- `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` (**Sprint A new**)
- `src/app/[locale]/blog/[slug]/page.tsx`
- `src/app/[locale]/interventions/par-ville/[ville]/page.tsx` → delegates to `VilleServicePageTemplate`
- `src/app/[locale]/audit/par-ville/[ville]/page.tsx` → delegates to `VilleServicePageTemplate`
- `src/components/sections/VilleServicePageTemplate.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`
- `src/lib/seo.ts` — `buildProductMetadata` factory (SSOT)
