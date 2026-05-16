# 01 — Schema + Migrations Prisma

> **Pondération** : 120 pts | **Score** : **103/120** (86%) 🟢
> **Auditeur** : Agent Explore parallèle (delegated)

---

## 1.1 Conventions Prisma (camelCase + @map) — ✅ 15/15

- `prisma/schema.prisma:3061-3070` Country : `isoCode → @map("iso_code")`, `nameFr → @map("name_fr")`, `flagEmoji → @map("flag_emoji")`
- `prisma/schema.prisma:3084-3162` ImageAsset : `filePath → @map("file_path")`, `categoryId → @map("category_id")`, `targetCountries → @map("target_countries")`
- `@@map("snake_case_plural")` sur les 10 tables (3076 countries, 3181 image_assets, 3191 image_asset_translations, 3205 image_categories, 3222 image_category_translations, 3232 image_tags, 3245 image_tag_translations, 3256 image_asset_tags, 3274 image_usage_logs, 3312 image_download_logs, 3329 image_import_batches)

## 1.2 PK patterns — ✅ 15/15

- UUID `@db.Uuid` : ImageAsset:3080, Country, ImageCategory, ImageImportBatch ✅
- Translation/Tag tables : SERIAL autoincrement ✅ (acceptable spec)
- BigInt logs : ImageUsageLog:3280 + ImageDownloadLog:3299 `BIGSERIAL` ✅

## 1.3 Temporal fields — ⚠️ 10/15

- ✅ `createdAt + updatedAt` : Country (3069-3070), ImageAsset (3160-3161), ImageAssetTranslation (3183-3184), ImageImportBatch (3324-3325 — `completedAt` au lieu de `updatedAt` accepté lifecycle)
- ✅ `deletedAt` : ImageAsset:3162 uniquement (soft-delete)
- ❌ **MANQUE** : `ImageCategory` (3199-3205), `ImageCategoryTranslation` (3208-3222), `ImageTag` (3225-3232), `ImageTagTranslation` (3235-3245) → **aucune** colonne temporelle

**Issue P1** — Violation doctrine "createdAt+updatedAt partout sauf logs append-only". 4 tables lookup concernées. Acceptable si tables statiques seedées une fois, mais à documenter explicitement.

**Patch proposé** : ALTER TABLE + champs Prisma. Voir `PATCHES-PROPOSES.md` §P1-8.

## 1.4 FK onDelete — ⚠️ 8/10

Migration SQL OK :

- `migration.sql:240` ImageAsset → ImageCategory : `ON DELETE SET NULL ON UPDATE CASCADE` ✅
- `migration.sql:241` ImageAssetTranslation → ImageAsset : `ON DELETE CASCADE` ✅
- `migration.sql:242-245` Translation/Tag/AssetTag : `ON DELETE CASCADE` ✅
- `migration.sql:246-247` Logs → ImageAsset : `ON DELETE CASCADE` ✅

⚠️ Schema.prisma:3164 : `category ImageCategory? @relation(fields: [categoryId], references: [id])` **sans** `onDelete: SetNull` déclaré explicitement (Prisma génère le SQL correct via défaut SetNull pour nullable, mais best-practice = expliciter).

**Issue P2** — Clarté schema only, SQL fonctionnel.

## 1.5 VarChar lengths — ✅ 10/10

| Field                  | Type         | Rationale          |
| ---------------------- | ------------ | ------------------ |
| `slug` (Asset)         | VarChar(255) | URL-safe, headroom |
| `slug` (Category, Tag) | VarChar(100) | Short lookups      |
| `isoCode`              | VarChar(2)   | ISO 3166-1 alpha-2 |
| `iso3`                 | VarChar(3)   | ISO 3166-1 alpha-3 |
| `languageCode`         | VarChar(5)   | BCP 47             |
| `filePath`             | VarChar(500) | Storage paths      |
| `ipHash`               | VarChar(64)  | SHA-256 hex        |
| `userAgent`            | VarChar(500) | UA strings         |

Aucune incohérence détectée.

## 1.6 Indexes (≥ 20 attendus) — ✅ 15/15

**25 indexes total** (21 Prisma + 4 GIN/FTS bonus) :

**Prisma-declared** (21) :

- Country : 4 (`nameFr`, `nameEn`, `slugFr`, `slugEn`)
- ImageAsset : 11 composites + simples (`[isActive,categoryId,sortOrder]`, `[isActive,publishedAt]`, `sourceType`, `fileHash`, `[module,subModule]`, `[module,targetCity]`, `[module,targetRegion]`, `subjectOfType`, `requiresHumanReview`, `requiresHumanTaxonomy`, `pHash`)
- ImageAssetTranslation : 3 (`[imageId,languageCode]` unique, `[languageCode,slug]`, `[languageCode,isPublished]`)
- ImageCategoryTranslation : 2
- ImageTag, ImageTagTranslation : 2 uniques
- ImageAssetTag : 1 composite PK
- ImageUsageLog : 2
- ImageDownloadLog : 2
- ImageImportBatch : 2

**FTS/GIN raw SQL** (`migrations_fts/20260516142018_image_bank_fts.sql`) :

- GIN `target_countries jsonb_path_ops`, `target_languages`, `keywords_secondary`
- GIN + tsvector `search_vector` (ImageAssetTranslation)
- 5 indexes composites filtrés (pub_recent, active_published, module_published, target_city, target_region)

✅ Couverture complète des queries critiques (pSEO villes/régions, dedup `fileHash`, queues admin `requiresHuman*`).

## 1.7 Migrations idempotentes — ✅ 10/10

- ✅ `IF NOT EXISTS` sur GIN/FTS indexes (`migrations_fts:9-16`)
- ✅ Generated column `search_vector` PG 12+ STORED (`migrations_fts:26-33`, déterministe + immutable)
- ✅ Migration Country + Image-bank : pas de renames, juste créations

⚠️ **P1** — Pas de "down" SQL (limitation Prisma). À documenter procédure rollback (voir P1-9 backlog).

## 1.8 Seeds — ✅ 10/10

- `seedCountries()` (249 rows REST Countries API), upsert idempotent par `isoCode`
- `seedImageCategories()` (5 cat : interventions, audits, implementations, equipe, cas-concrets), upsert par `slug` + translations par composite unique
- `seedImageTags()` (10 tags base FR+EN : ia-operationnelle, claude-anthropic, audit-ia, automatisation, chatbot, etc.)
- `index.ts` orchestrateur appelle dans l'ordre : Country → Categories → Tags ✅
- Naming `seedXxx()` cohérent avec `prisma/seeds/content-gen/` ✅

## 1.9 Slug strategy (FR vs EN) — ⚠️ 5/5

`prisma/schema.prisma:3098` ImageAsset.slug : **String @unique @db.VarChar(255)** (canonique, language-neutral, unique global)
`prisma/schema.prisma:3169` ImageAssetTranslation.slug : VarChar(255) (per-language, unique via `[imageId, languageCode]`)

Migration SQL confirme :

- `CREATE UNIQUE INDEX "image_assets_slug_key" ON "image_assets"("slug");`
- `CREATE UNIQUE INDEX "image_asset_translations_image_id_language_code_key" ON "image_asset_translations"("image_id", "language_code");`

Stratégie 2 niveaux OK (slug canonique pour storage, slug per-lang pour routing) — mais **non documenté en commentaire schema**. P2 amélioration.

## 1.10 Documentation schema — ✅ 5/5

`prisma/schema.prisma:3044-3056` header explicite :

```prisma
// IMAGE BANK V1 (Sprint 1 — feat/image-bank-v1)
// Doctrine : FR canonique, EN miroir (PAS 9 langues comme SOS-Expat)
// Stockage local dev (public/image-bank/) ou S3/Hetzner (prod)
// License par défaut CC BY 4.0
// Copyright holder = Axion-IA OÜ
// 10 tables : Country + 8 image-bank core + ImageDownloadLog + ImageImportBatch
// Refs: .claude/skills/axionia-image-bank/references/prisma-schema.md
```

---

## 📋 Issues identifiées

### P1 (3)

1. **P1-8** : `ImageCategory`, `ImageCategoryTranslation`, `ImageTag`, `ImageTagTranslation` sans `createdAt/updatedAt` (`prisma/schema.prisma:3199-3245`) — violation doctrine. Effort 30min.
2. **P1-9** : Pas de rollback SQL "down" — limitation Prisma. Documenter procédure en commentaire migration ou runbook. Effort 20min.
3. **P1-10** : `slug` ambiguïté (canonique vs per-lang) non documentée en commentaire schema. Effort 10min.

### P2 (2)

1. **P2-1** : `onDelete: SetNull` non explicite dans `schema.prisma:3164` (SQL correct mais clarté Prisma). Effort 5min.
2. **P2-2** : `slugify` inline `seed-countries.ts:25-33` non extracté vs `src/lib/geo.ts:90-96` (légère divergence : `/^-+|-+$/g` + `.slice(0,100)` vs `/^-|-$/g`). Effort 30min refactor.

---

## 🎯 Sous-pondération détaillée

| Check                            |     Pts |   Score |
| -------------------------------- | ------: | ------: |
| 1.1 Conventions camelCase + @map |      15 |      15 |
| 1.2 PK UUID + BigInt logs        |      15 |      15 |
| 1.3 createdAt/updatedAt          |      15 |      10 |
| 1.4 deletedAt Asset only         |       5 |       5 |
| 1.5 FK onDelete                  |      10 |       8 |
| 1.6 Index coverage               |      15 |      15 |
| 1.7 VarChar consistency          |      10 |      10 |
| 1.8 Migration idempotence        |      10 |      10 |
| 1.9 Seeds naming + upsert        |      10 |      10 |
| 1.10 Documentation               |       5 |       5 |
| **TOTAL**                        | **120** | **103** |

---

## ✅ Verdict Phase 1

**🟢 PASS 103/120 (86%)** — Schema solide, conventions respectées, indexes excellents. 3 P1 mineurs (lookup tables temporal fields, rollback SQL doc, slug strategy commentaire). 2 P2 cosmétiques.

Aucun bloquant merge.
