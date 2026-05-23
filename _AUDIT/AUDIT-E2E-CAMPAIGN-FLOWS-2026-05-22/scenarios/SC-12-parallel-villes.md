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

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Default `cityProcessingMode='parallel'` (Prisma default) + orchestrator enqueue tous les jobs en parallèle pour toutes les villes anchored.
- Tests : `coverage-controls.spec.ts:131-207`.

**Verdict runtime** : 🟢 OK runtime

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
