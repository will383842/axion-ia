-- Facturation unifiée — Phase 1 : fondations données (migration ADDITIVE).
-- Activité transversale aux 5 métiers, SIRET/pays/réf. commande acheteur,
-- FactureFormation ouverte aux factures libres (client/devis/mission d'audit),
-- Payment = SSOT encaissements des deux familles, adresse structurée Client,
-- flag secteur public (Chorus Pro). Aucun DROP, aucune colonne NOT NULL sans
-- default. Cf. _PLANS/PLAN-FACTURATION-UNIFIEE-2026-07-12.md.

-- CreateEnum
CREATE TYPE "ActiviteFacturation" AS ENUM ('formation', 'un_a_un', 'audit', 'implementation', 'site_web');

-- AlterEnum — PG ≥ 12 : ADD VALUE autorisé en transaction (la valeur n'est pas
-- utilisée dans cette même migration). BEFORE pour coller à l'ordre du schéma.
ALTER TYPE "FactureFormationStatut" ADD VALUE 'partiellement_payee' BEFORE 'payee';
ALTER TYPE "FactureFormationStatut" ADD VALUE 'en_retard' BEFORE 'payee';

-- AlterTable — Payment : cible facultative FactureFormation (Hub), booking optionnel.
ALTER TABLE "payments" ADD COLUMN     "facture_formation_id" UUID,
ALTER COLUMN "booking_id" DROP NOT NULL;

-- AlterTable — Invoice (booking) : identité acheteur EN 16931 + lignes structurées.
ALTER TABLE "invoices" ADD COLUMN     "activite" "ActiviteFacturation",
ADD COLUMN     "lignes" JSONB,
ADD COLUMN     "payer_country_code" VARCHAR(2),
ADD COLUMN     "payer_siret" VARCHAR(14),
ADD COLUMN     "ref_client" VARCHAR(120);

-- AlterTable — Quote (booking).
ALTER TABLE "quotes" ADD COLUMN     "activite" "ActiviteFacturation",
ADD COLUMN     "ref_client" VARCHAR(120);

-- AlterTable — Client (CRM) : SIREN, TVA intracom, adresse structurée, secteur public.
ALTER TABLE "clients" ADD COLUMN     "adresse_code_postal" VARCHAR(12),
ADD COLUMN     "adresse_pays_code" VARCHAR(2),
ADD COLUMN     "adresse_rue" VARCHAR(300),
ADD COLUMN     "adresse_ville" VARCHAR(120),
ADD COLUMN     "est_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "siren" VARCHAR(9),
ADD COLUMN     "tva_intracom" VARCHAR(40);

-- AlterTable — Devis (CRM).
ALTER TABLE "devis" ADD COLUMN     "activite" "ActiviteFacturation",
ADD COLUMN     "ref_client" VARCHAR(120);

-- AlterTable — FactureFormation : facture libre (client/devis/mission) + suivi paiement.
ALTER TABLE "factures_formation" ADD COLUMN     "activite" "ActiviteFacturation",
ADD COLUMN     "audit_mission_id" UUID,
ADD COLUMN     "client_id" UUID,
ADD COLUMN     "destinataire_tva_intracom" VARCHAR(40),
ADD COLUMN     "devis_id" UUID,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "ref_client" VARCHAR(120);

-- CreateIndex
CREATE INDEX "payments_facture_formation_id_idx" ON "payments"("facture_formation_id");
CREATE INDEX "factures_formation_client_id_idx" ON "factures_formation"("client_id");
CREATE INDEX "factures_formation_devis_id_idx" ON "factures_formation"("devis_id");
CREATE INDEX "factures_formation_audit_mission_id_idx" ON "factures_formation"("audit_mission_id");
CREATE INDEX "factures_formation_activite_idx" ON "factures_formation"("activite");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_facture_formation_id_fkey" FOREIGN KEY ("facture_formation_id") REFERENCES "factures_formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_audit_mission_id_fkey" FOREIGN KEY ("audit_mission_id") REFERENCES "audit_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
