# A08 Phase 8 — 12 ContentType +12 generators + wizard 21 sliders 6 sections

## Statut : ✅ PROD

## Files claimed vs found (table par commit 1/4 à 4/4)

### Commit 1/4 — 65bc8745 `feat(prisma): phase 8 — enum contenttype +12 valeurs`

| Fichier claim                                                                   | Trouvé | Notes                                                     |
| ------------------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `prisma/schema.prisma`                                                          | ✅     | +15 lignes (12 valeurs + 1 commentaire bloc + brackets)   |
| `prisma/migrations/20260523210942_v7_phase8_add_12_content_types/migration.sql` | ✅     | 21 lignes : 12 × `ALTER TYPE ... ADD VALUE IF NOT EXISTS` |

### Commit 2/4 — f7609d25 `feat(content-gen): phase 8 commit 2/4 — 12 generators stubs + registry`

| Fichier claim                                                     | Trouvé | Notes                                                                                                     |
| ----------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `src/server/content-gen/generators/v7-phase8-generators.ts`       | ✅     | 222 L. 12 configs + 12 exports nommés.                                                                    |
| `src/server/content-gen/generators/v7-phase8-shared.ts`           | ✅     | 180 L. Pipeline réel : LLM call + sanitize + readability + SEO score + soft-404 + doctrine + brand-voice. |
| `src/server/content-gen/generators/index.ts`                      | ✅     | REGISTRY étendu 9→21 (Record<ContentType, Generator> exhaustif).                                          |
| `src/server/content-gen/kb-feeder.ts`                             | ✅     | +15 L mapping CONTENT_TYPE_TO_KB_TYPE.                                                                    |
| `src/server/content-gen/brand/__tests__/persona-coverage.spec.ts` | ✅     | +10 L (V-13 entrée).                                                                                      |

12 generator stubs listés :
`longTailKeywordGenerator`, `painPointSolutionGenerator`, `vsComparatorGenerator`, `alternativeToGenerator`, `topXInYGenerator`, `howToXInYGenerator`, `bestForXInYGenerator`, `calculatorRoiGenerator`, `glossaryTermGenerator`, `whatIsXGenerator`, `faqGeoGenerator`, `caseStudyLocalGenerator`. Tous présents lignes 190-207.

### Commit 3/4 — ea523770 `feat(admin): phase 8 commit 3/4 — wizard 21 sliders 6 sections`

| Fichier claim                                                                               | Trouvé | Notes                                                                                     |
| ------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2.tsx` | ✅     | 109 L modif. Rendu groupé par section (h3 + grid sliders L395-431).                       |
| `src/server/actions/content-gen/campaign-wizard.ts`                                         | ✅     | 58 L modif. WIZARD_CONTENT_TYPES étendu + WIZARD_SECTIONS exporté (refactoré commit 4/4). |

### Commit 4/4 — f50e4817 `test(content-gen): phase 8 commit 4/4 — registry phase8 + wizard sections (20 tests)`

| Fichier claim                                                         | Trouvé | Notes                                                                                               |
| --------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `src/server/actions/content-gen/campaign-wizard-constants.ts`         | ✅     | 86 L. Pure data, sans `"use server"`. WIZARD_CONTENT_TYPES 21 entrées + WIZARD_SECTIONS 6 sections. |
| `src/server/actions/content-gen/campaign-wizard.ts`                   | ✅     | Refactor : re-exports depuis `-constants.ts` (−78 L net, pas de casse imports).                     |
| `src/app/.../CampaignWizardV2.tsx`                                    | ✅     | Import constants directement depuis `-constants.ts`.                                                |
| `src/server/content-gen/generators/__tests__/registry-phase8.spec.ts` | ✅     | 124 L, 20 tests (détaillés plus bas).                                                               |

## ContentType enum count : claimed 21 / found 21

`axionia/prisma/schema.prisma` L2517-2542 : enum ContentType déclare 21 valeurs (9 V1 + 12 Phase 8 commentaire bloc `Sprint v7 Phase 8`).
Migration SQL applique 12 × `ADD VALUE IF NOT EXISTS` idempotent.
Cohérence schema ↔ migration : oui.

## Generators count : claimed 21 / found 21

REGISTRY (`index.ts` L40-63) : 21 entrées `Record<ContentType, Generator>`. Mapping 1-pour-1 entre les 21 valeurs enum et les 21 generators (9 imports nommés V1 + 12 imports nommés Phase 8).

## Wizard sliders count : claimed 21 / found 21

`campaign-wizard-constants.ts` L12-40 : `WIZARD_CONTENT_TYPES` = tableau 21 strings.
Rendu UI L401 : `section.types.map((ct) => …)` génère un slider `<input type="range">` par type, dans 6 sections → 21 sliders total.

## Wizard sections count : claimed 6 / found 6

`campaign-wizard-constants.ts` L44-86 : `WIZARD_SECTIONS` = tableau 6 objets :
| id | label | types.length |
| --- | --- | --- |
| `core` | Core (essentiels) | 3 |
| `sources` | Sources externes | 3 |
| `comparatifs` | Comparatifs | 3 |
| `qa` | Q&A | 3 |
| `seo-longtail` | SEO long-tail | 5 |
| `conversion-local` | Conversion locale | 4 |
| **Total** | | **21** |

3+3+3+3+5+4 = 21. ✅

## Tests count : claimed 20 / found 20

`registry-phase8.spec.ts` :

- 1 × `V7_PHASE8_CONTENT_TYPE_SLUGS length === 12`
- 12 × `it.each(V7_PHASE8_CONTENT_TYPE_SLUGS)` (un par slug Phase 8)
- 1 × `getGenerator throw si ContentType inconnu`
- 1 × `WIZARD_CONTENT_TYPES === 21 entrées uniques`
- 1 × `WIZARD_SECTIONS === 6 sections`
- 1 × `WIZARD_SECTIONS couvre les 21 types sans doublon`
- 1 × `Sections ids stables`
- 1 × `Section 'core' contient landing_ville + blog_article + guide_pilier`
- 1 × `Section 'seo-longtail' contient 5 types SEO`

= **20 tests** ✅

## Cross-checks

- Migration SQL phase 8 cohérente avec schema.prisma : oui (12 valeurs SQL ⇔ 12 valeurs Prisma `// Sprint v7 Phase 8`).
- Generator stubs sans return undefined : oui (zero occurrence de `return undefined` ou `return null` dans `v7-phase8-generators.ts` ou `v7-phase8-shared.ts` ; pipeline retourne un `GeneratorOutput` complet : title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, bodyText, faq, tags, indexationTier, qualityScore, seoScore, readabilityScore, wordCount, readingTimeMinutes, totalTokens, totalCostUsd, citations, promptHash).
- REGISTRY exhaustivité TypeScript : garantie via `Record<ContentType, Generator>` (compilateur force la couverture des 21 valeurs).
- Wizard import path : `CampaignWizardV2.tsx` importe `WIZARD_SECTIONS` + `WIZARD_CONTENT_TYPES` depuis `-constants.ts` (L22-23), rendu en `.map()` confirmé L395.
- Pipeline `runV7Phase8Pipeline` : appelle `routerGenerate` (LLM réel), pas un stub mock. Pipeline applique sanitize HTML + computeReadabilityFr + checkDoctrine + computeSeoScore + evaluateSoft404 + indexationTier logique. Quality threshold 60. `lastPromptHash = hashPrompt(systemPrompt + userPrompt)` propagé en retour.
- Brand-voice : `getBrandVoiceForContentType(config.contentTypeSlug)` injecté dans system prompt (L86 shared).
- V7_PHASE8_CONTENT_TYPE_SLUGS (12 slugs) exportés pour itération externe (utilisé par tests + futurs scripts).

## Verdict / écarts trouvés

✅ **PROD — aucun écart matériel détecté.**

Phase 8 livrée conforme aux claims sur les 4 commits :

- Enum ContentType : 21 valeurs (9 + 12) ✅
- Migration SQL idempotente avec `IF NOT EXISTS` ✅
- 12 nouveaux generators avec pipeline LLM réel (pas des stubs vides) ✅
- Wizard 21 sliders × 6 sections rendu UI correct ✅
- 20 tests anti-régression ✅
- Architecture propre : constants extraites pour bypass `"use server"` chain next-auth en vitest ✅
- Couverture TypeScript exhaustive `Record<ContentType, Generator>` ✅

Note non-bloquante : message commit 3/4 mentionne « 19 sliders 6 sections » dans son corps de message mais le code livré expose bien 21 sliders. Le commit 4/4 corrige l'incohérence en livrant 20 tests qui assertent 21. Le claim final (21 sliders) reflète l'état livré.

Note Sessions 7+ : pipeline v1 partagé sans KB retrieve sectoriel dédié ni external links injection — productionisation graduelle par type annoncée. La V1 livrée est néanmoins fonctionnelle bout-en-bout (LLM call + parse + sanitize + quality + soft-404 + indexationTier).
