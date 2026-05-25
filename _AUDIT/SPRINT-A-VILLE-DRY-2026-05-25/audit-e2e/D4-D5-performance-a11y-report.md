# D-4+D-5 Performance + A11y Code Proxy Report

**Sprint A · Phase 4 ville DRY — 2026-05-25**
**Scope:** Code-level static analysis of new Sprint A components + ville templates.
**Method:** Read-only forensic audit. No runtime Lighthouse or axe-core execution (dev server not running).

---

## D-4 LIGHTHOUSE PROXY

### LCP optimization

**Finding: GOOD — No hero images on ville pages; LCP element is text-based H1.**

The ville hub page (`src/app/[locale]/implantations/[region]/[ville]/page.tsx`) renders an inline `<section>` hero using pure HTML text (H1 + description paragraphs). No above-the-fold bitmap image exists on these pages that would become the LCP candidate.

For pages that DO use images:
- `next.config.ts`: `images.formats: ["image/avif", "image/webp"]` — AVIF/WebP pipeline active.
- `images.minimumCacheTTL: 31536000` — 1-year immutable cache on image transforms (anti-I/O pressure).
- `CaseStudyMarquee.tsx`: `next/image` with `width={1280} height={720}` and responsive `sizes` — correct, but no `priority` prop. This marquee carousel is not above-the-fold so no LCP concern.
- `AiToolsStack.tsx`: native `<img>` for SVG logos with `width=28 height=28` + `loading="lazy"` + `decoding="async"` — correct (next/image blocks SVG by default).
- `src/components/visual/Illustration.tsx` properly exposes a `priority` prop forwarded to `next/image`.
- `src/components/nav/Header.tsx` uses `priority` on the logo image — correct (LCP candidate in narrow viewports).
- `src/app/[locale]/page.tsx` (home): uses `priority` on hero image — correct.
- `src/components/ui/ImageBankPicture.tsx`: uses `fetchPriority="high"` + `loading="eager"` + `decoding="sync"` when `priority={true}` — exemplary implementation.

**Pre-existing concern from `lighthouserc.json`**: `legacy-javascript` and `unused-javascript` are WARN-gated (not ERROR). This is intentional doctrine from P1-7 2026-05-22.

**Preconnect hints:** `src/app/[locale]/layout.tsx` emits `<link rel="preconnect">` for Plausible, Sentry, and Cloudflare Turnstile (React 19 auto-hoisted to `<head>`). No preconnect for Google Fonts because `next/font` self-hosts the woff2 files — correct.

**LCP verdict: LOW RISK.** Text-based H1 LCP on ville pages eliminates image-LCP risks. Existing image components have correct `priority` discipline.

---

### CLS prevention

**Finding: GOOD — Multiple explicit CLS-prevention measures in place.**

1. **Font loading strategy:**
   - `Manrope`: `display: "swap"`, 2 weights (400+600) — SWAP is acceptable because Manrope metrics are close to system sans-serif fallbacks.
   - `Fraunces` (display serif): `display: "optional"` — THIS IS CORRECT. The audit comment in `layout.tsx` (lines 60-73) explicitly explains that `optional` eliminates the CLS reflow that was measured at >0.05 on /audit, /home, /a-propos, /methodologie with `swap`. First visit uses a high-quality serif fallback; Fraunces loads on subsequent visits. CLS = 0 on first paint.
   - `Inconsolata`: `preload: false` — prevents wasted preload budget for a font used only in `<code>` blocks.

2. **Image dimensions:** All `next/image` usages provide explicit `width`/`height`. Native `<img>` elements (SVG logos, author avatars) also have explicit dimensions.

3. **CSS animations:** `globals.css` `prefers-reduced-motion` block (lines 423-450) disables ALL transitions and animations: `animation-duration: 0ms !important`, `transition-duration: 0ms !important`. `CaseStudyMarquee` marquee also has its own `animation: none !important` rule. The `cta-lift:hover` transform is also disabled.

4. **`inlineCss: true`** in `next.config.ts` experimental flags — eliminates render-blocking `<link rel="stylesheet">` by inlining CSS into `<head>`. Confirmed: Sprint 24bis note says this eliminates 1-2 render-blocking resources detected by Lighthouse on all strategic pages, gaining ~50-150 ms FCP/LCP p75.

5. **`title-flash` animation** (calendar title): Changed from `scale(1.03)` to `opacity` flash (Sprint A11y 2026-05-17 comment in globals.css) specifically to avoid CLS — good.

6. **`VilleTissuEconomique`**: Desktop table + mobile card list (separate `hidden`/`block` at `sm:` breakpoint) — no layout shift risk since they are mutually hidden.

**CLS verdict: LOW RISK.** Font strategy is well-engineered; image dimensions are explicit; animation CLS guards are in place.

---

### INP / Interactivity

**Finding: GOOD — Minimal client JS on ville pages; scroll handlers are rAF-coalesced.**

1. **Ville hub page** (`/implantations/[region]/[ville]`) is a Server Component. The only client-side interactivity is the `<details>/<summary>` native HTML accordion (no JS) for département groups. Zero useEffect, zero event listeners on the page itself.

2. **`StickyMobileCta.tsx`** (present on some pages, NOT on hub ville pages): Uses `requestAnimationFrame` coalescing to prevent redundant `setState` calls. `{ passive: true }` on scroll listener. INP analysis from code comment: "Avant : chaque event scroll déclenchait setVisible() même si la valeur était identique → React schedule un re-render → INP +20-40 ms mobile" — this was explicitly fixed with rAF debouncing.

3. **`TestimonialsCarousel.tsx`**: Uses `React.useCallback` for keyboard handlers — correctly memoized. No resize or scroll listeners.

4. **`SpeculationRules.tsx`**: Injects `<script type="speculationrules">` post-hydration with `eagerness: "moderate"` (hover/200ms threshold) — this is a lightweight client script with no INP impact.

5. **No heavy event handlers found on ville components.** `VilleEcosystemeLocal`, `VilleTissuEconomique`, `VilleCommunesProches`, `VilleFaqGeolocalisee`, `OrangeContactBanner` are all Server Components with zero client JS.

6. **`FadeInOnView.tsx`** (intersection observer): Used globally; properly isolated with `useEffect`. The comment states it delivers "zero KB shipped" (CSS-only fade-in pattern using `@starting-style`).

**INP verdict: LOW RISK.** Ville pages are SSR-only with native HTML interactivity (`<details>`). The only real client-side listener (`StickyMobileCta`) is properly debounced via rAF.

---

### Bundle optimization

**Finding: GOOD — Comprehensive bundle size strategy.**

1. **`optimizePackageImports`** in `next.config.ts` covers 15 Radix UI packages + `lucide-react` — prevents importing full icon/component bundles.

2. **`serverExternalPackages`**: 12 heavy server-only packages (prisma, bullmq, ioredis, sharp, argon2, etc.) are externalized — prevents accidental client-bundle bloat.

3. **Dynamic imports**: Limited but used correctly:
   - `BookingCalendarLazy.tsx`: `dynamic(() => import('./BookingCalendar'))` — heavy calendar deferred.
   - `src/app/[locale]/(admin)/site-explorer/page.tsx`: 1 dynamic import.
   - `SitesWebFaq.tsx`: 1 dynamic import.
   These are the heavyweight components that should be deferred.

4. **`productionBrowserSourceMaps: false`** — no sourcemaps in browser bundle.

5. **`compress: false`**: Correct — Caddy handles Brotli/gzip/zstd upstream; double-compression avoided.

6. **`lucide-react`** icons: All icons in ville components use `aria-hidden="true"` decorative usage — no ARIA overhead.

7. **Bundle delta gate**: `size-limit` configured in `package.json` (referenced in AGENTS.md: "+5 KB gz vs main" blocks PRs).

8. **Sprint A new components** (`VilleEcosystemeLocal`, `VilleTissuEconomique`, `VilleCommunesProches`, `VilleFaqGeolocalisee`, `OrangeContactBanner`, `AiToolsStack`, `CaseStudyMarquee`): All are Server Components — zero addition to client JS bundle.

9. **WARN noted**: `lighthouserc.json` explicitly marks `unused-javascript: ["warn", { "maxLength": 10 }]` — known acceptable debt.

**Bundle verdict: LOW RISK.** No large client-side additions from Sprint A ville components. Server-only components are zero JS bundle overhead.

---

## D-5 ACCESSIBILITY PROXY

### ARIA attributes

**Finding: GOOD — 85+ aria-* occurrences across 56 files; ville components well-covered.**

Ville component coverage:
- `VilleEcosystemeLocal.tsx`: `aria-labelledby={headingId}` on section, `aria-hidden="true"` on decorative dots/icons, `aria-label` on sector `<ul>` (`role="list"` + descriptive label in both FR/EN), `role="list"` on institutions list.
- `VilleTissuEconomique.tsx`: `aria-labelledby={headingId}` on section, `id` wired to heading. Table uses `scope="col"` on all `<th>` elements — correct.
- `VilleCommunesProches.tsx`: `aria-labelledby={headingId}` on section, `role="list"` on the communes grid.
- `VilleFaqGeolocalisee.tsx`: `aria-labelledby={headingId}` on section, `id={sectionId}` wired, native `<details>/<summary>` semantic (no ARIA hacks needed).
- `OrangeContactBanner.tsx`: `aria-label` on the `<section>` element (not labelledby — acceptable since there's no visible heading, banner has its own H2).
- `AiToolsStack.tsx`: `role="list"` + `aria-label` on the tools `<ul>`, `<figure>/<figcaption>` with `sr-only` for each logo.
- `CaseStudyMarquee.tsx`: `aria-roledescription="carousel"` + `aria-label` on the container.

**Ville hub page** (`[ville]/page.tsx`):
- Hero `<section aria-labelledby="ville-hub-hero">` — correct.
- Verticales `<section id="ville-verticales" aria-labelledby="ville-verticales-heading">` — correct.
- H1 has `id="ville-hub-hero"` for labelling.

**Region page** (`[region]/page.tsx`):
- `<details>/<summary>` département accordion: `aria-hidden="true"` on the decorative chevron `▾` — correct.
- City links in the accordion have `focus-visible:ring-2` focus rings.

**P1 finding**: `VilleTissuEconomique` table: No `<caption>` element or `aria-label` on the `<table>` itself — minor WCAG 1.3.1 gap. The section heading labels the section via `aria-labelledby` but the `<table>` element itself lacks a programmatic label. Low severity.

**ARIA verdict: ~90% coverage. One P2 gap (table caption).**

---

### Color contrast

**Finding: GOOD — Design tokens explicitly WCAG-AA certified; one P1 risk on terracotta text.**

Token audit from `src/app/globals.css`:

| Token | Value | Usage | Contrast on Paper (#fff) | Status |
|---|---|---|---|---|
| `--color-fg` | #1a1815 | Body text | ~18.5:1 | WCAG AAA |
| `--color-fg-soft` | #524b41 | Secondary text | ~8.1:1 | WCAG AAA |
| `--color-fg-muted` | #5a4f44 | Captions (updated Sprint A11y 2026-05-17 from #6b6155) | 5.0:1 on paper, 4.8:1 on bg | WCAG AA (border) |
| `--color-primary` | #1a4dd9 | Blue CTA text | ~5.1:1 on paper | WCAG AA |
| `--color-terracotta` | #c24a1b | Accent text / links | ~4.5:1 on paper | WCAG AA (border) |
| `--color-sage` | #5e6c54 | Proof/success (updated Sprint A11y 2026-05-17) | 5.0:1 on paper | WCAG AA |
| `--color-mocha` | #2a2520 | Premium section bg | — | Used as bg, not text |

**P1 risk**: `--color-terracotta` (#c24a1b) is used as BOTH a background color (`OrangeContactBanner` has `bg-terracotta`) AND as text-on-white in many components. The 4.5:1 ratio is exactly at the WCAG AA threshold — any rendering engine variation could push it just below. The `lighthouserc.json` has `color-contrast: ["warn", { "minScore": 1 }]` (WARN not ERROR) acknowledging this risk.

**Specific to Sprint A new components:**
- `OrangeContactBanner`: `text-paper` on `bg-terracotta` — #ffffff on #c24a1b = ~4.5:1 (WCAG AA border, passes).
- `text-paper/85` (opacity 0.85 = rgba(255,255,255,0.85)) on `bg-terracotta` — effective contrast drops to ~3.9:1 (FAILS AA for normal text). This is used for the description paragraph and the eyebrow in `OrangeContactBanner`.
- `VilleEcosystemeLocal` institution badges: `text-fg` (#1a1815) on `bg-bg` (#faf8f3) border badges — passes easily.

**P1 issue: `OrangeContactBanner` uses `text-paper/85` on `bg-terracotta` — computed ~3.9:1 which fails WCAG AA (4.5:1 required for normal text). Should be `text-paper` (opaque) or the text size should be large enough for the 3:1 large-text threshold.**

**Color contrast verdict: 1 P1 issue in OrangeContactBanner. Systematic token design is sound.**

---

### Focus styles

**Finding: EXCELLENT — Global focus-visible ring + component-level overrides throughout.**

1. **Global baseline**: `globals.css` layer base:
   ```css
   :focus-visible {
     outline: 2px solid var(--color-primary);
     outline-offset: 2px;
     border-radius: var(--radius-xs);
   }
   ```
   This provides a universal blue focus ring on all focusable elements.

2. **Component-level overrides**: 56 files use `focus-visible:` Tailwind classes. Pattern used consistently: `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`. The `focus-visible:outline-none` suppresses the browser default in favor of the custom ring.

3. **Ville components:**
   - `VilleCommunesProches`: `focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none` on commune links.
   - `OrangeContactBanner` CTAs: `focus-visible:ring-paper focus-visible:ring-offset-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none` — contrasting white ring on orange background.
   - Région page: `focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:outline-none` on department `<summary>` and ville links.
   - Hub ville `<section>` verticale cards: `focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none`.

4. **`SkipToContent.tsx`**: `focus-visible:ring-primary focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2 focus-visible:ring-offset-2` — skip link is correctly visually hidden until focused. WCAG 2.4.1 compliant.

5. **Button component**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` — consistent.

**Focus verdict: EXCELLENT. Systematic focus ring strategy with per-context color adaptation.**

---

### Form labels

**Finding: GOOD — UnifiedContactForm fully labeled; no orphan inputs found in ville components.**

Ville pages have NO forms directly embedded. The `OrangeContactBanner` CTAs are `<Link>` elements (not forms).

For the broader codebase forms:
- `UnifiedContactForm.tsx`: All inputs paired with `<Label htmlFor="unified-{field}">` — nom, email, telephone, ville, message, companyName, companySize, companySector, timingWeeks, budget. Consent checkbox has associated `<Label>`.
- `NewsletterForm.tsx`: `<Label htmlFor="newsletter-email">` and `<Label htmlFor="newsletter-consent">`.
- `BookingForm.tsx`: `<Label htmlFor="booking-name">` — confirmed labeled.
- `HoneypotField.tsx`: Hidden `<input name="website">` is intentionally visually hidden for spam protection — no label needed.
- `Input` component: `focus-visible:ring-terracotta` focus ring, full 48px height (`h-12`).

**Forms verdict: GOOD. No orphaned inputs. All public forms use `<Label>` with `htmlFor`.**

---

### Heading hierarchy

**Finding: GOOD — Explicit H1 enforcement across ville templates; one minor concern.**

Architecture audit:

**Hub ville page** (`/implantations/[region]/[ville]`):
- H1: `<h1 id="ville-hub-hero">` in the inline hero section — single H1 confirmed.
- H2: `id="ville-verticales-heading"` for the 5-modules section.
- H3: Verticale card headings (`<h3>`) inside the `<ul>` — correct hierarchy H1 > H2 > H3.
- `VilleEcosystemeLocal`: `<h2 id={headingId}>` + `<h3>` for sector/institution subsections — correct.
- `VilleTissuEconomique`: `<h2 id={headingId}>` — correct.
- `VilleFaqGeolocalisee`: `<h2 id={headingId}>` — correct.
- `VilleCommunesProches`: `<h2 id={headingId}>` — correct.
- `OrangeContactBanner`: `<h2>` for the CTA heading — correct.

**Region page** (`/implantations/[region]`):
- Uses `<Section titleAs="h1">` for the hero — single H1 confirmed.
- Subsequent sections use `<Section>` which defaults to `h2`.
- Department `<details>`: heading is `<span>` inside `<summary>` (not a `<hN>` tag) — this is semantically neutral but means screen readers cannot navigate by heading within the département list. Low severity for a list interface.

**Ville verticale page** (`/implantations/[region]/[ville]/[verticale]`):
- Service components (e.g., `AuditHero` via `ServiceHero`) render an `<h1 className="display-editorial">` — confirmed single H1.
- `VilleEcosystemeLocal`, `VilleTissuEconomique`, etc. each render `<h2>` — correct.

**Section component** (`Section.tsx`): `titleAs` prop allows `h1|h2|h3`. Comment explicitly references WCAG 2.4.6: "Pass `h1` on listing pages that don't carry a `<Hero>` so each page has exactly one h1." The implementation is WCAG-aware.

**P2 finding**: Département `<summary>` in region page uses `<span>` for the heading text instead of a semantic heading element. Not a blocking issue (the `<details>` pattern with `<summary>` is acceptable) but a heading-based navigation shortcut would be lost.

**Heading hierarchy verdict: GOOD. Single H1 per page enforced. H2/H3 cascade correct. One P2 non-semantic summary heading.**

---

### `lang` attribute

**Finding: EXCELLENT — Correct `lang` and `dir` attributes.**

`src/app/[locale]/layout.tsx` line 249:
```tsx
<html lang={locale} dir="ltr" className="...">
```

- `lang={locale}`: Dynamically set to `"fr"` or `"en"` via the locale segment. WCAG 3.1.1 compliant.
- `dir="ltr"`: Explicitly set — defensive (not necessary for FR/EN but correct for future RTL locales).
- `generateStaticParams()` generates both `fr` and `en` at build time.

**lang verdict: EXCELLENT.**

---

### Skip link

**Finding: EXCELLENT — WCAG 2.4.1 bypass block present and correctly implemented.**

`src/components/a11y/SkipToContent.tsx`:
- Visually hidden (`sr-only`) until focused via keyboard.
- On focus: `focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3` — becomes visible with blue ring.
- Target: `href="#main"`.
- `<main id="main">` in `layout.tsx` line 270: `<main id="main" className="flex-1">`.
- Label is i18n-translated via `getTranslations("common")` (`common.skipToContent`).
- Used as FIRST element in `<body>` (line 262: `<SkipToContent />`).

**Skip link verdict: EXCELLENT. WCAG 2.4.1 compliant implementation.**

---

### Touch targets

**Finding: GOOD — Button system meets 44px minimum; a few P2 risks in small navigation links.**

Button system:
- `button.tsx` sizes: `sm: h-9` (36px), `md: h-11` (44px), `lg: h-12` (48px), `xl: h-14` (56px), `icon: h-11 w-11`.
- The `sm` size (36px height) is technically below WCAG 2.5.8 (24px) but below the "good" 44px target. `sm` is used on admin components, not on marketing CTAs.
- Marketing CTAs (`Cta`) default to `size="md"` (44px) or `size="lg"` (48px) — both at or above target.

Ville components:
- `OrangeContactBanner` CTAs: `h-14` (56px) — exceeds 44px target.
- `VilleCommunesProches` commune links: `px-3 py-2.5` (10px vertical padding × 2 + font = ~36px estimated). Potentially below 44px.
- Région page city list links: `px-2 py-1.5` (6px vertical padding × 2 + ~15px font = ~27px). Below 44px minimum. These are small list items in a dense grid — `lighthouserc.json` explicitly notes `target-size: ["warn", { "minScore": 1 }]` as a known P1 ("zones tactiles < 48px sur certains composants (nav mobile, footer links)").

**P2 finding (pre-existing, acknowledged in lighthouserc.json)**: Dense city/commune list links (`VilleCommunesProches` + region page city grid) have estimated touch targets of 27-36px, below the 44px recommendation. This is a pre-existing P1 acknowledged in LHCI config as WARN.

**Touch targets verdict: P2 risk on dense commune link grids (pre-existing, WARN in LHCI).**

---

## Issues Found

### P0 — Blocking

None found in Sprint A additions. All new components conform to baseline quality standards.

---

### P1 — High Priority

**P1-D5-1: OrangeContactBanner — `text-paper/85` on `bg-terracotta` fails WCAG AA contrast**
- File: `src/components/ville/OrangeContactBanner.tsx`, lines 31 and 41.
- `text-paper/85` = rgba(255,255,255,0.85) on #c24a1b = estimated ~3.9:1 contrast ratio.
- WCAG AA requires 4.5:1 for normal text (body size 16–18px).
- Affected text: eyebrow span and description paragraph.
- Fix: Change `text-paper/85` → `text-paper` (opaque white) which achieves ~4.5:1.
- Effort: 2-line change.

---

### P2 — Medium Priority

**P2-D5-1: VilleTissuEconomique — `<table>` lacks programmatic label**
- File: `src/components/ville/VilleTissuEconomique.tsx`.
- The `<table>` element has no `<caption>` or `aria-label`/`aria-labelledby` attribute.
- The section heading labels the section via `aria-labelledby` but AT users navigating by table role may not receive a table label.
- Fix: Add `aria-labelledby={headingId}` to the `<table>` element, or add a visually hidden `<caption>`.
- Effort: 1-line change.

**P2-D5-2: Dense commune/ville link grids — touch targets below 44px**
- Files: `src/components/ville/VilleCommunesProches.tsx`, `src/app/[locale]/implantations/[region]/page.tsx`.
- Estimated touch target: 27-36px (px-2 py-1.5 or px-3 py-2.5 + font height).
- Pre-existing issue acknowledged in `lighthouserc.json` as WARN.
- Fix: Add `min-h-[44px]` or increase padding to `py-3` for mobile viewports.
- Effort: 30-minute CSS pass.

**P2-D5-3: Département summary headings — non-semantic heading in `<summary>`**
- File: `src/app/[locale]/implantations/[region]/page.tsx`, line 298.
- `<span>` used for heading text inside `<summary>` instead of an `<hN>` element.
- Screen reader users navigating by headings cannot reach département groups.
- Fix: Wrap department name in `<h3>` inside `<summary>`. (HTML spec allows heading elements inside `<summary>`.)
- Effort: 1-line change.

**P2-D4-1: `StickyMobileCta` — `resize` listener not passive**
- File: `src/components/marketing/StickyMobileCta.tsx`, line 57.
- `window.addEventListener("resize", onScroll)` — missing `{ passive: true }`.
- Scroll listener on line 56 is correctly `{ passive: true }`.
- Fix: `window.addEventListener("resize", onScroll, { passive: true })`.
- Effort: 1-character fix.

---

## Summary Scorecard

| Dimension | Score | Key Signal |
|---|---|---|
| LCP images | 9/10 | Priority prop discipline; text-based LCP on ville pages |
| CLS prevention | 9/10 | Fraunces `display:optional`; explicit dimensions everywhere; prefers-reduced-motion strict |
| INP / interactivity | 9/10 | Server Components on ville pages; rAF-coalesced scroll handler |
| Bundle optimization | 9/10 | 15 Radix packages tree-shaken; server externals; zero client JS from Sprint A |
| ARIA attributes | 9/10 | aria-labelledby on all sections; role=list; decorative aria-hidden; one table label gap |
| Color contrast | 7/10 | Tokens AA-certified; OrangeContactBanner opacity bug creates 3.9:1 |
| Focus styles | 10/10 | Global focus-visible ring; per-context ring colors; skip link excellent |
| Form labels | 10/10 | All inputs labeled; no orphaned form controls |
| Heading hierarchy | 9/10 | Single H1 enforced; H2/H3 cascade correct; one non-semantic summary |
| lang attribute | 10/10 | `lang={locale}` + `dir="ltr"` in root layout |
| Skip link | 10/10 | WCAG 2.4.1 compliant; first focusable; correctly targets `<main id="main">` |
| Touch targets | 7/10 | CTAs 44-56px; dense commune grids 27-36px (pre-existing WARN) |

**Overall D-4+D-5 Score: 91/100**

---

## Note: Full Runtime Tests Required

This report is a code-level proxy analysis. The following require a running server + runtime tools for definitive measurement:

- **Lighthouse CI** (`pnpm lhci`): LCP p75 measurement, actual CLS score, TBT, FCP, SI.
- **axe-core**: Color contrast runtime verification (opacity rendering differs from static calculation), focus order audit, live ARIA tree inspection.
- **CrUX data**: Real-user INP p75 (lab simulation via Lighthouse is an estimate).
- **Bundle analysis**: `ANALYZE=true pnpm build` for real bundle sizes and First Load JS per route.

**Conditional verdict: CONDITIONAL GO**
Sprint A ville components are well-engineered for performance and accessibility. The P1 `OrangeContactBanner` contrast issue is a quick 2-line fix. P2 issues are pre-existing or minor. No new P0 regressions introduced by Sprint A.

**Recommended before next deploy:**
1. Fix `OrangeContactBanner` `text-paper/85` → `text-paper` (P1, 2 min).
2. Add `aria-labelledby` to `<table>` in `VilleTissuEconomique` (P2, 1 min).
3. Add `{ passive: true }` to resize listener in `StickyMobileCta` (P2, 1 min).
