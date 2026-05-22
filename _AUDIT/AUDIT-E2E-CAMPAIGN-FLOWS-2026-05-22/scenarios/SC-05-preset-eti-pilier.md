# SC-05 — Preset `eti-pilier` (un-a-un-all)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Preset `eti-pilier` → typeDistribution piliers (guide_pilier) dominants
2. audienceMix ETI dominant
3. `totalTargetCount=1`, submit

## Cartographie code

- Seed `seed-campaign-templates.ts:19-132` (slug `eti-pilier`, verticale `un-a-un`)
- Generator pilier → `axionia/src/server/content-gen/generators/guide-pilier.ts` (cf. SC-13)

## Invariants

- ✅ Verticale `un-a-un` câblée
- ✅ guide_pilier generator dans REGISTRY (`generators/index.ts:25`)
- ✅ HIGH_ITERATION_TYPES={`guide_pilier`,`landing_ville`} → 3 iter max (D2)

## Verdict 🟢 OK (code)

Preset ETI pilier opérationnel — preset + generator + boucle qualité D2 alignés.
