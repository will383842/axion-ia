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
