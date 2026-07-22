-- CreateEnum
CREATE TYPE "PodcastRequestStatus" AS ENUM ('new', 'contacted', 'scheduled', 'recorded', 'archived', 'declined');

-- CreateTable
CREATE TABLE "podcast_requests" (
    "id" UUID NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "leader_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "activity" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "source" VARCHAR(40) NOT NULL DEFAULT 'form',
    "status" "PodcastRequestStatus" NOT NULL DEFAULT 'new',
    "internal_notes" TEXT,
    "handled_at" TIMESTAMP(3),
    "ip_hash" VARCHAR(64),
    "consent_version" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcast_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "podcast_requests_status_idx" ON "podcast_requests"("status");

-- CreateIndex
CREATE INDEX "podcast_requests_status_created_at_idx" ON "podcast_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "podcast_requests_created_at_idx" ON "podcast_requests"("created_at" DESC);
