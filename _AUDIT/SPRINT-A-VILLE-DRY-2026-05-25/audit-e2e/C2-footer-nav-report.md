# C-2 Footer Nav Report

**Date**: 2026-05-25
**Agent**: C-2 (Footer Nav Audit)
**Sprint context**: Sprint A Ville DRY post-refactor
**Method**: code-level static analysis — zero runtime

---

## Footer component location

`src/components/nav/Footer.tsx` — single file, async Server Component.

---

## Footer sections found

| Section | i18n key / label |
|---------|-----------------|
| Brand + tagline | `BRAND.name` / `BRAND.taglineFr` / `BRAND.taglineEn` |
| Services | `t("footer.services")` — 6 links |
| Ressources | `t("footer.resources")` — 7 links |
| Société | `t("footer.company")` — 5 links |
| Implantations | `t("nav.implantations")` — 7 links (1 hub + 6 dynamic top-PIB regions) |
| Légal | `t("footer.legal")` — 5 links |
| Bottom strip | Charte éditoriale, Transparence IA, Sitemap XML, LocaleSwitcher |
| Social | LinkedIn only (SocialLinks component) |

---

## Internal links audit

All links use the i18n-aware `<Link>` from `@/i18n/navigation` (wraps next-intl `createNavigation`), so bare paths like `/interventions` are automatically prefixed with the active locale at render time (e.g. `/fr/interventions`). Target existence is verified against `src/app/[locale]/`.

### Services section

| Label | href | Target page exists |
|-------|------|--------------------|
| Essentielle | `/interventions/essentielle` | YES — `src/app/[locale]/interventions/essentielle/page.tsx` |
| Interventions (t) | `/interventions` | YES — `src/app/[locale]/interventions/page.tsx` |
| Audit (t) | `/audit` | YES — `src/app/[locale]/audit/page.tsx` |
| Implémentation (t) | `/implementation` | YES — `src/app/[locale]/implementation/page.tsx` |
| Web & Digital IA | `/codage-developpement` | YES — `src/app/[locale]/codage-developpement/page.tsx` |
| Accompagnement 1-to-1 | `/un-a-un` | YES — `src/app/[locale]/un-a-un/page.tsx` |

### Ressources section

| Label | href | Target page exists |
|-------|------|--------------------|
| Stack IA 2026 | `/stack-ia` | YES — `src/app/[locale]/stack-ia/page.tsx` |
| Guide IA opérationnelle | `/guide-ia` | YES — `src/app/[locale]/guide-ia/page.tsx` |
| Blog (t) | `/blog` | YES — `src/app/[locale]/blog/page.tsx` |
| Glossaire | `/glossaire` | YES — `src/app/[locale]/glossaire/page.tsx` |
| Cas concrets (t) | `/cas-concrets` | YES — `src/app/[locale]/cas-concrets/page.tsx` |
| Banque d'images | `/galerie` | YES — `src/app/[locale]/galerie/page.tsx` |
| FAQ | `/faq` | YES — `src/app/[locale]/faq/page.tsx` |

### Société section

| Label | href | Target page exists |
|-------|------|--------------------|
| À propos (t) | `/a-propos` | YES — `src/app/[locale]/a-propos/page.tsx` |
| Méthodologie | `/methodologie` | YES — `src/app/[locale]/methodologie/page.tsx` |
| Contact (t) | `/contact` | YES — `src/app/[locale]/contact/page.tsx` |
| Simulateur ROI | `/roi` | YES — `src/app/[locale]/roi/page.tsx` |
| Presse | `/presse` | YES — `src/app/[locale]/presse/page.tsx` |

### Implantations section

| Label | href | Target page exists |
|-------|------|--------------------|
| Toutes les régions | `/implantations` | YES — `src/app/[locale]/implantations/page.tsx` |
| Île-de-France (top PIB) | `/implantations/ile-de-france` | YES — dynamic `[region]` page exists |
| Auvergne-Rhône-Alpes | `/implantations/auvergne-rhone-alpes` | YES — dynamic `[region]` page |
| Provence-Alpes-Côte d'Azur | `/implantations/provence-alpes-cote-d-azur` | YES — dynamic `[region]` page |
| Occitanie | `/implantations/occitanie` | YES — dynamic `[region]` page |
| Nouvelle-Aquitaine | `/implantations/nouvelle-aquitaine` | YES — dynamic `[region]` page |
| Hauts-de-France | `/implantations/hauts-de-france` | YES — dynamic `[region]` page |

Note: dynamic region pages resolved by `src/app/[locale]/implantations/[region]/page.tsx`.

### Légal section

| Label | href | Target page exists |
|-------|------|--------------------|
| Mentions légales | `/mentions-legales` | YES — `src/app/[locale]/mentions-legales/page.tsx` |
| CGV | `/conditions-generales` | YES — `src/app/[locale]/conditions-generales/page.tsx` |
| Confidentialité | `/politique-confidentialite` | YES — `src/app/[locale]/politique-confidentialite/page.tsx` |
| Accessibilité | `/accessibilite` | YES — `src/app/[locale]/accessibilite/page.tsx` |
| Cookies | `/cookies` | YES — `src/app/[locale]/cookies/page.tsx` |

### Bottom strip internal links

| Label | Component | href | Target exists |
|-------|-----------|------|---------------|
| Charte éditoriale | `<Link>` (i18n) | `/charte-editoriale` | YES — `src/app/[locale]/charte-editoriale/page.tsx` |
| Transparence IA | `<Link>` (i18n) | `/transparence` | YES — `src/app/[locale]/transparence/page.tsx` |
| Sitemap (t) | `<a>` (plain) | `/sitemap.xml` | YES — served as Next.js sitemap-index route via `src/app/sitemap.ts` |

---

## External links audit

| Label | href | rel="noopener noreferrer" | target="_blank" |
|-------|------|---------------------------|-----------------|
| LinkedIn | `https://www.linkedin.com/company/axion-ia` | YES (`noopener noreferrer external`) | YES |

**Note**: `rel="noopener noreferrer external"` — the extra `external` token is non-standard but harmless (browsers silently ignore unknown rel values). The security-critical tokens `noopener` and `noreferrer` are both present. PASS.

---

## Semantic HTML

`<footer>` HTML5 landmark tag is used as the root element of the component (line 72):

```tsx
<footer data-tone="dark" className="bg-mocha-rich ...">
```

**Result: PRESENT** — semantic landmark, a11y-compliant.

Additionally, the link columns are wrapped in a `<nav aria-label={t("nav.footerLabel")}>` element, providing a named navigation landmark for screen readers. Correct pattern.

---

## Copyright year

```tsx
const year = new Date().getFullYear();
// ...
<span>{`© ${year} ${BRAND.legalName}`}</span>
```

**Result: DYNAMIC** — year is computed at render time via `new Date().getFullYear()`. As an async Server Component, this executes on the server at each page request (or ISR revalidation). No hardcoded year. PASS.

`BRAND.legalName` resolves to `"Axion-IA"` (SSOT `src/lib/brand.ts`, line 16). Correct.

---

## Social links

| Network | Present | href | aria-label | rel | target |
|---------|---------|------|------------|-----|--------|
| LinkedIn | YES | `https://www.linkedin.com/company/axion-ia` | `"LinkedIn"` | `noopener noreferrer external` | `_blank` |
| Twitter / X | **NO** | — | — | — | — |
| Instagram | NO | — | — | — | — |
| YouTube | NO | — | — | — | — |

**LinkedIn**: PASS — `aria-label="LinkedIn"` present on the icon-only `<a>` link (SVG has `aria-hidden="true"`). Accessible to screen readers.

**Twitter/X absence**: The `SocialLinks` component contains a single `<li>` for LinkedIn only. No Twitter/X, Instagram, or YouTube links exist in the footer. This is a deliberate product decision (no other social presence linked), not a code defect. Marked as **P2** observation.

---

## `href="#"` placeholder check

**Result: NONE FOUND** — grep of `href="#"` in `Footer.tsx` returns zero matches. No placeholder links anywhere in the footer. PASS.

---

## Issues found

### P0 — Critical

None.

### P1 — Important

None.

### P2 — Minor / Observations

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| P2-1 | Twitter/X social link absent | `SocialLinks` component | Only LinkedIn is present. If Axion-IA has a Twitter/X presence, it is not linked from the footer. Not a bug if brand has no active account. |
| P2-2 | `rel="external"` non-standard token | LinkedIn `<a>` tag | `rel="noopener noreferrer external"` — `external` is not a recognized HTML rel value (IANA/WHATWG). Functionally harmless, but can be simplified to `rel="noopener noreferrer"`. |
| P2-3 | `sitemap.xml` uses plain `<a>` not i18n `<Link>` | Bottom strip | `<a href="/sitemap.xml">` — intentional (sitemap is a non-locale-aware route), but differs in pattern from other footer links. Not a bug. |
| P2-4 | `/galerie` label mismatch routing.ts | Ressources section | Footer label is "Banque d'images" / "Image bank" but routing.ts maps `/galerie` → FR `/galerie` / EN `/gallery`. Functionally correct but the FR label doesn't reflect the URL slug. Low impact. |

---

## Verdict: GO

All 30 internal footer links resolve to existing page files. The single external link (LinkedIn) has correct security attributes (`rel="noopener noreferrer"`, `target="_blank"`). The `<footer>` semantic landmark is present. Copyright year is dynamic. Social icon links carry `aria-label`. Zero `href="#"` placeholders. Zero P0/P1 issues found.

The footer is correctly wired post-Sprint A.
