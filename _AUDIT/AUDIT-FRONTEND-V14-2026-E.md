# Annexe E — A11y WCAG 2.2 + Perf + Cross-browser + Tests

**Lead agent** : AGT-QUALITY
**Méthode** : static + runtime smoke (curl). Tools indisponibles cette session : Lighthouse réel, axe-core run, Playwright multi-browser, citability LLMs réels — voir Annexe F méthodologie.

## E.1 — Accessibilité WCAG 2.2 AA

| #    | Critère                                             | Verdict | Citation                                                                                        |
| ---- | --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| 4.1  | Touch targets ≥ 44×44                               | ✅      | `button.tsx:28-31` (`md:h-11`, `lg:h-12`, `icon:h-11 w-11`)                                     |
| 4.2  | Contraste WCAG AA                                   | ✅      | `pnpm contrast:check` 30 paires AA, ratios 4.32:1 → 17.72:1                                     |
| 4.3  | `prefers-reduced-motion`                            | ✅      | `globals.css:291-305` + runtime `motion/FadeInOnView.tsx:18`                                    |
| 4.4  | `<main id="main">` unique                           | ✅      | `[locale]/layout.tsx:127`, smoke curl confirme 1 occurrence                                     |
| 4.5  | 1 h1 par page                                       | ✅      | 36 pages, 36 occurrences `titleAs="h1"`                                                         |
| 4.6  | Images sans alt                                     | ✅      | 1 `<img>` (TeamGrid `alt={member.name}`), pas de `<Image>` next/image                           |
| 4.7  | Form errors `role="alert"` + `aria-live`            | ✅      | 5/5 forms : Audit, Booking (aria-live="polite"), Contact, Implementation, Newsletter            |
| 4.8  | `<html lang>`                                       | ✅      | `<html lang={locale} dir="ltr">` runtime confirmé                                               |
| 4.9  | SkipToContent                                       | ✅      | présent + intégré + test E2E `i18n.spec.ts:32-37`                                               |
| 4.10 | ARIA nav (`aria-label`/`aria-current`/`aria-modal`) | ✅      | Header, Breadcrumbs, Footer, LocaleSwitcher, NavLink, MobileNav. `aria-modal` Radix Dialog auto |

### Bonus a11y

- `eslint-plugin-jsx-a11y@6.10.2` (devDep)
- `@axe-core/playwright@4.11.3` + `jest-axe@10.0.0` installés mais aucun test e2e ne les utilise (voir E.4)
- Page `/accessibilite` présente

**Verdict E.1** : ✅ **0 P0, 0 P1, 0 P2**. Conformité WCAG 2.2 AA static cohérente.

## E.2 — Performance / Core Web Vitals

| #   | Critère                    | Verdict       | Sévérité                                                                                                                                             |
| --- | -------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | `next.config.ts` flags     | ⚠️ **E-P2-1** | `viewTransition: true` ✅. `reactCompiler` désactivé (commenté l.43-44, raison Babel/Turbopack). `ppr` désactivé (commenté l.37-38, attend Suspense) |
| 5.2 | `next/font/google`         | ✅            | `layout.tsx:2,17-39` Manrope+Inconsolata+Fraunces `display:swap`. 0 `<link>` Google Fonts manuel                                                     |
| 5.3 | LCP `<Image priority>`     | ⚠️ **E-P2-2** | Pas de `<Image>` next/image (TeamGrid migration Sprint 5 backlog). Hero LCP = texte → `next/font` `display:swap` couvre                              |
| 5.4 | `web-vitals` beacon        | ✅            | `analytics/WebVitals.tsx:1-51` + `/api/vitals` route + `scripts/vitals-report.ts`                                                                    |
| 5.5 | `size-limit` budget        | ⚠️ **E-P3-1** | `package.json:149-155` 1 preset "First load JS ≤ 100 KB". Pas de budget par page ni CSS                                                              |
| 5.6 | Speculation Rules          | ✅            | `layout.tsx:144-164` prerender moderate + prefetch eager                                                                                             |
| 5.7 | SSG `generateStaticParams` | ✅            | 11 fichiers, runtime `x-nextjs-prerender: 1`                                                                                                         |
| 5.8 | Lighthouse CI config       | ✅            | `lighthouserc.json` 3 runs, perf ≥ 0.95, LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1, TBT ≤ 200ms                                                           |

### Bonus perf

- Headers : `X-DNS-Prefetch-Control: on`, HSTS, `Cache-Control no-cache must-revalidate`, `x-nextjs-cache: HIT`
- `compress: true`, `images.formats: ["avif", "webp"]`
- `@next/bundle-analyzer` câblé via `ANALYZE=true`

**Verdict E.2** : ✅ infra **complète**. 3 dettes documentées : reactCompiler/ppr désactivés volontairement, pas d'`Image priority` car LCP texte, size-limit minimaliste.

## E.3 — Cross-browser matrix

| #   | Critère                         | Verdict                                                                                      |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | `playwright.config.ts` projets  | ✅ 5 projets (chromium, webkit, firefox, mobile-chrome Pixel 7, mobile-safari iPhone 14 Pro) |
| 6.2 | Reuse server local + retries CI | ✅ retries 2 CI, `webServer reuseExistingServer`                                             |
| 6.3 | Trace + screenshot + video      | ✅ trace `on-first-retry`, screenshot `only-on-failure`, video `retain-on-failure`           |
| 6.4 | Tests e2e couverture            | ⚠️ **E-P2-3**                                                                                | Seulement 9 tests (`smoke.spec.ts` 1 + `i18n.spec.ts` 8) × 5 browsers = 45 runs. **Aucun test `@a11y`** malgré `@axe-core/playwright` installé |
| 6.5 | Script cross-browser            | ✅ `pnpm test:e2e:cross-browser` (3 desktop browsers explicites)                             |

**Verdict E.3** : ✅ matrice + infra Playwright correctes. ⚠️ couverture e2e mince, à étendre Sprint 15+.

## E.4 — Tests Vitest + Playwright

| #   | Critère                    | Verdict                                                                                                                                                        |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 7.1 | `vitest.config.ts`         | ✅ jsdom, alias `@`, includes `src/**/*.test.{ts,tsx}` + `tests/{unit,schemas}/**`                                                                             |
| 7.2 | Coverage thresholds        | ✅ provider v8, reporter text/html/lcov, **thresholds 50%** statements/branches/functions/lines                                                                |
| 7.3 | `pnpm test --run`          | ✅ **15 files passed, 71/71 tests passed**, 0 failed, 48.96s                                                                                                   |
| 7.4 | Tests existants            | ✅ 15 fichiers : compute, forms (26 Zod), JsonLd, Container, card, Eyebrow, Hero, Price, FeatureGrid, button, HouseCalendar, utils, ProcessSteps, alert, badge |
| 7.5 | Coverage mesurée HEAD      | ❌ **E-P3-2**                                                                                                                                                  | Pas de `coverage/` — `pnpm test --run` n'a pas été lancé `--coverage`. `package.json` n'expose pas `test:coverage` |
| 7.6 | Vitest integration séparée | ✅ `vitest.integration.config.ts` + `pnpm test:integration`                                                                                                    |
| 7.7 | `vitest.setup.ts`          | ✅ testing-library/jest-dom                                                                                                                                    |

### Bonus tests

- `verify:all` chain : typecheck + lint + i18n + 4 anti-patterns + use-client + contrast + radius + tests
- `@vitest/ui@4.1.5` (devDep) → `pnpm test:ui`

**Verdict E.4** : ✅ **71/71 verts** (objectif atteint). ❌ E-P3-2 coverage non mesurée à HEAD : ajouter script `test:coverage` + CI artifact.

## E.5 — Synthèse

| Chapitre          | P0    | P1    | P2    | P3    |
| ----------------- | ----- | ----- | ----- | ----- |
| E.1 a11y          | 0     | 0     | 0     | 0     |
| E.2 perf          | 0     | 0     | 2     | 1     |
| E.3 cross-browser | 0     | 0     | 1     | 0     |
| E.4 tests         | 0     | 0     | 0     | 1     |
| **Total**         | **0** | **0** | **3** | **2** |

### Findings P2

| ID         | Description                                                                          |
| ---------- | ------------------------------------------------------------------------------------ |
| **E-P2-1** | `reactCompiler` + `ppr` désactivés (acceptable, raisons documentées)                 |
| **E-P2-2** | Pas d'`Image priority` (acceptable, LCP texte)                                       |
| **E-P2-3** | Couverture e2e mince (9 tests × 5 browsers), 0 test `@a11y` malgré axe-core installé |

### Findings P3

| ID         | Description                                           |
| ---------- | ----------------------------------------------------- |
| **E-P3-1** | `size-limit` budget minimaliste (pas par page ni CSS) |
| **E-P3-2** | Coverage non mesurée à HEAD (script absent)           |

## E.6 — Verdict Partie E

# ✅ **GO Sprint 15** (Partie E)

- 0 P0 a11y ✅
- 0 P1 a11y ✅ (objectif ≤ 3 atteint)
- **71+ tests verts** ✅
- Infra perf complète ✅ (`viewTransition`, `next/font`, WebVitals, Speculation Rules, lighthouserc, size-limit, bundle-analyzer)

5 dettes mineures à programmer après Sprint 15 (voir Annexe G).
