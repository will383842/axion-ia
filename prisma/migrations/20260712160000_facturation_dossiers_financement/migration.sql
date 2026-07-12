-- Facturation unifiée — Phase 3 : dossiers de financement multi-payeurs
-- (migration ADDITIVE). Cycle a_monter → envoye → accord_recu|refuse → facture
-- → paiement_recu → clos. Montant reçu dérivé des Payment (jamais dupliqué).
-- Cf. _PLANS/PLAN-FACTURATION-UNIFIEE-2026-07-12.md.

-- CreateEnum
CREATE TYPE "DossierFinancementType" AS ENUM ('opco', 'france_travail', 'cpf', 'mixte');

-- CreateEnum
CREATE TYPE "DossierFinancementStatut" AS ENUM ('a_monter', 'envoye', 'accord_recu', 'refuse', 'facture', 'paiement_recu', 'clos');

-- CreateEnum
CREATE TYPE "DossierPayeurType" AS ENUM ('entreprise', 'opco_subroge', 'france_travail', 'stagiaire');

-- AlterTable
ALTER TABLE "factures_formation" ADD COLUMN     "dossier_financement_id" UUID,
ADD COLUMN     "est_importee" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "dossiers_financement" (
    "id" UUID NOT NULL,
    "type" "DossierFinancementType" NOT NULL,
    "statut" "DossierFinancementStatut" NOT NULL DEFAULT 'a_monter',
    "financeur_nom" VARCHAR(120),
    "numero_dossier_externe" VARCHAR(80),
    "subrogation" BOOLEAN NOT NULL DEFAULT false,
    "montant_demande_cents" INTEGER,
    "montant_accorde_cents" INTEGER,
    "echeance_financeur_at" TIMESTAMP(3),
    "envoye_at" TIMESTAMP(3),
    "accord_at" TIMESTAMP(3),
    "refuse_at" TIMESTAMP(3),
    "paiement_recu_at" TIMESTAMP(3),
    "clos_at" TIMESTAMP(3),
    "notes" TEXT,
    "client_id" UUID,
    "training_session_id" UUID,
    "coaching_contract_id" UUID,
    "audit_mission_id" UUID,
    "devis_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_financement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers_payeurs" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "payeur_type" "DossierPayeurType" NOT NULL,
    "payeur_nom" VARCHAR(250) NOT NULL,
    "montant_attendu_cents" INTEGER NOT NULL,
    "facture_formation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossiers_payeurs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossiers_financement_statut_idx" ON "dossiers_financement"("statut");

-- CreateIndex
CREATE INDEX "dossiers_financement_client_id_idx" ON "dossiers_financement"("client_id");

-- CreateIndex
CREATE INDEX "dossiers_financement_training_session_id_idx" ON "dossiers_financement"("training_session_id");

-- CreateIndex
CREATE INDEX "dossiers_financement_type_statut_idx" ON "dossiers_financement"("type", "statut");

-- CreateIndex
CREATE INDEX "dossiers_payeurs_dossier_id_idx" ON "dossiers_payeurs"("dossier_id");

-- CreateIndex
CREATE INDEX "dossiers_payeurs_facture_formation_id_idx" ON "dossiers_payeurs"("facture_formation_id");

-- CreateIndex
CREATE INDEX "factures_formation_dossier_financement_id_idx" ON "factures_formation"("dossier_financement_id");

-- AddForeignKey
ALTER TABLE "dossiers_financement" ADD CONSTRAINT "dossiers_financement_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_financement" ADD CONSTRAINT "dossiers_financement_training_session_id_fkey" FOREIGN KEY ("training_session_id") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_financement" ADD CONSTRAINT "dossiers_financement_coaching_contract_id_fkey" FOREIGN KEY ("coaching_contract_id") REFERENCES "coaching_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_financement" ADD CONSTRAINT "dossiers_financement_audit_mission_id_fkey" FOREIGN KEY ("audit_mission_id") REFERENCES "audit_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_financement" ADD CONSTRAINT "dossiers_financement_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_payeurs" ADD CONSTRAINT "dossiers_payeurs_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers_financement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers_payeurs" ADD CONSTRAINT "dossiers_payeurs_facture_formation_id_fkey" FOREIGN KEY ("facture_formation_id") REFERENCES "factures_formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_dossier_financement_id_fkey" FOREIGN KEY ("dossier_financement_id") REFERENCES "dossiers_financement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


