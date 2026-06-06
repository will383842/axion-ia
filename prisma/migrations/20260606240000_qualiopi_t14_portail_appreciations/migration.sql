-- T14 Qualiopi — Portail stagiaire + appréciations multi-parties (off.30) + RGPD.
-- Migration ADDITIVE : 3 enums + 3 tables + index + FK. Dérive préexistante IGNORÉE.

-- CreateEnum
CREATE TYPE "AppreciationSource" AS ENUM ('stagiaire', 'entreprise', 'financeur', 'formateur');

-- CreateEnum
CREATE TYPE "RgpdDemandeType" AS ENUM ('export', 'suppression');

-- CreateEnum
CREATE TYPE "RgpdDemandeStatut" AS ENUM ('demandee', 'traitee', 'refusee');

-- CreateTable
CREATE TABLE "portail_acces" (
    "id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portail_acces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appreciations" (
    "id" UUID NOT NULL,
    "source" "AppreciationSource" NOT NULL,
    "enrollment_id" UUID,
    "trainee_id" UUID,
    "client_id" UUID,
    "note" INTEGER,
    "commentaire" TEXT,
    "date_appreciation" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appreciations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rgpd_demandes" (
    "id" UUID NOT NULL,
    "trainee_id" UUID NOT NULL,
    "type" "RgpdDemandeType" NOT NULL,
    "statut" "RgpdDemandeStatut" NOT NULL DEFAULT 'demandee',
    "demande_at" TIMESTAMP(3) NOT NULL,
    "traitee_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rgpd_demandes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portail_acces_token_key" ON "portail_acces"("token");

-- CreateIndex
CREATE INDEX "portail_acces_trainee_id_idx" ON "portail_acces"("trainee_id");

-- CreateIndex
CREATE INDEX "appreciations_source_idx" ON "appreciations"("source");

-- CreateIndex
CREATE INDEX "appreciations_date_appreciation_idx" ON "appreciations"("date_appreciation");

-- CreateIndex
CREATE INDEX "appreciations_enrollment_id_idx" ON "appreciations"("enrollment_id");

-- CreateIndex
CREATE INDEX "rgpd_demandes_trainee_id_idx" ON "rgpd_demandes"("trainee_id");

-- CreateIndex
CREATE INDEX "rgpd_demandes_statut_idx" ON "rgpd_demandes"("statut");

-- AddForeignKey
ALTER TABLE "portail_acces" ADD CONSTRAINT "portail_acces_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rgpd_demandes" ADD CONSTRAINT "rgpd_demandes_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
