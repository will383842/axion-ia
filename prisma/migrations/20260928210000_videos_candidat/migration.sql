-- Vidéos déposées par les candidats (2026-09-28) — ADDITIF uniquement.
--
-- Une table NEUVE, aucune colonne existante touchée. Seule l'app la lit et l'écrit
-- (le worker n'a pas le volume des fichiers) : pas de fenêtre app/worker.
--
-- Réversible (les fichiers vivent sous <volume CV>/videos/<candidature>/) :
--   DROP TABLE "job_application_videos";

-- CreateTable
CREATE TABLE "job_application_videos" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "nom_original" VARCHAR(255) NOT NULL,
    "taille" INTEGER NOT NULL,
    "octets_recus" INTEGER NOT NULL DEFAULT 0,
    "mime" VARCHAR(80) NOT NULL,
    "statut" VARCHAR(20) NOT NULL,
    "motif_rejet" VARCHAR(300),
    "analyse_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_application_videos_application_id_idx" ON "job_application_videos"("application_id");

-- CreateIndex
CREATE INDEX "job_application_videos_statut_idx" ON "job_application_videos"("statut");

-- AddForeignKey
ALTER TABLE "job_application_videos" ADD CONSTRAINT "job_application_videos_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
