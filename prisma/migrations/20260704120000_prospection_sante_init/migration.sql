-- AlterEnum
ALTER TYPE "ProspectionSource" ADD VALUE IF NOT EXISTS 'annuaire_sante';

-- CreateTable
CREATE TABLE "prospection_health_practitioner" (
    "id" UUID NOT NULL,
    "rpps" TEXT,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT,
    "person_key" TEXT NOT NULL,
    "profession_libelle" TEXT,
    "specialite" TEXT,
    "specialite_libelle" TEXT,
    "siret" VARCHAR(14),
    "company_id" UUID,
    "adresse" TEXT,
    "code_postal" TEXT,
    "commune" TEXT,
    "departement" TEXT,
    "mode_exercice" TEXT,
    "source" "ProspectionSource",
    "collected_at" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),
    "opt_out" BOOLEAN NOT NULL DEFAULT false,
    "opt_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospection_health_practitioner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospection_health_practitioner_rpps_key" ON "prospection_health_practitioner"("rpps");

-- CreateIndex
CREATE INDEX "prospection_health_practitioner_person_key_idx" ON "prospection_health_practitioner"("person_key");

-- CreateIndex
CREATE INDEX "prospection_health_practitioner_departement_specialite_idx" ON "prospection_health_practitioner"("departement", "specialite");

-- CreateIndex
CREATE INDEX "prospection_health_practitioner_specialite_idx" ON "prospection_health_practitioner"("specialite");

-- CreateIndex
CREATE INDEX "prospection_health_practitioner_company_id_idx" ON "prospection_health_practitioner"("company_id");

-- AddForeignKey
ALTER TABLE "prospection_health_practitioner" ADD CONSTRAINT "prospection_health_practitioner_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "prospection_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

