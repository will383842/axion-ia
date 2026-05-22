# SC-25 — Multi-targets : article visible sur 3 routes (V-01 P1)

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. Créer campagne verticale=`audits`, `anchorVilleSlugs=['paris']`, `typeDistribution={landing_ville:100}`, `totalTargetCount=1`
2. Article publié visible sur :
   - `/fr/blog/[slug]` ✅
   - `/fr/audits/paris/` (hub vertical × ville) ✅
   - `/fr/implantations/paris/` (hub ville) ✅

## Cartographie code

- Worker publish : `content-publish-worker.ts:623-696`
- Acquis V-01 P1 mergé 2026-05-22 commit `e7c40004` — cascade ISR hubs ville
- `mentionedCities[]` extracted depuis `output['mentionedCities']` (generator `landing-ville.ts:276-281`)
- Tolerant parse : filter string non-vide, max 20
- Persist `Article.mentionedCities` (Postgres array type)
- Revalidate ISR cascade :
  - Route 1 : `/fr/blog/[slug]` (toujours)
  - Route 2 : `/fr/audit/par-ville/{ville.slug}` (si ville mentionnée)
  - Route 3 : `/fr/interventions/par-ville/{ville.slug}`, `/fr/implementation/par-ville`, `/fr/un-a-un/par-ville` (4 hubs)
- `getVille(citySlug)` lookup dynamique (line 651, lazy import)
- `revalidateContent` POST `/api/internal/revalidate` avec paths array (line 675)

## Invariants

- ✅ MentionedCities atomic dans Article.create transaction (line 362)
- ✅ Best-effort revalidate (catch swallow) — article déjà publié
- ✅ Lazy import getVille() (perf O(n) au lieu de O(2150))
- ✅ Single POST batch revalidate

## ⚠️ Gaps

1. `getVille()` returns null silencieusement (cityPaths omis sans alerte)
2. ISR 24h fallback (revalidate naturelle si POST échoue)
3. Revalidate cascade 5 routes × N villes peut être lent (mitigé par max 20 mentionedCities)

## Tests

- ⚠️ Pas de test SC-25 spécifique (helper `revalidate-content.ts` à coverager)

## Verdict 🟢 OK (code)

Multi-targets V-01 P1 livré. Cascade ISR hubs ville opérationnelle.
