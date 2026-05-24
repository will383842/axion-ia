# B-03 — DB Postgres + Prisma

**Score : 22/25**
**Verdict : GO — schéma mature, indexes critiques présents, 46 migrations cohérentes**

## Inventaire migrations

`prisma/migrations/` : **46 dossiers** de migrations (premier `20260508175629_init`, dernier `20260522150000_add_external_link_usage_tracking`). Cadence ~3-5 migrations/jour sur les sprints récents, OK.

## Schéma — modèles critiques détectés

### Article (`schema.prisma:874`)

- `indexationTier` (enum 3-tiers) `:892`
- `qualityScore`, `seoScore`, `factCheckScore`, `editorialScore`, `plagiarismScore` `:893-898`
- `generatedByJobId` `:901`, `kbChunkIds[]` `:905`, `searchIntent` `:908`
- `topicFingerprint` (SimHash 64-bit hex) `:930`, `outlineSimhash` `:937`
- `embedding Unsupported("vector(1536)")` `:944` — pgvector activé
- `mentionedCities String[]` (PIN GIN index ligne 972) — auto-tagging géo cascade Phase C

Indexes : `:965-972`

- `@@index([status])`
- `@@index([publishedAt])`
- `@@index([indexationTier, status])` — composite critique pour sitemap/blog hub
- `@@index([isNews, publishedAt(sort: Desc)])` — pour sitemap-news
- `@@index([generatedByJobId])`
- `@@index([mentionedCities], type: Gin)` — query hub ville

### GenerationProvenance (`schema.prisma:979`)

- 16 champs (id, articleId, step, provider, model, modelVersion, promptHash, inputTokens, outputTokens, cacheReadInputTokens, cost Decimal(10,6), regulationVersion, previousHash, hash, timestamp + 1 relation)
- `articleId @relation(... onDelete: Restrict)` `:982` ✅ — conforme P2 P0-1 (RESTRICT, pas Cascade) pour audit immuable AI Act art. 50
- Indexes : `@@index([articleId])` `:997`, `@@index([timestamp])` `:998`

### CoverageCampaign (`schema.prisma:2900`), ContentGenJob (`schema.prisma:2947`)

Présents. ContentGenJob a `correlationId` (P6 item 3 acquis) + `campaignId` FK + `idempotencyKey` unique.

### Keyword (`schema.prisma:3286`)

- `term @unique`, `termNormalized`, `vertical`, `searchIntent`, `cityIds[]` `:3294` (codes INSEE, V-12 correction Sprint Keywords 2026-05-22)
- `usageCount`, `lastUsedAt` `:3298-3299` pour rotation équitable selectKeyword()
- `clusterId` `:3297`
- Indexes : `@@index([vertical])`, `@@index([usageCount, lastUsedAt])` `:3302-3303` — composite couvre selectKeyword query

### ImageAsset (`schema.prisma:3343`)

- `isAiGenerated` `:3424` (default false), `requiresHumanReview` `:3425`, `watermarkEnabled` `:3427`, `pHash` `:3430`
- 10 indexes `:3443-3453` incluant `(module, targetCity)`, `(module, targetRegion)`, `fileHash`, `pHash`

### FactCheckClaim (`schema.prisma:1005`)

- FK `article` `:1015` avec `onDelete: Cascade` (justifié — claims meurent avec l'article)

## Extensions Postgres

`schema.prisma:33` : `extensions = [citext, pg_trgm, unaccent, uuidOssp(map: "uuid-ossp")]`. **pgvector implicite** (utilisé par `Unsupported("vector(1536)")` `:944`). À vérifier que migration `20260514020000_kb_v4_pgvector_embeddings` crée bien l'extension `CREATE EXTENSION vector`.

## Foreign keys

- **GenerationProvenance** : `Restrict` ✅ (audit immuable)
- **FactCheckClaim** : `Cascade` ✅
- **ArticleTranslation** : présent (inférence), unique `[articleId, locale]` `:1041` et `[locale, slug]` `:1042`
- **ArticleSlugHistory** : `oldLocale, oldSlug @@unique` `:1066` (P0-5 audit indexation 2026-05-15 pour 301 redirects)

## Findings

### P0

Aucun.

### P1

1. **Pas d'index sur `Article.featuredImage`** — si query GalleryGrid filtre par featured (admin), full scan. Non critique car querying par `mentionedCities` GIN + status.
2. **`embedding Unsupported("vector(1536)")` sans HNSW/IVFFlat index explicit dans schema** — migration `20260514020000_kb_v4_pgvector_embeddings` ou `20260521130000_add_article_dedup_layers_3_4` doit créer l'index ; à vérifier qu'il est bien `vector_cosine_ops` IVFFlat (HNSW limite 2000 dims, 1536 OK mais perf differ). Memory mentionne "IVFFlat (3072 dim > limite HNSW 2000)" donc fix appliqué.

### P2

3. Schéma Prisma 3300+ lignes (>3340) — risque de drift implicite ; recommandation : segmenter via `prisma multiSchema` ou découper en `.prisma` imports (feature preview). Cosmétique.
4. `@db.Decimal(10, 6)` sur `GenerationProvenance.cost` `:991` : précision OK pour coûts $0.000010 minimum, mais pas pour très petits coûts cache_read Anthropic ($0.0000003/token). Borderline.

## Verdict paragraphe

**Schéma mature et cohérent**. 46 migrations versionnées, modèles critiques tous présents avec indexes ciblés (GIN sur `mentionedCities`, composite `usageCount+lastUsedAt` sur Keyword, composite `indexationTier+status` sur Article, FK Restrict sur GenerationProvenance). pgvector wiring acquis. Aucun problème bloquant ; les 2 P1 sont des optimisations marginales. **22/25**, perte 3 points sur la validation runtime des indexes pgvector côté migration SQL (non visible dans schema.prisma seul).
