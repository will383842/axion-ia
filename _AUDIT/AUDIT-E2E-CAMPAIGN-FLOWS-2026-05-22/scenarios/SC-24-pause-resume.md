# SC-24 — Pause/Resume campagne (BullMQ cleanup)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Campagne running 50+ jobs en attente
2. Click "Pause" → `pauseCampaign()` Server Action
3. BullMQ jobs purgés (queue depth diminue)
4. Status DB `paused`
5. Click "Resume" → jobs ré-enqueued, status `running`

## Cartographie code

- Server Action `pauseCampaign(id)` : `axionia/src/server/actions/content-gen/coverage.ts:365-444`
  - Status → `paused` + `pausedAt`
  - BullMQ cleanup (Sprint B.2 P0-10) : findMany ContentGenJob status='queued' (take 5000)
  - Pour chaque queued : `queue.getJob('gen-${job.id}')` → `bullJob.getState()` → si {waiting, delayed, waiting-children, prioritized} → `bullJob.remove()`
  - Running jobs laissés terminer (worker vérifie campaign.status à chaque tick)
  - Repeatable cleanup si `recurringSchedule` → `queue.removeRepeatable()` (line 419-430)
- Activity log : queuedJobs purgés + repeatable removed

## Invariants

- ✅ Lazy lookup (take 5000) évite memory spike
- ✅ try/catch swallow par job (line 408-410)
- ⚠️ Pas de transaction Prisma+BullMQ 2-phase (split-brain possible si crash)
- ⚠️ Pas de retry sur removeRepeatable fail (best-effort)

## Tests

- `axionia/src/server/actions/content-gen/__tests__/coverage-controls.spec.ts` + `pause-campaign-b2.spec.ts`

## ⚠️ Gaps

1. Resume Server Action documentation absente dans ce fichier (à chercher dans `coverage.ts`)
2. Worker doit vérifier `campaign.status` à chaque tick (graceful stop running jobs)

## Verdict 🟢 OK (code)

Pause + cleanup BullMQ solide. Split-brain edge case basse proba mais à surveiller.
