-- Lot 1 « fiche client » (2026-10-25, décisions de Will) : (1) lieu et objet d'un rendez-vous saisi
-- dans la console ; (2) un questionnaire avant audit peut viser une fiche client SANS rendez-vous.
-- ADDITIVE : trois colonnes NULLABLES (rencontres.lieu, rencontres.objet,
-- questionnaires_avant_audit.client_id), un index, une clé étrangère en SET NULL. Aucune donnée
-- existante touchée, aucune énumération, aucune forme de job BullMQ changée, aucune colonne sur
-- "clients" (ADR 0053). RÉ-EXÉCUTABLE : IF NOT EXISTS partout, contrainte gardée dans un bloc DO.
-- Aucune donnée personnelle ajoutée (le téléphone du contact reste sur "client_contacts").
-- Migration livrée SEULE, AVANT le code qui l'écrit (deux conteneurs app/worker : le worker peut
-- tourner du code ou sans la colonne ; aucun code ne la lit ou l'écrit dans cette PR).
-- SET NULL : supprimer une fiche (geste de Will) laisse le questionnaire et ses réponses.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   ALTER TABLE "questionnaires_avant_audit" DROP CONSTRAINT "questionnaires_avant_audit_client_id_fkey";
--   DROP INDEX "questionnaires_avant_audit_client_id_idx";
--   ALTER TABLE "questionnaires_avant_audit" DROP COLUMN "client_id";
--   ALTER TABLE "rencontres" DROP COLUMN "objet";
--   ALTER TABLE "rencontres" DROP COLUMN "lieu";
ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "lieu" VARCHAR(200);
ALTER TABLE "rencontres" ADD COLUMN IF NOT EXISTS "objet" VARCHAR(255);

ALTER TABLE "questionnaires_avant_audit" ADD COLUMN IF NOT EXISTS "client_id" UUID;
CREATE INDEX IF NOT EXISTS "questionnaires_avant_audit_client_id_idx"
    ON "questionnaires_avant_audit"("client_id");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_avant_audit_client_id_fkey') THEN
    ALTER TABLE "questionnaires_avant_audit"
      ADD CONSTRAINT "questionnaires_avant_audit_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
