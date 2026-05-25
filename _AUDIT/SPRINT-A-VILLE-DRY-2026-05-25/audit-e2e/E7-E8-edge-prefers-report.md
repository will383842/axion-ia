# E-7+E-8 Edge + Prefers Report

**Date**: 2026-05-25
**Branch**: chore/pricing-update-2026-05-24
**Method**: code-level static analysis — read-only, zero code modification

---

## E-7 Edge Compatibility

### Chromium-based = mostly OK

Edge >= 109 is explicitly declared in `package.json` `browserslist`:

```json
"browserslist": [
  "Chrome >= 109",
  "Edge >= 109",
  ...
]
```

Edge 109+ is Chromium-based and shares the same rendering engine. All Chromium-specific APIs used in the codebase (IntersectionObserver, CSS custom properties, `@keyframes`, `scroll-behavior`, `scrollBy`, `scrollIntoView`, CSS `motion-reduce:`, Blob/sendBeacon, CSS `env(safe-area-inset-bottom)`) are fully supported in Edge 109+.

### IE Mode: no compatibility code present

No `X-UA-Compatible` meta tag, no `trident` detection, no `-ms-` prefixed CSS. The codebase explicitly targets modern-only browsers. IE mode in Edge would render the site as an unstyled HTML document (acceptable graceful degradation for SSG).

### Edge Tracking Prevention — sendBeacon risk

`navigator.sendBeacon` is used in `src/components/analytics/WebVitals.tsx` (3 call sites) to POST to `/api/vitals` (internal Hetzner self-hosted endpoint). Edge's Tracking Prevention (Balanced or Strict mode) could block `sendBeacon` calls if the endpoint is classified as a tracker.

**Risk assessment**: LOW. The endpoint is `https://axion-ia.com/api/vitals` — a **first-party** same-origin endpoint. Edge Tracking Prevention only blocks cross-origin tracker domains. A first-party `/api/vitals` route will never be blocked.

All three `sendBeacon` call sites include a `fetch` fallback if `sendBeacon` is unavailable, which is best practice:

```ts
if (typeof navigator.sendBeacon === "function") {
  navigator.sendBeacon(VITALS_ENDPOINT, blob);
} else {
  void fetch(VITALS_ENDPOINT, { method: "POST", keepalive: true, ... });
}
```

### Analytics Scripts: Microsoft Clarity

Clarity (`www.clarity.ms`) is explicitly whitelisted in the CSP:

```
connect-src ... https://www.clarity.ms https://*.clarity.ms
script-src ... https://www.clarity.ms https://*.clarity.ms
```

Clarity is loaded consent-gated only (`useAnalyticsConsent() === "accepted"`). Under Edge's Balanced Tracking Prevention, `*.clarity.ms` cross-origin requests may be blocked if the user has not visited `clarity.ms` as a first-party site. This would silently fail (Clarity becomes inactive), which is acceptable behavior — analytics non-blocking.

Plausible is self-hosted at `plausible.axion-ia.com` — first-party subdomain, no Tracking Prevention risk.

### CSP Compatibility with Edge

The CSP in `src/lib/csp.ts` uses:
- `strict-dynamic` (admin routes) — supported Edge 109+
- `'nonce-...'` — supported Edge 109+
- `sha256` hash for speculation rules — supported Edge 109+
- `frame-ancestors 'none'` — supported Edge 109+
- `upgrade-insecure-requests` — supported Edge 109+

No Edge-specific CSP incompatibilities detected.

**E-7 Verdict: PASS** — Edge 109+ full Chromium parity. Only minor risk is Clarity blocked under Strict Tracking Prevention (acceptable, analytics non-critical).

---

## E-8 Media Queries Support

### prefers-reduced-motion: IMPLEMENTED — COMPREHENSIVE

Sprint A fixed the `--marquee-duration` CSS variable for `CaseStudyMarquee`. The implementation is verified correct.

**CaseStudyMarquee** (`src/components/ville/CaseStudyMarquee.tsx`):
- Uses Tailwind `motion-reduce:animate-none` on the `<ul>` track (line 73) — stops animation via Tailwind's media query variant
- CSS in `globals.css` lines 417-421: explicit `@media (prefers-reduced-motion: reduce) { .case-marquee-track { animation: none !important; } }` — belt-and-suspenders
- The `--marquee-duration` CSS variable is set as an inline style but the animation is cancelled at the CSS level; the variable value itself is irrelevant when animation is none

**Global reduced-motion strict rule** (`globals.css` lines 423-450):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
  }
  .cta-lift:hover { transform: none !important; }
  .title-flash { animation: none !important; }
  /* View Transitions anti-flash (P-205) */
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

This global rule covers: `FadeInOnView` (inline `transition` on style prop), `cta-lift` hover lift, `title-flash` (BookingCalendar), all Tailwind transition utilities.

**Admin CSS** (`src/app/admin.css` lines 140-147): separate reduced-motion rule scoped to `.admin-v2` / `.admin-layout-v2` — redundant but harmless.

**Known gap — FadeInOnView inline style**:
`src/components/motion/FadeInOnView.tsx` sets `transition` via inline `style` prop (not a CSS class):
```ts
style={{
  transition: `transform 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
}}
```
The global `transition-duration: 0ms !important` in `globals.css` applies to CSS-based transitions but **does NOT override inline style transitions** — inline styles have higher specificity than `!important` in a stylesheet rule (inline style wins the cascade). This means FadeInOnView's 400ms translate animation is NOT stopped under `prefers-reduced-motion: reduce`.

**However**: the visual impact is minimal. FadeInOnView only moves 8px vertically (`translate3d(0, 8px, 0)` → `translate3d(0, 0, 0)`). Content remains visible at all times (opacity=1 by design). The risk is low but this is a P2 fix.

**TestimonialsCarousel smooth scroll**: `track.scrollBy({ behavior: "smooth" })` — the global `scroll-behavior: auto !important` in the media query only affects CSS `scroll-behavior` property, NOT the JS `scrollBy({ behavior })` option. The carousel will still smooth-scroll under `prefers-reduced-motion`. P2 fix: check `matchMedia('(prefers-reduced-motion: reduce)').matches` and use `behavior: "auto"` conditionally.

**BookingCalendar smooth scrollIntoView**: Same issue as TestimonialsCarousel — JS `scrollIntoView({ behavior: "smooth" })` ignores the CSS media query. P2.

### prefers-color-scheme dark: NOT IMPLEMENTED

Zero occurrences of `prefers-color-scheme` in any CSS, TypeScript, or JSX file. The design system (`globals.css`) declares a single light editorial theme ("Editorial Premium Light") with no dark mode tokens.

Tailwind `dark:` classes are found in only **1 file**: `src/components/sections/CtaBlock.tsx` (5 occurrences). This appears to be a legacy/experimental remnant, not a systematic dark mode implementation.

No `darkMode` key in `tailwind.config` (no config file exists — project uses `@import "tailwindcss"` + `@theme` in CSS directly).

**Dark mode status**: Light-only design system by explicit design decision (Will, "Editorial Premium Light" ADR 0002). No dark mode is planned. The single `dark:` usage in `CtaBlock.tsx` is a P2 cleanup item (dead code unless Tailwind dark mode strategy is configured — it is not).

### prefers-reduced-data: NOT IMPLEMENTED — P2 Backlog

Zero occurrences. This is expected — `prefers-reduced-data` has very low browser support (Chrome flags only as of 2026, not in Edge/Firefox/Safari stable). No action required.

### forced-colors (Windows High Contrast): NOT SUPPORTED

Zero `forced-colors` CSS rules anywhere in the codebase. The design system relies entirely on CSS custom properties (`--color-primary`, `--color-border`, etc.) which are ignored in `forced-colors: active` mode (Windows High Contrast). Browser will substitute its own system colors.

**Risk assessment**:

- **Buttons/CTAs**: use `bg-primary text-primary-fg` Tailwind classes → map to CSS vars → in forced-colors mode, the button background and text will become the browser's `ButtonFace` and `ButtonText` system colors. The button is still a button, still clickable, still distinguishable. Acceptable.
- **Focus rings**: `:focus-visible` uses `outline: 2px solid var(--color-primary)` — in forced-colors mode, `outline` color is forced to `Highlight` or `ButtonText`. Focus remains visible.
- **Links**: standard `<a>` tags inherit `LinkText` color in forced-colors mode. ✓
- **Form inputs**: use `border-border` tokens that map to `ButtonBorder` in forced-colors. ✓
- **Risk**: some decorative elements using background-image gradients (`bg-halo-warm`, `bg-mocha-rich`) will become flat `ButtonFace` backgrounds — cosmetic only.

No interactive elements are lost under forced-colors. P2 enhancement: add `forced-colors: active` rules to preserve brand `border` visibility on icon buttons that use only background colors (e.g., `.cta-lift` cards that rely solely on `bg-primary` with no `border` might become indistinguishable from the page background).

---

## Summary of Issues Found

### P1 Issues

**P1-1**: `FadeInOnView` inline `style.transition` bypasses global `prefers-reduced-motion: reduce` reset. The `transition-duration: 0ms !important` CSS rule cannot override an inline style.
- File: `src/components/motion/FadeInOnView.tsx` line 63
- Fix: Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and set `transition: 'none'` accordingly, OR move transition to a CSS class so `!important` rule wins.
- Impact: Low (8px translate, content always visible) but WCAG 2.1 §2.3.3 Level AAA applies.

### P2 Issues

**P2-1**: `TestimonialsCarousel` `scrollBy({ behavior: "smooth" })` ignores `prefers-reduced-motion`.
- File: `src/components/sections/TestimonialsCarousel.tsx` line 33
- Fix: `const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`

**P2-2**: `BookingCalendar` `scrollIntoView({ behavior: "smooth" })` ignores `prefers-reduced-motion`.
- File: `src/components/calendar/BookingCalendar.tsx` line 481
- Fix: Same pattern as P2-1.

**P2-3**: `dark:` Tailwind classes in `src/components/sections/CtaBlock.tsx` (5 occurrences) are dead code — no dark mode strategy configured. Cleanup recommended.

**P2-4**: No `forced-colors` support. Icon-only CTA buttons relying solely on `bg-primary` without a border may be indistinguishable in Windows High Contrast mode. Audit required per component.

**P2-5**: `prefers-reduced-data` not implemented. No action required now — monitor browser adoption quarterly.

---

## Verdict: GO with P1 advisory

**Edge E-7**: PASS — Full Chromium parity, no IE artifacts, sendBeacon with fetch fallback, CSP compatible, Clarity gracefully degraded under Tracking Prevention.

**Prefers-* E-8**: CONDITIONAL GO
- `prefers-reduced-motion` core implementation is solid (global CSS rule, CaseStudyMarquee double-protected, StickyMobileCta `motion-reduce:transition-none`). Sprint A fix verified correct.
- One P1 gap: `FadeInOnView` inline style bypasses the global reset. Low visual impact but technically non-conformant with WCAG 2.1 AAA §2.3.3. Fix before next a11y audit.
- Dark mode: intentionally not supported (light-only design decision).
- forced-colors: not styled, but interactive elements remain functional via browser defaults.
