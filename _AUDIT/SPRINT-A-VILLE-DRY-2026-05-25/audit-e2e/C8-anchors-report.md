# C-8 Internal Anchors Report — Sprint A Ville DRY
**Date**: 2026-05-25
**Branch**: chore/pricing-update-2026-05-24
**Method**: code-level static analysis (read-only — zero modifications)
**Scope**: Home page, service components, ville pages, new Sprint A shared components

---

## Section IDs Found

| Component / Page | id value | Has anchor link (`href="#…"`) | In Speakable cssSelector | Notes |
|---|---|---|---|---|
| `src/app/[locale]/page.tsx` | `hero` | No direct `href="#hero"` found | Via `data-speakable-hero` attribute | Section + `aria-labelledby="hero-heading"` |
| `src/app/[locale]/page.tsx` | `hero-heading` | — (heading ref only) | `data-speakable-hero` on h1 | Used by `aria-labelledby` |
| `src/app/[locale]/page.tsx` | `services` | No | No | Section + `aria-labelledby="services-heading"` |
| `src/app/[locale]/page.tsx` | `services-heading` | — | No | Heading, used by `aria-labelledby` |
| `src/app/[locale]/page.tsx` | `clients` | No | No | `aria-label="Nos clients"` (no labelledby) |
| `src/app/[locale]/page.tsx` | `founder` | No | No | Section + `aria-labelledby="founder-heading"` |
| `src/app/[locale]/page.tsx` | `why` | No | No | Section + `aria-labelledby="why-heading"` |
| `src/app/[locale]/page.tsx` | `pricing` | No | No | Section + `aria-labelledby="pricing-heading"` |
| `src/app/[locale]/page.tsx` | `videos-heading` | — | No | Inline section (no section id, only heading id) |
| `src/app/[locale]/page.tsx` | `cases` | No | No | Section + `aria-labelledby="cases-heading"` |
| `src/app/[locale]/page.tsx` | `audience` | No | No | Section + `aria-labelledby="audience-heading"` |
| `src/app/[locale]/page.tsx` | `testimonials` | No | No | Section + `aria-labelledby="testimonials-heading"` |
| `src/app/[locale]/page.tsx` | `faq` | No | Via `buildFaqSpeakableJsonLd` default selector | Section + `aria-labelledby="faq-heading"` |
| `src/app/[locale]/blog/page.tsx` | `articles` | `href="#articles"` ✅ | No | Jump link in hero CTA |
| `src/app/[locale]/cas-concrets/page.tsx` | `cas` | `href="#cas"` ✅ | No | Jump link in hero CTA |
| `src/app/[locale]/comparaisons/page.tsx` | `comparaisons` | `href="#comparaisons"` ✅ | No | Jump link in hero CTA |
| `src/app/[locale]/contact/page.tsx` | `message` | `href="#message"` ✅ | No | Jump link in hero CTA |
| `src/app/[locale]/faq/page.tsx` | `index` | `href="#index"` ✅ | No | Jump link in hero CTA |
| `src/app/[locale]/guides/page.tsx` | `guides` | No | No | Section id only |
| `src/app/[locale]/presse/page.tsx` | `press-kit` | `href="#press-kit"` ✅ | No | In-page navigation link |
| `src/app/[locale]/presse/page.tsx` | `press-pitch` | No | Via `buildSpeakableSpecification` on boilerplate | Content element |
| `src/app/[locale]/presse/page.tsx` | `press-boilerplate` | No | `cssSelector` Speakable target | Content element |
| `src/app/[locale]/presse/page.tsx` | `banque-images` | No | No | Section |
| `src/app/[locale]/presse/page.tsx` | `communiques` | No | No | Section |
| `src/app/[locale]/presse/page.tsx` | `porte-parole` | No | No | Section |
| `src/app/[locale]/presse/page.tsx` | `temoignages-verifies` | No | No | Section |
| `src/app/[locale]/presse/page.tsx` | `couverture` | No | No | Section |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | `ville-hub-hero` | No | `data-speakable-hero` on `<p>` | Used as `aria-labelledby` target for outer section |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | `ville-verticales` | No | No | Section + `aria-labelledby="ville-verticales-heading"` |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | `ville-verticales-heading` | — | No | H2 heading |
| `src/app/[locale]/tarifs/page.tsx` | `audits` (dynamic) | `href="#audits"` ✅ | No | Jump nav in hero; dynamic from sections array |
| `src/app/[locale]/tarifs/page.tsx` | `formations` (dynamic) | `href="#formations"` ✅ | No | Jump nav |
| `src/app/[locale]/tarifs/page.tsx` | `un-a-un` (dynamic) | `href="#un-a-un"` ✅ | No | Jump nav |
| `src/app/[locale]/tarifs/page.tsx` | `implementations` (dynamic) | `href="#implementations"` ✅ | No | Jump nav |
| `src/app/[locale]/tarifs/page.tsx` | `plateforme` (dynamic) | `href="#plateforme"` ✅ | No | Jump nav |
| `src/components/sections/FaqBlock.tsx` | `axion-faq` | No direct href | Via `ville-service-jsonld.ts` `cssSelector: "#axion-faq"` | Core Speakable target for all VilleServicePageTemplate pages |
| `src/components/sections/VilleServicePageTemplate.tsx` | `axion-direct-answer` | No | `cssSelector: "#axion-direct-answer"` (conditional) | Only rendered if `directAnswer` prop provided |
| `src/components/sections/VilleServicePageTemplate.tsx` | `axion-faq-wrapper` | No | Backup comment (primary is `#axion-faq`) | Wrapper div around `<FaqBlock>` |
| `src/components/services/implementation/ImplementationCatalogFunctions.tsx` | `catalogue` | `ctaHref: "#catalogue"` ✅ | No | Used in `ImplementationPillarChoices` |
| `src/components/services/interventions/InterventionsFamiliesGrid.tsx` | `familles` | `href={"#familles"}` ✅ in `InterventionsHero` | No | Jump link in hero |
| `src/app/[locale]/layout.tsx` | `main` | `href="#main"` via `SkipToContent` ✅ | No | Skip-to-content a11y link |

**Sprint A new components** (`LocalGeoFaqSection`, `LocalCoverageSection`, `VilleServiceDetailSection`): **no section IDs defined** — these components have no `id=` attributes.

---

## Sticky Header Scroll Offset

**Status: MISSING** (P1)

- Header is `sticky top-0 z-40` (confirmed in `src/components/nav/Header.tsx` line 80)
- Header height: `h-20` (mobile) → `lg:h-24` (desktop) = **80px / 96px**
- `scroll-behavior: smooth` is set globally in `src/app/globals.css` (line 208)
- **No `scroll-margin-top`** found anywhere in:
  - `src/app/globals.css`
  - `src/app/admin.css`
  - Any `.tsx` component via Tailwind `scroll-mt-*` classes
- When a user clicks `href="#pricing"` or `href="#familles"`, the browser scrolls the target to the top of the viewport, but the sticky header (80–96px) covers it, hiding the section heading under the nav bar
- This affects **all 30+ anchor links** listed above

---

## Duplicate ID Risks

### Confirmed: No genuine duplicates on the same page

1. **`id="axion-faq"` in `FaqBlock` vs `id="faq"` in home page**: NOT a duplicate.
   - Home `page.tsx` uses its own inline `<section id="faq">` and does **NOT** import or use `FaqBlock`.
   - `FaqBlock` (which emits `id="axion-faq"`) is used on `contact`, `faq`, `presse`, `sections` pages only — each uses it exactly once.

2. **`id="axion-faq-wrapper"` vs `id="axion-faq"` coexistence**: Intended design.
   - `VilleServicePageTemplate` wraps `<FaqBlock>` in `<div id="axion-faq-wrapper">`, so the DOM has both `#axion-faq-wrapper` (outer div) and `#axion-faq` (inner `<section>` from FaqBlock). These are distinct IDs on the same page — no collision.
   - The Speakable JSON-LD in `ville-service-jsonld.ts` targets `#axion-faq`, which resolves correctly to the inner FaqBlock section.

3. **SVG `<defs>` IDs in `Section.tsx` vs HeroSchema components**: Low-risk but worth noting.
   - `Section.tsx`'s `PageHeroDecoration` emits `id="hero-halo-tc"`, `id="hero-grid"`, `id="hero-grid-mask"`, `id="hero-vignette-mask"` — only when `titleAs="h1"`.
   - Each HeroSchema component (`ImplementationHeroSchema`, `InterventionsHeroSchema`, `StackHeroSchema`, `VilleHeroSchema`) uses **distinct prefixed IDs** (`im-halo-*`, `iv-halo-*`, `sk-halo-*`, `vh-halo-*`).
   - None of these HeroSchema components are rendered on pages that also use `Section titleAs="h1"` (they have custom hero layouts). No SVG defs ID collision observed.
   - **Exception (P2)**: `comparaisons/[slug]/page.tsx` has two `Section titleAs="h1"` in source, but they are in a `ternary` expression — only one renders per request. Not a real duplicate.

4. **`id="videos-heading"` section (home page)**: The videos `<section>` has no `id` attribute — only the heading inside has `id="videos-heading"`. The section is also not referenced by `aria-labelledby`. Minor a11y gap (P2).

### Potential duplicate risk (P1): `id="axion-direct-answer"` drift

`VilleServicePageTemplate` conditionally renders `<div id="axion-direct-answer">` only if `directAnswer` prop is truthy. The Speakable JSON-LD in `ville-service-jsonld.ts` correctly gates `"#axion-direct-answer"` with the same condition (`...(directAnswer ? ["#axion-direct-answer"] : [])`). The parity is maintained — **no drift detected** at code-level.

---

## FAQ Anchor Navigation

| Location | Has section ID | Has anchor link to FAQ | Method |
|---|---|---|---|
| Home (`page.tsx`) | `id="faq"` | No external link | No jump link from hero to FAQ — user must scroll |
| `/blog` | `id="articles"` | `href="#articles"` in hero CTA ✅ | |
| `/faq` | `id="index"` | `href="#index"` in hero CTA ✅ | |
| `/contact` | `id="message"` | `href="#message"` in hero CTA ✅ | |
| `/tarifs` | `id="audits"` etc. | Full jump nav in hero ✅ | Best practice implemented |
| VilleServicePageTemplate | `id="axion-faq"` (via FaqBlock) | No direct link | FAQ reachable only by scroll |
| Service pages (`/audit`, `/interventions`, `/implementation`) | No section IDs | — | No in-page FAQ anchor nav |

**FaqAccordion**: Items use `AccordionItem value={item.id}` (not `id=` DOM attribute), so individual FAQ items have no anchor-linkable DOM IDs. This is by design (headless accordion pattern via Radix UI).

---

## Issues Found

### P1 — Sticky header hides scroll targets (no `scroll-margin-top`)

**Severity**: P1 — UX and a11y degradation on all pages with anchor links  
**Affected**: All 30+ `href="#…"` anchor links site-wide  
**Detail**: Header is `sticky top-0` at h-20 (80px mobile) / h-24 (96px desktop). No `scroll-margin-top` or `scroll-padding-top` applied to any section target. When the browser scrolls to `#pricing`, `#familles`, `#catalogue`, `#articles`, etc., the sticky header covers the section heading by 80–96px.  
**Fix**: Add to `src/app/globals.css`:
```css
[id] {
  scroll-margin-top: 5rem; /* 80px — mobile header height */
}
@media (min-width: 1024px) {
  [id] {
    scroll-margin-top: 6rem; /* 96px — desktop header height */
  }
}
```
Or, more targeted: add `scroll-mt-20 lg:scroll-mt-24` Tailwind class to each section element that has an `id` used as an anchor target.  
**Effort**: ~30 min (global CSS fix).

---

### P1 — `videos` section missing `id` for `aria-labelledby`

**Severity**: P1 — a11y gap  
**Location**: `src/app/[locale]/page.tsx` around line 1085  
**Detail**: The videos `<section>` has no `id` attribute and the heading inside has `id="videos-heading"`, but the `<section>` has no `aria-labelledby="videos-heading"`. Other sections (hero, services, founder, why, pricing, cases, audience, testimonials) all use `aria-labelledby` correctly. This section is the only one missing it.  
**Fix**: Add `id="videos"` and `aria-labelledby="videos-heading"` to the `<section>` element (around line 1085).  
**Effort**: ~5 min.

---

### P2 — Home page `#hero` through `#testimonials` section IDs have no in-page jump navigation

**Severity**: P2 — missed UX/SEO opportunity  
**Detail**: The home page defines 10+ section IDs (`hero`, `services`, `clients`, `founder`, `why`, `pricing`, `cases`, `audience`, `testimonials`, `faq`) but there are **no `href="#…"` links** pointing to any of them — not from the hero, not from a table of contents. The `/tarifs` page is the positive counterexample (full jump nav in hero CTA). Best practice for long landing pages is at minimum a sticky or hero-area nav with `href="#section"` links (improves AEO/scroll UX).  
**Fix**: Add a jump nav bar in the home hero or a sticky progress indicator linking to the main sections.  
**Effort**: ~2–4h.

---

### P2 — `#axion-faq-wrapper` ID referenced only in a comment, not in Speakable JSON-LD

**Severity**: P2 — documentation drift  
**Location**: `src/components/sections/VilleServicePageTemplate.tsx` line 430–433 + `src/lib/seo/ville-service-jsonld.ts` line 224  
**Detail**: The comment on `id="axion-faq-wrapper"` says it is a "backup Speakable cssSelector", but `ville-service-jsonld.ts` actually uses `"#axion-faq"` (the inner section from FaqBlock), NOT `"#axion-faq-wrapper"`. The wrapper div ID is unused in any Speakable or other JSON-LD selector. It could be removed or the comment corrected to avoid confusion.  
**Fix**: Either remove `id="axion-faq-wrapper"` (cleanup) or update the comment to accurately reflect that `#axion-faq-wrapper` is not currently used as a CSS selector anywhere.  
**Effort**: ~5 min.

---

### P2 — Sprint A new components (`LocalGeoFaqSection`, `LocalCoverageSection`) have no section IDs

**Severity**: P2 — no anchor linkability for FAQ and coverage sections added by Sprint A  
**Location**: `src/components/sections/LocalGeoFaqSection.tsx`, `src/components/sections/LocalCoverageSection.tsx`  
**Detail**: These two Sprint A components are rendered on service pages (`/audit`, `/interventions`, `/implementation`, `/un-a-un`) but have no `id` attribute on their root element, making them unreachable via anchor links. The FAQ section in particular would benefit from `id="local-faq"` or similar for potential in-page navigation and Speakable selector coverage.  
**Fix**: Add `id="local-geo-faq"` and `id="local-coverage"` to root elements with `aria-labelledby` referencing their heading.  
**Effort**: ~15 min.

---

### INFO — SVG `<defs>` IDs in `Section.tsx` are page-global but not conflicting

**Severity**: INFO (not P0/P1/P2)  
**Detail**: `Section.tsx`'s `PageHeroDecoration` emits SVG IDs `hero-halo-tc`, `hero-halo-pr`, `hero-grid`, `hero-grid-mask`, `hero-vignette-mask` as global DOM IDs. Because `PageHeroDecoration` only renders once per page (conditioned on `titleAs="h1"`) and no HeroSchema component uses the same prefix, there is no collision. However, if a future page ever renders two `Section titleAs="h1"` simultaneously (not in a ternary), these SVG IDs would duplicate and break the gradient rendering.

---

## Summary Table

| Check | Status | Count | Notes |
|---|---|---|---|
| Section IDs total (public pages, non-form) | 41 | Across 12+ pages | Includes heading IDs used by aria-labelledby |
| Anchor links with valid matching targets | 12/12 ✅ | 100% | All `href="#..."` links resolve to existing IDs |
| Speakable cssSelector coverage for IDs | Partial ✅ | 4 IDs in Speakable | `axion-faq`, `axion-direct-answer`, `press-boilerplate`, `data-speakable-hero` |
| IDs in kebab-case and descriptive | ✅ | 100% | All IDs follow kebab-case convention |
| `aria-labelledby` consistency | Partial ⚠️ | 9/10 sections on home | Videos section missing |
| Sticky header scroll offset | MISSING ❌ | — | No `scroll-margin-top` anywhere |
| Duplicate IDs on same page | None confirmed ✅ | — | `axion-faq-wrapper` + `axion-faq` coexist intentionally |
| FAQ accordion item anchor IDs | None (by design) | — | Radix AccordionItem `value` ≠ DOM `id` |
| Sprint A new components with IDs | 0 of 3 ⚠️ | — | `LocalGeoFaqSection`, `LocalCoverageSection`, `VilleServiceDetailSection` have no section IDs |

---

## Verdict: **GO with conditions**

The audit is **GO** — no P0 issues found. All `href="#"` anchor links correctly resolve to existing `id` targets. No duplicate IDs exist on the same rendered page. Speakable JSON-LD selectors match their DOM targets (`#axion-faq`, `#axion-direct-answer`).

**Blocking for scroll UX quality (P1 — recommend fixing before next deploy)**:
1. Missing `scroll-margin-top` on all anchor targets — sticky header hides content (~30 min fix)
2. Videos section missing `aria-labelledby` (~5 min fix)

**Non-blocking improvements (P2)**:
3. Home page sections have no jump navigation links
4. `id="axion-faq-wrapper"` comment is misleading
5. Sprint A new components (`LocalGeoFaqSection`, `LocalCoverageSection`) have no anchor IDs

**Files involved in P1 fix**:
- `src/app/globals.css` — add `scroll-margin-top` global rule
- `src/app/[locale]/page.tsx` (line ~1085) — add `id="videos"` + `aria-labelledby="videos-heading"` to the videos `<section>`
