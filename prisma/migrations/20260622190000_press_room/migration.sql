-- Salle de presse (2026-06-22) — communiqués + kit média gérés depuis l'admin.
-- Remplace les fixtures statiques `src/content/press.ts` (migrées en seed).
-- Le kit média (logo/charte/brand book) est distinct de la banque d'images.

-- CreateEnum
CREATE TYPE "PressReleaseTag" AS ENUM ('launch', 'partnership', 'study', 'product', 'milestone');

-- CreateEnum
CREATE TYPE "PressMediaKind" AS ENUM ('logo', 'wordmark', 'photo', 'brand_book', 'boilerplate', 'color_charter', 'graphic_charter');

-- CreateTable
CREATE TABLE "press_releases" (
    "id" UUID NOT NULL,
    "tag" "PressReleaseTag" NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "press_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_release_translations" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "dek" TEXT,
    "body" TEXT NOT NULL,
    "meta_title" VARCHAR(255),
    "meta_description" VARCHAR(320),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "press_release_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_media_assets" (
    "id" UUID NOT NULL,
    "kind" "PressMediaKind" NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "storage_path" VARCHAR(500),
    "file_name" VARCHAR(255),
    "file_format" VARCHAR(20),
    "file_size" INTEGER,
    "hash_sha256" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "press_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_media_asset_translations" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "press_media_asset_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "press_releases_status_published_at_idx" ON "press_releases"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "press_release_translations_release_id_locale_key" ON "press_release_translations"("release_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "press_release_translations_locale_slug_key" ON "press_release_translations"("locale", "slug");

-- CreateIndex
CREATE INDEX "press_media_assets_status_sort_order_idx" ON "press_media_assets"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "press_media_asset_translations_asset_id_locale_key" ON "press_media_asset_translations"("asset_id", "locale");

-- AddForeignKey
ALTER TABLE "press_release_translations" ADD CONSTRAINT "press_release_translations_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "press_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_media_asset_translations" ADD CONSTRAINT "press_media_asset_translations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "press_media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
