-- CreateEnum
CREATE TYPE "CustomerReviewStatus" AS ENUM ('pending', 'published', 'hidden', 'rejected', 'archived');

-- CreateTable
CREATE TABLE "customer_reviews" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "author_first_name" VARCHAR(80) NOT NULL,
    "author_last_initial" VARCHAR(4) NOT NULL,
    "company_name" VARCHAR(200),
    "client_sector" VARCHAR(80),
    "city_slug" VARCHAR(100),
    "city_name" VARCHAR(120),
    "department_code" VARCHAR(3),
    "region_slug" VARCHAR(80),
    "service_line" "ServiceSector",
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(160),
    "comment" TEXT NOT NULL,
    "photo_kind" VARCHAR(16),
    "photo_storage_path" VARCHAR(512),
    "photo_url" VARCHAR(512),
    "photo_alt" VARCHAR(255),
    "reply_body" TEXT,
    "replied_at" TIMESTAMP(3),
    "replied_by" VARCHAR(120),
    "status" "CustomerReviewStatus" NOT NULL DEFAULT 'pending',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "moderated_by" VARCHAR(120),
    "moderated_at" TIMESTAMP(3),
    "moderation_notes" TEXT,
    "published_at" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "contact_email_enc" TEXT,
    "ip_hash" VARCHAR(64),
    "consent_version" VARCHAR(60),
    "source" VARCHAR(20) NOT NULL DEFAULT 'form',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_reviews_slug_key" ON "customer_reviews"("slug");

-- CreateIndex
CREATE INDEX "customer_reviews_status_idx" ON "customer_reviews"("status");

-- CreateIndex
CREATE INDEX "customer_reviews_status_published_at_idx" ON "customer_reviews"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "customer_reviews_status_rating_idx" ON "customer_reviews"("status", "rating");

-- CreateIndex
CREATE INDEX "customer_reviews_status_featured_idx" ON "customer_reviews"("status", "featured");

-- CreateIndex
CREATE INDEX "customer_reviews_city_slug_idx" ON "customer_reviews"("city_slug");

-- CreateIndex
CREATE INDEX "customer_reviews_department_code_idx" ON "customer_reviews"("department_code");

-- CreateIndex
CREATE INDEX "customer_reviews_region_slug_idx" ON "customer_reviews"("region_slug");

-- CreateIndex
CREATE INDEX "customer_reviews_client_sector_idx" ON "customer_reviews"("client_sector");

-- CreateIndex
CREATE INDEX "customer_reviews_service_line_idx" ON "customer_reviews"("service_line");

-- Defense-in-depth: garantir rating dans [1,5] au niveau DB (en plus de la validation Zod).
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);
