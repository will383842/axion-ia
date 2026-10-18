-- Vidéos du studio sur le site (lot W1, ADR 0070). ADDITIVE : deux tables neuves, un type neuf.
-- Aucune colonne ni valeur d'énumération existante touchée ; le worker n'y touche pas.
-- Retour arrière (JAMAIS exécuté par défaut) :
--   DROP TABLE "site_video_receptions"; DROP TABLE "site_videos"; DROP TYPE "SiteVideoStatut";

-- CreateEnum
CREATE TYPE "SiteVideoStatut" AS ENUM ('publiee', 'retiree');

-- CreateTable
CREATE TABLE "site_videos" (
    "id" UUID NOT NULL,
    "studio_video_id" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "statut" "SiteVideoStatut" NOT NULL DEFAULT 'publiee',
    "theme" VARCHAR(60) NOT NULL,
    "serie_slug" VARCHAR(80),
    "serie_titre" VARCHAR(120),
    "serie_rang" INTEGER,
    "titre" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "resume" TEXT NOT NULL,
    "a_retenir" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "chapitres" JSONB NOT NULL DEFAULT '[]',
    "fichiers" JSONB NOT NULL,
    "transcription" TEXT,
    "duree_secondes" INTEGER NOT NULL,
    "lien_type" VARCHAR(20) NOT NULL,
    "lien_chemin" VARCHAR(200) NOT NULL,
    "ia_voix_generee" BOOLEAN NOT NULL DEFAULT false,
    "ia_double_numerique" BOOLEAN NOT NULL DEFAULT false,
    "williams_a_l_image" BOOLEAN NOT NULL DEFAULT false,
    "corps_sha256" CHAR(64) NOT NULL,
    "publiee_le" TIMESTAMPTZ(3) NOT NULL,
    "modifiee_le" TIMESTAMPTZ(3) NOT NULL,
    "retiree_le" TIMESTAMPTZ(3),
    "motif_retrait" VARCHAR(20),

    CONSTRAINT "site_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_video_receptions" (
    "id" UUID NOT NULL,
    "nonce" CHAR(32) NOT NULL,
    "methode" VARCHAR(8) NOT NULL,
    "chemin" VARCHAR(80) NOT NULL,
    "horodatage" INTEGER NOT NULL,
    "corps_sha256" CHAR(64) NOT NULL,
    "studio_video_id" VARCHAR(64),
    "reponse_statut" INTEGER NOT NULL,
    "reponse_corps" JSONB NOT NULL,
    "recue_le" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_video_receptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_videos_studio_video_id_key" ON "site_videos"("studio_video_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_videos_slug_key" ON "site_videos"("slug");

-- CreateIndex
CREATE INDEX "site_videos_statut_theme_idx" ON "site_videos"("statut", "theme");

-- CreateIndex
CREATE INDEX "site_videos_serie_idx" ON "site_videos"("serie_slug", "serie_rang");

-- CreateIndex
CREATE UNIQUE INDEX "site_video_receptions_nonce_key" ON "site_video_receptions"("nonce");

-- CreateIndex
CREATE INDEX "site_video_receptions_recue_le_idx" ON "site_video_receptions"("recue_le");

