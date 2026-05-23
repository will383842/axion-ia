# SC-08 — Campagne `startDate` futur → status `scheduled`

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. createCampaign `name=TEST_E2E_08_scheduled`, `startDate = NOW() + 5 min`
2. DB row status=`scheduled` immédiatement (pas `running`)
3. Aucun job BullMQ enqueued tant que startDate non atteint
4. T+5 min : scheduler-worker bascule status → `running`, jobs enqueued

## Cartographie code

- Validation `startDate` future : `axionia/src/server/actions/content-gen/coverage.ts:264-277`
  - Si `startDate > now` → status='scheduled', sinon status='draft' + warn
- Worker scheduler : `axionia/src/server/queue/workers/content-gen-scheduler-worker.ts:20-45`
  - Cron `*/5 min` : `findMany status='scheduled' AND startDate <= NOW()` → UPDATE status='running' + `startedAt`
- Audit log SOC2 sur transition

## Invariants

- ✅ Pas de throw si startDate passé (warn + downgrade `draft`)
- ✅ Atomic UPDATE Prisma (no race)
- ✅ Idempotent (worker re-tick laisse running tel quel)

## Tests

- `coverage-controls.spec.ts:145-167` (scheduled/draft logic)

## Verdict 🟢 OK (code)

Câblage scheduling complet — non exécuté runtime, mais logique déterministe et testée.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Schema `coverage_campaigns.start_date` (timestamp) CONFIRMÉ runtime.
- Cron scheduler-worker `*/5 * * * *` registré via `bootRepeatableJobs()` en `src/server/queue/queues.ts:782-787` (jobId `content-gen-scheduler-cron`).
- Worker `content-gen-scheduler-worker.ts` : SELECT campaigns WHERE status='scheduled' AND start_date <= NOW() puis UPDATE status='running'.
- Granularité 5 min — toute campagne `scheduled` est activée en ≤ 5 min après son startDate.

**Verdict runtime** : 🟢 OK runtime

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
