# 16 — TESTS & COVERAGE 2026

> Audit qualité tests : vitest unit, Playwright e2e, Axe a11y, visual regression, i18n parity.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Vitest unit

1.1 Coverage `lib/` ≥ 80 %
1.2 Coverage `hooks/` ≥ 80 %
1.3 Coverage `utils/` ≥ 90 %
1.4 Factories JSON-LD testées (snapshots)
1.5 Zod schemas testés (valid + invalid cases)
1.6 Pure functions 100 % testées
1.7 Edge cases (null, empty, max length) couverts
1.8 Tests isolés (pas de side effects DB/network)
1.9 Tests rapides (< 5 sec total)
1.10 `pnpm test --watch` developer-friendly

### 2. Playwright e2e

2.1 5 parcours critiques minimum :

- Home → /audit → réservation
- Contact form submit
- Cas concrets navigation
- Blog → service linking (si Sprint 14.6+)
- Ville pilote → réservation
  2.2 FR + EN tested
  2.3 Mobile + desktop viewports
  2.4 Browser matrix : Chrome + Firefox + WebKit
  2.5 Visual regression screenshot Top 10 pages
  2.6 Forms validation tests (happy + error paths)
  2.7 BookingCalendar UX flow
  2.8 Mega menu interaction
  2.9 Search ⌘K (Sprint 15 Pagefind) si applicable
  2.10 Cookies banner accept/reject + persistence

### 3. A11y tests

3.1 Axe-core sur 15 pages stratégiques (Playwright + @axe-core/playwright)
3.2 0 violation
3.3 Manual screen reader test 5 parcours documentés
3.4 Keyboard navigation tests (Playwright)
3.5 Focus order tests
3.6 Contrast tests (Lighthouse)
3.7 Reduced-motion tests
3.8 Tap target tests mobile
3.9 ARIA attributes correct (Axe)
3.10 Color blindness simulation OK

### 4. Performance tests (LHCI)

4.1 Lighthouse CI sur 15 pages × desktop + mobile
4.2 Sample 5 pages pSEO random
4.3 Thresholds strict (`lighthouserc.json`)
4.4 Run dans CI (gate bloquant)
4.5 Run local possible (`pnpm lhci`)
4.6 Reports archivés (`./lhci/`)
4.7 Comparaison runs (régression detection)
4.8 Bundle delta gate (size-limit)
4.9 RUM aggregation (productionn data)
4.10 CrUX query mensuelle planifiée

### 5. CI integration & gates

5.1 GitHub Actions pre-commit hooks (Husky)
5.2 PR gate : typecheck + lint + test + e2e + LHCI
5.3 PR gate bloquant si fail
5.4 Cache `node_modules` + `.next/cache` GH Actions
5.5 Tests parallèles (vitest `--threads`, Playwright `workers`)
5.6 Coverage upload (Codecov free ou Coveralls free)
5.7 Snapshot tests reviewables (PR shows diff)
5.8 Flaky tests tracker (retry max 2 OU fix)
5.9 Test fixtures (data factories réutilisables)
5.10 Test runbook (comment debugger un test fail)

## Méthode

- Phase A : Vitest + Playwright config audit, coverage actuel
- Phase B : Diagnostic /50
- Phase C : Plan tests manquants
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant ajout dépendance test
2. Avant changement Lighthouse CI thresholds
3. Avant tout commit

## Cible

> Coverage `lib/` ≥ 80 %. 5 parcours e2e. 0 violation Axe. LHCI gate bloquant. PR gate complet.

## Livrables

```
audit-16-tests-SYNTHESE.md
audit-16-tests-DIAGNOSTIC.md
audit-16-tests-COVERAGE-REPORT.md
audit-16-tests-PLAN.md
audit-16-tests-MISSING.md  (liste tests à écrire)
```
