# SC-17 — Generator `blog_from_rss`

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

## Étapes prévues

1. `typeDistribution={blog_from_rss: 100}`, `totalTargetCount=1`
2. Vérifier ABSENCE "Source : ..." + similarité SimHash < 0.50 vs source

## Cartographie code

| Item                | Source                                                               | Statut          |
| ------------------- | -------------------------------------------------------------------- | --------------- |
| Generator           | `axionia/src/server/content-gen/generators/blog-from-rss.ts` (409 l) | ✅              |
| Persona Manon D3    | system prompt line 57 = "journaliste expert" (générique)             | ❌ Manon absent |
| AI Disclaimer D4    | page render `AiContentDisclaimer`                                    | ✅              |
| ≥2 liens externes   | line 103 `count: 4`                                                  | ✅              |
| aiGenerated JSON-LD | NewsArticle factory line 32                                          | ✅              |
| AuthorByline        | ⚠️ NewsArticle pages = pattern journaliste-anonymous                 | ⚠️              |
| Anti-plagiat gate   | Jaccard ≤ 0.10 vs source line 243-244                                | ✅              |
| "Source :" INTERDIT | line 61 prompt + line 286-292 inverse gate                           | ✅              |
| isBasedOn JSON-LD   | helper `enrichOutputWithNewsArticleJsonLd` 416-448                   | ✅              |
| V-06 P0b re-check   | line 298-303 + force tier_3 si fail line 366-372                     | ✅              |

## ⚠️ Gaps

1. **Persona Manon absente** — drift brand voice (intentionnel pour neutralité journalistique ?)
2. **AuthorByline absent** sur `/actualites/[slug]` (pattern NewsArticle)
3. ❌ Pas de test vitest dédié

## Verdict 🟡 PARTIAL (code)

Anti-plagiat solide, traçabilité isBasedOn OK, gates Source enforcés. Manon + byline omis volontairement ? À valider Will.
