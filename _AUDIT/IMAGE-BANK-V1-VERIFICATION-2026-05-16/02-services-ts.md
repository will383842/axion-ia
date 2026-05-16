# 02 — Services TypeScript

> **Pondération** : 150 pts | **Score** : **145/150** (97%) 🟢

---

## 2.1 Inventaire — ✅ 20/20

10 services dans `src/server/image-bank/services/` (2728 LOC total) :

| #   | Service                                | LOC | Focus                                                                         |
| --- | -------------------------------------- | --: | ----------------------------------------------------------------------------- |
| 1   | `image-bank.service.ts`                | 298 | CRUD + revalidateTag + trackUsage (AI referrer detect)                        |
| 2   | `image-import.service.ts`              | 173 | Sharp pipeline (WebP/AVIF/LQIP/OG), EXIF strip RGPD                           |
| 3   | `image-seo.service.ts`                 | 362 | `buildImageObjectJsonLd()` + `calculateSeoScore*()` + BreadcrumbList          |
| 4   | `image-country-detector.service.ts`    | 152 | ISO pattern + DB lookup cache 1h                                              |
| 5   | `image-translation.service.ts`         | 229 | Claude Sonnet 4.6 vision (base64/URL fallback)                                |
| 6   | `image-seo-enrichment.service.ts`      | 310 | Claude vision enrichment + geocoding Nominatim                                |
| 7   | `image-watermark.service.ts`           | 106 | SVG overlay texte Sharp mocha #2a2520 opacity 0.65                            |
| 8   | `image-attribute-validator.service.ts` | 355 | 8 validators + Jaccard + reroll correction                                    |
| 9   | `image-taxonomy-detector.service.ts`   | 392 | Pattern matching → Claude fallback → human-required flag                      |
| 10  | `image-jsonld-graph.service.ts`        | 350 | @graph chained 6 entités (Org/WebSite/WebPage/Breadcrumb/ImageObject/Subject) |

**Racine module** :

- `constants.ts` (450 LOC) — SSOT licenses, i18n, cache tags, Sharp limits, Claude tokens
- `types.ts` (~80 LOC) — ImportInput/Result, TranslateInput/Result
- `taxonomy.ts` (~200 LOC) — SSOT 3 modules × N sub-modules + labels FR/EN

**Library helper** :

- `src/lib/image-utils.ts` (331 LOC, **27 exports**) — validateUploadBuffer, toWebp, toAvif, toSmartCrop, generateLqip, generateAllVariants, embedCopyrightMetadata, magic-bytes, sha256Buffer, budgets

## 2.2 Imports canoniques (P0) — ✅ 30/30

| Check                        | Result   | Evidence                                                                                                                                |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@prisma/client` direct      | ✅ **0** | Services utilisent `@/lib/prisma` middleware                                                                                            |
| `@/lib/prisma` réutilisation | ✅ **6** | image-bank.service.ts, image-country-detector.service.ts, image-seo-enrichment.service.ts, image-translation.service.ts (×2), 3 actions |
| `@/server/auth` (forbidden)  | ✅ **0** | Services purs sans auth check                                                                                                           |
| `@/auth` (Server Actions)    | ✅ **3** | upload.action.ts, publish.action.ts, translate.action.ts                                                                                |
| Redis dans services          | ✅ **0** | Pas de dépendance Redis (rate-limit à couche supérieure)                                                                                |
| `@/i18n` dans services       | ✅ **0** | i18n via constants + locale params                                                                                                      |

**Verdict P0 PASS** — Architecture imports impeccable.

## 2.3 Type safety (exactOptionalPropertyTypes) — ✅ 15/15

| Check                        | Result                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `: any`                      | ✅ **0**                                                   |
| `= undefined` (anti-pattern) | ✅ **0** — pattern `...(condition ? { key } : {})` partout |
| `as never`                   | ✅ **0**                                                   |
| `as any`                     | ✅ **0**                                                   |
| Optional fields              | ✅ `caption?: string \| null` + spread sélectif            |

## 2.4 revalidateTag Next 16 — ✅ 10/10

24/24 appels conformes signature 2-args :

- `revalidateTag(CACHE_TAGS.root, "default")` — image-bank.service.ts:117
- `revalidateTag(CACHE_TAGS.image(translation.slug), "default")` — image-translation.service.ts:124
- `revalidateTag(CACHE_TAGS.enrich(input.imageId), "default")` — enrichment

## 2.5 Service-by-service deep dive — ✅ 35/35

### 1️⃣ ImageBankService

- Class singleton `imageBankService = new ImageBankService()` ✅
- Plain `throw new Error()` cohérent V1 ✅
- RGPD : soft-delete + PII masking (AI referrer auto-detect) ✅
- No circular deps ✅

### 2️⃣ ImageImportService

- Class singleton ✅
- Sharp `limitInputPixels: 100_000_000` anti-bomb ✅
- EXIF `.withMetadata({ orientation: 1 })` GPS strip ✅
- Variants WebP (sm/md/lg/xl) + AVIF (md/lg) + OG 1200×630 + LQIP + thumb ✅

### 3️⃣ ImageSeoService

- Class + standalone facade `buildImageObjectJsonLd()` ✅
- JSON-LD full schema.org ImageObject (66 keys) + accessibilityFeature/Hazard WCAG 2.2 ✅
- Score logic 8 critères → 100 max ✅

### 4️⃣ ImageCountryDetectorService

- Class **sans singleton** — instanciée inline (point de fixe MIX-001)
- Cache TTL 1h `cachedLookup` + `invalidateCache()` ✅
- Regex Unicode-safe `\p{L}` + DB lookup + ALIASES ✅
- Default "FR" si rien détecté (sauf AI-generated) ✅

### 5️⃣ ImageTranslationService

- Class singleton (`new ImageTranslationService()` en action — MIX-001) ⚠️
- Sonnet 4.6 vision system prompt 600 tokens ✅
- URL prod → base64 dev fallback (JPEG/PNG/WebP) ✅
- Slug ASCII strict + normalizeAndValidate ✅

### 6️⃣ ImageSeoEnrichmentService

- Class avec instantiation interne `new ImageCountryDetectorService()` — **MIX-001 P1**
- Sonnet 4.6 vision system prompt SEO/AEO/GEO ✅
- Nominatim geocoding rate-limit aware ✅
- `console.warn()` pour geocode errors (acceptable V1, Sentry V1.1) ⚠️

### 7️⃣ ImageWatermarkService

- Class singleton ✅
- SVG overlay adaptive font-size (2% largeur) + anchor-relative ✅
- Couleur `#2a2520` mocha + opacity 0.65 (constants) — anti-hex OK car constants.ts backend Sharp ✅
- Output WebP 85 quality effort 4 ✅
- SVG XML escape (`&amp;` `&lt;` `&gt;`) ✅

### 8️⃣ ImageAttributeValidatorService

- **Standalone functions** (no class — pure validation) ✅
- 8 validators × 4-6 checks = 40+ rules
- `validateAlt()`, `validateCaption()`, `validateDescription()`, `validateMetaTitle/Description()`, `validateOgTitle/Description()`, `validateAiSummary()` ✅
- `buildRerollPromptCorrection()` Claude instructions ✅
- Regex banks : PLEONASM*FR_RE, PLEONASM_EN_RE, SUPERLATIVE*_, ANGLICISM\__, FRENCH_IN_EN_RE ✅

### 9️⃣ ImageTaxonomyDetectorService

- Async functions + 1 class (ImageCountryDetectorService call interne) ⚠️ MIX-001
- Pipeline pattern matching (0.25 + gap score) → Claude fallback (confidence < 0.7) → human-required ✅
- Outputs `TaxonomyDetectionResult` (module/subModule/persona/sector/techno/format + confidence + source) ✅
- `deriveSubjectOfUrl()` + `deriveSubjectOfType()` (Service/Course/Event/Article) ✅
- Confidence threshold 0.7 ✅

### 🔟 ImageJsonldGraphService

- **Pure functions** `buildImageDetailGraph()` + `buildGalleryHubGraph()` ✅
- Detail graph 6 nodes ✅
- Gallery hub 7 nodes + ItemList 24 images max ✅
- Subject types Service|Course|Event|Article ✅
- Organization Tailinn EE + contact points + knowsAbout array ✅

**Verdict** : ALL PASS — chaque service cohérent, no circular deps, error handling plain exceptions (cohérent V1).

## 2.6 image-utils.ts — ⚠️ 18/20

| Metric                     | Result                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Lines                      | 331 (target ~330) ✅                                                                          |
| Exports                    | 27 (target ≥10) ✅                                                                            |
| `MAX_FILE_SIZE_SYNC_BYTES` | 5 MB ✅                                                                                       |
| `MAX_INPUT_PIXELS`         | 100M ✅                                                                                       |
| Content-gen reuse          | ❌ **NOT DETECTED** (GAP-25 outstanding)                                                      |
| Classes exported           | 1 (`ImageValidationError`) ✅                                                                 |
| Async exports              | 6 (toWebp, toAvif, toSmartCrop, generateLqip, generateAllVariants, embedCopyrightMetadata) ✅ |

**Issue P1 — GAP-25 outstanding** : `src/server/content-gen/images/image-optimizer.ts` ne réutilise PAS `image-utils.ts` (grep 0 matches). Duplication Sharp logic maintenue. Sprint 1.4 plan prévoyait l'extraction. Effort refactor : 4-6h + tests.

## 2.7 Server Actions (3/3) — ✅ 15/15

### upload.action.ts (108 LOC)

- `"use server"` ✅
- `auth()` + role check → 403 redirect ✅
- Zod UploadSchema (FormData → typed) ✅
- `imageImportService.importImage()` + dedup `fileHash` ✅
- `imageBankService.create()` transaction ✅
- `revalidateTag("image-bank", "default")` ✅
- ⚠️ Worker enqueue **commented** (L96-99) `imageBankEnrichQueue` TODO

### publish.action.ts (49 LOC)

- Auth + Zod ✅
- SEO score gate ≥80 (force override) ✅
- `imageBankService.publish()` + clean error return ✅

### translate.action.ts (48 LOC)

- Auth + Zod ✅
- Source ≠ Target validation ✅
- `new ImageTranslationService()` (class instantiation) — MIX-001 ⚠️
- Error catch + console.error ✅

## 2.8 Issues — ⚠️ 2/5

### P1 (2)

- **MIX-001** : Mélange class+instantiation inline vs singleton export pattern. `image-seo-enrichment.ts` fait `new ImageCountryDetectorService()` — incohérence. Effort 1-2h standardisation.
- **GAP-25** : `content-gen/images/image-optimizer.ts` ne réutilise pas `image-utils.ts` — duplication Sharp. Effort 4-6h + tests.

### P2 (2)

- **TEST-001** : Zéro test Vitest pour services (cf Phase 9 — 0 coverage)
- **WORKER-001** : `imageBankEnrichQueue` enqueue commenté upload.action.ts:96-99
- **LOGGING-001** : Pas de Sentry capture (cf Phase 8 §8.10)

---

## 🎯 Sous-pondération

| Check                              |     Pts |   Score |
| ---------------------------------- | ------: | ------: |
| 2.1 Inventaire 10 services + utils |      20 |      20 |
| 2.2 Imports canoniques P0          |      30 |      30 |
| 2.3 Type safety strict             |      15 |      15 |
| 2.4 revalidateTag Next 16          |      10 |      10 |
| 2.5 Service-by-service             |      35 |      35 |
| 2.6 image-utils + DRY              |      20 |      18 |
| 2.7 Server Actions                 |      15 |      15 |
| 2.8 Issues & debt                  |       5 |       2 |
| **TOTAL**                          | **150** | **145** |

---

## ✅ Verdict Phase 2

**🟢 EXCELLENT PASS 145/150 (97%)** — Architecture services impeccable. Type safety stricte, imports canoniques 100%, revalidateTag Next 16 partout, RGPD first (EXIF GPS strip), JSON-LD perfection (6-nodes @graph, WCAG 2.2), Claude Sonnet 4.6 vision solide.

Aucun bloquant merge. MIX-001 + GAP-25 = refactor P1 30j post-merge.
