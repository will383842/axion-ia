-- Qualiopi 1-to-1 — parité financement (OPCO ventilation, CPF/EDOF, France Travail,
-- RNCP/RS, certificat, harmonisation off.30/31). 100% ADDITIVE. migrate-deploy-safe.

-- AlterTable
ALTER TABLE "factures_formation" ADD COLUMN     "montant_aide_france_travail_cents" INTEGER;

-- AlterTable
ALTER TABLE "reclamations" ADD COLUMN     "coaching_session_id" UUID;

-- AlterTable
ALTER TABLE "appreciations" ADD COLUMN     "coaching_session_id" UUID;

-- AlterTable
ALTER TABLE "coaching_sessions" ADD COLUMN     "blocs_competences" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "certificat_document_id" UUID,
ADD COLUMN     "certificat_generee_at" TIMESTAMP(3),
ADD COLUMN     "certification_type" "CertificationType" NOT NULL DEFAULT 'aucune',
ADD COLUMN     "code_rncp" VARCHAR(20),
ADD COLUMN     "code_rs" VARCHAR(20),
ADD COLUMN     "cpf_eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "date_echeance_certif" TIMESTAMP(3),
ADD COLUMN     "date_enregistrement_certif" TIMESTAMP(3),
ADD COLUMN     "numero_enregistrement_fc" VARCHAR(40);

-- AlterTable
ALTER TABLE "coaching_contracts" ADD COLUMN     "convention_tripartite_signee_at" TIMESTAMP(3),
ADD COLUMN     "cpf_payeur_reste_charge" VARCHAR(40),
ADD COLUMN     "edof_verifie_at" TIMESTAMP(3),
ADD COLUMN     "ft_aif_prescription_date" TIMESTAMP(3),
ADD COLUMN     "ft_dispositif" "FranceTravailDispositif",
ADD COLUMN     "ft_poei_accord_financement_at" TIMESTAMP(3),
ADD COLUMN     "ft_poei_engagement_signe_at" TIMESTAMP(3),
ADD COLUMN     "ft_poei_offre_emploi_numero" VARCHAR(50),
ADD COLUMN     "prise_en_charge_montant_cents" INTEGER,
ADD COLUMN     "prise_en_charge_plafond_annuel_cents" INTEGER,
ADD COLUMN     "prise_en_charge_plafond_formation_cents" INTEGER,
ADD COLUMN     "prise_en_charge_releve_le" TIMESTAMP(3),
ADD COLUMN     "prise_en_charge_source_url" TEXT,
ADD COLUMN     "prise_en_charge_unite" "PriseEnChargeUnite",
ADD COLUMN     "reste_a_charge_cents" INTEGER;

-- CreateIndex
CREATE INDEX "reclamations_coaching_session_id_idx" ON "reclamations"("coaching_session_id");

-- CreateIndex
CREATE INDEX "appreciations_coaching_session_id_idx" ON "appreciations"("coaching_session_id");

-- AddForeignKey
ALTER TABLE "reclamations" ADD CONSTRAINT "reclamations_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
