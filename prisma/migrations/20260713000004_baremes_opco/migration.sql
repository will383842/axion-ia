-- Migration ADDITIVE : aucun DROP, aucune colonne NOT NULL sans default.
-- Lot 5 — Referentiel OPCO centralise et versionne (plafonds de prise en charge).
-- Complement au bareme par dossier (TrainingSession) : source de pre-remplissage.
-- Les VALEURS sont saisies par l'admin (releves portails OPCO) ; structure livree vide.

-- CreateEnum
CREATE TYPE "Opco" AS ENUM ('atlas', 'opco_ep', 'akto', 'opco2i', 'mobilites', 'afdas', 'uniformation', 'ocapiat', 'constructys', 'opcommerce', 'opco_sante');

-- CreateTable
CREATE TABLE "baremes_opco" (
    "id" UUID NOT NULL,
    "opco" "Opco" NOT NULL,
    "perimetre" VARCHAR(200),
    "intra_horaire_cents" INTEGER,
    "inter_presentiel_cents" INTEGER,
    "inter_distanciel_cents" INTEGER,
    "plafond_formation_cents" INTEGER,
    "plafond_annuel_cents" INTEGER,
    "source_url" TEXT,
    "releve_le" TIMESTAMP(3),
    "date_effet" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baremes_opco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "baremes_opco_opco_date_effet_idx" ON "baremes_opco"("opco", "date_effet");

-- CreateIndex
CREATE INDEX "baremes_opco_effective_to_idx" ON "baremes_opco"("effective_to");
