-- Lieu de déroulement + créneau horaire du coaching (P0 cockpit).
-- Additif pur : toutes les colonnes sont nullables, aucune donnée existante
-- n'est touchée. Les sessions legacy restent à NULL (les documents retombent
-- sur `modalite` seule, comportement inchangé).

-- CreateEnum
CREATE TYPE "LieuType" AS ENUM ('sur_site', 'nos_locaux', 'distanciel');

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN     "lieu_type" "LieuType",
ADD COLUMN     "lieu_intitule" VARCHAR(200),
ADD COLUMN     "lieu_adresse" TEXT,
ADD COLUMN     "lieu_code_postal" VARCHAR(10),
ADD COLUMN     "lieu_ville" VARCHAR(120),
ADD COLUMN     "lieu_salle" VARCHAR(120),
ADD COLUMN     "lieu_visio_url" TEXT;

-- AlterTable
ALTER TABLE "coaching_sessions" ADD COLUMN     "date_seance_fin" TIMESTAMP(3),
ADD COLUMN     "lieu_type" "LieuType",
ADD COLUMN     "lieu_intitule" VARCHAR(200),
ADD COLUMN     "lieu_adresse" TEXT,
ADD COLUMN     "lieu_code_postal" VARCHAR(10),
ADD COLUMN     "lieu_ville" VARCHAR(120),
ADD COLUMN     "lieu_salle" VARCHAR(120),
ADD COLUMN     "lieu_visio_url" TEXT;
