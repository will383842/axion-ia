# SC-12 — `cityProcessingMode='parallel'` (5 villes)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. createCampaign mode `parallel` (défaut), `anchorVilleSlugs=['paris','lyon','marseille','toulouse','nice']`
2. Tous jobs enqueued en parallèle, ordre publication non-déterministe

## Cartographie code

- Default `parallel` : `coverage.ts:278`
- Orchestrator parallèle : `content-orchestrator-worker.ts:295-370` (`processParallelCampaign`)
  - Loop `toEnqueue` fois, sample ville aléatoire à chaque iter (`Math.floor(Math.random() * villeAnchors.length)`)
  - Enqueue jobs sans synchronisation
- Worker pool : concurrency=5 par défaut sur queue content-gen

## Invariants

- ✅ Sampling uniforme aléatoire
- ✅ Pas de tracking per-city (vs sequential)
- ✅ Concurrence worker pool gère parallélisation effective

## Tests

- `coverage-controls.spec.ts:138-142`

## Verdict 🟢 OK (code)

Mode parallèle = comportement historique antérieur Sprint Controls. Sampling uniforme correct.
