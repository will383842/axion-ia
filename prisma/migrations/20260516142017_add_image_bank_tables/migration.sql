-- CreateTable image_assets
CREATE TABLE "image_assets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category_id" UUID,

    "file_path" VARCHAR(500) NOT NULL,
    "thumbnail_path" VARCHAR(500),
    "avif_path" VARCHAR(500),
    "lqip_data_uri" TEXT,
    "file_format" VARCHAR(10) NOT NULL DEFAULT 'webp',
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "orientation" VARCHAR(20) NOT NULL,
    "aspect_ratio" VARCHAR(10),
    "srcset" TEXT,
    "file_hash" VARCHAR(64),

    "slug" VARCHAR(255) NOT NULL,
    "keywords_primary" VARCHAR(255),
    "keywords_secondary" JSONB,
    "seo_score" SMALLINT NOT NULL DEFAULT 0,

    "target_countries" JSONB,
    "target_languages" JSONB,
    "geo_region" VARCHAR(10),
    "geo_placename" VARCHAR(255),
    "geo_position" VARCHAR(50),

    "license_type" VARCHAR(50) NOT NULL DEFAULT 'cc-by-4.0',
    "license_url" VARCHAR(500) DEFAULT 'https://creativecommons.org/licenses/by/4.0/',
    "copyright_holder" VARCHAR(255) NOT NULL DEFAULT 'Axion-IA OÜ',
    "photographer_name" VARCHAR(255),
    "photographer_url" VARCHAR(500),

    "source_url" TEXT,
    "source_type" VARCHAR(20) NOT NULL DEFAULT 'photo',
    "ai_model" VARCHAR(60),

    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "embed_count" INTEGER NOT NULL DEFAULT 0,

    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),

    "module" VARCHAR(20),
    "sub_module" VARCHAR(60),
    "target_entity" VARCHAR(120),
    "target_city" VARCHAR(80),
    "target_region" VARCHAR(60),
    "target_size" VARCHAR(20),
    "target_persona" VARCHAR(40),
    "target_sector" VARCHAR(40),
    "target_techno" VARCHAR(30),
    "target_format" VARCHAR(20),
    "target_duration" VARCHAR(30),

    "subject_of_url" VARCHAR(500),
    "subject_of_type" VARCHAR(30),

    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "requires_human_review" BOOLEAN NOT NULL DEFAULT false,
    "requires_human_taxonomy" BOOLEAN NOT NULL DEFAULT false,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT false,

    "p_hash" VARCHAR(32),
    "custom_xmp_data" JSONB,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_assets_slug_key" ON "image_assets"("slug");
CREATE INDEX "image_assets_is_active_category_id_sort_order_idx" ON "image_assets"("is_active", "category_id", "sort_order");
CREATE INDEX "image_assets_is_active_published_at_idx" ON "image_assets"("is_active", "published_at");
CREATE INDEX "image_assets_source_type_idx" ON "image_assets"("source_type");
CREATE INDEX "image_assets_file_hash_idx" ON "image_assets"("file_hash");
CREATE INDEX "image_assets_module_sub_module_idx" ON "image_assets"("module", "sub_module");
CREATE INDEX "image_assets_module_target_city_idx" ON "image_assets"("module", "target_city");
CREATE INDEX "image_assets_module_target_region_idx" ON "image_assets"("module", "target_region");
CREATE INDEX "image_assets_subject_of_type_idx" ON "image_assets"("subject_of_type");
CREATE INDEX "image_assets_requires_human_review_idx" ON "image_assets"("requires_human_review");
CREATE INDEX "image_assets_requires_human_taxonomy_idx" ON "image_assets"("requires_human_taxonomy");
CREATE INDEX "image_assets_p_hash_idx" ON "image_assets"("p_hash");

-- CreateTable image_asset_translations
CREATE TABLE "image_asset_translations" (
    "id" SERIAL NOT NULL,
    "image_id" UUID NOT NULL,
    "language_code" VARCHAR(5) NOT NULL,

    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "alt" VARCHAR(255) NOT NULL,
    "caption" VARCHAR(500),
    "description" TEXT,

    "meta_title" VARCHAR(255),
    "meta_description" VARCHAR(255),
    "og_title" VARCHAR(255),
    "og_description" VARCHAR(255),

    "ai_summary" TEXT,
    "embed_title" VARCHAR(255),

    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_asset_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_asset_translations_image_id_language_code_key" ON "image_asset_translations"("image_id", "language_code");
CREATE INDEX "image_asset_translations_language_code_slug_idx" ON "image_asset_translations"("language_code", "slug");
CREATE INDEX "image_asset_translations_language_code_is_published_idx" ON "image_asset_translations"("language_code", "is_published");

-- CreateTable image_categories
CREATE TABLE "image_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_categories_slug_key" ON "image_categories"("slug");

-- CreateTable image_category_translations
CREATE TABLE "image_category_translations" (
    "id" SERIAL NOT NULL,
    "category_id" UUID NOT NULL,
    "language_code" VARCHAR(5) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "meta_title" VARCHAR(255),
    "meta_description" TEXT,

    CONSTRAINT "image_category_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_category_translations_category_id_language_code_key" ON "image_category_translations"("category_id", "language_code");
CREATE INDEX "image_category_translations_language_code_slug_idx" ON "image_category_translations"("language_code", "slug");

-- CreateTable image_tags
CREATE TABLE "image_tags" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,

    CONSTRAINT "image_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_tags_slug_key" ON "image_tags"("slug");

-- CreateTable image_tag_translations
CREATE TABLE "image_tag_translations" (
    "id" SERIAL NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "language_code" VARCHAR(5) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,

    CONSTRAINT "image_tag_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_tag_translations_tag_id_language_code_key" ON "image_tag_translations"("tag_id", "language_code");

-- CreateTable image_asset_tags
CREATE TABLE "image_asset_tags" (
    "image_id" UUID NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "image_asset_tags_pkey" PRIMARY KEY ("image_id", "tag_id")
);

-- CreateTable image_usage_logs
CREATE TABLE "image_usage_logs" (
    "id" BIGSERIAL NOT NULL,
    "image_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "referrer_url" VARCHAR(500),
    "user_agent" VARCHAR(500),
    "ip_hash" VARCHAR(64),
    "language" VARCHAR(5),
    "country_code" VARCHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_usage_logs_image_id_action_idx" ON "image_usage_logs"("image_id", "action");
CREATE INDEX "image_usage_logs_action_created_at_idx" ON "image_usage_logs"("action", "created_at");

-- CreateTable image_download_logs
CREATE TABLE "image_download_logs" (
    "id" BIGSERIAL NOT NULL,
    "image_id" UUID NOT NULL,
    "variant" VARCHAR(20) NOT NULL,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "referrer_url" VARCHAR(500),
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_download_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_download_logs_image_id_downloaded_at_idx" ON "image_download_logs"("image_id", "downloaded_at");
CREATE INDEX "image_download_logs_downloaded_at_idx" ON "image_download_logs"("downloaded_at");

-- CreateTable image_import_batches
CREATE TABLE "image_import_batches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "filename" VARCHAR(255) NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "image_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_import_batches_created_by_created_at_idx" ON "image_import_batches"("created_by", "created_at");
CREATE INDEX "image_import_batches_status_created_at_idx" ON "image_import_batches"("status", "created_at");

-- Foreign Keys
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "image_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "image_asset_translations" ADD CONSTRAINT "image_asset_translations_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_category_translations" ADD CONSTRAINT "image_category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "image_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_tag_translations" ADD CONSTRAINT "image_tag_translations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "image_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_asset_tags" ADD CONSTRAINT "image_asset_tags_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_asset_tags" ADD CONSTRAINT "image_asset_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "image_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_usage_logs" ADD CONSTRAINT "image_usage_logs_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_download_logs" ADD CONSTRAINT "image_download_logs_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "image_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
