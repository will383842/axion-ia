-- Reconciliation migration (2026-06-16).
-- Le content-engine-v2 a ajouté ces objets à schema.prisma sans migration → dérive
-- schéma↔migrations : prod (et toute DB en `migrate deploy`) les manque, ce qui
-- bloque tout le content-gen (P2022 sur articles.featured_image_alt_fr, etc.).
-- Migration ADDITIVE UNIQUEMENT + idempotente (IF NOT EXISTS). Ne touche PAS aux
-- index vectoriels (pgvector HNSW) ni FTS (tsvector/trigram) gérés en SQL brut.

-- AlterTable: per-locale featured image alt (AEO) + og:image alt + testimonial photo alt
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "featured_image_alt_fr" VARCHAR(255);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "featured_image_alt_en" VARCHAR(255);
ALTER TABLE "article_translations" ADD COLUMN IF NOT EXISTS "og_image_alt" VARCHAR(255);
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "photo_alt" VARCHAR(255);

-- CreateTable
CREATE TABLE IF NOT EXISTS "article_slug_history" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "old_locale" "Locale" NOT NULL,
    "old_slug" VARCHAR(255) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "article_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "generated_ville_ecosystem" (
    "id" TEXT NOT NULL,
    "ville_slug" TEXT NOT NULL,
    "verticale" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "speakable_selectors" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "quality_score" DOUBLE PRECISION,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_ville_ecosystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "generated_ville_secteurs" (
    "id" TEXT NOT NULL,
    "ville_slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "speakable_selectors" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "quality_score" DOUBLE PRECISION,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_ville_secteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "generated_ville_faq_extended" (
    "id" TEXT NOT NULL,
    "ville_slug" TEXT NOT NULL,
    "verticale" TEXT NOT NULL,
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "quality_score" DOUBLE PRECISION,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_ville_faq_extended_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "generated_ville_cas_usage" (
    "id" TEXT NOT NULL,
    "ville_slug" TEXT NOT NULL,
    "verticale" TEXT NOT NULL,
    "cases" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "quality_score" DOUBLE PRECISION,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_ville_cas_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "article_slug_history_article_id_idx" ON "article_slug_history"("article_id");
CREATE UNIQUE INDEX IF NOT EXISTS "article_slug_history_old_locale_old_slug_key" ON "article_slug_history"("old_locale", "old_slug");
CREATE INDEX IF NOT EXISTS "generated_ville_ecosystem_ville_slug_idx" ON "generated_ville_ecosystem"("ville_slug");
CREATE INDEX IF NOT EXISTS "generated_ville_ecosystem_status_idx" ON "generated_ville_ecosystem"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "generated_ville_ecosystem_ville_slug_verticale_key" ON "generated_ville_ecosystem"("ville_slug", "verticale");
CREATE UNIQUE INDEX IF NOT EXISTS "generated_ville_secteurs_ville_slug_key" ON "generated_ville_secteurs"("ville_slug");
CREATE INDEX IF NOT EXISTS "generated_ville_secteurs_status_idx" ON "generated_ville_secteurs"("status");
CREATE INDEX IF NOT EXISTS "generated_ville_faq_extended_ville_slug_idx" ON "generated_ville_faq_extended"("ville_slug");
CREATE INDEX IF NOT EXISTS "generated_ville_faq_extended_status_idx" ON "generated_ville_faq_extended"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "generated_ville_faq_extended_ville_slug_verticale_key" ON "generated_ville_faq_extended"("ville_slug", "verticale");
CREATE INDEX IF NOT EXISTS "generated_ville_cas_usage_ville_slug_idx" ON "generated_ville_cas_usage"("ville_slug");
CREATE INDEX IF NOT EXISTS "generated_ville_cas_usage_status_idx" ON "generated_ville_cas_usage"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "generated_ville_cas_usage_ville_slug_verticale_key" ON "generated_ville_cas_usage"("ville_slug", "verticale");

-- AddForeignKey (guarded — idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_slug_history_article_id_fkey') THEN
    ALTER TABLE "article_slug_history" ADD CONSTRAINT "article_slug_history_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
