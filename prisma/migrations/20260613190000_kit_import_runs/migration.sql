-- CreateEnum
CREATE TYPE "KitImportStatut" AS ENUM ('en_attente', 'en_cours', 'termine', 'erreur');

-- CreateTable
CREATE TABLE "kit_import_runs" (
    "id" UUID NOT NULL,
    "statut" "KitImportStatut" NOT NULL DEFAULT 'en_attente',
    "temp_key" TEXT,
    "file_name" VARCHAR(300),
    "summary" JSONB,
    "error" TEXT,
    "started_by_id" UUID,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kit_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kit_import_runs_statut_idx" ON "kit_import_runs"("statut");

-- CreateIndex
CREATE INDEX "kit_import_runs_created_at_idx" ON "kit_import_runs"("created_at");

