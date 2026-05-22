# SC-18 — Generator `qa_derived`

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. `typeDistribution={qa_derived: 100}`, `totalTargetCount=1`
2. Vérifier QAPage JSON-LD + Speakable

## Cartographie code

| Item                | Source                                                            | Statut |
| ------------------- | ----------------------------------------------------------------- | ------ |
| Generator           | `axionia/src/server/content-gen/generators/qa-derived.ts` (327 l) | ✅     |
| Persona Manon D3    | line 43                                                           | ✅     |
| AI Disclaimer D4    | page render                                                       | ✅     |
| ≥2 liens externes   | line 127 `count: 3`                                               | ✅     |
| QAPage JSON-LD      | `buildQAPageJsonLd` line 63                                       | ✅     |
| Speakable           | embedded JSON-LD line 94 script tag                               | ✅     |
| AuthorByline        | ⚠️ FAQ pages `/faq/[slug]` omettent AuthorByline                  | ⚠️     |
| WordCount anti-thin | gate line 205-212 ≥ 300                                           | ✅     |

## ⚠️ Gaps

1. **AuthorByline absent sur FAQ** → drift transparence
2. ❌ Pas de test vitest dédié

## Verdict 🟡 PARTIAL (code)

QAPage + Speakable solide. Manon présent en prompt. Byline FAQ à examiner.
