# Rapport final autopilote — Image-bank Axion-IA · 2026-05-16

## Verdict session

**Phase 0 + Phase 1 + Section A+B+C+D documentation complétion livrées intégralement.** Phases 2 → 7 implémentation prêtes à être lancées Sprint 1 → Sprint 7 IMPLEMENTATION-PLAN.md.

| Phase                                                               | Statut                            | Livrables                                                                                   |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Phase 0 — Reality-check + décisions défauts + discoveries           | ✅ Livrée                         | 01-reality-check, 02-decisions-default, 03-discoveries (8 GAPs émergents 21-28)             |
| Phase 1 — Inventaire structuré + résolution Web Vitals              | ✅ Livrée                         | 11-inventaire-existant, 12-conflit-web-vitals (Option A)                                    |
| **A** — Templates code perfection 2026                              | ✅ Livrée                         | 7 nouveaux templates dans `.claude/skills/axionia-image-bank/templates/`                    |
| **B** — Inputs Will (sans images) + 5 STOP&ASK décisions            | ✅ Livrée                         | `prompts/inputs-will-required.md`, `prompts/stop-and-ask-decisions.md`                      |
| **C** — Plans devops continuité                                     | ✅ Livrée                         | 5 fichiers `references/` (migration-data, monitoring, cron-retention, rollback, pre-launch) |
| **D** — Fixtures tests (non-images)                                 | ✅ Livrée                         | `tests/image-bank/fixtures/mock-claude-vision-responses.json` + 2 snapshots JSON-LD         |
| Phase 2 — Backend (Prisma + services + workers)                     | 🟢 Ready to start                 | Sprint 1 IMPLEMENTATION-PLAN.md prêt — templates 100% copy-paste-able                       |
| Phase 3 — Admin (15 sous-pages)                                     | 🟢 Ready to start                 | Sprint 2 IMPLEMENTATION-PLAN.md + admin-pages/README + overview-page.example                |
| Phase 4 — Public (galerie + hubs + injection métier)                | 🟢 Ready to start                 | Sprint 3 IMPLEMENTATION-PLAN.md + public-pages/README + skeletons                           |
| Phase 5 — SEO infra (sitemap-images + robots étendu + security.txt) | 🟢 Ready to start                 | Sprint 4 IMPLEMENTATION-PLAN.md + templates sitemap-images-{fr,en}-route présents           |
| Phase 6 — Seed démo + bulk-import + audit-e2e                       | ⏸️ Dépend Phase 2-5 + images Will | —                                                                                           |
| Phase 7 — Finalisation (ADRs + docs + skill bump + tag)             | ⏸️ Dépend Phase 6                 | —                                                                                           |

## Inventaire skill réel après inspection complète

**Le skill `.claude/skills/axionia-image-bank/` contient maintenant** :

### Documents racine

- ✅ `SKILL.md` (frontmatter + déclencheurs + STOP&ASK)
- ✅ `FEATURES.md` (577 lignes)
- ✅ `IMPLEMENTATION-PLAN.md` (625 lignes — Sprints 1-7 ordonnés avec commandes Bash+PowerShell)

### `prompts/` (5 fichiers)

- ✅ `image-import.md`
- ✅ `image-seo-enrichment.md`
- ✅ `image-translation.md`
- ✨ **NEW** `inputs-will-required.md`
- ✨ **NEW** `stop-and-ask-decisions.md`

### `references/` (15 fichiers)

- ✅ `architecture-overview.md`
- ✅ `axionia-stack-validated.md` (reality-check)
- ✅ `caching-strategy.md`
- ✅ `exif-xmp-copyright.md`
- ✅ `geo-targeting.md`
- ✅ `indexnow-integration.md`
- ✅ `jsonld-imageobject.md`
- ✅ `portability-other-stacks.md`
- ✅ `prisma-schema.md`
- ✅ `responsive-variants.md`
- ✨ **NEW** `migration-data-plan.md`
- ✨ **NEW** `monitoring-alerts-spec.md`
- ✨ **NEW** `cron-retention-spec.md`
- ✨ **NEW** `rollback-runbook.md`
- ✨ **NEW** `pre-launch-checklist.md`

### `templates/`

- ✅ `prisma-migration.sql` (8 tables + GIN + FTS)
- ✅ `prisma-country-migration.sql`
- ✅ `sitemap-images-fr-route.ts`
- ✅ `sitemap-images-en-route.ts`
- ✅ `next-app-route.tsx`
- ✅ `constants.ts`, `types.ts`, `README.md`
- ✅ `services/` (7 fichiers) : image-bank, image-country-detector, image-import, image-seo, image-seo-enrichment, image-translation, image-watermark
- ✨ **NEW** `services/image-attribute-validator.service.ts` (GAP-10/20 validators)
- ✨ **NEW** `services/image-taxonomy-detector.service.ts` (GAP-01 auto-tag)
- ✨ **NEW** `services/image-jsonld-graph.service.ts` (GAP-12 @graph chaining)
- ✨ **NEW** `services/taxonomy.ts` (SSOT 3 modules + axes)
- ✅ `workers/image-bank-enrich-worker.ts`
- ✨ **NEW** `workers/image-bank-import-worker.ts` (async > 5MB)
- ✨ **NEW** `workers/image-bank-translate-worker.ts`
- ✅ `actions/` (3 fichiers) : publish, translate, upload
- ✅ `components/EmbedCodeButton.tsx`, `ImageUploadDropzone.tsx`
- ✨ **NEW** `components/GalleryGrid.tsx`
- ✅ `utils/` (4 fichiers) : paths, pleonasm, slug, xml
- ✨ **NEW** `utils/image-utils.ts` (helpers Sharp partagés content-gen + image-bank, GAP-25)
- ✅ `scripts/isolation-check.ts`
- ✨ **NEW** `admin-pages/README.md` (structure 15 sous-pages + AdminSidebar + ⌘K entries)
- ✨ **NEW** `admin-pages/overview-page.example.tsx`
- ✨ **NEW** `public-pages/README.md` (structure 6 pages + JSON-LD + hreflang + ISR)

### `checklists/` (4 fichiers)

- ✅ `exit-v1.md` (106 items)
- ✅ `google-images-checklist.md`
- ✅ `perf-budget-image-pages.md`
- ✅ `seo-aeo-geo-perfection-2026.md` (75 items §22)

### Fixtures tests (axionia/tests/image-bank/fixtures/)

- ✨ **NEW** `mock-claude-vision-responses.json` (8 fixtures variées)
- ✨ **NEW** `snapshot-jsonld/image-detail-audits.snapshot.json`
- ✨ **NEW** `snapshot-jsonld/hub-audits.snapshot.json`

## Estimation effort révisée post-complétion

| Sprint                                                                                 | Sans templates | Avec skill 95% prêt (V1) |
| -------------------------------------------------------------------------------------- | -------------- | ------------------------ |
| Sprint 1 — Foundations (Prisma + services)                                             | 32-40h         | **15-20h**               |
| Sprint 2 — Admin (5 routes IMPLEMENTATION-PLAN, +10 routes perfection 2026 = 15 total) | 24h            | **18-25h**               |
| Sprint 3 — Public (galerie + détail + 3 hubs)                                          | 24h            | **15-20h**               |
| Sprint 4 — Sitemap + IndexNow + Bing API                                               | 8-16h          | **5-8h**                 |
| Sprint 5 — Auto-enrichment (workers + Claude)                                          | 16-24h         | **10-15h**               |
| Sprint 6 — Performance + Watermark                                                     | 16h            | **10-12h**               |
| Sprint 7 — Analytics + Exit V1 + ADRs + docs                                           | 8h             | **6-8h**                 |
| **TOTAL V1 perfection 2026**                                                           | ~180h          | **~95-115h**             |

Soit ~**12-15 jours-homme** (réaliste **3-4 semaines** Will).

## À FAIRE par Will (synthèse révisée)

### 🔴 BLOQUANT Sprint 1 (gate go-live démarrage)

1. **Valider décisions défauts 5 STOP&ASK** (cf. `prompts/stop-and-ask-decisions.md`) — ou trancher autrement. Toutes recommandations défaut autopilote sont applicables tel quel.

### 🟠 BLOQUANT Sprint 3 fin (injection métier)

2. **Valider liste pages métier** à patcher (cf. `prompts/inputs-will-required.md` §B4) — défaut autopilote = TOUTES pages produit V1, par-ville/techno V1.5.

### 🟠 BLOQUANT Sprint 6 (watermark)

3. **Fournir logo watermark** (cf. `prompts/inputs-will-required.md` §B3) — PNG transparent ou SVG. **Si pas de watermark voulu** : trancher #5 STOP&ASK différemment ou skip Sprint 6 watermark step.

### 🟢 Post-launch V1 (bonus AEO, non bloquant)

4. **Wikidata** : créer entrée Q-id Axion-IA (cf. `inputs-will-required.md` §B7)
5. **Soumissions externes** :
   - Sitemap-index → Google Search Console + Bing Webmaster + Yandex Webmaster + (optionnel Baidu Ziyuan)
   - Crunchbase entry
   - Bluesky handle
6. **Vérification J+14 post go-live** :
   - GSC Coverage ≥ 50% indexed
   - RUM Web Vitals p75 vert
   - cite-rate AEO > 0
7. **Cloudflare Polish + Mirage** activation (V1.5 si LCP marginal)

### 🟢 V1.5 optionnel

8. **Photographes/auteurs équipe** : enrich `Person` schema E-E-A-T (cf. §B6)
9. **Hashtags Pinterest/LinkedIn marketing** (cf. §B8) — défaut autopilote = liste suggérée

## Plan d'exécution Phase 2-7 (next sessions)

### Option recommandée — Sprint par Sprint multi-sessions

**Session N+1** — Sprint 1 Foundations

- Step 0a : Country table + seed (0.5j)
- Step 1.1 : 8 tables image-bank + migration SQL FTS (0.5j)
- Step 1.4 : Copie 11 services depuis skill templates (1.5j)
- Step 1.5 : Scripts + isolation-check (0.25j)
- → ~15-20h CPU

**Session N+2** — Sprint 2 Admin

- Step 2.1 : Server Actions + upload dropzone + 5 routes admin V1 (1j)
- Step 2.2 : AdminCommandPalette + sidebar entry (0.25j)
- Step 2.3 : Tests E2E admin (0.75j)
- - delta perfection 2026 : 10 sous-pages supplémentaires (overview, bulk-import, analytics, quality, etc.) (1.5j)
- → ~18-25h CPU

**Session N+3** — Sprint 3 Public

- Step 3.1 : Index + détail + 3 hubs (1.5j)
- Step 3.4 : Tests E2E public + injection métier (1j)
- → ~15-20h CPU

**Session N+4** — Sprint 4-5 SEO + Workers

- Sprint 4 : Sitemap-images + IndexNow + Bing API (~6h)
- Sprint 5 : Workers + wiring Claude (~12h)
- → ~18-20h CPU

**Session N+5** — Sprint 6-7 Perf + Finalisation

- Sprint 6 : Lighthouse + watermark + size-limit (~12h)
- Sprint 7 : Analytics + ADRs + docs + tag v1.0-image-bank (~6h)
- → ~18-20h CPU

**Total ~5 sessions × ~18-22h CPU = ~95-115h** alignés sur estimation révisée.

### Option MVP rapide (1-2 sessions)

Si Will veut V1 minimaliste rapide :

- Sprint 1 (Foundations) + Sprint 3 Step 3.1 (index + détail public, pas hubs) + Sprint 4 (sitemap simple)
- Skip : 15 admin pages (garder 3 critiques upload/library/edit), skip workers async (sync only), skip hubs publics, skip injection métier
- → ~30-40h CPU sur 1-2 sessions

## Tag git

**Non créé** : `v1.0-image-bank` requiert implémentation V1 verte sur tous gates. Posé en livrable Sprint 7.

---

## Commits + push cette session

| Commit    | Push | Scope                                                     |
| --------- | ---- | --------------------------------------------------------- |
| `0cc0a93` | ✅   | docs(audit): Phase 0+1 reality-check + inventaire         |
| `8e1b023` | ✅   | docs(audit): clarif Will source images = uploads humains  |
| `ce0b0f0` | ✅   | docs(audit): GAP-26 invalide (skill trouvé path projet)   |
| (à venir) | —    | skill: image-bank A+B+C+D templates complétion + fixtures |

---

## Verdict global session

✅ **Documentation skill complète à 100%.** Plus aucune lacune connue pour autopilote bout-en-bout Phase 2-7.

✅ **Estimation effort divisée par 2** (180h → 95-115h) grâce à la maturité du skill + delta perfection 2026 livré.

🟢 **Sprint 1 peut démarrer immédiatement** dès que Will valide les 5 STOP&ASK (ou accepte les défauts autopilote).

🟠 **Décisions Will pending** : 1 bloquant Sprint 1 (5 STOP&ASK) + 1 bloquant Sprint 3 (liste pages métier) + 1 bloquant Sprint 6 (logo watermark si voulu). Tous ont des défauts autopilote applicables.

→ **Recommandation** : Will valide les défauts autopilote en bloc (~5 min), puis on lance Sprint 1 en session dédiée (~15-20h CPU).
