# Pr-08 — Tests & Coverage

**HEAD** : 81f6ea0e
**Score** : 21 / 25

## Évidence

### Test files count

- **75 fichiers `.test.ts`** dans `src/` (Vitest unitaires + intégration).
- **18 fichiers `.spec.ts`** dans `tests/e2e/` (Playwright).
- **1061 occurrences** `describe(|it(|test(` across 75 unit test files — bonne densité (~14 cas/fichier en moyenne).

### Vitest coverage

- `ci.yml:54-65` Gate A : `pnpm test:coverage` avec coverage thresholds activés en CI. Commentaire Sprint S6.3 P1-7 (2026-05-15) : "thresholds vitest.config.ts:37-43 statements/branches/functions/lines 60/55/60/60". Bloque PR si couverture descend.
- Upload coverage artifact retention 7j.

### E2E Playwright (`playwright.config.ts`)

- 5 projects : chromium, webkit, firefox, mobile-chrome (Pixel 7), mobile-safari (iPhone 14 Pro).
- CI workers 4, retries 2, fullyParallel.
- webServer CI-aware : `pnpm start` en CI (build préalable Gate B step "Build"), `pnpm dev` en local.
- Suites :
  - `a11y.spec.ts` (accessibility WCAG)
  - `admin-baseline-screenshots.spec.ts` (visual regression)
  - `i18n.spec.ts`, `smoke.spec.ts`
  - `flows/` : `contact-submission`, `seo-jsonld`, `security-headers`, `public-pages-smoke`, `admin-auth`, `language-switch`, `booking-submit`, `admin-routes`, `admin-booking-flow`
  - `content-gen/` : `landing-ville`, `news-rss`, `coverage-campaign`, `quality-loop`, `blog-article`

### Tests modules critiques (échantillon haute valeur)

- **Auth/Security** : `src/lib/magic-token.test.ts`, `src/lib/pii-redaction.test.ts`, `src/lib/knowledge/hmac.test.ts`, `src/server/actions/image-bank/forget-ip-hash.action.test.ts`, `src/server/content-gen/shared/prompt-input-escape.test.ts`, `src/server/content-gen/shared/html-sanitizer.test.ts`, `src/server/content-gen/shared/faq-sanitizer.test.ts`
- **Workers BullMQ** : 8 tests `__tests__/` dont `scheduler-worker`, `deadline-checker`, `recurring-schedule`, `orchestrator-sequential`, `factcheck-gate`, `correlation-id`, `brand-voice-drift-monitor`, `embeddings-backfill-worker`, `external-links-monitor`
- **Schemas Zod** : `_zod-schemas.test.ts` + Gate `pnpm zod:check` (pre-push + CI) — Zod schemas have tests obligatoire
- **i18n** : `en-to-fr-redirect.test.ts` (54 describe/it — couverture 301 mapping exhaustive)
- **Knowledge Base** : 17 tests `src/lib/knowledge/*.test.ts` (state-machine, banned-words, embeddings, pii-scan, quality-gates, etc.)
- **Content-gen** : `seo-content-gen-factories.test.ts`, `editorial-mix-rules.test.ts`, `search-intent-validator.test.ts`, `trust-tier.test.ts`, `external-links-injector.test.ts`
- **External links Sprint 2026-05-22** : `detect-hallucinations.test.ts`, `helpers.test.ts`, `types.test.ts`
- **Booking V1** : `state-machine.test.ts` (26 cas), `admin-actions.test.ts` (25), `quote-actions.test.ts` (23), `option-cap.test.ts`, `refund-calc.test.ts`

### Pre-push hook

- `.husky/pre-push` : `pnpm test` runs FULL Vitest suite avant push — gate dev hard.

### Baseline test count progression

- Mémoires : 1010 (2026-05-18) → 1192 (2026-05-18 S+4) → 1376 (2026-05-21 P1 base) → 1488 (2026-05-22 Sprint Perfection) → 1526 → 1591 → **1620/1627 (2026-05-22 Sprint UX, mémoire la plus récente)**.
- Cible attendue ≥ 1620 confirmée par mémoire 2026-05-22.

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (coverage thresholds modeste)** : 60/55/60/60 (statements/branches/functions/lines) sont en-dessous des standards "production-ready" usuels (80%). Le ratchet à monter progressivement. Pas un fail mais opportunité de durcir.
- **P1 (Playwright continue-on-error)** : `ci.yml:159` Playwright suite `continue-on-error: true` (cf. Pr-05). Tests existent et tournent (artifacts upload) mais ne bloquent pas PR aujourd'hui. À ratifier.
- **P2 (Tests workers BullMQ integration)** : tests existent unitaires (8 fichiers) mais pas d'évidence test integration end-to-end "queue → worker → DB" avec Redis ephémère. Gate C Docker smoke s'en approche mais reste fonctionnel.
- **P2 (visual regression baseline scope)** : `admin-baseline-screenshots.spec.ts` couvre admin V2 — pas d'évidence visuelle public marketing. Coverage incomplet a11y/visual.
- **P2 (mutation testing)** : pas de Stryker ou équivalent. Bonus, pas un fail.

## Verdict (paragraphe)

Stack tests très fournie : 75 unit Vitest (1061 cas) + 18 E2E Playwright (5 devices/browsers) + coverage thresholds CI 60/55/60/60 enforcés Gate A + pre-push runs full suite. Couverture modules critiques (auth, security, sanitizers, workers BullMQ, schemas Zod, i18n, knowledge base, content-gen factories, booking state machine, external links 2026-05-22). Progression baseline 1010 → 1620 en 5 jours documente discipline TDD active. Les principaux gaps sont (1) coverage thresholds 60 modeste à ratchet vers 80, (2) Playwright suite `continue-on-error: true` en CI aujourd'hui, (3) absence integration test BullMQ end-to-end. Score 21/25 — production-ready côté discipline + couverture, ratchet vers gates strict + thresholds 80 à planifier.
