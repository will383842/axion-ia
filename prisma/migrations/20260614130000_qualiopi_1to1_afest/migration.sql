-- Qualiopi 1-to-1 / AFEST — couche administrative/légale (C1, 2026-06-14).
-- 100% ADDITIVE : ajouts d'enum, colonnes nullable / avec default, 2 tables,
-- + 2 DROP NOT NULL (élargissement, sans perte de données). Aucun DROP de table
-- ni de colonne. `migrate deploy`-safe.
-- Délta isolé via `prisma migrate diff` (baseline origin/main → schéma modifié).

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'protocole_afest';

-- AlterEnum
ALTER TYPE "CoachingSessionStatut" ADD VALUE 'reportee';

-- AlterTable
ALTER TABLE "trainers" ADD COLUMN     "afest_habilite_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "documents_generes" ADD COLUMN     "coaching_session_id" UUID;

-- AlterTable
ALTER TABLE "evaluations_acquis" ADD COLUMN     "coaching_session_id" UUID,
ALTER COLUMN "enrollment_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "factures_formation" ADD COLUMN     "coaching_contract_id" UUID,
ALTER COLUMN "session_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "coaching_sessions" ADD COLUMN     "attestation_document_id" UUID,
ADD COLUMN     "attestation_generee_at" TIMESTAMP(3),
ADD COLUMN     "attestation_resultat" "AttestationResultat",
ADD COLUMN     "coaching_contract_id" UUID,
ADD COLUMN     "convention_signee_at" TIMESTAMP(3),
ADD COLUMN     "duree_reelle_heures" DECIMAL(6,2),
ADD COLUMN     "est_afest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "heures_prevues_convention" DECIMAL(6,2),
ADD COLUMN     "inter_entreprises" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objectifs_pedagogiques" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tuteur_entreprise_email" CITEXT,
ADD COLUMN     "tuteur_entreprise_nom" VARCHAR(200),
ADD COLUMN     "tuteur_entreprise_signee_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "coaching_contracts" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "trainee_id" UUID,
    "client_id" UUID,
    "booking_id" UUID,
    "intervention_slug" VARCHAR(80) NOT NULL,
    "montant_ht_cents" INTEGER NOT NULL,
    "date_signee_at" TIMESTAMP(3),
    "duree_contrat_mois" INTEGER,
    "nb_seances_max" INTEGER,
    "financement_type" "FinancementType" NOT NULL DEFAULT 'direct',
    "numero_dossier_opco" VARCHAR(60),
    "subrogation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaching_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_transitions" (
    "id" UUID NOT NULL,
    "coaching_session_id" UUID NOT NULL,
    "from_status" "CoachingSessionStatut",
    "to_status" "CoachingSessionStatut" NOT NULL,
    "trigger" VARCHAR(80) NOT NULL,
    "triggered_by" "TransitionTriggeredBy" NOT NULL,
    "triggered_by_id" UUID,
    "reason" VARCHAR(500),
    "snapshot_before" JSONB,
    "snapshot_after" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coaching_contracts_numero_key" ON "coaching_contracts"("numero");

-- CreateIndex
CREATE INDEX "coaching_contracts_trainee_id_idx" ON "coaching_contracts"("trainee_id");

-- CreateIndex
CREATE INDEX "coaching_contracts_client_id_idx" ON "coaching_contracts"("client_id");

-- CreateIndex
CREATE INDEX "coaching_contracts_intervention_slug_idx" ON "coaching_contracts"("intervention_slug");

-- CreateIndex
CREATE INDEX "coaching_transitions_coaching_session_id_created_at_idx" ON "coaching_transitions"("coaching_session_id", "created_at");

-- CreateIndex
CREATE INDEX "coaching_transitions_triggered_by_idx" ON "coaching_transitions"("triggered_by");

-- CreateIndex
CREATE UNIQUE INDEX "coaching_transitions_idempotence" ON "coaching_transitions"("coaching_session_id", "to_status", "trigger");

-- CreateIndex
CREATE INDEX "documents_generes_coaching_session_id_idx" ON "documents_generes"("coaching_session_id");

-- CreateIndex
CREATE INDEX "evaluations_acquis_coaching_session_id_idx" ON "evaluations_acquis"("coaching_session_id");

-- CreateIndex
CREATE INDEX "factures_formation_coaching_contract_id_idx" ON "factures_formation"("coaching_contract_id");

-- CreateIndex
CREATE INDEX "coaching_sessions_coaching_contract_id_idx" ON "coaching_sessions"("coaching_contract_id");

-- CreateIndex
CREATE INDEX "coaching_sessions_est_afest_idx" ON "coaching_sessions"("est_afest");

-- AddForeignKey
ALTER TABLE "documents_generes" ADD CONSTRAINT "documents_generes_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_acquis" ADD CONSTRAINT "evaluations_acquis_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_coaching_contract_id_fkey" FOREIGN KEY ("coaching_contract_id") REFERENCES "coaching_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_coaching_contract_id_fkey" FOREIGN KEY ("coaching_contract_id") REFERENCES "coaching_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_contracts" ADD CONSTRAINT "coaching_contracts_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "trainees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_contracts" ADD CONSTRAINT "coaching_contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_transitions" ADD CONSTRAINT "coaching_transitions_coaching_session_id_fkey" FOREIGN KEY ("coaching_session_id") REFERENCES "coaching_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
