-- KB V4 (Sprint KB-14) — Auto-SEO/AEO/GEO LLM cached
-- Cache déterministe stub V1 + provider/version pour invalidation V2.

CREATE TABLE "knowledge_seo_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "translation_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "provider_version" VARCHAR(40) NOT NULL,

    "seo_title" VARCHAR(70) NOT NULL,
    "seo_description" VARCHAR(200) NOT NULL,
    "aeo_faq_json" JSONB NOT NULL,
    "geo_entities_json" JSONB NOT NULL,

    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_seo_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_seo_cache_translation_id_provider_provider_version_key"
  ON "knowledge_seo_cache"("translation_id", "provider", "provider_version");

CREATE INDEX "knowledge_seo_cache_locale_provider_idx"
  ON "knowledge_seo_cache"("locale", "provider");

ALTER TABLE "knowledge_seo_cache"
  ADD CONSTRAINT "knowledge_seo_cache_translation_id_fkey"
  FOREIGN KEY ("translation_id") REFERENCES "knowledge_translations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
