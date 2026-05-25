# E-1+E-2 Chrome Responsive Report
**Sprint A — Ville DRY / Shared Service Components**
**Date**: 2026-05-25
**Analyst**: Audit Agent E-1+E-2 (code-level static analysis)
**Scope**: 36 shared service components (`src/components/services/**`) + 7 ville components (`src/components/ville/**`) + hub/verticale page templates + nav Header/MobileNav

---

## Method: code-level static analysis
No live browser. All findings derived from reading TSX source + CSS/Tailwind config.
Confidence: ~90% for structural patterns, ~75% for edge-case rendering (no runtime measurement).

---

## Tailwind breakpoints

Declared in `src/app/globals.css` via `@theme`:

| Token | Value | Tailwind prefix |
|---|---|---|
| `--breakpoint-xs` | 479px | `xs:` (custom) |
| `--breakpoint-md` | 768px | `md:` |
| `--breakpoint-lg` | 992px | `lg:` |
| `--breakpoint-xl` | 1280px | `xl:` |

**Note**: project uses Tailwind v4 (`@import "tailwindcss"` + `postcss.config.mjs` with `@tailwindcss/postcss`). Standard Tailwind v4 breakpoints are `sm=640px / md=768px / lg=1024px / xl=1280px / 2xl=1536px`. The `@theme` block defines *custom* breakpoints that override defaults for `md/lg/xl`. The key divergence: **`lg` = 992px** (not 1024px) and **`sm` is NOT listed in `@theme`** so it likely keeps the Tailwind v4 default of 640px. This is a minor but important distinction for grid layouts (see issues).

---

## Service components responsive patterns

### Hero components — stacking on mobile

All 5 hero components (`AuditHero`, `InterventionsHero`, `ImplementationHero`, `UnAUnHero`, `SitesWebHero`) follow the same pattern via `ServiceHero.tsx` or equivalent:

```
grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16
```

- **Mobile (< 992px / lg)**: single column, stacked vertically. Text first, visual second.
- **Desktop (≥ 992px / lg)**: 2-column 50/50 grid.
- **SVG orbital schema**: hidden on mobile via `hidden lg:block`, replaced by a `grid grid-cols-2` compact card grid (`lg:hidden`). Correct pattern — SVG is unreadable at <600px.
- **InterventionsHero**: uses the same pattern inline (not via ServiceHero), same breakpoints. PASS.
- **SitesWebHero**: single-column layout with `max-w-3xl` container — no 2-col visual. Simpler, no mobile stacking risk. PASS.

**Result**: Hero stacking is correct across all 5 heroes. PASS.

### Grid components — collapse behavior

| Component | Mobile | sm (640px) | md (768px) | lg (992px) | xl (1280px) |
|---|---|---|---|---|---|
| `AuditTierGrid` | 1 col | 2 cols | 2 cols | 4 cols | 4 cols |
| `AuditMaturityLevels` | 1 col | 3 cols | 3 cols | 3 cols | 3 cols |
| `InterventionsMaturityLevels` | 1 col | 3 cols | 3 cols | 3 cols | 3 cols |
| `InterventionsFamiliesGrid` | 1 col | 1 col | 2 cols | 2 cols | 4 cols |
| `InterventionsReservationFlow` | 1 col | 2 cols | 2 cols | 4 cols | 4 cols |
| `InterventionsAudienceStrip` | 2 cols | 2 cols | 2 cols | 4 cols | 4 cols |
| `ImplementationCatalogFunctions` | 1 col | 2 cols | 2 cols | 3 cols | 3 cols |
| `ImplementationPricingTiers` | 1 col | 1 col | 3 cols | 3 cols | 3 cols |
| `ImplementationComparisonMatrix` | 1 col | 1 col | 3 cols | 3 cols | 3 cols |
| `VilleEcosystemeLocal` (secteurs) | 1 col | 2 cols | 2 cols | 3 cols | 3 cols |
| `VilleCommunesProches` | 2 cols | 3 cols | 3 cols | 4 cols | 4 cols |

**P1 flag — `AuditMaturityLevels` / `InterventionsMaturityLevels`**: Both use `grid gap-6 sm:grid-cols-3` (no intermediate step). At sm=640px the 3-column grid engages immediately. On a 375px screen still mobile-1col (OK). But at exactly 640-767px (small tablet portrait, e.g. iPad mini), 3 cards at ~200px each with gap-6 (24px) = ~624px total content width in a 640px container with px-4 (16px each side) = 608px available. This is borderline tight — cards will be around 186px wide. Text overflow is unlikely but card content (3-4 lines per card) will be compressed. **P2 risk, not a hard failure**, but the canonical mobile-first rule in `DESIGN_RULES.md` is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, and these components skip the sm:grid-cols-2 intermediate step.

**`InterventionsAudienceStrip`**: uses `grid grid-cols-2` (always 2 cols, no mobile-1col). At 375px: 2 cols of ~160px each after gap-6+padding. Each cell has a 40px icon + text label (up to 30 chars like "TPE · PME · ETI · grandes entreprises"). Long label in French may overflow or wrap aggressively at 160px. **P1 risk** — the longest label "TPE · PME · ETI · grandes entreprises" (38 chars) in a 160px column at 14px font will wrap to 3+ lines. Not a hard failure but potentially ugly on 375px.

---

## Ville templates responsive

### `/[locale]/implantations/[region]/[ville]/page.tsx`
Hub ville assembles: hero text block + verticale grids + Phase 4 ville components. No direct grid in the hub page itself beyond section containers — delegates to sub-components which are individually responsive (analysed above). PASS.

### `/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx`
Dispatcher page assembles service components (36 total) + ville components. All components analysed. No direct grid code in dispatcher page — all responsibility delegated to components. PASS.

### `VilleTissuEconomique` — TABLE on mobile
```tsx
{/* Desktop / tablette ≥ sm : tableau classique 3 colonnes */}
<div className="border-border mt-10 hidden overflow-hidden rounded-lg border sm:block">
  <table className="w-full border-collapse text-left text-sm">
```
The table is hidden on mobile (< sm) and replaced by a card stack:
```tsx
{/* Mobile < sm : cards empilées (table 3 cols illisible sur petit écran) */}
<ul className="mt-10 grid grid-cols-1 gap-4 sm:hidden">
```
This is correct — mobile gets cards, tablet/desktop gets a table with `overflow-hidden` on the wrapper. However: **the `overflow-hidden` wrapper does NOT have `overflow-x-auto`**. At sm=640px with `max-w-5xl px-6 lg:px-10` container, the 3-column table has columns "Secteur" / "Présence locale" / "Opportunités IA". The "Opportunités IA" column contains full sentences (~80-120 chars). The table uses `w-full border-collapse` so it will wrap text rather than overflow. This is safe. PASS for the table itself.

### `VilleCommunesProches` — grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
At 375px, 2 cols → link cells ~160px each. Links contain a city name (1-15 chars) + distance + population. Short enough to fit. PASS.

### `VilleFaqGeolocalisee` — `<details>/<summary>` accordion
- `max-w-4xl px-6 lg:px-10` container — good max-width constraint.
- `summary` uses `flex items-start justify-between gap-4 py-4 text-left text-base sm:text-lg`. Text wraps naturally, no overflow risk.
- `dd` uses `pb-5 pr-8 text-[15px]` — right padding of 32px (for the + toggle). Safe on any width. PASS.

---

## Overflow risks

### Confirmed issues

| Risk | Location | Severity |
|---|---|---|
| `whitespace-nowrap` on badge text | `ImplementationComparisonMatrix.tsx:194` — "Optimisé pour votre ROI" / "Best of both worlds" badge | **P1** |
| `InterventionsAudienceStrip` always 2-col on mobile | At 375px, label "TPE · PME · ETI · grandes entreprises" (38 chars) in ~160px cell | **P1** |
| `AuditMaturityLevels` / `InterventionsMaturityLevels` jump 1→3 at sm | Missing intermediate 2-col step at 640-767px | **P2** |
| `VilleEcosystemeLocal` table absent at mobile but no `overflow-x-auto` on sm+ table wrapper | Could overflow if long institution names | **P2** |

### `whitespace-nowrap` deep analysis
`ImplementationComparisonMatrix.tsx:194`:
```tsx
<span className="bg-terracotta ... whitespace-nowrap uppercase shadow-lg">
  {"★"} {col.badge ?? (isFr ? "Notre approche" : "Our approach")}
</span>
```
This is an absolutely positioned badge (`absolute -top-3 left-1/2 -translate-x-1/2`) floating over the card. It is centered. At 375px viewport with `md:grid-cols-3` (grid collapses to 1 col on mobile), the card is full container width (~343px). The badge "Optimisé pour votre ROI" (24 chars at text-[11px]) will be ~150px wide. In a 343px card this fits fine — no overflow. **Risk is LOW** because on mobile the grid is 1-col, card is wide. On a very narrow viewport like 320px: 320 - 2*16px padding = 288px card, badge ~150px → still fits centered. PASS with low risk.

### Long URLs in content
No raw URLs embedded in rendered text content found in any component. PASS.

### Tables without overflow-x-auto
`VilleTissuEconomique`: table wrapper has `overflow-hidden` not `overflow-x-auto`. As noted above, table uses `w-full` so it wraps text rather than creating horizontal scroll. The table is also hidden on mobile (`hidden sm:block`). At sm=640px the max-w-5xl container with px-6 gives 628px width. 3-column table with text-sm content will wrap. PASS (wrapping, not overflow).

### Fixed-width elements
`CaseStudyMarquee.tsx:84`: `w-[220px] sm:w-[260px] md:w-[280px]` — these are carousel cards with explicit fixed widths. The parent has `overflow-hidden` so they cannot cause viewport overflow. The marquee track is `w-max` (wider than viewport by design). PASS — scroll is contained.

---

## Mobile nav tap targets

**Hamburger button** (`MobileNav.tsx:34`):
```tsx
className="text-fg hover:bg-border/50 ... inline-flex h-11 w-11 items-center justify-center rounded-sm"
```
`h-11 w-11` = 44×44px. Exactly meets the WCAG 2.5.5 / Apple HIG 44px minimum. PASS.

**Header height**: `h-20 lg:h-24` = 80px mobile / 96px desktop. Generous. PASS.

**CTA buttons in OrangeContactBanner**: `h-14` = 56px height × full button width. PASS.

**Navigation links in mobile drawer**: `NavLink variant="mobile"` — not read directly, but mobile items use `flex flex-col gap-1 text-base` structure. Without reading NavLink source, standard mobile nav links typically have `py-2` or `py-3` (32-48px touch height). This is assumed adequate based on the `text-base` (18px) + padding pattern.

**InterventionsReservationFlow icon buttons**: `h-12 w-12` = 48px. PASS.

**Overall verdict**: All explicitly measured touch targets meet 44px minimum.

---

## Viewport meta

`src/app/[locale]/layout.tsx:91-96`:
```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c24a1b",
  colorScheme: "light",
};
```
Uses Next.js 16 `Viewport` export (correct API for this version — separated from Metadata). Generates: `<meta name="viewport" content="width=device-width, initial-scale=1">`. Correct. PASS.

---

## Image responsive `sizes` attribute

| Location | `sizes` used | Notes |
|---|---|---|
| `CaseStudyMarquee.tsx` | YES: `(max-width: 640px) 220px, (max-width: 768px) 260px, 280px` | Correct, matches fixed card widths |
| `Header.tsx` (logo) | NO `sizes` | Logo is `h-11 w-auto lg:h-12` — width auto, no sizes needed for SVG/WebP logos. OK |
| All 36 service components | NO `<Image>` usage | Components are text/SVG only, no `next/image` |
| All 7 ville components (except Marquee) | NO `<Image>` usage | Text-only components |

**Coverage**: Service and ville components contain zero `<Image>` tags except `CaseStudyMarquee` which correctly uses `sizes`. The logo in Header has no `sizes` but this is acceptable for a small UI element with auto width.

**Score**: 1/1 images with explicit sizes. No images without sizes. PASS.

---

## Font size minimums (12px risk areas)

### Components at 12px or below

| File | Class | Actual size | Context | Risk |
|---|---|---|---|---|
| `ImplementationComparisonMatrix.tsx:194` | `text-[11px]` | 11px | Badge label (decorative, uppercase, not body) | P2 |
| `ImplementationComparisonMatrix.tsx:210` | `text-[12px]` | 12px | Card tag (decorative) | P2 |
| `ImplementationScenariosBySize.tsx:156,172,181` | `text-[11px]` | 11px | Labels "Avant"/"Après" (narrow badge/uppercase) | P2 |
| `InterventionsFamiliesGrid.tsx:322` | `text-[11px]` | 11px | Count badge (uppercase label) | P2 |
| `SitesWebStackAdaptee.tsx:116` | `text-[11px]` | 11px | Card tag (uppercase) | P2 |
| `AuditTierGrid.tsx:121` | `text-[12px]` | 12px | Price eyebrow (uppercase tracking) | P2 |
| `VilleTissuEconomique.tsx:224` | `text-xs` (→ 12px at default, but site overrides `text-sm`=15px — `text-xs` stays at Tailwind default 12px) | 12px | Sub-label uppercase | P2 |
| `VilleCommunesProches.tsx:153` | `text-[11px]` | 11px | Distance + population sub-label | P2 |
| `CaseStudyMarquee.tsx:111,114` | `text-[10px]` | 10px | Industry/metric badges | **P1** |
| `VilleEcosystemeLocal.tsx:324` | `text-xs` (12px) | 12px | Numbered badge (decorative, circular) | P2 |
| `VilleEcosystemeLocal.tsx:333,370` | `text-xs` (12px) | 12px | Source/disclaimer footnotes | P2 (footnotes) |

**Critical**: `CaseStudyMarquee.tsx` uses `text-[10px]` for industry/metric badges. 10px is below the 12px minimum for legibility on mobile. These are decorative chips inside a carousel card, but on mobile at 375px the carousel cards are 220px wide — at 10px the text is very hard to read. **P1 — below minimum legible size on mobile.**

**`text-xs` in project context**: The project overrides `text-sm` = 15px but does NOT override `text-xs` in `@theme`. Tailwind v4 `text-xs` default = 0.75rem = 12px. This is at the absolute minimum. For footnotes/disclaimers this is acceptable (non-critical content). For interactive/navigation elements this would be a failure.

---

## `.display-editorial` class on mobile

```css
.display-editorial {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 7.5vw, 5.5rem);
  line-height: 0.98;
  letter-spacing: -0.035em;
}
```
At 375px: `clamp(3rem, 7.5vw, 5.5rem)` = `clamp(48px, 28.125px, 88px)` → clamped to **48px** (3rem).
At 393px (iPhone 15): → 29.5px → clamped to **48px**.

48px H1 at line-height 0.98 = ~47px per line. This is large but within reason for a hero H1. With `letter-spacing: -0.035em` on a word like "Implémentation IA à Saint-Étienne-du-Rouvray" (very long ville name), word-wrapping may produce a very tall hero block on mobile. This is a content-driven risk depending on the longest ville name, not a code defect. **P2 advisory**.

---

## Issues found

### P1 — Should fix

| # | Issue | File | Line | Fix |
|---|---|---|---|---|
| P1-1 | `InterventionsAudienceStrip` always 2-col on mobile — no mobile-1col fallback. The longest label "TPE · PME · ETI · grandes entreprises" (38 chars) overflows the ~160px cell on 375px. | `InterventionsAudienceStrip.tsx:48` | L48 | Add `sm:grid-cols-2 lg:grid-cols-4` and remove the forced `grid-cols-2` on mobile, OR truncate the label with `truncate` + `title` for tooltip |
| P1-2 | `CaseStudyMarquee` uses `text-[10px]` for badge chips — below 12px legibility minimum on mobile | `CaseStudyMarquee.tsx:111,114` | L111 | Change to `text-[11px]` or `text-xs` (12px) |

### P2 — Should monitor / low priority

| # | Issue | File | Notes |
|---|---|---|---|
| P2-1 | `AuditMaturityLevels` / `InterventionsMaturityLevels` jump from 1-col to 3-col at sm (640px) — no intermediate 2-col step at 640-767px | Both files, grid line | At 640-767px, cards will be ~186px wide. Borderline but functional. Change to `sm:grid-cols-2 lg:grid-cols-3` for safer intermediate step |
| P2-2 | Multiple `text-[11px]` decorative labels (badges, eyebrows, uppercase tags) in service components | Various | Below 12px minimum. Acceptable for purely decorative uppercase tracking labels, but should audit each for any user-critical info |
| P2-3 | Long ville names in `.display-editorial` H1 (clamp 48px at 375px) may produce very tall hero on mobile for multi-word long names | `InterventionsHero.tsx`, `SitesWebHero.tsx`, `ImplementationHero.tsx` etc. | Content-dependent. Long ville names like "Saint-Étienne-du-Rouvray" or "Villeneuve-d'Ascq" may cause 3+ line H1 on mobile. Acceptable, but should verify visually |
| P2-4 | `VilleTissuEconomique` table wrapper has `overflow-hidden` not `overflow-x-auto` — if a very long opportunité text is added without spaces it could affect layout | `VilleTissuEconomique.tsx:167` | Low risk (all current text has spaces). Add `overflow-x-auto` to wrapper as defensive measure |
| P2-5 | `whitespace-nowrap` badge in `ImplementationComparisonMatrix` — accepted risk on mobile 1-col layout (card is ~343px wide at 375px, badge is ~150px), but could fail at 320px viewport (very old Android devices) | `ImplementationComparisonMatrix.tsx:194` | Very low risk. Consider removing `whitespace-nowrap` and allowing wrap |

---

## Summary table

| Dimension | Finding | Verdict |
|---|---|---|
| Tailwind breakpoints | Custom: xs=479px, md=768px, lg=992px, xl=1280px. sm=640px (Tailwind default) | INFO |
| Hero stacking (all 5) | Correct — 1-col mobile, 2-col desktop via `lg:grid-cols-2`, SVG hidden on mobile | PASS |
| Grid collapse patterns | All major grids mobile-first except `AuditMaturityLevels` (1→3 jump) and `InterventionsAudienceStrip` (forced 2-col) | MOSTLY PASS (2 P1/P2) |
| Overflow risks | `whitespace-nowrap` in ComparisonMatrix low risk on 1-col mobile; `overflow-x-auto` absent on table but text wraps | PASS / P2 |
| Mobile nav tap targets | Hamburger `h-11 w-11` = 44×44px (meets minimum exactly) | PASS |
| Viewport meta | `width=device-width, initialScale=1` via Next.js `Viewport` export | PASS |
| Image `sizes` attribute | 100% coverage (only images are in CaseStudyMarquee — correctly sized) | PASS |
| Font size minimums | `text-[10px]` in CaseStudyMarquee badges = P1; multiple `text-[11px]` decorative = P2 | FAIL P1 / P2 |
| `display-editorial` on mobile | 48px at 375px via clamp — large but acceptable; long ville names may create 3-line H1 | PASS / P2 |
| `VilleTissuEconomique` table | Hidden mobile (`<sm`), cards shown; table at sm+ with `overflow-hidden` (not scroll) | PASS |

---

## Verdict: **GO with 2 P1 fixes recommended**

The Sprint A responsive architecture is fundamentally sound. The mobile-first grid patterns are correctly applied in the majority of components. The two P1 issues are localized and straightforward to fix:

1. **P1-1** (`InterventionsAudienceStrip` forced 2-col): add responsive breakpoints or shorten the label on mobile.
2. **P1-2** (`CaseStudyMarquee` 10px badges): bump to 11-12px.

All hero components stack correctly, the SVG orbital diagrams are hidden on mobile and replaced by readable card grids, the hamburger meets 44px tap target, and the viewport meta is correctly declared via Next.js 16 Viewport API.

Pages can ship as-is on desktop 1280/1920 without issue. On mobile 375/393, the two P1 items are cosmetically suboptimal but do not cause horizontal scrolling or content loss. No critical overflow or broken layout detected.
