# SC-28 — Image hero + zéro DALL-E

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. 5 articles random SC-01 à SC-25
2. Vérifier `featuredImage` non-null pour chaque
3. Vérifier `is_ai_generated=false` strict

## Cartographie code

- Helper : `axionia/src/server/content-gen/images/assign-hero-image.ts:79-207`
- Table : `ImageAsset` (schema.prisma)
- Filtre DALL-E strict : line 135-136 hard filters `isAiGenerated: false` (no override)
- Query : `prisma.imageAsset.findMany()` WHERE `isActive=true AND isAiGenerated=false AND deletedAt=null` (line 140-163)
- Scoring contextuel : +10 module, +5 city, +5 region, +3 keyword, +2 sector, +1 translation, +0.5 featured (line 88-112)
- Filtre module : mapping `VERTICAL_TO_IMAGE_MODULE` (audit→audit, intervention→interventions, impl→implementations…)
- Fallback gracieux : retourne null si zéro candidat → worker log `pending_image` (line 204)
- DB unavailable → silent return null (line 203-206)

## Invariants

- ✅ Filtre `isAiGenerated=false` invariant absolu (no override)
- ✅ Pas de fallback générative (cohérent règle `feedback_no_dalle_images.md`)
- ✅ Helper `__testInternals` exported (line 212) pour unit tests

## Tests

- ✅ Helper testable isolément

## Verdict 🟢 OK (code)

Règle absolue "zéro DALL-E" stricte. Aucun fallback IA générative. Code align.
