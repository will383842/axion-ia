-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('landing_ville', 'blog_article', 'blog_from_rss', 'blog_from_keywords', 'blog_from_title', 'comparison', 'guide_pilier', 'qa_derived', 'faq_standalone');

-- CreateEnum
CREATE TYPE "ContentGenJobStatus" AS ENUM ('queued', 'running', 'generating_text', 'generating_image', 'running_qa', 'quality_improving', 'needs_review', 'approved', 'publishing', 'published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error');

-- CreateEnum
CREATE TYPE "IndexationTier" AS ENUM ('tier_1_indexable', 'tier_2_noindex_follow', 'tier_3_noindex_nofollow');

-- CreateEnum
CREATE TYPE "ExpansionMode" AS ENUM ('manual', 'all_villes', 'all_regions', 'custom_villes', 'from_keywords', 'from_questions', 'from_rss_items', 'from_csv');

-- CreateEnum
CREATE TYPE "ProviderKey" AS ENUM ('openai', 'anthropic', 'perplexity', 'unsplash', 'gpt_image');

-- CreateEnum
CREATE TYPE "ProviderRole" AS ENUM ('text', 'image', 'data', 'stock_image', 'rerank');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_edits', 'promoted_t1');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('draft', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CoverageScope" AS ENUM ('ville', 'departement', 'region', 'multi');

-- CreateEnum
CREATE TYPE "OrganisationType" AS ENUM ('entreprise_privee', 'ecole', 'universite', 'mairie', 'collectivite', 'hopital', 'association', 'comite_entreprise', 'opco', 'carsat', 'etablissement_public', 'autre');

-- CreateEnum
CREATE TYPE "SearchIntent" AS ENUM ('informational', 'commercial_investigation', 'transactional', 'navigational', 'local');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('official', 'high', 'standard', 'low', 'excluded');

-- CreateEnum
CREATE TYPE "WebVitalMetric" AS ENUM ('LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'TBT');

-- CreateEnum
CREATE TYPE "WebVitalRating" AS ENUM ('good', 'needs_improvement', 'poor');

-- Audit A7 patch (2026-05-15) : `CREATE TYPE "KeywordTrackingSource"` retiré.
-- L'enum est déjà créé par la migration plus précoce
-- `20260514100000_add_keyword_tracking/migration.sql:5`. Le diff Prisma a
-- regénéré l'enum ici car le shadow DB de génération n'avait pas appliqué
-- `100000` au moment de `prisma migrate diff`. Sans ce retrait,
-- `prisma migrate deploy` failait SQLSTATE 42710 ("type already exists").
-- Référence : `_AUDIT/CONTENT-GEN-AUDIT-A7-MIGRATION-2026-05-15.md` § 9 P0-1.

-- DropIndex
-- Audit A2 patch (2026-05-15) : 3 DROP INDEX commentés.
-- Ces index sont créés par des migrations raw SQL hors-Prisma (pgvector + FTS) :
--  - `knowledge_embeddings_hnsw_cosine_idx` : créé par
--    `prisma/migrations/20260514020000_kb_v4_pgvector_embeddings/migration.sql:33`
--    (`CREATE INDEX IF NOT EXISTS ... USING hnsw (embedding vector_cosine_ops)`)
--    backbone de la recherche vectorielle KB via `kb-client.ts`.
--  - `knowledge_translations_search_idx` + `knowledge_translations_title_trgm_idx` :
--    créés par `prisma/migrations_fts/kb_fts_setup.sql:23,27` (FTS GIN + trgm).
-- Prisma ne tracke pas les index pgvector/GIN custom → drift apparent.
-- Les laisser dropper ici = perte significative de perf recherche vectorielle
-- + FTS en prod (cf. Audit A2 R2). Pas d'impact fonctionnel à commenter
-- (les CREATE INDEX IF NOT EXISTS originaux restent appliqués).
-- DROP INDEX "knowledge_embeddings_hnsw_cosine_idx";
-- DROP INDEX "knowledge_translations_search_idx";
-- DROP INDEX "knowledge_translations_title_trgm_idx";

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "direct_answer" TEXT,
ADD COLUMN     "editorial_score" INTEGER,
ADD COLUMN     "fact_check_score" INTEGER,
ADD COLUMN     "faq_json" JSONB,
ADD COLUMN     "generated_by_job_id" TEXT,
ADD COLUMN     "indexation_tier" "IndexationTier" NOT NULL DEFAULT 'tier_2_noindex_follow',
ADD COLUMN     "is_news" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kb_chunk_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "news_category" VARCHAR(60),
ADD COLUMN     "news_source_name" VARCHAR(120),
ADD COLUMN     "news_source_url" VARCHAR(512),
ADD COLUMN     "plagiarism_score" DECIMAL(5,2),
ADD COLUMN     "promoted_at" TIMESTAMP(3),
ADD COLUMN     "published_at_dateline" VARCHAR(120),
ADD COLUMN     "quality_score" INTEGER,
ADD COLUMN     "readability_score" DECIMAL(5,2),
ADD COLUMN     "search_intent" "SearchIntent",
ADD COLUMN     "seo_score" INTEGER,
ADD COLUMN     "template_variant" VARCHAR(60);

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "enrichment_context" JSONB,
ADD COLUMN     "generated_by_job_id" TEXT,
ADD COLUMN     "indexation_tier" "IndexationTier" NOT NULL DEFAULT 'tier_2_noindex_follow',
ADD COLUMN     "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_article_id" UUID,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "quality_score" INTEGER,
ADD COLUMN     "search_console_ctr" DECIMAL(6,4);

-- AlterTable
-- Audit A2 note (2026-05-15) R4 : les 3 ALTER COLUMN id DROP DEFAULT ci-dessous
-- sont INTENTIONNELS — alignement Prisma drift avec schema.prisma.
-- Les migrations KB d'origine (kb_v4_*) ont créé ces colonnes avec
-- `DEFAULT gen_random_uuid()` côté DB. schema.prisma déclare `@default(uuid())`
-- ce qui signifie « générer côté client Prisma, pas côté DB ».
-- Impact : les INSERT effectués via `prisma.client.X.create()` continuent de
-- fonctionner (Prisma fournit l'id). Les INSERT raw psql qui OMETTENT id
-- échoueront — vérifier qu'aucun outil tiers ne dépend du DEFAULT côté DB.
ALTER TABLE "knowledge_annotations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_collections" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_seo_cache" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
-- Pass B P0-1 patch (2026-05-14) : ligne commentée — `search_vector` est une
-- colonne `Unsupported("tsvector")?` GENERATED ALWAYS via `kb_fts_setup.sql`
-- (cf. schema.prisma:2008). Prisma diff tente DROP DEFAULT mais Postgres
-- refuse sur colonnes générées. Pas d'impact fonctionnel (search_vector
-- conserve son comportement GENERATED).
-- ALTER TABLE "knowledge_translations" ALTER COLUMN "search_vector" DROP DEFAULT;

-- CreateTable
CREATE TABLE "content_gen_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "content_gen_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_config" (
    "id" TEXT NOT NULL,
    "provider" "ProviderKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "role" "ProviderRole" NOT NULL,
    "model" TEXT NOT NULL,
    "fallbackProviderId" TEXT,
    "monthlyCapUsd" DECIMAL(10,2) NOT NULL,
    "currentMonthSpentUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rateLimitRpm" INTEGER,
    "rateLimitTpm" INTEGER,
    "apiKeyEnvVar" TEXT NOT NULL,
    "extraConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "variant" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "outputSchemaZod" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "expansionMode" "ExpansionMode" NOT NULL DEFAULT 'manual',
    "expansionValues" JSONB,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "generatedItems" INTEGER NOT NULL DEFAULT 0,
    "publishedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "defaultModel" TEXT,
    "defaultTemperature" DECIMAL(3,2),
    "defaultMaxTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "content_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "bioMd" TEXT NOT NULL,
    "photoUrl80" TEXT NOT NULL,
    "photoUrl256" TEXT NOT NULL,
    "photoUrl1024" TEXT NOT NULL,
    "photoAlt" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "linkedinUrl" TEXT,
    "twitterHandle" TEXT,
    "alumniOf" TEXT,
    "awards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowsAbout" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPersona" BOOLEAN NOT NULL DEFAULT false,
    "personaDisclaimer" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_phrases" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "reason" TEXT,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'warn',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banned_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_distribution_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "distribution" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverage_distribution_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_mix_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mix" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_mix_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CoverageStatus" NOT NULL DEFAULT 'draft',
    "scope" "CoverageScope" NOT NULL,
    "anchorVilleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anchorDepartementCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anchorRegionSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalTargetCount" INTEGER NOT NULL,
    "typeDistribution" JSONB NOT NULL,
    "audienceMix" JSONB NOT NULL,
    "searchIntentMix" JSONB,
    "estimatedCostUsd" DECIMAL(10,2),
    "estimatedDurationMinutes" INTEGER,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "qualityImprovedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "coverage_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_gen_jobs" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "status" "ContentGenJobStatus" NOT NULL DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "templateId" TEXT,
    "campaignId" TEXT,
    "inputPayload" JSONB NOT NULL,
    "targetLocale" "Locale" NOT NULL DEFAULT 'fr',
    "anchorVilleSlug" TEXT,
    "anchorDepartementCode" TEXT,
    "anchorRegionSlug" TEXT,
    "targetAudienceSize" "CompanySize",
    "targetAudienceOrganisation" "OrganisationType",
    "targetSearchIntent" "SearchIntent" NOT NULL DEFAULT 'informational',
    "primaryProvider" "ProviderKey" NOT NULL,
    "fallbackProvider" "ProviderKey",
    "modelUsed" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "outputBlogPostId" UUID,
    "outputVilleCopyPath" TEXT,
    "outputFaqIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputQaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputJsonRaw" JSONB,
    "qualityScore" INTEGER,
    "plagiarismScore" DECIMAL(5,2),
    "readabilityScore" DECIMAL(5,2),
    "doctrineCheckPassed" BOOLEAN,
    "seoScore" INTEGER,
    "qualityImprovementAttempts" INTEGER NOT NULL DEFAULT 0,
    "targetKnowledgeEntryId" UUID,
    "kbIngestStatus" VARCHAR(40),
    "kbRejectReason" VARCHAR(200),
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "imageCount" INTEGER,
    "costUsd" DECIMAL(10,4),
    "costBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "content_gen_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'info',
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_queue" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "promotedToTier1At" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_vital_samples" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "metric" "WebVitalMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" "WebVitalRating" NOT NULL,
    "navigationType" TEXT,
    "deviceType" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "pageType" VARCHAR(40),
    "knowledgeEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_vital_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ledger" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" "ProviderKey" NOT NULL,
    "model" TEXT NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,4) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "provider" "ProviderKey",
    "generated" INTEGER NOT NULL DEFAULT 0,
    "published" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "needsReview" INTEGER NOT NULL DEFAULT 0,
    "duplicatesBlocked" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "totalTokensInput" BIGINT NOT NULL DEFAULT 0,
    "totalTokensOutput" BIGINT NOT NULL DEFAULT 0,
    "avgQualityScore" DECIMAL(5,2),

    CONSTRAINT "content_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_references" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "publisherDomain" TEXT NOT NULL,
    "trustTier" "TrustTier" NOT NULL DEFAULT 'standard',
    "language" "Locale" NOT NULL DEFAULT 'fr',
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_citations" (
    "id" TEXT NOT NULL,
    "articleId" UUID,
    "jobId" TEXT,
    "externalReferenceId" TEXT NOT NULL,
    "citationContext" TEXT NOT NULL,
    "anchorText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_citations_pkey" PRIMARY KEY ("id")
);

-- Audit A7 patch (2026-05-15) : `CREATE TABLE "keyword_tracking"` retiré.
-- La table est déjà créée par la migration plus précoce
-- `20260514100000_add_keyword_tracking/migration.sql:8-25`. Voir P0-1 § ci-dessus.

-- CreateIndex
CREATE UNIQUE INDEX "content_gen_config_key_key" ON "content_gen_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_config_provider_key" ON "provider_config"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "content_templates_slug_key" ON "content_templates"("slug");

-- CreateIndex
CREATE INDEX "content_templates_contentType_isActive_idx" ON "content_templates"("contentType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_slug_key" ON "author_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "banned_phrases_pattern_key" ON "banned_phrases"("pattern");

-- CreateIndex
CREATE UNIQUE INDEX "coverage_distribution_profiles_slug_key" ON "coverage_distribution_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "audience_mix_profiles_slug_key" ON "audience_mix_profiles"("slug");

-- CreateIndex
CREATE INDEX "coverage_campaigns_status_createdAt_idx" ON "coverage_campaigns"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "content_gen_jobs_idempotencyKey_key" ON "content_gen_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "content_gen_jobs_status_createdAt_idx" ON "content_gen_jobs"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "content_gen_jobs_contentType_status_idx" ON "content_gen_jobs"("contentType", "status");

-- CreateIndex
CREATE INDEX "content_gen_jobs_campaignId_status_idx" ON "content_gen_jobs"("campaignId", "status");

-- CreateIndex
CREATE INDEX "content_gen_jobs_anchorVilleSlug_idx" ON "content_gen_jobs"("anchorVilleSlug");

-- CreateIndex
CREATE INDEX "generation_logs_jobId_timestamp_idx" ON "generation_logs"("jobId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "review_queue_jobId_key" ON "review_queue"("jobId");

-- CreateIndex
CREATE INDEX "review_queue_status_createdAt_idx" ON "review_queue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "web_vital_samples_url_metric_createdAt_idx" ON "web_vital_samples"("url", "metric", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "web_vital_samples_pageType_metric_createdAt_idx" ON "web_vital_samples"("pageType", "metric", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "cost_ledger_provider_timestamp_idx" ON "cost_ledger"("provider", "timestamp");

-- CreateIndex
CREATE INDEX "cost_ledger_jobId_idx" ON "cost_ledger"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "content_metrics_date_contentType_provider_key" ON "content_metrics"("date", "contentType", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "external_references_url_key" ON "external_references"("url");

-- CreateIndex
CREATE INDEX "external_references_trustTier_language_idx" ON "external_references"("trustTier", "language");

-- CreateIndex
CREATE INDEX "external_references_publisherDomain_idx" ON "external_references"("publisherDomain");

-- CreateIndex
CREATE INDEX "content_citations_articleId_idx" ON "content_citations"("articleId");

-- CreateIndex
CREATE INDEX "content_citations_externalReferenceId_idx" ON "content_citations"("externalReferenceId");

-- CreateIndex
CREATE INDEX "content_citations_jobId_idx" ON "content_citations"("jobId");

-- Audit A7 patch (2026-05-15) : 4 `CREATE INDEX keyword_tracking_*` retirés.
-- Indexes déjà créés par la migration plus précoce
-- `20260514100000_add_keyword_tracking/migration.sql:28-37`.

-- CreateIndex
CREATE INDEX "articles_indexation_tier_status_idx" ON "articles"("indexation_tier", "status");

-- CreateIndex
CREATE INDEX "articles_is_news_published_at_idx" ON "articles"("is_news", "published_at" DESC);

-- CreateIndex
CREATE INDEX "articles_generated_by_job_id_idx" ON "articles"("generated_by_job_id");

-- CreateIndex
CREATE INDEX "faqs_indexation_tier_status_idx" ON "faqs"("indexation_tier", "status");

-- CreateIndex
CREATE INDEX "faqs_parent_article_id_idx" ON "faqs"("parent_article_id");

-- CreateIndex
CREATE INDEX "faqs_is_auto_generated_published_at_idx" ON "faqs"("is_auto_generated", "published_at" DESC);

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_parent_article_id_fkey" FOREIGN KEY ("parent_article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_gen_jobs" ADD CONSTRAINT "content_gen_jobs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "content_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_gen_jobs" ADD CONSTRAINT "content_gen_jobs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "coverage_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "content_gen_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "content_gen_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_citations" ADD CONSTRAINT "content_citations_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "content_gen_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_citations" ADD CONSTRAINT "content_citations_externalReferenceId_fkey" FOREIGN KEY ("externalReferenceId") REFERENCES "external_references"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "knowledge_seo_cache_translation_id_provider_provider_version_ke" RENAME TO "knowledge_seo_cache_translation_id_provider_provider_versio_key";

