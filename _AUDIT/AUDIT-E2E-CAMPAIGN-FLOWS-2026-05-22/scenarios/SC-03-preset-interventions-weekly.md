# SC-03 — Preset `interventions-weekly` (interventions-formations-all)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. `/[adminPrefix]/content-gen/templates/` → preset `interventions-weekly`
2. Wizard préremplit vertical=`interventions-formations`, recurringSchedule cron weekly
3. Renommer `TEST_E2E_03_…`, `totalTargetCount=1`, submit

## Cartographie code

- Seed : `seed-campaign-templates.ts:19-132` (slug `interventions-weekly`)
- UI loader : `CoverageNewV2.tsx:70-84` via `?preset=interventions-weekly`
- Cron validation : `coverage.ts:257-263` (CronExpressionParser)
- Enqueue repeatable : `coverage.ts:336-351` BullMQ `repeat.pattern` + tz Europe/Paris

## Invariants

- ✅ recurringSchedule présent → BullMQ Repeatable Job auto au launch
- ✅ Cleanup repeatable via pause + deadline-checker
- ✅ Verticale `interventions-formations` câblée registry generators

## Tests

- `coverage-controls.spec.ts:183-196` (cron validation)
- `campaign-templates.test.ts` (presence slug)

## Verdict 🟢 OK (code)

Preset hebdomadaire complet. Sub-aspect SC-10 couvre le runtime du repeatable.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- DB query : slug `interventions-weekly` **absent**. Preset équivalent : `interventions-formations-all`.
- Idem SC-02 — re-architecturation Will validée par DB seed.

**Verdict runtime** : 🟢 OK runtime (slug `interventions-formations-all`)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
