-- Migration: add_generated_ville_copy
-- Sprint VilleCopy generator 2026-05-24
-- Architecture : hub ville auto-généré, fallback du fichier statique manuel.
-- FR-only (EN locale désactivé cf AGENTS.md).

-- CreateEnum
CREATE TYPE "GeneratedVilleCopyStatus" AS ENUM ('generated', 'approved', 'rejected', 'quarantined');

-- CreateTable
CREATE TABLE "generated_ville_copies" (
    "id" TEXT NOT NULL,
    "ville_slug" VARCHAR(100) NOT NULL,
    "pitch_fr" VARCHAR(600) NOT NULL,
    "direct_answer_fr" VARCHAR(900) NOT NULL,
    "ecosystem_fr" VARCHAR(800) NOT NULL,
    "distances_fr" VARCHAR(400) NOT NULL,
    "top_sectors_naf" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services_context_json" JSONB NOT NULL,
    "faq_geolocalisee_json" JSONB NOT NULL,
    "hero_schema_json" JSONB,
    "quality_score" INTEGER NOT NULL,
    "plagiarism_score" DECIMAL(5,3),
    "duplicate_vs_verticales" DECIMAL(5,3),
    "model_used" VARCHAR(80) NOT NULL,
    "total_cost_usd" DECIMAL(10,6) NOT NULL,
    "prompt_hash" VARCHAR(64) NOT NULL,
    "tokens_input" INTEGER NOT NULL,
    "tokens_output" INTEGER NOT NULL,
    "kb_context_used" JSONB,
    "status" "GeneratedVilleCopyStatus" NOT NULL DEFAULT 'generated',
    "reviewed_by" VARCHAR(120),
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_ville_copies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generated_ville_copies_ville_slug_key" ON "generated_ville_copies"("ville_slug");

-- CreateIndex
CREATE INDEX "generated_ville_copies_status_idx" ON "generated_ville_copies"("status");

-- CreateIndex
CREATE INDEX "generated_ville_copies_quality_score_idx" ON "generated_ville_copies"("quality_score");

-- CreateIndex
CREATE INDEX "generated_ville_copies_ville_slug_status_idx" ON "generated_ville_copies"("ville_slug", "status");
