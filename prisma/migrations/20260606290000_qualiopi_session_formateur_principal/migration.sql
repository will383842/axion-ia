-- R9 (audit E2E 2026-06-06) — formateur principal assigné à une session.
-- Additif, non destructif. La garde applicative isTrainerHabilite empêche
-- d'assigner un formateur non habilité / sous-traitant non vérifié.

ALTER TABLE "training_sessions" ADD COLUMN "formateur_principal_id" UUID;

CREATE INDEX "training_sessions_formateur_principal_id_idx" ON "training_sessions"("formateur_principal_id");

ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_formateur_principal_id_fkey" FOREIGN KEY ("formateur_principal_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
