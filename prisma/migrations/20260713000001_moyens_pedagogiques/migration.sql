-- Inventaire des moyens pédagogiques et techniques (off.17/18/19 — doc A14).
-- Migration ADDITIVE : aucun DROP, aucune colonne NOT NULL sans default.

-- CreateEnum
CREATE TYPE "MoyenCategorie" AS ENUM ('salle', 'materiel', 'plateforme', 'humain');

-- CreateTable
CREATE TABLE "moyens_pedagogiques" (
    "id" UUID NOT NULL,
    "categorie" "MoyenCategorie" NOT NULL,
    "libelle" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "localisation" VARCHAR(250) NOT NULL DEFAULT '',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "date_verification" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moyens_pedagogiques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moyens_pedagogiques_categorie_idx" ON "moyens_pedagogiques"("categorie");

-- CreateIndex
CREATE INDEX "moyens_pedagogiques_actif_idx" ON "moyens_pedagogiques"("actif");
