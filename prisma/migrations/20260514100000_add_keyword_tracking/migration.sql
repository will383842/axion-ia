-- Sprint 12 V2 — KeywordTracking : suivi positions + CTR par mot-clé.
-- Alimenté par cron hebdo (Sprint 12.5 quand credentials GSC API + SerpAPI fournis).

-- CreateEnum
CREATE TYPE "KeywordTrackingSource" AS ENUM ('gsc', 'serpapi', 'manual');

-- CreateTable
CREATE TABLE "keyword_tracking" (
    "id" TEXT NOT NULL,
    "keyword" VARCHAR(255) NOT NULL,
    "targetUrl" VARCHAR(512) NOT NULL,
    "articleId" UUID,
    "position" DECIMAL(5,2) NOT NULL,
    "positionDelta" DECIMAL(5,2),
    "ctr" DECIMAL(6,4),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "source" "KeywordTrackingSource" NOT NULL DEFAULT 'gsc',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keyword_tracking_keyword_targetUrl_key" ON "keyword_tracking"("keyword", "targetUrl");

-- CreateIndex
CREATE INDEX "keyword_tracking_articleId_idx" ON "keyword_tracking"("articleId");

-- CreateIndex
CREATE INDEX "keyword_tracking_syncedAt_idx" ON "keyword_tracking"("syncedAt");

-- CreateIndex
CREATE INDEX "keyword_tracking_position_idx" ON "keyword_tracking"("position");
