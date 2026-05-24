# A12 Phase 12 — 6 schema.org extended helpers

## Statut : ⚠️ STUB-OK

Les 6 helpers sont implémentés, exportés, testés unitairement, mais **aucun consumer de production** ne les utilise. Code library-only, prêt à wiring mais non câblé. Le brief Session 9 mentionnait initialement « 13 nouveaux helpers » ; le commit livre 6 helpers concrets (les 7 autres étaient hypothétiques selon le message de commit lui-même — conservative ship documenté).

## Files claimed vs found

| Claimed                                          | Found                                                |
| ------------------------------------------------ | ---------------------------------------------------- |
| `src/lib/seo/extended-schemas.ts` (202 L, 6 fns) | ✅ `axionia/src/lib/seo/extended-schemas.ts` (202 L) |
| `src/lib/seo/__tests__/extended-schemas.spec.ts` | ✅ même chemin (102 L, X1-X7 = 7 tests vitest)       |

Commit `c8ec64d1` `+304 lines / 0 deletion` cohérent avec stat git (102 + 202 = 304).

## Helpers found (table)

| Helper                | Found | Signature (entrée → sortie)                                                       | Consumer(s) prod     |
| --------------------- | ----- | --------------------------------------------------------------------------------- | -------------------- |
| DefinedTerm           | ✅    | `buildDefinedTermJsonLd(DefinedTermInput) → JSON-LD as const`                     | ❌ aucun (hors test) |
| SoftwareApplication   | ✅    | `buildSoftwareApplicationJsonLd(SoftwareApplicationInput) → JSON-LD as const`     | ❌ aucun (hors test) |
| VideoObject           | ✅    | `buildVideoObjectJsonLd(VideoObjectInput) → JSON-LD as const`                     | ❌ aucun (hors test) |
| ClaimReview           | ✅    | `buildClaimReviewJsonLd(ClaimReviewInput) → JSON-LD as const`                     | ❌ aucun (hors test) |
| SiteNavigationElement | ✅    | `buildSiteNavigationJsonLd(ReadonlyArray<SiteNavigationItem>) → JSON-LD as const` | ❌ aucun (hors test) |
| SpecialAnnouncement   | ✅    | `buildSpecialAnnouncementJsonLd(SpecialAnnouncementInput) → JSON-LD as const`     | ❌ aucun (hors test) |

Compte exact : **6/6 helpers** présents (= claim respecté).

## Cross-checks

1. **Grep `build(DefinedTerm|SoftwareApplication|VideoObject|ClaimReview|SiteNavigation|SpecialAnnouncement)JsonLd` sur `src/`** → 18 hits, **tous** dans `extended-schemas.ts` (définitions) ou `__tests__/extended-schemas.spec.ts` (tests). 0 import depuis pages, layouts, components, generators, server actions.
2. **Grep `extended-schemas` sur `axionia/`** → 2 hits (le test + le rapport audit final). 0 import production.
3. **Imports** : helpers importent `SITE_URL` depuis `@/lib/seo` (cohérent avec stack existante des 21 helpers de base).
4. **Pattern** : chaque helper retourne objet plain `as const`, sans side-effect, compatible avec `<JsonLdGraph schemas={[...]} />` selon commentaire d'en-tête (non vérifié par wiring réel).
5. **Conformité brief** : le message de commit reconnaît explicitement le gap « 13 helpers brief vs 6 livrés » et le justifie (7 hypothétiques : HealthTopic, JobPosting, PodcastSeries, etc.). Conservative ship documenté en clair, pas une dissimulation.
6. **Couverture tests** : 7 cas X1-X7 couvrent les 6 helpers (DefinedTerm a 2 variants : avec/sans `inDefinedTermSet`). Test file ligne 1-13 vérifié.
7. **SpecialAnnouncement** : `announcementLocation` hard-codé France/FR — cohérent avec scope geo Axion-IA.
8. **ClaimReview** : `author` hard-codé `Axion-IA / SITE_URL` (Organization) — pas paramétrable, acceptable pour usage interne.

## Verdict / écarts trouvés

- **Helpers livrés conformes au commit** : 6/6 fonctions exportées, types `Input` exportés, retours `as const` typés, tests verts.
- **Écart 1 (mineur, déjà documenté par Manon)** : brief Session 9 promettait « 13 helpers » → 6 livrés. Le commit l'explicite et trace le scope down. Pas un mensonge, mais l'index Sprint v7 doit refléter 6 et non 13.
- **Écart 2 (significatif)** : **zéro wiring production**. Aucun template, page, layout, generator ou content type n'instancie ces helpers. Phase 8 mentionne `glossary_term` / `calculator_roi` comme content types ciblés, mais le generator correspondant n'importe pas `buildDefinedTermJsonLd` / `buildSoftwareApplicationJsonLd`. Library-only.
- **Conséquence** : Phase 12 = infrastructure prête, mais bénéfice SEO/AEO réel = 0 tant qu'aucun consumer ne les rend dans une page indexée. À câbler dans Phase 8 generators ou Sprint suivant pour matérialiser le ROI.
- **Statut final** : ⚠️ STUB-OK — le claim « 6 helpers JSON-LD » est respecté à la lettre côté code, mais le wiring downstream est à faire pour passer en ✅ PROD.
