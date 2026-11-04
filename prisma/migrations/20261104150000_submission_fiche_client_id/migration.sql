-- Fiche prospect depuis une demande ecrite (2026-11-04) : le message recu par le site est relie a la fiche console (clients).
-- STRICTEMENT ADDITIF : une colonne nullable, sans defaut, sans rattrapage, sans CHECK, sans enumeration, sans cle etrangere.
-- IDEMPOTENT (IF NOT EXISTS) : la colonne peut etre posee A LA MAIN avant la fusion sans que la migration echoue ensuite.
-- Le worker (code TS interprete, ~3 min apres la fusion) connait la colonne ~50 min AVANT que l entrypoint de l app migre :
-- poser ce SQL sur la base AVANT de fusionner (voir la PR). L interrupteur DOSSIER_FICHE_DEMANDE reste coupe tant que
-- la colonne n est pas prouvee (prisma migrate status + \d submissions).
-- Retour arriere (JAMAIS execute par defaut) : DROP INDEX "submissions_fiche_client_id_idx"; ALTER TABLE "submissions" DROP COLUMN "fiche_client_id";

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "fiche_client_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "submissions_fiche_client_id_idx" ON "submissions"("fiche_client_id");
