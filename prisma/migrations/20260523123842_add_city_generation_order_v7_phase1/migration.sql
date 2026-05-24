-- Sprint v7 Phase 1 — schema fondations content-gen
-- Ajoute 3 enums + 6 colonnes coverage_campaigns + table city_generation_order
--
-- IMPORTANT : migration isolée v7-only (drift Prisma historique non inclus,
-- voir _AUDIT/SPRINT-V7-PHASE-1-WIP-2026-05-23.md décision Will 2026-05-23).

-- CreateEnum
CREATE TYPE "VilleScopeMode" AS ENUM ('global_queue', 'custom_subset');

-- CreateEnum
CREATE TYPE "MixMode" AS ENUM ('percentage', 'manual');

-- CreateEnum
CREATE TYPE "ExpansionPhase" AS ENUM ('phase_a', 'phase_b', 'phase_c', 'phase_d');

-- AlterTable
ALTER TABLE "coverage_campaigns" ADD COLUMN     "content_type_weights" JSONB,
ADD COLUMN     "custom_ville_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "daily_articles" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "expansion_phase" "ExpansionPhase",
ADD COLUMN     "mix_mode" "MixMode" NOT NULL DEFAULT 'percentage',
ADD COLUMN     "ville_scope_mode" "VilleScopeMode" NOT NULL DEFAULT 'global_queue';

-- CreateTable
CREATE TABLE "city_generation_order" (
    "ville_slug" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMP(3),
    "region_slug" TEXT NOT NULL,
    "dept_code" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "pop" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_generation_order_pkey" PRIMARY KEY ("ville_slug")
);

-- CreateIndex
CREATE UNIQUE INDEX "city_generation_order_rank_key" ON "city_generation_order"("rank");

-- CreateIndex
CREATE INDEX "city_generation_order_rank_idx" ON "city_generation_order"("rank");

-- CreateIndex
CREATE INDEX "city_generation_order_pinned_pinned_at_idx" ON "city_generation_order"("pinned", "pinned_at" DESC);

-- CreateIndex
CREATE INDEX "city_generation_order_region_slug_rank_idx" ON "city_generation_order"("region_slug", "rank");

-- CreateIndex
CREATE INDEX "city_generation_order_dept_code_rank_idx" ON "city_generation_order"("dept_code", "rank");

-- CreateIndex
CREATE INDEX "city_generation_order_tier_rank_idx" ON "city_generation_order"("tier", "rank");

-- CreateIndex
CREATE INDEX "coverage_campaigns_expansion_phase_status_idx" ON "coverage_campaigns"("expansion_phase", "status");
