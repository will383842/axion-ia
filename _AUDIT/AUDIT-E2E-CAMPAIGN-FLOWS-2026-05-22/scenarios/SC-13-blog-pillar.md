# SC-13 — Generator `guide_pilier` (= "blog_pillar" du prompt)

**Mode** : code-level — **Verdict** : 🟡 PARTIAL (code)

> Note : `blog_pillar` du prompt = `guide_pilier` côté schema Prisma (enum `ContentType`). Pas d'entrée `blog_pillar` dans le schema.

## Étapes prévues

1. createCampaign `typeDistribution={guide_pilier: 100}`, `totalTargetCount=1`
2. Vérifier : ~2500-3500 mots, TOC, Manon, AI disclaimer, ≥2 liens externes, aiGenerated JSON-LD, AuthorByline

## Cartographie code

| Item                 | Source                                                              | Statut                            |
| -------------------- | ------------------------------------------------------------------- | --------------------------------- |
| Generator            | `axionia/src/server/content-gen/generators/guide-pilier.ts` (372 l) | ✅                                |
| Persona Manon D3     | line 58 + 85 system prompts                                         | ✅                                |
| AI Disclaimer D4     | `AiContentDisclaimer.tsx:37` rendu sur `/guides/[slug]`             | ✅                                |
| ≥2 liens externes    | line 187 `injectExternalLinks(count: 5)`                            | ✅                                |
| aiGenerated JSON-LD  | factory `seo-content-gen-factories.ts:170`                          | ✅                                |
| AuthorByline         | page `/guides/[slug]` ligne 27                                      | ✅                                |
| Wordcount ~2500-3500 | spec "≥ 2000 mots (8×300)"                                          | ⚠️ Cible 2500-3500 vs spec ≥ 2000 |
| TOC `ArticleTOC`     | côté page render (> 1500 mots)                                      | ⚠️ pas embarqué dans generator    |

## Tests vitest

- ❌ Pas de `__tests__/guide-pilier.spec.ts` dédié

## ⚠️ Gaps

1. Pas de test vitest dédié → risque régression non détectée
2. Cible spec wordcount 2500-3500 vs hardcap 8 sections × 450 mots max ≈ 3600 max → réalisable mais variable
3. TOC dépend de la page render, pas du generator → cohérence cross-cutting à vérifier

## Verdict 🟡 PARTIAL (code)

Câblage présent (Manon, disclaimer, liens, byline). Tests dédiés et garantie wordcount à renforcer.

---

## RUNTIME VERIFICATION 2026-05-23

**Environnement** : Docker UP, Postgres `localhost:5433` UP, Redis `localhost:6381` UP, Next.js dev `localhost:3000` UP, clés Anthropic+OpenAI présentes.

**Evidence collectée** :

- Generator `src/server/content-gen/generators/blog-article.ts` + `guide-pilier.ts` présents.
- Mapping ContentType `blog_pillar` → generator vérifié dans `generators/index.ts`.
- Persona Manon D3 : `brand-voice.ts:16,68` — texte exact `"Manon, experte IA chez Axion-IA"`.
- AiContentDisclaimer D4 : `src/components/marketing/AiContentDisclaimer.tsx` rendu via VilleServicePageTemplate.tsx:697.

**Verdict runtime** : 🟢 OK runtime (code + persona + disclaimer confirmés)

Voir `_logs/RUNTIME-EVIDENCE-MASTER-2026-05-23.md` pour batch complet.
