-- Facturation unifiée — Phase 4 : relances PROPOSÉES (migration ADDITIVE).
-- Les crons détectent et proposent ; l'envoi client = clic admin, JAMAIS auto.

-- CreateEnum
CREATE TYPE "RelanceProposeeType" AS ENUM ('facture_retard', 'devis_sans_reponse', 'dossier_financeur');

-- CreateEnum
CREATE TYPE "RelanceProposeeStatut" AS ENUM ('a_traiter', 'envoyee', 'ignoree', 'reportee');

-- CreateTable
CREATE TABLE "relances_proposees" (
    "id" UUID NOT NULL,
    "type" "RelanceProposeeType" NOT NULL,
    "palier" VARCHAR(10) NOT NULL,
    "statut" "RelanceProposeeStatut" NOT NULL DEFAULT 'a_traiter',
    "invoice_id" UUID,
    "facture_formation_id" UUID,
    "quote_id" UUID,
    "devis_id" UUID,
    "dossier_financement_id" UUID,
    "suggestion" TEXT,
    "reportee_jusqua" TIMESTAMP(3),
    "traitee_at" TIMESTAMP(3),
    "traitee_par_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relances_proposees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relances_proposees_statut_created_at_idx" ON "relances_proposees"("statut", "created_at");

-- CreateIndex
CREATE INDEX "relances_proposees_facture_formation_id_idx" ON "relances_proposees"("facture_formation_id");

-- CreateIndex
CREATE INDEX "relances_proposees_invoice_id_idx" ON "relances_proposees"("invoice_id");

-- CreateIndex
CREATE INDEX "relances_proposees_quote_id_idx" ON "relances_proposees"("quote_id");

-- AddForeignKey
ALTER TABLE "relances_proposees" ADD CONSTRAINT "relances_proposees_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_proposees" ADD CONSTRAINT "relances_proposees_facture_formation_id_fkey" FOREIGN KEY ("facture_formation_id") REFERENCES "factures_formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_proposees" ADD CONSTRAINT "relances_proposees_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_proposees" ADD CONSTRAINT "relances_proposees_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_proposees" ADD CONSTRAINT "relances_proposees_dossier_financement_id_fkey" FOREIGN KEY ("dossier_financement_id") REFERENCES "dossiers_financement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


