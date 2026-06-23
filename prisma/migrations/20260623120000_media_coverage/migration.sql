-- Couverture médias (2026-06-23) — retombées presse externes (articles /
-- interviews) gérées depuis l'admin. Miroir des conventions press_releases.
-- Le contenu reste externe : on stocke l'URL de l'article + le média + le titre.

-- CreateTable
CREATE TABLE "media_coverage" (
    "id" UUID NOT NULL,
    "outlet" VARCHAR(255) NOT NULL,
    "url" VARCHAR(2000) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "media_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_coverage_translations" (
    "id" UUID NOT NULL,
    "coverage_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_coverage_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_coverage_status_sort_order_idx" ON "media_coverage"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_coverage_translations_coverage_id_locale_key" ON "media_coverage_translations"("coverage_id", "locale");

-- AddForeignKey
ALTER TABLE "media_coverage_translations" ADD CONSTRAINT "media_coverage_translations_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "media_coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
