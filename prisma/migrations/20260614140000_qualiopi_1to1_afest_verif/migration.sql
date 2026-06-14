-- Qualiopi 1-to-1 / AFEST — corrections post-vérification (C1, 2026-06-14).
-- 100% ADDITIVE. D-02 (idempotence protocole) + D-09 (émargement signé par séance).

-- AlterTable
ALTER TABLE "coaching_sessions" ADD COLUMN     "emargement_document_id" UUID,
ADD COLUMN     "emargement_generee_at" TIMESTAMP(3),
ADD COLUMN     "protocole_document_id" UUID,
ADD COLUMN     "protocole_generee_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "coaching_comptes_rendus" ADD COLUMN     "beneficiaire_present" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "beneficiaire_signe_at" TIMESTAMP(3),
ADD COLUMN     "formateur_signe_at" TIMESTAMP(3),
ADD COLUMN     "presence_signee_at" TIMESTAMP(3),
ADD COLUMN     "tuteur_signe_at" TIMESTAMP(3);
