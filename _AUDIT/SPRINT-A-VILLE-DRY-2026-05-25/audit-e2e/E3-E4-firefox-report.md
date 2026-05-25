# E-3+E-4 Firefox Compatibility Report
## Sprint A — 36 new React components (services + ville)
## Date: 2026-05-25
## Method: code-level static analysis (read-only, zero code modification)

---

## Stack versions

| Package | Version | Firefox support |
|---|---|---|
| Next.js | 16.2.6 | Full (SSR/SSG output is standard HTML) |
| React | 19.2.4 | Full |
| Tailwind CSS | ^4 | Full (utility classes compile to standard CSS) |
| next-intl | ^4.11.0 | Full |
| lucide-react | ^1.14.0 | Full (SVG icons, no browser-specific API) |
| @radix-ui/* | various ^1-2 | Full (uses standard DOM APIs + ARIA) |

---

## CSS features with Firefox compat risks

| Feature | Used in codebase | First seen in Firefox | Risk level | Notes |
|---|---|---|---|---|
| `backdrop-filter` | YES — `Header.tsx` + `StickyMobileCta.tsx` (pre-existing, not Sprint A) | FF 103 (2022) | LOW | Wrapped with `supports-[backdrop-filter]:` Tailwind guard — degrades gracefully |
| `@layer` | YES — `globals.css` (base, utilities), `admin.css` (admin-tokens, admin-fixes, admin-actions) | FF 97 (2022) | LOW | All modern FF in use, standard CSS Cascade Layers |
| `:has()` selector | YES — `admin layout.tsx` (body:has(.admin-layout) — pre-existing) | FF 121 (2024-01) | P2 — ADMIN ONLY | Used only for admin layout CSS injection. Not in any Sprint A component. Admin panels not user-facing. |
| `aspect-ratio` | YES — `CaseStudyMarquee.tsx` (aspect-[16/9]) + `ImageLightbox` | FF 88 (2021) | LOW | Fully supported since FF 88 |
| `clamp()` | YES — 3 Sprint A components (`InterventionsFamiliesGrid`, `OrangeContactBanner`, `VilleEcosystemeLocal`) | FF 75 (2020) | NONE | Universally supported |
| `gap` in flex/grid | YES — 29 Sprint A components | FF 63 (flex), FF 61 (grid) | NONE | Universally supported |
| `inset` shorthand | YES — `ImplementationHero`, `InterventionsHero`, `SitesWebHero`, `CaseStudyMarquee` (via Tailwind `inset-0`, `inset-y-0`) | FF 87 (2020) | NONE | Fully supported since FF 87 |
| `scroll-snap` | YES — `TestimonialsCarousel.tsx` (pre-existing, not Sprint A) | FF 68 (2019) | NONE | Fully supported |
| `container-type` / `@container` | NOT FOUND | FF 110 (2023) | N/A | Not used anywhere in Sprint A |
| `scrollbar-gutter` | NOT FOUND | FF 97 (2022) | N/A | Not used |
| `scroll-driven animations` (animation-timeline) | NOT FOUND | Not supported in FF | N/A | Not used — correctly avoided |
| `text-wrap: balance` | NOT FOUND | FF 121 (2024) | N/A | Not used |
| `::view-transition` | CSS rules present in `globals.css` (prefers-reduced-motion block) | NOT supported in FF | P2 | Rules are ONLY inside `@media (prefers-reduced-motion: reduce)` — they will simply be ignored by Firefox (no `::view-transition` pseudo-elements are emitted since `experimental.viewTransition` is not enabled in Next.js config). Non-blocking. |
| `color-mix()` | NOT FOUND | FF 113 (2023) | N/A | Not used |
| `oklch()/oklab()` | NOT FOUND | FF 113 (2023) | N/A | Not used — design tokens use hex + rgba |
| CSS subgrid | NOT FOUND | FF 71 (2019) | N/A | Not used |
| CSS nesting | NOT FOUND | FF 117 (2023) | N/A | Not used in Sprint A |
| `font-feature-settings` | YES — `Price.tsx` + `Stat.tsx` (pre-existing), `print.css` (`font-variant-numeric`) | FF 34 (2014) | NONE | Universally supported |

---

## JS API compatibility risks

| API | Used | FF version | Risk | Notes |
|---|---|---|---|---|
| `PerformanceObserver` | YES — `WebVitals.tsx` (pre-existing) | FF 57 (2017) | LOW | Guarded with `typeof PerformanceObserver === "undefined"` check |
| `long-animation-frame` LoAF entry | YES — `WebVitals.tsx` (pre-existing) | NOT supported in FF | P2 — analytics only | Code checks `PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")` first, falls back to `longtask` for FF. Non-functional degradation: less granular perf data on FF, UI unaffected. |
| `IntersectionObserver` | YES — `FadeInOnView.tsx` (pre-existing) | FF 55 (2017) | NONE | Universally supported |
| `structuredClone` | NOT FOUND | FF 94 (2021) | N/A | Not used in Sprint A |
| `Array.prototype.at()` | NOT FOUND | FF 90 (2021) | N/A | Not used in Sprint A |
| `navigator.userAgent` | NOT FOUND in Sprint A | — | N/A | Not used in Sprint A components |
| `CSS.supports()` | NOT FOUND in Sprint A | FF 22 | N/A | Not used in Sprint A components |
| `matchMedia()` | NOT FOUND in Sprint A | FF 6 | N/A | Not used in Sprint A components |

Note: All 43 Sprint A components (36 services + 7 ville) are **pure Server Components** (`use client` directive: 0). They generate static HTML+CSS at build time. There is zero client-side JavaScript to audit within Sprint A itself.

---

## SVG / animation risks

| Item | Detail | Risk |
|---|---|---|
| CSS `@keyframes caseScrollX` | Used by `CaseStudyMarquee.tsx` via inline `animation:` style. Defined in `globals.css`. | NONE — standard CSS animations, fully supported in all modern FF |
| `prefers-reduced-motion` guard | `CaseStudyMarquee` uses `motion-reduce:animate-none` Tailwind class. `globals.css` has full `@media (prefers-reduced-motion: reduce)` block disabling all animations. | POSITIVE — best practice correctly implemented |
| SMIL animations (`<animate>`, `<animateTransform>`) | NOT FOUND in Sprint A | N/A |
| SVG filters (`feGaussianBlur`, `feBlend`) | NOT FOUND in Sprint A | N/A |
| `stroke-dasharray` animations | NOT FOUND in Sprint A | N/A |
| `will-change: transform` | `globals.css` on `.case-marquee-track`. | NONE — universally supported |

---

## Font rendering

| Feature | Used | FF risk |
|---|---|---|
| Variable fonts (Manrope, Fraunces, Inconsolata via next/font) | YES — loaded via `next/font/google` (pre-existing) | NONE — FF supports variable fonts since FF 62 (2018) |
| `font-feature-settings: 'tnum'` | `Price.tsx`, `Stat.tsx` | NONE — FF 34+ |
| `font-variant-numeric: tabular-nums` | `print.css` | NONE — FF 34+ |
| `letter-spacing` with negative values | YES — throughout design tokens | NONE — standard |
| `font-synthesis` | NOT FOUND | N/A |

---

## Next.js Firefox support

**VERDICT: OK**

Next.js 16.2.6 generates standard HTML/CSS/JS bundles. The output is transpiled by SWC to ES2015+ targets compatible with all modern browsers including Firefox ESR (currently 128). No Next.js-specific features that are Firefox-incompatible were detected (View Transitions API is not enabled in the config).

---

## Issues found

### P0 — BLOCKING
None.

### P1 — HIGH (should fix before go-live)
None.

### P2 — MEDIUM (monitor, non-blocking)

**P2-1: `::view-transition` CSS rules in globals.css**
- Location: `src/app/globals.css` lines 444-449 (inside `@media (prefers-reduced-motion: reduce)`)
- Issue: `::view-transition-old(*)`, `::view-transition-new(*)`, `::view-transition-group(*)` pseudo-elements are defined but Firefox does not support View Transitions API (as of FF 127, still behind a flag).
- Impact: **Zero**. These rules are inside the `prefers-reduced-motion` media query as a forward-compat guard. Firefox simply ignores unknown pseudo-elements. No visual artefact. Comment in file explicitly notes `experimental.viewTransition` is not enabled.
- Action: No fix needed. Becomes relevant only if `experimental.viewTransition` is enabled in `next.config.ts` in a future sprint.

**P2-2: `:has()` in admin layout**
- Location: `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` lines 210-215
- Issue: `body:has(.admin-layout)` — `:has()` requires Firefox 121+ (January 2024).
- Impact: Very low. Admin panel is staff-only. No Firefox ESR < 128 concern for internal tooling. If a staff member uses FF 120 or older, the admin header/footer may not be hidden (they remain visible instead of `display:none`). Admin content still accessible.
- Action: Acceptable for admin-only context. Add to tech debt if Firefox ESR support for admin is required.

**P2-3: LoAF (long-animation-frame) analytics missing in Firefox**
- Location: `src/components/analytics/WebVitals.tsx` line 189
- Issue: `long-animation-frame` PerformanceObserver entry type not supported in Firefox. Falls back to `longtask` observer.
- Impact: INP/LoAF telemetry will use `longtask` fallback on Firefox. Analytics data is less granular. No UI impact.
- Action: None needed. Fallback is already implemented correctly.

### P3 — LOW / informational

- `aspect-[16/9]` used in `CaseStudyMarquee.tsx`: fully supported since FF 88, no issue.
- `inset-0` / `inset-y-0` Tailwind utilities (CSS `inset` shorthand): fully supported since FF 87, no issue.
- `clamp()` in 3 Sprint A components: supported since FF 75, no issue.
- `supports-[backdrop-filter]` progressive enhancement on Header/StickyMobileCta: correct pattern, no issue.

---

## Sprint A component summary

| Component group | Count | Client-side JS | Firefox risk |
|---|---|---|---|
| `src/components/services/**` | 36 | 0 (pure Server Components) | None |
| `src/components/ville/**` | 7 | 0 (pure Server Components) | None |
| **Total Sprint A** | **43** | **0** | **None** |

All 43 Sprint A components are pure Server Components generating static HTML. No browser-specific APIs, no client-side hooks, no CSS features with Firefox incompatibilities were detected within Sprint A code.

---

## Verdict

**GO — No Firefox-blocking issues in Sprint A components.**

The two P2 items (`::view-transition` guard in globals.css and `:has()` in admin layout) are both pre-existing and outside Sprint A scope. All 43 new Sprint A components are pure Server Components with zero client-side JavaScript. CSS used is standard Tailwind v4 utilities (gap, flex, grid, clamp, inset, aspect-ratio) all universally supported in modern Firefox (FF 88+, current stable FF 127+, ESR 128+).

The marquee animation in `CaseStudyMarquee.tsx` uses standard CSS `@keyframes` with correct `prefers-reduced-motion` handling — no Firefox-specific risk.

**Minimum Firefox version for full feature parity: Firefox 121** (for `:has()` in admin — but that is pre-existing, not Sprint A). For Sprint A components specifically: **Firefox 88** (aspect-ratio, the most recent CSS feature used).
