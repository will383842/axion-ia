# SC-15 — Generator `blog_from_keywords`

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. `typeDistribution={blog_from_keywords: 100}`, `totalTargetCount=1`
2. Vérifier Manon, AI disclaimer, ≥2 liens externes, AuthorByline, wordcount ≥ 500

## Cartographie code

| Item                       | Source                                                                    | Statut |
| -------------------------- | ------------------------------------------------------------------------- | ------ |
| Generator                  | `axionia/src/server/content-gen/generators/blog-from-keywords.ts` (344 l) | ✅     |
| Persona Manon D3           | line 41 system prompt                                                     | ✅     |
| AI Disclaimer D4           | page `/blog/[slug]` line 14 + 411                                         | ✅     |
| ≥2 liens externes          | line 85 `count: 4`                                                        | ✅     |
| aiGenerated JSON-LD        | page `/blog/[slug]:247` `aiGenerated: true`                               | ✅     |
| AuthorByline               | page line 339                                                             | ✅     |
| WordCount ≥ 500 (HCU 2024) | line 256 enforce                                                          | ✅     |
| soft-404 gate              | line 304                                                                  | ✅     |

## Tests

- E2E : `tests/e2e/content-gen/blog-article.spec.ts:24` — Person JSON-LD Manon + Article dateModified

## Verdict 🟢 OK (code)

Generator clé blog complet. Conforme D1, D3, D4. Gold standard pour autres generators.
