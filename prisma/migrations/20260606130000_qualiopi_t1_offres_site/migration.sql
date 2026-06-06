-- T1 Qualiopi — referentiel offres_site (PART5 A.1).
-- Migration ADDITIVE uniquement (CREATE TYPE / CREATE TABLE / CREATE INDEX).
-- Le prix N'est PAS stocke : derive de src/content/pricing.ts via tier_id (SSOT).

-- CreateEnum
CREATE TYPE "OffreCategorie" AS ENUM ('intervention');

-- CreateEnum
CREATE TYPE "OffreFormatPedagogique" AS ENUM ('collectif_4h', 'collectif_1jour', 'collectif_2jours', 'conference', 'dirigeant_1to1', 'individuel', 'sur_devis');

-- CreateEnum
CREATE TYPE "OffreTarifType" AS ENUM ('fixe', 'a_partir_de', 'sur_devis');

-- CreateTable
CREATE TABLE "offres_site" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "tier_id" VARCHAR(80) NOT NULL,
    "titre_fr" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "categorie" "OffreCategorie" NOT NULL DEFAULT 'intervention',
    "format_pedagogique" "OffreFormatPedagogique" NOT NULL,
    "public_vise_fr" TEXT NOT NULL,
    "duree_heures_min" INTEGER NOT NULL,
    "duree_heures_max" INTEGER NOT NULL,
    "modalites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tarif_type" "OffreTarifType" NOT NULL,
    "promesse_principale_fr" TEXT NOT NULL,
    "nb_modules_min" INTEGER NOT NULL DEFAULT 2,
    "nb_modules_max" INTEGER NOT NULL DEFAULT 6,
    "ratio_pratique_min" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "angle_pedagogique_fr" VARCHAR(300) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_verif_coherence_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offres_site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offres_site_code_key" ON "offres_site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "offres_site_tier_id_key" ON "offres_site"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "offres_site_slug_key" ON "offres_site"("slug");

-- CreateIndex
CREATE INDEX "offres_site_categorie_idx" ON "offres_site"("categorie");

-- CreateIndex
CREATE INDEX "offres_site_actif_idx" ON "offres_site"("actif");
