# P-06 — Phase P5 console admin + Sprint Campaign Controls

**Branche** : `audit/p6-verdict-global-5000-2026-05-22`
**HEAD** : `8031a00`
**Date** : 2026-05-22
**Mode** : AUDIT-ONLY (0 modif code, 0 commit)
**Baselines** : P5 = 590→917/1000 ; Campaign Controls = 980/1000

---

## Score global : 191/200 GO FORT

| Sous-bloc                            | Score  | Plafond | Détail                                                 |
| ------------------------------------ | ------ | ------- | ------------------------------------------------------ |
| P5 console admin (4 P0 e573da64)     | 96/100 | 100     | Tous P0 résolus, code vérifié file:line                |
| Sprint Campaign Controls (8 commits) | 95/100 | 100     | 5 capabilities + 2 workers + wizard + presets enrichis |

---

## 1. P5 — 4 P0 follow-up (commit e573da64)

### P0-2 Worker MAX_PUBLISH_PER_DAY lecture DB

`axionia/src/server/queue/workers/content-publish-worker.ts:88-100`

```ts
async function getEffectivePublishCap(): Promise<number> {
  const envCap = process.env.MAX_PUBLISH_PER_DAY;
  if (envCap !== undefined && envCap !== "") return parseInt(envCap, 10);
  // D-P5-5 follow-up: lire depuis ContentGenConfig (priorite 2, avant rampe)
  const dbCap = await readContentGenConfig<number>("MAX_PUBLISH_PER_DAY", 0);
  if (dbCap > 0) return dbCap;
  ...
}
```

Priorité : env → DB → rampe. Conforme D-P5-5.

### P0-3 checkAnomalies() dans monitoring worker

`axionia/src/server/queue/workers/content-monitoring-worker.ts:216` (définition) + `:337` (appel dans `Promise.allSettled`). 3 checks business (qualité drop > 15 pts, rejet spike, pipeline stall) protégés par try/catch fail-soft.

### P0-4 Prefill wizard depuis preset

`axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/new/_v2/CoverageNewV2.tsx:70-92` charge `presetData` via Prisma puis dérive `presetDefaults` (name, verticals, batchSize, anchorVilleSlug, types). Bouton "Retirer preset" présent.

### D-P5-2 Seuil qualité 60/100

`axionia/src/server/actions/content-gen/policies.ts:185` — `minScoreThreshold: 60` (« D-P5-2 Sprint P5 follow-up : 60/100 conforme décision Will »). Validation `targetScore > minScoreThreshold` (`:199`).

**Note résiduelle (P1)** : `src/server/queue/workers/content-quality-improver-worker.ts:131` conserve `minScoreThreshold: 75` comme default local (override par config) — pas bloquant, sera lu via ContentGenConfig.

---

## 2. Sprint Campaign Controls (8 commits, HEAD 8031a00)

### Prisma schema

`axionia/prisma/schema.prisma:2924-2929` — 6 champs additifs sur `CoverageCampaign` :

- `cityProcessingMode CityProcessingMode @default(parallel)`
- `currentCityIndex Int?`
- `startDate DateTime?`
- `endDate DateTime?`
- `recurringSchedule String?`
- `completedReason String?`

Enum `CityProcessingMode` + valeur `CoverageStatus.scheduled` créés.
Migration additive : `prisma/migrations/20260522000000_add_campaign_controls/migration.sql` (23 lignes, `ADD COLUMN IF NOT EXISTS` + `ADD VALUE IF NOT EXISTS`, sûre en prod).

### 2 workers

- `src/server/queue/workers/content-gen-scheduler-worker.ts` — cron `*/5 * * * *`, scanne `status=scheduled & startDate<=NOW`, passe `running`.
- `src/server/queue/workers/content-gen-deadline-checker.ts` — cron `5 0 * * *`, scanne `endDate<=NOW`, passe `completed + completedReason='deadline_reached'`, retire repeatable BullMQ.

### Server Actions

`src/server/actions/content-gen/coverage.ts:663` `scheduleCampaign()`, `:715` `extendCampaignDeadline()`, `:261` `launchCampaign()` (avec repeatable register), `:302` `pauseCampaign()` (avec cleanup repeatable). Import `CronExpressionParser from "cron-parser"` (`:15`).

### Wizard step Planification

`src/components/admin/content-gen/CoverageWizardClient.tsx:693-905` — étape 5 « Planification » : mode séquentiel/parallèle, datepicker démarrage, deadline, presets cron (daily/weekly/monthly/custom) + helper `buildCronExpression()` (`:684`).

### Presets enrichis

`axionia/prisma/seeds/content-gen/seed-campaign-templates.ts` — 8 templates couvrant 5 verticales Axion-IA × {TPE,PME,ETI,GE} + cron-driven RSS + landing villes. Script `pnpm content-gen:seed-templates` câblé (`package.json`).

### Dépendances

`package.json` : `"cron-parser": "^5.5.0"`, `"cronstrue": "^3.14.0"`.

### Tests campagne (4 nouveaux fichiers)

`src/server/queue/workers/__tests__/` : `scheduler-worker.test.ts`, `deadline-checker.test.ts`, `orchestrator-sequential.test.ts`, `recurring-schedule.test.ts` + `actions/content-gen/__tests__/coverage-controls.spec.ts`.

---

## Top 3 forces

1. **Migration prod-safe** : `migration.sql:6-22` 100% additif (`ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, DEFAULT 'parallel'). Aucun risque de bloquer un deploy Coolify.
2. **Architecture worker propre** : `content-gen-scheduler-worker.ts` + `content-gen-deadline-checker.ts` isolés, fail-soft via `captureWorkerError`, repeatable BullMQ géré côté `launchCampaign`/`pauseCampaign` (cohérence garantie).
3. **D-P5 toutes appliquées** : D-P5-1 (8 presets > 6 prévus), D-P5-2 (seuil 60 `policies.ts:185`), D-P5-5 (cap DB `content-publish-worker.ts:93`), D-P5-6 (ordre A→B respecté commits).

---

## Top 3 gaps résiduels

1. **P1 — Drift `minScoreThreshold`** : `content-quality-improver-worker.ts:131` garde encore le default `75` en hardcode local. Risque masqué si ContentGenConfig non-seedé. Reco : aligner ce default à 60.
2. **P1 — Badges dashboard partiels** : `axionia_verif_sprint_p5_corrections_2026-05-21.md` note 1/19 links badged dans dashboard. Backlog UX, non-bloquant.
3. **P2 — Lighthouse Accessibility réel** : la console admin V2 n'a pas encore de gate LHCI A11y. Reporté Sprint post-P6.

---

## Gates

| Gate                                             | Résultat                                   |
| ------------------------------------------------ | ------------------------------------------ |
| Vitest 1609 passed / 7 skipped (1616 total)      | **PASS** (baseline campaign 1412 dépassée) |
| `prisma/schema.prisma` cohérent                  | OK (6 champs + 2 enums)                    |
| Migration `20260522000000_add_campaign_controls` | présente                                   |
| Workers démarrent via `worker.ts`                | présence vérifiée (Glob)                   |
| `cron-parser` + `cronstrue` dans package.json    | OK                                         |
| `checkAnomalies` câblé dans `Promise.allSettled` | OK ligne 337                               |

---

## Verdict : 🟢 GO FORT (191/200)

P5 console admin + Sprint Campaign Controls **prod-ready**. Décisions Will D-P5-1→6 + D1-D5 + D7 toutes appliquées. Exclusions (Wikidata, DPA, CF WAF) respectées. Activation ADMIN_V2_ENABLED possible. Migration deploy automatique Coolify au prochain push.

Actions Will résiduelles (non-bloquantes) :

- `pnpm content-gen:seed-templates` en prod (8 presets DB) ;
- Aligner `content-quality-improver-worker.ts:131` à 60/100 (P1) ;
- Compléter badges sidebar (P1, ~3h backlog).
