-- T9 Qualiopi — Évaluations des acquis + attestations auto.
-- Indicateur 11 (évaluation en cours + après). Migration ADDITIVE uniquement :
-- nouveaux enums + 1 nouvelle table + 3 colonnes nullables sur enrollments + FK.
-- Dérive préexistante du migrate diff volontairement IGNORÉE (hors périmètre T9).

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('initiale', 'intermediaire', 'finale');

-- CreateEnum
CREATE TYPE "NiveauAcquisition" AS ENUM ('non_acquis', 'partiellement_acquis', 'acquis');

-- CreateEnum
CREATE TYPE "AttestationResultat" AS ENUM ('complete', 'partielle', 'aucune');

-- AlterTable (additif — colonnes nullables)
ALTER TABLE "enrollments" ADD COLUMN     "attestation_document_id" UUID,
ADD COLUMN     "attestation_generee_at" TIMESTAMP(3),
ADD COLUMN     "attestation_resultat" "AttestationResultat";

-- CreateTable
CREATE TABLE "evaluations_acquis" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "date_evaluation" TIMESTAMP(3) NOT NULL,
    "score_obtenu" INTEGER NOT NULL,
    "score_max" INTEGER NOT NULL,
    "score_pct" INTEGER NOT NULL,
    "niveau_global" "NiveauAcquisition" NOT NULL,
    "reussite" BOOLEAN NOT NULL DEFAULT false,
    "competences" JSONB NOT NULL DEFAULT '[]',
    "recommandations" TEXT,
    "evalue_par_id" UUID,
    "document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_acquis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluations_acquis_enrollment_id_idx" ON "evaluations_acquis"("enrollment_id");

-- CreateIndex
CREATE INDEX "evaluations_acquis_type_idx" ON "evaluations_acquis"("type");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_attestation_document_id_fkey" FOREIGN KEY ("attestation_document_id") REFERENCES "documents_generes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_acquis" ADD CONSTRAINT "evaluations_acquis_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
