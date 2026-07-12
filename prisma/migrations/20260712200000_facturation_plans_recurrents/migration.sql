-- Facturation unifiée — Phase 5 : plans récurrents (migration ADDITIVE).
-- Le cron génère des BROUILLONS ; émission + envoi = clics admin.

-- CreateEnum
CREATE TYPE "PlanRecurrentStatut" AS ENUM ('actif', 'pause', 'clos');

-- AlterTable
ALTER TABLE "factures_formation" ADD COLUMN     "plan_recurrent_id" UUID;

-- CreateTable
CREATE TABLE "plans_recurrents" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "activite" "ActiviteFacturation" NOT NULL,
    "lignes" JSONB NOT NULL,
    "ref_client" VARCHAR(120),
    "periodicite_mois" INTEGER NOT NULL DEFAULT 1,
    "prochaine_generation_at" TIMESTAMP(3) NOT NULL,
    "fin_at" TIMESTAMP(3),
    "nb_max_factures" INTEGER,
    "statut" "PlanRecurrentStatut" NOT NULL DEFAULT 'actif',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_recurrents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plans_recurrents_statut_prochaine_generation_at_idx" ON "plans_recurrents"("statut", "prochaine_generation_at");

-- CreateIndex
CREATE INDEX "plans_recurrents_client_id_idx" ON "plans_recurrents"("client_id");

-- CreateIndex
CREATE INDEX "factures_formation_plan_recurrent_id_idx" ON "factures_formation"("plan_recurrent_id");

-- AddForeignKey
ALTER TABLE "plans_recurrents" ADD CONSTRAINT "plans_recurrents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_plan_recurrent_id_fkey" FOREIGN KEY ("plan_recurrent_id") REFERENCES "plans_recurrents"("id") ON DELETE SET NULL ON UPDATE CASCADE;


