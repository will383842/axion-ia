# 99 — Backlog priorisé P0 / P1 / P2

> **Source** : consolidation des 11 phases d'audit (cf. 01-11)
> **Format** : ID • Description • Phase d'origine • Effort • Citation

---

## 🔴 P0 — BLOQUANTS MERGE (1 item, ~1h30)

### P0-1 — Endpoint RGPD droit à l'oubli (art. 17 GDPR) ABSENT

- **Phase** : 7 (RGPD)
- **Impact légal** : violation RGPD art. 17 UE — l'utilisateur final ne peut pas demander la suppression de ses logs (`ImageUsageLog` + `ImageDownloadLog`, indexées par `ipHash`)
- **Recherche exhaustive** :
  ```bash
  find 'src/app/[locale]/(admin)/[adminPrefix]/image-bank' -path '*usage-logs*' -name 'route.ts' → 0
  find src/server/actions/image-bank -name '*usage*' → 0
  grep -r "deleteUsageLogsByIpHash\|forgetIpHash\|right.to.erasure\|droit.oubli" src/server → 0
  ```
- **Fix attendu** : voir `PATCHES-PROPOSES.md` §P0-1
- **Effort** : 1h30

---

## 🟠 P1 — BLOQUANTS PROD (10 items, ~25-30h cumulés)

### P1-1 — Zéro test Vitest livré (plan §1.4 demandait ≥ 80% coverage)

- **Phase** : 9
- **Impact** : confiance régression nulle avant activation prod
- **Reste à coder** : 6 unit + 1 integration + 2 e2e Playwright
- **Effort** : 12-16h

### P1-2 — Workers BullMQ non activés (`src/server/queue/worker.ts`)

- **Phase** : 5, 11
- **Cite** : `grep "startImageBank" src/server/queue/worker.ts → 0 matches`
- **Effort** : 15min après QA staging

### P1-3 — AdminSidebar groupe `image-bank` absent

- **Phase** : 3
- **Cite** : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:40-75` `buildNav()` 5 groupes sans image-bank
- **Effort** : 15min (1 navItem 9 routes)
- **Patch** : voir `PATCHES-PROPOSES.md` §P1-3

### P1-4 — Retry/backoff config workers absent

- **Phase** : 5
- **Cite** : `constants.ts:128-130` déclare `ENRICH_ATTEMPTS = 3` + `ENRICH_BACKOFF_DELAY_MS = 5000` mais aucun helper `enqueueXxx()` les consomme
- **Effort** : 1h (créer `src/server/image-bank/queues.ts` + 4 helpers)

### P1-5 — Sentry capture workers absent

- **Phase** : 5, 8
- **Cite** : 4 workers `console.error` only, pas `Sentry.captureException(err)`
- **Note** : `email-worker.ts` (référence) idem → cohérence repo, mais à harmoniser Sprint 5.x
- **Effort** : 30min

### P1-6a — Detail page `[slug]/page.tsx` hreflang alternates manquant

- **Phase** : 4
- **Cite** : `src/app/[locale]/galerie/[slug]/page.tsx:30-43`
- **Effort** : 10min

### P1-6b — Detail page `[slug]/page.tsx` og:image manquant

- **Phase** : 4
- **Cite** : `src/app/[locale]/galerie/[slug]/page.tsx:20-43` (pas de `openGraph.images`)
- **Effort** : 10min

### P1-7 — CHANGELOG.md zero entry V1

- **Phase** : 10
- **Cite** : `grep "image-bank" CHANGELOG.md → 0`
- **Effort** : 10min
- **Patch** : voir `PATCHES-PROPOSES.md` §P1-7

### P1-8 — `ImageCategory*` + `ImageTag*` sans `createdAt/updatedAt`

- **Phase** : 1
- **Cite** : `prisma/schema.prisma:3199-3245` (4 tables lookup sans temporal fields)
- **Effort** : 30min (migration ALTER TABLE + Prisma schema update)

### P1-9 — Rollback SQL "down" non documenté

- **Phase** : 1
- **Limitation Prisma** : pas de DOWN migration automatique
- **Effort** : 20min (commentaires dans `migration.sql` ou runbook séparé)

### P1-10 — Slug strategy (canonique vs per-lang) non documentée

- **Phase** : 1
- **Cite** : `prisma/schema.prisma:3098` (ImageAsset.slug) + `:3169` (ImageAssetTranslation.slug)
- **Effort** : 10min (docstring schema)

### P1-S-1 — Naming Axion-IA inconsistency X handle

- **Phase** : 8
- **Cite** : `image-jsonld-graph.service.ts:57` `"https://x.com/AxionIA"` (sans tiret)
- ⚠️ **STOP & ASK Will** : handle officiel `@axionia` ou `@axion-ia` ?
- **Effort** : 5min après réponse Will

### P1 - MIX-001 — Mélange singleton + class inline (services)

- **Phase** : 2
- **Cite** : `image-seo-enrichment.service.ts` fait `new ImageCountryDetectorService()` au lieu d'importer singleton
- **Effort** : 1-2h standardisation

### P1 - GAP-25 — `content-gen/images/image-optimizer.ts` ne réutilise pas `image-utils.ts`

- **Phase** : 2
- **Effort** : 4-6h refactor + tests

---

## 🟡 P2 — V1.5 (16 items, ~10-15h cumulés)

### P2-AEO-1 — `abstract` ≤200 chars dans ImageObject

- Phase 4 — Effort 1-2h Sprint 2.1

### P2-AEO-2 — `isBasedOn: SoftwareApplication` si AI-generated

- Phase 4 — Effort 30min

### P2-AEO-3 — `mentions` array dans ImageObject

- Phase 4 — Effort 1h

### P2-GEO-1 — `contentLocation` (Place + PostalAddress + GeoCoordinates)

- Phase 4 — Effort 1-2h

### P2-GEO-2 — `additionalProperty` targetCountries/geoRegion

- Phase 4 — Effort 1h

### P2-UI-1 — Pagination + Filters UI components `galerie/page.tsx`

- Phase 4 — Effort 2-3h

### P2-SITEMAP-1 — Early-exit `stub.invalid` explicite dans sub-sitemaps

- Phase 6, 8 — Effort 10min (best-practice cohérence `knowledge-rss.ts`)

### P2-BING-1 — Bing URL Submission API direct

- Phase 6 — Effort 2h V1.5

### P2-PERF-1 — Lighthouse audit `/fr/galerie/[SAMPLE-SLUG]` (après image seed)

- Phase 7, 11 — Effort 5min config + seed dataset

### P2-RGPD-1 — Hard delete fichiers storage si `deletedAt > 90j`

- Phase 7 — Effort 1-2h (handler `image-bank-crons-worker`)

### P2-PLAUSIBLE-1 — Custom events `gallery_view`/`image_download`/`image_embed`

- Phase 8 — Effort 1h Sprint 3.x

### P2-CF-1 — Cache Rule CF dédiée `/image-bank/*` (assets) + `/galerie/*` (pages)

- Phase 8 — Effort 30min config CF dashboard

### P2-SCALE-1 — Sub-sitemap pagination > 50K URLs (Google limit)

- Phase 11 — Effort 1-2h V1.5

### P2-W-1 — Bump import-worker concurrency 1→2 après QA

- Phase 5, 11 — Effort 5min

### P2-A — Stubs admin pages `getTranslations()` next-intl (V1.5 si EN admin)

- Phase 3 — Effort 2-3h Sprint 2.x

### P2-DOC-1/2/3 — `docs/image-bank/pipeline.md`, `admin-guide.md`, `faq.md`, `takedown.md` (DMCA)

- Phase 10 — Effort 3-4h V1.5

### P2-1 — `onDelete: SetNull` explicite `schema.prisma:3164`

- Phase 1 — Effort 5min

### P2-2 — `slugify` extracté `src/lib/slugify.ts` partagé

- Phase 1 — Effort 30min refactor

### TODO/FIXME/XXX comments — V1.5 audit cleanup

- Phase 11 — Stubs admin acceptables V1

---

## 📊 Synthèse

| Catégorie | # Items | Effort cumulé |
| --------- | ------: | ------------: |
| P0        |       1 |         ~1h30 |
| P1        |      13 |       ~25-30h |
| P2        |      19 |       ~10-15h |
| **TOTAL** |  **33** |   **~36-46h** |

---

## 🚦 Plan d'attaque recommandé

### Étape 1 — Action immédiate (bloquant merge, ~2h)

1. **P0-1** : Endpoint RGPD droit à l'oubli (~1h30)
2. **P1-7** : CHANGELOG entrée V1 (~10min)
3. **P1-3** : AdminSidebar groupe image-bank (~15min)

→ MERGE V1 sur `main` autorisé.

### Étape 2 — QA staging (~30min)

4. **P1-2** : Activer workers `src/server/queue/worker.ts`
5. **P1-6a + P1-6b** : Detail page hreflang + og:image (~20min)

→ Smoke prod /galerie + /gallery + /[slug] + /telecharger.

### Étape 3 — Sprint correctif 30j (~25-30h)

6. **P1-1** : Tests Vitest unit + integration + e2e (~12-16h)
7. **P1-4** : Retry/backoff workers helpers (~1h)
8. **P1-5** : Sentry capture workers (~30min)
9. **P1-8/9/10** : Schema lookup tables + rollback doc + slug doc (~1h)
10. **P1-S-1** : X handle (après réponse Will, ~5min)
11. **MIX-001 + GAP-25** : Refactor services + image-utils reuse (~6-8h)

### Étape 4 — V1.5 (Sprint 2.1+, ~10-15h)

12. AEO/GEO perfection (~5h)
13. UI Pagination + Filters galerie (~2-3h)
14. Hard delete storage 90j (~1-2h)
15. Plausible events (~1h)
16. Docs détaillées + best-practice cleanup (~3-4h)

---

## 📌 Décisions ouvertes (STOP & ASK Will)

| #   | Question                                                                              | Phase |
| --- | ------------------------------------------------------------------------------------- | ----: |
| 1   | X/Twitter handle officiel : `@axionia` ou `@axion-ia` ?                               |     8 |
| 2   | `IMPLEMENTATION-PLAN.md` skill : archiver post-V1 ou conserver as draft V1.5 ?        |    10 |
| 3   | Activer workers `worker.ts` après QA staging, ou attendre Sprint 1.5 ?                | 5, 11 |
| 4   | Bump import-worker concurrency 1→2 immédiat ou après mesure volume bulk-import réel ? | 5, 11 |
| 5   | ADR resync INP cible : 80ms (lighthouserc) ou 100ms (AGENTS.md doctrine interne) ?    |    10 |
