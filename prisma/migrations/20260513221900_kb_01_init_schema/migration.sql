-- CreateEnum
CREATE TYPE "KbType" AS ENUM ('article', 'case_study', 'help_article', 'faq', 'glossary_term', 'guide', 'methodology', 'doctrine', 'adr', 'prompt_template', 'sop', 'post_mortem', 'tool_card', 'competitor_card', 'commercial_doc', 'onboarding_step');

-- CreateEnum
CREATE TYPE "KbDomain" AS ENUM ('commercial', 'technical', 'legal', 'hr', 'product', 'client', 'watch', 'internal', 'editorial', 'methodology');

-- CreateEnum
CREATE TYPE "KbAudience" AS ENUM ('public', 'client', 'team', 'will_only');

-- CreateEnum
CREATE TYPE "KbConfidentiality" AS ENUM ('public', 'internal', 'confidential', 'secret');

-- CreateEnum
CREATE TYPE "KbStatus" AS ENUM ('draft', 'review', 'approved', 'scheduled', 'published', 'archived', 'deprecated');

-- CreateEnum
CREATE TYPE "KbPipelineStage" AS ENUM ('idea', 'brief', 'draft', 'review', 'approved', 'scheduled', 'published', 'archived', 'deprecated');

-- CreateEnum
CREATE TYPE "KbRelationKind" AS ENUM ('replaces', 'cites', 'depends_on', 'related_to', 'supersedes', 'contradicts', 'extends');

-- CreateEnum
CREATE TYPE "KbFeedbackVote" AS ENUM ('up', 'down');

-- CreateEnum
CREATE TYPE "KbImportSource" AS ENUM ('audit_md', 'markdown_git', 'notion', 'csv', 'legacy_db', 'legacy_source');

-- CreateEnum
CREATE TYPE "KbImportStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "KbReviewerAssignmentStatus" AS ENUM ('pending', 'accepted', 'rejected', 'completed');

-- DropIndex
-- Audit recovery 2026-05-16 : 6 DROP INDEX + 3 DROP COLUMN rendus idempotents
-- car ces indexes/colonnes FTS étaient gérés via `prisma/migrations_fts/`
-- (parallel folder) jamais appliqué en prod. Sans IF EXISTS, prisma migrate
-- deploy fail P3018 sur premier index inexistant.
DROP INDEX IF EXISTS "article_translations_search_idx";

-- DropIndex
DROP INDEX IF EXISTS "bookings_options_email_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "case_study_translations_search_idx";

-- DropIndex
DROP INDEX IF EXISTS "help_article_translations_search_idx";

-- DropIndex
DROP INDEX IF EXISTS "submissions_email_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "testimonials_company_trgm_idx";

-- AlterTable
ALTER TABLE "article_translations" DROP COLUMN IF EXISTS "search_vector";

-- AlterTable
ALTER TABLE "case_study_translations" DROP COLUMN IF EXISTS "search_vector";

-- AlterTable
ALTER TABLE "help_article_translations" DROP COLUMN IF EXISTS "search_vector";

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" UUID NOT NULL,
    "type" "KbType" NOT NULL,
    "domain" "KbDomain" NOT NULL,
    "audience" "KbAudience" NOT NULL DEFAULT 'team',
    "confidentiality" "KbConfidentiality" NOT NULL DEFAULT 'internal',
    "status" "KbStatus" NOT NULL DEFAULT 'draft',
    "pipelineStage" "KbPipelineStage" NOT NULL DEFAULT 'idea',
    "cover_image_id" UUID,
    "hero_layout" VARCHAR(40),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_until" TIMESTAMP(3),
    "series_id" UUID,
    "slug" VARCHAR(180) NOT NULL,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_up_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_down_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_for" TIMESTAMP(3),
    "embargo_until" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "review_due_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "reviewer_id" UUID,
    "assigned_author_id" UUID,
    "assigned_reviewer_id" UUID,
    "brief_markdown" TEXT,
    "target_word_count" INTEGER,
    "target_keyword" VARCHAR(180),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_translations" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "body_json" JSONB,
    "body_text" TEXT,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "og_image_id" UUID,
    "reading_time" INTEGER,
    "word_count" INTEGER,
    "readability_score" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "alts" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_versions" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "translation_id" UUID,
    "version" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_tags" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name_fr" VARCHAR(120) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "desc_fr" TEXT,
    "desc_en" TEXT,
    "color" VARCHAR(7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_tags_on_entries" (
    "entry_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "knowledge_tags_on_entries_pkey" PRIMARY KEY ("entry_id","tag_id")
);

-- CreateTable
CREATE TABLE "knowledge_relations" (
    "id" UUID NOT NULL,
    "from_entry_id" UUID NOT NULL,
    "to_entry_id" UUID NOT NULL,
    "kind" "KbRelationKind" NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_feedback" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "vote" "KbFeedbackVote" NOT NULL,
    "ip_hash" VARCHAR(64) NOT NULL,
    "session_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_assets" (
    "id" UUID NOT NULL,
    "mime_type" VARCHAR(80) NOT NULL,
    "original_path" VARCHAR(512) NOT NULL,
    "processed_paths" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "alt_text" TEXT,
    "caption" TEXT,
    "uploaded_by_id" UUID,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_slug_history" (
    "id" UUID NOT NULL,
    "old_locale" "Locale" NOT NULL,
    "old_type" "KbType" NOT NULL,
    "old_slug" VARCHAR(255) NOT NULL,
    "entry_id" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "knowledge_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bookmarks" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "client_email" CITEXT,
    "session_id" VARCHAR(64),
    "private_note_markdown" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_import_batches" (
    "id" UUID NOT NULL,
    "source" "KbImportSource" NOT NULL,
    "source_ref" VARCHAR(255),
    "imported_by_id" UUID,
    "entries_count" INTEGER NOT NULL DEFAULT 0,
    "status" "KbImportStatus" NOT NULL DEFAULT 'pending',
    "error_log" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_reviewer_assignments" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "KbReviewerAssignmentStatus" NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "reviewer_note" TEXT,

    CONSTRAINT "knowledge_reviewer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_entries_slug_key" ON "knowledge_entries"("slug");

-- CreateIndex
CREATE INDEX "knowledge_entries_type_status_audience_idx" ON "knowledge_entries"("type", "status", "audience");

-- CreateIndex
CREATE INDEX "knowledge_entries_type_published_at_idx" ON "knowledge_entries"("type", "published_at" DESC);

-- CreateIndex
CREATE INDEX "knowledge_entries_status_pipelineStage_idx" ON "knowledge_entries"("status", "pipelineStage");

-- CreateIndex
CREATE INDEX "knowledge_entries_published_at_idx" ON "knowledge_entries"("published_at" DESC);

-- CreateIndex
CREATE INDEX "knowledge_entries_review_due_at_idx" ON "knowledge_entries"("review_due_at");

-- CreateIndex
CREATE INDEX "knowledge_entries_expires_at_idx" ON "knowledge_entries"("expires_at");

-- CreateIndex
CREATE INDEX "knowledge_entries_pinned_featured_idx" ON "knowledge_entries"("pinned", "featured");

-- CreateIndex
CREATE INDEX "knowledge_entries_domain_status_idx" ON "knowledge_entries"("domain", "status");

-- CreateIndex
CREATE INDEX "knowledge_entries_assigned_author_id_idx" ON "knowledge_entries"("assigned_author_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_assigned_reviewer_id_idx" ON "knowledge_entries"("assigned_reviewer_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_scheduled_for_idx" ON "knowledge_entries"("scheduled_for");

-- CreateIndex
CREATE INDEX "knowledge_entries_deleted_at_idx" ON "knowledge_entries"("deleted_at");

-- CreateIndex
CREATE INDEX "knowledge_translations_slug_idx" ON "knowledge_translations"("slug");

-- CreateIndex
CREATE INDEX "knowledge_translations_locale_quality_score_idx" ON "knowledge_translations"("locale", "quality_score");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_translations_entry_id_locale_key" ON "knowledge_translations"("entry_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_translations_locale_slug_key" ON "knowledge_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "knowledge_versions_entry_id_version_idx" ON "knowledge_versions"("entry_id", "version" DESC);

-- CreateIndex
CREATE INDEX "knowledge_versions_created_at_idx" ON "knowledge_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_versions_entry_id_translation_id_version_key" ON "knowledge_versions"("entry_id", "translation_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_tags_slug_key" ON "knowledge_tags"("slug");

-- CreateIndex
CREATE INDEX "knowledge_tags_slug_idx" ON "knowledge_tags"("slug");

-- CreateIndex
CREATE INDEX "knowledge_tags_on_entries_tag_id_idx" ON "knowledge_tags_on_entries"("tag_id");

-- CreateIndex
CREATE INDEX "knowledge_relations_to_entry_id_kind_idx" ON "knowledge_relations"("to_entry_id", "kind");

-- CreateIndex
CREATE INDEX "knowledge_relations_from_entry_id_kind_idx" ON "knowledge_relations"("from_entry_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_relations_from_entry_id_to_entry_id_kind_key" ON "knowledge_relations"("from_entry_id", "to_entry_id", "kind");

-- CreateIndex
CREATE INDEX "knowledge_feedback_entry_id_locale_vote_idx" ON "knowledge_feedback"("entry_id", "locale", "vote");

-- CreateIndex
CREATE INDEX "knowledge_feedback_created_at_idx" ON "knowledge_feedback"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_assets_hash_key" ON "knowledge_assets"("hash");

-- CreateIndex
CREATE INDEX "knowledge_assets_hash_idx" ON "knowledge_assets"("hash");

-- CreateIndex
CREATE INDEX "knowledge_assets_uploaded_by_id_idx" ON "knowledge_assets"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "knowledge_assets_deleted_at_idx" ON "knowledge_assets"("deleted_at");

-- CreateIndex
CREATE INDEX "knowledge_assets_mime_type_idx" ON "knowledge_assets"("mime_type");

-- CreateIndex
CREATE INDEX "knowledge_slug_history_entry_id_idx" ON "knowledge_slug_history"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_slug_history_old_locale_old_type_old_slug_key" ON "knowledge_slug_history"("old_locale", "old_type", "old_slug");

-- CreateIndex
CREATE INDEX "knowledge_bookmarks_client_email_created_at_idx" ON "knowledge_bookmarks"("client_email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "knowledge_bookmarks_session_id_idx" ON "knowledge_bookmarks"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_bookmarks_entry_id_client_email_key" ON "knowledge_bookmarks"("entry_id", "client_email");

-- CreateIndex
CREATE INDEX "knowledge_import_batches_source_status_idx" ON "knowledge_import_batches"("source", "status");

-- CreateIndex
CREATE INDEX "knowledge_import_batches_imported_by_id_idx" ON "knowledge_import_batches"("imported_by_id");

-- CreateIndex
CREATE INDEX "knowledge_reviewer_assignments_reviewer_id_status_idx" ON "knowledge_reviewer_assignments"("reviewer_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_reviewer_assignments_due_at_idx" ON "knowledge_reviewer_assignments"("due_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_reviewer_assignments_entry_id_reviewer_id_key" ON "knowledge_reviewer_assignments"("entry_id", "reviewer_id");

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "knowledge_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_assigned_author_id_fkey" FOREIGN KEY ("assigned_author_id") REFERENCES "authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_translations" ADD CONSTRAINT "knowledge_translations_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_translations" ADD CONSTRAINT "knowledge_translations_og_image_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "knowledge_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_translation_id_fkey" FOREIGN KEY ("translation_id") REFERENCES "knowledge_translations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_tags_on_entries" ADD CONSTRAINT "knowledge_tags_on_entries_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_tags_on_entries" ADD CONSTRAINT "knowledge_tags_on_entries_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "knowledge_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_from_entry_id_fkey" FOREIGN KEY ("from_entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_to_entry_id_fkey" FOREIGN KEY ("to_entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_feedback" ADD CONSTRAINT "knowledge_feedback_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_slug_history" ADD CONSTRAINT "knowledge_slug_history_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bookmarks" ADD CONSTRAINT "knowledge_bookmarks_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_reviewer_assignments" ADD CONSTRAINT "knowledge_reviewer_assignments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "knowledge_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

