-- Migration: Phase A (City model 2100 villes) + Phase D (SearchIntent +3)
-- Sprint Perfection 2026-05-22
-- Additive uniquement — ne touche pas les tables existantes

-- Phase D: Extend SearchIntent enum with 3 new 2026 intent values
ALTER TYPE "SearchIntent" ADD VALUE IF NOT EXISTS 'voice_search';
ALTER TYPE "SearchIntent" ADD VALUE IF NOT EXISTS 'ai_overview';
ALTER TYPE "SearchIntent" ADD VALUE IF NOT EXISTS 'featured_snippet';

-- Phase A: Create cities table
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "population" INTEGER NOT NULL,
    "department_code" VARCHAR(3) NOT NULL,
    "department_name" VARCHAR(80) NOT NULL,
    "region_slug" VARCHAR(80) NOT NULL,
    "region_name" VARCHAR(80) NOT NULL,
    "insee_code" VARCHAR(6) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "population_tier" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "is_targeted" BOOLEAN NOT NULL DEFAULT true,
    "is_covered" BOOLEAN NOT NULL DEFAULT false,
    "articles_count" INTEGER NOT NULL DEFAULT 0,
    "last_article_at" TIMESTAMP(3),
    "has_economic_data" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");
CREATE UNIQUE INDEX "cities_insee_code_key" ON "cities"("insee_code");

-- Indexes for performance
CREATE INDEX "cities_population_idx" ON "cities"("population" DESC);
CREATE INDEX "cities_department_code_idx" ON "cities"("department_code");
CREATE INDEX "cities_region_slug_idx" ON "cities"("region_slug");
CREATE INDEX "cities_is_targeted_is_covered_idx" ON "cities"("is_targeted", "is_covered");
CREATE INDEX "cities_population_tier_idx" ON "cities"("population_tier");
