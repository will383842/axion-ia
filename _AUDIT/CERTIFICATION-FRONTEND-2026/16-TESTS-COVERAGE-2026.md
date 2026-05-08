# 16 — TESTS & COVERAGE 2026

> Audit qualité tests : vitest unit, Playwright e2e, Axe a11y, visual regression dédiée, mobile-specific perf, i18n parity.
> Référence thresholds : `README.md` § Thresholds canoniques.

## Audit en 7 chapitres × 10 critères = 70 points

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

### 6. Visual regression testing (dédié)

6.1 Outil OSS gratuit choisi (Lost Pixel ou Playwright `toHaveScreenshot()` natif — préférer Playwright natif)
6.2 Baseline screenshots versionés (commit dans repo OU GitHub Actions artifacts)
6.3 Coverage : Top 10 pages stratégiques × 3 viewports (mobile 375, tablet 768, desktop 1440)
6.4 Pixel diff threshold configuré (typique 0,1 % par viewport, 0,5 % global)
6.5 Anti-flake : disable animations + `waitForLoadState('networkidle')` + masquer dates/random
6.6 Snapshots reviewables sur PR (GitHub Actions artifacts publics OU PR comment)
6.7 Update-snapshots flow documenté (`pnpm test:e2e --update-snapshots` après validation visuelle)
6.8 Scenarios par état (default, hover, focus, dark mode si applicable)
6.9 Cadence : run sur chaque PR + nightly full
6.10 Procédure rejet faux positif (screenshot diff manuel review obligatoire)

### 7. Mobile-specific performance tests

7.1 Lighthouse mobile preset configuré (LTE / Slow 4G throttling)
7.2 Émulation device bas de gamme (Moto G4 ou Galaxy A50)
7.3 Test mobile sur Top 5 pages × 2 réseaux (4G + Slow 3G simulés)
7.4 RUM aggregation filtrée par device class (mobile / tablet / desktop)
7.5 Top 10 worst LCP/INP par device class identifiés mensuel
7.6 Tap target test automatique (Axe-core viewport mobile)
7.7 Pinch-zoom + orientation tests (Playwright `setViewportSize` + emulate)
7.8 Touch gestures alternatives (swipe → button) testées
7.9 Service Worker offline cache test (si activé)
7.10 PWA install prompt test (si manifest configuré)

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

## Anti-patterns à éviter (Pitfalls)

- ❌ Snapshot tests qui cassent au refactor (testent l'implémentation, pas le comportement)
- ❌ Sur-mocking qui casse la confiance (mock DB → tests OK mais prod casse)
- ❌ Visual regression sans masquage dates/random (faux positifs garantis)
- ❌ Mobile perf testé uniquement en desktop throttled (ne reproduit pas appareil bas de gamme)
- ❌ Coverage % comme but ultime (qualité tests > quantité)
- ❌ E2e qui dépend d'API tierce non mockée (flaky)
- ❌ PR gate désactivable au cas par cas (slippery slope)

## Cible

> Coverage `lib/` ≥ 80 %, `hooks/` ≥ 80 %, `utils/` ≥ 90 %. 5 parcours e2e. 0 violation Axe. Visual regression Top 10 × 3 viewports (Lost Pixel ou Playwright). Mobile perf Lighthouse ≥ 90 sur Slow 4G + device bas de gamme émulé. LHCI gate bloquant. PR gate complet.

## Livrables

```
audit-16-tests-SYNTHESE.md
audit-16-tests-DIAGNOSTIC.md
audit-16-tests-COVERAGE-REPORT.md
audit-16-tests-PLAN.md
audit-16-tests-MISSING.md  (liste tests à écrire)
```
