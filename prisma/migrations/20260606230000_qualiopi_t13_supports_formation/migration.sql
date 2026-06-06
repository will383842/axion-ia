-- T13 Qualiopi — Supports de formation (slides/livret/mémo/guide/exercices/
-- grille d'éval) à la charte. off.17/19. Migration ADDITIVE : 2 enums + 1 table
-- + index + FK. PDF stockés en propre (R2), distincts des DocumentGenere légaux.
-- Dérive préexistante IGNORÉE.

-- CreateEnum
CREATE TYPE "SupportType" AS ENUM ('slides_formateur', 'slides_stagiaire', 'livret_stagiaire', 'memo', 'guide_animation', 'exercices', 'grille_eval');

-- CreateEnum
CREATE TYPE "SupportStatut" AS ENUM ('brouillon', 'genere', 'archive');

-- CreateTable
CREATE TABLE "supports_formation" (
    "id" UUID NOT NULL,
    "formation_id" UUID NOT NULL,
    "type" "SupportType" NOT NULL,
    "titre" VARCHAR(300) NOT NULL,
    "contenu" JSONB NOT NULL DEFAULT '{}',
    "pdf_key" TEXT,
    "pdf_url" TEXT,
    "hash_sha256" VARCHAR(64),
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "statut" "SupportStatut" NOT NULL DEFAULT 'brouillon',
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supports_formation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supports_formation_formation_id_idx" ON "supports_formation"("formation_id");

-- CreateIndex
CREATE INDEX "supports_formation_type_idx" ON "supports_formation"("type");

-- AddForeignKey
ALTER TABLE "supports_formation" ADD CONSTRAINT "supports_formation_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
