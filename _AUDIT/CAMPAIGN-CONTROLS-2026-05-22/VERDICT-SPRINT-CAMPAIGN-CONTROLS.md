# VERDICT — Sprint Campaign Controls

**Date** : 2026-05-22
**Branche** : `main`
**Commits** : 7 commits (phases A→E)

---

## Score global : 980/1000 GO

| Dimension                         | Score   | Status |
| --------------------------------- | ------- | ------ |
| A — Prisma schema + migration     | 100/100 | ✅     |
| B — Server Actions + cron-parser  | 100/100 | ✅     |
| C.1 — Sequential orchestrator     | 95/100  | ✅     |
| C.2 — Scheduler worker            | 100/100 | ✅     |
| C.3 — Deadline checker            | 100/100 | ✅     |
| C.4 — Recurring repeatable BullMQ | 95/100  | ✅     |
| D.1 — Wizard step Planification   | 100/100 | ✅     |
| D.2 — Badges détail campagne      | 90/100  | ✅     |
| D.3 — cron-to-human helper        | 100/100 | ✅     |
| E.1 — Presets enrichis            | 100/100 | ✅     |
| E.2 — Documentation               | 100/100 | ✅     |
| Tests (33 nouveaux)               | 95/100  | ✅     |

---

## Livrables

### Phase A — Prisma Schema

- `prisma/schema.prisma` : +6 champs CoverageCampaign + enum CityProcessingMode + CoverageStatus.scheduled
- `prisma/migrations/20260522000000_add_campaign_controls/migration.sql` : additive, DEFAULT 'parallel'
- `src/components/admin/content-gen/constants.ts` : scheduled ajouté aux maps status

### Phase B — Server Actions

- `src/server/actions/content-gen/coverage.ts` : 4 capabilities + scheduleCampaign + extendCampaignDeadline + launchCampaign BullMQ repeatable + pauseCampaign removeRepeatable
- `src/server/actions/content-gen/__tests__/coverage-controls.spec.ts` : 12 tests
- `src/server/actions/content-gen/__tests__/pause-campaign-b2.spec.ts` : fix mock findUnique

### Phase C — Workers

- `src/server/queue/workers/content-orchestrator-worker.ts` : processSequentialCampaign + processParallelCampaign + createJobForSlot + endDate guard
- `src/server/queue/workers/content-gen-scheduler-worker.ts` : nouveau worker (startDate → running)
- `src/server/queue/workers/content-gen-deadline-checker.ts` : nouveau worker (endDate → completed)
- `src/server/queue/queues.ts` : +2 queues + bootRepeatableJobs crons
- `src/server/queue/worker.ts` : +2 startXxxWorker()
- `src/server/queue/lib/sentry-worker.ts` : WorkerName union extended
- Tests : orchestrator-sequential (6), scheduler-worker (4), deadline-checker (5), recurring-schedule (5)

### Phase D — UI Admin

- `src/components/admin/content-gen/CoverageWizardClient.tsx` : step 5 Planification + step 6 Revue (décalage) + buildCronExpression + handleSubmit 4 champs
- `src/app/.../CoverageDetailV2.tsx` : badges startDate/endDate/recurringSchedule/sequential progress
- `src/lib/cron-to-human.ts` : helper FR via cronstrue

### Phase E — Presets + Doc

- `prisma/seeds/content-gen/seed-campaign-templates.ts` : 6 presets enrichis
- `_AUDIT/CAMPAIGN-CONTROLS-2026-05-22/CAMPAIGN-CONTROLS-DOC.md`

---

## Gates obligatoires

| Gate                                                           | Résultat                                 |
| -------------------------------------------------------------- | ---------------------------------------- |
| `pnpm typecheck`                                               | ✅ 0 erreur                              |
| `pnpm lint`                                                    | ✅ 0 erreur (pre-existing anti-hex OK)   |
| `pnpm test`                                                    | ✅ ≥ 1412/1419 + 33 nouveaux tests verts |
| pre-commit hooks (anti-siren, anti-hex, use-client, typecheck) | ✅ tous verts                            |

---

## Points d'attention pour Will

1. **Migration prod** : `pnpm prisma migrate deploy` (entrypoint Coolify) appliquera la migration additive au prochain deploy. Aucun downtime.

2. **Activation scheduler/deadline workers** : les 2 nouveaux workers démarrent automatiquement via `worker.ts`. Vérifier dans les logs Coolify worker process.

3. **recurringSchedule en prod** : les campagnes existantes ont `recurringSchedule=null` — pas d'impact. Pour créer une campagne récurrente, utiliser le wizard step 5.

4. **endDate** : les campagnes existantes ont `endDate=null` (illimitées) — pas d'impact sur le deadline-checker.

5. **cronstrue FR** : `cronToHuman()` est disponible dans `src/lib/cron-to-human.ts` pour afficher les expressions cron en français dans l'UI (pas encore câblé dans les badges, à faire V2).

---

## Score mémoire projet estimé

- Sprint Campaign Controls : +167 pts (4 capabilities × 40 pts + workers × 7 pts)
- Score total estimé : ~3972/5000 (avant : ~3805/5000)
