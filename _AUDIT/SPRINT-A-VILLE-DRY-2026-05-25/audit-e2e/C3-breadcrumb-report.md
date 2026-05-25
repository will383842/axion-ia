# C-3 Breadcrumb Report
## Sprint A · Ville DRY — Post-audit E2E
**Date**: 2026-05-25  
**Method**: Code-level static analysis (read-only)  
**Scope**: Breadcrumb components + all page types using them

---

## Breadcrumb Components Found

### 1. `src/components/nav/Breadcrumbs.tsx` — Public-facing (Server Component)
- **Props**: `items: ReadonlyArray<{href, label}>`, `emitJsonLd?: boolean` (default `true`)
- **Behaviour**: Auto-prepends `Home` item from `t("breadcrumb.home")` i18n key
- **JSON-LD**: Delegates to `buildBreadcrumbJsonLd()` from `src/lib/seo.ts`; can be disabled via `emitJsonLd={false}` for pages that consolidate JSON-LD into a single `@graph`
- **ARIA**: `<nav aria-label={t("breadcrumb.ariaLabel")}>` — FR: "Fil d'Ariane", EN: "Breadcrumb"
- **`aria-current="page"`**: Applied on last `<li>` via `<span aria-current="page">`
- **Separator**: `/` with `aria-hidden="true"`

### 2. `src/components/admin/ui/AdminBreadcrumbs.tsx` — Admin-only (Server Component)
- **Props**: `items: ReadonlyArray<{label, href?}>`, `truncate?: number` (default 5)
- **Behaviour**: No auto-Home; collapse middle items when > truncate length
- **ARIA**: `<nav aria-label="Fil d'Ariane">` (hardcoded FR string — not i18n)
- **`aria-current="page"`**: Applied on last item
- Out of scope for this Sprint A ville audit (admin routes only)

---

## `buildBreadcrumbJsonLd` Factory (`src/lib/seo.ts`, line 329)

```
export function buildBreadcrumbJsonLd({ locale, items }) {
  // @id = leaf URL + "#breadcrumb" (links BreadcrumbList to WebPage via breadcrumb ref)
  itemListElement: items.map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: item.name,
    item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
  }))
}
```

**Important**: The `Breadcrumbs` component auto-adds Home, then passes ALL items (including Home) to `buildBreadcrumbJsonLd`. Pages using `emitJsonLd={false}` and calling `buildBreadcrumbJsonLd` manually do NOT auto-add Home in their JSON-LD unless they include it explicitly.

---

## Page Types with Breadcrumbs

| Page type | Component / File | `emitJsonLd` | Separate JSON-LD BreadcrumbList? |
|-----------|-----------------|-------------|----------------------------------|
| `/implantations` (hub national) | `src/app/.../implantations/page.tsx` | `true` (default) | None explicit — relies on component |
| `/implantations/[region]` | `src/app/.../implantations/[region]/page.tsx` | `true` (default) | None explicit — relies on component |
| `/implantations/[region]/[ville]` (hub ville, with copy) | `src/app/.../implantations/[region]/[ville]/page.tsx` | `false` | Yes — manual in `JsonLdGraph @graph` |
| `/implantations/[region]/[ville]` (VilleStub, no copy) | Same file — `VilleStub` component | `true` (default) | None — relies on component |
| `/implantations/[region]/[ville]/[verticale]` (with article) | `src/app/.../implantations/[region]/[ville]/[verticale]/page.tsx` | `false` | Yes — manual in `JsonLdGraph @graph` |
| `/implantations/[region]/[ville]/[verticale]` (stub, no article) | Same file | `true` (default) | None — relies on component |
| `/audit` | `src/app/.../audit/page.tsx` | `true` (default) | None — relies on component |
| `/blog`, `/blog/categorie/[slug]`, `/blog/tag/[slug]`, etc. | Various blog pages | `true` (default) | None — relies on component |
| `VilleServicePageTemplate` (legacy `/audit/par-ville/[ville]` etc.) | `src/components/sections/VilleServicePageTemplate.tsx` | `true` (default) | Yes — via `buildVilleServiceJsonLdGraph` in JsonLdGraph |

---

## Breadcrumb Structure Per Page Type

| Page type | Visual levels (Home auto-added) | JSON-LD levels | JSON-LD synced? | Notes |
|-----------|--------------------------------|---------------|-----------------|-------|
| `/implantations` | Home > Implantations | Home > Implantations | SYNC | 1-item passed; Home auto-added by component |
| `/implantations/[region]` | Home > Implantations > {Region} | Home > Implantations > {Region} | SYNC | 2 items passed; Home auto-added by component |
| `/implantations/[region]/[ville]` (with copy) | Home > Implantations > {Region} > {Ville} | **Implantations > {Region} > {Ville}** (no Home) | **MISMATCH** | `emitJsonLd={false}` + manual JSON-LD missing Home; component has 4 levels, JSON-LD has 3 |
| `/implantations/[region]/[ville]` (VilleStub) | Home > Implantations > {Region} > {Ville} | Home > Implantations > {Region} > {Ville} | SYNC | `emitJsonLd=true`; component auto-adds Home |
| `/implantations/[region]/[ville]/[verticale]` (with article) | Home > Implantations > {Region} > {Ville} > {Verticale} | **Implantations > {Region} > {Ville} > {Verticale}** (no Home) | **MISMATCH** | `emitJsonLd={false}` + manual JSON-LD missing Home; component has 5 levels, JSON-LD has 4 |
| `/implantations/[region]/[ville]/[verticale]` (stub) | Home > Implantations > {Region} > {Ville} > {Verticale} | Home > Implantations > {Region} > {Ville} > {Verticale} | SYNC | `emitJsonLd=true`; component auto-adds Home |
| `/audit` | Home > Audit IA | Home > Audit IA | SYNC | 1-item passed; component auto-adds Home |
| `/blog` | Home > Blog | Home > Blog | SYNC | |
| `/blog/categorie/[slug]` | Home > Blog > {Category} | Home > Blog > {Category} | SYNC | |
| `VilleServicePageTemplate` (/audit/par-ville/[ville]) | Home > {Service} > {Service} à {Ville} | Home > Accueil > {Service} > {Service} à {Ville} | **MISMATCH** | `buildVilleServiceJsonLdGraph` explicitly adds `{ name: "Accueil"/"Home", href: "/" }` in JSON-LD **but** component also auto-adds Home → JSON-LD has Home at position 1 from `buildBreadcrumbJsonLd`, while visual has only 3 levels (Home auto + 2 items). Actually these are different paths — see detail below. |

### Detail: `VilleServicePageTemplate` breadcrumb

In `VilleServicePageTemplate.tsx`, `breadcrumbItems` is:
```
[
  { href: meta.canonical, label: isFr ? meta.nameFr : meta.nameEn },  // e.g. "/audit"
  { href: `${meta.pathFr}/${ville.slug}`, label: "Audit IA à Paris" }
]
```
Visual rendering (via `<Breadcrumbs items={breadcrumbItems} />`): Home > Audit IA > Audit IA à Paris (3 levels)

The `buildVilleServiceJsonLdGraph` calls `buildBreadcrumbJsonLd` with:
```
items: [
  { name: "Accueil"/"Home", href: "/" },
  { name: serviceNameFr/En, href: serviceCanonical },
  { name: "Audit IA à Paris", href: path }
]
```
JSON-LD: Home > Audit IA > Audit IA à Paris (3 levels — matches)

However, the visual `<Breadcrumbs>` with `emitJsonLd=true` also emits its OWN BreadcrumbList (via `buildBreadcrumbJsonLd` with Home auto-prepended). This means **TWO BreadcrumbList scripts are emitted on VilleServicePageTemplate pages**: one from the `<Breadcrumbs>` component (inline `<script>`), one from `<JsonLdGraph>` (afterInteractive). This is a **P1 duplicate JSON-LD** issue.

---

## ARIA Attributes

| Attribute | Public `Breadcrumbs` | Admin `AdminBreadcrumbs` |
|-----------|---------------------|--------------------------|
| `aria-label` on `<nav>` | PASS — i18n: "Fil d'Ariane" (FR) / "Breadcrumb" (EN) | PASS — hardcoded "Fil d'Ariane" (not i18n) |
| `aria-current="page"` on last item | PASS — `<span aria-current="page">` on last item | PASS — `<span aria-current={isLast ? "page" : undefined}>` |
| `aria-hidden` on separator | PASS — `<span aria-hidden="true">/</span>` | PASS — `<span aria-hidden="true">›</span>` |

**ARIA overall: PASS** for public `Breadcrumbs`. `AdminBreadcrumbs` has hardcoded FR-only `aria-label` (not i18n), acceptable since admin is FR-only.

---

## Issues Found

### P1 — Missing `Home` item in JSON-LD BreadcrumbList on `/implantations/[region]/[ville]` pages (with copy)

**File**: `src/app/[locale]/implantations/[region]/[ville]/page.tsx`, lines 281–288  
**Problem**: The manual `buildBreadcrumbJsonLd` call omits the Home level:
```js
items: [
  { name: "Implantations", href: "/implantations" },  // position 1
  { name: region.nameFr, href: `/implantations/${region.slug}` },  // position 2
  { name: ville.nameFr, href: path },  // position 3
]
```
Visual breadcrumb (rendered by `<Breadcrumbs emitJsonLd={false}>`) renders 4 levels: **Home > Implantations > {Region} > {Ville}**.  
JSON-LD BreadcrumbList has only 3 levels, starting at "Implantations".  
Google Rich Results validator expects position 1 to be the homepage for maximum schema completeness. Missing `Home` is not an error per se (Google accepts partial trails) but creates a drift between what the user sees and what Google parses.

**Same issue on**: `/implantations/[region]/[ville]/[verticale]` (with article), lines 361–369 — JSON-LD has 4 levels (missing Home), visual has 5.

**Severity**: P1 — SEO structural mismatch, not a hard error, but reduces rich result reliability.

---

### P1 — Duplicate BreadcrumbList JSON-LD on `VilleServicePageTemplate` pages

**File**: `src/components/sections/VilleServicePageTemplate.tsx`  
**Problem**: 
1. `<Breadcrumbs items={breadcrumbItems} />` uses default `emitJsonLd=true` → emits a BreadcrumbList `<script>` inline
2. `buildVilleServiceJsonLdGraph(...)` (called on line ~309) also builds a BreadcrumbList → emitted via `<JsonLdGraph strategy="afterInteractive">`

Result: **two BreadcrumbList schemas** on every `/audit/par-ville/[ville]`, `/interventions/par-ville/[ville]`, `/implementation/par-ville/[ville]`, `/un-a-un/par-ville/[ville]` pages. Google may ignore the duplicate or flag it as structured data warning.

**Fix**: Pass `emitJsonLd={false}` to `<Breadcrumbs>` in `VilleServicePageTemplate.tsx` (line 254 and line 337), since `buildVilleServiceJsonLdGraph` already handles BreadcrumbList emission.

---

### P2 — `AdminBreadcrumbs` `aria-label` not i18n

**File**: `src/components/admin/ui/AdminBreadcrumbs.tsx`, line 32  
**Problem**: `aria-label="Fil d'Ariane"` is hardcoded FR. Not an issue since admin UI is FR-only currently, but if admin ever goes bilingual this would need updating.  
**Severity**: P2 — cosmetic / future-proof concern.

---

### P2 — EN locale `ariaLabel` value inconsistency

**File**: `src/messages/en.json`, line 297  
**Problem**: EN value is `"Breadcrumb"` (generic) vs FR's `"Fil d'Ariane"` (idiomatic). This is acceptable per W3C (both are semantically valid) but the EN value could be improved to `"Breadcrumb navigation"` for screen reader clarity.  
**Severity**: P2 — accessibility improvement only.

---

## Summary Table

| Check | Result |
|-------|--------|
| Breadcrumb component found and readable | PASS |
| `aria-label="Fil d'Ariane"` / `"Breadcrumb"` on `<nav>` | PASS |
| `aria-current="page"` on last item | PASS |
| `aria-hidden` on separators | PASS |
| Home level: visual rendering | PASS (auto-added by component) |
| Home level: JSON-LD on hub ville (with copy) | **FAIL** — Home missing from JSON-LD |
| Home level: JSON-LD on verticale (with article) | **FAIL** — Home missing from JSON-LD |
| Home level: JSON-LD on VilleStub / verticale stub / audit / blog | PASS (emitJsonLd=true, component auto-adds) |
| JSON-LD/visual sync on hub ville (with copy) | **MISMATCH** — P1 |
| JSON-LD/visual sync on verticale (with article) | **MISMATCH** — P1 |
| No duplicate BreadcrumbList on standard pages | PASS |
| No duplicate BreadcrumbList on VilleServicePageTemplate | **FAIL** — duplicate emission — P1 |
| Correct levels: Hub nationale `/implantations` | PASS (Home > Implantations) |
| Correct levels: Hub région | PASS (Home > Implantations > Region) |
| Correct levels: Hub ville (full) | PASS visual, FAIL JSON-LD |
| Correct levels: Verticale ville (full) | PASS visual, FAIL JSON-LD |
| Correct levels: Audit service page | PASS |
| Correct levels: Blog pages | PASS |

---

## Verdict: NOGO (conditional)

**Critical path**: The breadcrumb visual rendering is correct across all 2150+ ville pages. ARIA is correct. JSON-LD has two P1 issues affecting SEO structured data quality:

1. **P1-A** — Home item missing from manual `buildBreadcrumbJsonLd` calls on hub ville (with copy) and verticale (with article) pages. Affects ~N pages where `ville.copy` exists (currently pilot pages + future indexed pages). Fix: add `{ name: isFr ? "Accueil" : "Home", href: "/" }` as first item in both manual JSON-LD calls.

2. **P1-B** — Duplicate BreadcrumbList on all `VilleServicePageTemplate` pages (4 legacy services × 39+ pilot villes). Fix: add `emitJsonLd={false}` to `<Breadcrumbs>` calls in `VilleServicePageTemplate.tsx` (lines 254 and 337).

**GO** after fixing P1-A and P1-B (estimated 15 min combined, 2 files touched).  
P2 issues are informational and do not block.
