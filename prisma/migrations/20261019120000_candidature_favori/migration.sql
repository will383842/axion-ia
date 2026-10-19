-- Favoris de la vue « Monteurs & vidéastes » (demande Will 2026-10-19).
-- ADDITIVE : une colonne nullable, sans défaut, sans reprise du stock (NULL = pas favori).
-- Aucune énumération ni forme de job BullMQ touchée. Pas d'index : le filtre se fait
-- en mémoire sur 1 000 dossiers au plus par offre (video-freelance.ts, PLAFOND_LECTURE_VIDEO).
-- Retour arrière (JAMAIS exécuté par défaut) :
--   ALTER TABLE "job_applications" DROP COLUMN "favori_at";
ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "favori_at" TIMESTAMP(3);
