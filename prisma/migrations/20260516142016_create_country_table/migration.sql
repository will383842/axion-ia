-- CreateTable
CREATE TABLE "countries" (
    "iso_code" VARCHAR(2) NOT NULL,
    "iso3" VARCHAR(3),
    "name_fr" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "slug_fr" VARCHAR(100) NOT NULL,
    "slug_en" VARCHAR(100) NOT NULL,
    "continent" VARCHAR(20),
    "flag_emoji" VARCHAR(8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("iso_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");
CREATE INDEX "countries_name_fr_idx" ON "countries"("name_fr");
CREATE INDEX "countries_name_en_idx" ON "countries"("name_en");
CREATE INDEX "countries_slug_fr_idx" ON "countries"("slug_fr");
CREATE INDEX "countries_slug_en_idx" ON "countries"("slug_en");
