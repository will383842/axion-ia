-- P1-1 Sprint P5: CampaignTemplate (6 presets seedés)
-- P1-4 Sprint P5: ArticleFeedback (thumbs up/down admin)

-- CampaignTemplate
CREATE TABLE "campaign_templates" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_templates_slug_key" ON "campaign_templates"("slug");
CREATE INDEX "campaign_templates_slug_idx" ON "campaign_templates"("slug");
CREATE INDEX "campaign_templates_is_active_idx" ON "campaign_templates"("is_active");

-- ArticleFeedback
CREATE TABLE "article_feedback" (
    "id" TEXT NOT NULL,
    "article_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "article_feedback_article_id_idx" ON "article_feedback"("article_id");
CREATE INDEX "article_feedback_user_id_idx" ON "article_feedback"("user_id");

-- FK: ArticleFeedback -> Article
ALTER TABLE "article_feedback" ADD CONSTRAINT "article_feedback_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
