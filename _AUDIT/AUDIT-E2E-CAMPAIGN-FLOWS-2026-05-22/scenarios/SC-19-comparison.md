# SC-19 — Generator `comparison`

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. `typeDistribution={comparison: 100}`, `totalTargetCount=1`
2. Vérifier `<table>` HTML INTERDIT (acquis BUG-5 commit `8b3f470`) + sections H2 multiples

## Cartographie code

| Item                  | Source                                                            | Statut                                           |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Generator             | `axionia/src/server/content-gen/generators/comparison.ts` (357 l) | ✅                                               |
| Persona Manon D3      | line 45 = "expert IA indépendant mandaté"                         | ❌ Manon absent (intentionnel pour neutralité ?) |
| AI Disclaimer D4      | page render                                                       | ✅                                               |
| ≥2 liens externes     | line 100 `count: 4`                                               | ✅                                               |
| aiGenerated JSON-LD   | factory-injected                                                  | ✅                                               |
| AuthorByline          | ⚠️ Comparison pages = expert anonyme                              | ⚠️                                               |
| `<table>` INTERDITE   | hard gate line 268-274 `hasNoForbiddenTable()` line 68-69         | ✅                                               |
| Instructions prompt   | line 48 "AUCUN `<table>`, AUCUN graphique"                        | ✅                                               |
| Sections H2 multiples | gate line 221 `hasComparativeSections()` ≥ 2 H2                   | ✅                                               |

## ⚠️ Gaps

1. **Persona Manon intentionnellement omise** (expert "indépendant" pour neutralité) — drift assumé ? À valider Will
2. **AuthorByline absent**
3. ❌ Pas de test vitest dédié

## Verdict 🟡 PARTIAL (code)

Gate `<table>` solide (BUG-5 fix livré). Manon + byline absents intentionnellement pour neutralité — décision à confirmer Will.
