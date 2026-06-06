-- R-INTER (audit E2E 2026-06-06) — sessions inter-entreprises : financement +
-- facture PAR participant. 100% additif, non destructif (toutes les colonnes
-- nullable sauf inter_entreprises qui a un DEFAULT false → intra inchangé).

-- 1) Session : marqueur inter-entreprises
ALTER TABLE "training_sessions" ADD COLUMN "inter_entreprises" BOOLEAN NOT NULL DEFAULT false;

-- 2) Enrollment : financement par participant (override du financement session)
ALTER TABLE "enrollments" ADD COLUMN "financement_type" "FinancementType";
ALTER TABLE "enrollments" ADD COLUMN "client_id" UUID;
ALTER TABLE "enrollments" ADD COLUMN "numero_dossier_opco" VARCHAR(60);
ALTER TABLE "enrollments" ADD COLUMN "edof_verifie_at" TIMESTAMP(3);
ALTER TABLE "enrollments" ADD COLUMN "ft_dispositif" "FranceTravailDispositif";
ALTER TABLE "enrollments" ADD COLUMN "montant_ht_cents" INTEGER;
CREATE INDEX "enrollments_client_id_idx" ON "enrollments"("client_id");
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Facture : rattachement optionnel à une inscription (facture inter par participant)
ALTER TABLE "factures_formation" ADD COLUMN "enrollment_id" UUID;
CREATE INDEX "factures_formation_enrollment_id_idx" ON "factures_formation"("enrollment_id");
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
