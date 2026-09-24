-- Lot L2 (2026-09-24) — guide envoyé tout de suite, lettre en double opt-in facultatif.
--
-- STRICTEMENT ADDITIVE : une table neuve, un type neuf, des colonnes NULLABLES (ou à
-- DEFAULT constant) sur `newsletter_subscribers`. PostgreSQL pose ces colonnes dans le
-- catalogue sans réécrire une ligne.
--
-- ⚠️ `ip_address` N'EST PAS supprimée ici, et c'est voulu (étape 1 de sa suppression) :
-- le modèle Prisma ne la connaît plus, donc le code ne la lit ni ne l'écrit ; la colonne
-- tombe à l'étape 2 (lot L6), dans un déploiement POSTÉRIEUR, quand plus aucun conteneur
-- en vol ne l'écrit.
--
-- ⚠️ Fenêtre app/worker : le worker atterrit ~50 min AVANT que l'entrypoint de l'app ne
-- joue cette migration. Le code du worker qui lit ces objets est écrit pour la tolérer :
-- le rattrapage et la sentinelle du guide attrapent l'absence de la table et se taisent
-- jusqu'au passage suivant ; aucune lecture worker de `newsletter_subscribers` ne
-- demande les nouvelles colonnes (sélections explicites).

-- CreateEnum
CREATE TYPE "GuideRequestOrigine" AS ENUM ('formulaire', 'admin');

-- AlterTable
ALTER TABLE "newsletter_subscribers"
  ADD COLUMN "consent_form_ref" VARCHAR(60),
  ADD COLUMN "consent_version" VARCHAR(60),
  ADD COLUMN "last_sent_at" TIMESTAMP(3),
  ADD COLUMN "last_click_at" TIMESTAMP(3),
  ADD COLUMN "soft_bounce_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_soft_bounce_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "guide_requests" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "email_key" VARCHAR(64) NOT NULL,
    "aimant" VARCHAR(40) NOT NULL,
    "origine" "GuideRequestOrigine" NOT NULL DEFAULT 'formulaire',
    "source" VARCHAR(120),
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "version" VARCHAR(60) NOT NULL,
    "download_token" VARCHAR(120) NOT NULL,
    "queued_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "send_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3),
    "first_click_at" TIMESTAMP(3),
    "crm_emitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_requests_download_token_key" ON "guide_requests"("download_token");

-- CreateIndex
CREATE UNIQUE INDEX "guide_requests_email_key_aimant_key" ON "guide_requests"("email_key", "aimant");

-- CreateIndex
CREATE INDEX "guide_requests_sent_at_queued_at_idx" ON "guide_requests"("sent_at", "queued_at");

-- CreateIndex
CREATE INDEX "guide_requests_created_at_idx" ON "guide_requests"("created_at");
