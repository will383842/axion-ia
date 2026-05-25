# E-5+E-6 Safari/WebKit Compatibility Report

**Audit date**: 2026-05-25  
**Method**: code-level static analysis (read-only — zero runtime)  
**Scope**: 43 Sprint A components (36 declared + 7 ville; see breakdown below)  
**Auditor**: Agent E-5+E-6  

---

## Scope — Sprint A Components Audited

| Directory | Count | Files |
|---|---|---|
| `services/audit` | 8 | AuditCrossModules, AuditCtaBlock, AuditFaq, AuditHero, AuditMaturityLevels, AuditMethodology, AuditTierGrid, AuditTrustPills |
| `services/implementation` | 10 | ImplementationCatalogFunctions, ImplementationComparisonMatrix, ImplementationCtaBlock, ImplementationFaq, ImplementationHero, ImplementationPillarChoices, ImplementationPricingTiers, ImplementationProcessSteps, ImplementationScenariosBySize, ImplementationTrustPills |
| `services/interventions` | 7 | InterventionsAudienceStrip, InterventionsCrossModules, InterventionsFamiliesGrid, InterventionsFaq, InterventionsHero, InterventionsMaturityLevels, InterventionsReservationFlow |
| `services/sites-web` | 6 | SitesWebCtaBlock, SitesWebFaq, SitesWebHero, SitesWebMethodology, SitesWebStackAdaptee, SitesWebTrustPills |
| `services/un-a-un` | 5 | UnAUnCtaBlock, UnAUnFaq, UnAUnHero, UnAUnMethodology, UnAUnTarget |
| `ville` | 7 | AiToolsStack, CaseStudyMarquee, OrangeContactBanner, VilleCommunesProches, VilleEcosystemeLocal, VilleFaqGeolocalisee, VilleTissuEconomique |

Supporting files also checked: `src/app/globals.css`, `src/components/ui/ImageLightbox.tsx`, `postcss.config.mjs`, `package.json` (browserslist), `node_modules/tailwindcss@4.3.0/dist/lib.mjs`.

---

## Browserslist Target

From `package.json`:
```
Safari >= 16.4
iOS >= 16.4
```

Rationale (documented in `package.json._browserslist_doctrine`): modern-only targets for 2026 Web Vitals sprint. Visitors below Safari 16 get graceful fallback via SSG HTML. All compatibility analysis below is evaluated against this **Safari 16.4+ baseline**.

---

## CSS Prefix Requirements

| Property | Used in Sprint A | Needs -webkit- | Tailwind v4 auto-emits | Status |
|---|---|---|---|---|
| `backdrop-filter` | **No** | Yes (Safari < 18) | Yes — Tailwind v4 auto-emits `-webkit-backdrop-filter` alongside `backdrop-filter` | N/A — not used |
| `text-stroke` | **No** | Yes — `-webkit-text-stroke` only, no standard | Not emitted | N/A — not used |
| `appearance` | **No** | Yes for form reset | Not emitted | N/A — not used |
| `line-clamp` | **No** (Tailwind class not used) | Needs `-webkit-line-clamp` | Yes — Tailwind v4 emits `-webkit-line-clamp` via `line-clamp-N` utility | N/A — not used |
| `-webkit-font-smoothing` | **Yes** — in `globals.css` base layer, `html {}` | Yes | Manual — already present | OK |

**Key finding**: No `backdrop-filter`, `text-stroke`, `appearance`, or `line-clamp` utilities are used in any Sprint A component. Zero prefix risk.

---

## Safari-Specific Bug Analysis

### `position: sticky` on table elements

- **Risk**: Safari has a known bug where `position: sticky` does not work on `<thead>`, `<tr>`, or `<td>` inside a table.
- **Finding**: `VilleTissuEconomique.tsx` renders a `<table>` (desktop ≥ sm, hidden on mobile). **No `sticky` class applied anywhere** on the table or its children. The component uses only static positioning.
- **Verdict**: No risk.

### `100vh` — iOS Safari viewport height bug

- **Risk**: `100vh` on iOS Safari historically includes the browser chrome (address bar) height, causing content overflow. Recommended fix: `100dvh` or `min-h-screen` (Tailwind maps to `100vh` but Tailwind v4 also supports `min-h-dvh`).
- **Finding**: Sprint A components use **zero** `100vh`, `100dvh`, or `min-h-screen` direct usages. The two `100vh` instances in `globals.css` are in `.admin-layout` and `.admin-shell` (admin-only, lines 462 and 676) — not public-facing Sprint A components.
- **Verdict**: No risk for Sprint A. Admin `100vh` is a pre-existing item out of scope.

### `gap` on flexbox — old Safari < 14.1

- **Risk**: Safari < 14.1 had no support for `gap` on `display: flex`. Heavily used in Sprint A.
- **Finding**: Sprint A uses `gap-*` on flex contexts extensively (e.g. `flex items-center gap-2`, `flex flex-col gap-1.5`). However, **browserslist target is Safari >= 16.4** — well above the 14.1 threshold.
- **Verdict**: No risk. Clean on all declared targets.

### `aspect-ratio` — Safari 15+ required

- **Risk**: `aspect-ratio` is unsupported before Safari 15.
- **Finding**: `aspect-ratio` is not used directly in Sprint A components. `CaseStudyMarquee.tsx` uses `aspect-[16/9]` (Tailwind `aspect-ratio` utility) inside a `<figure>`. Safari 16.4+ is fully supported.
- **Verdict**: No risk.

### CSS animation via inline `style` + `animation-play-state` class toggle

- **Finding (CaseStudyMarquee)**: The marquee uses `style={{ animation: 'caseScrollX var(--marquee-duration) linear infinite' }}` (inline) combined with `.group:hover .case-marquee-track { animation-play-state: paused }` in `globals.css`. This pattern (mixing inline animation with class-controlled play-state) works in Safari 16.4+ without issues.
- **Verdict**: No risk.

---

## iOS Viewport Height Handling

**Sprint A public components**: No `100vh`, `100dvh`, or `min-h-screen` used.  
**globals.css admin classes**: `min-height: 100vh` at lines 462 and 676 — admin-only, not affected by iOS viewport chrome bug in practice since admin is used on desktop.

**Status**: OK for Sprint A. Pre-existing admin usage is a P3 cosmetic (not Sprint A scope).

---

## Form Input iOS Styling

**Finding**: Zero `<input>`, `<select>`, or `<textarea>` elements in any Sprint A component. All 43 components are display/layout-only (Server Components, no form primitives).

iOS Safari adds default styling (border-radius, gradient, inner shadow) to inputs — this is entirely not applicable here.

**Status**: N/A — no form inputs in Sprint A.

---

## Font Smoothing

**Finding**: `globals.css` base layer (`html {}`, line 204):
```css
-webkit-font-smoothing: antialiased;
```

This is the standard macOS/iOS font rendering target and is present globally. Sprint A components inherit it automatically.

**Status**: OK — antialiased set globally, no per-component override needed.

---

## `<dialog>` / `showModal()` — ImageLightbox

`CaseStudyMarquee.tsx` uses `ImageLightbox` (client component) which calls `dialogRef.current.showModal()`.

- `<dialog>` element + `showModal()`: Safari 15.4+
- Browserslist target: Safari 16.4+
- `::backdrop` pseudo-element (used in Tailwind class `backdrop:bg-black/80`): Safari 15.4+

**Status**: OK — all within Safari 16.4+ target.

---

## `group-open:` variant — VilleFaqGeolocalisee `<details>/<summary>`

`VilleFaqGeolocalisee.tsx` uses `<details class="group">` + `<span class="... transition-transform group-open:rotate-45">`.

Tailwind v4 generates `group-open` using:
```
r("open", ["&:is([open], :popover-open, :open)"])
```

The generated CSS selector includes the `[open]` attribute fallback (not just `:open` pseudo), so it works in Safari 16.4+ (which supports both). The `transition-transform` + rotate snaps instantaneously when `prefers-reduced-motion: reduce` is active (global `transition-duration: 0ms !important` from `globals.css` line 430).

**Status**: OK.

---

## `scale-[1.04]` Static Transform — ImplementationComparisonMatrix

The highlighted pricing card uses `lg:scale-[1.04]` as a **static** (non-animated, non-hover) transform. This creates a stacking context. No overflow-hidden parent wraps the grid container at the `<li>` level. Safari 16.4+ handles static `scale()` correctly.

**Status**: OK.

---

## motion-reduce Compliance vs. DESIGN_RULES.md

`DESIGN_RULES.md` line 51 mandates: `motion-reduce:transform-none motion-reduce:transition-none REQUIRED` on interactive elements with transforms.

**Findings**:

| Component | Has geo-transforms | Has `motion-reduce:` per-component | Global CSS covers |
|---|---|---|---|
| InterventionsFamiliesGrid | Yes (`hover:-translate-y-1`, `group-hover/family:scale-110`, `group-hover/family:translate-x-1`) | No | Yes (transition-duration: 0ms) |
| VilleFaqGeolocalisee | Yes (`transition-transform group-open:rotate-45`) | No | Yes (transition-duration: 0ms) |
| AuditTierGrid | Color-only | No | Yes |
| SitesWebCtaBlock | Color-only | No | Yes |
| OrangeContactBanner | Color-only | No | Yes |
| VilleCommunesProches | Color-only | No | Yes |
| CaseStudyMarquee | Animation | Yes (`motion-reduce:animate-none`) | Yes |

**Assessment**: The `globals.css` prefers-reduced-motion block sets `transition-duration: 0ms !important; animation-duration: 0ms !important` on `*` — this is functionally equivalent to per-component `motion-reduce:transition-none`. The transforms still execute on hover but snap instantly, which is acceptable behavior.

However, DESIGN_RULES.md mandates per-component `motion-reduce:transform-none`. With `transition-duration: 0ms`, `hover:-translate-y-1` still moves the card on hover (geometrically, just instantly). A strict `prefers-reduced-motion` interpretation says users who opt out of motion should not see geometric movement at all.

**This is a P2 DESIGN_RULES compliance gap for `InterventionsFamiliesGrid`** (3 geometric transforms). Not a Safari-specific bug, but a `prefers-reduced-motion` semantic gap.

---

## Issues Found

### P0 — None

No blocking Safari/WebKit issues found.

### P1 — None

No significant Safari-specific risks found.

### P2 — motion-reduce semantic gap (DESIGN_RULES non-compliance)

| ID | File | Issue | Risk |
|---|---|---|---|
| E6-P2-01 | `InterventionsFamiliesGrid.tsx` | 3 geometric transforms (`hover:-translate-y-1`, `group-hover/family:scale-110`, `group-hover/family:translate-x-1`) without `motion-reduce:transform-none` | Affects all browsers (not Safari-specific). Geometric movement still occurs on hover under `prefers-reduced-motion: reduce`, violating DESIGN_RULES.md L51. Global CSS only zeroes transition-duration (instant snap), not the transform itself. |
| E6-P2-02 | `VilleFaqGeolocalisee.tsx` | `transition-transform group-open:rotate-45` without `motion-reduce:transform-none` | Same semantic gap — the + icon rotates on open even with `prefers-reduced-motion: reduce`. Less severe (details element is stateful, not looping). |

**Recommended fix** for E6-P2-01 (15 min):
```tsx
// InterventionsFamiliesGrid.tsx
// Line 287:
"... transition-all duration-200 hover:-translate-y-1 ... motion-reduce:hover:translate-y-0"
// Line 313:
"... transition-transform duration-200 group-hover/family:scale-110 motion-reduce:group-hover/family:scale-100"
// Line 384:
"... transition-transform duration-200 group-hover/family:translate-x-1 motion-reduce:group-hover/family:translate-x-0"
```

**Recommended fix** for E6-P2-02 (5 min):
```tsx
// VilleFaqGeolocalisee.tsx line 106:
"... transition-transform group-open:rotate-45 motion-reduce:transition-none motion-reduce:group-open:rotate-0"
```

### P3 — admin `100vh` (pre-existing, out of Sprint A scope)

`globals.css` lines 462/676: `.admin-layout` and `.admin-shell` use `min-height: 100vh`. On iOS Safari, the chrome bar is included in `100vh` — could cause subtle height overshoot on mobile admin. Pre-existing, admin-only. Should migrate to `100dvh` in a future admin polish sprint.

---

## Summary Table

| Check | Result | Notes |
|---|---|---|
| `backdrop-filter` / `-webkit-backdrop-filter` | CLEAN | Not used in Sprint A |
| `text-stroke` / `-webkit-text-stroke` | CLEAN | Not used in Sprint A |
| `appearance` / `-webkit-appearance` | CLEAN | No form inputs in Sprint A |
| `line-clamp` / `-webkit-line-clamp` | CLEAN | Not used in Sprint A |
| `position: sticky` on tables | CLEAN | VilleTissuEconomique table has no sticky headers |
| `100vh` iOS bug | CLEAN | Zero usage in Sprint A public components |
| `gap` on flex (Safari < 14.1) | CLEAN | Browserslist Safari >= 16.4 |
| `aspect-ratio` | CLEAN | Browserslist Safari >= 16.4 |
| CSS animation (CaseStudyMarquee) | CLEAN | Standard @keyframes, pause-on-hover OK in Safari 16.4+ |
| `-webkit-overflow-scrolling: touch` | CLEAN | Not used anywhere |
| `overscroll-behavior` | CLEAN | Not used in Sprint A |
| `-webkit-font-smoothing: antialiased` | OK | Set globally in globals.css |
| Form input iOS styling | N/A | No form inputs in Sprint A |
| `<video>` tags / `playsinline` | N/A | No video elements in Sprint A |
| `<dialog>` / `showModal()` (ImageLightbox) | OK | Safari 15.4+ required; browserslist 16.4+ |
| `group-open:` variant (`<details>`) | OK | Tailwind v4 uses `[open]` attribute fallback |
| `motion-reduce` per-component | **P2 GAP** | InterventionsFamiliesGrid (3 transforms) + VilleFaqGeolocalisee (1 transform) missing `motion-reduce:transform-none`. Covered by global CSS for transition but geometric transforms still fire on hover. |
| Tailwind v4 autoprefixing | OK | `@tailwindcss/postcss` v4.3.0 handles `-webkit-backdrop-filter`, `-webkit-line-clamp` automatically. No separate autoprefixer installed — correctly not needed. |

---

## Verdict: GO

**No P0 or P1 Safari/WebKit issues found** across all 43 Sprint A components.

The codebase correctly:
- Targets Safari >= 16.4 (browserslist)
- Uses Tailwind v4.3.0 which auto-emits `-webkit-backdrop-filter` and `-webkit-line-clamp` (though neither is used in Sprint A)
- Sets `-webkit-font-smoothing: antialiased` globally
- Has no `100vh` in public Sprint A components
- Uses no form inputs (zero iOS input styling risk)
- Has no video elements
- Uses `<dialog>` only via ImageLightbox (Safari 15.4+ supported, target 16.4+)
- Handles `<details>/<summary>` accordion via Tailwind `group-open:` variant with `[open]` attribute fallback

Two P2 items (motion-reduce semantic gap on geometric transforms) are present but affect all browsers equally, are not Safari-specific bugs, and are functionally covered by the global `transition-duration: 0ms` prefers-reduced-motion rule. They represent a DESIGN_RULES.md documentation compliance gap; recommend addressing in a short follow-up (~20 min total).
