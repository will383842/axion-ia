-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('developpement', 'ia', 'data', 'design', 'produit', 'conseil', 'commercial', 'marketing', 'operations', 'support', 'autre');

-- CreateEnum
CREATE TYPE "JobWorkMode" AS ENUM ('on_site', 'hybrid', 'remote');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('new', 'reviewing', 'shortlisted', 'rejected', 'hired', 'archived');

-- CreateTable
CREATE TABLE "job_offers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "category" "JobCategory" NOT NULL DEFAULT 'autre',
    "title_fr" VARCHAR(160) NOT NULL,
    "title_en" VARCHAR(160) NOT NULL,
    "summary_fr" VARCHAR(320) NOT NULL,
    "summary_en" VARCHAR(320) NOT NULL,
    "body_fr" TEXT NOT NULL,
    "body_json_fr" JSONB,
    "body_text_fr" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_json_en" JSONB,
    "body_text_en" TEXT NOT NULL,
    "employment_type" VARCHAR(20) NOT NULL DEFAULT 'FULL_TIME',
    "work_mode" "JobWorkMode" NOT NULL DEFAULT 'on_site',
    "city" VARCHAR(120),
    "region" VARCHAR(120),
    "country" VARCHAR(2) NOT NULL DEFAULT 'FR',
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_period" VARCHAR(10) NOT NULL DEFAULT 'YEAR',
    "salary_currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "salary_visible" BOOLEAN NOT NULL DEFAULT false,
    "is_commission" BOOLEAN NOT NULL DEFAULT false,
    "requires_driver_license" BOOLEAN NOT NULL DEFAULT false,
    "requires_vehicle" BOOLEAN NOT NULL DEFAULT false,
    "screening_questions" JSONB,
    "contract_label" VARCHAR(60),
    "start_date" TIMESTAMP(3),
    "application_deadline" TIMESTAMP(3),
    "remote_days_per_week" INTEGER,
    "perks" JSONB,
    "team_name" VARCHAR(120),
    "manager_name" VARCHAR(120),
    "hero_image_path" VARCHAR(255),
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "indexation_tier" "IndexationTier" NOT NULL DEFAULT 'tier_1_indexable',
    "og_image_path" VARCHAR(255),
    "date_posted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_through" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "filled_at" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "offer_title_snap" VARCHAR(160) NOT NULL,
    "civility" VARCHAR(20),
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" VARCHAR(120),
    "motivation" TEXT,
    "current_role" VARCHAR(200),
    "experience_band" VARCHAR(40),
    "availability" VARCHAR(120),
    "linkedin_url" VARCHAR(255),
    "has_driver_license" BOOLEAN,
    "has_vehicle" BOOLEAN,
    "answers" JSONB,
    "cv_storage_path" VARCHAR(255),
    "cv_original_name" VARCHAR(255),
    "cv_mime_type" VARCHAR(100),
    "cv_size_bytes" INTEGER,
    "ip_hash" VARCHAR(64),
    "user_agent" TEXT,
    "consent_version" VARCHAR(40) NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'new',
    "internal_notes" TEXT,
    "assigned_to" VARCHAR(100),
    "needs_attention" BOOLEAN NOT NULL DEFAULT true,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_slug_key" ON "job_offers"("slug");

-- CreateIndex
CREATE INDEX "job_offers_status_idx" ON "job_offers"("status");

-- CreateIndex
CREATE INDEX "job_offers_category_status_idx" ON "job_offers"("category", "status");

-- CreateIndex
CREATE INDEX "job_offers_indexation_tier_status_idx" ON "job_offers"("indexation_tier", "status");

-- CreateIndex
CREATE INDEX "job_offers_status_display_order_idx" ON "job_offers"("status", "display_order");

-- CreateIndex
CREATE INDEX "job_applications_offer_id_idx" ON "job_applications"("offer_id");

-- CreateIndex
CREATE INDEX "job_applications_status_needs_attention_idx" ON "job_applications"("status", "needs_attention");

-- CreateIndex
CREATE INDEX "job_applications_submitted_at_idx" ON "job_applications"("submitted_at");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "job_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

