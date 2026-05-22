# SC-14 — Generator `landing_ville`

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. `typeDistribution={landing_ville: 100}`, `anchorVilleSlugs=['paris']`, `totalTargetCount=1`
2. Vérifier LocalBusiness JSON-LD + section "villes proches"

## Cartographie code

| Item                     | Source                                                                              | Statut       |
| ------------------------ | ----------------------------------------------------------------------------------- | ------------ |
| Generator                | `axionia/src/server/content-gen/generators/landing-ville.ts` (275 l)                | ✅           |
| Persona Manon D3         | `getBrandVoiceForContentType("landing_ville")` line 142 (implicite via brand-voice) | ⚠️ implicite |
| AI Disclaimer D4         | rendu page `/[ville]/*` via `AiContentDisclaimer`                                   | ✅           |
| ≥2 liens externes        | line 116 `count: 4, minAuthority: 4`                                                | ✅           |
| aiGenerated JSON-LD      | factory-injected                                                                    | ✅           |
| AuthorByline             | ❌ Landing pages ne suivent pas pattern blog (intentionnel ?)                       | ⚠️           |
| LocalBusiness JSON-LD    | ⚠️ Generator émet seulement Article basique, LocalBusiness côté render-time ?       | ⚠️           |
| Section "villes proches" | extractMentionedCities line 245, stocké dans output mais **pas rendu HTML**         | ⚠️           |

## ⚠️ Gaps majeurs (statique)

1. **LocalBusiness JSON-LD** : non émis par le generator. Cas Use Will → SEO local. Vérifier page template `/[locale]/(public)/[ville]/...`
2. **"villes proches" extrait mais pas injecté dans bodyHtml** → mention SC-25 ne se matérialise PAS dans le contenu
3. **AuthorByline absent** sur landings → drift transparence vs blog

## Tests vitest

- ❌ Pas de `__tests__/landing-ville.spec.ts`

## Verdict 🟡 PARTIAL (code)

Generator fonctionnel pour texte mais 3 gaps SEO/UX à examiner : LocalBusiness JSON-LD, villes proches HTML, AuthorByline.
