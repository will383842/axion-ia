-- CreateEnum
CREATE TYPE "EdSegmentRole" AS ENUM ('script', 'prompt', 'slide', 'legende', 'consigne');

-- CreateTable
CREATE TABLE "ed_asset_segments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 1,
    "role" "EdSegmentRole" NOT NULL DEFAULT 'consigne',
    "titre" VARCHAR(200),
    "contenu" TEXT,
    "prompt" TEXT,
    "fait" BOOLEAN NOT NULL DEFAULT false,
    "ref_import" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ed_asset_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ed_asset_segments_ref_import_key" ON "ed_asset_segments"("ref_import");

-- CreateIndex
CREATE INDEX "ed_asset_segments_asset_id_ordre_idx" ON "ed_asset_segments"("asset_id", "ordre");

-- AddForeignKey
ALTER TABLE "ed_asset_segments" ADD CONSTRAINT "ed_asset_segments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "ed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

