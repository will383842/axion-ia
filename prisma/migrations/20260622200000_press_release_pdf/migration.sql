-- Communiqués de presse fournis en PDF (upload direct dans l'admin).
-- Le fichier PDF devient le contenu → le corps texte devient optionnel.

-- AlterTable
ALTER TABLE "press_releases" ADD COLUMN "pdf_storage_path" VARCHAR(500);
ALTER TABLE "press_releases" ADD COLUMN "pdf_file_name" VARCHAR(255);
ALTER TABLE "press_releases" ADD COLUMN "pdf_file_size" INTEGER;
ALTER TABLE "press_releases" ADD COLUMN "pdf_hash_sha256" VARCHAR(64);

-- AlterTable
ALTER TABLE "press_release_translations" ALTER COLUMN "body" DROP NOT NULL;
