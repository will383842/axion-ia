-- Console documents : bibliothèque générique de documents admin (hub « Documents »).
-- Migration ADDITIVE — ne touche à aucune table/colonne existante (cf. doctrine
-- migrations additives, ADR 0026). Aucun DROP.

-- CreateEnum
CREATE TYPE "ConsoleDocSection" AS ENUM ('implementations', 'sites_web', 'autres');

-- CreateTable
CREATE TABLE "console_documents" (
    "id" UUID NOT NULL,
    "section" "ConsoleDocSection" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "file_name" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "console_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "console_documents_section_sort_order_idx" ON "console_documents"("section", "sort_order");
