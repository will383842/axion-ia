-- Fiche prospect depuis une demande ecrite (2026-11-04) : le message recu par le site est relie a la fiche console (clients).
-- STRICTEMENT ADDITIF : une colonne nullable, sans defaut, sans rattrapage, sans CHECK, sans enumeration, sans cle etrangere.
-- IDEMPOTENT (IF NOT EXISTS) : rejouer cette migration ne change rien.
-- SQL SEUL, a deployer AVANT le code (deux conteneurs) : le champ Prisma arrive avec la PR du code, qui ne fusionne
-- qu apres la mise en ligne de celle-ci et la preuve de la colonne en production (migrate status + \d submissions).
-- Rien n est pose a la main en production : la migration passe par la mise en ligne normale (heures fixes), son entrypoint la joue.
-- Retour arriere (JAMAIS execute par defaut) : DROP INDEX "submissions_fiche_client_id_idx"; ALTER TABLE "submissions" DROP COLUMN "fiche_client_id";

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "fiche_client_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "submissions_fiche_client_id_idx" ON "submissions"("fiche_client_id");
