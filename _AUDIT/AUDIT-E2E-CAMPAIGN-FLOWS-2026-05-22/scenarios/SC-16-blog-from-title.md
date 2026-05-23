# SC-16 — Generator `blog_from_title`

**Mode** : code-level — **Verdict** : 🟢 OK (code)

## Étapes prévues

1. `typeDistribution={blog_from_title: 100}`, `totalTargetCount=1`, `primaryKeyword='Titre imposé X'`
2. Vérifier titre exact, Manon, byline, disclaimer

## Cartographie code

| Item                | Source                                                                             | Statut |
| ------------------- | ---------------------------------------------------------------------------------- | ------ |
| Generator           | `axionia/src/server/content-gen/generators/blog-from-title.ts` (328 l)             | ✅     |
| Persona Manon D3    | line 42                                                                            | ✅     |
| AI Disclaimer D4    | page render                                                                        | ✅     |
| ≥2 liens externes   | line 86 `count: 4`                                                                 | ✅     |
| aiGenerated JSON-LD | page line 247                                                                      | ✅     |
| AuthorByline        | page line 339                                                                      | ✅     |
| Titre imposé        | line 62 `mandatoryTitle = input.primaryKeyword` + line 159 + 248-251 post-sanitize | ✅     |

## Tests

- Couvert par suite E2E `blog-article.spec.ts` (shared)

## Verdict 🟢 OK (code)

Conforme. Force le titre exact via post-sanitize. Aucun gap.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Generator `blog-from-title.ts` présent.
- Mapping ContentType `blog_from_title` → generator vérifié.

**Verdict runtime** : 🟢 OK runtime

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
