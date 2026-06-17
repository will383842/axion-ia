-- Observatoire de l'IA dans les entreprises françaises 2026
-- Migration STRICTEMENT ADDITIVE. Ne touche à aucun objet existant.
-- (Le `prisma migrate diff` global propose des DROP INDEX/COLUMN/TABLE liés à
--  la dérive schéma↔DB connue — FTS/vector/trgm/opco_baremes — qui NE doivent
--  PAS être appliqués ici. Cf. mémoire prod-schema-drift-content-engine-v2.)

-- CreateEnum
CREATE TYPE "MaturityLevel" AS ENUM ('none', 'exploration', 'poc', 'production', 'scaled');

-- CreateEnum
CREATE TYPE "CompetitorsUseAi" AS ENUM ('yes_clearly', 'probably', 'dont_know', 'no');

-- CreateEnum
CREATE TYPE "HasStrategy" AS ENUM ('formalized', 'in_progress', 'none');

-- CreateEnum
CREATE TYPE "AnnualBudget" AS ENUM ('zero', 'lt_1k', 'k1_5', 'k5_20', 'k20_100', 'gt_100k', 'dont_know');

-- CreateEnum
CREATE TYPE "TimeSavedPerDay" AS ENUM ('none', 'lt_30min', 'm30_1h', 'h1_2', 'h2_3', 'gt_3h');

-- CreateEnum
CREATE TYPE "RgpdConcern" AS ENUM ('very', 'somewhat', 'little', 'not_at_all');

-- CreateEnum
CREATE TYPE "TeamTrained" AS ENUM ('formal', 'informal', 'none');

-- CreateEnum
CREATE TYPE "Satisfaction" AS ENUM ('very_satisfied', 'satisfied', 'mixed', 'disappointed');

-- CreateEnum
CREATE TYPE "InvestmentIntent" AS ENUM ('strong_increase', 'increase', 'stable', 'decrease', 'none_budget');

-- CreateEnum
CREATE TYPE "RespondentRole" AS ENUM ('ceo_founder', 'gm_coo', 'cio_it', 'business_director', 'ops_manager', 'other');

-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'barometer_insight';

-- CreateTable
CREATE TABLE "barometer_responses" (
    "id" UUID NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "visitor_id" VARCHAR(120),
    "company_size" "CompanySize" NOT NULL,
    "sector" VARCHAR(80) NOT NULL,
    "region" VARCHAR(80) NOT NULL,
    "respondent_role" "RespondentRole" NOT NULL,
    "maturity_level" "MaturityLevel" NOT NULL,
    "competitors_use_ai" "CompetitorsUseAi" NOT NULL,
    "has_strategy" "HasStrategy" NOT NULL,
    "annual_budget" "AnnualBudget" NOT NULL,
    "time_saved_per_day" "TimeSavedPerDay" NOT NULL,
    "rgpd_concern" "RgpdConcern" NOT NULL,
    "team_trained" "TeamTrained" NOT NULL,
    "satisfaction" "Satisfaction",
    "investment_intent" "InvestmentIntent" NOT NULL,
    "use_cases" JSONB NOT NULL,
    "tools" JSONB NOT NULL,
    "barriers" JSONB NOT NULL,
    "raw_answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barometer_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barometer_snapshots" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_responses" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barometer_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "barometer_responses_company_size_idx" ON "barometer_responses"("company_size");

-- CreateIndex
CREATE INDEX "barometer_responses_sector_idx" ON "barometer_responses"("sector");

-- CreateIndex
CREATE INDEX "barometer_responses_region_idx" ON "barometer_responses"("region");

-- CreateIndex
CREATE INDEX "barometer_responses_maturity_level_idx" ON "barometer_responses"("maturity_level");

-- CreateIndex
CREATE INDEX "barometer_responses_submitted_at_idx" ON "barometer_responses"("submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "barometer_snapshots_key_key" ON "barometer_snapshots"("key");
