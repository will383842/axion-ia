-- Facturation unifiée — Phase 2 : devis PDF + révisions + signature + avoirs
-- (migration ADDITIVE). Cf. _PLANS/PLAN-FACTURATION-UNIFIEE-2026-07-12.md.

-- AlterEnum — PG ≥ 12 : ADD VALUE autorisé en transaction (valeurs non
-- utilisées dans cette même migration).
ALTER TYPE "DocumentType" ADD VALUE 'devis';
ALTER TYPE "DocumentType" ADD VALUE 'avoir';

-- AlterTable — Devis : révisions (v2 remplace v1) + signature DocuSeal.
ALTER TABLE "devis" ADD COLUMN     "docuseal_submission_id" VARCHAR(120),
ADD COLUMN     "replaces_devis_id" UUID;

-- AlterTable — FactureFormation : avoir lié à la facture d'origine.
ALTER TABLE "factures_formation" ADD COLUMN     "avoir_de_id" UUID;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_replaces_devis_id_fkey" FOREIGN KEY ("replaces_devis_id") REFERENCES "devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "factures_formation" ADD CONSTRAINT "factures_formation_avoir_de_id_fkey" FOREIGN KEY ("avoir_de_id") REFERENCES "factures_formation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
