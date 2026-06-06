-- T8 Qualiopi — Émargement présentiel + relevé de connexion distanciel.
-- Suivi de l'exécution (indicateur 12). Migration ADDITIVE uniquement :
-- nouveaux enums + 2 nouvelles tables + 1 colonne nullable sur documents_generes.
-- Aucune modification/suppression des objets existants (dérive préexistante du
-- migrate diff volontairement IGNORÉE — hors périmètre T8).

-- CreateEnum
CREATE TYPE "DemiJournee" AS ENUM ('matin', 'apres_midi', 'journee');

-- CreateEnum
CREATE TYPE "PresenceSource" AS ENUM ('emargement_presentiel', 'import_zoom', 'import_teams', 'import_meet', 'manuel');

-- CreateEnum
CREATE TYPE "PlateformeDistanciel" AS ENUM ('zoom', 'teams', 'meet', 'autre');

-- AlterTable (additive, colonne nullable — archive du fichier source original CDC)
ALTER TABLE "documents_generes" ADD COLUMN     "fichier_original_path" TEXT;

-- CreateTable
CREATE TABLE "presence_creneaux" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "demi_journee" "DemiJournee" NOT NULL,
    "libelle" VARCHAR(120) NOT NULL,
    "duree_prevue_minutes" INTEGER NOT NULL,
    "duree_realisee_minutes" INTEGER NOT NULL DEFAULT 0,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "source" "PresenceSource" NOT NULL,
    "heure_connexion" TIMESTAMP(3),
    "heure_deconnexion" TIMESTAMP(3),
    "import_id" UUID,
    "commentaire" TEXT,
    "enregistre_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_creneaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releves_connexion_imports" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "plateforme" "PlateformeDistanciel" NOT NULL,
    "fichier_original_nom" VARCHAR(255) NOT NULL,
    "fichier_original_path" TEXT,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "nb_lignes" INTEGER NOT NULL DEFAULT 0,
    "nb_matched" INTEGER NOT NULL DEFAULT 0,
    "nb_unmatched" INTEGER NOT NULL DEFAULT 0,
    "unmatched" JSONB NOT NULL DEFAULT '[]',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "importe_par_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "releves_connexion_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "presence_creneaux_enrollment_id_idx" ON "presence_creneaux"("enrollment_id");

-- CreateIndex
CREATE INDEX "presence_creneaux_import_id_idx" ON "presence_creneaux"("import_id");

-- CreateIndex
CREATE UNIQUE INDEX "presence_creneau_unique" ON "presence_creneaux"("enrollment_id", "date", "demi_journee");

-- CreateIndex
CREATE INDEX "releves_connexion_imports_session_id_idx" ON "releves_connexion_imports"("session_id");

-- AddForeignKey
ALTER TABLE "presence_creneaux" ADD CONSTRAINT "presence_creneaux_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_creneaux" ADD CONSTRAINT "presence_creneaux_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "releves_connexion_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releves_connexion_imports" ADD CONSTRAINT "releves_connexion_imports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
