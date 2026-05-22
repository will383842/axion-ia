# SC-11 — `cityProcessingMode='sequential'` (3 villes)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. createCampaign `cityProcessingMode='sequential'`, `anchorVilleSlugs=['paris','lyon','marseille']`, `totalTargetCount=6`
2. Paris doit être terminée (2 articles publiés) avant que Lyon démarre
3. `currentCityIndex` s'incrémente 0→1→2→3

## Cartographie code

- Persist mode : `coverage.ts:278`
- Orchestrator séquentiel : `content-orchestrator-worker.ts:193-289` (`processSequentialCampaign`)
  - Check `currentCityIndex`
  - Count pending jobs sur `villeAnchors[currentCityIndex]` (statuts queued/running/needs_review/quality_improving)
  - Si pending > 0 → wait N ticks
  - Sinon → enqueue batch ville courante, increment index

## Invariants

- ✅ Sequential mode persisté correctement (default `parallel`)
- ✅ Pending count couvre tous statuts intermédiaires
- ✅ Increment atomique Prisma

## Tests

- `coverage-controls.spec.ts:131-142` (cityProcessingMode stored)

## ⚠️ Note coverage

Pas de test explicite "ordre séquentiel respecté" (orchestrator behavior test absent). Test runtime nécessaire pour vérifier l'ordre effectif.

## Verdict 🟢 OK (code)

Logique séquentielle implémentée. Acquis Sprint Campaign Controls 2026-05-22.
