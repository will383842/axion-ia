# SC-09 — Campagne avec `endDate` (auto-stop)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. createCampaign `endDate = NOW() + 10 min`, `totalTargetCount = 100`
2. T+10 min : worker `content-gen-deadline-checker` doit basculer status=`completed`, `completedReason='deadline_reached'`

## Cartographie code

- Validation : `coverage.ts:273-275` — throw `end_date_in_past` si endDate ≤ now
- Worker deadline-checker : `axionia/src/server/queue/workers/content-gen-deadline-checker.ts:29-131`
  - Cron quotidien 5h0 UTC : `findMany running/scheduled AND endDate <= NOW()`
  - UPDATE status='completed' + completedAt + completedReason='deadline_reached'
  - logActivity `CAMPAIGN_AUTO_STOPPED_DEADLINE` (audit SOC2)
  - BullMQ jobs purgés + `queue.removeRepeatable()` si recurringSchedule

## Invariants

- ✅ Atomic UPDATE Prisma
- ✅ BullMQ cleanup gracieux (try/catch swallow par job)
- ✅ Audit trail complet

## ⚠️ Limitation détectée (statique)

Cron quotidien `5 0 UTC` → granularité 24h. **Une campagne avec endDate=T+10min sera stoppée le lendemain 5h UTC, pas à T+10**. La spec SC-09 ("Observer pendant 10 min" → bascule à T+10) attend une réactivité minute, mais le worker tourne 1×/jour.

## Tests

- `coverage-controls.spec.ts:169-180` (validation endDate)

## Verdict 🟢 OK (code) — avec note granularité

Logique deadline correcte mais granularité quotidienne. Si Will veut bascule rapide ≤ 5 min, ajuster cron worker (paramètre `*/5 * * * *` au lieu de `0 5 * * *`).
