-- T4 Qualiopi — Formation Engine (grille qualité, cache IA, validation humaine,
-- traçabilité génération). Migration ADDITIVE uniquement.

-- CreateEnum
CREATE TYPE "EtapeGeneration" AS ENUM ('structure', 'contenu', 'assemblage');

-- CreateEnum
CREATE TYPE "FileValidationStatut" AS ENUM ('en_attente', 'approuve', 'rejete');

-- CreateTable
CREATE TABLE "grille_qualite_configs" (
    "id" UUID NOT NULL,
    "cle_unique" VARCHAR(100) NOT NULL,
    "criteres" JSONB NOT NULL DEFAULT '[]',
    "score_plancher" INTEGER NOT NULL DEFAULT 80,
    "nb_passes_max" INTEGER NOT NULL DEFAULT 3,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "prompt_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grille_qualite_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_ia" (
    "id" UUID NOT NULL,
    "cle" VARCHAR(64) NOT NULL,
    "valeur" JSONB NOT NULL,
    "modele" VARCHAR(80) NOT NULL,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "cout_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "prompt_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cache_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_validations" (
    "id" UUID NOT NULL,
    "formation_id" UUID NOT NULL,
    "etape" "EtapeGeneration" NOT NULL,
    "statut" "FileValidationStatut" NOT NULL DEFAULT 'en_attente',
    "consigne" TEXT,
    "contenu_propose" JSONB,
    "valide_par" UUID,
    "valide_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formation_generation_jobs" (
    "id" UUID NOT NULL,
    "formation_id" UUID NOT NULL,
    "etape" VARCHAR(64) NOT NULL,
    "tentative" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(32) NOT NULL,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "cout_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "modele" VARCHAR(80),
    "duree_ms" INTEGER,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formation_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grille_qualite_configs_cle_unique_key" ON "grille_qualite_configs"("cle_unique");
CREATE INDEX "grille_qualite_configs_actif_idx" ON "grille_qualite_configs"("actif");
CREATE UNIQUE INDEX "cache_ia_cle_key" ON "cache_ia"("cle");
CREATE INDEX "cache_ia_prompt_version_idx" ON "cache_ia"("prompt_version");
CREATE INDEX "cache_ia_expires_at_idx" ON "cache_ia"("expires_at");
CREATE INDEX "file_validations_formation_id_etape_idx" ON "file_validations"("formation_id", "etape");
CREATE INDEX "file_validations_statut_idx" ON "file_validations"("statut");
CREATE INDEX "formation_generation_jobs_formation_id_etape_idx" ON "formation_generation_jobs"("formation_id", "etape");

-- AddForeignKey
ALTER TABLE "file_validations" ADD CONSTRAINT "file_validations_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formation_generation_jobs" ADD CONSTRAINT "formation_generation_jobs_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
