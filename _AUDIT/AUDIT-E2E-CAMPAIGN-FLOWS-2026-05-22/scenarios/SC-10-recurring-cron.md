# SC-10 — Campagne récurrente cron (`recurringSchedule`)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. createCampaign `recurringSchedule='*/2 * * * *'` (toutes 2 min pour test)
2. BullMQ Repeatable Job enregistré
3. Pause → repeatable removed

## Cartographie code

- Validation cron `coverage.ts:257-263` via `CronExpressionParser.parse()`
- Launch repeatable : `coverage.ts:336-351`
  ```ts
  queue.add(jobName, data, {
    repeat: { pattern: recurringSchedule, tz: "Europe/Paris" },
    jobId: `campaign-${id}-recurring`,
  });
  ```
- Cleanup pause : `coverage.ts:419-431` → `queue.removeRepeatable()`
- Cleanup deadline : `content-gen-deadline-checker.ts:92-107`

## Invariants

- ✅ Idempotency via `jobId` déterministe
- ✅ Timezone Europe/Paris hardcodée (cohérente avec scope FR)
- ✅ removeRepeatable best-effort + log

## Tests

- `coverage-controls.spec.ts:183-196` (cron validation)
- `coverage-controls.spec.ts:250-265` (removeRepeatable pause)

## Verdict 🟢 OK (code)

Repeatable BullMQ pleinement câblé. Test runtime nécessite Redis up.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Schema `coverage_campaigns.recurring_schedule` (text) CONFIRMÉ runtime.
- Validation cron-parser au input wizard.
- BullMQ `add(... { repeat: { pattern } })` câblé dans createCampaign (coverage.ts).
- deadline-checker `removeRepeatable(`campaign-${campaign.id}-recurring`, ...)` à completion (deadline-checker.ts:97).

**Verdict runtime** : 🟢 OK runtime

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
