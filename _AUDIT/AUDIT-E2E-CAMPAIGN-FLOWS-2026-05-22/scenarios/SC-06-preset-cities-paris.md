# SC-06 — Preset `cities-paris` (landing-villes-all)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Preset `cities-paris` → `anchorVilleSlugs=['paris']`, `typeDistribution.landing_ville` dominant
2. `totalTargetCount=1`, submit
3. Article `anchorVilleSlug='paris'` attendu

## Cartographie code

- Seed `seed-campaign-templates.ts:19-132` (slug `cities-paris`)
- Generator : `axionia/src/server/content-gen/generators/landing-ville.ts` (cf. SC-14)
- Worker orchestrator parallèle/séquentiel : `content-orchestrator-worker.ts:193-370`

## Invariants

- ✅ `anchorVilleSlugs` (Postgres array) persiste dans coverage_campaigns
- ✅ Orchestrator sample ville depuis array (parallel) ou indexée (sequential)
- ✅ ville `paris` présente dans `axionia/src/data/villes/` (seed 2100 villes acquis)

## Verdict 🟢 OK (code)

Preset villes Paris seedé, landing-ville generator présent. Gap SC-14 ⚠️ sur LocalBusiness JSON-LD + section villes proches (cf. SC-14).
