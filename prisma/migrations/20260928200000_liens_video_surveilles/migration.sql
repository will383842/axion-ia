-- Liens vidéo surveillés (2026-09-28) — ADDITIF uniquement.
--
-- Une table NEUVE, aucune colonne existante touchée.
--
-- Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'app ne joue cette
-- migration, et c'est LUI qui écrit cette table (passage hebdomadaire). Le passage
-- s'abstient en silence tant que la table n'existe pas (P2021) : il ne se déclenche
-- de toute façon que le lundi matin.
--
-- Réversible :
--   DROP TABLE "job_application_links";

-- CreateTable
CREATE TABLE "job_application_links" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "url" VARCHAR(2000) NOT NULL,
    "etat" VARCHAR(20) NOT NULL,
    "http_status" INTEGER,
    "verifie_le" TIMESTAMP(3) NOT NULL,
    "mort_depuis" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_application_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_application_links_application_id_url_key" ON "job_application_links"("application_id", "url");

-- CreateIndex
CREATE INDEX "job_application_links_etat_idx" ON "job_application_links"("etat");

-- AddForeignKey
ALTER TABLE "job_application_links" ADD CONSTRAINT "job_application_links_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
