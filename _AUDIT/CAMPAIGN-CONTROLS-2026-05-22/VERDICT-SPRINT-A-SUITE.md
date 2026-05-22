# VERDICT SPRINT A-SUITE P6

## Date : 2026-05-22

## HEAD post-sprint : 3705fef4

## Items livrés

| #   | Item                                                                          | Gain pts   | Statut | Commit   |
| --- | ----------------------------------------------------------------------------- | ---------- | ------ | -------- |
| 1   | Mobile hamburger sidebar (translate-x CLS=0, lg:hidden)                       | +8 D-Ops   | ✅     | 3705fef4 |
| 2   | Alert badge failed/quarantined jobs sidebar (SSR getFailedJobsCount)          | +12 D-Ops  | ✅     | 3705fef4 |
| 3   | correlationId UUID v4 inter-workers orchestrateur→gen→publish                 | +8 D-Archi | ✅     | 3705fef4 |
| 4   | factCheckScore gate publication (quarantined_factcheck si score < minScore)   | +15 D-Qual | ✅     | 3705fef4 |
| 5   | JobsLiveStream SSE component (progress bar + qualityScore + fallback polling) | +20 D-Ops  | ✅     | 3705fef4 |
| 6   | CampaignTemplate preset step 0 wizard + listCampaignTemplates SA              | +40 D-Ops  | ✅     | 3705fef4 |

## Score estimé post-sprint

3805 + 103 = **~3908/5000** (si tous verts)

## Tests

TOTAL : 10 nouveaux tests, 0 régression, **1422/1429 verts** (vs baseline 1412/1419).

- `correlation-id.test.ts` : 2 tests (UUID v4 format, unicité)
- `factcheck-gate.test.ts` : 5 tests (null/pass, 75>=40/pass, 25<40/quarantine, gate disabled, seuil exact)
- `campaign-templates.test.ts` : 3 tests (actifs retournés, inactifs exclus, tableau vide)

## Schema Prisma

Migration additive `20260522120000_add_correlation_id_content_gen_job` :

- `content_gen_jobs.correlation_id VARCHAR(36) NULLABLE`
- `content_gen_jobs.fact_check_score INTEGER NULLABLE`

## Gates

- typecheck ✅ (0 erreur)
- lint ✅ (0 erreur)
- vitest ✅ (1422/1429 — +10 nouveaux, 0 régression)

## Fichiers clés modifiés

- `src/components/admin/ui/AdminSidebarNav.tsx` — hamburger mobile + badge failed jobs
- `src/components/admin/content-gen/JobsLiveStream.tsx` — NOUVEAU composant SSE
- `src/server/actions/content-gen/jobs.ts` — getFailedJobsCount()
- `src/server/actions/content-gen/coverage.ts` — listCampaignTemplates()
- `src/server/queue/workers/content-orchestrator-worker.ts` — correlationId UUID
- `src/server/queue/workers/content-gen-worker.ts` — log correlationId
- `src/server/queue/workers/content-publish-worker.ts` — factCheckScore gate + log correlationId
- `src/components/admin/content-gen/CoverageWizardClient.tsx` — step 0 preset
- `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` — wiring failedJobsCount
- `prisma/schema.prisma` — correlationId + factCheckScore sur ContentGenJob
