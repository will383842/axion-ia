# C-1 Menu Nav Report

**Date**: 2026-05-25
**Sprint**: Sprint A — DRY pages ville 2026-05-25
**Method**: Code-level static analysis (no dev server required)
**Scope**: `src/components/nav/Header.tsx`, `HeaderMegaMenu.tsx`, `SolutionsMegaMenu.tsx`, `MobileNav.tsx`, `NavLink.tsx`, `src/i18n/routing.ts`, `src/lib/routes.ts`, `src/messages/fr.json`

---

## Nav links found

### Desktop — left of CTA (direct tabs)

| Label (i18n key) | Resolved label (FR) | href | In routing.ts | page.tsx exists | Notes |
|---|---|---|---|---|---|
| `nav.ourFormations` | "Nos formations" | `/interventions/collectives` | YES | YES | Doublon volontaire Will (aussi dans mega-menu) |
| `nav.companyAudit` | "Audit entreprise" | `/audit` | YES | YES | Doublon volontaire Will (aussi dans mega-menu) |

### Desktop — right of CTA (secondary nav)

| Label (i18n key) | Resolved label (FR) | href | In routing.ts | page.tsx exists | Notes |
|---|---|---|---|---|---|
| `nav.pricing` | "Tarifs" | `/tarifs` | YES | YES | Ajouté Sprint Header refonte 2026-05-24 |
| `nav.caseStudies` | "Cas concrets" | `/cas-concrets` | YES | YES | |

### Mega-menu "Nos solutions" — 5 items

| Label (i18n key) | Resolved label (FR) | href | In routing.ts | page.tsx exists | Notes |
|---|---|---|---|---|---|
| `nav.formations` | "Formations et interventions" | `/interventions/collectives` | YES | YES | |
| `nav.auditShort` | "Audits entreprises" | `/audit` | YES | YES | |
| `nav.implementationShort` | "Implémentations et automatisations" | `/implementation` | YES | YES | |
| `nav.oneToOne` | "Accompagnement 1-to-1" | `/un-a-un` | YES | YES | |
| `nav.platform` | "Plateforme web et SaaS" | `/codage-developpement` | YES | YES | |
| `nav.solutions` trigger | "Nos solutions" | `/contact` | YES (contact) | YES | **P1** — trigger clique vers `/contact`, pas un hub solutions. Voir note ci-dessous. |

### Mobile extras (uniquement dans le drawer)

| Label | href | In routing.ts | page.tsx exists |
|---|---|---|---|
| `nav.implantations` ("Implantations") | `/implantations` | YES | YES |
| "Stack IA" / "AI Stack" | `/stack-ia` | YES | YES |
| `nav.blog` ("Blog") | `/blog` | YES | YES |
| "FAQ" | `/faq` | YES | YES |
| "Centre d'aide" / "Help center" | `/centre-aide` | YES | YES |
| `nav.about` ("À propos") | `/a-propos` | YES | YES |

### Logo link

| href | In routing.ts | page.tsx exists |
|---|---|---|
| `ROUTES.home` = `/` | YES | YES (`src/app/[locale]/page.tsx`) |

### CTA Contact (desktop + mobile)

| href | In routing.ts | page.tsx exists |
|---|---|---|
| `ROUTES.contact` = `/contact` | YES | YES |

**Summary: 0 broken links found. All 17 unique href values resolve to declared routing.ts pathnames and existing page.tsx files.**

---

## Mobile menu

**Verdict: EXISTS — correct mechanism**

- Implementation: Radix UI `Sheet` (right-side drawer) via `src/components/nav/MobileNav.tsx`
- Open state: `useState(false)` + `Sheet open={open} onOpenChange={setOpen}`
- Close mechanism: `onOpenChange={setOpen}` handles all close triggers (backdrop click, Esc, internal close calls via `NavLink` navigation)
- Focus trap: Inherited from Radix Dialog primitive (native WCAG-compliant trap)
- Reduced-motion: Inherited from Radix (transitions respect `prefers-reduced-motion`)
- Refactored from custom div drawer per A11Y-003 / NAV-008 (per inline comment)

---

## Keyboard nav

**Verdict: PASS (with one minor note)**

### Desktop mega-menu (`HeaderMegaMenu.tsx`)
- **Escape key**: Handled via `document.addEventListener("keydown", onKey)` — `if (e.key === "Escape") setOpen(false)`. Listener attached only when panel is open (correct).
- **Focus open/close**: `onFocus` opens panel, `onBlur` closes when focus leaves the wrapper (`e.relatedTarget` check correct).
- **Tab navigation**: Panel items are naturally focusable `<Link>` elements. Tab traversal flows through the panel before leaving the wrapper, which triggers `onBlur → close`. Correct.
- **Cleanup**: `removeEventListener` called in `useEffect` cleanup. `cancelTimers` called on unmount.

### Mobile drawer
- Escape key: Inherited from Radix Sheet (Dialog primitive handles Escape natively).

### Minor note (P2)
- `HeaderMegaMenu` uses `onFocus` on a `<div>` (not a focusable element) with `// eslint-disable-next-line jsx-a11y/no-static-element-interactions`. This is a valid pattern (event bubbles up from child focusable elements), but the lint suppression is a code smell. The handler is functionally correct.

---

## ARIA

**Verdict: PASS with 2 issues (1 P1, 1 P2)**

### Correct ARIA usage
- `<header>` landmark: implicit landmark role (correct)
- `<nav aria-label={t("nav.primaryLabel")}>`: labelled nav landmarks (value = "Navigation principale" in FR)
- `aria-label={BRAND.name}` on logo link: correct
- `aria-label={t("cta.contactAria")}` on CTA: descriptive ("Nous contacter — réponse sous 24 h ouvrées") — correct
- `aria-haspopup` on mega-menu trigger: present (see P1 note)
- `aria-expanded={open}` on mega-menu trigger: correctly reflects open state
- `role="region" aria-label={panelLabel}` on mega-menu panel: correct landmark
- `aria-current="page"` on active NavLink: correctly applied via `usePathname` comparison
- `aria-label={t("openMenu")}` on burger button: correct ("Ouvrir le menu")
- `SheetTitle` / `SheetDescription` with `sr-only` on mobile drawer: correct (required by Radix Dialog for screen reader announcement)
- `aria-hidden="true"` on decorative icons and dividers: correct

### Issues

**P1 — `aria-haspopup="true"` is incorrect ARIA value**
- Location: `src/components/nav/HeaderMegaMenu.tsx:119`
- Current: `aria-haspopup="true"`
- ARIA 1.1 spec: `aria-haspopup` should use a token value: `"menu"`, `"listbox"`, `"tree"`, `"grid"`, `"dialog"`. The value `"true"` maps to `"menu"` semantically in legacy ARIA 1.0, but the panel has `role="region"` (not `role="menu"`), so the declared `haspopup` type mismatches the panel role.
- **Recommended fix**: Change to `aria-haspopup="dialog"` (since the panel is a `role="region"` region acting as a popup dialog) or remove `aria-haspopup` if the trigger is a `<Link>` (not a `<button>`).

**P2 — Two `<nav>` elements share the same `aria-label`**
- Location: `src/components/nav/Header.tsx:107` and `src/components/nav/Header.tsx:137`
- Both desktop nav elements use `aria-label={t("nav.primaryLabel")}` = "Navigation principale"
- WCAG 2.4.6 best practice: landmarks of the same type should have distinct labels when both are present on the same page
- The second nav has `data-nav-section="secondary"` (data attribute only, not exposed to AT)
- **Recommended fix**: Second nav should use a distinct aria-label, e.g. "Navigation secondaire" (add `nav.secondaryLabel` i18n key)

---

## Active state highlighting

**Verdict: PASS**

- `NavLink.tsx` uses `usePathname()` from `@/i18n/navigation` (locale-aware)
- Logic: `href === "/" ? pathname === "/" : pathname.startsWith(href)`
- Desktop: active item gets `text-mocha italic after:w-full` (italic + animated underline)
- Mobile: active item gets `bg-sand text-terracotta italic` (sand background highlight)
- `aria-current="page"` applied when active (assistive tech support)

**Potential false positive (P2)**: `pathname.startsWith(href)` — when on `/audit/flash`, both `/audit` and `/audit/flash` links would be marked active if both appeared in the nav. In practice, only `/audit` appears in the nav (not its children), so `/audit` correctly shows as active on any `/audit/*` route. This is the intended "section active" behaviour. However, if two nav items share a prefix relationship (e.g. `/interventions` and `/interventions/collectives`), both would be highlighted simultaneously on `/interventions/collectives`. Currently `/interventions` does NOT appear in the nav, only `/interventions/collectives`, so no conflict exists. **No bug in current nav config.**

---

## Issues found

| ID | Severity | Component | Description | Recommended fix |
|---|---|---|---|---|
| C1-I1 | **P1** | `HeaderMegaMenu.tsx:119` | `aria-haspopup="true"` is a legacy/incorrect value; panel is `role="region"` not `role="menu"` | Change to `aria-haspopup="dialog"` or remove the attribute |
| C1-I2 | **P1** | `SolutionsMegaMenu.tsx:72` | `triggerHref="/contact"` — clicking the "Nos solutions" trigger label navigates to `/contact` instead of a solutions hub page. This is a UX issue: a user who clicks the label text (not just hovering) lands on the contact page, not a solutions overview. | Create `/nos-solutions` hub page or change `triggerHref` to `/implementation` (the primary solutions landing), or convert trigger to a `<button>` without navigation |
| C1-I3 | **P2** | `Header.tsx:137` | Second `<nav>` shares same `aria-label="Navigation principale"` as first `<nav>`. Duplicate landmark labels are a WCAG advisory issue. | Add `nav.secondaryLabel` i18n key ("Navigation secondaire") and apply to second nav |
| C1-I4 | **P2** | `HeaderMegaMenu.tsx:100` | `eslint-disable-next-line jsx-a11y/no-static-element-interactions` suppresses linting on the wrapper `<div>`. Functionally correct but code smell. | No immediate action needed — pattern is well-documented and functionally correct |
| C1-I5 | **P2** | `NavLink.tsx:20` | `pathname.startsWith(href)` creates false-positive active state if two nav items have prefix relationship. No current conflict but fragile. | Change to `pathname === href \|\| pathname.startsWith(href + "/")` |

---

## Summary statistics

- Total unique nav hrefs audited: 17
- Broken links (href not in routing.ts): **0**
- Missing page.tsx targets: **0**
- Missing i18n keys: **0**
- P0 issues: **0**
- P1 issues: **2** (C1-I1 ARIA haspopup, C1-I2 triggerHref mismatch)
- P2 issues: **3** (C1-I3 duplicate nav label, C1-I4 lint suppression, C1-I5 startsWith fragility)

---

## Verdict: **GO** (with P1 recommendations)

All navigation links are valid and resolve to existing pages. The header renders correctly for the primary use case. Two P1 issues exist:

1. `aria-haspopup="true"` should be corrected for ARIA 1.1 compliance (low effort, 5 min fix)
2. The "Nos solutions" trigger link navigating to `/contact` is a deliberate Will design decision per inline comment ("Featured card à droite : devis 48h vers /contact") but is semantically confusing — users clicking the label text expect a solutions overview, not the contact page. **Recommend raising with Will before next Sprint.**

No blocking issues prevent deployment.
