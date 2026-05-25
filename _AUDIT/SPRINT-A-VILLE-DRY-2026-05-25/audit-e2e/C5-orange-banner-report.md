# C-5 OrangeContactBanner CTAs Report

## Method: code-level static analysis

Date: 2026-05-25
Branch: chore/pricing-update-2026-05-24

---

## Banner component found at

`src/components/ville/OrangeContactBanner.tsx`

---

## CTAs in banner

| Label (FR) | Label (EN) | href | data-cta attr | Params |
|---|---|---|---|---|
| Réserver un appel | Book a call | `/appel` (via `href={"/appel" as never}`) | `orange_banner_book` | `data-source-ville={villeSlug}` if villeSlug present |
| Nous contacter | Contact us | `/contact` (via `href={"/contact" as never}`) | `orange_banner_contact` | `data-source-ville={villeSlug}` if villeSlug present |

Both CTAs receive `data-source-ville` via spread `{...villeAttr}` when `villeSlug` prop is provided.

---

## /fr/appel route: MISSING

- No `src/app/[locale]/appel/` directory exists.
- `/appel` is NOT declared in `src/i18n/routing.ts` pathnames — it is not a typed route.
- No redirect from `/appel` → any other route in `next.config.ts` or `src/proxy.ts`.
- Both CTAs use `href={"/appel" as never}` which is a TypeScript cast bypass (`as never`) to silence the type error caused by the missing routing entry.
- At runtime, clicking "Réserver un appel" will produce a **404** page (`/fr/appel` → not found).
- The component docstring acknowledges this: `"2 CTAs : Réserver un appel (/appel — futur Calendly)"` — the route is planned but not yet implemented.
- Note: `/reserver` IS declared in routing.ts (`{ fr: "/reserver", en: "/book" }`) and its page exists at `src/app/[locale]/reserver/page.tsx`. This could serve as a substitute or target for the redirect.

---

## Source tracking (data-source-ville): PRESENT (partial)

- The `villeSlug?` prop is optional. When provided, `data-source-ville={villeSlug}` is spread onto BOTH CTA links.
- However, there is NO `?source=<page>` query-string parameter appended to the `/contact` href. The tracking is analytics-only (HTML attribute for event listeners) — it does NOT pre-fill the UnifiedContactForm with a source page.
- A3 audit (C6-forms-report.md) should be checked to confirm whether UnifiedContactForm reads `?source` from the URL; if it does, the banner is missing this integration.

---

## Used in

| File | Usage | villeSlug passed? |
|---|---|---|
| `src/components/ville/OrangeContactBanner.tsx` | Component definition | n/a |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx` | Line 431 — ville hub page, mid-page | Yes: `villeSlug={ville.slug}` |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` | Line 404 — verticale `audits` | Yes: `villeSlug={ville.slug}` |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` | Line 426 — verticale `interventions` | Yes: `villeSlug={ville.slug}` |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` | Line 449 — verticale `implementations` | Yes: `villeSlug={ville.slug}` |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` | Line 464 — verticale `un-a-un` | Yes: `villeSlug={ville.slug}` |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` | Line 484 — verticale `sites-web-ia` | Yes: `villeSlug={ville.slug}` |

**NOT used in**: any `src/components/services/**` component. Service pages (non-ville assembler) do NOT include this banner.

---

## villeContext passed through

The banner does NOT accept a `villeContext` prop — it only takes `villeSlug?: string` for analytics tracking and `isFr: boolean` for locale.

The heading text is generic ("Prêt à transformer votre entreprise avec l'IA ?") with no city name interpolation. This is a deliberate design choice (simple, non-personalised headline), not a bug.

---

## Issues found

### P0 — `/appel` route does not exist (404 at runtime)

- **Severity**: P0 — CTA "Réserver un appel" on ALL 6 ville page types produces a hard 404.
- **Affected pages**: `~2150 villes × 1 hub + 5 verticales = ~12 900 page instances` all carry this broken CTA.
- **Evidence**: No `src/app/[locale]/appel/` directory, not in routing.ts, no redirect in next.config.ts or proxy.ts. The `as never` cast in the component is an intentional TypeScript bypass.
- **Fix options**:
  1. Create `src/app/[locale]/appel/page.tsx` with a Calendly embed (intended per docstring).
  2. Or add a redirect: `/appel` → `/reserver` in next.config.ts redirects (5-minute fix).
  3. Or update the CTA href to `/reserver` which already exists.
- **Recommended**: Option 2 or 3 as a quick fix; Option 1 as the long-term solution.

### P1 — `/contact` link lacks `?source=` query param for form pre-fill

- **Severity**: P1 — If UnifiedContactForm supports `?source=` URL param to pre-fill source context (as intended by the "source tracking" design), the banner does not pass it.
- **Current behaviour**: `data-source-ville` is an HTML attribute for client-side analytics only — it does NOT persist through navigation to /contact.
- **Impact**: Lost conversion funnel attribution; form arrives without city/page context.
- **Fix**: Change contact href to `/contact?source=banner-${villeSlug}` (or similar) if the form supports it.

### P1 — Banner absent from standalone service pages

- **Severity**: P1 — OrangeContactBanner is only wired into ville assembler pages. The canonical service pages (`/fr/audit`, `/fr/interventions`, `/fr/implementation`, etc.) do not use this banner.
- **Impact**: Users on service hub pages miss the mid-funnel CTA conversion opportunity.
- **Fix**: Add `<OrangeContactBanner isFr={isFr} />` (without villeSlug) to service page assemblers.

### P2 — TypeScript `as never` cast on `/appel` href

- **Severity**: P2 — Both usages of `/appel` use `as never` to bypass next-intl typed route checking (`href={"/appel" as never}` in OrangeContactBanner, `href="/appel"` in ville page.tsx).
- **Impact**: Type safety is bypassed; if the route is added later but misnamed, there will be no compile-time error.
- **Fix**: Once `/appel` is declared in `routing.ts` pathnames, remove the `as never` cast.

---

## Verdict: NOGO

**Blocker**: The primary CTA "Réserver un appel" links to `/fr/appel` which does not exist — a hard 404 affecting ~12 900 page instances across all ville and verticale templates.

**Quick fix (5 min)**: Add a redirect in `next.config.ts`:
```ts
{ source: "/appel", destination: "/reserver", permanent: false }
```
(Also add `"/:locale/appel"` → `"/:locale/reserver"` to cover locale-prefixed URLs.)

**Full fix**: Create the `/appel` Calendly booking page and declare it in `routing.ts`.

Once P0 is resolved, the banner implementation is otherwise sound: Server Component pure (zero JS), bilingual, `data-source-ville` analytics tracking present, correctly wired in all 6 assembler contexts with `villeSlug` prop.
